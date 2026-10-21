// Higher/Lower: the computer's play.
import { hiloLeft } from './rules.js';

// Halving the range finds the number within its guesses when there are enough (5 guesses cover 31
// numbers): the middle number, every time. Its last guess is a gamble: a miss hands the square over, so
// with one guess left a wide range is worth leaving alone (qLose), and a guess only taken when it is likely.
// Hard: the guess with the best chance of being the one to land on the number (hiloRace): every miss narrows
// the range for the other side too, so the middle is not always best (on 3 numbers an end guess wins 2 in 3).
export function needs(pm, p) {
  const r = pm.hi - pm.lo + 1, n = r <= 1 ? 1 : Math.log2(r + 1);
  return n > hiloLeft(pm, p) + 0.001 ? Math.max(n, hiloLeft(pm, p) + 2) : n;   // more than its guesses left: a long shot
}
export function best(pm, me, rng, style, ctx) {
  const r = pm.hi - pm.lo + 1, left = hiloLeft(pm, me), q = 1 / r;
  if (ctx && ctx.level === 'hard') {
    const o = me === 'X' ? 'O' : 'X', k = hiloRace(r, Math.min(G_MAX, left), Math.min(G_MAX, hiloLeft(pm, o))).k;
    return { move: pm.lo + k - 1, q, qLose: left === 1 ? 1 - q : 0, shared: true };
  }
  return { move: Math.floor((pm.lo + pm.hi) / 2), q, qLose: left === 1 ? 1 - q : 0, shared: true };
}

// ---- Hard: the race ----
// W(r, g, h): the chance the player to move, with g guesses left to the other's h, wins a square whose number
// is one of r, both guessing their best; and k, the guess (its place in the range, 1 to r) that gets it. A
// hit (1 in r) wins; a miss leaves k - 1 or r - k numbers to the other side, or loses the square when it was
// the last guess. Many guesses are worth the same against the best play (on an even range, every one is a
// coin toss), so among those the one that does best against a halver (the usual play: the middle, every
// time) is taken: WH, the same race with the other side halving. Kept, worked out as needed (r to 99 numbers,
// 12 guesses each: the settings' most).
const R_MAX = 99, G_MAX = 12, SIZE = (R_MAX + 1) * (G_MAX + 1) * (G_MAX + 1);
const W = new Float64Array(SIZE), WH = new Float64Array(SIZE), K = new Uint8Array(SIZE);
export function hiloRace(r, g, h) {
  if (r <= 1) return { w: 1, wh: 1, k: 1 };
  r = Math.min(R_MAX, r); g = Math.max(1, Math.min(G_MAX, g)); h = Math.max(1, Math.min(G_MAX, h));
  const i = (r * (G_MAX + 1) + g) * (G_MAX + 1) + h;
  if (K[i]) return { w: W[i], wh: WH[i], k: K[i] };
  const theirs = (n, best) => {                                  // my chance once n numbers are left and the other side guesses (its best, or the middle)
    if (!n) return 0;
    if (g === 1) return 0;                                       // (my last guess missed: the square is theirs)
    if (best) return 1 - hiloRace(n, h, g - 1).w;
    if (h === 1) return (n - 1) / n;                             // their last guess: a miss hands it to me
    const m = (n + 1) >> 1, lo = m - 1, hi = n - m;              // the middle (the lower of two)
    return (lo ? lo / n * hiloRace(lo, g - 1, h - 1).wh : 0) + (hi ? hi / n * hiloRace(hi, g - 1, h - 1).wh : 0);
  };
  let top = -1, topH = -1, pick = 1;
  for (let k = 1; k <= r; k++) {
    const lo = k - 1, hi = r - k;
    const w = 1 / r + lo / r * theirs(lo, true) + hi / r * theirs(hi, true), wh = 1 / r + lo / r * theirs(lo, false) + hi / r * theirs(hi, false);
    if (w > top + 1e-9 || (w > top - 1e-9 && wh > topH + 1e-9)) { top = w; topH = wh; pick = k; }
  }
  W[i] = top; WH[i] = topH; K[i] = pick;
  return { w: top, wh: topH, k: pick };
}
