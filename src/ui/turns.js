// The turn flow on screen: the computer's turn (think, zoom, play), the result shown and dismissed.
import { cpuMove } from '../core/ai.js';
import { endFlash, leaveSquare, playMove } from '../core/board.js';
import { playerName } from '../core/match.js';
import { hpSel, setHpSel } from '../games/hexapawn/view.js';
import { mmDraft, setMmDraft } from '../games/mastermind/view.js';
import { rlDraft, setRlDraft } from '../games/rl/view.js';
import { SND, backSounds, moveSounds } from '../audio/sound.js';
import { applyPending } from '../net/room.js';
import {
  CPU_MS, FLASH_MS, FLIP_MS, MEMORY_MS, RNG, commit, cpuPlan, cpuTimer, flashReady, flashTimer, holdTimer,
  menuOpen, pickKey, setCpuPlan, setCpuTimer, setFlashReady, setFlashTimer, setHoldTimer, state
} from './app.js';
import { chaosStep } from './chaos.js';
import { explainT } from './explainer.js';
import { animMs, fx, fxAt, stampFx, startFx } from './fx.js';
import { joinAsk } from './input.js';
import { render } from './render.js';

/* ----- the computer's turn: a pause to think, a zoom into its square, its choice shown, then the move ----- */
export function cpuTurn() { return !!state.cpu && state.cpu.includes(state.turn) && !state.winner && ['board', 'mini'].includes(state.screen); }   // (on any other screen the match waits)
// Runs after every render: arms the computer's next step whenever it is its turn and nothing else is going on.
export function scheduleCpu() {
  clearTimeout(cpuTimer); setCpuTimer(null);
  chaosStep();                                                   // Super Chaos: the round's own steps (ui/chaos.js)
  if (!cpuTurn() || state.flash || state.done || state.confirm || menuOpen || explainT || joinAsk) return;
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
  if (!cpuTurn() || state.screen !== 'mini' || !cpuPlan || cpuPlan.square !== state.zoom || menuOpen || explainT) return;
  const plan = cpuPlan, type = state.squares[plan.square].mini.type;
  if (!plan.stage && (type === 'memory' || type === 'wordle' || type === 'hexapawn' || type === 'mastermind' || type === 'rl')) {   // show the choice first, as a person would
    if (type === 'rl') setRlDraft({ sq: plan.square, nums: Array.isArray(plan.move) ? plan.move.slice() : [], bet: Array.isArray(plan.move) ? null : plan.move });   // the bet on the board, then the spin
    else if (type === 'memory') { state.pick = plan.move[0]; state.pickSq = plan.square; startFx('pick', pickKey()); SND.play('flipUp'); } else if (type === 'hexapawn') setHpSel({ sq: plan.square, from: plan.move[0] });
    else if (type === 'mastermind') setMmDraft({ sq: plan.square, slots: plan.move.slice(), at: 0 }); else state.draft = plan.move;
    plan.stage = 1; commit(); return;
  }
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
export function playFlash(played) {
  const f = state.flash;
  if (!f || state.spot || fxAt('move', f) != null) return;     // while the square glows on the board, the move has not played yet
  const ms = played ? 0 : animMs(f);
  startFx('move', f, performance.now() - (played ? animMs(f) : 0));
  if (played || SND.muted || !SND.loaded || !SND.ctx || SND.ctx.state !== 'running') fx.move.quiet = true;   // (a result already heard at a reload, or played before audio was ready: it finishes quietly too)
  if (!played) for (const [n, at, rate] of moveSounds(f)) SND.play(n, { at: at / 1000, rate });
  setFlashReady(Date.now() + ms);                   // no tapping the result away while the move is still animating
  let hold = FLASH_MS[f.kind] || 800;
  if (f.type === 'memory' && f.kind === 'move') hold = MEMORY_MS;
  if (f.type === 'pig' && f.kind === 'move') hold = f.note === 'bust' ? FLASH_MS.card : FLASH_MS.move;   // a bust gets a proper card; a bank just its points moving over
  clearTimeout(flashTimer); setFlashTimer(setTimeout(dismissFlash, ms + hold));
}
export function dismissFlash() {
  clearTimeout(flashTimer); setFlashTimer(null);
  const f = state.flash;
  if (!f) return;
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
