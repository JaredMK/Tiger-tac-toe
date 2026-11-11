// Shut the Box: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// ---------- Shut the Box (November 2026) ----------
// Each player has their own box of tiles 1 to `tiles` (6), all open to begin with. A move is two steps:
//  - Roll: two dice, or one die once the player's open tiles add up to `oneDie` (6) or less, drawn where the move is
//    made (the server online). No set of open tiles adds up to the roll: nothing changes and the turn ends (note
//    'none'). Otherwise the roll waits on the square (`mini.roll`) and the turn is held to it (`again`: the game's
//    own second step, as 21's Deal is, not a success).
//  - Flip: the open tiles that add up to the roll, as a list of their numbers (any order); they go down for good.
//    The turn then ends, or, with "Go again on success" on (core/tune.js AGAIN_TUNE), the same player rolls again.
// The first to shut every tile of their own box wins the square (individual progress: a player moving alone wins).
// A timeout with the roll waiting flips nothing ('drop', core/board.js timeoutClose). Nothing is hidden.
export const SHUT = { tiles: 6, oneDie: 6, roll: 900, land: 560, flip: 240, flipMs: 420, hold: 450 };
export const shutCfg = mini => { const t = tune(mini); return { tiles: Math.max(3, Math.min(9, Math.round(t.tiles != null ? t.tiles : SHUT.tiles))), oneDie: Math.max(0, Math.min(12, Math.round(t.oneDie != null ? t.oneDie : SHUT.oneDie))) }; };
export const shutN = mini => (Array.isArray(mini.up && mini.up.X) ? mini.up.X.length : shutCfg(mini).tiles);
// The open tiles of a box (their numbers), and what they add up to.
export const shutOpen = up => up.reduce((a, u, k) => (u ? a.concat(k + 1) : a), []);
export const shutLeft = up => shutOpen(up).reduce((a, b) => a + b, 0);
export const shutDice = (up, cfg) => (shutLeft(up) <= cfg.oneDie ? 1 : 2);   // how many dice the next roll takes
// Every set of open tiles adding up to `total`, each as a sorted list of numbers.
export function shutWays(up, total) {
  const open = shutOpen(up), out = [];
  for (let s = 1; s < 1 << open.length; s++) {
    let sum = 0;
    for (let i = 0; i < open.length; i++) if (s >> i & 1) sum += open[i];
    if (sum === total) out.push(open.filter((_, i) => s >> i & 1));
  }
  return out;
}
export const shutSum = d => d.reduce((a, b) => a + b, 0);
export function create(type, rng) {
  const c = shutCfg({ type, tune: tuneLive(type) });              // (the values of the moment; the square keeps its own in mini.tune)
  return { type, up: { X: new Array(c.tiles).fill(true), O: new Array(c.tiles).fill(true) }, roll: null, rolls: { X: 0, O: 0 }, last: null };   // roll: the dice waiting for tiles ({ by, d }); rolls: each player's rolls made
}
export function apply(mini, p, m, rng, idx) {
  const cfg = shutCfg(mini), up = mini.up[p];
  if (mini.roll && mini.roll.by !== p) mini.roll = null;           // (a roll left by the other player's timeout: gone)
  if (m === 'roll') {
    if (mini.roll) return { ok: false, reason: 'rolled' };
    const r = needRng(rng);
    for (let k = 0; k < mini.rolls[p] % 5; k++) r();               // (a caller that hands every roll the same seed still sees the dice vary: the tests' fixed server)
    const d = Array.from({ length: shutDice(up, cfg) }, () => 1 + randInt(r, 6)), ways = shutWays(up, shutSum(d));
    mini.rolls[p] += 1;
    mini.last = { by: p, kind: 'roll', d, none: !ways.length };
    if (!ways.length) return { ok: true, outcome: 'continue', note: 'none' };   // no tiles make it: the turn ends with no change
    mini.roll = { by: p, d };
    return { ok: true, outcome: 'continue', note: 'roll', again: true };       // (the turn held for the tiles)
  }
  if (m === 'drop' || m === 'auto') {                              // the time ran out with the roll waiting: nothing flipped
    if (!mini.roll) return { ok: false, reason: 'bad' };
    mini.last = { by: p, kind: 'drop', d: mini.roll.d.slice() }; mini.roll = null;
    return { ok: true, outcome: 'continue', note: 'drop' };
  }
  if (!mini.roll || !Array.isArray(m) || !m.length || m.length > up.length) return { ok: false, reason: 'bad' };
  const tiles = m.map(Number).sort((a, b) => a - b);
  if (tiles.some((t, i) => !Number.isInteger(t) || t < 1 || t > up.length || !up[t - 1] || (i && tiles[i - 1] === t))) return { ok: false, reason: 'bad' };
  if (shutSum(tiles) !== shutSum(mini.roll.d)) return { ok: false, reason: 'sum' };
  for (const t of tiles) up[t - 1] = false;
  mini.last = { by: p, kind: 'flip', d: mini.roll.d.slice(), tiles };
  mini.roll = null;
  if (!up.some(Boolean)) return { ok: true, outcome: 'win', note: 'shut' };
  if (goAgain(mini)) return { ok: true, outcome: 'continue', note: 'flip', again: true };   // ("Go again on success" on: roll again)
  return { ok: true, outcome: 'continue', note: 'flip' };
}
export function publicView(mini) {
  return { type: 'shut', up: { X: mini.up.X.slice(), O: mini.up.O.slice() }, roll: mini.roll ? { by: mini.roll.by, d: mini.roll.d.slice() } : null, rolls: { X: mini.rolls.X, O: mini.rolls.O } };
}
export function canMove(mini) { return true; }
export function randomMove(mini, p, rng, from, empties) {        // (the tests' stand-in for a player: a roll, or any tiles that make it)
  if (!mini.roll || mini.roll.by !== p) return 'roll';
  const ways = shutWays(mini.up[p], shutSum(mini.roll.d));
  return ways.length ? ways[randInt(needRng(rng), ways.length)] : 'drop';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.shut = { kind: l.kind, d: l.d.slice(), none: !!l.none, tiles: l.tiles ? l.tiles.slice() : null, up: { X: mini.up.X.slice(), O: mini.up.O.slice() } };
}
// The move's moments (ms from it): a roll tumbles in and lands; a flip turns its tiles down one after the other.
export function shutTimes(s) {
  if (!s) return { end: SHUT.hold };
  if (s.kind === 'roll') return { land: SHUT.land, end: SHUT.roll + (s.none ? SHUT.hold : 0) };
  if (s.kind === 'flip') { const n = s.tiles ? s.tiles.length : 0; return { flipAt: k => k * SHUT.flip, end: (n - 1) * SHUT.flip + SHUT.flipMs + SHUT.hold }; }
  return { end: SHUT.hold };
}
export function flashMs(f, winLen, won) { return shutTimes(f.shut).end + (won ? 600 : 0); }
