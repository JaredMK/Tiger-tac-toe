// Twist Five: the computer's play. A position is scored by the runs still open to each side (`score`: every window of
// the winning length holding one side's pieces alone counts by how many it holds). Easy plays any move that does not
// lose at once, taking a win it sees. Normal takes a win; else, of its best few moves by score, the one that stands
// best after the other side's best reply (a move a twist undoes is no defence). Hard does the same over more moves
// and looks on to its own best answer, within `ctx.until`.
import { other } from '../../core/util.js';
import { twistLines, twistTry } from './rules.js';

const W = [0, 1, 4, 14, 60, 400];
export function score(cells, n, L, me) {
  let s = 0; const o = other(me);
  for (const w of twistLines(n, L)) { let a = 0, b = 0; for (const i of w) { if (cells[i] === me) a++; else if (cells[i] === o) b++; } if (a && !b) s += W[a]; else if (b && !a) s -= W[b] * 1.15; }
  return s;
}
function moves(cells, n) { const out = []; for (let c = 0; c < cells.length; c++) if (!cells[c]) for (let q = 0; q < 4; q++) for (const d of [1, -1]) out.push({ c, q, d }); return out; }
// Every move of p with what it comes to, best first by the score after it.
function ranked(cells, n, L, p) {
  const out = [];
  for (const m of moves(cells, n)) { const r = twistTry(cells, n, L, p, m); if (!r) continue; out.push({ m, r, v: r.end === 'win' ? 1e6 : r.end === 'lose' ? -1e6 : score(r.cells, n, L, p) }); }
  out.sort((x, y) => y.v - x.v); return out;
}
export function needs(pm, p) { let most = 0; const o = other(p); for (const w of twistLines(pm.n, pm.L)) { let a = 0, b = 0; for (const i of w) { if (pm.cells[i] === p) a++; else if (pm.cells[i] === o) b++; } if (!b) most = Math.max(most, a); } return Math.max(1, pm.L - most); }
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', n = pm.n, L = pm.L, o = other(me), all = ranked(pm.cells, n, L, me), until = ctx && typeof ctx.until === 'function' ? ctx.until : null;
  const out = x => ({ move: x.r.turned ? x.m : { c: x.m.c }, q: x.r.end === 'win' ? 1 : 0.05 });
  if (all[0].r.end === 'win') return out(all[0]);
  const live = all.filter(x => x.r.end !== 'lose');
  if (!live.length) return out(all[0]);
  if (level === 'easy') return out(live[Math.floor(rng() * live.length)]);
  // Each of the best few moves by score is judged by the other side's best reply to it (a twist undoes a lot: a move
  // that looks fine until the quarter is turned back is no defence): Normal by the score after that reply; Hard over
  // more moves, and on to its own best answer to the reply.
  const top = live.slice(0, level === 'hard' ? 16 : 8);
  let bestV = -Infinity, bestX = [];
  for (const x of top) {
    let v = x.v;
    if (x.r.end !== 'draw') {
      const replies = ranked(x.r.cells, n, L, o), reply = replies[0];
      if (reply && reply.r.end === 'win') v = -5e5 + x.v * 0.001;   // it hands over a win
      else if (reply) {
        v = -reply.v;
        if (level === 'hard' && reply.r.end == null && !(until && until() <= 0)) { const mine = ranked(reply.r.cells, n, L, me)[0]; if (mine) v = mine.r.end === 'win' ? 2e5 : (mine.v - reply.v) / 2; }
      }
    }
    if (v > bestV + 1e-9) { bestV = v; bestX = [x]; } else if (Math.abs(v - bestV) <= 1e-9) bestX.push(x);
  }
  return out(bestX[Math.floor(rng() * bestX.length)]);
}
