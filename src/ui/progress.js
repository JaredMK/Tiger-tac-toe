// Progress bars and tallies shared by the games.
import { N } from './app.js';

// A class attribute (and the moment it shows up, t ms into the move, when there is one): the result of
// a move only appears once its cards or its spin have played out.
export const lateAt = (cls, t, how = 'appear') => `class="${cls}${t != null ? ' ' + how : ''}"${t != null ? ` style="--t:${Math.round(t)}ms"` : ''}`;
export const arcTally = (p, o, inner, extra) => `<div class="ctal ${p}${!o.view && o.turn === p ? ' now' : ''}"><b class="${p} tnm">${N(p)}</b>${extra || ''}${inner}</div>`;
// A tally's gauge (December 2026: Risky Rolls' behaviour for every game with a score gauge): the banked fill, `now` of
// `goal` (from `was`, eased over `ms` at `at` when it has just changed), solid as points are secured; and, for points
// that can still be lost (a push-your-luck pot, a hand or a word not yet played), a PENDING segment beyond it, striped in
// the player's colour: `pend` of the goal from `pendFrom`, growing from `pendWas` at `pendAt` (fate 'grow'), shrinking
// away on a bust (fate 'lost') or fading as the fill takes it on a bank (fate 'bank'); none for a steady one: it just stands.
// The `.wbar` of Risky Spins, Peg Drop and Apple Pick, which this extends.
export function gaugeBar(o) {
  const goal = Math.max(1, o.goal), pct = v => (100 * Math.max(0, Math.min(1, v / goal))).toFixed(1) + '%';
  const now = o.now, was = o.was == null ? now : o.was, grow = was !== now;
  const from = o.pendFrom == null ? now : o.pendFrom, pend = Math.max(0, Math.min(o.pend || 0, goal - from)), pw0 = Math.max(0, Math.min(o.pendWas == null ? pend : o.pendWas, goal - from));
  const fate = o.fate || (pw0 !== pend ? 'grow' : '');
  const u = pend > 0 ? `<u class="wpend${fate ? ' ' + fate : ''}" style="--pl:${pct(from)};--pw:${pct(pend)};--pw0:${pct(pw0)};--t:${Math.round(o.pendAt || 0)}ms;--d:${Math.round(o.pendMs || 250)}ms"></u>` : '';
  return `<span class="wbar" aria-hidden="true"><i${grow ? ' class="grow"' : ''} style="--w0:${pct(was)};--w1:${pct(now)};--t:${Math.round(o.at || 0)}ms;--d:${Math.round(o.ms || 500)}ms"></i>${u}</span>`;
}
// The same for a miniature's bar (a still picture of the public state): the pending segment striped beyond the fill.
export const miniFill = (now, goal, pend, attrs = '') => {
  const pct = v => (100 * Math.max(0, Math.min(1, v / goal))).toFixed(1);
  const pp = Math.max(0, Math.min(pend || 0, goal - Math.min(goal, now)));
  return `<i style="--w:${pct(now)}%${pp ? `;--wp:${pct(pp)}%` : ''}"${attrs}></i>`;
};
export const pips = (p, n, goal, fresh, t) => `<span class="pips" aria-label="${n} of ${goal}">${Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', fresh && k === n - 1 ? t : null, 'fillin')}></i>`).join('')}</span>`;
// Takeover: the 5x5 board; a tap on an empty cell is the move. The cell pops in, then the cells around it
// turn over to the mover's colour, one after the other.
// A bar chart: segments [{ cls, n, n0, label }] across a whole of `total`. With a move (t: ms into it) each
// segment grows or shrinks from n0 to n, and its number turns over, at t. Always one height: nothing moves.
export function sbar(segs, total, t, bare) {                         // bare: no numbers in the segments
  const pct = n => (100 * n / total).toFixed(2);
  return `<div class="sbar">${segs.map(g => {
    const moved = t != null && g.n0 != null && g.n0 !== g.n;
    const num = moved ? `<span class="sbn"><span class="tu" style="--u:${t}ms">${g.n0}</span><span class="tf" style="--f:${t}ms">${g.n}</span></span>` : `<span class="sbn"><span>${g.n}</span></span>`;
    return `<i class="${g.cls}${moved ? ' grow' : ''}" style="--w:${pct(g.n)};--w0:${pct(moved ? g.n0 : g.n)}${moved ? `;--t:${t}ms` : ''}" aria-label="${g.label}: ${g.n}">${bare ? '' : num}</i>`;
  }).join('')}</div>`;
}
