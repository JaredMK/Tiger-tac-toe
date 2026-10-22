// Bump: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { PLAY } from '../../core/timer.js';
import { tuneLive } from '../../core/tune.js';
import { other } from '../../core/util.js';

// Bump: 9 spaces between Home and the Finish (10); a spin moves 1, 2 or 3.
export const BUMP = { n: 9, max: 3 };
export const BUMP_KNOCK = { lead: 450, hold: 900 };   // Super Chaos's round end: a moment on both pieces where they landed, the knock, then held
export function create(type, rng) {
  const s = tuneLive(type).start;                                 // (the admin's setting: both pieces' first space)
  return { type, pos: { X: s, O: s }, last: null };   // 0 is Home, 10 the Finish
}
export function apply(mini, p, m, rng, idx) {
  // One spin of 1, 2 or 3: the piece hops that far. Landing exactly on the other piece sends it
  // back Home. Reaching or passing the Finish wins.
  if (m !== 'spin') return { ok: false, reason: 'bad' };
  const spin = 1 + randInt(needRng(rng), BUMP.max), from = mini.pos[p], fin = BUMP.n + 1, to = Math.min(from + spin, fin), o = other(p);
  const bumped = to < fin && mini.pos[o] === to;
  if (bumped) mini.pos[o] = 0;
  mini.pos[p] = to; mini.last = { by: p, spin, from, to, bumped };
  if (to >= fin) return { ok: true, outcome: 'win' };
  return { ok: true, outcome: 'continue', note: bumped ? 'bump' : 'spin' };
}
export function publicView(mini) {
  return { type: 'bump', pos: { X: mini.pos.X, O: mini.pos.O } };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'spin';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  if (mini.last.locked) { flash.locked = true; return; }          // (Super Chaos: the spin locked in, drawn at the round's end)
  flash.spin = mini.last.spin; flash.from = mini.last.from; flash.to = mini.last.to; flash.bumped = mini.last.bumped; return;
}
export function flashMs(f, winLen, won) {
  if (f.locked) return 500;                                       // Super Chaos: a spin locked in (it plays at the round's end)
  if (f.scr) return bumpLead(f.scr) + bumpHops(f.scr) * PLAY.hop + (f.scr.knocked.length ? PLAY.knock : 0) + BUMP_KNOCK.hold + (won ? 600 : 0);   // Super Chaos's round end: the spins, the pieces hopping (both at once when both spun here), then any knock back Home
  return PLAY.spin3 + Math.max(1, f.to - f.from) * PLAY.hop + (f.bumped ? PLAY.knock : 0) + 250;
}
// Super Chaos: a spin is locked in during the round (scApply: the piece stays put and no number is drawn yet),
// because what it does depends on whether the other player spins here too. The round's end settles it
// (scMerge): each spin locked in here is drawn, the pieces move, then the knocks: a piece ending on the other's
// space sends that one Home (only one of them moved here), both ending on the same space send both Home;
// reaching the Finish wins (both at once: the square resets). The spin is the whole move (resolve, whole):
// it plays in the spinner's own square first, both pieces hopping together when both spun here (joint, from
// where the round began), else the one piece with its spin; the other player sees it as their replay.
export const bumpHops = scr => Math.max(0, ...Object.values(scr.moves || {}).map(mv => mv.to - mv.from));
export const bumpLead = scr => (scr.moves && Object.keys(scr.moves).length === 1 ? PLAY.spin3 : BUMP_KNOCK.lead);   // (one spin: the spinner turns first; two: both pieces set off together)
export function scApply(mini, p, m, rng) {
  if (m !== 'spin') return { ok: false, reason: 'bad' };
  if (mini.spun && mini.spun[p]) return { ok: false, reason: 'locked' };
  mini.spun = Object.assign({}, mini.spun, { [p]: true });
  mini.last = { by: p, locked: true };
  return { ok: true, outcome: 'continue', note: 'locked', waits: true };
}
export function scMerge(m, c) {
  const fin = BUMP.n + 1, rng = needRng(c.rng), base = c.base && c.base.pos ? c.base : c.forks[c.played[0]], moves = {}, pos = { X: base.pos.X, O: base.pos.O };   // (the square as the round began; a fork's own if the record has none)
  for (const p of c.played) if (c.forks[p].spun && c.forks[p].spun[p]) { const spin = 1 + randInt(rng, BUMP.max), from = pos[p]; moves[p] = { from, to: Math.min(from + spin, fin), spin }; }
  delete m.spun;
  const who = ['X', 'O'].filter(p => moves[p]);
  if (!who.length) { m.pos = pos; m.last = base.last; return { win: { X: false, O: false } }; }
  const pre = JSON.parse(JSON.stringify(m));
  pre.pos = { X: base.pos.X, O: base.pos.O }; pre.last = base.last;
  for (const p of who) pos[p] = moves[p].to;
  const at = { X: pos.X, O: pos.O }, joint = who.length === 2;
  const met = pos.X === pos.O && pos.X > 0 && pos.X < fin;
  const knocked = !met ? [] : joint ? ['X', 'O'] : [other(who[0])];
  for (const k of knocked) pos[k] = 0;
  m.pos = pos;
  const by = joint ? c.me : who[0], mv = moves[by];
  m.last = Object.assign({ by, spin: mv.spin, from: mv.from, to: mv.to, bumped: knocked.length > 0, moves }, knocked.length ? { knocked, both: knocked.length === 2 } : {});
  const win = { X: !!moves.X && moves.X.to >= fin, O: !!moves.O && moves.O.to >= fin };
  const won = ['X', 'O'].filter(p => win[p]);
  return { win, resolve: { pre, joint, whole: true, flash: Object.assign({ by, scr: { knocked, at, moves } }, won.length === 1 ? { kind: 'claim', winner: won[0] } : {}) } };
}
