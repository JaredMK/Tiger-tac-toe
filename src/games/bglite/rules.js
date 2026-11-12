// Backgammon Lite: the rules (pure: no page, no clock; the server runs the same code).
import { DIE_MORE } from '../../core/config.js';
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// ---------- Backgammon Lite (November 2026; reworked the same month, v 2) ----------
// A short track of `len` points (tune). Each player has 3 pieces, all three starting on the first point of their own
// side: X's on the leftmost point, travelling right; O's on the rightmost, travelling left. A piece's place is its
// progress (each player's own count): 1..len on the track (X's progress k is point k from the left; O's is point k from
// the right), len + 1 off the board (borne off past the far end). The last `home` points of a player's way are their
// home zone (progress len - home + 1 .. len).
// A turn: Roll (two dice, drawn where the move is made: the server online), then each die moves one piece that many
// points, one move per die (the same piece may take several). A die is used by a tap on a piece; the order is the
// player's. A double gives four moves of that number. A piece may land:
//  - on an empty point or one of its own (any number of its own pieces stack);
//  - on a point holding a single enemy piece: a hit, the enemy piece goes back to its start point (progress 1);
//    a lone piece on its own start point is never hit (it is home already: the enemy piece simply shares the point);
//  - never on a point holding 2 or more enemy pieces (a block; the three on their start point block it at first);
//  - past the far end: it is borne off (any overshoot; no exact roll needed), but only once every piece of that player
//    still on the board stands in their home zone.
// A square dealt before the rework (v 1: the pieces waiting off the board at progress 0, entering with a die; doubles two
// moves; no home zone) plays on under those rules to its end (bglV2).
// The square's very first roll (the opener's) is one die alone (`openOne`, on by default: a race's opener is half a
// turn ahead, and this gives it back). A die that no piece can use is lost; with neither usable the roll ends the turn as it is ('stuck'). The first to
// bear all 3 pieces off wins the square (anyone alone gets there: a piece at its start can always enter unless
// the point is blocked, and blocks never last: every piece leaves the board).
// A turn is two moves (November 2026, the backgammon-app flow, CLIENT_VERSION 1.12.0): Roll, which keeps the turn
// (`again`, as 21's Deal: the game's own step, not a success), then the whole turn's play as one move,
// `{ steps: [[d, k], ...] }`: each step die d moving piece k, in the player's order (the phone drafts them, with Undo,
// and sends them once no die is left that any piece can use: view.js). The server checks the steps one by one from
// the position as it stands (each legal in turn, bglTurn) and the turn must be played out: after the last step no
// unused die may still have a legal move (a die no piece can use by then is lost, as ever), unless the last piece is
// off. A square played by an older client may still take a single step, `{ d, k }` (a move of its own, `again` while
// a die can still be used), so a turn under way from before plays on. Go again on success (AGAIN_TUNE, off by
// default): on, a turn that bore a piece off rolls again.
// A turn left part way (a timeout: core/board.js passes the turn with nothing played; the phone's draft is never sent)
// leaves its dice behind with `by`: the next move by anyone else lets them go (the stale dice are nobody's: bglDice).
export const BGL = { len: 8, pieces: 3, home: 3 };
export const bglV2 = mini => (mini.v || 1) >= 2;
export const bglStart = mini => (bglV2(mini) ? 1 : 0);   // where a piece starts and goes back to when hit
export const bglHome = mini => Math.max(1, Math.min(mini.n, Math.round(tune(mini).home || BGL.home)));
// The dice a roll of a and b gives: a double four moves of that number (two on a square from before), else the two.
export const bglRollDice = (mini, a, b) => (a === b && bglV2(mini) ? [a, a, a, a] : [a, b]);
// May p bear a piece off now? Every piece of p's still on the board in the home zone (v 1: always).
export function bglCanOff(mini, p) {
  if (!bglV2(mini)) return true;
  const lo = mini.n - bglHome(mini) + 1;
  return mini.pos[p].every(a => a > mini.n || a >= lo);
}
export const BGLT = { roll: 820 + DIE_MORE, slide: 420, hit: 480, hold: 380, off: 300, gap: 180, look: 260 };   // ms: the dice tumbling in, a piece's slide, a hit piece flying home, the result held, a piece leaving, the pause between a turn's steps, the piece picked before it slides (a turn's flash)
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
// Where p's piece at progress a lands with v (n + 1: borne off). Once every piece is home (bglCanOff), a roll that reaches the
// last point or passes it bears the piece off: no exact roll needed (November 2026; a square from before, v 1: only past it).
export function bglTo(mini, p, a, v) {
  const n = mini.n, b = a + v;
  if (b > n) return n + 1;
  return b === n && bglV2(mini) && bglCanOff(mini, p) ? n + 1 : b;
}
// Can p's piece k move v points? Off the board at or past the end (once home); never onto 2 or more enemy pieces.
export function bglCan(mini, p, k, v) {
  const n = mini.n, a = mini.pos[p][k];
  if (!(a >= 0 && a <= n)) return false;
  const b = bglTo(mini, p, a, v);
  if (b > n) return bglCanOff(mini, p);
  return bglAt(mini, bglOther(p), bglPoint(p, b, n)) < 2;
}
// The moves open to p now: [{ d, k }] for each unused die and each piece that can take it (pieces alike: the first).
export function bglMoves(mini, p) {
  const dc = bglDice(mini, p), out = [];
  if (!dc) return out;
  const vals = new Set();
  for (let d = 0; d < dc.v.length; d++) {
    if (dc.used[d] || !dc.v[d] || vals.has(dc.v[d])) continue;   // (dice alike, a double's: the first unused one alone; the opening single die: no second)
    vals.add(dc.v[d]);
    const seen = new Set();
    for (let k = 0; k < BGL.pieces; k++) { const a = mini.pos[p][k]; if (seen.has(a)) continue; seen.add(a); if (bglCan(mini, p, k, dc.v[d])) out.push({ d, k }); }
  }
  return out;
}
export const bglLeft = (mini, p) => mini.pos[p].filter(a => a <= mini.n).length;   // pieces still to bear off
export const bglPips = (mini, p) => mini.pos[p].reduce((s, a) => s + Math.max(0, mini.n + 1 - a), 0);   // the points still to travel
export function create(type, rng) {
  const n = Math.max(4, Math.round(tuneLive(type).len || BGL.len));   // (the square keeps its length: n)
  return { type, v: 2, n, pos: { X: [1, 1, 1], O: [1, 1, 1] }, dice: null, rolled: false, last: null };   // (every piece on its own start point)
}
// One step for p: the move m played on the square (no checks): what it did.
export function bglStep(mini, p, d, k) {
  const n = mini.n, dc = mini.dice, v = dc.v[d], from = mini.pos[p][k], to = bglTo(mini, p, from, v), q = bglOther(p);
  let hit = null;
  if (to <= n) {
    const b = bglPoint(p, to, n), j = mini.pos[q].findIndex(a => a >= 1 && a <= n && bglPoint(q, a, n) === b);
    if (j >= 0 && !(bglV2(mini) && mini.pos[q][j] === 1)) { hit = { k: j, from: mini.pos[q][j] }; mini.pos[q][j] = bglStart(mini); }   // (a lone piece on its own start point is never hit)
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
    const v = one ? [1 + randInt(r, 6), 0] : bglRollDice(mini, 1 + randInt(r, 6), 1 + randInt(r, 6));
    mini.rolled = true;
    mini.dice = { by: p, v, used: v.map((x, i) => one && i === 1), off: 0 };
    const any = bglMoves(mini, p).length > 0;
    mini.last = { by: p, kind: 'roll', v: v.slice(), one, stuck: !any, pos: { X: mini.pos.X.slice(), O: mini.pos.O.slice() } };
    if (!any) { mini.dice = null; return { ok: true, outcome: 'continue', note: 'stuck' }; }   // no die can be used: the turn ends as it is
    return { ok: true, outcome: 'continue', note: 'roll', again: true };
  }
  if (m && typeof m === 'object' && Array.isArray(m.steps)) return applyTurn(mini, p, m.steps);
  if (!m || typeof m !== 'object' || !Number.isInteger(m.d) || !Number.isInteger(m.k) || m.d < 0 || m.d > 3 || m.k < 0 || m.k >= BGL.pieces) return { ok: false, reason: 'bad' };
  const dc = bglDice(mini, p);
  if (!dc || m.d >= dc.v.length || dc.used[m.d] || !bglCan(mini, p, m.k, dc.v[m.d])) return { ok: false, reason: 'bad' };
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
// The whole turn's steps played on the square, checked one by one (bglTurn), and its flash: every step with where it
// went and what it hit, the dice as they stood before (used0) and the dice nobody could use by the end (lost).
function applyTurn(mini, p, steps) {
  const dc = bglDice(mini, p);
  if (!dc) return { ok: false, reason: 'bad' };
  const used0 = dc.used.slice(), t = bglTurn(mini, p, steps);
  if (!t) return { ok: false, reason: 'bad' };
  const won = mini.pos[p].every(a => a > mini.n), lost = won ? [] : dc.v.map((v, d) => d).filter(d => !dc.used[d] && dc.v[d]);
  const hit = t.some(s => s.hit), off = t.some(s => s.off);
  mini.last = { by: p, kind: 'turn', v: dc.v.slice(), used0, steps: t, lost, pos: { X: mini.pos.X.slice(), O: mini.pos.O.slice() } };
  mini.dice = null;
  if (won) return { ok: true, outcome: 'win', note: 'off' };
  if ((dc.off || 0) > 0 && goAgain(mini)) { mini.last.again = true; return { ok: true, outcome: 'continue', note: 'off', again: true }; }   // ("Go again on success" on: a piece borne off this turn, roll again)
  return { ok: true, outcome: 'continue', note: hit ? 'hit' : off ? 'off' : 'move' };
}
// A turn's steps [[d, k], ...] for p, played in order on the square if every one is legal where it stands and the turn
// is played out (no unused die left with a legal move, or every piece off): [{ d, k, from, to, hit, off }], else null
// with the square untouched.
export function bglTurn(mini, p, steps) {
  const dc = bglDice(mini, p);
  if (!dc || !Array.isArray(steps) || steps.length < 1 || steps.length > 4) return null;
  const keep = { X: mini.pos.X.slice(), O: mini.pos.O.slice() }, used = dc.used.slice(), off0 = dc.off || 0;
  const undo = () => { mini.pos = keep; dc.used = used; dc.off = off0; return null; };
  const out = [];
  for (const s of steps) {
    if (!Array.isArray(s) || s.length !== 2) return undo();
    const [d, k] = s;
    if (!Number.isInteger(d) || !Number.isInteger(k) || d < 0 || d >= dc.v.length || k < 0 || k >= BGL.pieces) return undo();
    if (dc.used[d] || !dc.v[d] || mini.pos[p].every(a => a > mini.n) || !bglCan(mini, p, k, dc.v[d])) return undo();
    const r = bglStep(mini, p, d, k);
    out.push({ d, k, from: r.from, to: r.to, hit: r.hit, off: r.to > mini.n });
  }
  if (!mini.pos[p].every(a => a > mini.n) && bglMoves(mini, p).length) return undo();   // (a die still usable: the turn is not played out)
  return out;
}
export function publicView(mini) {
  return { type: 'bglite', v: mini.v, n: mini.n, rolled: !!mini.rolled, pos: { X: mini.pos.X.slice(), O: mini.pos.O.slice() }, dice: mini.dice ? JSON.parse(JSON.stringify(mini.dice)) : null };
}
// A random legal step (the tests', the sandbox's; a phone's timeout plays nothing: core/board.js).
export function randomMove(mini, p, rng, from, empties) {
  if (!bglDice(mini, p)) return 'roll';
  const r = needRng(rng), c = { type: mini.type, n: mini.n, v: mini.v, tune: mini.tune, pos: { X: mini.pos.X.slice(), O: mini.pos.O.slice() }, dice: JSON.parse(JSON.stringify(mini.dice)) }, steps = [];
  for (let ms = bglMoves(c, p); ms.length && !c.pos[p].every(a => a > c.n); ms = bglMoves(c, p)) { const x = ms[randInt(r, ms.length)]; bglStep(c, p, x.d, x.k); steps.push([x.d, x.k]); }
  return steps.length ? { steps } : 'roll';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.bgl = JSON.parse(JSON.stringify(mini.last));
}
// A step's moments (ms from the move): the dice tumbling in (a roll), or the piece's slide, a hit piece flying home after
// it lands, the result held.
// A whole turn (kind 'turn'): its steps one after the other, each the piece picked (look), its slide (and a hit piece
// flying home after it lands), a short gap: steps [{ at, land, hitAt }] (at: the pick), slid (the last landing), first
// off (offAt), end.
export function bglTimes(b) {
  if (!b) return { end: BGLT.hold };
  if (b.kind === 'turn') {
    let t = 0, offAt = null;
    const steps = (b.steps || []).map(s => { const at = t, go = at + BGLT.look, land = go + BGLT.slide + (s.off ? BGLT.off : 0); if (s.off && offAt == null) offAt = land; t = land + (s.hit ? BGLT.hit : 0) + BGLT.gap; return { at, go, land, hitAt: s.hit ? land : null }; });
    const slid = steps.length ? steps[steps.length - 1].land : 0, tail = steps.length ? t - BGLT.gap : 0;
    return { steps, slid, offAt, deadAt: tail, end: tail + BGLT.hold + (b.lost && b.lost.length ? 300 : 0) };
  }
  if (b.kind === 'roll') return { land: BGLT.roll, end: BGLT.roll + (b.stuck ? BGLT.hold + 300 : 120) };
  const slid = BGLT.slide + (b.off ? BGLT.off : 0);
  return { slid, hitAt: b.hit ? BGLT.slide : null, end: slid + (b.hit ? BGLT.hit : 0) + (b.end ? BGLT.hold : 80) };
}
export function flashMs(f, winLen, won) { return bglTimes(f.bgl).end + (won ? 600 : 0); }
