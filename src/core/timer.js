// The turn timer and the playback timings: one deadline a turn (armClock), how long a move's animation
// takes on a phone (playMs).
import { metaOf, rulesOf } from '../games/index.js';

export const TIMER_OPTIONS = [0, 30];   // seconds per turn in a friend game: no limit or 30 seconds (Find Match is always 30 seconds)
// A time per turn from an older room or setup (1 or 3 minutes) becomes 30 seconds; anything else, no limit.
export function normTimer(v) { return TIMER_OPTIONS.includes(v) ? v : [60, 180].includes(v) ? 30 : 0; }
export function newTimer(limit) { return { limit: limit || 0, deadline: null, for: null, pausedAt: null, timeouts: { X: 0, O: 0 }, streak: { X: 0, O: 0 } }; }
// A turn's time: the match's limit, or more for a game that needs it (its meta.js turnSecs: the runners, Sky Hop,
// Scoop Stack, Pinball, Echo, Snapshot, Risky Rolls take 60 seconds). The turn takes the game's time once the
// player opens its square, which holds the turn there (turnOpen); secs: the time this turn has (null: the limit).
export function turnSecs(type) { const s = metaOf(type).turnSecs; return Number.isFinite(s) && s > 0 ? s : null; }
export function turnLimit(t) { return t ? t.secs || t.limit : 0; }
// The player on the move opens square i: a game with time of its own gives the turn that time, counted from the
// turn's start, and holds the turn to the square (as Start does); false if nothing changes. Once a turn.
export function turnOpen(st, i) {
  const t = st.timer, sq = st.squares && st.squares[i];
  if (!t || !t.limit || st.winner || !sq || sq.owner || t.secs || t.for !== st.turn) return false;
  if (st.lock != null) return false;                              // (already held: by a move or a Start, the turn's time stays)
  const s = turnSecs(sq.mini.type);
  if (!s || s <= t.limit) return false;
  if (t.deadline != null) t.deadline += (s - t.limit) * 1000;
  t.secs = s; st.lock = i; st.lockBy = 'open';
  return true;
}

// ---------- playback: how long a settled move takes to play on a phone ----------
// The turn clock allows for it, so the next player gets the full time once the move has played out.
// The phones and the server use the same figures (Normal: the server never knows a player's Animation choice).
export const PLAY = {
  spot: 600,                                                              // the square glows on the board before the zoom
  flash: { move: 600, again: 350, claim: 800, draw: 1100, match: 900, card: 900 },   // the result stays up this long once its animation is over (a win: the game's own winning moment; the square's stamp follows on the board)
  flip: 500,                                                              // Find the Pair's cards turn back over
  die: 600, spin: 1000, hop: 130,                                          // a die's tumble, the candy wheel's spin, each hop of a token
  spin3: 700, slide: 750, knock: 650,                                     // Bump's 1-2-3 spinner; a ladder climb or a snake slide; a piece knocked Home
};
// The pace. ANIM.admin: the admin's Animation speed (config/anim/speed: 0.5 to 2, default 1), for everyone: every
// move's animation, its result's hold, the board's glow and the computer's pauses, and the server's turn clock and
// bots. ANIM.mode: this player's own Animation setting, 'normal' (the game as designed) or 'speed' (ui/pace.js:
// on this screen only, never the rules, the timers or what the other player sees): everything plays ANIM.fast
// times as fast again (config/anim/fast: 1 to 4, default 2), with ANIM.fx the punch of its effects (config/anim/fx:
// 0 to 2, default 1: the shake, the confetti, the pops). ANIM.speed is the pace on this screen. The waits that
// are the game itself never change (Find the Pair's two cards up, the attention games' times, Echo's pattern,
// Bullseye's sweep, a run or a physics recording: realTime below).
export const ANIM = { speed: 1, admin: 1, fast: 2, fx: 1, mode: 'normal' };
const pace = () => { ANIM.speed = ANIM.admin * (ANIM.mode === 'speed' ? ANIM.fast : 1); };
const num = (v, lo, hi, d) => { const x = v == null || v === '' ? NaN : Number(v); return Number.isFinite(x) && x >= lo && x <= hi ? x : d; };
export function setAnimSpeed(v) { ANIM.admin = num(v, 0.5, 2, 1); pace(); }
export function setAnimFast(v) { ANIM.fast = num(v, 1, 4, 2); pace(); }
export function setAnimFx(v) { ANIM.fx = num(v, 0, 2, 1); }
export function setAnimMode(m) { ANIM.mode = m === 'speed' ? 'speed' : 'normal'; pace(); }
export const speedMode = () => ANIM.mode === 'speed';
// An opponent's or the computer's move plays back this fast: as it was made (Normal), 1.5x (Speed).
export const REPLAY_SPEED = 1.5;
export const replaySpeed = () => (speedMode() ? REPLAY_SPEED : 1);
// The rate a move's animation and result play at. Normal: the replay's own speed times the admin's (as ever).
// Speed: the faster of the replay's speed and the pace, except a game whose move is a recording in real time
// (meta.js realTime: the runs, the physics shots, Sky Hop, Scoop Stack, Pinball, the timed rounds), which plays
// at the replay's speed (1 for the mover's own). rs: the replay's speed (1: not a replay).
export function moveRate(type, rs) {
  const r = (rs || 1) * ANIM.admin;
  if (!speedMode()) return r;
  return metaOf(type).realTime ? r : Math.max(r, ANIM.speed);
}
// The rate a result's hold plays at: in Speed never slower than its pace (a run's result reads as fast as any).
export function holdRate(type, rs) { return speedMode() ? Math.max(moveRate(type, rs), ANIM.speed) : moveRate(type, rs); }
// The animation of one move. winLen: how many cells a Hex win lights up.
export function playMs(f, winLen) {
  const won = f.kind === 'claim' || f.kind === 'match';
  const game = rulesOf(f.type);
  if (game.flashMs) return game.flashMs(f, winLen, won);
  return 500;
}
// The whole playback of settled moves on the other phone: the glow, the move, its result. The server's reckoning,
// at the game's own pace (Normal: a phone in Speed is through sooner, and starts its clock then).
export function replayMs(entries) {
  return (entries || []).reduce((ms, e) => {
    const win = e.after && e.after.mini && e.after.mini.winCells ? e.after.mini.winCells.length : 4;
    return ms + (PLAY.spot + playMs(e, win) + (PLAY.flash[e.kind] || 800) + (e.type === 'memory' && e.kind === 'move' ? PLAY.flip : 0)) / ANIM.admin;
  }, 0);
}
// After moves are settled: the turn clock is set for whoever is on the move. With nothing to play back (the
// match's first turn, a turn missed) it starts at once, at `now` (server time). Otherwise it starts when that
// player's phone has played the move back (or skipped it: startClock), and at the latest once the playback
// would be over (startBy, with a little slack), so a phone that is away still has a turn that runs out.
export const CLOCK = { startSlackMs: 3000 };
export function armClock(st, entries, now) {
  const t = st.timer;
  if (!t || !t.limit) return;
  if (st.winner) { t.deadline = null; t.for = null; t.startBy = null; t.secs = null; return; }
  t.for = st.turn; t.secs = null;
  if (entries && entries.length) { t.deadline = null; t.startBy = now + replayMs(entries) + CLOCK.startSlackMs; }
  else { t.deadline = now + t.limit * 1000; t.startBy = null; }
}
// The player on the move has seen the move before theirs play out (or skipped it): their clock starts now.
// Once a turn: a deadline set stays (one deadline a turn).
export function startClock(st, side, now) {
  const t = st.timer;
  if (!t || !t.limit || st.winner || t.for !== side || t.deadline != null) return false;
  t.deadline = Math.min(now, t.startBy != null ? t.startBy : now) + turnLimit(t) * 1000; t.startBy = null;
  return true;
}
// The turn's deadline: the one set, or the latest it can be (its start not reported yet); null with no clock.
// When the turn began (its deadline less its time): a run or an attempt is no longer than that (core/verify.js).
export function turnBegan(t) { const dl = clockDeadline(t); return dl == null ? null : dl - turnLimit(t) * 1000; }
export function clockDeadline(t) {
  if (!t || !t.limit) return null;
  return t.deadline != null ? t.deadline : t.startBy != null ? t.startBy + turnLimit(t) * 1000 : null;
}
