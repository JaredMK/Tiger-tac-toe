// Super Chaos in a friend room: both players move at once, each on their own phone. A phone plays its move on
// its own copy of the round (core/chaos.js chaosPlay), sends it in once it is over (the record's sc.moves), and
// the second one in settles the round on the record (core/records.js applyChaosSubmit). Each phone then plays
// the round's recap from the record (the other player's move replayed in the pop-up, then the results; ui/chaos.js)
// and joins the next round from the record. A player whose move is long overdue gets one from the computer.
import { scMoveOf } from '../core/chaos.js';
import { upgradeMini } from '../core/minis.js';
import { MATCH_FIELDS, applyChaosAuto, applyChaosSubmit, fullState } from '../core/records.js';
import { other } from '../core/util.js';
import { SND } from '../audio/sound.js';
import { connected, fb, serverNow } from './connect.js';
import { matchTransaction } from './moves.js';
import { parseMatch, room } from './room.js';
import { NAV_SCREENS, RNG, save, state } from '../ui/app.js';
import { scAtHole, scRecapStage, setScUi } from '../ui/chaos.js';
import { render } from '../ui/render.js';

export const SC_OVERDUE_S = 45;                    // how long past the round's minute a sent move waits for the other's before the computer moves for them
const clone = v => JSON.parse(JSON.stringify(v));
let sending = false, autoBusy = false;

// The match's fields from the record, every secret in its square (this phone plays its own copy of the round).
function take(full) {
  for (const k of MATCH_FIELDS) { if (k === 'recent' || k === 'sc') continue; state[k] = full[k] === undefined ? null : clone(full[k]); }
  if (Array.isArray(state.squares)) state.squares.forEach(sq => upgradeMini(sq.mini));
  state.cpu = null; state.confirm = null; state.sel = [];
  state.flash = null; state.done = null; state.spot = null; state.stamp = null; state.stamps = null; state.lock = null;
}
// The room's record changed (room.js applyMatch hands a Super Chaos match here).
export function scFollow(rec) {
  const st = rec.state, sc = st.sc, o = state.online;
  if (o.matchId !== st.id) { o.matchId = st.id; o.shownSeq = st.seq; scJoin(rec); return; }   // a new match
  if (scRecapStage()) return;                                   // a recap is playing here: the record is read again at its end
  const loc = state.sc && state.sc.online ? state.sc : null;
  if (loc && sc.recap && sc.recap.round === loc.round && !loc.recap) { scRecap(rec); return; }   // the round played here is settled
  if (!loc || loc.round !== sc.round || st.winner) { scJoin(rec); return; }   // not following this round here (a reload, a round missed, the match over)
  const mine = sc.moves && sc.moves[o.me], oppIn = !!(sc.moves && sc.moves[other(o.me)]);
  if (mine && !loc.me) { scJoin(rec); return; }                 // our move went in from elsewhere (the computer, for a phone that was away)
  if (oppIn !== !!loc.oppIn) { loc.oppIn = oppIn; render(); }
}
// The record's round, joined here: the board as it stands, and this phone's move if it is in already.
function scJoin(rec) {
  const full = fullState(rec), o = state.online, me = o.me, sc = full.sc, mine = sc.moves && sc.moves[me];
  take(full);
  state.sc = Object.assign(clone(sc), { me: null, moved: null, start: null, steps: null, recap: null, deadline: null, held: null, sent: null, oppIn: !!(sc.moves && sc.moves[other(me)]) });
  if (mine) {
    if (mine.square != null && mine.mini) state.squares[mine.square].mini = clone(mine.mini);
    state.sc.me = Object.assign({ square: mine.square, out: mine.out || 'none', win: !!mine.win }, mine.gives ? { gives: mine.gives } : {});
    state.sc.moved = mine.square; state.sc.sent = sc.round;
  }
  state.turn = me;
  setScUi({ round: null, readyAt: 0, stage: null, at: 0, played: false });
  if (full.winner) { if (!['review', 'review-mini'].concat(NAV_SCREENS).includes(state.screen)) state.screen = 'win'; }
  else { state.screen = 'board'; state.zoom = null; }
  save(); render();
}
// The round played here is settled on the record: its recap, with the other player's move in the pop-up.
function scRecap(rec) {
  const full = fullState(rec), me = state.online.me, opp = other(me), loc = state.sc;
  const rc = clone(full.sc.recap);
  rc.cpu = rc.mv && rc.mv[opp] ? Object.assign({}, rc.mv[opp]) : null;   // (ui/chaos.js replays "the other move": here, the other player's)
  take(full);
  state.sc = Object.assign(clone(full.sc), { round: rc.round, recap: rc, me: loc.me, moved: null, start: null, steps: null, deadline: null, held: null, sent: rc.round, oppIn: false });
  state.turn = me;
  if (!scAtHole(rc)) { state.screen = 'board'; state.zoom = null; }   // (at the Mini Golf hole with a shot locked in: both shots play out there)
  setScUi({ round: rc.round, readyAt: 0, stage: rc.replay ? 'replay' : 'spot', at: 0, played: false });
  save(); render();
}
// The recap is over here: on to the record's round.
export function scNextOnline() {
  const rec = room && parseMatch(room.match);
  if (!rec || !rec.state.sc) return;
  scJoin(rec);
  if (!rec.state.winner) SND.play('turn');
}
// This phone's move is in: sent once; then, waiting for the other's, the computer moves for them once it is long
// overdue. The ms until the next look (ui/chaos.js chaosStep comes back then), or null.
export function scOnlineWait() {
  const sc = state.sc;
  if (sc.sent !== sc.round) { scSend(); return 3000; }
  const rec = room && parseMatch(room.match), o = state.online;
  if (!rec || !rec.state.sc || rec.state.winner || rec.state.sc.round !== sc.round) return null;
  const moves = rec.state.sc.moves || {}, mine = moves[o.me], opp = other(o.me);
  if (!mine || moves[opp]) return null;
  const due = (mine.at || 0) + (sc.limit + SC_OVERDUE_S) * 1000 - serverNow();
  if (due > 0) return Math.min(due + 50, 10000);
  scAuto(opp);
  return 5000;
}
async function scSend() {
  const sc = state.sc, o = state.online;
  if (!sc || !sc.online || !o || !sc.me || sending || !fb || !connected || !room) return;
  const mv = scMoveOf(state, o.me);
  if (!mv) return;
  mv.at = serverNow();
  const round = sc.round;
  let reason = null, ok = false;
  sending = true;
  try {
    const res = await matchTransaction(rec => { const r = applyChaosSubmit(rec, o.me, mv, RNG); if (!r.ok) { reason = r.reason; return null; } return r.rec; });
    ok = !!(res && res.committed);
  } catch (e) { reason = 'network'; }
  sending = false;
  if (state.sc && state.sc.round === round && (ok || reason === 'moved' || reason === 'round' || reason === 'over')) state.sc.sent = round;   // in (or the record has moved on: it decides)
  save(); render();
}
async function scAuto(side) {
  if (autoBusy || !fb || !connected) return;
  autoBusy = true;
  try { await matchTransaction(rec => { const r = applyChaosAuto(rec, side, RNG); return r.ok ? r.rec : null; }); } catch (e) { /* the next look tries again */ }
  autoBusy = false;
}
