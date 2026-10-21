// Clash Grid: the computer's play.
import { clashLinesOf, clashNeed } from './rules.js';
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';

// What a cell is worth to p: each run of four through it still open to p, more the more of it p holds
// (the fourth: the square). Its own runs (W) weigh more than the other player's (WD: a run of theirs is
// blocked in earnest once it holds three): blocking everything leaves a grid nobody can win.
// (A run of another length, the admin's setting: the same weights, the last one the run's last cell.)
const W = [1, 4, 16, 1000], WD = [0.3, 1, 5, 900];
const weights = (w, k) => (k === w.length ? w : Array.from({ length: k }, (_, j) => (j === k - 1 ? w[w.length - 1] : w[Math.min(j, w.length - 2)])));
function worth(cells, i, p, w, lines) {
  let v = 0;
  for (const l of lines) if (l.includes(i) && l.every(k => cells[k] == null || cells[k] === p)) v += w[l.filter(k => cells[k] === p).length];
  return v;
}
export function needs(pm, p) {   // the fewest claims still missing from a run p can make
  let best = Infinity;
  for (const l of clashLinesOf(pm)) if (l.every(k => pm.cells[k] == null || pm.cells[k] === p)) best = Math.min(best, l.filter(k => pm.cells[k] == null).length);
  return best === Infinity ? Infinity : best + 0.5;               // (a collision now and then costs a claim)
}
// Its own lines, the other player's best line blocked; and a cell the other player is likely to pick too
// (their best: their own line, or a block of its) is worth less the more of its own it puts there: a collision
// blocks the cell for good, which still stops the other player there but gains it nothing.
export function best(pm, me, rng, style, ctx) {
  const o = other(me), cells = pm.cells, open = [], L = clashLinesOf(pm), k = clashNeed(pm), w = weights(W, k), wd = weights(WD, k);
  for (let i = 0; i < cells.length; i++) if (cells[i] == null) open.push(i);
  const miss = tune(pm).miss || 0;                               // (the admin's mistake rate: a claim anywhere open)
  if (miss && rng() * 100 < miss) return { move: open[randInt(rng, open.length)], q: 0 };
  if (ctx && ctx.level === 'hard') return clashEv(pm, me, rng, ctx.until);
  const att = i => worth(cells, i, me, w, L), def = i => worth(cells, i, o, wd, L);
  const pref = open.map(i => Math.pow(worth(cells, i, o, w, L) + 0.8 * worth(cells, i, me, wd, L), 3)), sum = pref.reduce((a, b) => a + b, 0) || 1;   // the other player's own choice, as it would weigh it
  const vals = open.map((i, k) => { const a = att(i), d = def(i), p = Math.min(0.85, pref[k] / sum); return { i, p, win: a >= w[k - 1], v: (1 - p) * a + d }; });
  const hi = Math.max(...vals.map(x => x.v)), near = vals.filter(x => x.v >= hi * 0.8 - 1e-9);   // among the cells nearly as good, one at random: a player who can be read is easy to clash with
  const top = near[Math.floor(rng() * near.length)];
  return { move: top.i, q: top.win ? 1 - top.p : 0 };
}

// ---- Hard: the expected value of every cell against the other player's likely claims ----
// The other player's claim is guessed as a mix: half the ordinary computer's own choice (the cells it would
// pick from, each as likely), half a softer weighing of every open cell by what it is worth to them, and a
// share spread over every open cell (a player is never read for certain: a four they might miss is tried). For
// each of my cells, every claim of theirs is played through the round's rule (the same cell: blocked for
// good; four in a row for one side: the square, for both: a reset) and the rest valued by the runs still
// open to each side; the best few cells, with the clock, a round further (the same reckoning in the position
// after). q and qLose: the chances the round takes the square, or hands it over.
const F = [0, 1, 4, 16, 64];                                     // a run's worth by the cells held of it (the last: already four)
export function clashEv(pm, me, rng, until) {
  const o = other(me), cells0 = pm.cells, n = cells0.length, L = clashLinesOf(pm), need = clashNeed(pm), w = weights(W, need), wd = weights(WD, need), f = need === 4 ? F : Array.from({ length: need + 1 }, (_, j) => F[Math.min(j, 3)] * (j === need ? 4 : 1));
  const byCell = Array.from({ length: n }, () => []); L.forEach((l, j) => { for (const c of l) byCell[c].push(j); });
  let nodes = 0, out = false;
  const tick = () => { if (until && (++nodes & 63) === 0 && until() <= 0) out = true; };
  // the other player's likely claims in a position: [{ i, p }]
  const guess = (cells, open) => {
    const pref = open.map(i => Math.pow(worth(cells, i, me, w, L) + 0.8 * worth(cells, i, o, wd, L), 3)), sum = pref.reduce((a, b) => a + b, 0) || 1;
    const vals = open.map((i, k) => { const p = Math.min(0.85, pref[k] / sum); return (1 - p) * worth(cells, i, o, w, L) + worth(cells, i, me, wd, L); });
    const hi = Math.max(...vals), near = vals.map(v => (v >= hi * 0.8 - 1e-9 ? 1 : 0)), nn = near.reduce((a, b) => a + b, 0) || 1;
    const soft = vals.map(v => v * v), ss = soft.reduce((a, b) => a + b, 0) || 1;
    return open.map((i, k) => ({ i, p: 0.85 * (0.5 * near[k] / nn + 0.5 * soft[k] / ss) + 0.15 / open.length }));   // (and a share spread over every cell: a player is never read for certain)
  };
  const lineOf = (cells, p) => L.find(l => l.every(k => cells[k] === p)) || null;
  const still = (cells, p) => L.some(l => l.every(k => cells[k] == null || cells[k] === p));
  const value = cells => {                                       // the position for me: the runs still open to each side
    let v = 0;
    for (const l of L) {
      let m = 0, t = 0; for (const k of l) { if (cells[k] === me) m++; else if (cells[k] === o) t++; else if (cells[k] === 'B') { m = t = -1; break; } }
      if (m < 0 || (m && t)) continue;
      v += m ? f[m] : -f[t];
    }
    return v / (Math.abs(v) + 100);                              // (a run of three, 16, is worth about a seventh of the square: a chance of taking it now outweighs the runs)
  };
  // the round from a position: my cell i against theirs j: { v, win, lose, cells }
  const round = (cells, i, j) => {
    const c = cells.slice();
    if (i === j) c[i] = 'B'; else { c[i] = me; c[j] = o; }
    const a = !!lineOf(c, me), b = !!lineOf(c, o);
    if (a !== b) return { v: a ? 1 : -1, win: a, lose: b };
    if (a || !c.includes(null) || (!still(c, me) && !still(c, o))) return { v: 0, win: false, lose: false };
    return { v: value(c), win: false, lose: false, cells: c };
  };
  const open0 = []; for (let i = 0; i < n; i++) if (cells0[i] == null) open0.push(i);
  const ev = (cells, open, deeper) => {                          // every cell of mine: its EV against the guessed claims
    const g = guess(cells, open), outs = [];
    for (const i of open) {
      if (out) break;
      let v = 0, q = 0, ql = 0;
      for (const { i: j, p } of g) {
        if (!p) continue;
        const r = round(cells, i, j);
        let rv = r.v;
        if (deeper && r.cells) { const next = []; for (let k = 0; k < n; k++) if (r.cells[k] == null) next.push(k); const e = ev(r.cells, next, false); rv = 0.5 * r.v + 0.5 * e[0].v; }
        v += p * rv; if (r.win) q += p; if (r.lose) ql += p;
        tick();
      }
      if (out && outs.length) break;                             // (the clock: a value not whole is no value, past the first)
      outs.push({ i, v, q, ql });
    }
    return outs.sort((a, b) => b.v - a.v);
  };
  const one = ev(cells0, open0, false);
  let top = one;
  if (until && open0.length > 1) {                               // a round further, the best few cells, while the clock allows
    const few = one.slice(0, 6), two = [];
    for (const c of few) { const r = ev(cells0, [c.i], true); if (out) break; two.push(Object.assign({}, c, { v: r[0].v })); }
    if (two.length) top = two.sort((a, b) => b.v - a.v);
  }
  const hi = top[0].v, ties = top.filter(c => c.v >= hi - 1e-9), pick = ties[ties.length > 1 ? randInt(rng, ties.length) : 0];   // (equal cells: one at random, not to be read)
  return { move: pick.i, q: pick.q, qLose: pick.ql };
}
