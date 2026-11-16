// The guided first match (December 2026, docs/fun-review.md CL-29 to CL-33), kept on the device (KEY + '.onboard'):
// - a first visit (no first match finished on this phone, and an account, if any, with no matches on its record) shows
//   the main menu as one big Play button (ui/screens/menu.js firstMenu) straight into a match: the starter board
//   (STARTER: nine quick, familiar games), the player X and moving first, the computer on Easy (startStarter); guests too;
// - each game's "?" card opens by itself the first time this phone opens that game on its own turn (seenOnce, from
//   ui/input.js zoom), then never again (every mode but Practice and the admin's Test play);
// - three coach bubbles in the board's foot, in the starter match only (coachLine): "tap a square" until a square is
//   opened, then nothing until the first claim, then "three in a row wins" until the next square is opened, then silence.
import { KEY } from './config.js';

const OB_KEY = KEY + '.onboard';
export const STARTER = ['ttt', 'c4', 'coins', 'hilo', 'memory', 'hangman', 'pig', 'snakes', 'bs'];   // the starter board (a fixed list: released, quick, familiar)
const ob = (() => { try { const v = JSON.parse(localStorage.getItem(OB_KEY) || 'null'); if (v && typeof v === 'object') return { done: !!v.done, seen: v.seen && typeof v.seen === 'object' ? v.seen : {}, n: Number(v.n) || 0, speed: !!v.speed, last: v.last || null, quiet: !!v.quiet }; } catch (e) { /* none kept */ } return { done: false, seen: {}, n: 0, speed: false, last: null, quiet: false }; })();
// (quiet: the browser checks and smokes set it, ONBOARD_QUIET below: no first visit, no tips, no offers)
export const ONBOARD_QUIET = JSON.stringify({ done: true, quiet: true, n: 9, speed: true });
const save = () => { try { localStorage.setItem(OB_KEY, JSON.stringify(ob)); } catch (e) { /* no storage: the tips come back next visit */ } };
export const obState = ob;
// A first visit: no first match finished here, and the account (when one is in) has no match on its record.
export function firstVisit(profile) {
  if (ob.done) return false;
  const p = profile || {}, n = r => (r ? (r.wins || 0) + (r.losses || 0) + (r.draws || 0) : 0);
  return n(p) + n(p.friend) === 0;
}
// The first match finished (any result): the normal menu from now on. Counted matches (ob.n) also tell how many this
// phone has finished (the first few keep the computer on Easy after a shut-out: ui/screens/win.js).
export function matchDone(key) {
  if (ob.last === key) return;
  ob.last = key; ob.done = true; ob.n += 1; save();
}
export const matchesDone = () => ob.n;
// The "?" card shown once a game: true the first time (and marks it).
export function seenOnce(t) {
  if (!t || ob.quiet || ob.seen[t]) return false;
  ob.seen[t] = 1; save();
  return true;
}
// The Speed offer (CL-2): once, after the first match.
export const speedOffered = () => ob.speed;
export function markSpeedOffered() { ob.speed = true; save(); }

// The coach (state.guided = { step }): 0 "tap a square" (until one is opened), 1 waiting for the first claim, 2 "three in a
// row wins" (from the first claim until the next square is opened), 3 silence.
export function coachOpen(state) {
  const g = state.guided;
  if (!g) return;
  if (g.step === 0) g.step = 1;
  else if (g.step === 2) g.step = 3;
}
export function coachLine(state, me) {
  const g = state.guided;
  if (!g || state.winner || state.screen !== 'board') return '';
  if (g.step === 1 && state.squares.some(q => q.owner)) g.step = 2;
  if (g.step === 0 && state.turn === me) return '<b>Every square is a mini-game.</b> Tap one to play a move in it.';
  if (g.step === 2) {
    const mine = state.squares.some(q => q.owner === me);
    return mine ? '<b>That square is yours!</b> Claim three in a row to win the match.' : '<b>Square claimed!</b> Three in a row wins the match.';
  }
  return '';
}
