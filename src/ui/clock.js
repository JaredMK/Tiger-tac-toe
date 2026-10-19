// The turn clock on screen: one deadline a turn, counted the same on both phones; timeouts.
import { applyOnlineTimeout } from '../core/records.js';
import { armClock } from '../core/timer.js';
import { SND } from '../audio/sound.js';
import { call, connected, fb, serverNow } from '../net/connect.js';
import { fireTimeoutMM, isMM, search } from '../net/matchmaking.js';
import { matchTransaction } from '../net/moves.js';
import { parseMatch, room, setTimeoutBusy, timeoutBusy } from '../net/room.js';
import { RNG, state } from './app.js';
import { scClockLeft, scTick } from './chaos.js';
import { runDraft, runEnd } from './runner.js';

/* ----- the turn clock: a deadline in server time on the record, so both phones count the same; either may call it ----- */
export function clockLeft() {
  if (state.sc) return scClockLeft();                         // Super Chaos: the round's clock (this phone's, in a friend room too)
  const t = state.timer;
  if (!t || !t.limit || t.deadline == null) return null;
  return Math.max(0, Math.min(t.limit * 1000, t.deadline - serverNow()));
}
export function clockText() {
  const left = clockLeft();
  if (left == null && state.sc) return fmtClock(state.sc.limit * 1000);
  if (left == null) return state.timer && state.timer.limit ? fmtClock(state.timer.limit * 1000) : '';
  return fmtClock(left);
}
export function fmtClock(ms) { const sec = Math.ceil(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
// The clock for the turn just started: the time limit, plus what the move just made takes to play
// back, so the countdown is seen to begin once the animation is over.
// Runs four times a second: keeps the clock on screen current and, online, calls time when it is up.
let tickSec = null;
export function tick() {
  const w = search.on && document.getElementById('mmwait');
  if (w) w.textContent = fmtClock(Date.now() - search.since);
  const el = document.getElementById('clock');
  if (el) {
    const left = clockLeft();
    el.textContent = clockText();
    el.classList.toggle('low', left != null && left <= 10000);
    el.classList.toggle('held', !!state.online && !connected);
    if (left != null && left <= 10000 && left > 0) { const sec = Math.ceil(left / 1000); if (sec !== tickSec) { tickSec = sec; SND.play(sec <= 3 ? 'tickLoud' : 'tickSoft'); } }
    else tickSec = null;
  }
  if (runDraft && runDraft.phase === 'run' && clockLeft() != null && clockLeft() <= 0) runEnd(true);   // a run under way when the turn's time is up: it ends there, the distance saved
  if (state.sc) { scTick(); return; }                             // Super Chaos: the round's time up, the game's timeout rule
  if (!state.online || !fb || !connected || !room || !room.match || timeoutBusy || state.online.joined === false) return;
  const rec = parseMatch(room.match);
  if (!rec) return;
  const st = rec.state, t = st.timer;
  if (isMM() && !st.winner && st.turn !== state.online.me) nudgeMM();
  if (!t || !t.limit || t.deadline == null || st.winner || serverNow() < t.deadline) return;
  fireTimeout(st.seq, t.deadline);
}
// A matchmaking game, the other side on the move: a word to the server every few seconds, which keeps
// its own timings for the game going.
let nudgeAt = 0;
const NUDGE_MS = 2500;
function nudgeMM() {
  if (Date.now() - nudgeAt < NUDGE_MS) return;
  nudgeAt = Date.now();
  call('tick', { game: state.online.game }).catch(() => {});
}
// The deadline passed: a random move for the player on the move, written once whichever phone gets there first.
async function fireTimeout(seq, deadline) {
  if (isMM()) { fireTimeoutMM(seq, deadline); return; }
  setTimeoutBusy(true);
  try {
    await matchTransaction(rec => {
      const st = rec.state;
      if (st.seq !== seq || st.winner || !st.timer || st.timer.deadline !== deadline || serverNow() < st.timer.deadline) return null;   // called already, or not due
      const r = applyOnlineTimeout(rec, RNG);
      if (!r.ok) return null;
      armClock(r.rec.state, r.entries, serverNow());
      return r.rec;
    });
  } catch (e) { /* the next tick tries again */ }
  setTimeoutBusy(false);
}
export let timeoutTry = { key: null, at: 0 };       // a matchmaking game's last call for time (at most every 2 s)

// Setters for the names other modules reassign (an imported name is read-only there).
export function setTimeoutTry(v) { timeoutTry = v; }
