// Higher/Lower: the computer's play.
import { tune } from '../../core/tune.js';
import { levelOf } from '../../core/aiw.js';
import { hiloLeft, hiloOpen, hiloPart, hiloTop } from './rules.js';

// Halving the range finds the number within its guesses when there are enough (5 guesses cover 31
// numbers): the middle number, every time. Its last guess is a gamble: a miss hands the square over, so
// with one guess left a wide range is worth leaving alone (qLose), and a guess only taken when it is likely.
// Hard: the guess with the best chance of being the one to land on the number (hiloRace): every miss narrows
// the range for the other side too, so the middle is not always best (on 3 numbers an end guess wins 2 in 3).
// Race mode (core/race.js, `rv: 2`): each player their own number and range, no limit: the computer reads its own range
// alone and halves it (the fewest guesses on average, at every level: a miss narrows nothing for the other side, so the
// two-sided race below does not apply); the other side's range, open to it, says how near they are (needs).
export function needs(pm, p) {
  const r = hiloOpen(pm, p), n = r <= 1 ? 1 : Math.log2(r + 1);
  return n > hiloLeft(pm, p) + 0.001 ? Math.max(n, hiloLeft(pm, p) + 2) : n;   // more than its guesses left: a long shot (never in a race: no limit)
}
// The levels (the settings' Computer: Easy / Normal / Hard). Shared mode: a miss narrows the range for both, and the
// halver's middle is not always good (on 15 numbers it leaves the other side the better odds), so a level weighs only
// the guesses in the middle part of the range (aiSpread<Level> %, 0 the middle itself) and takes the one with the best
// odds (hiloRace) as often as aiSharp<Level> says, else any of them: Easy halves (the obvious play), Hard plays the
// exact race. Race mode: halving is the fewest guesses, so a level strays from the middle by aiRace<Level> % of the range.
const LV = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const DEF = { aiSpreadEasy: 0, aiSharpEasy: 0, aiSpreadNormal: 100, aiSharpNormal: 0, aiSpreadHard: 100, aiSharpHard: 100, aiRaceEasy: 100, aiRaceNormal: 40, aiRaceHard: 0 };
const knob = (T, k, l) => { const v = Number(T[k + LV[l]]); return Number.isFinite(v) ? v : DEF[k + LV[l]]; };
function band(part, spread) {
  const mid = Math.floor((part.lo + part.hi) / 2), w = Math.floor((part.hi - part.lo) * Math.max(0, Math.min(100, spread || 0)) / 200);
  return { lo: Math.max(part.lo, mid - w), hi: Math.min(part.hi, mid + w), mid };
}
const pickIn = (b, rng) => (b.hi > b.lo && rng ? b.lo + Math.floor(rng() * (b.hi - b.lo + 1)) : b.mid);
// The chance a guess k (its place in a range of r, 1 to r) wins the race, both playing their best after it.
export function hiloOdds(r, g, h, k) {
  const th = n => (!n ? 0 : g <= 1 ? 0 : 1 - hiloRace(n, h, g - 1).w);
  return 1 / r + (k - 1) / r * th(k - 1) + (r - k) / r * th(r - k);
}
export function best(pm, me, rng, style, ctx) {
  const part = hiloPart(pm, me) || { lo: 1, hi: hiloTop(pm) };
  const r = part.hi - part.lo + 1, left = hiloLeft(pm, me), q = 1 / r, lv = levelOf((ctx && ctx.level) || 'normal'), T = tune(pm);
  if (pm.race) return { move: pickIn(band(part, knob(T, 'aiRace', lv)), rng), q, qLose: 0, shared: false };   // (a race: halving, the fewest guesses to its own number)
  const b = band(part, knob(T, 'aiSpread', lv)), sharp = knob(T, 'aiSharp', lv) / 100;
  let move = b.mid;
  if (sharp > 0 && r <= R_MAX && (sharp >= 1 || (rng && rng() < sharp))) {
    const o = me === 'X' ? 'O' : 'X', g = Math.min(G_MAX, left), h = Math.min(G_MAX, hiloLeft(pm, o));
    if (b.lo === part.lo && b.hi === part.hi) move = part.lo + hiloRace(r, g, h).k - 1;   // (the whole range: the race's own pick, the halver's best answer among equals)
    else { let top = -1; for (let k = b.lo; k <= b.hi; k++) { const w = hiloOdds(r, g, h, k - part.lo + 1); if (w > top + 1e-9) { top = w; move = k; } } }
  } else if (sharp < 1) move = pickIn(b, rng);
  return { move, q, qLose: left === 1 ? 1 - q : 0, shared: true };
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
// A level's mistake (core/ai.js aiSlip, aiMiss<Level>): a guess near the middle with the worst odds (Shared), or one
// well off the middle (Race), never the number it would have guessed.
export function worse(pm, me, rng, ctx) {
  const part = hiloPart(pm, me) || { lo: 1, hi: hiloTop(pm) }, r = part.hi - part.lo + 1;
  if (r < 2) return null;
  const b = band(part, 50), not = ctx && ctx.best;
  if (pm.race || r > R_MAX) { const k = pickIn(band(part, 100), rng); return k === not ? null : k; }
  const o = me === 'X' ? 'O' : 'X', g = Math.min(G_MAX, hiloLeft(pm, me)), h = Math.min(G_MAX, hiloLeft(pm, o));
  let low = Infinity, out = [];
  for (let k = b.lo; k <= b.hi; k++) {
    if (k === not) continue;
    const w = hiloOdds(r, g, h, k - part.lo + 1);
    if (w < low - 1e-9) { low = w; out = [k]; } else if (w < low + 1e-9) out.push(k);
  }
  return out.length ? out[rng ? Math.floor(rng() * out.length) : 0] : null;
}
