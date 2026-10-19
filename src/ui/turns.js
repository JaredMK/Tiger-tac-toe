// The turn flow on screen: the computer's turn (think, zoom, play), the result shown and dismissed.
import { cpuMove } from '../core/ai.js';
import { endFlash, leaveSquare, playMove } from '../core/board.js';
import { playerName } from '../core/match.js';
import { SND, backSounds, moveSounds } from '../audio/sound.js';
import { applyPending } from '../net/room.js';
import {
  CPU_MS, FLASH_MS, FLIP_MS, MEMORY_MS, RNG, commit, cpuPlan, cpuTimer, flashReady, flashTimer, holdTimer,
  menuOpen, setCpuPlan, setCpuTimer, setFlashReady, setFlashTimer, setHoldTimer, state
} from './app.js';
import { chaosStep } from './chaos.js';
import { explainT } from './explainer.js';
import { animMs, fx, fxAt, stampFx, startFx } from './fx.js';
import { joinAsk } from './input.js';
import { render } from './render.js';
import { rep, repActive, repStart, repStop } from './replay.js';

/* ----- the computer's turn: a pause to think, a zoom into its square, its choice shown, then the move ----- */
export function cpuTurn() { return !!state.cpu && state.cpu.includes(state.turn) && !state.winner && ['board', 'mini'].includes(state.screen); }   // (on any other screen the match waits)
// Runs after every render: arms the computer's next step whenever it is its turn and nothing else is going on.
export function scheduleCpu() {
  clearTimeout(cpuTimer); setCpuTimer(null);
  chaosStep();                                                   // Super Chaos: the round's own steps (ui/chaos.js)
  if (!cpuTurn() || state.flash || state.done || state.confirm || menuOpen || explainT || joinAsk || repActive()) return;   // (repActive: its inputs are playing; the replay makes the move when they are done)
  if (state.screen === 'board') { setCpuPlan(null); setCpuTimer(setTimeout(cpuSpot, CPU_MS.think)); return; }
  if (state.screen !== 'mini') return;
  if (cpuPlan && cpuPlan.square === state.zoom && state.spot) return;   // the glow is still showing; cpuZoom takes it from here
  if (!cpuPlan || cpuPlan.square !== state.zoom) {
    setCpuPlan(cpuMove(state, RNG)); cpuPlan.stage = 0;
    if (cpuPlan.square !== state.zoom) { state.zoom = cpuPlan.square; state.draft = ''; state.pick = null; state.sel = []; commit(); return; }   // after a reload mid-move
  }
  setCpuTimer(setTimeout(cpuAct, cpuPlan.stage ? CPU_MS.pre : state.lock != null ? CPU_MS.again : CPU_MS.zoom));
}
function cpuSpot() {                                           // the computer has chosen: show where, then go there
  setCpuTimer(null);
  if (!cpuTurn() || state.screen !== 'board' || state.confirm || menuOpen) return;
  setCpuPlan(cpuMove(state, RNG)); cpuPlan.stage = 0;
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
export function playFlash(played, speed) {
  const f = state.flash, sp = speed || 1;
  if (!f || state.spot || fxAt('move', f) != null) return;     // while the square glows on the board, the move has not played yet
  const ms = played ? 0 : animMs(f) / sp;
  startFx('move', f, performance.now() - (played ? animMs(f) : 0));
  if (played || SND.muted || !SND.loaded || !SND.ctx || SND.ctx.state !== 'running') fx.move.quiet = true;   // (a result already heard at a reload, or played before audio was ready: it finishes quietly too)
  if (!played) for (const [n, at, rate] of moveSounds(f)) SND.play(n, { at: at / 1000 / sp, rate });
  setFlashReady(Date.now() + ms);                   // no tapping the result away while the move is still animating
  clearTimeout(flashTimer); setFlashTimer(setTimeout(dismissFlash, ms + holdOf(f) / sp));
}
// How long the result stays up once its animation has played.
function holdOf(f) {
  let hold = FLASH_MS[f.kind] || 800;
  if (f.type === 'memory' && f.kind === 'move') hold = MEMORY_MS;
  if (f.type === 'pig' && f.kind === 'move') hold = f.note === 'bust' ? FLASH_MS.card : FLASH_MS.move;   // a bust gets a proper card; a bank just its points moving over
  if (f.type === 'pig' && f.kind === 'again') hold = 0;                      // a roll that keeps the turn: Roll again the moment the die has landed and its points counted
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
  clearTimeout(flashTimer); setFlashTimer(setTimeout(dismissFlash, holdOf(f) / sp));
  render();
}
export function dismissFlash() {
  clearTimeout(flashTimer); setFlashTimer(null);
  const f = state.flash;
  if (!f) return;
  if (rep && rep.f === f) repStop();                 // the replay is over with its move
  const hold = f.type === 'memory' && f.kind === 'move' && !state.winner;   // let the two cards turn back over first
  const from = { turn: state.turn, mini: state.screen === 'mini' }, quiet = !!(fx.move && fx.move.key === f && fx.move.quiet);
  endFlash(state, hold);
  if (hold && state.done) { startFx('back', state.done); if (!quiet) SND.play('flipDown'); }   // the two cards turning back over
  else if (!quiet) backSounds(from);
  stampFx();
  commit();
  if (hold && state.done) {
    clearTimeout(holdTimer);
    setHoldTimer(setTimeout(() => { if (state.done && !state.flash && leaveSquare(state)) { if (!quiet) backSounds(from); stampFx(); commit(); } applyPending(); }, FLIP_MS));
  } else applyPending();                        // online: the room may have moved on meanwhile
}
