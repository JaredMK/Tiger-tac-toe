// A timed round played on this phone (the second December 2026 batch's arcade games: Fruit Slice, Rhythm Tap, Road
// Race): the plumbing they share. `makeRound(type, o)` keeps the round under way and gives start(), end() and
// tick(now) (called each frame): o.mine() says whether this phone may start one now; o.begin(mini, p) makes the
// round's own state; o.step(L, ms) runs it at `ms` from its start and returns false once it is over; o.move(L) is the
// move it goes in as. A round ends early when the square is left, the match ends or the turn's time runs out (it goes
// in as it stands). The clock is real time whatever the Animation setting. Only the result is sent: the other phone
// sees what came of the round, never a stream of it.
import { attemptMove } from '../net/moves.js';
import { blocked } from '../net/room.js';
import { state } from './app.js';
import { clockLeft } from './clock.js';
import { render } from './render.js';

export function makeRound(type, o) {
  let live = null;
  const end = () => { const L = live; if (!L) return; live = null; attemptMove(o.move(L)); render(); };
  return {
    get live() { return live; },
    on: zoom => !!live && live.sq === zoom,
    start() {
      const sq = state.squares && state.squares[state.zoom];
      if (live || !sq || !sq.mini || sq.mini.type !== type || sq.owner || state.flash || state.done || state.winner || blocked() || !o.mine()) return false;
      live = o.begin(sq.mini, state.turn); live.sq = state.zoom; live.p = state.turn; live.mini = sq.mini; live.t0 = performance.now();
      render(); if (o.go) o.go();
      return true;
    },
    end,
    tick(now) {
      const L = live; if (!L) return;
      if (state.screen !== 'mini' || state.zoom !== L.sq || state.winner) { end(); return; }
      const left = clockLeft(); if (left != null && left <= (state.online ? 900 : 0)) { end(); return; }
      if (o.step(L, now - L.t0) === false) end();
    },
  };
}
