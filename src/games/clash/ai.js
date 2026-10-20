// Clash Grid: the computer's play.
import { CLASH, CLASH_LINES } from './rules.js';
import { other } from '../../core/util.js';

// What a cell is worth to p: each run of four through it still open to p, more the more of it p holds
// (the fourth: the square). Its own runs (W) weigh more than the other player's (WD: a run of theirs is
// blocked in earnest once it holds three): blocking everything leaves a grid nobody can win.
const W = [1, 4, 16, 1000], WD = [0.3, 1, 5, 900];
function worth(cells, i, p, w) {
  let v = 0;
  for (const l of CLASH_LINES) if (l.includes(i) && l.every(k => cells[k] == null || cells[k] === p)) v += w[l.filter(k => cells[k] === p).length];
  return v;
}
export function needs(pm, p) {   // the fewest claims still missing from a run p can make
  let best = Infinity;
  for (const l of CLASH_LINES) if (l.every(k => pm.cells[k] == null || pm.cells[k] === p)) best = Math.min(best, l.filter(k => pm.cells[k] == null).length);
  return best === Infinity ? Infinity : best + 0.5;               // (a collision now and then costs a claim)
}
// Its own lines, the other player's best line blocked; and a cell the other player is likely to pick too
// (their best: their own line, or a block of its) is worth less the more of its own it puts there: a collision
// blocks the cell for good, which still stops the other player there but gains it nothing.
export function best(pm, me, rng, style, ctx) {
  const o = other(me), cells = pm.cells, open = [];
  for (let i = 0; i < cells.length; i++) if (cells[i] == null) open.push(i);
  const att = i => worth(cells, i, me, W), def = i => worth(cells, i, o, WD);
  const pref = open.map(i => Math.pow(worth(cells, i, o, W) + 0.8 * worth(cells, i, me, WD), 3)), sum = pref.reduce((a, b) => a + b, 0) || 1;   // the other player's own choice, as it would weigh it
  const vals = open.map((i, k) => { const a = att(i), d = def(i), p = Math.min(0.85, pref[k] / sum); return { i, p, win: a >= W[3], v: (1 - p) * a + d }; });
  const hi = Math.max(...vals.map(x => x.v)), near = vals.filter(x => x.v >= hi * 0.8 - 1e-9);   // among the cells nearly as good, one at random: a player who can be read is easy to clash with
  const top = near[Math.floor(rng() * near.length)];
  return { move: top.i, q: top.win ? 1 - top.p : 0 };
}
