// The haptics of play (net/platform.js haptic, Settings' Vibration): which buzz each moment gets, from the event its
// sound and animation come from, once (playFlash for a move, stampFx for a claim, toWin for the match's end, turnAlert
// for the turn; a refused move with its error sound, audio/sound.js). Only what this player did or what it cost them:
// the other side's moves (their replays, the computer's) never buzz; a square they take does, on the board.
//   a move made here: a light tap as it plays; its result landing (a die, a spin, a hit, a bump: medium) or going wrong
//   (a bust, a crash: the error pattern) at its sound's moment; the mini-game won: success (lost by the move: error).
import { haptic } from '../net/platform.js';
import { state } from './app.js';

// The sounds that stand for a result landing, and for one going wrong (the games' view.js sounds, ui/physics.js,
// ui/runner.js ...). The rest (the rolling, the ticks, the bounces on the way) are the move's motion: no buzz.
export const RESULT_SOUNDS = new Set(['thunk', 'thud', 'ballDrop', 'clink', 'knock', 'boom', 'sink', 'dartHit', 'strike', 'ding', 'point', 'bank', 'boing', 'solve', 'pair', 'sparkle', 'diceWin', 'plop', 'splash']);
export const BAD_SOUNDS = new Set(['bust', 'crash', 'diceLose', 'buzz', 'dartMiss']);
const WON_GAP_MS = 250;                                              // (a result this close to the win: the win's buzz alone)

// This phone's side: online, the player's; against the computer, the person's; on one phone shared by two (or the
// computer against itself), none: every move made here is the person holding it.
export function mySide() {
  if (state.online) return state.online.me || null;
  return typeof state.cpu === 'string' && state.cpu.length === 1 ? (state.cpu === 'X' ? 'O' : 'X') : null;
}
export function ownMove(f) {
  if (!f || f.timeout) return false;                                 // (a missed turn: nothing was done here)
  if (state.online) return !!state.online.me && f.by === state.online.me;
  if (typeof state.cpu === 'string' && state.cpu.length > 1) return false;   // (the computer against itself)
  const me = mySide();
  return !me || f.by === me;
}
// A move's buzzes from its sounds ([name, ms] from audio/sound.js moveSounds), at their moments (ms / rate): the tap at
// once, the result's at its sound (the last one that is a result: what it came to), the mini-game's end with its chime.
export function movePlan(f, sounds) {
  const out = [['tap', 0]], me = mySide();
  let res = null, bad = null, won = null;
  for (const [n, ms] of sounds) {
    if (n === 'won') won = ms;
    else if (BAD_SOUNDS.has(n)) bad = bad == null ? ms : bad;
    else if (RESULT_SOUNDS.has(n)) res = ms;
  }
  const end = bad != null ? ['error', bad] : res != null ? ['medium', res] : null;
  const winKind = !me || f.winner == null || f.winner === me ? 'success' : 'error';   // (a move that hands the square over: lost)
  if (end && !(won != null && Math.abs(won - end[1]) < WON_GAP_MS) && end[1] > 0) out.push(end);
  else if (end && end[1] === 0 && won == null) out[0] = end;          // (a result at once: its buzz instead of the tap)
  if (won != null) out.push([winKind, won]);
  return out;
}
let timers = [];
export function moveHaptics(f, sounds, rate) {
  if (!ownMove(f)) return;
  cutHaptics();
  for (const [kind, ms] of movePlan(f, sounds)) {
    const at = ms / (rate || 1);
    if (at <= 0) haptic(kind); else timers.push(setTimeout(() => haptic(kind), at));
  }
}
// A move finished early by a tap (its sounds cut): its buzzes still to come go too.
export function cutHaptics() { for (const t of timers) clearTimeout(t); timers = []; }
// A square stamped on the board: claimed (medium), or lost to the other side (the error pattern).
export function claimHaptic(owner) {
  const me = mySide();
  haptic(me && owner && owner !== me ? 'error' : 'medium');
}
