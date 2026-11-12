// Treasure Hunt: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { RACE_V, raceDealt, raceSide } from '../../core/race.js';
import { tuneLive } from '../../core/tune.js';

// Treasure hunt: a 6x6 grid. A dug cell tells only how far the treasure is, as a band of steps up, down,
// left or right: Hot (1), Warm (2-3), Cool (4-5), Cold (6 or more). (Older 5x5 squares play on as they are.)
// Race mode (core/race.js, `rv: 2`): each player their own treasure on the same size grid (`mini.tg`: { X, O }, the
// square's secret, as a Shared square's treasure is), equally hard to find: both on the grid's edge or both inside it
// (an edge treasure takes the best digger about 3 digs, one inside about 3.75: huntEdge), each anywhere in that part,
// never the same cell, and nothing tighter between them (a mirrored spot would let a player read their own treasure
// off the other's open digs); and their own copy of the grid (`mini.side[p]`: { dug: [{ i, k }] (the cell and its band against
// their own treasure, in order), last }), open to both. No dig limit: the first to dig up their own treasure wins.
export const HUNT = { n: 6, bands: [null, 'hot', 'warm', 'cool', 'cold'] };
// The grid's size: a race square keeps it as n, a shared one as its dug list's length (an older 5x5 square too).
export function huntSize(mini) { return mini && Number.isInteger(mini.n) ? mini.n : mini && Array.isArray(mini.dug) ? Math.round(Math.sqrt(mini.dug.length)) : HUNT.n; }
// The band of a distance: 0 is the treasure itself, then 1 Hot, 2 Warm, 3 Cool, 4 Cold.
export function huntBand(d) { return d <= 0 ? 0 : d === 1 ? 1 : d <= 3 ? 2 : d <= 5 ? 3 : 4; }
// A cell on the grid's outer ring.
export function huntEdge(c, n) { const r = Math.floor(c / n), k = c % n; return r === 0 || k === 0 || r === n - 1 || k === n - 1; }
// The treasure p digs for: a race square's own (null where this copy has not got it), else the square's one.
export function huntTreasure(mini, p) { return mini.race ? (mini.tg && Number.isInteger(mini.tg[p]) ? mini.tg[p] : null) : mini.treasure; }
export function huntClue(mini, i, p) { return huntBand(huntDist(mini.race ? huntTreasure(mini, p || 'X') : mini.treasure, i, huntSize(mini))); }
export function huntDist(a, b, n = HUNT.n) {
  return Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n);
}
// The grid as p sees it: dug (who dug each cell, or null) and clues (each dug cell's band) over n*n cells. A
// shared square: its own grid (the clues as sent, or from the treasure here). A race square: p's own grid (both are
// open; null for a part this copy has not got).
export function huntGrid(pm, p) {
  const n = huntSize(pm), nn = n * n;
  if (!pm.race) return { n, dug: pm.dug, clues: pm.clues || pm.dug.map((d, i) => (d ? huntClue(pm, i) : null)) };
  const part = raceSide(pm, p);
  if (!part) return null;
  const dug = new Array(nn).fill(null), clues = new Array(nn).fill(null);
  for (const d of part.dug) { dug[d.i] = p; clues[d.i] = d.k; }
  return { n, dug, clues };
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
    if (g.clues.every((k, d) => k == null || huntBand(huntDist(c, d, g.n)) === k)) out.push(c);
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
