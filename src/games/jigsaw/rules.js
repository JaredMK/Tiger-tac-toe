// Heads or Tails: the rules (pure: no page, no clock; the server runs the same code).
// A move is one call, 'h' or 't', and the coin is flipped (the move's rng: the server's online). Separate (the
// default): each player their own count of right calls; a wrong call scores nothing. Shared (`boards`): the one flip
// counts for both, the mover having called and the other player holding the other side: a wrong call is the other
// player's point. First to `wins` right calls takes the square. One call a turn.
import { needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const HEADS = { flip: 1700, judge: 1800, hold: 520 };   // (December 2026: ten full twirls, slowing before it lands)   // ms from the move: the coin lands, the verdict, the result held
export const headsCfg = mini => ({ wins: tune(mini).wins });
export function create(type, rng) { return { type, shared: tuneLive(type).boards === 'shared', n: { X: 0, O: 0 }, flips: 0, last: null }; }
export function apply(mini, p, m, rng, idx) {
  if (m !== 'h' && m !== 't') return { ok: false, reason: 'bad' };
  const c = headsCfg(mini), o = p === 'X' ? 'O' : 'X', side = needRng(rng)() < 0.5 ? 'h' : 't', right = side === m, to = right ? p : mini.shared ? o : null;
  const from = { X: mini.n.X, O: mini.n.O };
  if (to) mini.n[to]++;
  mini.flips++;
  mini.last = { by: p, call: m, side, right, to, from, n: { X: mini.n.X, O: mini.n.O } };
  if (to && mini.n[to] >= c.wins) return to === p ? { ok: true, outcome: 'win', note: 'won' } : { ok: true, outcome: 'win', winner: o, note: 'gift' };
  return { ok: true, outcome: 'continue', note: right ? 'right' : 'wrong' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return { type: 'jigsaw', shared: mini.shared, n: { X: mini.n.X, O: mini.n.O }, flips: mini.flips, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null }; }
export function randomMove(mini, p, rng, from, empties) { return from(['h', 't']); }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.ht = JSON.parse(JSON.stringify(mini.last)); }
export function flashMs(f, winLen, won) { return HEADS.judge + HEADS.hold + (won ? 500 : 0); }
