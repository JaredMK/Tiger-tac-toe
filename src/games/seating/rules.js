// Seating: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { other } from '../../core/util.js';
import { PLACE_MS } from '../shared/placement.js';

// ---------- Seating, Districts, Shelves and Roads ----------
// Seating: a restaurant of 10 tables for two; every seat has a colour (one of four). A move seats you in
// any empty seat; then a customer Z walks in and sits in a random empty seat of their colour; with none of
// their colour left (the move took the last one) they walk through and leave. The next customer's colour
// is always shown, and only ever one with an empty seat; where they sit, and the colour of the one after,
// are drawn only as the move is made (by the server online). A table is yours
// with both its seats. Five tables wins at once; else, once every seat is taken, most tables wins and a
// tie resets the square.
export const SEAT = { tables: 10, colors: 4, goal: 5 };
export const seatTable = i => Math.floor(i / 2), seatMate = i => (i % 2 ? i - 1 : i + 1);
export const seatTables = (who, p) => { let n = 0; for (let t = 0; t < SEAT.tables; t++) if (who[2 * t] === p && who[2 * t + 1] === p) n++; return n; };
export function seatZ(mini, rng) {                                       // the customer sits; returns the seat (null when the room is full, -1 when none of their colour is free: they leave)
  const empty = mini.who.map((w, i) => (w ? -1 : i)).filter(i => i >= 0);
  if (!empty.length) return null;
  const theirs = empty.filter(i => mini.color[i] === mini.next);
  if (!theirs.length) return -1;
  const z = theirs[randInt(rng, theirs.length)];
  mini.who[z] = 'Z';
  return z;
}
// The next customer's colour: one of the colours with an empty seat (in colour order, drawn at random).
export function seatNext(mini, rng) { const open = [...new Set(mini.who.map((w, i) => (w ? -1 : mini.color[i])).filter(c => c >= 0))].sort((a, b) => a - b); return open.length ? open[randInt(rng, open.length)] : mini.next; }
// The computer: its own half-table first, then the other player's, then a fresh table whose other seat is
// not the next customer's colour; else any seat.
export function seatPick(pm, me, rng) {
  const o = other(me), who = pm.who, empty = who.map((w, i) => (w ? -1 : i)).filter(i => i >= 0);
  const half = p => empty.filter(i => who[seatMate(i)] === p);
  const mine = half(me); if (mine.length) return { move: mine[randInt(rng, mine.length)], why: 'complete' };
  const theirs = half(o); if (theirs.length) return { move: theirs[randInt(rng, theirs.length)], why: 'block' };
  const fresh = empty.filter(i => !who[seatMate(i)]), safe = fresh.filter(i => pm.color[seatMate(i)] !== pm.next);
  if (safe.length) return { move: safe[randInt(rng, safe.length)], why: 'start' };
  if (fresh.length) return { move: fresh[randInt(rng, fresh.length)], why: 'start' };
  return { move: empty[randInt(rng, empty.length)], why: 'any' };
}
export function create(type, rng) {
  const r = needRng(rng), color = Array.from({ length: SEAT.tables * 2 }, () => randInt(r, SEAT.colors)); return { type, color, who: new Array(SEAT.tables * 2).fill(null), next: color[randInt(r, color.length)], last: null };
}
export function apply(mini, p, m, rng, idx) {   // a seat; then the customer sits; five tables, or most once the room is full
  if (!Number.isInteger(m) || m < 0 || m >= mini.who.length || mini.who[m]) return { ok: false, reason: 'bad' };
  const r = needRng(rng), o = other(p), zColor = mini.next;
  mini.who[m] = p;
  const zs = seatZ(mini, r), left = zs === -1, z = left ? null : zs;
  if (mini.who.includes(null)) mini.next = seatNext(mini, r);
  const done = mini.who[seatMate(m)] === p ? seatTable(m) : null;
  mini.last = { by: p, seat: m, z, zColor, table: done, next: mini.next, left };
  const mt = seatTables(mini.who, p), ot = seatTables(mini.who, o);
  if (mt >= SEAT.goal) return { ok: true, outcome: 'win', note: 'tables', counts: { [p]: mt, [o]: ot } };
  if (mini.who.includes(null)) return { ok: true, outcome: 'continue', note: done != null ? 'table' : 'seat' };
  if (mt === ot) return { ok: true, outcome: 'draw', note: 'tie' };
  return { ok: true, outcome: 'win', note: 'full', winner: mt > ot ? p : o, counts: { [p]: mt, [o]: ot } };
}
export function publicView(mini) {
  return { type: 'seating', color: mini.color.slice(), who: mini.who.slice(), next: mini.next };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.who, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.seat = { seat: l.seat, z: l.z, zColor: l.zColor, table: l.table, next: l.next, left: !!l.left, tables: { X: seatTables(mini.who, 'X'), O: seatTables(mini.who, 'O') } }; return;
}
export function flashMs(f, winLen, won) {
  return PLACE_MS.mark + (f.seat && (f.seat.z != null || f.seat.left) ? PLACE_MS.walk : 0) + PLACE_MS.hold + (won ? 600 : 0);
}
