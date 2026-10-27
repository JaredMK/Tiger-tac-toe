// Online moves: the server's move function (every online match, Find Match's and a friend room's, is the server's);
// instant moves shown at once and rolled back if refused.
import { playMove } from '../core/board.js';
import { applyOnlineMove } from '../core/records.js';
import { setTriviaFlip, triviaFlip } from '../games/trivia/view.js';
import { SND } from '../audio/sound.js';
import { NET_MS, call, fb } from './connect.js';
import { isMM } from './matchmaking.js';
import {
  blocked, moveTimer, moveWait, parseMatch, presentEntry, presentingSeq, room, setMoveTimer,
  setMoveWait, setPresentingSeq, showLatest
} from './room.js';
import { RNG, commit, flashTimer, holdTimer, noticeTimer, setFlashTimer, setHoldTimer, setNoticeTimer, state } from '../ui/app.js';
import { startFx } from '../ui/fx.js';
import { render } from '../ui/render.js';
import { repTake } from '../ui/replay.js';
import { playFlash } from '../ui/turns.js';
import { matchLog } from './tracking.js';
import { scRequest } from './chaos.js';

// ---------- moves: a request to the server ----------
// a move request from this phone, or the move itself when the game is played here
export function attemptMove(m) {
  const rep = repTake();                                          // this phone's inputs before the move: they ride with it, for the other side's replay
  if (state.online && state.sc) { scRequest(state.zoom, m, rep); return true; }   // Super Chaos online: the server plays it (net/chaos.js)
  if (state.online) { dbMove(state.zoom, m, rep); return true; }
  const r = playMove(state, state.zoom, m, RNG, { rep });
  if (r.ok) { playFlash(); commit(); } else SND.play('error');
  return r;
}
// ---- instant moves: your own move shows at once, and the server still decides ----
// A move the phone can work out from what it can see (tic-tac-toe, Four in a Row, Hex, Hexapawn) is checked by the
// same rules the server runs, and shown straight away; the server's record then confirms it, or corrects it. A
// move the server refuses is taken back, with a note. The mini-games whose result is hidden or random are sent
// as before, and show their result when the server has it.
const PREDICT = ['ttt', 'c4', 'hex', 'hexapawn'];
export let predicted = null;                            // { seq, entry, squares }: the move shown here, not yet confirmed
function predictMove(i, m, rep) {
  const sq = state.squares && state.squares[i];
  if (!sq || !PREDICT.includes(sq.mini.type) || !state.online) return null;
  const rec = parseMatch(room && room.match);
  if (!rec) return null;
  const r = applyOnlineMove(Object.assign({ secrets: {} }, rec), state.online.me, i, m, RNG, { rep });
  if (!r.ok) return { ok: false, reason: r.reason };
  if (r.entries[0] && r.entries[0].kind === 'draw') return null;   // a draw deals the square a random new game: the server's draw is the one shown
  return { ok: true, seq: r.rec.state.seq, entry: r.entries[0], squares: JSON.stringify(r.rec.state.squares), rec: r.rec };
}
// The server refused the move, or could not be reached: the board goes back to what the server last showed.
function rollbackMove(reason) {
  const shown = !!predicted;
  predicted = null;
  moveRejected(reason);
  if (shown && room && room.match) {
    clearTimeout(flashTimer); setFlashTimer(null); clearTimeout(holdTimer); setHoldTimer(null); setPresentingSeq(null);
    const last = parseMatch(room.match);
    if (last) showLatest(last.state);   // (the state the server last confirmed)
  }
}
export let tapEl = null;                                // the control just tapped (set by the tap, read by dbMove)
export async function dbMove(i, m, rep) {
  const pressed = tapEl; tapEl = null;
  if (blocked() || !fb || !room || i == null) return false;
  setMoveWait(Date.now());
  if (isMM() && pressed) pressed.classList.add('pend'); else render();   // online: the press shows on the control at once (no redraw until the server answers)
  clearTimeout(moveTimer); setMoveTimer(setTimeout(() => { if (moveWait) { setMoveWait(null); render(); } }, NET_MS.move));
  if (!isMM()) { setMoveWait(null); render(); return false; }   // (a lobby: no match to move in)
  const pr = predictMove(i, m, rep);                             // the server checks and makes the move
  if (pr && !pr.ok) { setMoveWait(null); moveRejected(pr.reason); render(); return true; }   // refused by the rules here: nothing is sent
  if (pr) { predicted = { seq: pr.seq, entry: pr.entry, squares: pr.squares }; presentEntry(pr.rec.state, pr.entry, []); }   // shown now
  clearTimeout(moveTimer); setMoveTimer(setTimeout(() => { if (moveWait) { setMoveWait(null); render(); } }, NET_MS.call));
  try { const r = await call('move', Object.assign({ game: state.online.game, square: i, move: m }, rep ? { rep } : {})); if (!r.ok) { rollbackMove(r.reason); matchLog({ k: 'reject', q: i, why: r.reason || 'refused' }); } }
  catch (e) { rollbackMove('network'); matchLog({ k: 'reject', q: i, why: String((e && (e.code || e.message)) || 'network').slice(0, 60) }); }
  clearTimeout(moveTimer); setMoveWait(null); render();
  return true;
}
export function moveRejected(reason) {
  SND.play('error');
  if (reason === 'notword') showNotice('Not a word', 1200);
  else if (reason === 'notallowed') showNotice('Not allowed', 1200);
  else if (reason === 'network') showNotice('No connection', 1200);
  else showRefused("Move didn't go through");
}
// A move the server refused, on any game screen: a short note under the top bar, and it goes.
export let refusedNote = null, refusedTimer = null;
function showRefused(text) {
  refusedNote = text; render();
  clearTimeout(refusedTimer); refusedTimer = setTimeout(() => { refusedNote = null; render(); }, 1600);
}
// A short note (a word that is not one, no connection, a copied link): it pops up, once, as it is shown.
export let noticeSeq = 0;
export function showNotice(text, ms) {
  state.notice = text; noticeSeq += 1; startFx('notice', noticeSeq);
  render();
  clearTimeout(noticeTimer); setNoticeTimer(setTimeout(() => { state.notice = null; render(); }, ms));
}
// Trivia online: the question turned up in the room (the server, or the room's own record), for both phones.
export async function dbReveal(i) {
  if (blocked() || !fb || !room || !isMM()) return;
  setMoveWait(Date.now()); render();
  let ok = false;
  try { const r = await call('move', { game: state.online.game, square: i, kind: 'reveal' }); ok = !!(r && (r.data || r).ok); } catch (e) { /* nothing to show */ }
  setMoveWait(null);
  if (ok) { setTriviaFlip({ sq: i, at: performance.now() }); SND.play('reveal'); }
  render();
}
// Headcount, Flash, Snapshot, Sky Hop, Scoop Stack, Pinball: Start, on the server first (Classic: move with kind
// 'start'; Super Chaos: scStart). It holds the player to the square and times the round or the attempt from its own
// clock (core/verify.js); an attention game's round, the server's until now, comes back with its answer (r.round).
export async function dbStart(i) {
  if (!fb || !room || !isMM()) return { ok: true };
  try {
    const r = await call(state.sc ? 'scStart' : 'move', Object.assign({ game: state.online.game, square: i }, state.sc ? {} : { kind: 'start' }));
    return r && typeof r === 'object' ? r : { ok: false, reason: 'network' };
  } catch (e) { return { ok: false, reason: 'network' }; }
}
// A game with time of its own opened on this phone's turn (meta.js turnSecs: runners, Sky Hop, Echo, Risky Rolls...):
// the server gives the turn that time and holds it to the square (core/timer.js turnOpen; shown here at once).
export async function dbOpen(i) {
  if (!fb || !room || !isMM() || state.sc) return;
  try { await call('move', { game: state.online.game, square: i, kind: 'open' }); } catch (e) { /* the turn keeps the match's time */ }
}
export async function dbPick(i, card) {
  if (blocked() || !fb || !room || !isMM()) return;
  setMoveWait(Date.now()); render();
  try { await call('move', { game: state.online.game, square: i, kind: 'pick', card }); } catch (e) { /* nothing to show */ }
  setMoveWait(null); render();
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setMoveRejected(v) { moveRejected = v; }
export function setPredicted(v) { predicted = v; }
export function setTapEl(v) { tapEl = v; }
