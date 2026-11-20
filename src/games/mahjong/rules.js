// Mahjong: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own small solitaire layout (`lay[p]`: tiles { x, y, z, k }: a place in half-tile steps across and
// down, its layer, its picture; `on[p][i]`: still on the table). A tile is free when nothing lies on it and its left
// or its right side is open. A move removes two free tiles with the same picture, `[i, j]`. A pair that uncovers a
// tile (one that had a tile lying on it and now has none) keeps the turn (`again`, the `chain` setting); any other
// pair ends it. The first to clear `goal` pairs takes the square.
// Solvable, always: every picture is on the table exactly twice and the pictures are dealt by playing the layout
// backwards (two free tiles get a picture and come off, until none is left), so there is an order that clears it;
// and since taking tiles off only ever frees more, no order of free pairs can spoil it: there is always a pair to take.
// As asked, without the chain, every move cleared exactly one pair and whoever moved first always won.
import { needRng, randInt, shuffle } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const MAHJ = { lift: 260, fly: 320, hold: 420 };           // ms: the two tiles lifting, flying off, the result
// The layouts by size (pairs): places [x, y, z] in half-tile steps; the lower layer a block, the upper ones over its joins.
const grid = (cols, rows, x0, y0, z) => { const out = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([x0 + c * 2, y0 + r * 2, z]); return out; };
export const LAYOUTS = {
  6: grid(4, 2, 0, 0, 0).concat(grid(2, 1, 2, 1, 1), grid(2, 1, 2, 1, 2)),
  8: grid(4, 3, 0, 0, 0).concat(grid(2, 2, 2, 1, 1)),
  9: grid(4, 3, 0, 0, 0).concat(grid(2, 2, 2, 1, 1), grid(2, 1, 2, 2, 2)),
  10: grid(5, 3, 0, 0, 0).concat(grid(2, 2, 3, 1, 1), [[3, 2, 2]]).concat([[7, 2, 1]]).slice(0, 20),
  12: grid(5, 3, 0, 0, 0).concat(grid(3, 2, 2, 1, 1), grid(2, 1, 3, 2, 2), [[4, 2, 3]]),
};
export function mahjCfg(mini) { const t = tune(mini); return { goal: t.goal, chain: t.chain !== 'off', even: t.even !== 'off' }; }
const over = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
// Is tile i free: nothing on it, and its left or right side open.
export function mahjFree(tiles, on, i) {
  const t = tiles[i]; if (!on[i]) return false;
  let left = false, right = false;
  for (let j = 0; j < tiles.length; j++) {
    if (j === i || !on[j]) continue; const u = tiles[j];
    if (u.z === t.z + 1 && over(u, t)) return false;
    if (u.z === t.z && Math.abs(u.y - t.y) < 2) { if (u.x === t.x - 2) left = true; if (u.x === t.x + 2) right = true; }
  }
  return !(left && right);
}
const covered = (tiles, on, i) => tiles.some((u, j) => j !== i && on[j] && u.z === tiles[i].z + 1 && over(u, tiles[i]));
// The free pairs on the table: [[i, j], ...].
export function mahjPairs(tiles, on) {
  const free = tiles.map((t, i) => i).filter(i => mahjFree(tiles, on, i)), out = [];
  for (let a = 0; a < free.length; a++) for (let b = a + 1; b < free.length; b++) if (tiles[free[a]].k === tiles[free[b]].k) out.push([free[a], free[b]]);
  return out;
}
// Would taking i and j uncover a tile (one lying under a tile now, under none after)?
export function mahjUncovers(tiles, on, i, j) {
  const was = tiles.map((t, k) => on[k] && covered(tiles, on, k)), after = on.slice(); after[i] = false; after[j] = false;
  return tiles.some((t, k) => after[k] && was[k] && !covered(tiles, after, k));
}
// A layout dealt solvable: its places, then the pictures by playing it backwards.
export function mahjDeal(pairs, set, rng) {
  const size = LAYOUTS[pairs] ? pairs : 9, places = LAYOUTS[size], tiles = places.map(([x, y, z]) => ({ x, y, z, k: -1 }));
  const pics = shuffle(Array.from({ length: Math.max(set, size) }, (_, k) => k), rng).slice(0, size);
  for (let tries = 0; tries < 200; tries++) {
    const on = tiles.map(() => true); let ok = true;
    for (let p = 0; p < size && ok; p++) {
      const free = tiles.map((t, i) => i).filter(i => mahjFree(tiles, on, i));
      if (free.length < 2) { ok = false; break; }
      const a = free.splice(randInt(rng, free.length), 1)[0], b = free[randInt(rng, free.length)];
      tiles[a].k = pics[p]; tiles[b].k = pics[p]; on[a] = false; on[b] = false;
    }
    if (ok) return tiles;
  }
  return tiles;
}
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), lay = { X: mahjDeal(t.pairs, t.set, r), O: mahjDeal(t.pairs, t.set, r) };
  return { type, v: 1, lay, on: { X: lay.X.map(() => true), O: lay.O.map(() => true) }, got: { X: 0, O: 0 }, turns: { X: 0, O: 0 }, last: null };
}
// Equal turns (the `even` setting): the player who moved first in the square does not take it by reaching the goal with
// a turn in hand: the other gets one turn to answer (`mini.final = { by }`); reaching the goal too is a draw (the
// square resets), a turn that ends short leaves it to the first (`held`); an answer never made is not waited for: the
// leader's next move there takes it (`unanswered`).
export function apply(mini, p, m, rng, idx) {
  const tiles = mini.lay[p], on = mini.on[p], o = p === 'X' ? 'O' : 'X';
  if (!Array.isArray(m) || m.length !== 2 || !m.every(i => Number.isInteger(i) && i >= 0 && i < tiles.length) || m[0] === m[1]) return { ok: false, reason: 'bad' };
  const [i, j] = m;
  if (mini.final && mini.final.by === p) { mini.last = { by: p, i: -1, j: -1, k: -1, again: false }; return { ok: true, outcome: 'win', note: 'unanswered' }; }
  if (!mahjFree(tiles, on, i) || !mahjFree(tiles, on, j)) return { ok: false, reason: 'blocked' };
  if (tiles[i].k !== tiles[j].k) return { ok: false, reason: 'nomatch' };
  const c = mahjCfg(mini), bonus = c.chain && mahjUncovers(tiles, on, i, j);
  if (!mini.first) mini.first = p;
  on[i] = false; on[j] = false; mini.got[p]++;
  if (!mini.last || mini.last.by !== p || !mini.last.again) mini.turns[p]++;
  const done = mini.got[p] >= c.goal || !on.some(Boolean), again = bonus && !done;
  mini.last = { by: p, i, j, k: tiles[i].k, again };
  if (mini.final) {                                               // the answering turn
    if (done) return { ok: true, outcome: 'draw', note: 'tie' };
    if (again) return { ok: true, outcome: 'continue', note: 'chain', again: true };
    return { ok: true, outcome: 'win', winner: mini.final.by, note: 'held' };
  }
  if (done) {
    if (c.even && mini.first === p && mini.turns[o] < mini.turns[p]) { mini.final = { by: p }; return { ok: true, outcome: 'continue', note: 'reached' }; }
    return { ok: true, outcome: 'win', note: 'won' };
  }
  return again ? { ok: true, outcome: 'continue', note: 'chain', again: true } : { ok: true, outcome: 'continue', note: 'pair' };
}
export function timeoutClose(mini, p) { return null; }             // (a chain's next pair is not taken; an answering turn cut short has ended: the leader's next move there takes the square)
export function publicView(mini) {
  const cp = l => l.map(t => ({ x: t.x, y: t.y, z: t.z, k: t.k }));
  return { type: 'mahjong', v: mini.v, lay: { X: cp(mini.lay.X), O: cp(mini.lay.O) }, on: { X: mini.on.X.slice(), O: mini.on.O.slice() }, got: { X: mini.got.X, O: mini.got.O }, turns: { X: mini.turns.X, O: mini.turns.O }, first: mini.first || null, final: mini.final ? { by: mini.final.by } : null, last: mini.last ? Object.assign({}, mini.last) : null };
}
export function randomMove(mini, p, rng, from, empties) { const pr = mahjPairs(mini.lay[p], mini.on[p]); return pr.length ? from(pr) : [0, 1]; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { const l = mini.last; flash.mj = { i: l.i, j: l.j, k: l.k, again: l.again, got: mini.got[p] }; }
export function flashMs(f, winLen, won) { return MAHJ.lift + MAHJ.fly + (f.mj && f.mj.again ? 80 : MAHJ.hold) + (won ? 400 : 0); }
