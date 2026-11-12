// Dice Combo: the rules (pure: no page, no clock; the server runs the same code).
import { DIE_MORE } from '../../core/config.js';
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';

// ---------- Dice Combo (November 2026) ----------
// Each player has their own combo card: three of a kind, four of a kind, full house, small straight, large
// straight, five alike. A move: roll 5 dice up to `rolls` (2, the admin's) times, holding any between rolls (tap a die), then
// claim one combo of their card not claimed yet that the dice make. A move is several actions on the turn (each
// roll keeps it: `again`, as 21's Deal and Hit): 'roll' (the first roll, all five), 'roll:HHHHH' (a roll with the
// dice marked 1 held), 'c:<kind>' (the claim, after any roll). After the last roll with nothing to claim, the move
// ends with nothing claimed. The dice are rolled by the move's rng (the server online). The first to claim `goal`
// (3) combos takes the square. With "Go again on success" on (AGAIN_TUNE), a claim keeps the turn: a fresh move.
// What counts: the dice as they lie; a bigger set counts as a smaller one (five alike is also four and three of a
// kind; four of a kind is also three), a large straight is also a small one; a full house is three of one value
// and two of another (five alike is not a full house). A timeout mid-move claims nothing (the move simply ends:
// the next player's move, or this player's next, starts afresh: `cur` is the mover's move under way).
export const COMBO = { kinds: ['3k', '4k', 'fh', 'ss', 'ls', '5k'], dice: 5, roll: 700 + DIE_MORE, land: 520 + DIE_MORE, stag: 45, hold: 450, claim: 900, stamp: 170 };   // ms: roll, a roll's result on show (its words); land, its last die landing (each one before it `stag` sooner); hold, the dice on show after; claim, a claim's whole time; stamp, from the mark's start to its hit on the card
export const COMBO_NAMES = { '3k': 'Three of a kind', '4k': 'Four of a kind', fh: 'Full house', ss: 'Small straight', ls: 'Large straight', '5k': 'Five alike' };
export const COMBO_SHORT = { '3k': '3 alike', '4k': '4 alike', fh: 'Full house', ss: 'Sm straight', ls: 'Lg straight', '5k': '5 alike' };
export const comboCfg = mini => tune(mini);
// The dice's counts by face: c[1]..c[6].
export function comboCounts(dice) { const c = [0, 0, 0, 0, 0, 0, 0]; for (const d of dice) c[d] += 1; return c; }
// Whether counts make a combo.
export function comboHas(c, kind) {
  const max = Math.max(...c.slice(1)), run = (a, b) => { for (let v = a; v <= b; v++) if (!c[v]) return false; return true; };
  if (kind === '3k') return max >= 3;
  if (kind === '4k') return max >= 4;
  if (kind === '5k') return max >= 5;
  if (kind === 'fh') return c.includes(3) && c.includes(2);
  if (kind === 'ss') return run(1, 4) || run(2, 5) || run(3, 6);
  if (kind === 'ls') return run(1, 5) || run(2, 6);
  return false;
}
// The combos the dice make (all of them, claimed or not), and those p may still claim with them.
export const comboMakes = dice => { const c = comboCounts(dice); return COMBO.kinds.filter(k => comboHas(c, k)); };
export const comboOpen = (mini, p, dice) => comboMakes(dice).filter(k => !mini.claimed[p].includes(k));
export function create(type, rng) {
  return { type, v: 1, claimed: { X: [], O: [] }, cur: null, last: null };   // cur: the move under way { by, dice, rolls }
}
const MASK = /^roll:[01]{5}$/;
export function apply(mini, p, m, rng, idx) {
  const t = tune(mini), max = Math.max(1, t.rolls | 0);
  if (mini.cur && mini.cur.by !== p) mini.cur = null;                // (a move left by a timeout: the other side's starts afresh)
  if (m === 'auto') {                                                // the move ends as it stands: nothing claimed
    const had = mini.cur; mini.cur = null;
    mini.last = { by: p, kind: 'end', dice: had ? had.dice.slice() : [], rolls: had ? had.rolls : 0 };
    return { ok: true, outcome: 'continue', note: 'none' };
  }
  if (m === 'roll' || (typeof m === 'string' && MASK.test(m))) {
    const cur = mini.cur;
    if (m !== 'roll' && (!cur || !cur.rolls)) return { ok: false, reason: 'bad' };   // (holds only between rolls)
    if (m === 'roll' && cur && cur.rolls) return { ok: false, reason: 'bad' };
    if (cur && cur.rolls >= max) return { ok: false, reason: 'bad' };
    const r = needRng(rng), held = m === 'roll' ? [0, 0, 0, 0, 0] : m.slice(5).split('').map(Number);
    if (held.every(Boolean)) return { ok: false, reason: 'bad' };   // (a roll rolls something)
    const from = cur ? cur.dice.slice() : [], dice = held.map((h, i) => (h ? from[i] : 1 + randInt(r, 6)));
    const rolls = (cur ? cur.rolls : 0) + 1;
    mini.cur = { by: p, dice, rolls };
    const open = comboOpen(mini, p, dice);
    mini.last = { by: p, kind: 'roll', from, held, dice: dice.slice(), rolls, open };
    if (rolls >= max && !open.length) { mini.cur = null; mini.last.none = true; return { ok: true, outcome: 'continue', note: 'none' }; }   // nothing to claim: the move ends
    return { ok: true, outcome: 'continue', note: 'roll', again: true };
  }
  if (typeof m === 'string' && m.startsWith('c:')) {
    const kind = m.slice(2), cur = mini.cur;
    if (!cur || !cur.rolls || !COMBO.kinds.includes(kind) || !comboOpen(mini, p, cur.dice).includes(kind)) return { ok: false, reason: 'bad' };
    mini.claimed[p] = mini.claimed[p].concat(kind);
    mini.cur = null;
    mini.last = { by: p, kind: 'claim', combo: kind, dice: cur.dice.slice(), rolls: cur.rolls };
    if (mini.claimed[p].length >= t.goal) return { ok: true, outcome: 'win', note: 'claim' };
    if (goAgain(mini)) return { ok: true, outcome: 'continue', note: 'claim', again: true };   // ("Go again on success" on: a fresh move)
    return { ok: true, outcome: 'continue', note: 'claim' };
  }
  return { ok: false, reason: 'bad' };
}
export function publicView(mini) {
  return { type: 'combo', v: mini.v, claimed: { X: mini.claimed.X.slice(), O: mini.claimed.O.slice() }, cur: mini.cur ? { by: mini.cur.by, dice: mini.cur.dice.slice(), rolls: mini.cur.rolls } : null };
}
// A legal move (the tests, the sandbox): roll; between rolls, hold at random or claim what the dice make.
export function randomMove(mini, p, rng, from, empties) {
  const cur = mini.cur && mini.cur.by === p ? mini.cur : null, max = Math.max(1, tune(mini).rolls | 0);
  if (!cur || !cur.rolls) return 'roll';
  const open = comboOpen(mini, p, cur.dice);
  if (open.length && (cur.rolls >= max || rng() < 0.4)) return 'c:' + open[randInt(rng, open.length)];
  const h = Array.from({ length: 5 }, () => (rng() < 0.4 ? 1 : 0)); if (h.every(Boolean)) h[0] = 0;
  return 'roll:' + h.join('');
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.combo = Object.assign(JSON.parse(JSON.stringify(mini.last)), { claimed: { X: mini.claimed.X.slice(), O: mini.claimed.O.slice() } });
}
// The move's moments: a roll throws the dice not held (the last landing at COMBO.land; `land`: its result on show), then
// holds a moment; a claim rings the dice that make it, then stamps the card (`mark`: the stamp starts; `hit`: it lands).
export function comboTimes(c) {
  if (!c || c.kind === 'end') return { land: 0, end: 300 };
  if (c.kind === 'claim') return { land: 0, mark: 120, hit: 120 + COMBO.stamp, end: COMBO.claim };
  return { land: COMBO.roll, end: COMBO.roll + (c.none ? COMBO.claim : COMBO.hold) };
}
export function flashMs(f, winLen, won) { return comboTimes(f.combo).end + (won ? 600 : 0); }
// A timeout with a move under way (core/board.js timeoutClose): it ends as it stands, nothing claimed ('auto'), so the
// player out of time never comes back to their leftover rolls.
export function timeoutClose(mini, p) { return mini.cur && mini.cur.by === p ? 'auto' : null; }
