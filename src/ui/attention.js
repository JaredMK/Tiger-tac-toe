// The attention-game framework (Headcount, Flash, Snapshot): Start locks the player in, three levels,
// first to 3 correct; the shared table around each game's view.
import { ATT, ATT_TYPES, attMs, attStart } from '../games/shared/attention.js';
import { pipRows, thumbArt } from './thumbs.js';
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
import { ownMove } from './haptics.js';
import { arcTally, lateAt } from './progress.js';
import { QUIZ, quizPips, quizPoint } from './quiz.js';
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
// The polish pass (November 2026; the rounds themselves untouched: the same things for the same times at the same
// sizes): Start and Submit carry the mover's colour; the words' line leads with the phase (an eye while the round
// plays, a "?" in the mover's colour once it is the answer's turn); an answer is pressed in at once and its verdict
// lands QUIZ.beat later (ui/quiz.js: the tick or the cross, the result's words, the ding or the thud and the buzz), a
// right one's point flying from the answer (the view's anchor 'qpick') to the pip, which fills as it lands; someone
// else's answer is put in as they would (ATT_T: the digits typed, the option pressed, the cells picked) before theirs.
export const ATT_T = { type: 150, step: 230, pick: 480, cells: 120, cellStep: 60, cellSpan: 420, send: 680 };   // ms after someone else's round has played (all inside ATT.pause): the first digit and each next one; the option's press; the first cell, each next (within cellSpan in all); OK or Submit
const ATT_EYE = '<i class="atph eye" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2.5 12q9.5-11 19 0q-9.5 11-19 0z" fill="#fff" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.6" fill="currentColor"/></svg></i>';
const ATT_ASK = '<i class="atph ask" aria-hidden="true">?</i>';
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
  const T = f ? pre + QUIZ.beat : null;                         // the verdict's moment into the move
  const tal = p => arcTally(p, o, quizPips(p, Math.min(ATT.goal, mini.right[p]), ATT.goal, !!(f && f.correct && a.by === p), T, o.won));
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
  const who = shown ? (f ? a.by : shown.by) || turn : turn;   // whose round is on the screen: its colour on the controls, the timer and the question's mark
  const c = { o, f, shown, pre, T, fresh: !!f && !REDUCED, who, started, playing, answering, live, round, len, startPerf: started ? performance.now() - since : null };   // fresh: a move's verdict still to land (T into it)
  const v = type === 'headcount' ? headView(c) : type === 'flash' ? flashView(c) : snapView(c);
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const truth = shown ? esc(v.say(shown.truth)) : '';
  const named = !f || !ownMove(a);                              // someone else's round, or one looked at later: who it was (this phone's own, as it lands: the verdict alone)
  const two = (x, y) => `<span class="atr">${x}</span> <span class="atr">${y}</span>`;   // (the line's two halves: where it takes two lines, it breaks between them)
  const result = shown ? (shown.correct ? (type === 'headcount' ? two(named ? W(who) + ' got it right:' : 'Right!', truth) : named ? W(who) + ' got it right' : 'Right!')
    : two(`${named ? W(who) + (shown.answer == null ? ' ran out of time' : ' got it wrong') : shown.answer == null ? 'Out of time' : 'Not quite'} ·`, `it was ${truth}`)) : '';
  // the words: one box, two lines tall, whatever it says (so nothing below it moves); a view may give them as HTML (Headcount: the creature's picture by its name); the phase's mark leads the line
  const vw = () => ATT_EYE + (v.watchHtml || esc(v.watch)), va = () => ATT_ASK + (v.askHtml || esc(v.ask));
  const res = `<span ${lateAt('arcres ' + (shown && shown.correct ? 'ok' : 'no'), c.fresh ? T : null)} role="status">${result}</span>`;
  const words = shown ? (pre ? `<span class="tu" style="--u:${len}ms">${vw()}</span><span class="tf tu2" style="--f:${len}ms;--u:${T}ms">${va()}</span>${res}`
      : c.fresh ? `<span class="tu" style="--u:${T}ms">${shown.answer == null ? '' : va()}</span>${res}` : res)   // (this phone's own answer: the question stays the beat the verdict takes)
    : playing ? `<span class="atstack"${fxAttr(c.startPerf, 'rt')}><span class="tu" style="--u:${len - since}ms">${vw()}</span><span class="tf" style="--f:${len - since}ms">${va()}</span></span>`
    : answering ? `<span>${va()}</span>`
    : mine ? `<span>Level ${round.level + 1} of 3${v.watch ? ' · ' + (v.watchHtml || esc(v.watch)) : ''}</span>`
    : o.view ? '' : `<span>${W(turn)}'s turn</span>`;   // (each in one span: the box is a grid, and a picture in the line stays in the line)
  const go = mine && !started, sub = type === 'snapshot' && answering;
  const btn = o.view ? '' : `<div class="cbtns one${go || sub ? '' : ' hold'}">${go ? `<button class="big ${turn}" data-act="att-start"${live && attStarting == null ? '' : ' disabled'}>Start</button>` : sub ? `<button class="big ${turn}" data-act="snap-submit"${live ? '' : ' disabled'}>Submit</button>` : '<button class="big" disabled tabindex="-1" aria-hidden="true">Start</button>'}</div>`;   // the row stays (hidden) so nothing moves; Start and Submit in the mover's colour
  const phase = shown ? 'res' : playing ? 'watch' : answering ? 'ans' : mine ? 'ready' : 'idle';
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="att att-${type} pc-${who} ph-${phase}"><div class="atstage">${v.stage}</div><p class="atwords">${words}</p>${v.input}</div>${btn}</div>`;
}
// The miniature: the game's emblem (each game's view passes its own: Flash's shapes, Headcount's ladybug, Snapshot's
// grid; never a round's items), and both players' progress as pips (●●○).
export function attentionMiniature(mini, final, art) {
  const rows = pipRows(mini.right, ATT.goal), label = `X ${mini.right.X} and O ${mini.right.O} of ${ATT.goal}`;
  return art ? thumbArt(art, rows, 'tattw', label) : `<div class="tpip" aria-label="${label}">${rows}</div>`;
}
export function attentionSounds(f, add, won, mini, last) {   // someone else's round: as it played (Start, the round's own sounds), their answer going in, then the verdict; this phone's own: the answer pressed in, the verdict
  const pre = attPre(f), r = f.att && f.att.round, T = pre + QUIZ.beat;
  if (pre && r) {
    const len = attMs(f.type, r), ans = f.att.answer;
    if (f.type === 'flash') { add('go', 0); r.items.forEach((_, i) => add('tickSoft', i * r.ms)); if (ans != null) add('tap', len + ATT_T.pick); }
    else if (f.type === 'headcount') { add('go', 0); if (ans != null) { String(ans).split('').forEach((_, i) => add('key', len + ATT_T.type + i * ATT_T.step)); add('tap', len + ATT_T.send); } }
    else {
      add('reveal', 0); add('flipDown', r.show); for (let k = 1; k < Math.ceil((r.wait || 0) / 1000); k++) add('tickSoft', r.show + k * 1000); if (r.wait) add('go', r.show + r.wait);
      if (ans != null) { ans.forEach((_, i) => add('mark', len + attCellAt(i, ans.length))); add('tap', len + ATT_T.send); }
    }
  } else if (f.att && f.att.answer != null && ownMove(f)) add('tap', 0);   // this phone's own answer, pressed in (OK, the option, Submit)
  if (f.att) { add(f.att.correct ? 'ding' : 'thud', T); if (f.att.correct && !REDUCED) add(...quizPoint(T)); }   // the verdict: the tick or the cross; a right one's point landing on its pip
  return;
}
// Someone else's picked cells go in one after the other (Snapshot): the i-th of n, ms after their round has played.
export const attCellAt = (i, n) => ATT_T.cells + Math.round(i * Math.min(ATT_T.cellStep, ATT_T.cellSpan / Math.max(1, n - 1)));
// The square's chime (audio/sound.js moveSounds): once the winning point has landed and the pips have hopped, on the
// mover's own phone too (which plays the answer without the round and the pause another phone sees first: fx.js animMs).
export const attentionWonAt = (f, total) => total - 600 - (f.att && !f.timeout ? attMs(f.type, f.att.round) + ATT.pause - attPre(f) : 0);
let attStarting = null;                                         // the square whose Start is with the server (online: the round comes back with its answer)
// Headcount, Flash, Snapshot: the round plays, timed from now; from here the player stays in the square until the answer goes in.
// Online the server comes first: it holds the player to the square, times the round from its own clock (an answer too
// late counts as out of time: core/verify.js) and hands over the round, which is its secret until Start.
export async function attStartAct(el, e, act) {
  const type = zoomedType();
  if (!ATT_TYPES.includes(type) || attDraft || attStarting != null || state.flash || state.done || blocked()) return;
  const i = state.zoom, p = state.turn;
  if (state.online) {
    attStarting = i; render();
    const res = await dbStart(i);
    attStarting = null;
    const cur = state.squares && state.squares[i];
    if (!res || !res.ok || state.zoom !== i || state.turn !== p || !cur || cur.owner || cur.mini.type !== type || attDraft || state.flash || state.done) { if (res && !res.ok) SND.play('error'); render(); return; }
    if (res.round) cur.mini.round[p] = res.round;
  }
  const sq = state.squares[i], r = sq.mini.round[p];
  if (!r || r.hidden) { SND.play('error'); render(); return; }   // (no round to play: the server did not hand one over)
  attDraft = { id: attId(i, p), sq: i, at: Date.now(), entry: type === 'snapshot' ? [] : '' };
  attSave();
  attStart(state, i, p, Date.now());                          // held to the square here too (online, the server's hold and clock came first; a timeout then answers this round, wrong)
  if (!state.online) save();
  const len = attMs(type, r) / 1000;
  if (type === 'headcount') { SND.play('go'); SND.play('reveal', { at: len }); }
  else if (type === 'flash') { SND.play('go'); r.items.forEach((_, i) => SND.play('tickSoft', { at: (i * r.ms) / 1000 })); SND.play('reveal', { at: len }); }
  else { SND.play('reveal'); SND.play('flipDown', { at: r.show / 1000 }); for (let k = 1; k < Math.ceil((r.wait || 0) / 1000); k++) SND.play('tickSoft', { at: r.show / 1000 + k }); if (r.wait) SND.play('go', { at: len }); }   // the pattern, the grid blank (each second of the countdown), then the taps
  render();
}
