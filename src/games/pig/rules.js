// Risky Rolls: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { PIG_DEFAULTS } from './meta.js';

export const RISKY = { goal: 21, maxRolls: 6 };   // a square from before the die and the target were settings: a d6 to 21
// The die (6 or 8 sides) and the target: the admin's config/pig, copied into each square as it is dealt (the
// page and the server alike), so a square plays to the end by the values it was dealt with.
export const PIG_LIMITS = { sides: [6, 8], target: [10, 200] };
export const PIG_CFG = { cfg: null };
export function pigNorm(raw) {
  const s = raw && raw.sides != null ? Number(raw.sides) : NaN, t = raw && raw.target != null ? Number(raw.target) : NaN;
  return { sides: s === 6 || s === 8 ? s : PIG_DEFAULTS.sides, target: Number.isFinite(t) && t >= PIG_LIMITS.target[0] && t <= PIG_LIMITS.target[1] ? Math.round(t) : PIG_DEFAULTS.target };
}
export function setPigConfig(raw) { PIG_CFG.cfg = raw && typeof raw === 'object' ? pigNorm(raw) : null; }
export const pigConfig = () => Object.assign({}, PIG_CFG.cfg || PIG_DEFAULTS);
export const pigSides = mini => (mini && (mini.sides === 6 || mini.sides === 8) ? mini.sides : 6);
export const pigGoal = mini => (mini && Number.isInteger(mini.target) ? mini.target : RISKY.goal);
export const pigMaxRolls = mini => pigSides(mini);   // every number once: the next roll can only bust
export function create(type, rng) {
  const c = pigConfig(); return { type, bank: { X: 0, O: 0 }, turn: null, last: null, sides: c.sides, target: c.target };   // turn = the push-your-luck turn in progress
}
export function apply(mini, p, m, rng, idx) {
  // One move is a whole push-your-luck turn: every successful roll hands the same player the
  // next choice (again), and only a bank or a bust ends the move.
  if (m !== 'roll' && m !== 'bank') return { ok: false, reason: 'bad' };
  const t = mini.turn;
  if (t && t.by !== p) return { ok: false, reason: 'busy' };
  if (m === 'bank') {
    if (!t || !t.pot) return { ok: false, reason: 'nopot' };
    mini.bank[p] += t.pot;
    mini.last = { by: p, kind: 'bank', pot: t.pot, rolls: t.rolls, roll: t.rolls[t.rolls.length - 1] };
    mini.turn = null;
    if (mini.bank[p] >= pigGoal(mini)) return { ok: true, outcome: 'win', note: 'bank' };   // a winning bank is still a bank: the phones show it as one
    return { ok: true, outcome: 'continue', note: 'bank' };
  }
  if (t && t.rolls.length >= pigMaxRolls(mini)) return { ok: false, reason: 'maxrolls' };   // a roll after every number has come up can only bust
  if (t && mini.bank[p] + t.pot >= pigGoal(mini)) return { ok: false, reason: 'enough' };   // enough to win: only Bank is left
  const n = 1 + randInt(needRng(rng), pigSides(mini));
  if (t && t.rolls.includes(n)) {
    mini.last = { by: p, kind: 'bust', roll: n, rolls: t.rolls.concat(n), pot: t.pot };   // the pot is lost, the bank is not
    mini.turn = null;
    return { ok: true, outcome: 'continue', note: 'bust' };
  }
  const rolls = (t ? t.rolls : []).concat(n), pot = (t ? t.pot : 0) + n;
  mini.turn = { by: p, rolls, pot };
  mini.last = { by: p, kind: 'roll', roll: n, rolls, pot };
  return { ok: true, outcome: 'continue', note: 'roll', again: true };
}
export function publicView(mini) {
  return { type: 'pig', bank: { X: mini.bank.X, O: mini.bank.O }, turn: mini.turn ? { by: mini.turn.by, rolls: mini.turn.rolls.slice(), pot: mini.turn.pot } : null, sides: pigSides(mini), target: pigGoal(mini) };
}
export function randomMove(mini, p, rng, from, empties) {
  return mini.turn && mini.turn.by === p && mini.turn.pot ? 'bank' : 'roll';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.sides = pigSides(mini);
  flash.roll = mini.last.roll; flash.pot = mini.last.pot; flash.rolls = mini.last.rolls; flash.bank = mini.bank[p]; return;
}
export function flashMs(f, winLen, won) {
  return f.note === 'bank' ? 1000 : f.note === 'bust' ? 1350 : 1050;
}
