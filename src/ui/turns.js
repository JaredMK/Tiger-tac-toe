// The turn flow on screen: the computer's turn (think, zoom, play), the result shown and dismissed.
import { endFlash, leaveSquare, playMove } from '../core/board.js';
import { playerName } from '../core/match.js';
import { SND, backSounds, matchEndSound, moveSounds } from '../audio/sound.js';
import { mmIntro } from '../net/matchmaking.js';
import { applyPending } from '../net/room.js';
import {
  CPU_MS, FLASH_MS, FLIP_MS, MEMORY_MS, RNG, commit, cpuPlan, cpuTimer, flashReady, flashTimer, holdTimer,
  menuOpen, setCpuPlan, setCpuTimer, setFlashReady, setFlashTimer, setHoldTimer, state
} from './app.js';
import { STAMP_MS } from './board.js';
import { chaosStep } from './chaos.js';
import { explainT } from './explainer.js';
import { animMs, fx, fxAt, stampFx, startFx } from './fx.js';
import { joinAsk } from './input.js';
import { render } from './render.js';
import { rep, repActive, repStart, repStop } from './replay.js';
import { cpuThink } from './think.js';

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
    repStart({ cpu: true, sq: plan.square, by: state.turn, type: mini.type, mini, move: plan.move, lead: CPU_MS.pre, onMove: cpuPlay });
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
// `speed`: the Super Chaos recap plays a move at 2x (its sounds and its timers to match; the animations
// run fast from the replay, ui/replay.js).
let flashEnds = 0;                                 // when the result on show clears (this phone's clock)
export const flashLeft = () => (state.flash && flashTimer ? Math.max(0, flashEnds - Date.now()) : 0);   // how much longer the result on show stays up
export function playFlash(played, speed, holdMax, holdAt, elapsed) {   // holdMax: the longest the result stays up after its animation (Super Chaos's replay: no dead time between the steps of a move); holdAt: exactly this long (its last step: the end held); elapsed: the move began this long ago (a sequence joined part way: its animation that far on, quietly)
  const f = state.flash, sp = speed || 1, el = Math.max(0, elapsed || 0), anim = animMs(f) / sp;   // (el: real ms of the move already gone; anim: its animation on screen)
  if (!f || state.spot || fxAt('move', f) != null) return;     // while the square glows on the board, the move has not played yet
  const ms = played ? 0 : Math.max(0, anim - el);
  startFx('move', f, performance.now() - (played ? animMs(f) : el));
  if (played || el > 0 || SND.muted || !SND.loaded || !SND.ensure(false)) fx.move.quiet = true;   // (a result already heard at a reload, played before audio was ready, or joined part way: it finishes quietly too)
  setFlashReady(Date.now() + ms);                   // no tapping the result away while the move is still animating
  const hold = holdAt != null ? holdAt : Math.max(0, Math.min(holdMax == null ? Infinity : holdMax, holdOf(f) / sp) - Math.max(0, el - anim));   // (holdAt: exactly this long from the animation's end; else the usual hold, less what is gone already)
  clearTimeout(flashTimer); setFlashTimer(setTimeout(dismissFlash, ms + hold)); flashEnds = Date.now() + ms + hold;   // (first: the result always clears, whatever its sounds do)
  if (!played && !(el > 0)) for (const [n, at, rate] of moveSounds(f)) SND.play(n, { at: at / 1000 / sp, rate });
}
// How long the result stays up once its animation has played.
export function holdOf(f) {
  let hold = FLASH_MS[f.kind] || 800;
  if (f.type === 'memory' && f.kind === 'move') hold = MEMORY_MS;
  if (f.type === 'pig' && f.kind === 'move') hold = f.note === 'bust' ? FLASH_MS.card : FLASH_MS.move;   // a bust gets a proper card; a bank just its points moving over
  if (f.type === 'pig' && f.kind === 'again') hold = 0;                      // a roll that keeps the turn: Roll again the moment the die has landed and its points counted
  if (f.type === 'bj' && f.kind === 'again') hold = 0;                       // Blackjack, a hand still on: Hit and Stand the moment its cards are down (about 0.3 s after the last lands)
  return hold;
}
// Skip (an opponent's replay): the move's animation jumps to its end, quietly; the result stays up its usual
// moment and then clears as ever.
export function skipFlash() {
  const f = state.flash;
  if (!f || fxAt('move', f) == null) return;
  const sp = rep && rep.f === f ? rep.speed : 1;
  startFx('move', f, performance.now() - animMs(f) * Math.max(1, sp));   // (past its end at any speed)
  fx.move.quiet = true;
  setFlashReady(Date.now());
  clearTimeout(flashTimer); setFlashTimer(setTimeout(dismissFlash, holdOf(f) / sp)); flashEnds = Date.now() + holdOf(f) / sp;
  render();
}
// The match is over and its last square has stamped in on the board: the end screen, with its sound.
const WIN_AFTER = 350;
let winTimer = null;
export function toWin() {
  clearTimeout(winTimer); winTimer = null;
  if (!state.winner || state.screen !== 'board' || state.sc) return;
  state.screen = 'win'; state.zoom = null;
  SND.play('swish'); SND.play(matchEndSound(), { at: 0.25 });
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
    clearTimeout(winTimer); winTimer = setTimeout(toWin, STAMP_MS + WIN_AFTER);
  }
  if (hold && state.done) { startFx('back', state.done); if (!quiet) SND.play('flipDown'); }   // the two cards turning back over
  else if (!quiet) backSounds(from);
  stampFx();
  commit();
  if (hold && state.done) {
    clearTimeout(holdTimer);
    setHoldTimer(setTimeout(() => { if (state.done && !state.flash && leaveSquare(state)) { if (!quiet) backSounds(from); stampFx(); commit(); } applyPending(); }, FLIP_MS));
  } else applyPending();                        // online: the room may have moved on meanwhile
}
