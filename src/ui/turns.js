// The turn flow on screen: the computer's turn (think, zoom, play), the result shown and dismissed.
import { endFlash, leaveSquare, playMove } from '../core/board.js';
import { playerName } from '../core/match.js';
import { SND, backSounds, matchEndSound, moveSounds } from '../audio/sound.js';
import { mmIntro } from '../net/matchmaking.js';
import { haptic } from '../net/platform.js';
import { applyPending } from '../net/room.js';
import { ANIM, holdRate, moveRate, replaySpeed, speedMode } from '../core/timer.js';
import {
  CPU_MS, FLASH_MS, FLIP_MS, MEMORY_MS, RNG, app, commit, cpuPlan, cpuTimer, flashReady, flashTimer, holdTimer,
  menuOpen, setCpuPlan, setCpuTimer, setFlashReady, setFlashTimer, setHoldTimer, state
} from './app.js';
import { STAMP_MS } from './board.js';
import { chaosStep } from './chaos.js';
import { explainT } from './explainer.js';
import { animMs, confetti, fx, fxAt, momentPower, shake, stampFx, startFx } from './fx.js';
import { joinAsk } from './input.js';
import { render } from './render.js';
import { rep, repActive, repStart, repStop } from './replay.js';
import { cpuThink } from './think.js';
import { endKind } from './screens/win.js';

/* ----- the computer's turn: a pause to think, a zoom into its square, its choice shown, then the move ----- */
export function cpuTurn() { return !!state.cpu && state.cpu.includes(state.turn) && !state.winner && ['board', 'mini'].includes(state.screen); }   // (on any other screen the match waits)
// Runs after every render: arms the computer's next step whenever it is its turn and nothing else is going on.
let thinking = false;                                          // its move is being worked out (the Hard computer's worker, ui/think.js): no second question meanwhile
export function scheduleCpu() {
  clearTimeout(cpuTimer); setCpuTimer(null);
  chaosStep();                                                   // Super Chaos: the round's own steps (ui/chaos.js)
  if (thinking) return;
  if (!cpuTurn() || state.flash || state.done || state.confirm || menuOpen || explainT || joinAsk || repActive() || mmIntro) return;   // (mmIntro: the side reveal is up; its close asks again)   // (repActive: its inputs are playing; the replay makes the move when they are done)
  if (state.screen === 'board') {                               // its move, worked out while it pauses to think; then its square lit up
    const t0 = performance.now();
    setCpuPlan(null);
    think(plan => { setCpuPlan(plan); setCpuTimer(setTimeout(cpuSpot, Math.max(0, CPU_MS.think - (performance.now() - t0)))); });
    return;
  }
  if (state.screen !== 'mini') return;
  if (cpuPlan && cpuPlan.square === state.zoom && state.spot) return;   // the glow is still showing; cpuZoom takes it from here
  if (!cpuPlan || cpuPlan.square !== state.zoom) {
    think(plan => {
      setCpuPlan(plan); if (!plan) return; plan.stage = 0;        // (no move at all: the admin's test play, its square over)
      if (plan.square !== state.zoom) { state.zoom = plan.square; state.draft = ''; state.pick = null; state.sel = []; commit(); return; }   // after a reload mid-move
      setCpuTimer(setTimeout(cpuAct, state.lock != null ? CPU_MS.again : CPU_MS.zoom));
    });
    return;
  }
  setCpuTimer(setTimeout(cpuAct, cpuPlan.stage ? CPU_MS.pre : state.lock != null ? CPU_MS.again : CPU_MS.zoom));
}
// The computer's choice for the match as it stands (ui/think.js): the answer may come later (the Hard
// computer's worker); by then the match must stand just the same, else it is asked again.
function think(cb) {
  const mark = () => `${state.moves}:${state.turn}:${state.lock}:${state.screen}:${state.zoom}`, at = mark();
  thinking = true;
  cpuThink(state, plan => {
    thinking = false;
    if (mark() !== at || !cpuTurn() || state.flash || state.done || state.confirm || menuOpen || explainT || joinAsk || repActive()) { scheduleCpu(); return; }
    cb(plan);
  });
}
function cpuSpot() {                                           // the computer has chosen: show where, then go there
  setCpuTimer(null);
  if (!cpuTurn() || state.screen !== 'board' || state.confirm || menuOpen) return;
  if (!cpuPlan) { render(); return; }
  cpuPlan.stage = 0;
  state.spot = { square: cpuPlan.square, by: state.turn, label: `${playerName(state, state.turn)} plays here` };
  startFx('spot', state.spot); SND.play('spot');
  render();                                                     // no commit: the glow is not for the saved state
  setCpuTimer(setTimeout(cpuZoom, CPU_MS.spot));
}
function cpuZoom() {
  setCpuTimer(null);
  state.spot = null;
  if (!cpuTurn() || state.screen !== 'board' || state.confirm || menuOpen || !cpuPlan) { render(); return; }
  state.screen = 'mini'; state.zoom = cpuPlan.square; state.draft = ''; state.pick = null; state.sel = []; state.notice = null;
  commit();
}
function cpuAct() {
  setCpuTimer(null);
  if (!cpuTurn() || state.screen !== 'mini' || !cpuPlan || cpuPlan.square !== state.zoom || menuOpen || explainT || repActive()) return;
  const plan = cpuPlan, mini = state.squares[plan.square].mini;
  if (!plan.stage) {                             // its screen first, as a person's would show: the choice pressed and typed in (ui/replay.js), then the move
    plan.stage = 1;
    repStart({ cpu: true, sq: plan.square, by: state.turn, type: mini.type, mini, move: plan.move, lead: CPU_MS.pre, speed: replaySpeed(), onMove: cpuPlay });
    return;
  }
  cpuPlay();
}
// The computer's move itself (the replay's inputs have shown, or there were none).
function cpuPlay() {
  const plan = cpuPlan;
  if (!plan || !cpuTurn() || state.screen !== 'mini' || plan.square !== state.zoom) return;
  setCpuPlan(null);
  const r = playMove(state, plan.square, plan.move, RNG);
  if (!r.ok) {                                   // never expected; rather than freeze, hand the match to two players
    console.error('The computer could not play', plan, r);
    state.cpu = null; leaveSquare(state); stampFx();
  } else playFlash();
  commit();
}
// The move's animation starts: the event is the move itself (made on this phone, by the computer, or
// played back here once the square is in view). Its result is taken away once it has played and been up
// for a moment. `played`: a result found on show (a reload): its animation is over already.
// `speed`: a replay's own speed (an opponent's or the computer's move: REPLAY_SPEED; the Super Chaos recap 2x;
// by default the replay under way's). The move plays at the game's pace or the replay's, whichever is faster
// (core/timer.js moveRate: a run or a physics recording in real time, at the replay's speed), its sounds and its
// timers to match. holdMax: the longest the result stays up after its animation (Super Chaos's replay: no dead
// time between the steps of a move); holdAt: exactly this long (its last step: the end held); elapsed: the move
// began this long ago (a sequence joined part way: its animation that far on, quietly).
let flashEnds = 0;                                 // when the result on show clears (this phone's clock)
let momentTimer = null, moment = null;             // the move's big moment (a shake, as its result lands): its timer, and what it will do
export const flashLeft = () => (state.flash && flashTimer ? Math.max(0, flashEnds - Date.now()) : 0);   // how much longer the result on show stays up
export function playFlash(played, speed, holdMax, holdAt, elapsed) {
  const f = state.flash;
  if (!f || state.spot || fxAt('move', f) != null) return;     // while the square glows on the board, the move has not played yet
  const rs = speed || (rep && rep.stage === 'move' && !rep.f ? rep.speed : 1);
  const sp = moveRate(f.type, rs), hr = holdRate(f.type, rs), el = Math.max(0, elapsed || 0), anim = animMs(f) / sp;   // (el: real ms of the move already gone; anim: its animation on screen)
  const ms = played ? 0 : Math.max(0, anim - el);
  startFx('move', f, performance.now() - (played ? animMs(f) : el));
  fx.move.rate = sp; fx.move.end = performance.now() + ms;   // (rate: the move's own; end: when its animation is over, on this phone's clock)
  if (played || el > 0 || SND.muted || !SND.loaded || !SND.ensure(false)) fx.move.quiet = true;   // (a result already heard at a reload, played before audio was ready, or joined part way: it finishes quietly too)
  setFlashReady(Date.now() + ms);                   // the result can be tapped away once it has landed (a tap before that finishes the animation: skipFlash)
  const hold = holdAt != null ? holdAt : Math.max(0, Math.min(holdMax == null ? Infinity : holdMax, holdOf(f) / hr) - Math.max(0, el - anim));   // (holdAt: exactly this long from the animation's end; else the usual hold, less what is gone already)
  clearTimeout(flashTimer); setFlashTimer(setTimeout(dismissFlash, ms + hold)); flashEnds = Date.now() + ms + hold;   // (first: the result always clears, whatever its sounds do)
  if (!played && !(el > 0)) {                        // its sounds, kept as the move's (a tap that finishes it silences them: SND.cut)
    const was = SND.scope; if (was == null) SND.scope = f;
    try { for (const [n, at, rate] of moveSounds(f)) SND.play(n, { at: at / 1000 / sp, rate }); } finally { SND.scope = was; }
  }
  if (sp !== 1 && !played) flashRate(f, sp);
  clearTimeout(momentTimer); momentTimer = null; moment = null;
  const pw = played || el > 0 ? null : momentPower(f);
  if (pw) { moment = () => { moment = null; momentTimer = null; if (state.flash === f) shake(pw); }; momentTimer = setTimeout(moment, Math.max(0, ms - 40)); }   // (as the result lands)
}
// The move's rate on its animations: the move's event drifts back, so everything timed from it (the canvas replays,
// the counts, the animations re-anchored at each render: ui/fx.js anchorFx) sees the elapsed time multiplied,
// until the result is gone or the move's event is set again (a tap that finishes it).
function flashRate(f, sp) {
  const e = fx.move;
  if (!e || e.key !== f) return;
  const t0 = e.at, w0 = performance.now();
  const step = () => {
    if (state.flash !== f || fx.move !== e) return;
    e.at = t0 - (performance.now() - w0) * (sp - 1);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// How long the result stays up once its animation has played.
const SPEED_HOLD = { claim: 500, match: 700 };     // Speed: a win's moment shorter still, the board's zoom-out and stamp right behind it
export function holdOf(f) {
  let hold = (speedMode() && SPEED_HOLD[f.kind]) || FLASH_MS[f.kind] || 800;
  if (f.type === 'memory' && f.kind === 'move') hold = MEMORY_MS;
  if (f.type === 'pig' && f.kind === 'move') hold = f.note === 'bust' ? FLASH_MS.card : FLASH_MS.move;   // a bust gets a proper card; a bank just its points moving over
  if (f.type === 'pig' && f.kind === 'again') hold = 0;                      // a roll that keeps the turn: Roll again the moment the die has landed and its points counted
  if (f.type === 'bj' && f.kind === 'again') hold = 0;                       // Blackjack, a hand still on: Hit and Stand the moment its cards are down (about 0.3 s after the last lands)
  if (f.type === 'hangman' && f.kind === 'again') hold = 0;                  // Hangman, a right letter: the next guess the moment it is in
  return hold;
}
// A tap on a move still playing (an opponent's replay's Skip, or any tap on the square while a move animates, your
// own too): the move's animation jumps to its end, quietly, its sounds cut; the result stays up its usual moment
// and then clears as ever (and a tap once it has landed takes it away at once).
export function skipFlash() {
  const f = state.flash;
  if (!f || fxAt('move', f) == null) return;
  const sp = (fx.move && fx.move.rate) || 1, hr = Math.max(sp, ANIM.speed);
  SND.cut(f);
  startFx('move', f, performance.now() - animMs(f) * Math.max(1, sp));   // (past its end at any speed)
  fx.move.rate = sp; fx.move.end = performance.now(); fx.move.quiet = true;
  if (moment) moment();                                // (its big moment lands with it)
  setFlashReady(Date.now());
  clearTimeout(flashTimer); setFlashTimer(setTimeout(dismissFlash, holdOf(f) / hr)); flashEnds = Date.now() + holdOf(f) / hr;
  render();
}
// The move's animation is still playing (a tap on it finishes it: ui/input.js).
export function flashAnimating() { return !!state.flash && fxAt('move', state.flash) != null && Date.now() < flashReady; }
// The match is over and its last square has stamped in on the board: the end screen, with its sound.
const WIN_AFTER = 350;
let winTimer = null;
export function toWin() {
  clearTimeout(winTimer); winTimer = null;
  if (!state.winner || state.screen !== 'board' || state.sc) return;
  state.screen = 'win'; state.zoom = null;
  SND.play('swish'); SND.play(matchEndSound(), { at: speedMode() ? 0.12 : 0.25 });
  const k = endKind().list;
  if (k !== 'loss') setTimeout(() => { confetti(k === 'win' ? 60 : 30); if (k === 'win') shake(1.2); }, 60);   // (a win: a burst of confetti and a jolt; a tie or two people on one phone, a smaller one; a loss, none)
  haptic({ win: 'win', loss: 'loss' }[endKind().list] || 'claim');   // (the app: one buzz with the end screen, matching its sound; a tie or two people on one phone, a plain one)
  commit();
}
export function dismissFlash() {
  clearTimeout(flashTimer); setFlashTimer(null);
  const f = state.flash;
  if (!f) return;
  if (rep && rep.f === f) repStop();                 // the replay is over with its move
  const hold = f.type === 'memory' && f.kind === 'move' && !state.winner;   // let the two cards turn back over first
  const from = { turn: state.turn, mini: state.screen === 'mini' }, quiet = !!(fx.move && fx.move.key === f && fx.move.quiet);
  endFlash(state, hold);
  const ended = f.kind === 'match' && !!state.winner && state.screen === 'win' && !state.sc && state.squares[f.square] && state.squares[f.square].owner;
  if (ended) {                                       // the square that ended the match: back to the main board first, where it stamps in; then the match's end (toWin)
    state.screen = 'board'; state.zoom = null; state.stamp = f.square; state.stampId = `${state.id || 'm'}:${state.moves}`;
    clearTimeout(winTimer); winTimer = setTimeout(toWin, speedMode() ? (STAMP_MS * 0.6 + WIN_AFTER) / ANIM.speed : (STAMP_MS + WIN_AFTER) / ANIM.speed);   // (Speed: the end screen comes in as the stamp settles)
  }
  if (hold && state.done) { startFx('back', state.done); if (!quiet) SND.play('flipDown'); }   // the two cards turning back over
  else if (!quiet) backSounds(from);
  stampFx();
  commit();
  if (hold && state.done) {
    clearTimeout(holdTimer);
    setHoldTimer(setTimeout(() => { if (state.done && !state.flash && leaveSquare(state)) { if (!quiet) backSounds(from); stampFx(); commit(); } applyPending(); }, FLIP_MS / ANIM.speed));
  } else applyPending();                        // online: the room may have moved on meanwhile
}
