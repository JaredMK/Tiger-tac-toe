// Ship, Captain & Crew: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';

// ---------- Ship, Captain & Crew (November 2026) ----------
// Each player has their own cargo total; the first to tune(mini).target takes the square. A move is a turn of up
// to tune(mini).rolls rolls of the dice (five to begin with). After every roll the dice set themselves aside, in
// order and only in order: a 6 (the ship) first, then a 5 (the captain), then a 4 (the crew). One roll can give
// more than one at once (a 6, a 5 and a 4 in the same roll set aside all three), but a 5 counts only once the ship
// is in and a 4 only once the captain is. The dice set aside are not rolled again. With all three in, the other
// two dice are the cargo: their total is what the turn scores. Then the player may Keep (the cargo scores and the
// turn ends) or roll the two cargo dice again with the rolls left (the new cargo replaces the old). After the last
// roll the turn ends by itself and scores the cargo as it lies; without all three by then it scores 0.
// The rolls are made where the move is made (the server online: nothing is known before it lands). A roll that
// leaves the turn going holds it to the square (`again`, as 21's Deal and Hit); with "Go again on success" on, a
// turn that scores keeps the turn too (a fresh turn of the same player).
// A timeout mid-turn ends it as it stands (core/board.js timeoutClose, this file's timeoutClose: 'keep'): the
// cargo scores if all three are in, else 0.
export const SCC = { target: 22, rolls: 3, dice: 5, land: 650, stag: 45, gap: 380, take: 300, fly: 280, shown: 200, beat: 320, score: 550, hold: 450 };   // the move's moments (ms): land, the last die of a roll landing (each one before it `stag` sooner); gap, from there to the first die set aside reaching its place, and take, to each one after it (fly: its flight); shown, from the last of them to the cargo showing; beat, a last roll's cargo on show before it scores; score, the cargo counting into the total; hold, the result on show
export const SCC_NEED = [6, 5, 4];                             // the ship, the captain, the crew: in this order
export const sccCfg = mini => { const t = tune(mini); return { target: t.target || SCC.target, rolls: t.rolls || SCC.rolls }; };
// One roll from a level (0: nothing in, 1: the ship, 2: and the captain, 3: and the crew: the cargo rolled):
// the dice rolled (values), which of them were set aside (indexes into rolled, in order: ship, captain, crew),
// the new level and the cargo (the two dice left, once all three are in). Pure: the values come in.
export function sccTake(lv, rolled) {
  const took = [];
  let L = lv;
  if (L >= 3) return { took, lv: 3, cargo: rolled.slice(0, 2) };
  for (let k = L; k < 3; k++) {
    const i = rolled.findIndex((v, j) => v === SCC_NEED[k] && !took.includes(j));
    if (i < 0) break;
    took.push(i); L = k + 1;
  }
  const rest = rolled.filter((v, j) => !took.includes(j));
  return { took, lv: L, cargo: L >= 3 ? rest.slice(0, 2) : null, rest };
}
export const sccDiceFor = lv => (lv >= 3 ? 2 : SCC.dice - lv);   // dice rolled from a level
export const sccSum = c => (c ? c[0] + c[1] : 0);
export function create(type, rng) {
  return { type, v: 1, score: { X: 0, O: 0 }, turns: { X: 0, O: 0 }, turn: null, last: null };   // turn: the turn in progress { by, n: rolls made, lv, dice: the dice on the table (not set aside), cargo }
}
function endTurn(mini, p, pts, how) {
  const t = mini.turn, c = sccCfg(mini), from = mini.score[p];
  mini.score[p] = Math.min(c.target, from + pts);
  mini.turns[p] += 1;
  mini.turn = null;
  const won = mini.score[p] >= c.target;
  return { pts, from, won, how, lv: t ? t.lv : 0 };
}
export function apply(mini, p, m, rng, idx) {
  if (m !== 'roll' && m !== 'keep' && m !== 'stop') return { ok: false, reason: 'bad' };   // (stop: the turn ends as it stands, the timeout's move: core/board.js timeoutClose)
  const c = sccCfg(mini);
  if (mini.turn && mini.turn.by !== p) return { ok: false, reason: 'busy' };   // (the other side's turn under way: a timeout ends it first, core/board.js timeoutClose)
  const t = mini.turn;
  if (m === 'keep' || m === 'stop') {
    if (!t || (m === 'keep' && t.lv < 3)) return { ok: false, reason: t ? 'nocrew' : 'bad' };
    const pts = t.lv >= 3 ? sccSum(t.cargo) : 0, cargo = t.cargo ? t.cargo.slice() : null, n = t.n, lv = t.lv;
    const e = endTurn(mini, p, pts, 'keep');
    mini.last = { by: p, kind: 'keep', n, lv, cargo, pts, from: e.from, stop: m === 'stop' };
    return result(mini, p, e);
  }
  if (t && t.n >= c.rolls) return { ok: false, reason: 'norolls' };
  const lv0 = t ? t.lv : 0, n = (t ? t.n : 0) + 1, r = needRng(rng);
  const rolled = Array.from({ length: sccDiceFor(lv0) }, () => 1 + randInt(r, 6));
  const tk = sccTake(lv0, rolled);
  mini.turn = { by: p, n, lv: tk.lv, dice: tk.lv >= 3 ? tk.cargo.slice() : tk.rest.slice(), cargo: tk.cargo ? tk.cargo.slice() : null };
  const base = { by: p, kind: 'roll', n, lv0, lv: tk.lv, rolled, took: tk.took, cargo: tk.cargo ? tk.cargo.slice() : null };
  if (n >= c.rolls) {                                              // the last roll: the turn ends as it lies
    const pts = tk.lv >= 3 ? sccSum(tk.cargo) : 0;
    const e = endTurn(mini, p, pts, tk.lv >= 3 ? 'last' : 'sunk');
    mini.last = Object.assign(base, { end: true, pts, from: e.from });
    return result(mini, p, e);
  }
  mini.last = Object.assign(base, { end: false });
  return { ok: true, outcome: 'continue', note: tk.lv > lv0 ? (tk.lv >= 3 ? 'crew' : 'aside') : 'roll', again: true };
}
function result(mini, p, e) {
  if (e.won) return { ok: true, outcome: 'win', note: 'cargo' };
  const note = e.pts > 0 ? 'cargo' : 'sunk';
  if (e.pts > 0 && goAgain(mini)) return { ok: true, outcome: 'continue', note, again: true };   // ("Go again on success" on: a turn that scores keeps the turn)
  return { ok: true, outcome: 'continue', note };
}
// A move under way when the time runs out (core/board.js timeoutClose): the turn ends as it stands.
export function timeoutClose(mini, p) {
  const t = mini.turn;
  if (!t || t.by !== p) return null;
  return 'stop';
}
export function publicView(mini) {
  const t = mini.turn;
  return { type: 'scc', v: mini.v || 1, score: { X: mini.score.X, O: mini.score.O }, turns: { X: mini.turns.X, O: mini.turns.O }, turn: t ? { by: t.by, n: t.n, lv: t.lv, dice: t.dice.slice(), cargo: t.cargo ? t.cargo.slice() : null } : null, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
}
export function randomMove(mini, p, rng, from, empties) {
  const t = mini.turn && mini.turn.by === p ? mini.turn : null;
  if (t && t.lv >= 3 && (t.n >= sccCfg(mini).rolls || rng() < 0.5)) return 'keep';
  return 'roll';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.scc = Object.assign(JSON.parse(JSON.stringify(l)), { score: { X: mini.score.X, O: mini.score.O }, target: sccCfg(mini).target, rolls: sccCfg(mini).rolls });
}
// The move's moments (ms from the move): the dice land; each die set aside reaches its place on the deck, one after
// another (`aside`, then every `take`); the cargo shows (`cargo`); a turn's end: the cargo leaves for the total
// (`score`), reaches it and counts in (`count`: at once when there is nothing to carry).
export function sccTimes(s) {
  const roll = s && s.kind === 'roll', land = roll ? SCC.land : 0;
  const took = roll ? s.took.length : 0, aside = took ? land + SCC.gap : land;
  const cargo = took ? aside + (took - 1) * SCC.take + SCC.shown : land;
  const ends = !!(s && (s.kind === 'keep' || s.end));
  const score = ends ? cargo + (roll ? SCC.beat : 0) : null, count = ends ? score + (s.pts > 0 ? SCC.fly : 0) : null;
  return { land, aside, cargo, score, count, end: (ends ? count + SCC.score : cargo) + SCC.hold };
}
export function flashMs(f, winLen, won) {
  return sccTimes(f.scc).end + (won ? 600 : 0);
}
