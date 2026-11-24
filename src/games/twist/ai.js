// Twist Four: the computer's play. A position is scored by the runs still open to each side (`score`: every window of
// the winning length holding one side's pieces alone counts by how many it holds). Every level takes a win it sees.
import { other } from '../../core/util.js';
import { tune } from '../../core/tune.js';
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
// Each level's play is its settings (meta.js TUNE, Computer: Easy / Normal / Hard): how it picks (`aiLook<Level>`: 0
// any move that does not lose at once, 1 its best move by score after it), whether it blocks (`aiBlock<Level>`: passes
// over a move after which the other side has a line at once, looked for over every move, where another will do) and
// its mistakes (`aiMiss<Level>`, `worse`). A look further ahead (the other side's best reply by score, then its own
// answer: the old Hard) was measured weaker than the best move by score with the block (it lost 60 squares of 60, the
// AI levels pass, November 2026): a twist undoes so much that the score after one's own move is the better guide.
const LV = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const LOOK = { easy: 1, normal: 1, hard: 1 }, BLOCK = { easy: 'off', normal: 'on', hard: 'on' };
export function levelCfg(pm, level) {
  const t = tune(pm), L = LV[level] ? level : 'normal', k = LV[L], v = t['aiLook' + k];
  return { look: v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : LOOK[L], block: (t['aiBlock' + k] || BLOCK[L]) === 'on' };
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', cfg = levelCfg(pm, level), n = pm.n, L = pm.L, o = other(me), all = ranked(pm.cells, n, L, me);
  const out = x => ({ move: x.r.turned ? x.m : { c: x.m.c }, q: x.r.end === 'win' ? 1 : 0.05 });
  if (all[0].r.end === 'win') return out(all[0]);
  let live = all.filter(x => x.r.end !== 'lose');
  if (!live.length) return out(all[0]);
  if (cfg.block) { const safe = live.filter(x => { if (x.r.end === 'draw') return true; const rep = ranked(x.r.cells, n, L, o)[0]; return !(rep && rep.r.end === 'win'); }); if (safe.length) live = safe; }
  if (cfg.look <= 0) return out(live[Math.floor(rng() * live.length)]);
  const top = live.filter(x => x.v >= live[0].v - 1e-9);
  return out(top[Math.floor(rng() * top.length)]);
}
// A weaker move a person might make (the mistake rate, core/ai.js aiSlip): a move that looked good on its face (among
// its best by score after the move), not the one it would play, and never one that loses at once where it has another.
export function worse(pm, me, rng, ctx) {
  const all = ranked(pm.cells, pm.n, pm.L, me).filter(x => x.r.end !== 'lose' && x.r.end !== 'win'), b = ctx && ctx.best;
  const pool = all.filter(x => !(b && x.m.c === b.c && (b.q == null || (x.m.q === b.q && x.m.d === b.d)))).slice(0, 10);
  if (!pool.length) return null;
  const x = pool[Math.floor(rng() * pool.length)];
  return x.r.turned ? x.m : { c: x.m.c };
}
