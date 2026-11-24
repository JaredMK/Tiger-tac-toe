// Pig: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own bank. A turn: roll the die as often as you like, each roll's number into this turn's pot
// (`mini.turn`, the turn held: `again`), then Bank (the pot onto the bank; the turn ends). The bust number (1) loses
// the pot and ends the turn; the bank is never touched. First bank at the target takes the square. With a roll limit
// (the admin's, none by default) the roll after the last is refused: only Bank is left; so too once the pot would win.
import { DIE_MORE } from '../../core/config.js';
import { needRng, randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';

export function piggyCfg(mini) {
  const t = tune(mini), sides = Number(t.sides) === 8 ? 8 : 6;
  return { target: t.target || 25, bust: Math.min(sides, t.bust || 1), max: t.maxRolls || 0, sides, aiBank: t.aiBank || 9, aiBankEasy: t.aiBankEasy || 6 };
}
export function create(type, rng) { return { type, bank: { X: 0, O: 0 }, turn: null, last: null }; }   // turn: { by, pot, n } while a turn is under way
export function apply(mini, p, m, rng, idx) {
  if (m !== 'roll' && m !== 'bank') return { ok: false, reason: 'bad' };
  const c = piggyCfg(mini), t = mini.turn;
  if (t && t.by !== p) return { ok: false, reason: 'busy' };
  if (m === 'bank') {
    if (!t || !t.pot) return { ok: false, reason: 'nopot' };
    mini.bank[p] += t.pot;
    mini.last = { by: p, kind: 'bank', pot: t.pot, roll: t.roll, n: t.n };
    mini.turn = null;
    return { ok: true, outcome: mini.bank[p] >= c.target ? 'win' : 'continue', note: 'bank' };
  }
  if (t && c.max && t.n >= c.max) return { ok: false, reason: 'maxrolls' };
  if (t && mini.bank[p] + t.pot >= c.target) return { ok: false, reason: 'enough' };   // enough to win: only Bank is left
  const n = 1 + randInt(needRng(rng), c.sides), k = (t ? t.n : 0) + 1;
  if (n === c.bust) {
    mini.last = { by: p, kind: 'bust', roll: n, pot: t ? t.pot : 0, n: k };
    mini.turn = null;
    return { ok: true, outcome: 'continue', note: 'bust' };
  }
  mini.turn = { by: p, pot: (t ? t.pot : 0) + n, n: k, roll: n };
  mini.last = { by: p, kind: 'roll', roll: n, pot: mini.turn.pot, n: k };
  return { ok: true, outcome: 'continue', note: 'roll', again: true };
}
// Out of time with points in the pot: they are banked (no choice made for the player); none: nothing.
export function timeoutClose(mini, p) { return mini.turn && mini.turn.by === p && mini.turn.pot ? 'bank' : null; }
export function publicView(mini) {
  return { type: 'piggy', bank: { X: mini.bank.X, O: mini.bank.O }, turn: mini.turn ? Object.assign({}, mini.turn) : null, last: mini.last ? Object.assign({}, mini.last) : null };
}
export function randomMove(mini, p, rng, from, empties) { return mini.turn && mini.turn.by === p && mini.turn.pot ? 'bank' : 'roll'; }
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.pg = { roll: l.roll, pot: l.pot, n: l.n, bank: mini.bank[p] };
}
export function flashMs(f, winLen, won) { return f.note === 'bank' ? 1000 : (f.note === 'bust' ? 1350 : 1050) + DIE_MORE; }
