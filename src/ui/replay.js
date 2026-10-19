// Opponent replays, one system for every game (CLAUDE.md): a move the other side made (the computer's, the
// other phone's) is shown as they made it. The square as they found it; their inputs pressed and typed in
// turn, from the move's log (core/replay.js: the letters, the pegs, the numbers, the cards, the aim, or just
// the one control that made the move); then the move itself, with its usual animation and result. A run,
// an attempt, a reveal or a round is in the move already (its log or recording): those views play the
// mover's screen from the flash themselves (OWN), so here only the control is pressed, if that. A Skip
// button comes up two seconds into any replay and jumps to the result. The same module logs this phone's
// inputs for the move it is about to send (repNote: the page's click handler, the views' own presses), so
// the other phone can replay them.
// A game's view may add `replay` hooks: `input(act, val, rep)` applies one logged input to its draft (a
// letter typed, a peg placed, a card picked) and returns true when it took it; `synth(move, mini)` gives
// the computer's inputs for a move when a press on the move's control is not the whole story.
import { REP, repNorm, repOf } from '../core/replay.js';
import { ATT_TYPES } from '../games/shared/attention.js';
import { FINGER_TYPES } from '../games/shared/finger.js';
import { RUN_TYPES } from '../games/shared/runner.js';
import { viewOf } from '../games/index.js';
import { SND } from '../audio/sound.js';
import { app, state } from './app.js';
import { animMs, fx, fxAt } from './fx.js';
import { render } from './render.js';
import { skipFlash } from './turns.js';

const OWN = new Set([...RUN_TYPES, ...FINGER_TYPES, ...ATT_TYPES, 'echo', 'oddone', 'trivia', 'bullseye', 'pong']);   // their views play the mover's screen from the flash (the run, the attempt, the reveal, the taps, the throw)
const PRESS_SOUND = { key: 'key', bksp: 'key', enter: 'key', mmcol: 'peg', mmslot: 'peg', rlnum: 'peg', rlgrp: 'peg', rlzero: 'peg', 'hc-key': 'key', 'snap-cell': 'mark', bowl: 'mark', hpsel: 'tap' };   // a logged input's own sound as it is pressed here (a move's sounds come with the move)
export let rep = null;     // the opponent's move playing here: { sq, by, type, list, k, at, speed, lead, stage: 'inputs' | 'move', onMove, f, timer, pressed, cpu }
let note = null;           // this phone's inputs for the move it is making: { sq, p, moves, list }

// ---- recording: this phone's inputs, for the move they lead to ----
export function repNote(act, val) {
  if (state.screen !== 'mini' || state.zoom == null || rep) return;
  if (!note || note.sq !== state.zoom || note.p !== state.turn || note.moves !== state.moves) note = { sq: state.zoom, p: state.turn, moves: state.moves, list: [] };
  note.list.push([Math.round(performance.now()), act, val == null ? null : String(val).slice(0, 60)]);
  if (note.list.length > REP.max) note.list.shift();
}
// A control's value as the log writes it: the first of its data-m, -k, -c, -n, -g, -i, -v.
export function repVal(el) { for (const k of ['m', 'k', 'c', 'n', 'g', 'i', 'v']) if (el && el.dataset && el.dataset[k] != null) return `${k}=${el.dataset[k]}`; return null; }
// The log for the move going in now (the inputs since the square opened, or since the last move), and a fresh start.
export function repTake() {
  const n = note; note = null;
  if (!n || !n.list.length || n.sq !== state.zoom) return null;
  const t0 = n.list[0][0];
  return repNorm(n.list.map(([t, a, v]) => [t - t0, a, v]));
}

// ---- playback: someone else's move ----
export const repActive = () => !!rep && rep.stage === 'inputs';                      // their inputs are playing: nothing else moves
export const repOn = sq => !!rep && (sq == null || rep.sq === sq);                 // a replay of any kind is on (its Skip button shows)
// The inputs to play before a move: the mover's log, the computer's synthetic one, or one press on the move's control.
function repList(o) {
  if (o.timeout || OWN.has(o.type)) return [];
  const hooks = (viewOf(o.type) || {}).replay || {};
  if (o.list && o.list.length) return o.list;
  if (o.move === undefined) return [];
  if (hooks.synth) { const l = hooks.synth(o.move, o.mini, o); if (l) return l; }
  return [[0, 'move', repOf(o.move)]];
}
// Start: o = { sq, by, type, mini (as the mover found it), move, list, timeout, cpu, speed, lead, onMove }.
// onMove makes the move (the computer's playMove, the record's square and flash) and starts its flash.
export function repStart(o) {
  repStop();
  rep = { sq: o.sq, by: o.by, type: o.type, list: repList(o), k: 0, at: performance.now(), speed: o.speed || 1, lead: o.lead || 0, stage: 'inputs', onMove: o.onMove, f: null, timer: null, pressed: null, cpu: !!o.cpu, start0: null };
  if (!rep.list.length) { repMove(); return; }
  render();
  repArm();
}
function repArm() {
  const r = rep;
  if (!r || r.stage !== 'inputs') return;
  const n = r.list[r.k], last = r.list[r.list.length - 1];
  const due = n ? r.lead + n[0] / r.speed : r.lead + (last[0] + REP.press) / r.speed;   // the next input at its time; after the last, the move once its press has shown
  clearTimeout(r.timer);
  r.timer = setTimeout(repTick, Math.max(0, r.at + due - performance.now()));
}
function repTick() {
  const r = rep;
  if (!r || r.stage !== 'inputs') return;
  r.timer = null;
  const n = r.list[r.k];
  if (n) { r.k++; repApply(r, n[1], n[2] == null ? null : n[2]); repArm(); return; }
  repMove();
}
function repApply(r, act, val) {
  const hooks = (viewOf(r.type) || {}).replay || {};
  r.pressed = { act, val, at: performance.now() };
  let took = false;
  if (hooks.input) took = hooks.input(act, val, r) === true;
  if (!took && PRESS_SOUND[act]) SND.play(PRESS_SOUND[act]);
  render();
}
function repMove() {
  const r = rep;
  if (!r) return;
  r.stage = 'move'; r.pressed = null;
  const fn = r.onMove; r.onMove = null;
  if (fn) fn();
  if (rep !== r) return;                                                          // (the move ended the replay: a refused move, a reset)
  r.f = state.flash || null;
  if (!r.f) { repStop(); return; }
  if (r.speed > 1) repSpeedLoop();
}
// The flash's clock run fast (the Super Chaos recap plays at 2x): the move's event is kept drifting back,
// so everything timed from it (the canvas replays, the animations re-anchored at each render) sees the
// elapsed time multiplied; the animations themselves run at that rate (repRate).
function repSpeedLoop() {
  const r = rep;
  if (!r || r.stage !== 'move' || state.flash !== r.f) return;
  const e = fx.move;
  if (e && e.key === r.f) { if (r.start0 == null) r.start0 = e.at; e.at = r.start0 - (performance.now() - r.start0) * (r.speed - 1); }
  requestAnimationFrame(repSpeedLoop);
}
export const repSpeed = () => (rep && rep.stage === 'move' && state.flash && state.flash === rep.f ? rep.speed : 1);
// Skip: the inputs still to play are dropped and the move made; a move playing out jumps to its result.
export function repSkip() {
  const r = rep;
  if (!r) return;
  if (r.stage === 'inputs') { clearTimeout(r.timer); r.timer = null; repMove(); }
  if (rep && rep.stage === 'move' && state.flash && state.flash === rep.f) skipFlash();
}
export function repStop() {
  if (!rep) return;
  clearTimeout(rep.timer);
  rep = null;
}
// After every render: the control just pressed in the replay shows its press (for the press's moment; a
// redraw inside it shows it again), the Skip button comes up two seconds into the replay.
let pressTimer = null;
export function repMark() {
  clearTimeout(pressTimer); pressTimer = null;
  const r = rep, p = r && r.pressed;
  if (!p) return;
  const left = REP.press / r.speed - (performance.now() - p.at);
  if (left <= 0) return;
  const el = [...app.querySelectorAll(`[data-act="${p.act}"]`)].find(e => p.val == null || repVal(e) === p.val);
  if (!el) return;
  el.classList.add('rpress');
  pressTimer = setTimeout(() => el.classList.remove('rpress'), left);
}
// The animations of a replay played fast: at the replay's rate (after anchorFx has set their time).
export function repRate() {
  const s = repSpeed();
  if (s === 1 || typeof app.getAnimations !== 'function') return;
  for (const a of app.getAnimations({ subtree: true })) if (a.playbackRate !== s) a.playbackRate = s;
}
export function repSkipBtn() {
  if (!rep || rep.sq !== state.zoom) return '';
  const at = rep.stage === 'move' && rep.f ? fxAt('move', rep.f) : rep.at;
  if (rep.stage === 'move' && rep.f && at != null && performance.now() - at >= animMs(rep.f) / rep.speed) return '';   // the result is up: nothing left to skip
  return `<button class="rskip" data-act="rep-skip" data-fx="${rep.at}" aria-label="Skip the replay">Skip</button>`;
}
