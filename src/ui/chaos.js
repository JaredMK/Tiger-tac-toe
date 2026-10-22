// Super Chaos on screen (the rules: core/chaos.js). The round's clock (paused with the menu or an explainer;
// in a friend room the record's, in server time, the same on both phones), the end of the round once both
// moves are in (the computer's taking a person's time, "Waiting for…" until then), and the recap on the main
// board, a sequence timed from one start (scPlan): a Mini Golf square plays both shots first; then the other
// player's square lights up; then a pop-up over the board replays their move at 2x (its inputs, then each step
// of the move with its usual animation: ui/replay.js); then what only both moves together settle plays in its
// square (a Bump knock, a Clash Grid collision: resolve); then each square's result on the board, one at a time: its
// X or O stamping in, or (both won it) both marks clashing and the square turning over to a new game; then
// the next round, or the match's end. Online each phone plays the sequence from the record's start (server
// time; the last mover's phone once its own result has played), at its own pace (a skip jumps it on), and the
// next round begins once both phones are through it; a phone coming back joins where it is.
import { chaosNext, chaosResolve, chaosTimeout, scHuman, scRecapOrder } from '../core/chaos.js';
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
import { scFailText, scNextOnline, scOnlineWait } from '../net/chaos.js';
import { holdOf, playFlash } from './turns.js';
import { devError, matchLog } from '../net/tracking.js';

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
// The human's move is in (or their time is up), the round is being shown, or (online) the next round has not
// begun on the record yet (the other phone still in its recap): nothing to play until the next round.
export function scWaiting() { const sc = live() && state.sc; return !!sc && !state.winner && !!(sc.me || sc.recap || sc.missed === sc.round || scHeld()); }
// Online: this phone is through the recap and the next round waits for the other phone's (no deadline yet).
export const scHeld = () => { const sc = live() && state.sc; return !!sc && !!sc.online && !sc.recap && !state.winner && sc.deadline == null; };
export function scRecapStage() { return live() && state.sc.recap && scUi.round === state.sc.recap.round ? scUi.stage : null; }
export const scPopup = () => scRecapStage() === 'popup';                   // the recap's pop-up replay of the computer's move is up
export const scCpu = () => other(scHuman(state));
// What a square shows while the recap has not reached its result: both moves in, nothing claimed (a square
// still to be settled together: both moves made, nothing knocked or spun yet); the computer's square in the
// pop-up: its move as far as the replay has got; once the results play, a square not reached yet.
export function scShown(i) {
  const rc = live() && state.sc.recap, st = rc ? scRecapStage() || 'wait' : null;   // (a recap not under way here yet: the board as the round left it, never its settled squares)
  if (!rc || !['wait', 'replay', 'spot', 'popup', 'resolve', 'result'].includes(st)) return null;
  const mv = state.squares[i].mv;
  if (st === 'popup' && rc.cpu && rc.cpu.square === i && scUi.mini) return { owner: null, mini: scUi.mini, mv };
  if (rc.cpu && rc.cpu.square === i && ['wait', 'replay', 'spot'].includes(st) && !(rc.pre && rc.pre[i])) {   // the other player's square: nothing of their move on the board until it has been replayed
    const before = (rc.mine && rc.mine[i]) || rc.cpu.start;
    if (before) return { owner: null, mini: before, mv };
  }
  const rk = (rc.resolve || []).findIndex(x => x.square === i), played = scUi.plan && scUi.round === rc.round ? scUi.plan.segs.slice(0, scUi.seg + 1).some(s => s.kind === 'resolve' && s.k === rk) : false;
  if (rk >= 0 && rc.pre && rc.pre[i] && st !== 'result' && !played) return { owner: null, mini: rc.pre[i], mv };   // (settled together: as it stood before, until its part plays)
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

const segSquare = (rc, seg) => (seg.kind === 'replay' ? rc.replay.square : seg.it ? seg.it.square : null);
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
    if (fresh && !sc.online) { sc.deadline = now() + sc.limit * 1000; matchLog({ k: 'round', r: sc.round }); }   // (against the computer: the phone's log of the match; a friend room's is the server's)
  }
  if (sc.online) {                                                 // a friend room: the move goes in on the record, which settles the round (both in, or the deadline); looked at every second
    const w = scOnlineWait();
    if (w != null) scTimer = setTimeout(chaosStep, w);
    return;
  }
  if ((sc.me || sc.missed === sc.round) && !state.flash && !state.done && state.lock == null) {   // the human's move is in (or their time ran out), its result seen: the round ends once the computer's is too
    const wait = scUi.readyAt - now();
    if (wait > 0) { scTimer = setTimeout(chaosStep, wait); return; }
    endRound();
  }
}
// The round's time is up (the clock's tick): nothing is played for the human (core/chaos.js chaosTimeout): with
// no move made they miss the round; a move under way ends as it stands. In a match the server runs, its own
// clock decides (net/chaos.js asks it); here the round is simply over for this phone.
export function scTick() {
  if (!live() || paused() || state.winner) return;
  const left = scClockLeft(), sc = state.sc;
  if (left == null || left > 0 || sc.me || sc.missed === sc.round) return;
  if (state.online && state.online.kind === 'mm') {               // (a match the server runs: a move under way is ended there, at its sweep)
    if (state.lock == null && sc.moved == null && !state.flash) { sc.missed = sc.round; leaveMissed(); }
    return;
  }
  const r = chaosTimeout(state, RNG);
  if (!r.ok) return;
  matchLog({ k: 'timeout', r: sc.round, q: r.square, g: r.square != null && state.squares[r.square] ? state.squares[r.square].mini.type : undefined, missed: r.missed || undefined });
  if (r.missed) { leaveMissed(); return; }
  if (r.closed) { state.screen = 'mini'; state.zoom = r.square; state.spot = null; playFlash(); commit(); return; }   // the move under way, ended where it was (a bank, a stand)
  commit();
}
// The round's time ran out with no move made: back to the board, where the round ends.
function leaveMissed() {
  state.lock = null; state.draft = ''; state.pick = null; state.sel = [];
  if (state.screen === 'mini') { state.screen = 'board'; state.zoom = null; }
  SND.play('error');
  commit();
}
function endRound() {
  const rc = chaosResolve(state, RNG);
  if (!rc) return;
  const typ = i => (rc.view && rc.view[i] ? rc.view[i].type : state.squares[i] && state.squares[i].mini.type);
  matchLog({ k: 'resolve', r: rc.round, me: rc.me != null ? rc.me : undefined, mg: rc.me != null ? typ(rc.me) : undefined, missed: rc.missed && rc.missed.length ? rc.missed.join('') : undefined, cpu: rc.cpu ? rc.cpu.square : undefined, cg: rc.cpu ? rc.cpu.type : undefined,
    claims: rc.claims.map(c => c.square + c.by).join(' ') || undefined, resets: rc.resets.map(x => `${x.square}:${x.why}`).join(' ') || undefined, w: rc.result ? rc.result.winner : undefined });
  rc.at = now();                                                 // the recap plays from now (a friend room's comes from the record, with its shared start)
  state.sc.deadline = null; state.sc.held = null;
  scUi = { round: null, readyAt: 0, stage: null, at: 0, played: false };
  if (!scAtHole(rc)) { state.screen = 'board'; state.zoom = null; }   // (a Mini Golf shot locked in, a Bump spin: the player is in the square already, where it plays out)
  state.spot = null; state.stamp = null; state.stamps = null;
  commit();
}
// The player waiting in their own square where the recap begins: their Mini Golf shot locked in there, or a move
// settled there only now (both shots, the knock, the shared spin play out where they are).
export function scAtHole(rc) {
  if (!rc || state.screen !== 'mini' || state.zoom == null) return false;
  const i = state.zoom;
  return i === ownSq(rc, scHuman(state)) && (!!(rc.replay && rc.replay.square === i) || (rc.resolve || []).some(x => x.square === i));
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
// A step of the other player's move as the pop-up plays it: the step's own flash, at the pop-up's speed.
function stepFlash(step, last) { const f = Object.assign({}, step); delete f.after; f.recap = true; f.recapMore = !last; return f; }

// ---- the recap as a sequence timed from its start (rc.at): each part's place and length are known ahead, so a
// phone plays it by the clock (two phones from one shared start reach the results at the same moment; a phone
// coming back joins where the sequence is). First this player's own outcome, where it is settled only now: their
// Mini Golf shot; what both moves settle in their square (a Bump knock, a Clash Grid collision), both moves played
// together in their own view when both played there. Then the other player's move: their square lit, the pop-up
// replaying it a step at a time (its inputs, then the step's animation at 2x, the last held a second), or their
// Mini Golf shot; none when both played one square and its joint result has shown it. Then what their move
// settles in their square; each square's result; the match's end ----
const SC_OWN = new Set();                                          // the rounds whose own outcome this phone has shown (kept over a reload)
const ownKey = rc => `${state.id || 'm'}:${rc.round}`;
const ownSeen = rc => { if (SC_OWN.has(ownKey(rc))) return true; try { return sessionStorage.getItem('scOwn') === ownKey(rc); } catch (e) { return false; } };
function ownShown(rc) { SC_OWN.add(ownKey(rc)); try { sessionStorage.setItem('scOwn', ownKey(rc)); } catch (e) { /* (this visit only) */ } }
// Likewise the other player's replay: a phone that reaches it late the first time (its own result still playing, a
// slow answer from the server, the app reopened) plays it from its start, never a moment of it; once played through,
// a reload joins where the sequence is.
const SC_OPP = new Set(), SC_OPP_ON = new Set();
const oppSeen = rc => { if (SC_OPP.has(ownKey(rc))) return true; try { return sessionStorage.getItem('scOpp') === ownKey(rc); } catch (e) { return false; } };
function oppShownDone(rc) { SC_OPP.add(ownKey(rc)); try { sessionStorage.setItem('scOpp', ownKey(rc)); } catch (e) { /* (this visit only) */ } }
function oppCatchUp(rc, plan) {
  const spot = plan.segs.find(s => s.kind === 'spot');
  if (!spot || !rc.cpu || oppSeen(rc) || SC_OPP_ON.has(ownKey(rc))) return;   // (once it has begun here, the sequence is joined where it is)
  const t = tnow() - rc.at;
  if (t > spot.start + 250) rc.at = tnow() - spot.start;          // (this phone only: the next round waits for it)
}
// The square this player played this round (a friend room's from the record's moves).
const ownSq = (rc, side) => (rc.mv ? (rc.mv[side] && rc.mv[side].square != null ? rc.mv[side].square : null) : rc.me);
function scParts(rc, mine, opp) {   // mine: the square this player played; opp: the other player's move (core/chaos.js scRecapOrder: the order)
  const parts = [];
  for (const o of scRecapOrder(rc, mine, opp)) {
    if (o.kind === 'replay') { const f = golfFlash(rc); parts.push({ kind: 'replay', f, own: !!o.own, pop: !o.own, dur: animMs(f) + holdOf(f) }); }   // (pop: the other player's, in the replay pop-up like any other move)
    else if (o.kind === 'resolve') { const it = rc.resolve[o.k], f = Object.assign({}, it.flash); parts.push({ kind: 'resolve', k: o.k, it, f, own: !!o.own, pop: !o.own, dur: animMs(f) + holdOf(f) }); }
    else if (o.kind === 'spot') parts.push({ kind: 'spot', dur: opp ? SC_MS.spot : 200 });
    else {                                                        // the pop-up: a step of their move at a time
      const steps = opp.steps, sp = SC_MS.popup;
      steps.forEach((step, k) => {
        const last = k + 1 >= steps.length, f = stepFlash(step, last);
        const inputs = repDuration({ type: opp.type, move: step.m, list: step.rep, timeout: !!step.timeout, speed: sp, lead: k ? 0 : SC_MS.idle, gap: SC_MS.idle });
        const hold = last ? SC_MS.last : Math.min(SC_MS.idle, holdOf(f) / sp);
        parts.push({ kind: 'popup', k, step, f, inputs, dur: inputs + animMs(f) / sp + hold });
      });
    }
  }
  return parts;
}
function scPlan(rc) {
  const segs = [], me = scHuman(state);
  let t = 0;
  const add = s => { s.start = t; t += s.dur; s.end = t; segs.push(s); return s; };
  const parts = scParts(rc, ownSq(rc, me), rc.cpu);              // (online, each phone at its own pace: the next round begins once both are through)
  parts.forEach(add);
  scItems(rc).forEach((it, k) => {
    if (it.kind === 'claim') add({ kind: 'result', k, phase: 'claim', dur: SC_MS.claim });
    else if (it.kind === 'both') { add({ kind: 'result', k, phase: 'clash', dur: SC_MS.clash }); add({ kind: 'result', k, phase: 'flip', dur: SC_MS.flip }); }
    else add({ kind: 'result', k, phase: 'flip', dur: SC_MS.flip });
  });
  add({ kind: 'end', dur: state.winner ? SC_MS.end : 0 });
  const opp = rc.cpu, mine = ownSq(rc, me);
  if (opp && opp.square != null && !parts.some(p => p.kind === 'popup' || p.pop) && !(opp.square === mine && parts.some(p => p.own))) replayError(rc, `no replay of the other move (square ${opp.square}, ${opp.type || '?'}: ${opp.steps ? opp.steps.length : 'no'} steps)`);   // (never an empty pop-up: the board goes on, the match log says why)
  return { segs, total: t };
}
// This player's own outcome is in the recap and not shown yet: a phone that joins the recap after it began (out of
// sight, the menu open, the app reopened) plays it from its start all the same, the rest after it.
export function scOppDue() {   // the other player's replay in the recap, not played through here yet
  const rc = state.sc && state.sc.recap;
  return !!rc && !!rc.cpu && !oppSeen(rc) && !SC_OPP_ON.has(ownKey(rc)) && scPlan(rc).segs.some(s => s.kind === 'popup' || s.pop);
}
export function scOwnDue() {
  const rc = state.sc && state.sc.recap;
  return !!rc && !ownSeen(rc) && scPlan(rc).segs.some(s => s.own);
}
function ownCatchUp(rc, plan) {
  const first = plan.segs.find(s => s.own);
  if (!first) return;
  if (ownSeen(rc)) return;
  const t = tnow() - rc.at;
  if (t > first.start + 250) rc.at = tnow() - first.start;        // (this phone only: its results come that much later, the next round waits for it)
}
// How long the recap on show takes in all (ms from rc.at).
export function scRecapTotal() { const rc = state.sc && state.sc.recap; return rc ? scPlan(rc).total : 0; }
// A result on show is taken down (the sequence moves on, by the clock, whatever its timer did).
function dropFlash() { clearTimeout(flashTimer); setFlashTimer(null); state.flash = null; repStop(); }
function recapStep() {
  const rc = state.sc.recap;
  if (scUi.round !== rc.round || !scUi.plan) { scUi = { round: rc.round, readyAt: 0, stage: 'wait', at: 0, played: false, seg: -1, k: -1, phase: null, rk: 0, step: 0, mini: null, skipped: false, pausedAt: null, oppShown: false, plan: scPlan(rc) }; ownCatchUp(rc, scUi.plan); }
  oppCatchUp(rc, scUi.plan);                                      // (every step until the other's replay has begun here: a phone that was held up, frozen or out of sight, starts it from its start)
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
  if (i !== scUi.seg) {
    if (state.flash) dropFlash();
    scUi.seg = i;
    if (!seg.own && plan.segs.some(s => s.own)) ownShown(rc);   // (its own outcome is over: not again, after a reload)
    const lastPop = plan.segs.map(s => s.kind === 'popup' || s.pop).lastIndexOf(true);
    if (lastPop >= 0 && i > lastPop) oppShownDone(rc);
    if (seg.kind === 'spot' || seg.kind === 'popup' || seg.pop) SC_OPP_ON.add(ownKey(rc));            // (the other player's replay played through)
    if (seg.kind === 'spot' || (seg.own && rc.cpu && rc.cpu.square === segSquare(rc, seg))) scUi.oppShown = true;   // (the other player's square: lit, or played together with this one)
    enterSeg(rc, seg, t - seg.start);
  }
  scTimer = setTimeout(chaosStep, Math.max(10, seg.end - t + 10));
}
// A replay that cannot play: the match log says so (once a round), and the recap goes on without it.
const REPLAY_ERR = new Set();
function replayError(rc, msg) { const k = `${ownKey(rc)}:${msg}`; if (REPLAY_ERR.has(k)) return; REPLAY_ERR.add(k); try { devError('replay', `round ${rc.round}: ${msg}`); } catch (e) { /* (the log is never worth an error) */ } }
// A part of the recap begins, e ms into it (0 as a rule; later when the sequence is joined part way).
function enterSeg(rc, seg, e) {
  const cpu = scCpu(), quiet = e > 200, endAbs = rc.at + seg.end;
  state.spot = null;
  if (seg.kind === 'replay') {
    scUi.stage = seg.pop ? 'popup' : 'replay'; scUi.mini = null;
    state.screen = 'mini'; state.zoom = rc.replay.square; state.draft = ''; state.pick = null; state.sel = [];
    if (seg.pop && scUi.skipped) { render(); return; }            // (skipped: its end on show)
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
    if (!step || !steps || !steps[k]) { replayError(rc, `replay step ${k} missing`); scUi.stage = 'spot'; state.screen = 'board'; state.zoom = null; render(); return; }
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
    scUi.stage = seg.pop ? 'popup' : 'resolve'; scUi.rk = seg.k + 1; scUi.mini = null;
    state.screen = 'mini'; state.zoom = seg.it.square; state.draft = ''; state.pick = null; state.sel = [];
    if (seg.pop && scUi.skipped) { render(); return; }
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
  oppShownDone(rc);                                               // (through the recap: the other's replay not again)
  if (state.flash) dropFlash();
  ownShown(rc);                                                   // (through the whole sequence: its own outcome with it)
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
// move left it) stays on show, and the sequence jumps on to the results after a moment (online too: each phone
// goes at its own pace, and the next round begins once both are through).
export function scSkip() {
  if (scRecapStage() !== 'popup') return false;
  const rc = state.sc.recap, seg = scUi.plan.segs[scUi.seg], steps = rc.cpu ? rc.cpu.steps || [] : [], lastStep = steps[steps.length - 1];
  dropFlash();
  scUi.skipped = true;
  if (seg && seg.kind === 'popup' && lastStep && lastStep.after) scUi.mini = clone(lastStep.after);
  const pops = scUi.plan.segs.filter(s => s.kind === 'popup' || s.pop), end = pops[pops.length - 1].end;
  rc.at = Math.min(rc.at, tnow() - (end - SC_MS.skip));           // (the sequence set so the pop-up's end comes after the skip's moment)
  render(); chaosStep();
  return true;
}
// The square each player played last (the board's badges): the human's this round once it is in, else
// the last round's; the computer's from the last round resolved (the recap reveals this round's).
export function scLastPlayed() {
  if (!live()) return null;
  const sc = state.sc, me = scHuman(state), cpu = other(me), rc = sc.recap, early = rc && rc.lastBefore !== undefined && (!scRecapStage() || (['wait', 'replay', 'resolve'].includes(scRecapStage()) && !scUi.oppShown));
  const last = (early ? rc.lastBefore : sc.last) || {}, mine = rc ? rc.me : null;   // (the other player's badge moves only once the recap shows their square)
  return { [me]: sc.me ? sc.me.square : mine != null ? mine : last[me] != null ? last[me] : null, [cpu]: last[cpu] != null ? last[cpu] : null };
}
// The board's line under the squares in a Super Chaos round.
export function scHint() {
  const sc = state.sc, me = scHuman(state), cpu = other(me);
  if (sc.recap) {
    const ms = sc.recap.missed || [], st = scRecapStage();
    if (!st || st === 'wait') return `Waiting for ${N(cpu)}…`;
    return ms.length ? `Round ${sc.recap.round} · ${ms.length === 2 ? 'both missed it' : ms[0] === me ? 'you missed it' : `${N(ms[0])} missed it`}` : `Round ${sc.recap.round} · results`;
  }
  if (scHeld()) return `Waiting for ${N(cpu)}…`;                  // (online: the other phone still in its recap; the next round begins with both)
  if (sc.missed === sc.round) return `Time's up · Round ${sc.round} missed`;
  if (sc.me && sc.online && sc.fail) return `<span class="scfail">Move not saved (${scFailText(sc.fail.code)}) · trying again…</span>`;   // (a friend room: the record refused or could not take the move; sent again every second)
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
