// Craps: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';

// ---------- Craps, Takeover and Flood ----------
// Craps: each player has their own count of rounds won; first to 3 takes the square. A move is one tap of
// Roll: the dice keep rolling until the round is won or lost, all rolled where the move is made (the server
// online: no roll is known before it lands). The come-out roll wins on 7 or 11 and loses on 2, 3 or 12
// (craps); anything else is the point, and then the point wins and a 7 loses. A lost round takes nothing
// away; every move starts a fresh round (a square from before with a point still on rolls that one out).
// The page plays the rolls back one by one (the dice tumbling, the puck going on the point).
export const CRAPS = { goal: 3, roll: 900, quick: 560, quickAfter: 4, puck: 420, hold: 800, stop: 600, land: 560, flash: 250, pip: 400, winOdds: 244 / 495 };   // a round's flash: roll each roll (quick after the first few), the puck, the result held; land: a die's tumble (stop, flash: single rolls, from before); pip: a won round's pip filling in
export const CRAPS_MAKE = { 4: 1 / 3, 5: 0.4, 6: 5 / 11, 8: 5 / 11, 9: 0.4, 10: 1 / 3 };   // the chance a point is rolled before a 7
// A round rolled out: from the come-out, or from a point already on (from).
export function crapsRound(rng, from) {
  const rolls = [];
  let point = from == null ? null : from, result = null;
  while (!result) {
    const d = [1 + randInt(rng, 6), 1 + randInt(rng, 6)], s = d[0] + d[1];
    rolls.push(d);
    if (point == null) {
      if (s === 7 || s === 11) result = 'win';
      else if (s === 2 || s === 3 || s === 12) result = 'lose';
      else point = s;
    } else if (s === point) result = 'win';
    else if (s === 7) result = 'lose';
  }
  return { rolls, point, result };
}
// When each roll of a round lands (ms into the move), when the puck goes on, and when the round's result
// shows. was: a point already on before the first roll (a square from before): the puck is on from the start.
export function crapsTimes(rolls, point, was) {
  const at = [];
  let t = 0, puck = null;
  for (let k = 0; k < rolls.length; k++) {
    at.push(t); t += k < CRAPS.quickAfter ? CRAPS.roll : CRAPS.quick;
    if (k === 0 && point != null && was == null) { puck = at[0] + CRAPS.land; t += CRAPS.puck; }
  }
  return { at, puck, end: t };
}
export function create(type, rng) {
  return { type, wins: { X: 0, O: 0 }, rounds: { X: 0, O: 0 }, point: null, live: null, rolls: [], last: null };   // point, live, rolls: a round left with its point on (from before); every move now rolls a round out
}
export function apply(mini, p, m, rng, idx) {   // Roll: the round, rolled out
  if (m !== 'roll' && m !== 'auto') return { ok: false, reason: 'bad' };
  const was = mini.point == null ? null : mini.point, r = crapsRound(needRng(rng), was);
  mini.rounds[p] += 1; if (r.result === 'win') mini.wins[p] += 1;
  mini.last = { by: p, kind: 'round', rolls: r.rolls.map(d => d.slice()), point: r.point, was, result: r.result };
  mini.point = null; mini.live = null; mini.rolls = [];
  if (mini.wins[p] >= CRAPS.goal) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: r.result === 'win' ? 'won' : 'lost' };
}
export function publicView(mini) {
  return { type: 'craps', wins: { X: mini.wins.X, O: mini.wins.O }, point: mini.point == null ? null : mini.point, live: mini.live || null };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'roll';                                          // a timed-out turn rolls its round out
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.craps = { kind: 'round', rolls: l.rolls.map(d => d.slice()), point: l.point, was: l.was, result: l.result, wins: { X: mini.wins.X, O: mini.wins.O } }; return;
}
export function flashMs(f, winLen, won) {
  if (!f.craps) return CRAPS.roll + CRAPS.hold;
  if (f.craps.roll) return CRAPS.land + CRAPS.flash + (won ? 600 : 0);   // (a single roll, from before)
  return crapsTimes(f.craps.rolls, f.craps.point, f.craps.was).end + (f.craps.result === 'win' ? CRAPS.pip : 0) + (won ? 600 : 0);   // the round, roll by roll (a round won: its pip filling in); the result then stays up its usual moment
}
// Super Chaos: each player's round is rolled out within their own move, so nothing carries over: the
// usual merge (each player's wins and rounds) is all there is.
