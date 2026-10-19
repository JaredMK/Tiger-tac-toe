// Super Chaos on screen (the rules: core/chaos.js). The round's clock (paused with the menu or an explainer),
// the end of the round once both moves are in (the computer's taking a person's time, "Waiting for…" until
// then), and the recap on the main board: a Mini Golf square plays both shots first; then the computer's
// square lights up; then a pop-up over the board replays its move at 2x (its inputs, then each step of the
// move with its usual animation: ui/replay.js); then the claims stamp in and any reset square turns over;
// then the next round, or the match's end.
import { chaosNext, chaosResolve, chaosTimeout, scHuman } from '../core/chaos.js';
import { other } from '../core/util.js';
import { INFO, rulesOf } from '../games/index.js';
import { SND, matchEndSound } from '../audio/sound.js';
import { N, RNG, commit, flashTimer, menuOpen, setFlashTimer, state } from './app.js';
import { explainT } from './explainer.js';
import { startFx, stampFx } from './fx.js';
import { render } from './render.js';
import { repStart, repStop } from './replay.js';
import { playFlash } from './turns.js';

export const SC_MS = { cpu: [1400, 4200], spot: 800, stamp: 900, end: 1300, popup: 2, idle: 300, last: 600, skip: 450 };   // the computer's move takes this long; the recap's steps; the pop-up replay's speed, its longest idle moment (a pause in the inputs, the wait between a move's steps), how long its last result stays up, and the end shown after a skip
let scTimer = null;
export let scUi = { round: null, readyAt: 0, stage: null, at: 0, played: false };   // this round on screen: when the computer's move counts as made, the recap's stage
const now = () => Date.now();
const live = () => !!state.sc && !state.online;

// ---- the round's clock: a deadline on this phone's clock, held while the game is paused ----
export function scClockLeft() {
  const sc = state.sc;
  if (!sc || sc.recap || state.winner) return null;
  if (sc.held != null) return Math.max(0, sc.held);
  if (sc.deadline == null) return null;
  return Math.max(0, Math.min(sc.limit * 1000, sc.deadline - now()));
}
const paused = () => menuOpen || !!explainT || (typeof document !== 'undefined' && document.visibilityState === 'hidden');   // (the menu, an explainer, or the page out of sight)
function holdClock(p) {
  const sc = state.sc;
  if (p && sc.deadline != null && sc.held == null) { sc.held = Math.max(0, sc.deadline - now()); sc.deadline = null; }
  else if (!p && sc.held != null) { sc.deadline = now() + sc.held; sc.held = null; }
}
// The human's move is in, or the round is being shown: nothing to play until the next round.
export function scWaiting() { return live() && !state.winner && !!(state.sc.me || state.sc.recap); }
export function scRecapStage() { return live() && state.sc.recap && scUi.round === state.sc.recap.round ? scUi.stage : null; }
export const scPopup = () => scRecapStage() === 'popup';                   // the recap's pop-up replay of the computer's move is up
export const scCpu = () => other(scHuman(state));
// What a square shows while the recap has not reached its claims and resets: both moves in, nothing claimed;
// the computer's square in the pop-up: its move as far as the replay has got.
export function scShown(i) {
  const rc = live() && state.sc.recap, st = scRecapStage();
  if (!rc || !(st === 'replay' || st === 'spot' || st === 'popup')) return null;
  if (st === 'popup' && rc.cpu && rc.cpu.square === i && scUi.mini) return { owner: null, mini: scUi.mini, mv: state.squares[i].mv };
  if (!rc.view || !rc.view[i]) return null;
  return { owner: null, mini: rc.view[i], mv: state.squares[i].mv };
}

// Runs after every render (from scheduleCpu): keeps the round moving.
export function chaosStep() {
  clearTimeout(scTimer); scTimer = null;
  if (!live()) return;
  const sc = state.sc;
  if (!['board', 'mini'].includes(state.screen)) return;
  holdClock(paused());
  if (paused()) return;
  if (sc.recap) { recapStep(); return; }
  if (state.winner) return;
  if (scUi.round !== sc.round) {                                    // a round begins (or goes on after a reload)
    const fresh = sc.deadline == null && sc.held == null;
    scUi = { round: sc.round, readyAt: fresh ? now() + SC_MS.cpu[0] + Math.random() * (SC_MS.cpu[1] - SC_MS.cpu[0]) : 0, stage: null, at: 0, played: false };
    if (fresh) sc.deadline = now() + sc.limit * 1000;
  }
  if (sc.me && !state.flash && !state.done && state.lock == null) {   // the human's move is in, its result seen: the round ends once the computer's is too
    const wait = scUi.readyAt - now();
    if (wait > 0) { scTimer = setTimeout(chaosStep, wait); return; }
    endRound();
  }
}
// The round's time is up (the clock's tick): the game's timeout rule for the human's move.
export function scTick() {
  if (!live() || paused() || state.winner) return;
  const left = scClockLeft();
  if (left == null || left > 0) return;
  const r = chaosTimeout(state, RNG);
  if (r.ok) { state.screen = 'mini'; state.zoom = r.square; state.spot = null; playFlash(); commit(); }   // the random move, played where it was made
}
function endRound() {
  const rc = chaosResolve(state, RNG);
  if (!rc) return;
  state.sc.deadline = null; state.sc.held = null;
  scUi = { round: rc.round, readyAt: 0, stage: rc.replay ? 'replay' : 'spot', at: 0, played: false };
  state.screen = 'board'; state.zoom = null; state.spot = null; state.stamp = null; state.stamps = null;
  commit();
}
// The Mini Golf square's two shots, played together: its result, as a move the square plays.
function golfFlash(rc) {
  const r = rc.replay, me = scHuman(state), mini = rc.view[r.square];
  const f = { kind: r.win.length === 1 ? 'claim' : 'move', by: mini.last.by, next: me, square: r.square, type: r.type, note: null, pass: null, timeout: false, sc: rc.round, recap: true };
  if (r.win.length === 1) f.winner = r.win[0];
  const g = rulesOf(r.type);
  if (g.moveFlash) g.moveFlash(null, f.by, null, 0, mini, f);
  return f;
}
const clone = v => JSON.parse(JSON.stringify(v));
// One step of the computer's move in the pop-up: its inputs (the replay's log), then the step's own flash
// at the pop-up's speed; the square shows the step's result from then on.
function popupStep(rc, cpu) {
  const k = scUi.step, step = rc.cpu.steps[k], last = k + 1 >= rc.cpu.steps.length;
  scUi.step = k + 1;
  const f = Object.assign({}, step); delete f.after;
  f.recap = true; f.recapMore = !last;
  repStart({ cpu: true, sq: rc.cpu.square, by: cpu, type: rc.cpu.type, mini: scUi.mini, move: step.m, list: step.rep, timeout: !!step.timeout, speed: SC_MS.popup, lead: k ? 0 : SC_MS.idle, gap: SC_MS.idle,
    onMove: () => { if (step.after) scUi.mini = clone(step.after); state.flash = f; playFlash(false, SC_MS.popup, last ? SC_MS.last : SC_MS.idle); render(); } });
}
// A tap on the replay (or its Skip): straight to the end of the computer's move (every step made, the
// square as the move left it), shown a moment, then the round's results.
export function scSkip() {
  if (scRecapStage() !== 'popup') return false;
  const rc = state.sc.recap, steps = rc.cpu.steps, lastStep = steps[steps.length - 1];
  repStop();
  clearTimeout(flashTimer); setFlashTimer(null); state.flash = null;
  scUi.step = steps.length; scUi.skipAt = now();
  if (lastStep && lastStep.after) scUi.mini = clone(lastStep.after);
  render(); chaosStep();
  return true;
}
function recapStep() {
  const rc = state.sc.recap, me = scHuman(state), cpu = other(me);
  if (scUi.round !== rc.round || !scUi.stage) scUi = { round: rc.round, readyAt: 0, stage: 'end', at: 0, played: false, step: 0, mini: null };   // (after a reload: straight on)
  const t = now();
  if (scUi.stage === 'replay') {
    if (!scUi.played) {
      scUi.played = true;
      state.screen = 'mini'; state.zoom = rc.replay.square; state.flash = golfFlash(rc);
      playFlash(); render();                                         // (the move's event first: the result is drawn from it)
      return;                                                        // the result's own timer (dismissFlash) brings the board back
    }
    if (state.flash) return;
    scUi.stage = 'spot'; scUi.at = 0;
  }
  if (scUi.stage === 'spot') {
    if (!scUi.at) {
      scUi.at = t;
      state.screen = 'board'; state.zoom = null;
      if (rc.cpu) {
        state.spot = { square: rc.cpu.square, by: cpu, label: `${state.setup.names[cpu] || cpu} played here`, html: `${N(cpu)} played here`, sc: rc.round };
        startFx('spot', state.spot); SND.play('spot');
      }
      render();
    }
    const wait = scUi.at + (rc.cpu ? SC_MS.spot : 200) - t;
    if (wait > 0) { scTimer = setTimeout(chaosStep, wait); return; }
    scUi.stage = rc.cpu && rc.cpu.steps && rc.cpu.steps.length ? 'popup' : 'stamp'; scUi.at = 0; scUi.step = 0; scUi.mini = null;
  }
  if (scUi.stage === 'popup') {                                   // the computer's move replayed at 2x, step by step, in a card over the board
    if (!scUi.at) {
      scUi.at = t; scUi.step = 0; scUi.skipAt = 0;
      scUi.mini = clone(rc.cpu.start || (state.sc.base && state.sc.base[rc.cpu.square]) || state.squares[rc.cpu.square].mini);
      state.spot = null; state.screen = 'mini'; state.zoom = rc.cpu.square; state.draft = ''; state.pick = null; state.sel = [];
      popupStep(rc, cpu);
      return;
    }
    if (scUi.skipAt) {                                            // skipped: the move's end on show a moment, then the results
      const wait = scUi.skipAt + SC_MS.skip - t;
      if (wait > 0) { scTimer = setTimeout(chaosStep, wait); return; }
    }
    if (state.flash) return;                                      // a step's result is still playing (dismissFlash brings this round here again)
    if (scUi.step < rc.cpu.steps.length) { popupStep(rc, cpu); return; }
    repStop(); scUi.skipAt = 0;
    state.screen = 'board'; state.zoom = null; scUi.mini = null;
    scUi.stage = 'stamp'; scUi.at = 0;
  }
  if (scUi.stage === 'stamp') {
    if (!scUi.at) {
      scUi.at = t;
      state.spot = null; state.screen = 'board'; state.zoom = null;
      const claimed = rc.claims.map(c => c.square);
      state.stamp = claimed.length ? claimed[0] : null; state.stamps = claimed.length ? claimed : null;
      state.stampId = claimed.length ? `sc${state.id || 'm'}:${rc.round}` : null;
      if (rc.resets.length) { startFx('screset', 'sc' + rc.round); SND.play('reset', { at: claimed.length ? 0.35 : 0 }); }
      render(); stampFx();
    }
    const wait = scUi.at + (rc.claims.length || rc.resets.length ? SC_MS.stamp : 0) - t;
    if (wait > 0) { scTimer = setTimeout(chaosStep, wait); return; }
    scUi.stage = 'end'; scUi.at = 0;
  }
  if (scUi.stage === 'end') {
    if (state.winner) {
      if (!scUi.at) { scUi.at = t; if (rc.result) { SND.play('swish'); SND.play(matchEndSound(), { at: 0.5 }); } }
      const wait = scUi.at + SC_MS.end - t;
      if (wait > 0) { scTimer = setTimeout(chaosStep, wait); return; }
      chaosNext(state, RNG);
      state.screen = 'win'; state.zoom = null; state.spot = null;
      commit();
      return;
    }
    chaosNext(state, RNG);
    scUi = { round: null, readyAt: 0, stage: null, at: 0, played: false };
    SND.play('turn');
    commit();
  }
}
// The square each player played last (the board's badges): the human's this round once it is in, else
// the last round's; the computer's from the last round resolved (the recap reveals this round's).
export function scLastPlayed() {
  if (!live()) return null;
  const sc = state.sc, me = scHuman(state), cpu = other(me), last = sc.last || {};
  return { [me]: sc.me ? sc.me.square : last[me] != null ? last[me] : null, [cpu]: last[cpu] != null ? last[cpu] : null };
}
// The board's line under the squares in a Super Chaos round.
export function scHint() {
  const sc = state.sc, cpu = other(scHuman(state));
  if (sc.recap) return `Round ${sc.recap.round} · results`;
  if (sc.me) return `Waiting for ${N(cpu)}…`;
  return `Round ${sc.round} · tap any open square`;
}
// The turn row in the header: the round, and how it stands.
export function scTurnText() {
  const sc = state.sc, cpu = other(scHuman(state));
  if (sc.recap) return `<span class="who">Round ${sc.recap.round}<i class="suf"> · results</i></span>`;
  return `<span class="who">Round ${sc.round}${sc.me ? '<i class="suf"> · waiting</i>' : ''}</span>`;
}
export const scName = t => INFO[t] ? INFO[t].name : t;

// Setters for the names other modules reassign (an imported name is read-only there).
export function setScUi(v) { scUi = v; }

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  document.addEventListener('visibilitychange', () => { if (live()) chaosStep(); });   // the round's clock holds while the page is out of sight
}
