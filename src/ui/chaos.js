// Super Chaos on screen (the rules: core/chaos.js). The round's clock (paused with the menu or an explainer;
// in a friend room the record's, in server time, the same on both phones), the end of the round once both
// moves are in (the computer's taking a person's time, "Waiting for…" until then), and the recap on the main
// board, a sequence timed from one start (scPlan): a Mini Golf square plays both shots first; then the other
// player's square lights up; then a pop-up over the board replays their move at 2x (its inputs, then each step
// of the move with its usual animation: ui/replay.js); then what only both moves together settle plays in its
// square (a Bump knock, the Roulette spin: resolve); then each square's result on the board, one at a time: its
// X or O stamping in, or (both won it) both marks clashing and the square turning over to a new game; then
// the next round, or the match's end. In a friend room both phones play the sequence from the record's shared
// start (server time), so they see the same part at the same moment; a phone coming back joins where it is.
import { chaosNext, chaosResolve, chaosTimeout, scHuman } from '../core/chaos.js';
import { serverNow } from '../net/connect.js';
import { other } from '../core/util.js';
import { INFO, rulesOf } from '../games/index.js';
import { SND, matchEndSound } from '../audio/sound.js';
import { N, RNG, commit, flashTimer, menuOpen, setFlashTimer, state } from './app.js';
import { explainT } from './explainer.js';
import { fmtClock } from './clock.js';
import { animMs, fxAt, startFx, stampFx } from './fx.js';
import { toon } from './art.js';
import { render } from './render.js';
import { repDuration, repStart, repStop } from './replay.js';
import { scNextOnline, scOnlineWait } from '../net/chaos.js';
import { holdOf, playFlash } from './turns.js';

export const SC_MS = { cpu: [1400, 4200], spot: 800, claim: 1300, clash: 1050, flip: 900, end: 1300, popup: 2, idle: 300, last: 1000, skip: 1000 };   // the computer's move takes this long; the recap's steps; the pop-up replay's speed, its longest idle moment (a pause in the inputs, the wait between a move's steps), how long its last result stays up, and the end shown after a skip
let scTimer = null;
export let scUi = { round: null, readyAt: 0, stage: null, at: 0, played: false };   // this round on screen: when the computer's move counts as made; the recap's stage and where it is in its sequence (seg)
const now = () => Date.now();
const live = () => !!state.sc;   // (against the computer, or in a friend room: sc.online)
// The recap's clock: against the computer this phone's; in a friend room the server's (both phones share one
// start, in server time, so the same sequence plays on both at once).
const tnow = () => (state.sc && state.sc.online ? serverNow() : now());

// ---- the round's clock: a deadline on this phone's clock, held while the game is paused; in a friend room the
// record's deadline in server time, the same on both phones (never held) ----
export function scClockLeft() {
  const sc = state.sc;
  if (!sc || sc.recap || state.winner) return null;
  if (!sc.online && sc.held != null) return Math.max(0, sc.held);
  if (sc.deadline == null) return null;
  return Math.max(0, Math.min(sc.limit * 1000, sc.deadline - tnow()));
}
const paused = () => menuOpen || !!explainT || (typeof document !== 'undefined' && document.visibilityState === 'hidden');   // (the menu, an explainer, or the page out of sight)
function holdClock(p) {
  const sc = state.sc;
  if (sc.online) return;
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
  if (!rc || !['wait', 'replay', 'spot', 'popup', 'resolve', 'result'].includes(st)) return null;
  const mv = state.squares[i].mv;
  if (st === 'popup' && rc.cpu && rc.cpu.square === i && scUi.mini) return { owner: null, mini: scUi.mini, mv };
  if (rc.cpu && rc.cpu.square === i && ['wait', 'replay', 'spot'].includes(st) && !(rc.pre && rc.pre[i])) {   // the other player's square: nothing of their move on the board until it has been replayed
    const before = (rc.mine && rc.mine[i]) || rc.cpu.start;
    if (before) return { owner: null, mini: before, mv };
  }
  const rk = (rc.resolve || []).findIndex(x => x.square === i);
  if (rk >= 0 && rc.pre && rc.pre[i] && (st !== 'resolve' && st !== 'result' || (st === 'resolve' && rk >= (scUi.rk || 0)))) return { owner: null, mini: rc.pre[i], mv };
  if (st === 'result') {
    const k = scItems(rc).findIndex(x => x.square === i);
    if (k < 0 || k < scUi.k || (k === scUi.k && scUi.phase !== 'clash')) return null;   // its result shown (or none): as it now stands
  }
  if (!rc.view || !rc.view[i]) return null;
  return { owner: null, mini: rc.view[i], mv };
}
// A square as the screen shows it: in the recap, as it was before its claim or reset (a square both won is
// a new game on the record already, while its replay still plays the old one); else as it stands.
export const shownSq = i => scShown(i) || (state.squares ? state.squares[i] : null);
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
  if (paused()) { if (sc.recap && !sc.online && scUi.round === sc.recap.round && scUi.pausedAt == null) scUi.pausedAt = now(); return; }   // (against the computer the recap waits too; in a friend room it goes on, and is caught up with)
  if (sc.recap) { recapStep(); return; }
  if (state.winner) return;
  if (scUi.round !== sc.round) {                                    // a round begins (or goes on after a reload)
    const fresh = sc.deadline == null && sc.held == null;
    scUi = { round: sc.round, readyAt: fresh && !sc.online ? now() + SC_MS.cpu[0] + Math.random() * (SC_MS.cpu[1] - SC_MS.cpu[0]) : 0, stage: null, at: 0, played: false };
    if (fresh && !sc.online) sc.deadline = now() + sc.limit * 1000;
  }
  if (sc.online) {                                                 // a friend room: the move goes in on the record, which settles the round (both in, or the deadline); looked at every second
    const w = scOnlineWait();
    if (w != null) scTimer = setTimeout(chaosStep, w);
    return;
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
  rc.at = now();                                                 // the recap plays from now (a friend room's comes from the record, with its shared start)
  state.sc.deadline = null; state.sc.held = null;
  scUi = { round: null, readyAt: 0, stage: null, at: 0, played: false };
  if (!scAtHole(rc)) { state.screen = 'board'; state.zoom = null; }   // (a Mini Golf shot locked in: the player is at the hole already, where both shots play)
  state.spot = null; state.stamp = null; state.stamps = null;
  commit();
}
// The player waiting at the Mini Golf hole where the round's shots are to play out (theirs locked in there).
export const scAtHole = rc => !!(rc && rc.replay && state.screen === 'mini' && state.zoom === rc.replay.square);
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
// A step of the other player's move as the pop-up plays it: the step's own flash, at the pop-up's speed.
function stepFlash(step, last) { const f = Object.assign({}, step); delete f.after; f.recap = true; f.recapMore = !last; return f; }

// ---- the recap as a sequence timed from its start (rc.at): each part's place and length are known ahead, so a
// phone plays it by the clock (two phones from one shared start play the same part at the same moment; a phone
// coming back joins where the sequence is): a Mini Golf square's shots; the other player's square lit; the
// pop-up, a step of their move at a time (its inputs, then the step's animation at 2x, the last held a second);
// what both moves settle together; each square's result; the match's end ----
function scPlan(rc) {
  const segs = [];
  let t = 0;
  const add = s => { s.start = t; t += s.dur; s.end = t; segs.push(s); return s; };
  if (rc.replay) { const f = golfFlash(rc); add({ kind: 'replay', f, dur: animMs(f) + holdOf(f) }); }
  const joint = mv => !!mv && ((rc.resolve || []).some(x => x.joint && x.square === mv.square) || !!(rc.replay && rc.replay.square === mv.square));   // (both moved there: its replay shows both moves together; Mini Golf's shots, both played out already)
  const popOf = mv => {                                          // the pop-up's steps for a move: the other player's here; this player's on the other phone (a friend room)
    const list = [];
    if (!mv || !mv.steps || !mv.steps.length || joint(mv)) return list;
    const steps = mv.steps, sp = SC_MS.popup;
    steps.forEach((step, k) => {
      const last = k + 1 >= steps.length, f = stepFlash(step, last);
      const inputs = repDuration({ type: mv.type, move: step.m, list: step.rep, timeout: !!step.timeout, speed: sp, lead: k ? 0 : SC_MS.idle, gap: SC_MS.idle });
      const hold = last ? SC_MS.last : Math.min(SC_MS.idle, holdOf(f) / sp);
      list.push({ kind: 'popup', k, step, f, inputs, dur: inputs + animMs(f) / sp + hold });
    });
    return list;
  };
  const pops = popOf(rc.cpu), theirs = rc.mv ? popOf(rc.mv[scHuman(state)]) : [];   // (a friend room: the other phone replays this player's move in the same time; the two pop-ups run to the longer, the shorter's end held)
  const sum = l => l.reduce((a, s) => a + s.dur, 0), pad = Math.max(0, sum(theirs) - sum(pops));
  const anyMove = !!(rc.cpu || (rc.mv && (rc.mv.X || rc.mv.O)));
  add({ kind: 'spot', dur: (anyMove ? SC_MS.spot : 200) + (pops.length ? 0 : pad) });
  if (pops.length) pops[pops.length - 1].dur += pad;
  pops.forEach(add);
  (rc.resolve || []).forEach((it, k) => { const f = Object.assign({}, it.flash); add({ kind: 'resolve', k, it, f, dur: animMs(f) + holdOf(f) }); });
  scItems(rc).forEach((it, k) => {
    if (it.kind === 'claim') add({ kind: 'result', k, phase: 'claim', dur: SC_MS.claim });
    else if (it.kind === 'both') { add({ kind: 'result', k, phase: 'clash', dur: SC_MS.clash }); add({ kind: 'result', k, phase: 'flip', dur: SC_MS.flip }); }
    else add({ kind: 'result', k, phase: 'flip', dur: SC_MS.flip });
  });
  add({ kind: 'end', dur: state.winner ? SC_MS.end : 0 });
  return { segs, total: t };
}
// How long the recap on show takes in all (ms from rc.at).
export function scRecapTotal() { const rc = state.sc && state.sc.recap; return rc ? scPlan(rc).total : 0; }
// A result on show is taken down (the sequence moves on, by the clock, whatever its timer did).
function dropFlash() { clearTimeout(flashTimer); setFlashTimer(null); state.flash = null; repStop(); }
function recapStep() {
  const rc = state.sc.recap;
  if (scUi.round !== rc.round || !scUi.plan) scUi = { round: rc.round, readyAt: 0, stage: 'wait', at: 0, played: false, seg: -1, k: -1, phase: null, rk: 0, step: 0, mini: null, skipped: false, pausedAt: null, plan: scPlan(rc) };
  if (scUi.pausedAt != null) { rc.at += now() - scUi.pausedAt; scUi.pausedAt = null; }   // (the time paused, against the computer: the sequence goes on from where it stopped)
  const plan = scUi.plan, t = tnow() - rc.at;
  if (t < 0) {                                                    // the shared start is a moment ahead: the board as the round left it, until then
    if (scUi.stage !== 'wait') { scUi.stage = 'wait'; render(); }
    scTimer = setTimeout(chaosStep, Math.min(1000, -t + 10));
    return;
  }
  const i = plan.segs.findIndex(s => t < s.end);
  if (i < 0) { recapDone(rc); return; }
  const seg = plan.segs[i];
  if (i !== scUi.seg) { if (state.flash) dropFlash(); scUi.seg = i; enterSeg(rc, seg, t - seg.start); }
  scTimer = setTimeout(chaosStep, Math.max(10, seg.end - t + 10));
}
// A part of the recap begins, e ms into it (0 as a rule; later when the sequence is joined part way).
function enterSeg(rc, seg, e) {
  const cpu = scCpu(), quiet = e > 200, endAbs = rc.at + seg.end;
  state.spot = null;
  if (seg.kind === 'replay') {
    scUi.stage = 'replay';
    state.screen = 'mini'; state.zoom = rc.replay.square; state.draft = ''; state.pick = null; state.sel = [];
    state.flash = Object.assign({}, seg.f);
    playFlash(false, 1, undefined, Math.max(0, endAbs - tnow() - Math.max(0, animMs(seg.f) - e)), e); render();
  } else if (seg.kind === 'spot') {
    scUi.stage = 'spot';
    state.screen = 'board'; state.zoom = null;
    if (rc.cpu) {
      state.spot = { square: rc.cpu.square, by: cpu, label: `${state.setup.names[cpu] || cpu} played here`, html: `${N(cpu)} played here`, sc: rc.round };
      startFx('spot', state.spot, performance.now() - e); if (!quiet) SND.play('spot');
    }
    render();
  } else if (seg.kind === 'popup') {                              // the other player's move replayed at 2x, step by step, in a card over the board
    const steps = rc.cpu.steps, k = seg.k, step = seg.step;
    scUi.stage = 'popup'; scUi.step = k + 1;
    scUi.mini = clone(k ? steps[k - 1].after : rc.cpu.start || (state.sc.base && state.sc.base[rc.cpu.square]) || state.squares[rc.cpu.square].mini);
    state.screen = 'mini'; state.zoom = rc.cpu.square; state.draft = ''; state.pick = null; state.sel = [];
    if (scUi.skipped) { const last = steps[steps.length - 1]; if (last && last.after) scUi.mini = clone(last.after); render(); return; }   // (skipped here: the move's end stays on show while the sequence runs on)
    const sp = SC_MS.popup, f = seg.f;
    repStart({ cpu: true, sq: rc.cpu.square, by: cpu, type: rc.cpu.type, mini: scUi.mini, move: step.m, list: step.rep, timeout: !!step.timeout, speed: sp, lead: k ? 0 : SC_MS.idle, gap: SC_MS.idle, elapsed: e,
      onMove: () => {
        if (step.after) scUi.mini = clone(step.after);
        state.flash = Object.assign({}, f);
        const el = Math.max(0, tnow() - rc.at - (seg.start + seg.inputs));                   // (the move is this far on already, when joined late)
        playFlash(false, sp, SC_MS.idle, Math.max(0, endAbs - tnow() - Math.max(0, animMs(f) / sp - el)), el); render();
      } });
  } else if (seg.kind === 'resolve') {                            // what both moves settle together, in its square (the game's own animation)
    scUi.stage = 'resolve'; scUi.rk = seg.k + 1;
    state.screen = 'mini'; state.zoom = seg.it.square; state.draft = ''; state.pick = null; state.sel = [];
    state.flash = Object.assign({}, seg.f);
    playFlash(false, 1, undefined, Math.max(0, endAbs - tnow() - Math.max(0, animMs(seg.f) - e)), e); render();
  } else if (seg.kind === 'result') {                             // one square's result, on the board: its X or O stamps in; both marks clash (both won it); it turns over to a new game
    scUi.stage = 'result'; scUi.k = seg.k; scUi.phase = seg.phase;
    const it = scItems(rc)[seg.k], key = `sc${rc.round}:${seg.k}`;
    state.screen = 'board'; state.zoom = null; state.stamp = null; state.stamps = null;
    if (seg.phase === 'claim') {
      state.stamp = it.square; state.stamps = [it.square]; state.stampId = `sc${state.id || 'm'}:${rc.round}:${seg.k}`;
      stampFx(e); render();                                       // (the stamp's event first: the board draws it stamping in)
      return;
    }
    if (seg.phase === 'clash') { startFx('scclash', key, performance.now() - e); if (!quiet) { SND.play('stamp'); SND.play('stamp', { at: 0.12 }); SND.play('knock', { at: 0.42 }); } }
    else { startFx('screset', key, performance.now() - e); if (!quiet) SND.play('reset'); }
    render();
  } else if (seg.kind === 'end') {
    scUi.stage = 'end';
    state.screen = 'board'; state.zoom = null; state.stamp = null; state.stamps = null;
    if (state.winner && rc.result && !quiet) { SND.play('swish'); SND.play(matchEndSound(), { at: 0.5 }); }
    render();
  }
}
// The sequence is over: the match's end, or the next round (a friend room's from the record).
function recapDone(rc) {
  if (state.flash) dropFlash();
  scUi = { round: null, readyAt: 0, stage: null, at: 0, played: false };
  if (state.winner) {
    if (state.sc.online) { state.sc.recap = null; state.screen = 'win'; state.zoom = null; state.spot = null; commit(); return; }   // (a friend room: the match stays on the record)
    chaosNext(state, RNG);
    state.screen = 'win'; state.zoom = null; state.spot = null;
    commit();
    return;
  }
  state.screen = 'board'; state.zoom = null; state.spot = null;   // (a round with nothing to claim or reset ends in the pop-up: back to the board)
  if (state.sc.online) { scNextOnline(); return; }              // a friend room: the next round begins on the record (its deadline), and here from it
  chaosNext(state, RNG);
  SND.play('turn');
  commit();
}
// A tap on the replay (or its Skip): the end of the other player's move (every step made, the square as the
// move left it) stays on show. Against the computer the sequence jumps on to the results after a moment; in a
// friend room it runs on at its own pace (the other phone's too), so the two stay together.
export function scSkip() {
  if (scRecapStage() !== 'popup') return false;
  const rc = state.sc.recap, steps = rc.cpu.steps, lastStep = steps[steps.length - 1];
  dropFlash();
  scUi.skipped = true;
  if (lastStep && lastStep.after) scUi.mini = clone(lastStep.after);
  if (!state.sc.online) {
    const pops = scUi.plan.segs.filter(s => s.kind === 'popup'), end = pops[pops.length - 1].end;
    rc.at = Math.min(rc.at, now() - (end - SC_MS.skip));          // (the sequence set so the pop-up's end comes after the skip's moment)
  }
  render(); chaosStep();
  return true;
}
// The square each player played last (the board's badges): the human's this round once it is in, else
// the last round's; the computer's from the last round resolved (the recap reveals this round's).
export function scLastPlayed() {
  if (!live()) return null;
  const sc = state.sc, me = scHuman(state), cpu = other(me), rc = sc.recap, early = rc && rc.lastBefore !== undefined && (!scRecapStage() || ['wait', 'replay'].includes(scRecapStage()));
  const last = (early ? rc.lastBefore : sc.last) || {}, mine = rc ? rc.me : null;   // (the other player's badge moves only once the recap shows their square)
  return { [me]: sc.me ? sc.me.square : mine != null ? mine : last[me] != null ? last[me] : null, [cpu]: last[cpu] != null ? last[cpu] : null };
}
// The board's line under the squares in a Super Chaos round.
export function scHint() {
  const sc = state.sc, cpu = other(scHuman(state));
  if (sc.recap) return scRecapStage() === 'wait' ? 'Both moves in · settling the round…' : `Round ${sc.recap.round} · results`;
  if (sc.me) return sc.oppIn ? `${N(cpu)} has moved · settling the round…` : `Waiting for ${N(cpu)}…${sc.online ? ` <span class="scleft">${fmtClock(scClockLeft() || 0)}</span>` : ''}`;   // (a friend room: the round's clock, the same on both phones)
  return sc.oppIn ? `${N(cpu)} has moved · tap any open square` : `Round ${sc.round} · tap any open square`;
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
