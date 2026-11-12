// Higher/Lower: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { RACE_V, raceDealt, raceSide } from '../../core/race.js';
import { tuneLive } from '../../core/tune.js';
import { other } from '../../core/util.js';

// 1 to 30, and each player has 5 guesses in a square: a player whose 5th guess misses loses the square to
// the other. (A square from before: 1 to 20, no limit; top and limit say which.)
// Race mode (core/race.js, `rv: 2`): each player their own number in the same range (`mini.tg[p]`, hidden as a Shared
// square's number is: secret/hide), their own guesses and range (`mini.side[p]`: { lo, hi, guesses }, open to both),
// and no guess limit: the first to find their own number takes the square.
export const HILO = { lo: 1, hi: 30, limit: 5 };
export const hiloTop = mini => (mini && Number.isInteger(mini.top) ? mini.top : 20);
export const hiloLimit = mini => (mini && !mini.race && Number.isInteger(mini.limit) ? mini.limit : 0);   // 0: no limit (a race never has one)
// Where p's guesses live: the square itself (Shared), or p's own side (Race; null for a side this copy has not got).
export const hiloPart = (mini, p) => (mini && mini.race ? raceSide(mini, p) : mini);
// The number p is after: the square's (Shared), or p's own (Race; undefined where this copy has not got it: the public state).
export const hiloTarget = (mini, p) => (mini && mini.race ? (mini.tg ? mini.tg[p] : undefined) : mini && mini.target);
// How many numbers are still possible for p (their own range; a race's other part as the record has it).
export const hiloOpen = (mini, p) => { const part = hiloPart(mini, p); return part && Number.isInteger(part.lo) ? Math.max(0, part.hi - part.lo + 1) : hiloTop(mini); };
export function hiloUsed(mini, p) {
  const part = hiloPart(mini, p);
  if (part && Array.isArray(part.guesses)) return part.guesses.filter(g => g.by === p).length;
  const sh = mini && mini.shape && mini.shape[p];              // (a v1 race square's other side: its shape alone)
  return sh && Number.isInteger(sh.n) ? sh.n : 0;
}
export const hiloLeft = (mini, p) => (hiloLimit(mini) ? Math.max(0, hiloLimit(mini) - hiloUsed(mini, p)) : Infinity);
export function create(type, rng, opts) {
  const c = tuneLive(type);                                 // (the admin's settings: the top number, the guesses each, the mode)
  const draw = () => HILO.lo + randInt(rng, c.hi - HILO.lo + 1);
  if (raceDealt(type, opts)) {                              // a race: two different numbers from the same range (as hard as each other), no limit
    const x = draw(); let o = draw();
    for (let k = 0; o === x && k < 50; k++) o = draw();
    if (o === x) o = x === c.hi ? x - 1 : x + 1;
    const part = () => ({ lo: HILO.lo, hi: c.hi, guesses: [] });
    return { type, race: true, rv: RACE_V, top: c.hi, side: { X: part(), O: part() }, tg: { X: x, O: o } };
  }
  return { type, target: draw(), top: c.hi, limit: c.limit, lo: HILO.lo, hi: c.hi, guesses: [] };
}
export function apply(mini, p, m, rng, idx) {
  const part = hiloPart(mini, p), target = hiloTarget(mini, p);
  if (!part || !Number.isInteger(target)) return { ok: false, reason: 'bad' };
  if (!Number.isInteger(m) || m < part.lo || m > part.hi) return { ok: false, reason: 'bad' };
  if (hiloLeft(mini, p) <= 0) return { ok: false, reason: 'out' };
  part.was = [part.lo, part.hi];                            // the range before this guess (moveFlash reads it)
  if (m === target) { part.guesses.push({ by: p, n: m, res: 'hit' }); if (mini.race) { part.lo = m; part.hi = m; } return { ok: true, outcome: 'win' }; }
  const res = m < target ? 'higher' : 'lower';
  part.guesses.push({ by: p, n: m, res });
  if (res === 'higher') part.lo = m + 1; else part.hi = m - 1;
  if (hiloLeft(mini, p) <= 0) return { ok: true, outcome: 'win', winner: other(p), note: 'out' };   // the last guess missed: the square goes to the other player
  return { ok: true, outcome: 'continue', note: res };
}
export function publicView(mini) {
  const v = { type: 'hilo', top: hiloTop(mini), limit: hiloLimit(mini) };
  if (mini.race) return Object.assign(v, { race: true, side: JSON.parse(JSON.stringify(mini.side || {})) });   // (both parts are open; the numbers, mini.tg, never: core/minis.js publicMini)
  return Object.assign(v, { lo: mini.lo, hi: mini.hi, guesses: mini.guesses.map(g => ({ by: g.by, n: g.n, res: g.res })) });
}
// Race: p's progress as anyone may see it (all of it is open): guesses made, numbers still possible.
export function raceShape(mini, p) {
  const part = raceSide(mini, p);
  return part ? { n: part.guesses.length, open: hiloOpen(mini, p) } : {};
}
export function randomMove(mini, p, rng, from, empties) {
  const part = hiloPart(mini, p) || { lo: HILO.lo, hi: hiloTop(mini) };
  return part.lo + randInt(rng, part.hi - part.lo + 1);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const part = hiloPart(mini, p), g = part ? part.guesses[part.guesses.length - 1] : null;
  flash.n = m; flash.range = (mini.race ? null : range) || (part && part.was) || null; flash.res = g ? g.res : null; flash.left = hiloLimit(mini) ? hiloLeft(mini, p) : null;   // (a race: the mover's own range before the guess, never the square's)
  if (part) delete part.was;
  return;
}
export function secret(mini) {
  return mini.race ? { tg: mini.tg } : { target: mini.target };   // (a race: both numbers, top level, so a record's fullState puts them back whole)
}
export function hide(m, k, st) {
  delete m.target; delete m.tg; return;
}
export function flashMs(f, winLen, won) {
  return f && f.res === 'hit' ? 1100 : f && f.note === 'out' ? 1000 : 800;   // (the guess to the line, the sweep, the answer: hilo/view.js HILOT; the find's pop and the last guess's "No guesses left" play on a little)
}
// Super Chaos: each player gets their own answer during their move; at the round's end both guesses and their
// answers join the shared history (the range narrowed by both). (A race square keeps each side's own: Super Chaos is off.)
export function scMerge(m, c) {   // (each player's 5 guesses count their own: a 5th that misses gives the square away, as ever)
  if (m.race) { for (const p of c.played) m.side[p] = c.forks[p].side[p]; return; }
  const n = c.base.guesses.length;
  m.guesses = c.base.guesses.concat(...c.played.map(p => c.forks[p].guesses.slice(n)));
  m.lo = Math.max(c.base.lo, ...c.played.map(p => c.forks[p].lo)); m.hi = Math.min(c.base.hi, ...c.played.map(p => c.forks[p].hi));
}
