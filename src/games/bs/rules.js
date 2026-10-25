// Sea Battle: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';

// Sea Battle: one hidden ship on a 4x4 grid, 1 to 4 cells long, lying across or down. Both players fire at it.
export const BS = { n: 4, names: { 4: 'Carrier', 3: 'Submarine', 2: 'Destroyer', 1: 'Patrol Boat' }, sc: 5, scLen: 3 };   // sc, scLen: Super Chaos's sea and ship (a Submarine on 5x5)
// The sea's width: 4, or a Super Chaos square's own (mini.n).
export const bsN = mini => (mini && Number.isInteger(mini.n) ? mini.n : BS.n);

// Sea Battle: a ship of random length (1 to 4, or lo to hi; or len) placed across or down, anywhere it fits on an N x N sea.
export function bsShip(rng, N = BS.n, len, lo = 1, hi = 4) {
  len = len || lo + randInt(rng, Math.max(lo, hi) - lo + 1);
  const across = randInt(rng, 2) === 0;
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
  const c = tuneLive(type), N = c.n, ship = bsShip(rng, N, 0, c.lenMin, c.lenMax);   // (the admin's settings: the sea and the ship's lengths)
  return Object.assign({ type }, N !== BS.n ? { n: N } : {}, { len: ship.length, ship, revealed: new Array(N * N).fill(null), hits: [], last: null });
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
// Sea Battle: the placements of the ship that still fit every hit and every miss.
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
  return won ? 1300 : 750;
}
// Super Chaos: a Submarine (3 cells, across or down) on a 5x5 sea. A move fires as in a match: a hit fires
// again, until a miss or the shot that hits its last part (the timeout rule: one shot); that shot is a plain
// hit on the mover's screen (scApply). Both players' shots join the sea at
// the round's end. Whoever hits the ship's last part wins it: when the round's shots sink it, the one who
// hit any of the parts still afloat at the round's start takes it; both did (each sank it on their own sea,
// or the two shared out the last parts), and the square resets.
// A shot as the mover's own sea shows it: a hit fires again, but the shot that hits the last part is not
// judged there (the other player may hit a last part this round too): the move ends, and the round's end
// says who sank it.
export function scApply(mini, p, m, rng, idx) {
  const res = apply(mini, p, m, rng, idx || (n => Number.isInteger(m) && m >= 0 && m < n));
  if (res.ok && res.outcome === 'win') return { ok: true, outcome: 'continue', note: 'hit' };
  return res;
}
export function scCreate(type, rng) {
  const c = tuneLive(type), N = c.scN, ship = bsShip(rng, N, c.scLen);
  return { type, n: N, len: ship.length, ship, revealed: new Array(N * N).fill(null), hits: [], last: null };
}
export function scMerge(m, c) {
  const ship = m.ship || c.base.ship;
  if (!ship) return undefined;                                   // (no ship to judge by: each move's own result stands)
  const afloat = new Set(ship.filter(k => !c.base.hits.includes(k))), hit = { X: false, O: false };
  m.revealed = c.base.revealed.slice(); m.hits = c.base.hits.slice();
  for (const p of c.played) {
    const f = c.forks[p];
    f.revealed.forEach((r, k) => { if (r && !m.revealed[k]) m.revealed[k] = r; });
    for (const h of f.hits) { if (!m.hits.includes(h)) m.hits.push(h); if (afloat.has(h)) hit[p] = true; }
  }
  if (!ship.every(k => m.hits.includes(k))) return { win: { X: false, O: false } };                // still afloat: the hits stay on the sea
  if (hit.X && hit.O) return { win: { X: true, O: true } };                                        // both hit its last parts this round: a reset
  return { win: hit };
}
