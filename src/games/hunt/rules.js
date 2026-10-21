// Treasure Hunt: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';

// Treasure hunt: a 6x6 grid. A dug cell tells only how far the treasure is, as a band of steps up, down,
// left or right: Hot (1), Warm (2-3), Cool (4-5), Cold (6 or more). (Older 5x5 squares play on as they are.)
export const HUNT = { n: 6, bands: [null, 'hot', 'warm', 'cool', 'cold'] };
// Treasure hunt: steps up/down/left/right between two cells of the 5x5 grid.
export function huntSize(mini) { return mini && Array.isArray(mini.dug) ? Math.round(Math.sqrt(mini.dug.length)) : HUNT.n; }
// The band of a distance: 0 is the treasure itself, then 1 Hot, 2 Warm, 3 Cool, 4 Cold.
export function huntBand(d) { return d <= 0 ? 0 : d === 1 ? 1 : d <= 3 ? 2 : d <= 5 ? 3 : 4; }
export function huntClue(mini, i) { return huntBand(huntDist(mini.treasure, i, huntSize(mini))); }
export function huntDist(a, b, n = HUNT.n) {
  return Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n);
}
export function create(type, rng) {
  const n = tuneLive(type).n;                                    // (the admin's setting: the grid's size; the square keeps it as dug's length)
  return { type, treasure: randInt(rng, n * n), dug: new Array(n * n).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (!idx(mini.dug.length)) return { ok: false, reason: 'bad' };
  if (mini.dug[m]) return { ok: false, reason: 'taken' };
  mini.dug[m] = p; mini.last = m;
  if (m === mini.treasure) return { ok: true, outcome: 'win', cells: [m] };
  return { ok: true, outcome: 'continue', note: 'dig' };
}
export function publicView(mini) {
  return { type: 'hunt', dug: mini.dug.slice(), clues: mini.dug.map((d, i) => (d ? huntClue(mini, i) : null)) };   // bands only, never the distance
}
export function huntCandidates(pm) {
  const out = [];
  const n = huntSize(pm);
  for (let c = 0; c < pm.dug.length; c++) {
    if (pm.dug[c]) continue;
    if (pm.clues.every((k, d) => k == null || huntBand(huntDist(c, d, n)) === k)) out.push(c);
  }
  return out;
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.dug, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.band = huntClue(mini, m); return;
}
export function secret(mini) {
  return { treasure: mini.treasure };
}
export function hide(m, k, st) {
  m.clues = m.dug.map((d, i) => (d ? huntClue(m, i) : null)); delete m.treasure; return;   // the bands only
}
export function flashMs(f, winLen, won) {
  return won ? 1400 : 800;
}
// Super Chaos: each player sees their own clue during their move; at the round's end both digs join the grid.
export function scMerge(m, c) {
  m.dug = c.base.dug.slice(); m.last = null;
  for (const p of c.played) c.forks[p].dug.forEach((d, k) => { if (d && !m.dug[k]) m.dug[k] = d; });
}
