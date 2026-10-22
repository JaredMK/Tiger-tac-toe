// The turn timer and the playback timings: one deadline a turn (armClock), how long a move's animation
// takes on a phone (playMs).
import { rulesOf } from '../games/index.js';

export const TIMER_OPTIONS = [0, 60];   // seconds per turn in a friend game: no limit or 1 minute (Find Match is always 1 minute)
// A time per turn from an older room or setup (30 seconds or 3 minutes) becomes 1 minute; anything else, no limit.
export function normTimer(v) { return TIMER_OPTIONS.includes(v) ? v : [30, 180].includes(v) ? 60 : 0; }
export function newTimer(limit) { return { limit: limit || 0, deadline: null, for: null, pausedAt: null, timeouts: { X: 0, O: 0 }, streak: { X: 0, O: 0 } }; }

// ---------- playback: how long a settled move takes to play on a phone ----------
// The turn clock allows for it, so the next player gets the full time once the move has played out.
// The phones and the server use the same figures.
export const PLAY = {
  spot: 1000,                                                             // the square glows on the board before the zoom
  flash: { move: 1000, again: 650, claim: 1200, draw: 1700, match: 1200, card: 1500 },   // the result stays up this long (a win: the game's own winning moment; the square's stamp follows on the board)
  flip: 500,                                                              // Memory's cards turn back over
  die: 600, spin: 1000, hop: 130,                                          // a die's tumble, the candy wheel's spin, each hop of a token
  spin3: 700, slide: 750, knock: 650,                                     // Bump's 1-2-3 spinner; a ladder climb or a snake slide; a piece knocked Home
};
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
    return ms + PLAY.spot + playMs(e, win) + (PLAY.flash[e.kind] || 800) + (e.type === 'memory' && e.kind === 'move' ? PLAY.flip : 0);
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
  if (st.winner) { t.deadline = null; t.for = null; t.startBy = null; return; }
  t.for = st.turn;
  if (entries && entries.length) { t.deadline = null; t.startBy = now + replayMs(entries) + CLOCK.startSlackMs; }
  else { t.deadline = now + t.limit * 1000; t.startBy = null; }
}
// The player on the move has seen the move before theirs play out (or skipped it): their clock starts now.
// Once a turn: a deadline set stays (one deadline a turn).
export function startClock(st, side, now) {
  const t = st.timer;
  if (!t || !t.limit || st.winner || t.for !== side || t.deadline != null) return false;
  t.deadline = Math.min(now, t.startBy != null ? t.startBy : now) + t.limit * 1000; t.startBy = null;
  return true;
}
// The turn's deadline: the one set, or the latest it can be (its start not reported yet); null with no clock.
export function clockDeadline(t) {
  if (!t || !t.limit) return null;
  return t.deadline != null ? t.deadline : t.startBy != null ? t.startBy + t.limit * 1000 : null;
}
