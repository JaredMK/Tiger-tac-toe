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
// The phones and the server use the same figures.
export const PLAY = {
  spot: 600,                                                              // the square glows on the board before the zoom
  flash: { move: 600, again: 350, claim: 800, draw: 1100, match: 900, card: 900 },   // the result stays up this long once its animation is over (a win: the game's own winning moment; the square's stamp follows on the board)
  flip: 500,                                                              // Find the Pair's cards turn back over
  die: 600, spin: 1000, hop: 130,                                          // a die's tumble, the candy wheel's spin, each hop of a token
  spin3: 700, slide: 750, knock: 650,                                     // Bump's 1-2-3 spinner; a ladder climb or a snake slide; a piece knocked Home
};
// The global animation speed (the admin's Animation speed, config/anim/speed: 0.5 to 2, default 1): every move's
// animation, its result's hold, the board's glow and the computer's pauses run this many times as fast (2: twice as
// fast; 0.5: half as fast). The phones and the server read the same figure (the server's turn clock and bots pace by it).
export const ANIM = { speed: 1 };
export function setAnimSpeed(v) { const x = Number(v); ANIM.speed = Number.isFinite(x) && x >= 0.5 && x <= 2 ? x : 1; }
// The animation of one move. winLen: how many cells a Hex win lights up.
export function playMs(f, winLen) {
  const won = f.kind === 'claim' || f.kind === 'match';
  const game = rulesOf(f.type);
  if (game.flashMs) return game.flashMs(f, winLen, won);
  return 500;
}
// The whole playback of settled moves on the other phone: the glow, the move, its result.
export function replayMs(entries) {
  return (entries || []).reduce((ms, e) => {
    const win = e.after && e.after.mini && e.after.mini.winCells ? e.after.mini.winCells.length : 4;
    return ms + (PLAY.spot + playMs(e, win) + (PLAY.flash[e.kind] || 800) + (e.type === 'memory' && e.kind === 'move' ? PLAY.flip : 0)) / ANIM.speed;
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
