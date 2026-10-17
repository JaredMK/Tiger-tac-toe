// Risky Rolls: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';

export const RISKY = { goal: 21, maxRolls: 6 };
export function create(type, rng) {
  return { type, bank: { X: 0, O: 0 }, turn: null, last: null };   // turn = the push-your-luck turn in progress
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
    if (mini.bank[p] >= RISKY.goal) return { ok: true, outcome: 'win', note: 'bank' };   // a winning bank is still a bank: the phones show it as one
    return { ok: true, outcome: 'continue', note: 'bank' };
  }
  if (t && t.rolls.length >= RISKY.maxRolls) return { ok: false, reason: 'maxrolls' };   // a seventh roll can only bust
  if (t && mini.bank[p] + t.pot >= RISKY.goal) return { ok: false, reason: 'enough' };   // enough to win: only Bank is left
  const n = 1 + randInt(needRng(rng), 6);
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
  return { type: 'pig', bank: { X: mini.bank.X, O: mini.bank.O }, turn: mini.turn ? { by: mini.turn.by, rolls: mini.turn.rolls.slice(), pot: mini.turn.pot } : null };
}
export function randomMove(mini, p, rng, from, empties) {
  return mini.turn && mini.turn.by === p && mini.turn.pot ? 'bank' : 'roll';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.roll = mini.last.roll; flash.pot = mini.last.pot; flash.rolls = mini.last.rolls; flash.bank = mini.bank[p]; return;
}
export function flashMs(f, winLen, won) {
  return f.note === 'bank' ? 1000 : f.note === 'bust' ? 1350 : 1050;
}
