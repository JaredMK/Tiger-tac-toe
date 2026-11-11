// Sea Battle: the rules (pure: no page, no clock; the server runs the same code).
import { randInt } from '../../core/random.js';
import { RACE_V, raceDealt, raceSide } from '../../core/race.js';
import { goAgain, tuneLive } from '../../core/tune.js';

// Sea Battle: one hidden ship on a 4x4 grid, 1 to 4 cells long, lying across or down. Both players fire at it.
export const BS = { n: 4, names: { 4: 'Carrier', 3: 'Submarine', 2: 'Destroyer', 1: 'Patrol Boat' }, sc: 5, scLen: 3 };   // sc, scLen: Super Chaos's sea and ship (a Submarine on 5x5)
// The sea's width: 4, or a Super Chaos square's own (mini.n).
export const bsN = mini => (mini && Number.isInteger(mini.n) ? mini.n : BS.n);
// Race mode (core/race.js, `rv: 2`): each player hunts a ship of their own, the same length on the same sea, placed
// apart (`mini.tg[p]`, the targets: secret until the square ends, as a Shared square's ship is); each fires at their
// own sea (`mini.side[p]`: { revealed, hits, last }), open to both. A hit fires again as in Shared, no shot limit; the
// first to sink their own ship takes the square.
// Where p's shots live: the square itself (Shared), or p's own part (Race; null for a side the square has not got).
export const bsPart = (mini, p) => (mini && mini.race ? raceSide(mini, p) : mini);
const bsBlank = N => ({ revealed: new Array(N * N).fill(null), hits: [], last: null });
// p's ship: Shared, the square's one; Race, p's own (a race square from before the rework: its one ship). Null where
// this copy has not got it (the public state of an open square).
export const bsShipOf = (mini, p) => (mini && mini.race && mini.tg ? (mini.tg[p] || null) : (mini && mini.ship) || null);
// p's sea as the shooting rules and the computer read it: the ship's length, the sea's width, the shots and the hits
// (in Race a side's own part; a side this copy lacks: an empty sea). Arrays the database may have dropped come back.
export function bsSea(mini, p) {
  if (!mini || !mini.race) return mini;
  const N = bsN(mini), part = raceSide(mini, p) || bsBlank(N);
  const revealed = Array.isArray(part.revealed) && part.revealed.length === N * N ? part.revealed : bsBlank(N).revealed;
  return Object.assign({ type: 'bs', len: mini.len, revealed, hits: Array.isArray(part.hits) ? part.hits : [], last: Number.isInteger(part.last) ? part.last : null }, mini.n ? { n: mini.n } : {}, mini.tune ? { tune: mini.tune } : {});
}

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
export function create(type, rng, opts) {
  const c = tuneLive(type), N = c.n, ship = bsShip(rng, N, c.len === 'Random' ? 0 : Number(c.len) || 3, 1, 4);   // (the admin's settings: the sea, the ship's length or Random 1 to 4, the mode)
  const base = Object.assign({ type }, N !== BS.n ? { n: N } : {}, { len: ship.length });
  if (raceDealt(type, opts)) {                                    // a race: a ship each, the same length, placed apart (redrawn while the two lie the same)
    let other = bsShip(rng, N, ship.length);
    for (let k = 0; k < 40 && other.slice().sort().join() === ship.slice().sort().join(); k++) other = bsShip(rng, N, ship.length);
    return Object.assign(base, { race: true, rv: RACE_V, side: { X: bsBlank(N), O: bsBlank(N) }, tg: { X: ship, O: other } });
  }
  return Object.assign(base, { ship }, bsBlank(N));
}
export function apply(mini, p, m, rng, idx) {
  // One shot at one cell. A hit or a miss is shown; the ship's direction never is. A hit that does not
  // sink it fires again at once (the turn goes on until a miss or the sinking shot); the shot that
  // hits its last cell sinks it and claims the square. (Race: the shot lands on p's own sea alone.)
  const ship = bsShipOf(mini, p), part = mini.race ? raceSide(mini, p) : mini;
  if (!part || !ship) return { ok: false, reason: 'bad' };
  if (mini.race) { const sea = bsSea(mini, p); part.revealed = sea.revealed; part.hits = sea.hits; }   // (a race part as the database may have left it: its lists whole again)
  if (!idx(bsN(mini) * bsN(mini))) return { ok: false, reason: 'bad' };
  if (part.revealed[m]) return { ok: false, reason: 'taken' };
  part.revealed[m] = p; part.last = m;
  if (!ship.includes(m)) return { ok: true, outcome: 'continue', note: 'miss' };
  part.hits.push(m);
  if (ship.every(k => part.hits.includes(k))) return { ok: true, outcome: 'win', cells: ship.slice(), note: 'sunk' };
  return { ok: true, outcome: 'continue', note: 'hit', again: goAgain(mini) };   // (a hit fires again only with "Go again on success" on)
}
export function publicView(mini) {
  const v = Object.assign({ type: 'bs', len: mini.len }, mini.n ? { n: mini.n } : {});
  if (mini.race) return Object.assign(v, { race: true, side: JSON.parse(JSON.stringify(mini.side || {})) });   // (a race: both players' seas, open; the ships stay out)
  return Object.assign(v, { revealed: mini.revealed.slice(), hits: mini.hits.slice() });
}
// Race: p's hunt in brief (core/race.js publicMini's shape): shots, hits, misses, and sunk once they have.
export function raceShape(mini, p) {
  if (!raceSide(mini, p)) return {};
  const sea = bsSea(mini, p), n = sea.revealed.filter(Boolean).length, hits = sea.hits.length;
  return Object.assign({ shots: n, hits, miss: n - hits }, hits >= mini.len ? { sunk: true } : {});
}
// Sea Battle: the placements of the ship that still fit every hit and every miss.
export function bsCandidates(pm) {
  const miss = new Set(pm.revealed.map((r, k) => (r && !pm.hits.includes(k) ? k : -1)).filter(k => k >= 0));
  return bsPlacements(pm.len, bsN(pm)).filter(cells => pm.hits.every(h => cells.includes(h)) && !cells.some(k => miss.has(k)));
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(bsSea(mini, p).revealed, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.hit = (bsSea(mini, p).hits || []).includes(m); flash.len = mini.len; return;
}
export function secret(mini) {
  if (mini.race && mini.tg) return { tg: JSON.parse(JSON.stringify(mini.tg)) };   // (a race: both players' ships, top-level: core/records.js fullState puts them back with Object.assign)
  return mini.ship ? { ship: mini.ship.slice() } : null;
}
export function hide(m, k, st) {
  delete m.ship; delete m.tg; return;
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
  if (m.race) { for (const p of c.played) if (c.forks[p].side) m.side[p] = c.forks[p].side[p]; return; }   // (Super Chaos is off; a race square keeps each side's own)
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
