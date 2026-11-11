// Seating: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { other } from '../../core/util.js';
import { tune, tuneLive } from '../../core/tune.js';

// ---------- Seating (reworked November 2026) ----------
// A restaurant of `tables` tables for two; every seat has a colour (one of `colors`). A move: sit in a seat of a table
// nobody is at (never a table the other player is at; a player may have several tables waiting). Then the next customer
// (their colour always on show) walks in and takes a random empty seat of their colour:
//  - across from a player: that player scores 1 (the table is full);
//  - at an empty table: a second customer comes in at once and takes the other seat, closing that table;
//  - no seat of their colour free (the move took the last one): they leave.
// A player's seat stays open for later customers until its table fills. The next customer's colour is drawn from the
// empty seats (each seat as likely), only as the move is made (by the server online). The game ends once no table is
// left to sit at (the seats still waiting then score nothing), or as soon as the side behind can no longer catch up
// with the points still possible (its score, its seats waiting and one for every table left). The higher score
// wins; level, the square resets (`note: 'tie'`).
export const SEAT = { tables: 15, colors: 4 };
export const seatCfg = m => Object.assign({}, SEAT, tune(m));
export const seatTable = i => Math.floor(i / 2), seatMate = i => (i % 2 ? i - 1 : i + 1);
const PL = w => w === 'X' || w === 'O';
// The tables nobody is at (both seats empty).
export const seatFree = who => { const t = []; for (let i = 0; i < who.length; i += 2) if (!who[i] && !who[i + 1]) t.push(i / 2); return t; };
// The seats a move may take: both seats of every free table.
export const seatMoves = who => seatFree(who).flatMap(t => [2 * t, 2 * t + 1]);
// p's seats still waiting for a customer (the table's other seat empty).
export const seatWaiting = (who, p) => who.filter((w, i) => w === p && !who[seatMate(i)]).length;
export const seatScore = mini => (mini.score ? { X: mini.score.X || 0, O: mini.score.O || 0 } : { X: 0, O: 0 });
// The next customer's colour: an empty seat's, each empty seat as likely (null when none is left).
export function seatNext(who, color, rng) {
  const e = who.map((w, i) => (w ? -1 : i)).filter(i => i >= 0);
  return e.length ? color[e[randInt(rng, e.length)]] : null;
}
// The customer (colour c) comes in: { z, z2, scorer, left }. z: the seat taken (null: they leave); z2: the second
// customer's, at an empty table; scorer: the player across from z.
export function seatCustomer(who, color, c, rng) {
  const theirs = who.map((w, i) => (!w && color[i] === c ? i : -1)).filter(i => i >= 0);
  if (!theirs.length) return { z: null, z2: null, scorer: null, left: true };
  const z = theirs[randInt(rng, theirs.length)], mate = who[seatMate(z)];
  who[z] = 'Z';
  if (PL(mate)) return { z, z2: null, scorer: mate, left: false };
  who[seatMate(z)] = 'Z';                                         // an empty table: a second customer takes the other seat, closing it
  return { z, z2: seatMate(z), scorer: null, left: false };
}
// The outcome once a move is through: null to go on, else { winner } ('draw' when level) and why.
export function seatEnd(who, score) {
  const free = seatFree(who).length;
  if (!free) return { winner: score.X > score.O ? 'X' : score.O > score.X ? 'O' : 'draw', why: 'full' };
  const lead = score.X > score.O ? 'X' : score.O > score.X ? 'O' : null;
  if (!lead) return null;
  const t = other(lead);
  if (score[t] + seatWaiting(who, t) + free < score[lead]) return { winner: lead, why: 'decided' };   // the side behind can no longer catch up
  return null;
}
export function create(type, rng) {
  const c = Object.assign({}, SEAT, tuneLive(type)), r = needRng(rng);
  const n = Math.max(2, Math.round(c.tables)) * 2, k = Math.max(2, Math.round(c.colors));
  const color = Array.from({ length: n }, () => randInt(r, k));
  const who = new Array(n).fill(null);
  return { type, v: 2, color, who, next: seatNext(who, color, r), score: { X: 0, O: 0 }, last: null };
}
export function apply(mini, p, m, rng, idx) {   // a seat at a free table; then the customer
  if (!Number.isInteger(m) || m < 0 || m >= mini.who.length || mini.who[m] || mini.who[seatMate(m)]) return { ok: false, reason: 'bad' };
  const r = needRng(rng), c = mini.next;
  if (!mini.score) mini.score = { X: 0, O: 0 };                   // (a square dealt before the rework: it plays on from where it is, under these rules)
  mini.who[m] = p;
  const cu = c == null ? { z: null, z2: null, scorer: null, left: true } : seatCustomer(mini.who, mini.color, c, r);
  if (cu.scorer) mini.score[cu.scorer] += 1;
  mini.next = seatNext(mini.who, mini.color, r);
  const end = seatEnd(mini.who, mini.score);
  mini.last = { by: p, seat: m, c, z: cu.z, z2: cu.z2, scorer: cu.scorer, left: cu.left, next: mini.next, score: seatScore(mini), end: end ? end.why : null };
  const counts = seatScore(mini);
  if (!end) return { ok: true, outcome: 'continue', note: cu.scorer ? 'score' : cu.z2 != null ? 'pair' : cu.left ? 'left' : 'seat' };
  if (end.winner === 'draw') return { ok: true, outcome: 'draw', note: 'tie', counts };
  return { ok: true, outcome: 'win', winner: end.winner, note: end.why, counts };
}
export function publicView(mini) {
  return { type: 'seating', v: 2, color: mini.color.slice(), who: mini.who.slice(), next: mini.next, score: seatScore(mini) };
}
export function randomMove(mini, p, rng, from, empties) {
  const ms = seatMoves(mini.who);
  return ms.length ? ms[randInt(needRng(rng), ms.length)] : null;
}
export function canMove(mini) { return seatMoves(mini.who).length > 0; }
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.seat = { by: p, seat: l.seat, c: l.c, z: l.z, z2: l.z2, scorer: l.scorer, left: !!l.left, next: l.next, score: Object.assign({}, l.score) };
}
// The move's moments (ms from the move): the mover sits (`sit`), the customer walks in (`walk`: from the door to
// the seat, or across the room and out), the second customer behind them (`pair`), the score pops (`pop`), the next
// customer steps up to the door (`door`), the end (`end`).
export const SEATT = { sit: 0, walk: 420, walkMs: 900, pair: 260, pop: 1320, popMs: 600, door: 1400, rest: 350 };
export function seatTimes(s) {
  const T = SEATT, landed = T.walk + T.walkMs + (s && s.z2 != null ? T.pair : 0);
  return { sit: T.sit, walk: T.walk, landed, pop: landed, door: landed, end: landed + (s && s.scorer ? T.popMs : 0) + T.rest };
}
export function flashMs(f, winLen, won) { return seatTimes(f.seat).end + (won ? 600 : 0); }
