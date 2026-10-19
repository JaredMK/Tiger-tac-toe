// Super Chaos on screen (the rules: core/chaos.js). The round's clock (paused with the menu or an explainer),
// the end of the round once both moves are in (the computer's taking a person's time, "Waiting for…" until
// then), and the recap on the main board: a Mini Golf square plays both shots first; then the computer's
// square lights up; then a pop-up over the board replays its move at 2x (its inputs, then each step of the
// move with its usual animation: ui/replay.js); then what only both moves together settle plays in its square
// (a Bump knock, the Roulette spin: resolve); then each square's result on the board, one at a time: its
// X or O stamping in, or (both won it) both marks clashing and the square turning over to a new game; then
// the next round, or the match's end.
import { chaosNext, chaosResolve, chaosTimeout, scHuman } from '../core/chaos.js';
import { other } from '../core/util.js';
import { INFO, rulesOf } from '../games/index.js';
import { SND, matchEndSound } from '../audio/sound.js';
import { N, RNG, commit, flashTimer, menuOpen, setFlashTimer, state } from './app.js';
import { explainT } from './explainer.js';
import { fxAt, startFx, stampFx } from './fx.js';
import { toon } from './art.js';
import { render } from './render.js';
import { repStart, repStop } from './replay.js';
import { playFlash } from './turns.js';

export const SC_MS = { cpu: [1400, 4200], spot: 800, claim: 1300, clash: 1050, flip: 900, end: 1300, popup: 2, idle: 300, last: 600, skip: 450 };   // the computer's move takes this long; the recap's steps; the pop-up replay's speed, its longest idle moment (a pause in the inputs, the wait between a move's steps), how long its last result stays up, and the end shown after a skip
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
// What a square shows while the recap has not reached its result: both moves in, nothing claimed (a square
// still to be settled together: both moves made, nothing knocked or spun yet); the computer's square in the
// pop-up: its move as far as the replay has got; once the results play, a square not reached yet.
export function scShown(i) {
  const rc = live() && state.sc.recap, st = scRecapStage();
  if (!rc || !['replay', 'spot', 'popup', 'resolve', 'result'].includes(st)) return null;
  const mv = state.squares[i].mv;
  if (st === 'popup' && rc.cpu && rc.cpu.square === i && scUi.mini) return { owner: null, mini: scUi.mini, mv };
  const rk = (rc.resolve || []).findIndex(x => x.square === i);
  if (rk >= 0 && rc.pre && rc.pre[i] && (st !== 'resolve' && st !== 'result' || (st === 'resolve' && rk >= (scUi.rk || 0)))) return { owner: null, mini: rc.pre[i], mv };
  if (st === 'result') {
    const k = scItems(rc).findIndex(x => x.square === i);
    if (k < 0 || k < scUi.k || (k === scUi.k && scUi.phase !== 'clash')) return null;   // its result shown (or none): as it now stands
  }
  if (!rc.view || !rc.view[i]) return null;
  return { owner: null, mini: rc.view[i], mv };
}
// The round's results, a square at a time: claims, and resets (both won it, or a draw).
const scItems = rc => rc.claims.map(c => ({ square: c.square, kind: 'claim', by: c.by }))
  .concat(rc.resets.map(r => ({ square: r.square, kind: r.why === 'both' ? 'both' : 'reset', why: r.why })))
  .sort((a, b) => a.square - b.square);
// A square's result as the board shows it now: its label, the clash of both marks, its turning over.
export function scVerdict(i) {
  const rc = live() && state.sc.recap;
  if (!rc || scRecapStage() !== 'result' || scUi.k < 0) return null;
  const it = scItems(rc)[scUi.k];
  if (!it || it.square !== i) return null;
  const key = `sc${rc.round}:${scUi.k}`;
  const lab = it.kind === 'claim' ? `${N(it.by)} takes it!` : it.kind === 'both' ? 'Both won it: reset!' : 'Reset';
  const chip = `<div class="spot-lab sc scv ${it.kind === 'claim' ? it.by : 'both'}" role="status">${lab}</div>`;
  if (scUi.phase === 'clash') {
    const at = fxAt('scclash', key);
    return { cls: ['scclash-on'], at, html: `<div class="scclash" aria-hidden="true"><span class="cx">${toon('X')}</span><span class="co">${toon('O')}</span></div>${chip}` };
  }
  if (scUi.phase === 'flip') return { cls: ['screset'], at: fxAt('screset', key), html: chip };
  return { cls: ['scwin', 'scwin-' + it.by], at: null, html: chip };
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
// One square's result begins: its X or O stamps in; both marks clash (both won it); it turns over to a new game.
function resultPhase(rc, items, phase) {
  const k = scUi.k, it = items[k], key = `sc${rc.round}:${k}`;
  scUi.phase = phase; scUi.at = now();
  state.spot = null; state.screen = 'board'; state.zoom = null;
  if (phase === 'claim') {
    state.stamp = it.square; state.stamps = [it.square]; state.stampId = `sc${state.id || 'm'}:${rc.round}:${k}`;
    stampFx(); render();                                         // (the stamp's event first: the board draws it stamping in)
    return;
  }
  state.stamp = null; state.stamps = null;
  if (phase === 'clash') { startFx('scclash', key); SND.play('stamp'); SND.play('stamp', { at: 0.12 }); SND.play('knock', { at: 0.42 }); }
  else { startFx('screset', key); SND.play('reset'); }
  render();
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
    const joint = rc.cpu && (rc.resolve || []).some(x => x.joint && x.square === rc.cpu.square);   // (both moved there: its replay shows both moves together, in the next stage)
    scUi.stage = rc.cpu && rc.cpu.steps && rc.cpu.steps.length && !joint ? 'popup' : 'resolve'; scUi.at = 0; scUi.step = 0; scUi.mini = null;
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
    scUi.stage = 'resolve'; scUi.at = 0;
  }
  if (scUi.stage === 'resolve') {                                 // what both moves settle together, in its square (the game's own animation)
    const list = rc.resolve || [];
    if (!scUi.at) { scUi.at = t; scUi.rk = 0; }
    if (state.flash) return;                                      // its result is playing (dismissFlash brings this round here again)
    if (scUi.rk < list.length) {
      const it = list[scUi.rk];
      scUi.rk += 1;
      state.spot = null; state.screen = 'mini'; state.zoom = it.square; state.draft = ''; state.pick = null; state.sel = [];
      state.flash = Object.assign({}, it.flash);
      playFlash(); render();
      return;
    }
    state.screen = 'board'; state.zoom = null;
    scUi.stage = 'result'; scUi.at = 0; scUi.k = -1; scUi.phase = null;
  }
  if (scUi.stage === 'result') {                                  // each square's result in turn, on the board
    const items = scItems(rc);
    for (;;) {
      if (scUi.k >= 0 && scUi.k < items.length) {
        const wait = scUi.at + SC_MS[scUi.phase] - t;
        if (wait > 0) { scTimer = setTimeout(chaosStep, wait); return; }
        if (scUi.phase === 'clash') { resultPhase(rc, items, 'flip'); continue; }
      }
      scUi.k += 1;
      if (scUi.k >= items.length) break;
      const it = items[scUi.k];
      resultPhase(rc, items, it.kind === 'claim' ? 'claim' : it.kind === 'both' ? 'clash' : 'flip');
    }
    state.stamp = null; state.stamps = null;
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
