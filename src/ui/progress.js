// Progress bars and tallies shared by the games.
import { N } from './app.js';

// A class attribute (and the moment it shows up, t ms into the move, when there is one): the result of
// a move only appears once its cards or its spin have played out.
export const lateAt = (cls, t, how = 'appear') => `class="${cls}${t != null ? ' ' + how : ''}"${t != null ? ` style="--t:${Math.round(t)}ms"` : ''}`;
export const arcTally = (p, o, inner, extra) => `<div class="ctal ${p}${!o.view && o.turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b>${extra || ''}${inner}</div>`;
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
