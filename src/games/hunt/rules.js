// Treasure Hunt: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { raceDealt, raceSide } from '../../core/race.js';
import { tuneLive } from '../../core/tune.js';

// Treasure hunt: a 6x6 grid. A dug cell tells only how far the treasure is, as a band of steps up, down,
// left or right: Hot (1), Warm (2-3), Cool (4-5), Cold (6 or more). (Older 5x5 squares play on as they are.)
// Race mode (core/race.js): the same treasure for both, but each player digs their own copy of the grid
// (`mini.side[p]`: { dug: [{ i, k }] (the cell and its band, in order), last }); the other side sees only how
// many digs they have used and the band of their last dig (raceShape: 'hot' | 'warm' | 'cool' | 'cold' | 'found').
export const HUNT = { n: 6, bands: [null, 'hot', 'warm', 'cool', 'cold'] };
// The grid's size: a race square keeps it as n, a shared one as its dug list's length (an older 5x5 square too).
export function huntSize(mini) { return mini && Number.isInteger(mini.n) ? mini.n : mini && Array.isArray(mini.dug) ? Math.round(Math.sqrt(mini.dug.length)) : HUNT.n; }
// The band of a distance: 0 is the treasure itself, then 1 Hot, 2 Warm, 3 Cool, 4 Cold.
export function huntBand(d) { return d <= 0 ? 0 : d === 1 ? 1 : d <= 3 ? 2 : d <= 5 ? 3 : 4; }
export function huntClue(mini, i) { return huntBand(huntDist(mini.treasure, i, huntSize(mini))); }
export function huntDist(a, b, n = HUNT.n) {
  return Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n);
}
// The grid as p sees it: dug (who dug each cell, or null) and clues (each dug cell's band) over n*n cells. A
// shared square: its own grid (the clues as sent, or from the treasure here). A race square: p's own part
// (null where this copy has not got it: the other phone's side).
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
  if (raceDealt(type, opts)) return { type, treasure, n, race: true, side: { X: { dug: [], last: null }, O: { dug: [], last: null } } };
  return { type, treasure, dug: new Array(n * n).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (mini.race) {                                               // a race: p's own grid; a cell they have dug is taken for them alone
    const n = huntSize(mini), part = raceSide(mini, p);
    if (!idx(n * n)) return { ok: false, reason: 'bad' };
    if (!part) return { ok: false, reason: 'bad' };
    if (part.dug.some(d => d.i === m)) return { ok: false, reason: 'taken' };
    if (!Number.isInteger(mini.treasure)) return { ok: false, reason: 'secret' };
    const k = huntClue(mini, m);
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
  if (mini.race) return { type: 'hunt', n: huntSize(mini), race: true, side: mini.side };   // (core/minis.js publicMini keeps one side's own part alone and adds both shapes)
  return { type: 'hunt', dug: mini.dug.slice(), clues: mini.dug.map((d, i) => (d ? huntClue(mini, i) : null)) };   // bands only, never the distance
}
// Race: a side's progress for anyone to see: digs used, and the band of their last dig (never the cells).
export function raceShape(mini, p) {
  const part = raceSide(mini, p);
  if (!part) return {};
  const last = part.dug[part.dug.length - 1];
  return { n: part.dug.length, heat: last ? (last.k === 0 ? 'found' : HUNT.bands[last.k]) : null };
}
export function raceFlash(f, mini) { return Object.assign({ by: f.by }, raceShape(mini, f.by)); }
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
  flash.band = huntClue(mini, m); return;
}
export function secret(mini) {
  return { treasure: mini.treasure };
}
export function hide(m, k, st) {
  if (m.race) { delete m.treasure; return; }                     // (each side's part goes with core/race.js raceHide; the shapes stay)
  m.clues = m.dug.map((d, i) => (d ? huntClue(m, i) : null)); delete m.treasure; return;   // the bands only
}
export function flashMs(f, winLen, won) {
  return (won ? 1100 : 600) + (f.scr && f.scr.digs ? 300 : 0);   // (Super Chaos's round end: both digs open together, a beat apart)
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
