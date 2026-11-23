// Treasure Hunt: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { RACE_V, raceDealt, raceSide } from '../../core/race.js';
import { tune, tuneLive } from '../../core/tune.js';

// Treasure hunt: a 6x6 grid. A dug cell tells only how far the treasure is, as a band of steps up, down,
// left or right: Hot (1), Warm (2-3), Cool (4-5), Cold (6 or more) at the default Hint difficulty (HUNT_HINTS: the
// admin's `hints`; wider bands, harder to read, at 'hard' and 'harder'). (Older 5x5 squares play on as they are.)
// Race mode (core/race.js, `rv: 2`): each player their own treasure on the same size grid (`mini.tg`: { X, O }, the
// square's secret, as a Shared square's treasure is), equally hard to find: both on the grid's edge or both inside it
// (an edge treasure takes the best digger about 3 digs, one inside about 3.75, at the default hints; wider hints take
// more of both, the edge still the quicker: huntEdge), each anywhere in that part, never the same cell, and nothing
// tighter between them (a mirrored spot would let a player read their own treasure off the other's open digs); and
// their own copy of the grid (`mini.side[p]`: { dug: [{ i, k }] (the cell and its band against
// their own treasure, in order), last }), open to both. No dig limit: the first to dig up their own treasure wins.
export const HUNT = { n: 6, bands: [null, 'hot', 'warm', 'cool', 'cold'] };
// The hints, by the admin's Hint difficulty (meta.js TUNE `hints`, kept on the square with its settings: tune(mini), so a
// square plays to its end by the hints it was dealt with, and one dealt before the setting reads 'normal'): each band's
// farthest distance in steps, Hot, Warm, Cool (null: the setting has no such band); Cold is everything past the last.
// A band keeps its number whatever the setting (0 the treasure, 1 Hot, 2 Warm, 3 Cool, 4 Cold): only its reach changes.
// The one table: the clue, the cells still possible, the computer, the race, the key under the grid and the explainer.
// Measured (tests/sim/hunt.sim.js): the digs one player needs alone on the 6x6 grid, 3.4 normal, 3.8-3.9 hard, 4.5 harder;
// moving the bands' edges is not enough (Hot 1-2, Warm 3-4, Cool 5-6 splits the grid more evenly: 3.4 digs, as normal).
export const HUNT_HINTS = {
  normal: [1, 3, 5],                                             // Hot 1, Warm 2-3, Cool 4-5, Cold 6+ (the hints as they always were)
  hard: [2, 5, 8],                                               // Hot 1-2, Warm 3-5, Cool 6-8, Cold 9+ (every band a step wider)
  harder: [3, 6, null],                                          // Hot 1-3, Warm 4-6, Cold 7+ (no Cool)
};
const hintsOk = h => typeof h === 'string' && Object.prototype.hasOwnProperty.call(HUNT_HINTS, h);
const topOf = h => (hintsOk(h) ? HUNT_HINTS[h] : HUNT_HINTS.normal);
// A square's Hint difficulty (a setting it does not know: 'normal').
export function huntHints(mini) { const h = tune(mini).hints; return hintsOk(h) ? h : 'normal'; }
// The bands a setting has, nearest first: { k (the band), lo, hi (null: and beyond) } in steps.
export function huntRanges(hints) {
  const top = topOf(hints), out = [];
  let lo = 1;
  top.forEach((t, b) => { if (t != null) { out.push({ k: b + 1, lo, hi: t }); lo = t + 1; } });
  out.push({ k: 4, lo, hi: null });
  return out;
}
// The grid's size: a race square keeps it as n, a shared one as its dug list's length (an older 5x5 square too).
export function huntSize(mini) { return mini && Number.isInteger(mini.n) ? mini.n : mini && Array.isArray(mini.dug) ? Math.round(Math.sqrt(mini.dug.length)) : HUNT.n; }
// The band of a distance under a Hint difficulty (none: 'normal'): 0 is the treasure itself, then 1 Hot, 2 Warm, 3 Cool, 4 Cold.
export function huntBand(d, hints) {
  if (d <= 0) return 0;
  const top = topOf(hints);
  for (let b = 0; b < 3; b++) if (top[b] != null && d <= top[b]) return b + 1;
  return 4;
}
// A cell on the grid's outer ring.
export function huntEdge(c, n) { const r = Math.floor(c / n), k = c % n; return r === 0 || k === 0 || r === n - 1 || k === n - 1; }
// The treasure p digs for: a race square's own (null where this copy has not got it), else the square's one.
export function huntTreasure(mini, p) { return mini.race ? (mini.tg && Number.isInteger(mini.tg[p]) ? mini.tg[p] : null) : mini.treasure; }
export function huntClue(mini, i, p) { return huntBand(huntDist(mini.race ? huntTreasure(mini, p || 'X') : mini.treasure, i, huntSize(mini)), huntHints(mini)); }
export function huntDist(a, b, n = HUNT.n) {
  return Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n);
}
// The grid as p sees it: dug (who dug each cell, or null) and clues (each dug cell's band) over n*n cells, with the
// square's Hint difficulty (hints). A shared square: its own grid (the clues as sent, or from the treasure here). A race
// square: p's own grid (both are open; null for a part this copy has not got).
export function huntGrid(pm, p) {
  const n = huntSize(pm), nn = n * n, hints = huntHints(pm);
  if (!pm.race) return { n, hints, dug: pm.dug, clues: pm.clues || pm.dug.map((d, i) => (d ? huntClue(pm, i) : null)) };
  const part = raceSide(pm, p);
  if (!part) return null;
  const dug = new Array(nn).fill(null), clues = new Array(nn).fill(null);
  for (const d of part.dug) { dug[d.i] = p; clues[d.i] = d.k; }
  return { n, hints, dug, clues };
}
export function create(type, rng, opts) {
  const n = tuneLive(type).n;                                    // (the admin's setting: the grid's size; the square keeps it as dug's length, a race square as n)
  const treasure = randInt(rng, n * n);
  if (raceDealt(type, opts)) {                                   // a race: a treasure each, the second anywhere else in the same part of the grid (edge or inside)
    const same = Array.from({ length: n * n }, (_, c) => c).filter(c => c !== treasure && huntEdge(c, n) === huntEdge(treasure, n));
    const o = same[randInt(rng, same.length)];
    return { type, race: true, rv: RACE_V, n, tg: { X: treasure, O: o }, side: { X: { dug: [], last: null }, O: { dug: [], last: null } } };
  }
  return { type, treasure, dug: new Array(n * n).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (mini.race) {                                               // a race: p's own grid, against p's own treasure; the other grid untouched
    const n = huntSize(mini), part = raceSide(mini, p);
    if (!idx(n * n)) return { ok: false, reason: 'bad' };
    if (!part) return { ok: false, reason: 'bad' };
    if (part.dug.some(d => d.i === m)) return { ok: false, reason: 'taken' };
    if (huntTreasure(mini, p) == null) return { ok: false, reason: 'secret' };
    const k = huntClue(mini, m, p);
    part.dug.push({ i: m, k }); part.last = m;
    if (k === 0) return { ok: true, outcome: 'win', cells: [m] };
    return { ok: true, outcome: 'continue', note: 'dig' };
  }
  if (!idx(mini.dug.length)) return { ok: false, reason: 'bad' };
  if (mini.dug[m]) return { ok: false, reason: 'taken' };
  mini.dug[m] = p; mini.last = m;
  if (m === mini.treasure) return { ok: true, outcome: 'win', cells: [m] };
  return { ok: true, outcome: 'continue', note: 'dig' };
}
export function publicView(mini) {
  if (mini.race) return { type: 'hunt', n: huntSize(mini), race: true, side: JSON.parse(JSON.stringify(mini.side || {})) };   // both grids, never a treasure
  return { type: 'hunt', dug: mini.dug.slice(), clues: mini.dug.map((d, i) => (d ? huntClue(mini, i) : null)) };   // bands only, never the distance
}
// Race: a side's progress in brief: digs used, the band of the last and the best band so far ('found' once dug up).
const bandName = k => (k == null ? null : k === 0 ? 'found' : HUNT.bands[k]);
export function raceShape(mini, p) {
  const part = raceSide(mini, p);
  if (!part || !Array.isArray(part.dug)) return {};
  const last = part.dug[part.dug.length - 1], top = part.dug.length ? Math.min(...part.dug.map(d => d.k)) : null;
  return { n: part.dug.length, heat: last ? bandName(last.k) : null, best: bandName(top) };
}
// The cells the treasure may still be in for p: open, and every clue's band true of them.
export function huntCandidates(pm, p) {
  const g = huntGrid(pm, p || 'X');
  if (!g) return [];
  const out = [];
  for (let c = 0; c < g.dug.length; c++) {
    if (g.dug[c]) continue;
    if (g.clues.every((k, d) => k == null || huntBand(huntDist(c, d, g.n), g.hints) === k)) out.push(c);
  }
  return out;
}
export function randomMove(mini, p, rng, from, empties) {
  const g = huntGrid(mini, p) || { dug: new Array(huntSize(mini) ** 2).fill(null) };
  return from(empties(g.dug, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.band = mini.race ? ((raceSide(mini, p) || { dug: [] }).dug.find(d => d.i === m) || { k: 4 }).k : huntClue(mini, m); return;   // (a race: the band against the mover's own treasure, as their grid has it)
}
export function secret(mini) {
  return mini.race ? { tg: Object.assign({}, mini.tg) } : { treasure: mini.treasure };
}
export function hide(m, k, st) {
  if (m.race) { delete m.tg; delete m.treasure; return; }         // (a race: both grids stay, the treasures go)
  m.clues = m.dug.map((d, i) => (d ? huntClue(m, i) : null)); delete m.treasure; return;   // the bands only
}
// A dig's timings (ms, at the game's pace; the stylesheet's Treasure Hunt figures are these): the shovel is in and out
// and the band's colour blooms from the hole at `bloom`; its name has popped by `dig`. The treasure: the chest is up
// and its gem comes out at `gem`, all of it over by `found`.
export const HUNTT = { bloom: 380, dig: 750, gem: 800, found: 1500 };
export function flashMs(f, winLen, won) {
  return (won ? HUNTT.found : HUNTT.dig) + (f.scr && f.scr.digs ? 300 : 0);   // (Super Chaos's round end: both digs open together, a beat apart)
}
// Super Chaos: each player sees their own clue during their move; at the round's end both digs join the grid
// (the same cell dug by both is dug once, X's mark on it; both saw its band). (A race square keeps each side's own.)
export function scMerge(m, c) {
  if (m.race) { for (const p of c.played) m.side[p] = c.forks[p].side[p]; return; }
  m.dug = c.base.dug.slice(); m.last = null;
  for (const p of c.played) c.forks[p].dug.forEach((d, k) => { if (d && !m.dug[k]) m.dug[k] = d; });
}
// Both dug in this square in one round: the recap opens both cells together, from the grid as the round began
// (scr.digs: each player's cell; scr.bands: what each found, 0 the treasure).
export function scJoint(base, forks) {
  if (base && base.race) return null;
  const digs = {}, bands = {};
  for (const p of ['X', 'O']) {
    const mk = forks[p], i = mk && Number.isInteger(mk.last) && mk.dug[mk.last] === p ? mk.last : null;
    if (i == null) continue;
    digs[p] = i; bands[p] = mk.treasure != null ? huntClue(mk, i) : mk.clues && mk.clues[i] != null ? mk.clues[i] : 4;   // (a phone without the treasure: the band its clues hold)
  }
  return Object.keys(digs).length === 2 ? { scr: { digs, bands } } : null;
}
