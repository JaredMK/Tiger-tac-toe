// Seating: the computer's play (reworked November 2026 with the rules).
import { randInt } from '../../core/random.js';
import { other } from '../../core/util.js';
import { seatCfg, seatCustomer, seatEnd, seatFree, seatMate, seatMoves, seatNext, seatScore, seatWaiting } from './rules.js';

// What a seat is worth now: the next customer's colour is known, so for each seat the computer could take, the chance
// that customer sits across from it (+1) less the chance they sit across from the other side's waiting seat (-1), every
// empty seat of their colour as likely. (A waiting seat's later chances do not depend on its colour: a customer's colour
// is drawn from the empty seats, so each empty seat is as likely as any to be the one taken, 1 in the seats left.)
export function seatNow(pm, me, i) {
  const o = other(me), who = pm.who, c = pm.next;
  if (c == null) return 0;
  let n = 0, mine = 0, theirs = 0;
  for (let z = 0; z < who.length; z++) {
    if (z === i || who[z] || pm.color[z] !== c) continue;
    n++;
    const mate = z === seatMate(i) ? me : who[seatMate(z)];
    if (mate === me) mine++; else if (mate === o) theirs++;
  }
  return n ? (mine - theirs) / n : 0;
}
// Seats alike for the choice: the same colour and the same colour across (one of each kind is weighed for all).
const kindOf = (pm, i) => pm.color[i] * 16 + pm.color[seatMate(i)];
// Normal: the seat worth most now (between equals, at random).
export function seatPick(pm, me, rng) {
  const ms = seatMoves(pm.who);
  let best = [], bv = -Infinity;
  for (const i of ms) { const v = seatNow(pm, me, i); if (v > bv + 1e-9) { bv = v; best = [i]; } else if (Math.abs(v - bv) <= 1e-9) best.push(i); }
  return { move: best[randInt(rng, best.length)], v: bv };
}
// Hard: two plies weighed exactly (nothing hidden is used: the colours and seats are all public, the customers' choices
// and the next colour taken at their odds). For each kind of seat: every seat the customer could take, then every colour
// the next customer could be, then the other side's best seat by Normal's measure (its chance of scoring now, less the
// chance it hands the computer one); the position then valued by the score and the seats left waiting, each worth its
// chance of a customer before the end (about the customers still to come over the empty seats, the same for every seat
// whatever its colour).
export const SEAT_AI = { wait: 1 };
function waitWorth(who) {
  const empty = who.filter(w => !w).length, free = seatFree(who).length;
  return empty ? Math.min(1, (free / 1.35) / empty) * SEAT_AI.wait : 0;
}
function hard2(pm, me, i) {
  const o = other(me), color = pm.color, who0 = pm.who.slice(); who0[i] = me;
  const zs = pm.next == null ? [] : who0.map((w, z) => (!w && color[z] === pm.next ? z : -1)).filter(z => z >= 0);
  const outcomes = zs.length ? zs.map(z => { const w = who0.slice(), mate = w[seatMate(z)]; w[z] = 'Z'; let d = 0; if (mate === me) d = 1; else if (mate === o) d = -1; else w[seatMate(z)] = 'Z'; return { w, d }; }) : [{ w: who0, d: 0 }];
  let total = 0;
  for (const { w, d } of outcomes) {
    const sc = seatScore(pm); if (d > 0) sc[me]++; else if (d < 0) sc[o]++;
    const end = seatEnd(w, sc);
    if (end) { total += end.winner === me ? 4 : end.winner === 'draw' ? 0 : -4; continue; }
    const k = waitWorth(w), base = (sc[me] - sc[o]) + k * (seatWaiting(w, me) - seatWaiting(w, o));
    // the next colour, each empty seat as likely; the other side's reply: its best seat now
    const empty = w.map((x, z) => (x ? -1 : z)).filter(z => z >= 0), byColor = {};
    for (const z of empty) byColor[color[z]] = (byColor[color[z]] || 0) + 1;
    let reply = 0;
    for (const c in byColor) {
      const pos = { who: w, color, next: +c }, ms = seatMoves(w);
      let bestR = 0;
      for (const j of ms) { const r = seatNow(pos, o, j); if (r > bestR) bestR = r; }
      reply += byColor[c] / empty.length * (bestR + k);          // (its new seat waits too)
    }
    total += base - reply;
  }
  return total / outcomes.length;
}
export function seatHard(pm, me, rng) {
  const ms = seatMoves(pm.who), kinds = new Map();
  for (const i of ms) { const k = kindOf(pm, i); if (!kinds.has(k)) kinds.set(k, []); kinds.get(k).push(i); }
  let top = null;
  for (const list of kinds.values()) { const v = hard2(pm, me, list[0]); if (!top || v > top.v + 1e-9) top = { list, v }; }
  return { move: top.list[randInt(rng, top.list.length)], v: top.v };   // (any seat of the kind: alike)
}
// The turns p still needs (for the main board's choice of square): about one of p's moves for every two to three
// tables left (each round takes one, and a customer at an empty table a second), more when behind and fewer ahead,
// counting a waiting seat as half a point.
export function needs(pm, p) {
  const o = other(p), s = seatScore(pm), free = seatFree(pm.who).length;
  const diff = s[p] + 0.5 * seatWaiting(pm.who, p) - s[o] - 0.5 * seatWaiting(pm.who, o);
  const base = Math.max(1, free / 2.7);
  return Math.max(1, diff >= 0 ? base / (1 + 0.35 * diff) : base * (1 + 0.5 * -diff));
}
export function best(pm, me, rng, style, ctx) {
  const cf = seatCfg(pm), ms = seatMoves(pm.who);
  if (!ms.length) return { move: null };
  const lvl = ctx && ctx.level;
  if (lvl === 'easy' || (cf.miss && rng() * 100 < cf.miss)) return { move: ms[randInt(rng, ms.length)] };   // Easy, or the admin's mistake rate: any seat
  const b = lvl === 'hard' ? seatHard(pm, me, rng) : seatPick(pm, me, rng);
  return { move: b.move, q: seatWinNow(pm, me, b.move) };
}
// q: the chance this move ends the square in me's favour (each seat of the customer's colour as likely; the next draw
// changes nothing of the end).
export function seatWinNow(pm, me, i) {
  const who = pm.who.slice(); who[i] = me;
  const zs = pm.next == null ? [] : who.map((w, z) => (!w && pm.color[z] === pm.next ? z : -1)).filter(z => z >= 0);
  const endFor = (w, sc) => { const e = seatEnd(w, sc); return e && e.winner === me ? 1 : 0; };
  if (!zs.length) return endFor(who, seatScore(pm));
  let won = 0;
  for (const z of zs) {
    const w = who.slice(), sc = seatScore(pm), mate = w[seatMate(z)];
    w[z] = 'Z'; if (mate === 'X' || mate === 'O') sc[mate]++; else w[seatMate(z)] = 'Z';
    won += endFor(w, sc);
  }
  return won / zs.length;
}
