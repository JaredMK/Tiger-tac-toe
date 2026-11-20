// A player's token for the December 2026 games: a round disc in the player's colour with the drawn mark (no text).
import { markSvgG } from './thumbs.js';
export const tok = (p, cls) => `<i class="ntok ${p}${cls ? ' ' + cls : ''}" aria-hidden="true"><svg viewBox="-10 -10 20 20">${markSvgG(p, 5)}</svg></i>`;
// A points tally for the batch's score races: the name, a gauge to the goal and the number (counted on from `was` at
// `at` ms into the move when it has just changed).
import { arcTally, gaugeBar } from './progress.js';
export const ptsTally = (p, o, goal, now, was, at) => {
  const moved = was != null && was !== now;
  return arcTally(p, o, `<span class="wtal">${gaugeBar({ goal, now: Math.min(goal, now), was: Math.min(goal, moved ? was : now), at: at || 0, ms: 300 })}<span class="npts" aria-label="${now} of ${goal}">${moved ? `<b class="cnt" data-from="${was}" data-delay="${Math.round(at || 0)}">${now}</b>` : `<b>${now}</b>`}<small>/${goal}</small></span></span>`);
};
// A miniature's progress rows for a score race: each player's mark and a bar filled to their share of the goal.
export const barRows = (score, goal) => ['X', 'O'].map(p => `<div class="tr nbar ${p}"><b class="${p}">${p}</b><i class="nb" style="--w:${(100 * Math.max(0, Math.min(1, score[p] / Math.max(1, goal)))).toFixed(1)}%"></i></div>`).join('');
