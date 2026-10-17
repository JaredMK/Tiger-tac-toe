// Craps: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';

// ---------- Craps, Takeover and Flood ----------
// Craps: each player has their own count of rounds won; first to 3 takes the square. A move is one roll
// of the two dice, rolled where the move is made (the server online: the dice are never known before).
// The come-out roll wins the round on 7 or 11 and loses it on 2, 3 or 12 (craps); anything else is the
// point, and the player chooses: Roll again or Stop. Rolling on, the point wins the round and a 7 loses
// it; anything else, the same choice again. Stop ends the turn with the point still on: whoever next
// plays this square carries on that round (the point wins it for them, a 7 loses it, and they may stop in
// turn). A lost round takes nothing away; after a round the next roll here is a fresh come-out. Stopping
// only hands the point to the other player, never the better choice: the computer always rolls on.
export const CRAPS = { goal: 3, roll: 900, quick: 560, quickAfter: 4, puck: 420, hold: 800, stop: 600, land: 560, flash: 250, winOdds: 244 / 495 };   // land: the dice's tumble; flash: the result, briefly, before Roll again or Stop (roll, quick, puck, hold: a whole round's flash, from before)
export const CRAPS_MAKE = { 4: 1 / 3, 5: 0.4, 6: 5 / 11, 8: 5 / 11, 9: 0.4, 10: 1 / 3 };   // the chance a point is rolled before a 7
export function crapsRound(rng) {
  const rolls = [];
  let point = null, result = null;
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
// When each roll of a round lands (ms into the move), and when the round's result shows.
export function crapsTimes(rolls, point) {
  const at = [];
  let t = 0;
  for (let k = 0; k < rolls.length; k++) { at.push(t); t += k < CRAPS.quickAfter ? CRAPS.roll : CRAPS.quick; if (k === 0 && point != null) t += CRAPS.puck; }
  return { at, end: t };
}
export function create(type, rng) {
  return { type, wins: { X: 0, O: 0 }, rounds: { X: 0, O: 0 }, point: null, live: null, rolls: [], last: null };   // point: the round's point, on; live: the player mid-turn here (just rolled, the point standing); rolls: the round's so far
}
export function apply(mini, p, m, rng, idx) {   // one roll; a point standing: Roll again or Stop
  if (m === 'stop') {                                     // the turn ends; the point stays on for whoever plays here next
    if (mini.live !== p || mini.point == null) return { ok: false, reason: 'nostop' };
    mini.live = null;
    mini.last = { by: p, kind: 'stop', point: mini.point, rolls: mini.rolls.map(d => d.slice()) };
    return { ok: true, outcome: 'continue', note: 'stop' };
  }
  if (m !== 'roll' && m !== 'auto') return { ok: false, reason: 'bad' };
  if (mini.live && mini.live !== p) return { ok: false, reason: 'busy' };
  const r = needRng(rng), d = [1 + randInt(r, 6), 1 + randInt(r, 6)], sum = d[0] + d[1], was = mini.point, inherited = was != null && mini.live !== p;
  const result = was == null ? (sum === 7 || sum === 11 ? 'win' : sum === 2 || sum === 3 || sum === 12 ? 'lose' : 'point') : sum === was ? 'win' : sum === 7 ? 'lose' : 'stay';
  mini.rolls = (was == null ? [] : mini.rolls).concat([d]);
  if (result === 'point') mini.point = sum;
  mini.last = { by: p, kind: 'roll', roll: d, sum, was, point: mini.point, result, inherited, rolls: mini.rolls.map(x => x.slice()) };
  if (result === 'win' || result === 'lose') {             // the round is over: the next roll here is a come-out
    mini.rounds[p] += 1; if (result === 'win') mini.wins[p] += 1;
    mini.point = null; mini.live = null; mini.rolls = [];
    if (mini.wins[p] >= CRAPS.goal) return { ok: true, outcome: 'win', note: 'won' };
    return { ok: true, outcome: 'continue', note: result === 'win' ? 'won' : 'lost' };
  }
  mini.live = p;
  return { ok: true, outcome: 'continue', note: result, again: true };
}
export function publicView(mini) {
  return { type: 'craps', wins: { X: mini.wins.X, O: mini.wins.O }, point: mini.point == null ? null : mini.point, live: mini.live || null };
}
export function randomMove(mini, p, rng, from, empties) {
  return mini.live === p ? 'stop' : 'roll';             // mid-turn: the turn ends (Stop); else a roll
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.craps = Object.assign({ kind: l.kind, rolls: l.rolls.map(d => d.slice()), point: l.point, wins: { X: mini.wins.X, O: mini.wins.O } }, l.kind === 'roll' ? { roll: l.roll.slice(), sum: l.sum, was: l.was, result: l.result, inherited: l.inherited } : {}); return;
}
export function flashMs(f, winLen, won) {
  return !f.craps ? CRAPS.roll + CRAPS.hold : f.craps.kind === 'stop' ? CRAPS.stop : !f.craps.roll ? crapsTimes(f.craps.rolls, f.craps.point).end + CRAPS.hold + (won ? 600 : 0) : CRAPS.land + CRAPS.flash + (won ? 600 : 0);   // one roll: the dice land, the result flashes, and the controls are back (a flash from before: the whole round)
}
// Super Chaos: each player has their own round and point here (no shared continuation): scp and scr keep
// each player's point and rolls, and the square shows its player's own (scFork). Stop keeps the point on for
// that player's next roll.
export function scCreate(type, rng) { return Object.assign(create(type, rng), { scp: { X: null, O: null }, scr: { X: [], O: [] } }); }
export function scFork(mini, p) {
  if (!mini.scp) { mini.scp = { X: null, O: null }; mini.scr = { X: [], O: [] }; }
  mini.point = mini.scp[p] == null ? null : mini.scp[p]; mini.rolls = (mini.scr[p] || []).map(d => d.slice()); mini.live = null;
}
export function scMerge(m, c) {
  m.scp = Object.assign({ X: null, O: null }, c.base.scp); m.scr = JSON.parse(JSON.stringify(c.base.scr || { X: [], O: [] }));
  for (const p of c.played) { const f = c.forks[p]; m.scp[p] = f.point == null ? null : f.point; m.scr[p] = (f.rolls || []).map(d => d.slice()); }
  m.live = null;
}
