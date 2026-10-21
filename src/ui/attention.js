// The attention-game framework (Headcount, Flash, Snapshot): Start locks the player in, three levels,
// first to 3 correct; the shared table around each game's view.
import { ATT, ATT_TYPES, attMs, attStart } from '../games/shared/attention.js';
import { flashView } from '../games/flash/view.js';
import { headView } from '../games/headcount/view.js';
import { snapView } from '../games/snapshot/view.js';
import { SND } from '../audio/sound.js';
import { FIREBASE_CONFIG, configured } from '../net/connect.js';
import { dbStart } from '../net/moves.js';
import { blocked, remoteTurn } from '../net/room.js';
import { N, REDUCED, cpuPlays, esc, save, state, zoomedType } from './app.js';
import { KEY } from './config.js';
import { fxAttr } from './fx.js';
import { arcTally, lateAt, pips } from './progress.js';
import { render } from './render.js';
import { cpuTurn } from './turns.js';

// Headcount's, Flash's and Snapshot's difficulty (config/headcount, config/flash, config/snapshot): likewise.
export function fetchAttConfig(name, set, cleared) {   // cleared: nothing in the database puts the defaults back (the Mini-game Settings' reset)
  const k = KEY + '.' + name + 'cfg';
  try { const v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && typeof v === 'object') set(v); } catch (e) { /* none kept */ }
  if (!configured()) return;
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const url = hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}/config/${name}.json?ns=${c.projectId}-default-rtdb` : `${c.databaseURL}/config/${name}.json`;
  try {
    fetch(url).then(r => (r.ok ? r.json() : null)).then(v => {
      if (!v || typeof v !== 'object') { if (cleared && v === null) { set(null); try { localStorage.removeItem(k); } catch (e) { /* (none kept) */ } } return; }
      set(v);
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no storage: read again next visit */ }
    }).catch(() => {});
  } catch (e) { /* offline: as last known */ }
}
// ---------- Headcount, Flash and Snapshot: the attention games ----------
// A square opens on a Start button (and Board to leave). Start plays the player's round, timed from the
// tap (a reload carries on from there, never from the top), and holds them to the square until the
// answer goes in: Headcount's creatures cross the field, then a number pad; Flash's items flash in the
// middle, then a question with four options; Snapshot's pattern shows for a few seconds with a countdown,
// then the grid empties and they tap it back in and Submit. The result shows the right answer for a
// moment. Someone else's round (the computer's, the other phone's) plays first at its own speed, then
// their answer, then the result. Nothing around the play area moves as the words change: each area keeps
// its size from Start to the result.
export const ATT_KEY = 'ttt-att-started';
export let attDraft = null;                                            // { id, sq, at, entry, timer }: this phone's round under way (at: Date.now() of Start); entry: the digits typed, or the cells picked
const attId = (sq, p) => { const m = state.squares[sq].mini; return `${state.online ? state.online.matchId || state.online.code || 'on' : 'local'}:${state.moves}:${sq}:${p}:${m.type}:${m.right[p]}`; };
export function attPre(f) { return f && ATT_TYPES.includes(f.type) && f.att && !f.timeout && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? attMs(f.type, f.att.round) + ATT.pause : 0; }   // someone else's round plays first, then their answer
export const attPinned = () => !!(attDraft && state.screen === 'mini' && state.zoom === attDraft.sq && !state.flash);
export function attSave() { try { localStorage.setItem(ATT_KEY, JSON.stringify({ id: attDraft.id, at: attDraft.at, entry: attDraft.entry })); } catch (e) { /* no storage: a reload starts the answer over */ } }
// A redraw when the round has played: the answer's turn.
function attArm(type, round) {
  clearTimeout(attDraft.timer);
  const left = attDraft.at + attMs(type, round) - Date.now();
  if (left > 0) { const id = attDraft.id; attDraft.timer = setTimeout(() => { if (attDraft && attDraft.id === id) render(); }, left + 30); }
}
export function attTable(mini, a, o) {
  const type = mini.type, f = a && a.att ? a.att : null, l = mini.last, turn = o.turn, pre = f ? attPre(a) : 0;
  const tal = p => arcTally(p, o, pips(p, Math.min(ATT.goal, mini.right[p]), ATT.goal, !!(f && f.correct && a.by === p), pre + 250));
  const shown = f || ((o.done || o.view) && l ? l : null);
  const mine = !o.view && !shown && !cpuTurn() && !remoteTurn();   // this phone's round to play (kept through a dropped connection or an answer on its way: still held to the square)
  const live = mine && !o.locked;                               // the controls answer only while this phone can send the move
  if (!mine) { if (attDraft) clearTimeout(attDraft.timer); attDraft = null; }
  else {
    const id = attId(o.zoom, turn);
    if (attDraft && attDraft.id !== id) { clearTimeout(attDraft.timer); attDraft = null; }
    if (!attDraft) { let v = null; try { v = JSON.parse(localStorage.getItem(ATT_KEY) || 'null'); } catch (e) { /* none kept */ } if (v && v.id === id && Number.isFinite(v.at)) attDraft = { id, sq: o.zoom, at: v.at, entry: v.entry != null ? v.entry : type === 'snapshot' ? [] : '' }; }
  }
  const started = mine && !!attDraft, round = shown ? shown.round : mini.round[turn];
  if (!round) return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><p class="arcnote">No round here.</p></div>`;
  if (started) attArm(type, round);
  const len = attMs(type, round), since = started ? Date.now() - attDraft.at : 0, playing = started && since < len, answering = started && !playing;
  const c = { o, f, shown, pre, started, playing, answering, live, round, len, startPerf: started ? performance.now() - since : null };
  const v = type === 'headcount' ? headView(c) : type === 'flash' ? flashView(c) : snapView(c);
  const who = shown ? shown.by || (f && a.by) : turn, W = p => `<b class="${p}">${N(p)}</b>`;
  const truth = shown ? v.say(shown.truth) : '';
  const result = shown ? (shown.correct ? `${pre || o.view || o.done ? W(who) + ' got it right' : 'Right!'}${type === 'headcount' ? ': ' + truth : ''}`
    : `${pre || o.view || o.done ? W(who) + (shown.answer == null ? ' ran out of time' : ' got it wrong') : shown.answer == null ? 'Out of time' : 'Not quite'} · it was ${truth}`) : '';
  // the words: one box, two lines tall, whatever it says (so nothing below it moves); a view may give them as HTML (Headcount: the creature's picture by its name)
  const vw = () => v.watchHtml || esc(v.watch), va = () => v.askHtml || esc(v.ask);
  const words = shown ? (pre ? `<span class="tu" style="--u:${len}ms">${vw()}</span><span class="tf tu2" style="--f:${len}ms;--u:${pre}ms">${va()}</span><span ${lateAt('arcres ' + (shown.correct ? 'ok' : 'no'), pre)} role="status">${result}</span>` : `<span class="arcres ${shown.correct ? 'ok' : 'no'}" role="status">${result}</span>`)
    : playing ? `<span class="atstack"${fxAttr(c.startPerf)}><span class="tu" style="--u:${len - since}ms">${vw()}</span><span class="tf" style="--f:${len - since}ms">${va()}</span></span>`
    : answering ? `<span>${va()}</span>`
    : mine ? `<span>Level ${round.level + 1} of 3${v.watch ? ' · ' + vw() : ''}</span>`
    : o.view ? '' : `<span>${W(turn)}'s turn</span>`;   // (each in one span: the box is a grid, and a picture in the line stays in the line)
  const go = mine && !started, sub = type === 'snapshot' && answering;
  const btn = o.view ? '' : `<div class="cbtns one${go || sub ? '' : ' hold'}">${go ? `<button class="big" data-act="att-start"${live ? '' : ' disabled'}>Start</button>` : sub ? `<button class="big" data-act="snap-submit"${live ? '' : ' disabled'}>Submit</button>` : '<button class="big" disabled tabindex="-1" aria-hidden="true">Start</button>'}</div>`;   // the row stays (hidden) so nothing moves
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="att att-${type}"><div class="atstage">${v.stage}</div><p class="atwords">${words}</p>${v.input}</div>${btn}</div>`;
}
export function attentionMiniature(mini, final) {
  return `<div class="tpip">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: ATT.goal }, (_, k) => `<i class="${k < mini.right[p] ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;   // both players' progress: ●●○
}
export function attentionSounds(f, add, won, mini, last) {   // someone else's round: as it played (Start, the round's own sounds), their answer, then the result
  const pre = attPre(f), r = f.att && f.att.round;
  if (pre && r) {
    if (f.type === 'flash') { add('go', 0); r.items.forEach((_, i) => add('tickSoft', i * r.ms)); }
    else if (f.type === 'headcount') add('go', 0);
    else { add('reveal', 0); add('flipDown', r.show); for (let k = 1; k < Math.ceil((r.wait || 0) / 1000); k++) add('tickSoft', r.show + k * 1000); if (r.wait) add('go', r.show + r.wait); }
    add('tap', attMs(f.type, r));
  }
  if (f.att) add(f.att.correct ? 'ding' : 'thud', pre + 250);
  return;
}
// Headcount, Flash, Snapshot: the round plays, timed from now; from here the player stays in the square until the answer goes in
export function attStartAct(el, e, act) {
  const type = zoomedType();
  if (!ATT_TYPES.includes(type) || attDraft || state.flash || state.done || blocked()) return;
  const sq = state.squares[state.zoom], r = sq.mini.round[state.turn];
  attDraft = { id: attId(state.zoom, state.turn), sq: state.zoom, at: Date.now(), entry: type === 'snapshot' ? [] : '' };
  attSave();
  attStart(state, state.zoom, state.turn);                    // held to the square: here, and on the server (where a timeout then answers this round, wrong)
  if (state.online && !state.sc) dbStart(state.zoom); else save();   // (Super Chaos: held on this phone)
  const len = attMs(type, r) / 1000;
  if (type === 'headcount') { SND.play('go'); SND.play('reveal', { at: len }); }
  else if (type === 'flash') { SND.play('go'); r.items.forEach((_, i) => SND.play('tickSoft', { at: (i * r.ms) / 1000 })); SND.play('reveal', { at: len }); }
  else { SND.play('reveal'); SND.play('flipDown', { at: r.show / 1000 }); for (let k = 1; k < Math.ceil((r.wait || 0) / 1000); k++) SND.play('tickSoft', { at: r.show / 1000 + k }); if (r.wait) SND.play('go', { at: len }); }   // the pattern, the grid blank (each second of the countdown), then the taps
  render();
}
