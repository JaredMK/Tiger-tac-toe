// A match given up part way (December 2026, the abandonment data): its quit facts `q`, one small object that rides the
// match's row at its end (functions/statsRules.js quitFacts checks it; the page sends it for a local match, the server
// works it out for an online one, both from this one function). Pure: the moment and the reason come from the caller.
//   r   how it ended: 'menu' (left through the menu), 'closed' (the page or app closed in front), 'bg' (sent to the background
//       and never back), 'reload' (the page reloaded), 'drop' (online: offline 2 minutes), 'timeout' (two turns missed)
//   s   the quitter's side; d their claimed squares less the other side's (below 0: behind on the board)
//   mp  1 when the other side was one square from the match (a line of two with the third open)
//   g   the mini-game in front of them (the square on their screen, else the one held, else the last played), i its square
//   st  [the quitter's moves still needed there, the other side's] (each game's ai.js needs on the public view; never a secret)
//   n   the moves made on the board; idle the ms since the last of them (capped at a day)
import { LINES } from './board.js';
import { needsOf } from './ai.js';
import { publicMini } from './minis.js';
import { other } from './util.js';

export const QUIT_REASONS = ['menu', 'closed', 'bg', 'reload', 'drop', 'timeout'];
const DAY = 86400000;
const r1 = v => (Number.isFinite(v) ? Math.round(Math.min(99, Math.max(0, v)) * 10) / 10 : null);
export function quitFacts(state, side, reason, at, onScreen) {
  if (!state || !Array.isArray(state.squares) || state.squares.length !== 9 || (side !== 'X' && side !== 'O') || !QUIT_REASONS.includes(reason)) return null;
  const sq = state.squares, opp = other(side), own = s => sq.filter(q => q && q.owner === s).length;
  const q = { r: reason, s: side, d: own(side) - own(opp), n: Number.isInteger(state.moves) ? state.moves : 0 };
  if (LINES.some(l => l.filter(k => sq[k].owner === opp).length === 2 && l.some(k => !sq[k].owner))) q.mp = 1;
  const pick = [onScreen, state.lock, state.lastSquare].find(i => Number.isInteger(i) && i >= 0 && i <= 8 && sq[i] && sq[i].mini && !sq[i].owner);
  if (pick !== undefined) {
    const m = sq[pick].mini; q.g = m.type; q.i = pick;
    try { const a = r1(needsOf(publicMini(m, side), side)), b = r1(needsOf(publicMini(m, opp), opp)); if (a !== null && b !== null) q.st = [a, b]; } catch (e) { /* (a game with no needs: no state) */ }
  } else q.i = -1;
  if (Number.isFinite(at) && Number.isFinite(state.lastAt)) q.idle = Math.round(Math.min(DAY, Math.max(0, at - state.lastAt)));
  return q;
}
