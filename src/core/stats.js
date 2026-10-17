// What a finished (or abandoned) match adds to the anonymous game stats.
import { RUN_TYPES, runLog } from '../games/shared/runner.js';

// ---------- stats: what a finished (or abandoned) match adds to the anonymous game stats ----------
// Every mini-game played: how it ended ('won', 'draw' when it reset, or 'open' when the match ended
// first), who won it and the turns each side spent in it. A bonus move within a turn (a Risky Rolls roll,
// a Hangman letter after a hit) is part of the same turn.
export function matchStats(st) {
  const squares = (Array.isArray(st.sqlog) ? st.sqlog : []).map(e => Object.assign({ t: e.t, end: e.end, w: e.w || null, X: e.X || 0, O: e.O || 0 }, e.run ? { run: e.run } : {}));
  for (const sq of st.squares || []) {
    if (sq.owner || !sq.mv || !(sq.mv.X + sq.mv.O)) continue;
    squares.push(Object.assign({ t: sq.mini.type, end: 'open', w: null, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(sq.mini.type) ? runLog(sq.mini) : {}));
  }
  const turns = squares.reduce((n, e) => n + e.X + e.O, 0);
  return { squares, turns, winner: st.winner || null, reason: st.winReason || null };
}
