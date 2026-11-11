// Backgammon Lite: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// ---------- Backgammon Lite (November 2026) ----------
// A short track of `len` points (tune). Each player has 3 pieces, waiting at their own start: X's at the left end,
// travelling right; O's at the right end, travelling left. A piece's place is its progress (each player's own count):
// 0 waiting at its start, 1..len on the track (X's progress k is point k from the left; O's is point k from the right),
// len + 1 off the board (borne off past the far end).
// A turn: Roll (two dice, drawn where the move is made: the server online), then each die moves one piece that many
// points, one move per die (the same piece may take both). A die is used by a tap on a piece; the order is the
// player's. Both dice alike (a double) are two moves, no more. A piece may land:
//  - on an empty point or one of its own (any number of its own pieces stack);
//  - on a point holding a single enemy piece: a hit, the enemy piece goes back to its start (progress 0);
//  - never on a point holding 2 or more enemy pieces (a block);
//  - past the far end: it leaves the board (any overshoot; no exact roll needed).
// The square's very first roll (the opener's) is one die alone (`openOne`, on by default: a race's opener is half a
// turn ahead, and this gives it back). A die that no piece can use is lost; with neither usable the roll ends the turn as it is ('stuck'). The first to
// bear all 3 pieces off wins the square (anyone alone gets there: a piece at its start can always enter unless
// the point is blocked, and blocks never last: every piece leaves the board).
// The roll and every die's move are each a move of their own: Roll keeps the turn (`again`), and so does a die used
// while the other can still be used, as 21's Deal and Hit do (the game's own steps, not a success). Go again on
// success (AGAIN_TUNE, off by default): on, a turn that bore a piece off rolls again.
// A turn left part way (a timeout: core/board.js passes the turn with nothing played) leaves its dice behind with
// `by`: the next move by anyone else lets them go (the stale dice are nobody's: bglDice).
export const BGL = { len: 8, pieces: 3 };
export const BGLT = { roll: 820, slide: 420, hit: 480, hold: 380, off: 300 };   // ms: the dice tumbling in, a piece's slide, a hit piece flying home, the result held, a piece leaving
export const bglLen = mini => Math.max(4, Math.round(tune(mini).len || mini.n || BGL.len));
export const bglOther = p => (p === 'X' ? 'O' : 'X');
// The board point (1..n from the left) of p's progress a (on the track only).
export const bglPoint = (p, a, n) => (p === 'X' ? a : n + 1 - a);
// The pieces of side q on board point b.
export function bglAt(mini, q, b) {
  const n = mini.n;
  let c = 0;
  for (const a of mini.pos[q]) if (a >= 1 && a <= n && bglPoint(q, a, n) === b) c++;
  return c;
}
// The dice in play for p (stale ones, left by a timeout on someone else's turn, are none).
export const bglDice = (mini, p) => (mini.dice && mini.dice.by === p ? mini.dice : null);
// Can p's piece k move v points? Off the board past the end; never onto 2 or more enemy pieces.
export function bglCan(mini, p, k, v) {
  const n = mini.n, a = mini.pos[p][k];
  if (!(a >= 0 && a <= n)) return false;
  const b = a + v;
  if (b > n) return true;
  return bglAt(mini, bglOther(p), bglPoint(p, b, n)) < 2;
}
// The moves open to p now: [{ d, k }] for each unused die and each piece that can take it (pieces alike: the first).
export function bglMoves(mini, p) {
  const dc = bglDice(mini, p), out = [];
  if (!dc) return out;
  for (let d = 0; d < 2; d++) {
    if (dc.used[d] || !dc.v[d] || (d === 1 && !dc.used[0] && dc.v[0] === dc.v[1])) continue;   // (a double: the first die first; the opening single die: no second)
    const seen = new Set();
    for (let k = 0; k < BGL.pieces; k++) { const a = mini.pos[p][k]; if (seen.has(a)) continue; seen.add(a); if (bglCan(mini, p, k, dc.v[d])) out.push({ d, k }); }
  }
  return out;
}
export const bglLeft = (mini, p) => mini.pos[p].filter(a => a <= mini.n).length;   // pieces still to bear off
export const bglPips = (mini, p) => mini.pos[p].reduce((s, a) => s + Math.max(0, mini.n + 1 - a), 0);   // the points still to travel
export function create(type, rng) {
  const n = Math.max(4, Math.round(tuneLive(type).len || BGL.len));   // (the square keeps its length: n)
  return { type, v: 1, n, pos: { X: [0, 0, 0], O: [0, 0, 0] }, dice: null, rolled: false, last: null };
}
// One step for p: the move m played on the square (no checks): what it did.
export function bglStep(mini, p, d, k) {
  const n = mini.n, dc = mini.dice, v = dc.v[d], from = mini.pos[p][k], to = Math.min(n + 1, from + v), q = bglOther(p);
  let hit = null;
  if (to <= n) {
    const b = bglPoint(p, to, n), j = mini.pos[q].findIndex(a => a >= 1 && a <= n && bglPoint(q, a, n) === b);
    if (j >= 0) { hit = { k: j, from: mini.pos[q][j] }; mini.pos[q][j] = 0; }
  }
  mini.pos[p][k] = to; dc.used[d] = true;
  if (to > n) dc.off = (dc.off || 0) + 1;
  return { from, to, hit, v };
}
export function apply(mini, p, m, rng, idx) {
  if (!mini.n) mini.n = bglLen(mini);
  const r = needRng(rng);
  if (m === 'roll' || m === 'auto') {
    if (bglDice(mini, p)) return { ok: false, reason: 'bad' };          // (dice to use first)
    const one = !mini.rolled && tune(mini).openOne !== 'off';         // the square's first roll: one die (what keeps the first mover under 60%)
    const v = one ? [1 + randInt(r, 6), 0] : [1 + randInt(r, 6), 1 + randInt(r, 6)];
    mini.rolled = true;
    mini.dice = { by: p, v, used: [false, one], off: 0 };
    const any = bglMoves(mini, p).length > 0;
    mini.last = { by: p, kind: 'roll', v: v.slice(), one, stuck: !any, pos: { X: mini.pos.X.slice(), O: mini.pos.O.slice() } };
    if (!any) { mini.dice = null; return { ok: true, outcome: 'continue', note: 'stuck' }; }   // no die can be used: the turn ends as it is
    return { ok: true, outcome: 'continue', note: 'roll', again: true };
  }
  if (!m || typeof m !== 'object' || !Number.isInteger(m.d) || !Number.isInteger(m.k) || m.d < 0 || m.d > 1 || m.k < 0 || m.k >= BGL.pieces) return { ok: false, reason: 'bad' };
  const dc = bglDice(mini, p);
  if (!dc || dc.used[m.d] || !bglCan(mini, p, m.k, dc.v[m.d])) return { ok: false, reason: 'bad' };
  const s = bglStep(mini, p, m.d, m.k);
  const won = mini.pos[p].every(a => a > mini.n);
  const more = !won && bglMoves(mini, p).length > 0;
  const lost = !won && !more && dc.used.some(u => !u);                // (the other die could not be used: lost)
  mini.last = { by: p, kind: 'use', d: m.d, k: m.k, v: dc.v.slice(), used: dc.used.slice(), from: s.from, to: s.to, hit: s.hit, off: s.to > mini.n, lost, end: !more, pos: { X: mini.pos.X.slice(), O: mini.pos.O.slice() } };
  if (won) { mini.dice = null; return { ok: true, outcome: 'win', note: 'off' }; }
  if (more) return { ok: true, outcome: 'continue', note: s.hit ? 'hit' : 'move', again: true };
  const off = dc.off || 0;
  mini.dice = null;
  if (off > 0 && goAgain(mini)) { mini.last.again = true; return { ok: true, outcome: 'continue', note: 'off', again: true }; }   // ("Go again on success" on: a piece borne off this turn, roll again)
  return { ok: true, outcome: 'continue', note: s.hit ? 'hit' : s.to > mini.n ? 'off' : 'move' };
}
export function publicView(mini) {
  return { type: 'bglite', v: mini.v, n: mini.n, rolled: !!mini.rolled, pos: { X: mini.pos.X.slice(), O: mini.pos.O.slice() }, dice: mini.dice ? JSON.parse(JSON.stringify(mini.dice)) : null };
}
// A random legal step (the tests', the sandbox's; a phone's timeout plays nothing: core/board.js).
export function randomMove(mini, p, rng, from, empties) {
  const ms = bglMoves(mini, p);
  return ms.length ? ms[randInt(needRng(rng), ms.length)] : 'roll';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.bgl = JSON.parse(JSON.stringify(mini.last));
}
// A step's moments (ms from the move): the dice tumbling in (a roll), or the piece's slide, a hit piece flying home after
// it lands, the result held.
export function bglTimes(b) {
  if (!b) return { end: BGLT.hold };
  if (b.kind === 'roll') return { land: BGLT.roll, end: BGLT.roll + (b.stuck ? BGLT.hold + 300 : 120) };
  const slid = BGLT.slide + (b.off ? BGLT.off : 0);
  return { slid, hitAt: b.hit ? BGLT.slide : null, end: slid + (b.hit ? BGLT.hit : 0) + (b.end ? BGLT.hold : 80) };
}
export function flashMs(f, winLen, won) { return bglTimes(f.bgl).end + (won ? 600 : 0); }
