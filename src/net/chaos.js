// Super Chaos in a friend room: both players move at once, each on their own phone. The room's record (the
// match on the database) is the one truth of each round: its number, its deadline in server time, and each
// player's move once sent in (the record's sc.moves). A phone plays its move on its own copy of the round
// (core/chaos.js chaosPlay) and sends it in once it is over; the second move in settles the round on the record
// (core/records.js applyChaosSubmit), as does the deadline, with the timeout rule's move for a side not in
// (applyChaosDeadline: either phone, once the other has had a moment to send its own). The settled round
// carries a shared start a second ahead (server time): both phones play the same recap sequence from that
// moment (ui/chaos.js), and the first through it begins the next round on the record (applyChaosBegin: its
// deadline). A phone coming back reads the record and joins the round, or the recap where it is.
import { SC_ONLINE, scMoveOf } from '../core/chaos.js';
import { upgradeMini } from '../core/minis.js';
import { MATCH_FIELDS, applyChaosBegin, applyChaosDeadline, applyChaosSubmit, fullState } from '../core/records.js';
import { other } from '../core/util.js';
import { SND } from '../audio/sound.js';
import { connected, fb, serverNow } from './connect.js';
import { matchTransaction, showNotice } from './moves.js';
import { parseMatch, room } from './room.js';
import { NAV_SCREENS, RNG, flashTimer, save, setFlashTimer, state } from '../ui/app.js';
import { flashLeft } from '../ui/turns.js';
import { chaosStep, scAtHole, scRecapStage, scRecapTotal, setScUi } from '../ui/chaos.js';
import { render } from '../ui/render.js';
import { repStop } from '../ui/replay.js';
import { devError } from './tracking.js';

const clone = v => JSON.parse(JSON.stringify(v));
let sending = false, busy = false;

// The match's fields from the record, every secret in its square (this phone plays its own copy of the round).
// keep: this phone's own move, its result still on show, stays up (the round settled with it: the shared start waits for it).
function take(full, keep) {
  for (const k of MATCH_FIELDS) { if (k === 'recent' || k === 'sc') continue; state[k] = full[k] === undefined ? null : clone(full[k]); }
  if (Array.isArray(state.squares)) state.squares.forEach(sq => upgradeMini(sq.mini));
  state.cpu = null; state.confirm = null; state.sel = [];
  if (!keep) { clearTimeout(flashTimer); setFlashTimer(null); repStop(); state.flash = null; state.done = null; }   // (a result still up here is over: the record has moved on)
  state.spot = null; state.stamp = null; state.stamps = null; state.lock = null;
}
// The record's recap as this phone plays it: the other player's move is "the other move" (ui/chaos.js replays it).
function recapOf(sc, me, own) {
  const rc = clone(sc.recap), opp = other(me);
  rc.cpu = rc.mv && rc.mv[opp] ? Object.assign({}, rc.mv[opp]) : null;
  rc.mine = {};                                                 // each square as this phone saw it before the round settled (own: its own copy of the round; none after a reload: the other's square as they found it)
  if (own) for (const i of Object.keys(rc.view || {})) if (own[i]) rc.mine[i] = clone(own[i].mini);
  return rc;
}
// The room's record changed (room.js applyMatch hands a Super Chaos match here).
export function scFollow(rec) {
  const st = rec.state, sc = st.sc, o = state.online;
  if (o.matchId !== st.id) { o.matchId = st.id; o.shownSeq = st.seq; scJoin(rec); return; }   // a new match
  if (scRecapStage()) return;                                   // a recap is playing here by the clock: the record is read again at its end
  const loc = state.sc && state.sc.online ? state.sc : null;
  if (!loc || st.winner) { scJoin(rec); return; }
  if (sc.recap && sc.recap.round === loc.round && !loc.recap) { scRecap(rec); return; }   // the round played here is settled: its recap, from the shared start
  if (loc.round !== sc.round) { scJoin(rec); return; }          // not following this round here (a reload, a round missed)
  if (sc.deadline != null && loc.deadline !== sc.deadline) loc.deadline = sc.deadline;   // the round's clock, as the record has it
  const mine = sc.moves && sc.moves[o.me], oppIn = !!(sc.moves && sc.moves[other(o.me)]);
  if (mine && !loc.me) { scJoin(rec); return; }                 // our move went in from elsewhere (this phone open twice)
  if (!mine && loc.me && loc.sent === loc.round && !sending) loc.sent = null;   // sent, yet not on the record: sent again (the record decides: 'moved' if it is there after all)
  if (oppIn !== !!loc.oppIn) loc.oppIn = oppIn;
  render();
}
// This phone's move for the round the record is on, not on the record yet (a reload, a write refused): it
// is kept as the record is joined, to go in; never dropped for a move not yet made.
function heldMove(full) {
  const loc = state.sc, sc = full.sc, me = state.online.me;
  if (!loc || !loc.online || !loc.me || state.id !== full.id || loc.round !== sc.round || sc.recap || sc.deadline == null || (sc.moves && sc.moves[me])) return null;
  const sq = state.squares[loc.me.square];
  if (!sq || sq.owner || !sq.mini) return null;
  return { me: clone(loc.me), moved: loc.moved, start: clone(loc.start || null), steps: clone(loc.steps || []), square: clone(sq), fail: loc.fail || null };
}
// The record, joined here: the recap where it is in its sequence (the round just settled, its start a moment
// ahead or part way through), else the round as it stands, and this phone's move if it is in already.
function scJoin(rec) {
  const full = fullState(rec), o = state.online, me = o.me, sc = full.sc, mine = sc.moves && sc.moves[me], held = heldMove(full);
  take(full);
  if (sc.recap && sc.deadline == null) {                        // the round just settled: its recap is on (or its start still ahead)
    recapState(full, recapOf(sc, me));
    if (full.winner || serverNow() < sc.recap.at + scRecapTotal()) { save(); render(); chaosStep(); return; }   // (the sequence joined where it is)
    if (!full.winner) scBegin();                                 // over already (this phone was away through it): the next round begins on the record
  }
  state.sc = Object.assign(clone(sc), { me: null, moved: null, start: null, steps: null, recap: null, deadline: sc.deadline != null ? sc.deadline : serverNow() + sc.limit * 1000, held: null, sent: null, oppIn: !!(sc.moves && sc.moves[other(me)]) });   // (a deadline not on the record yet: from now, until it is)
  if (mine) {
    if (mine.square != null && mine.mini) state.squares[mine.square].mini = clone(mine.mini);
    state.sc.me = Object.assign({ square: mine.square, out: mine.out || 'none', win: !!mine.win }, mine.gives ? { gives: mine.gives } : {});
    state.sc.moved = mine.square; state.sc.sent = sc.round;
  } else if (held) {                                              // this phone's move, made but not in: it stays made, and goes in from here
    state.squares[held.me.square] = held.square;
    Object.assign(state.sc, { me: held.me, moved: held.moved, start: held.start, steps: held.steps, fail: held.fail });
  }
  state.turn = me;
  setScUi({ round: null, readyAt: 0, stage: null, at: 0, played: false });
  if (full.winner) { if (!['review', 'review-mini'].concat(NAV_SCREENS).includes(state.screen)) state.screen = 'win'; }
  else { state.screen = 'board'; state.zoom = null; }
  save(); render(); chaosStep();                                  // (the round's steps go on from here: ui/chaos.js)
}
// The round played here is settled on the record: its recap plays from the shared start (ui/chaos.js).
function scRecap(rec) {
  const full = fullState(rec), me = state.online.me;
  const rc = recapOf(full.sc, me, state.sc && state.sc.round === full.sc.recap.round ? state.squares : null), own = !!(state.flash && state.sc.me && state.flash.by === me && state.flash.sc === rc.round && flashLeft() > 0);   // (this phone's move settled the round: its result plays out, the shared start after it)
  take(full, own);
  recapState(full, rc, own);
  save(); render(); chaosStep();                                  // (the sequence begins by the clock: its wait for the shared start)
}
function recapState(full, rc, own) {
  const me = state.online.me;
  state.sc = Object.assign(clone(full.sc), { round: rc.round, recap: rc, me: null, moved: null, start: null, steps: null, deadline: null, held: null, sent: rc.round, oppIn: false });
  state.turn = me;
  if (!scAtHole(rc) && !own) { state.screen = 'board'; state.zoom = null; }   // (at the Mini Golf hole with a shot locked in: both shots play out there; the own result still up: where it is)
  setScUi({ round: null, readyAt: 0, stage: null, at: 0, played: false });   // (the sequence is planned and joined where it is at the next step)
}
// The recap is over here: on to the record's round (begun there by the first phone through, else by this one).
export function scNextOnline() {
  const rec = room && parseMatch(room.match);
  if (!rec || !rec.state.sc) return;
  setScUi({ round: null, readyAt: 0, stage: null, at: 0, played: false });
  scJoin(rec);
  if (!rec.state.winner) SND.play('turn');
}
// Every second while a round is on: this phone's move sent once it is in; the round settled on the record at
// its deadline once the grace for the mover's own phone is past (either phone, the first to). The ms until the
// next look (ui/chaos.js chaosStep comes back then), or null.
export function scOnlineWait() {
  const sc = state.sc, o = state.online;
  if (sc.me && sc.sent !== sc.round) { scSend(); return 1000; }
  const rec = room && parseMatch(room.match);
  if (!rec || !rec.state.sc || rec.state.winner || rec.state.sc.round !== sc.round) return null;
  const rsc = rec.state.sc;
  if (rsc.deadline != null && serverNow() >= rsc.deadline + SC_ONLINE.graceMs && !(rsc.moves && rsc.moves.X && rsc.moves.O)) { scDeadline(); return 1500; }
  if (o && o.me && rsc.moves && rsc.moves[o.me] && sc.sent !== sc.round) sc.sent = sc.round;
  return 1000;
}
async function scSend() {
  const sc = state.sc, o = state.online;
  if (!sc || !sc.online || !o || !sc.me || sending || !fb || !connected || !room) return;
  const mv = scMoveOf(state, o.me);
  if (!mv) return;
  mv.at = serverNow();
  const round = sc.round, square = sc.me.square;
  let reason = null, ok = false, err = null;
  sending = true;
  try {
    const res = await matchTransaction(rec => { const r = applyChaosSubmit(rec, o.me, mv, RNG, serverNow(), flashLeft()); if (!r.ok) { reason = r.reason; return null; } return r.rec; });   // (the shared start waits for the result on show here, should this move settle the round)
    ok = !!(res && res.committed);
    if (!ok && !reason) reason = 'norecord';                      // nothing written: no match on the record to take the move
  } catch (e) { reason = 'network'; err = e; }
  sending = false;
  if (!state.sc || state.sc.round !== round) { save(); render(); return; }   // the round moved on meanwhile: the record decided
  if (ok || reason === 'moved') { state.sc.sent = round; state.sc.fail = null; }   // in (or in already: this phone open twice)
  else if (reason === 'round' || reason === 'over') { state.sc.sent = round; state.sc.fail = null; scLost(reason, round, square); }   // the record moved on without it
  else if (reason !== 'recap') scFailed(reason, err, round, square);   // ('recap': the next round has not begun on the record yet; tried again in a second)
  save(); render();
}
// A move's write refused or failed: said on screen (the hint, until it goes in), in the console, and in the
// device's log on the server (the admin's playtest page), once per kind of failure; tried again every second.
const SC_FAIL_TEXT = { PERMISSION_DENIED: 'not allowed by the server', network: 'no connection', norecord: 'no match on the record', bad: 'refused by the rules', maxretry: 'the record kept changing', disconnect: 'the connection dropped' };
export const scFailText = code => SC_FAIL_TEXT[code] || SC_FAIL_TEXT[String(code || '').replace(/^.*\//, '')] || String(code || 'unknown');
function scFailed(reason, err, round, square) {
  const text = err ? String(err.code || err.message || err.name || err) : '', sc = state.sc;
  const code = /permission.denied/i.test(text) ? 'PERMISSION_DENIED' : /maxretr/i.test(text) ? 'maxretry' : /disconnect/i.test(text) ? 'disconnect' : (err && err.code ? String(err.code).replace(/^.*\//, '') : reason);
  const again = sc.fail && sc.fail.code === code;
  sc.fail = { code, n: again ? sc.fail.n + 1 : 1, at: Date.now() };
  if (again) return;
  const what = `move not saved: ${code} (round ${round}, square ${square})`;
  console.error('[Super Chaos] ' + what, err || '');
  devError('scmove', what + (err && err.message ? ' ' + err.message : ''));
  SND.play('error');
  showNotice(`Move not saved: ${scFailText(code)}. Trying again…`, 2600);
}
// The round settled on the record before this phone's move went in (the timeout rule's move stood for it), or the match is over.
function scLost(reason, round, square) {
  const what = `move lost: ${reason} (round ${round}, square ${square})`;
  console.warn('[Super Chaos] ' + what);
  devError('sclost', what);
  if (reason === 'round') showNotice('The round ended before your move went in', 2600);
}
// The deadline is past: the timeout rule's move for a side not in, and the round settled (once, whichever phone first).
async function scDeadline() {
  if (busy || !fb || !connected) return;
  busy = true;
  try { await matchTransaction(rec => { const r = applyChaosDeadline(rec, serverNow(), RNG); return r.ok ? r.rec : null; }); } catch (e) { /* the next look tries again */ }
  busy = false;
}
// The recap is over: the next round begins on the record, timed from now (once: the first phone through sets it).
async function scBegin() {
  if (busy || !fb || !connected) return;
  busy = true;
  try { await matchTransaction(rec => { const r = applyChaosBegin(rec, serverNow()); return r.ok ? r.rec : null; }); } catch (e) { /* the next look tries again */ }
  busy = false;
}
