// Higher/Lower: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { raceDealt, raceSide } from '../../core/race.js';
import { tuneLive } from '../../core/tune.js';
import { other } from '../../core/util.js';

// 1 to 30, and each player has 5 guesses in a square: a player whose 5th guess misses loses the square to
// the other. (A square from before: 1 to 20, no limit; top and limit say which.)
// Race mode (core/race.js): the same number for both, but each player's guesses and range are their own
// (`mini.side[p]`: { lo, hi, guesses }); the other side sees only how many guesses they have used and how
// close they are (raceShape: 'cold' | 'warm' | 'hot' | 'hit').
export const HILO = { lo: 1, hi: 30, limit: 5 };
export const hiloTop = mini => (mini && Number.isInteger(mini.top) ? mini.top : 20);
export const hiloLimit = mini => (mini && Number.isInteger(mini.limit) ? mini.limit : 0);   // 0: no limit
// Where p's guesses live: the square itself (Shared), or p's own side (Race; null for a side this copy has not got).
export const hiloPart = (mini, p) => (mini && mini.race ? raceSide(mini, p) : mini);
export function hiloUsed(mini, p) {
  const part = hiloPart(mini, p);
  if (part && Array.isArray(part.guesses)) return part.guesses.filter(g => g.by === p).length;
  const sh = mini && mini.shape && mini.shape[p];              // (a race square's other side: its shape alone)
  return sh && Number.isInteger(sh.n) ? sh.n : 0;
}
export const hiloLeft = (mini, p) => (hiloLimit(mini) ? Math.max(0, hiloLimit(mini) - hiloUsed(mini, p)) : Infinity);
export function create(type, rng, opts) {
  const c = tuneLive(type);                                 // (the admin's settings: the top number, the guesses each, the mode)
  const base = { type, target: HILO.lo + randInt(rng, c.hi - HILO.lo + 1), top: c.hi, limit: c.limit };
  if (raceDealt(type, opts)) return Object.assign(base, { race: true, side: { X: { lo: HILO.lo, hi: c.hi, guesses: [] }, O: { lo: HILO.lo, hi: c.hi, guesses: [] } } });
  return Object.assign(base, { lo: HILO.lo, hi: c.hi, guesses: [] });
}
export function apply(mini, p, m, rng, idx) {
  const part = hiloPart(mini, p);
  if (!part) return { ok: false, reason: 'bad' };
  if (!Number.isInteger(m) || m < part.lo || m > part.hi) return { ok: false, reason: 'bad' };
  if (hiloLeft(mini, p) <= 0) return { ok: false, reason: 'out' };
  part.was = [part.lo, part.hi];                            // the range before this guess (moveFlash reads it)
  if (m === mini.target) { part.guesses.push({ by: p, n: m, res: 'hit' }); return { ok: true, outcome: 'win' }; }
  const res = m < mini.target ? 'higher' : 'lower';
  part.guesses.push({ by: p, n: m, res });
  if (res === 'higher') part.lo = m + 1; else part.hi = m - 1;
  if (hiloLeft(mini, p) <= 0) return { ok: true, outcome: 'win', winner: other(p), note: 'out' };   // the last guess missed: the square goes to the other player
  return { ok: true, outcome: 'continue', note: res };
}
export function publicView(mini) {
  const v = { type: 'hilo', top: hiloTop(mini), limit: hiloLimit(mini) };
  if (mini.race) return Object.assign(v, { race: true, side: mini.side });   // (core/minis.js publicMini keeps one side's own part alone and adds both shapes)
  return Object.assign(v, { lo: mini.lo, hi: mini.hi, guesses: mini.guesses.map(g => ({ by: g.by, n: g.n, res: g.res })) });
}
// Race: how close a side is, from the numbers still open to them: none guessed yet, cold (more than 8 left), warm (8 or fewer), hot (3 or fewer), hit.
export function hiloHeat(part) {
  if (!part || !part.guesses.length) return null;
  const last = part.guesses[part.guesses.length - 1];
  if (last && last.res === 'hit') return 'hit';
  const r = part.hi - part.lo + 1;
  return r <= 3 ? 'hot' : r <= 8 ? 'warm' : 'cold';
}
export function raceShape(mini, p) {
  const part = raceSide(mini, p);
  if (!part) return {};
  return { n: part.guesses.length, left: hiloLimit(mini) ? Math.max(0, hiloLimit(mini) - part.guesses.length) : null, heat: hiloHeat(part) };
}
export function raceFlash(f, mini) { return Object.assign({ by: f.by }, raceShape(mini, f.by)); }
export function randomMove(mini, p, rng, from, empties) {
  const part = hiloPart(mini, p) || { lo: HILO.lo, hi: hiloTop(mini) };
  return part.lo + randInt(rng, part.hi - part.lo + 1);
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const part = hiloPart(mini, p), g = part ? part.guesses[part.guesses.length - 1] : null;
  flash.n = m; flash.range = range || (part && part.was) || null; flash.res = g ? g.res : null; flash.left = hiloLimit(mini) ? hiloLeft(mini, p) : null;
  if (part) delete part.was;
  return;
}
export function secret(mini) {
  return { target: mini.target };
}
export function hide(m, k, st) {
  delete m.target; return;
}
export function flashMs(f, winLen, won) {
  return 800;
}
// Super Chaos: each player gets their own answer during their move; at the round's end both guesses and their
// answers join the shared history (the range narrowed by both). (A race square keeps each side's own.)
export function scMerge(m, c) {   // (each player's 5 guesses count their own: a 5th that misses gives the square away, as ever)
  if (m.race) { for (const p of c.played) m.side[p] = c.forks[p].side[p]; return; }
  const n = c.base.guesses.length;
  m.guesses = c.base.guesses.concat(...c.played.map(p => c.forks[p].guesses.slice(n)));
  m.lo = Math.max(c.base.lo, ...c.played.map(p => c.forks[p].lo)); m.hi = Math.min(c.base.hi, ...c.played.map(p => c.forks[p].hi));
}
