// Point Roll: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own score. A move picks a number, 2 to 12 but never 7; then two dice are rolled again and again
// (the move's rng: the server's online) until they total that number (its points are scored) or 7 (nothing). A rarer
// number is worth more: the points are set so every number is worth about the same on average (a number's chance of
// coming before a 7 is ways / (ways + 6)). First to the target takes the square. One pick a turn.
import { needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

export const PROLL = { land: 620, gap: 170, judge: 160, hold: 560, cap: 400 };   // ms: a roll's tumble, the pause before the next, the verdict after the last landing, the result held; cap: the rolls of one move at the very most
export const PICKS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const WAYS = n => 6 - Math.abs(7 - n);
export const prollChance = n => WAYS(n) / (WAYS(n) + 6);          // the number comes before a 7
export function prollCfg(mini) {
  const t = tune(mini), pts = {};
  PICKS.forEach(n => { pts[n] = t['p' + Math.min(n, 14 - n)]; });
  return { target: t.target, pts, shown: t.shown };
}
export function create(type, rng) { return { type, score: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }; }
export function apply(mini, p, m, rng, idx) {
  if (!PICKS.includes(m)) return { ok: false, reason: 'bad' };
  const c = prollCfg(mini), r = needRng(rng), rolls = [];
  let nr = 0, hit = false;
  for (;;) {
    const d = nr >= PROLL.cap ? [3, 4] : [1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6)];
    nr++; rolls.push(d); if (rolls.length > c.shown) rolls.shift();
    if (d[0] + d[1] === m) { hit = true; break; }
    if (d[0] + d[1] === 7) break;
  }
  const from = mini.score[p], pts = hit ? c.pts[m] : 0;
  mini.score[p] = Math.min(c.target, from + pts); mini.n[p]++;
  mini.last = { by: p, pick: m, rolls, nr, hit, pts, from, to: mini.score[p] };
  if (mini.score[p] >= c.target) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: hit ? 'hit' : 'seven' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return { type: 'proll', score: { X: mini.score.X, O: mini.score.O }, n: { X: mini.n.X, O: mini.n.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null }; }
export function randomMove(mini, p, rng, from, empties) { return from(PICKS); }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.pr = JSON.parse(JSON.stringify(mini.last)); }
// When each of the rolls on show is thrown and lands, and the verdict (ms from the move).
export function prollTimes(n) { const step = PROLL.land + PROLL.gap, at = Array.from({ length: n }, (_, k) => k * step), end = at[n - 1] + PROLL.land; return { at, land: at.map(t => t + PROLL.land), end, judge: end + PROLL.judge }; }
export function flashMs(f, winLen, won) { return prollTimes(f.pr ? f.pr.rolls.length : 1).judge + PROLL.hold + (won ? 500 : 0); }
