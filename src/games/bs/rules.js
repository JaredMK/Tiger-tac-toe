// Battleship: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';

// Battleship: one hidden ship on a 4x4 grid, 1 to 4 cells long, lying across or down. Both players fire at it.
export const BS = { n: 4, names: { 4: 'Battleship', 3: 'Submarine', 2: 'Destroyer', 1: 'Patrol Boat' }, sc: 5 };   // sc: Super Chaos's sea (a Patrol Boat on 5x5)
// The sea's width: 4, or a Super Chaos square's own (mini.n).
export const bsN = mini => (mini && Number.isInteger(mini.n) ? mini.n : BS.n);

// Battleship: a ship of random length (1 to 4) placed across or down, anywhere it fits.
export function bsShip(rng) {
  const len = 1 + randInt(rng, 4), across = randInt(rng, 2) === 0, N = BS.n;
  const r = randInt(rng, across ? N : N - len + 1), c = randInt(rng, across ? N - len + 1 : N);
  return Array.from({ length: len }, (_, k) => (across ? r * N + c + k : (r + k) * N + c));
}
// Every way a ship of `len` cells fits on the grid (a one-cell ship counted once).
export function bsPlacements(len, N = BS.n) {
  const out = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (c + len <= N) out.push(Array.from({ length: len }, (_, k) => r * N + c + k));
    if (len > 1 && r + len <= N) out.push(Array.from({ length: len }, (_, k) => (r + k) * N + c));
  }
  return out;
}
export function create(type, rng) {
  const ship = bsShip(rng); return { type, len: ship.length, ship, revealed: new Array(BS.n * BS.n).fill(null), hits: [], last: null };
}
export function apply(mini, p, m, rng, idx) {
  // One shot at one cell. A hit or a miss is shown; the ship's direction never is. A hit that does not
  // sink it fires again at once (the turn goes on until a miss or the sinking shot); the shot that
  // hits its last cell sinks it and claims the square.
  if (!idx(bsN(mini) * bsN(mini))) return { ok: false, reason: 'bad' };
  if (mini.revealed[m]) return { ok: false, reason: 'taken' };
  mini.revealed[m] = p; mini.last = m;
  if (!mini.ship.includes(m)) return { ok: true, outcome: 'continue', note: 'miss' };
  mini.hits.push(m);
  if (mini.ship.every(k => mini.hits.includes(k))) return { ok: true, outcome: 'win', cells: mini.ship.slice(), note: 'sunk' };
  return { ok: true, outcome: 'continue', note: 'hit', again: true };
}
export function publicView(mini) {
  return Object.assign({ type: 'bs', len: mini.len, revealed: mini.revealed.slice(), hits: mini.hits.slice() }, mini.n ? { n: mini.n } : {});
}
// Battleship: the placements of the ship that still fit every hit and every miss.
export function bsCandidates(pm) {
  const miss = new Set(pm.revealed.map((r, k) => (r && !pm.hits.includes(k) ? k : -1)).filter(k => k >= 0));
  return bsPlacements(pm.len, bsN(pm)).filter(cells => pm.hits.every(h => cells.includes(h)) && !cells.some(k => miss.has(k)));
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.revealed, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.hit = mini.hits.includes(m); flash.len = mini.len; return;
}
export function secret(mini) {
  return { ship: mini.ship.slice() };
}
export function hide(m, k, st) {
  delete m.ship; return;
}
export function flashMs(f, winLen, won) {
  return won ? 1700 : 1100;
}
// Super Chaos: a Patrol Boat (one cell) on a 5x5 sea. One shot a move: a hit sinks it. Both players' shots
// join the sea at the round's end.
export function scCreate(type, rng) {
  const N = BS.sc; return { type, n: N, len: 1, ship: [randInt(rng, N * N)], revealed: new Array(N * N).fill(null), hits: [], last: null };
}
export function scMerge(m, c) {
  m.revealed = c.base.revealed.slice(); m.hits = c.base.hits.slice();
  for (const p of c.played) {
    const f = c.forks[p];
    f.revealed.forEach((r, k) => { if (r && !m.revealed[k]) m.revealed[k] = r; });
    for (const h of f.hits) if (!m.hits.includes(h)) m.hits.push(h);
  }
}
