// Split It: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own pints. A full pint glass carries the mover's mark at a height of its own (`mark[p]`: a share of
// the glass from its base, public, drawn between the settings' lowest and highest place at the deal and again, with
// the move's rng, after each of that player's attempts). A move is one hold: while held the glass tips and the level
// falls (pintLevel: the share left after t ms, gently at first as the glass tips, then steadily and a little faster
// as it goes; the same function for the view, the replays and the computer); letting go stops it. The move is
// `{ lv }`, the level left at the release (0 to 1, kept to 3 places). Within `tol` of the mark's middle is a split
// (1 point), within `perfect` a perfect split (2); else nothing (too little drunk, or too much; a glass drunk
// empty is always a miss). A fresh pint and a fresh mark after every attempt. First to `goal` points takes the
// square. "Go again on success" (off by default): any split keeps the turn. Nothing is hidden. Where the drink was
// stopped is the phone's word (the server cannot time a finger letting go, as with Key Drop's stops), so the game is
// held out of Find Match (core/games.js FIND_MATCH_HOLD).
import { needRng } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// ease: ms over which the flow comes up to its full rate as the glass tips; gain: how much faster the flow runs with
// each second after that (a share of the rate); ms of a move's picture: `up` the glass back upright, `settle` the
// drink sloshing to rest (from the release), `say` the verdict's line across and the words, `hold` the result on
// show, `next` the fresh pint sliding in.
export const PINT = { ease: 320, gain: 0.2, up: 300, settle: 700, say: 400, hold: 520, next: 440 };
const r3 = v => Math.round(v * 1000) / 1000, other = p => (p === 'X' ? 'O' : 'X');
export function pintCfg(mini) {
  const t = tune(mini), tol = t.tol / 100, lo = Math.min(t.markLo, t.markHi) / 100, hi = Math.max(t.markLo, t.markHi) / 100;
  return { goal: t.goal, tol, perfect: Math.min(t.perfect / 100, tol), rate: t.rate / 100, lo, hi, ai: { easy: t.aiMsEasy, normal: t.aiMs, hard: t.aiMsHard } };
}
// The share of the glass drunk after a hold of t ms, the level left then, and the hold that leaves a level (the
// time to the empty glass for 0).
export function pintDrunk(c, t) {
  const E = PINT.ease, s = Math.max(0, t), x = s - E;
  return c.rate * (s <= E ? s * s / (2 * E) : E / 2 + x + PINT.gain * x * x / 2000) / 1000;
}
export const pintLevel = (c, t) => Math.max(0, 1 - pintDrunk(c, t));
export function pintTime(c, lv) {
  const E = PINT.ease, D = Math.max(0, 1 - lv) * 1000 / c.rate;
  return D <= E / 2 ? Math.sqrt(2 * E * D) : E + (Math.sqrt(1 + PINT.gain * (D - E / 2) / 500) - 1) * 1000 / PINT.gain;
}
export const pintSpeed = (c, t) => (pintDrunk(c, t + 1) - pintDrunk(c, t - 1)) * 500;   // the level's fall, shares a second, t ms into a hold
const drawMark = (c, rng) => r3(c.lo + (c.hi - c.lo) * needRng(rng)());
// An attempt judged: 2 a perfect split, 1 a split, 0 neither (d: the level less the mark; above it, too little drunk).
export function pintJudge(c, lv, mark) { const off = Math.abs(lv - mark); return lv <= 0 ? 0 : off <= c.perfect + 1e-9 ? 2 : off <= c.tol + 1e-9 ? 1 : 0; }
export function create(type, rng) {
  const m = { type, v: 1, mark: { X: 0.5, O: 0.5 }, pts: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }, t = tuneLive(type);
  const c = pintCfg({ type, tune: t });
  m.mark.X = drawMark(c, rng); m.mark.O = drawMark(c, rng);
  return m;
}
export function apply(mini, p, m, rng, idx) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.lv !== 'number' || !Number.isFinite(m.lv) || m.lv < 0 || m.lv > 1) return { ok: false, reason: 'bad' };
  const c = pintCfg(mini), lv = r3(m.lv), mark = mini.mark[p], pts = pintJudge(c, lv, mark), from = mini.pts[p];
  mini.pts[p] = Math.min(c.goal, from + pts);
  const won = mini.pts[p] >= c.goal, ag = !won && pts > 0 && goAgain(mini);
  mini.last = { by: p, n: mini.n[p], lv, mark, d: r3(lv - mark), pts, from, to: mini.pts[p], ms: Math.round(pintTime(c, lv)), next: ag ? p : other(p) };
  mini.n[p]++;
  mini.mark[p] = drawMark(c, rng);
  const note = pts === 2 ? 'perfect' : pts === 1 ? 'split' : lv <= 0 ? 'empty' : lv > mark ? 'soon' : 'far';
  if (won) return { ok: true, outcome: 'win', note: 'won' };
  return ag ? { ok: true, outcome: 'continue', note, again: true } : { ok: true, outcome: 'continue', note };
}
export function timeoutClose(mini, p) { return null; }              // (a hold not let go is no attempt: nothing is played for a player out of time)
export function publicView(mini) {
  return { type: 'pint', v: mini.v, mark: { X: mini.mark.X, O: mini.mark.O }, pts: { X: mini.pts.X, O: mini.pts.O }, n: { X: mini.n.X, O: mini.n.O }, last: mini.last ? Object.assign({}, mini.last) : null };
}
export function randomMove(mini, p, rng, from, empties) {          // (the tests' stand-in: about the mark, a little off either way)
  return { lv: r3(Math.max(0, Math.min(1, mini.mark[p] + (rng() - 0.5) * 0.2))) };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.pn = Object.assign({}, mini.last); }
// A move's picture, from its start: someone else's hold played first (`ms`), then the release: the glass upright
// and the drink settled (PINT.settle), the verdict (PINT.say), its hold, and, only where the same player goes again,
// the fresh pint sliding in (a turn that passes goes straight back to the board with the glass as it left it: the
// next pint is shown when the square is next opened).
export const pintPre = l => Math.max(0, (l && l.ms) || 0);
export const pintKeep = l => !!l && l.next === l.by;
export const pintMs = (l, won) => pintPre(l) + PINT.settle + PINT.say + PINT.hold + (won || !pintKeep(l) ? 0 : PINT.next);
export function flashMs(f, winLen, won) { return pintMs(f && f.pn, won) + (won ? 400 : 0); }
