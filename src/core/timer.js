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
// The phones and the server use the same figures. These are the design's base timings; everything plays at
// ANIM.speed (TEMPO times the admin's Animation speed), so at the default the figures on screen are half of these.
export const PLAY = {
  spot: 600,                                                              // the square glows on the board before the zoom
  flash: { move: 600, again: 350, claim: 500, draw: 1100, match: 700, card: 900 },   // the result stays up this long once its animation is over (a win: the game's own winning moment, the board's zoom-out and stamp right behind it)
  flip: 500,                                                              // Find the Pair's cards turn back over
  die: 600, spin: 1000, hop: 130,                                          // a die's tumble, the candy wheel's spin, each hop of a token
  spin3: 700, slide: 750, knock: 650,                                     // Bump's 1-2-3 spinner; a ladder climb or a snake slide; a piece knocked Home
};
// The game's pace (October 2026: "fast and chaotic"): every animation, hold and transition runs TEMPO times as
// fast as its base figure, on the page (ui/fx.js anchorFx for every CSS animation, ui/turns.js playFlash for a
// move's) and on the server (replayMs). The admin's Animation speed (config/anim/speed: 0.5 to 2, default 1)
// multiplies it again; ANIM.speed is the two together. ANIM.fx is the admin's Effects intensity (config/anim/fx:
// 0 to 2, default 1): how hard the screen shakes, how many confetti pieces, how big the pops (ui/fx.js).
// The waits that are the game itself never change: Find the Pair's two cards up (MEMORY_MS), the attention games'
// memorise and answer times, Echo's pattern, Bullseye's sweep, a run or a physics recording (realTime below).
export const TEMPO = 2;
export const ANIM = { speed: TEMPO, admin: 1, fx: 1 };
export function setAnimSpeed(v) { const x = Number(v); ANIM.admin = Number.isFinite(x) && x >= 0.5 && x <= 2 ? x : 1; ANIM.speed = TEMPO * ANIM.admin; }
export function setAnimFx(v) { const x = v == null || v === '' ? NaN : Number(v); ANIM.fx = Number.isFinite(x) && x >= 0 && x <= 2 ? x : 1; }
// An opponent's or the computer's move plays back at least this fast (its inputs at their recorded timing, sped
// up; a run, a physics recording at this speed); its animations at the game's pace when that is faster.
export const REPLAY_SPEED = 1.5;
// The rate a move's animation and result play at: the game's pace, or, for a game whose move is a recording in
// real time (meta.js realTime: the runs, the physics shots, Sky Hop, Scoop Stack, Pinball), the replay's own
// speed (1 for the mover's own). rs: the replay's speed (1: not a replay).
export function moveRate(type, rs) {
  const r = rs || 1;
  return metaOf(type).realTime ? r : Math.max(r, ANIM.speed);
}
// The rate a result's hold plays at: never slower than the game's pace (a run's result reads as fast as any).
export function holdRate(type, rs) { return Math.max(moveRate(type, rs), ANIM.speed); }
// The animation of one move. winLen: how many cells a Hex win lights up.
export function playMs(f, winLen) {
  const won = f.kind === 'claim' || f.kind === 'match';
  const game = rulesOf(f.type);
  if (game.flashMs) return game.flashMs(f, winLen, won);
  return 500;
}
// The whole playback of settled moves on the other phone: the glow, the move, its result (at the replay's speed).
export function replayMs(entries) {
  return (entries || []).reduce((ms, e) => {
    const win = e.after && e.after.mini && e.after.mini.winCells ? e.after.mini.winCells.length : 4;
    return ms + PLAY.spot / ANIM.speed + playMs(e, win) / moveRate(e.type, REPLAY_SPEED) + ((PLAY.flash[e.kind] || 800) + (e.type === 'memory' && e.kind === 'move' ? PLAY.flip : 0)) / holdRate(e.type, REPLAY_SPEED);
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
