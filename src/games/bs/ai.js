// Battleship: the computer's play.
import { randInt } from '../../core/random.js';
import { BS, bsCandidates } from './rules.js';

export function needs(pm, p) {
  const n = bsCandidates(pm).length; return Math.max(1, pm.len - pm.hits.length + (n <= 1 ? 0 : Math.log2(n) / 2));
}
export function best(pm, me, rng, style, ctx) {
  // Fire where the ship most often still fits, given every hit and miss (so around a hit once there
  // is one); between equals, the shot most likely to sink it.
  const cand = bsCandidates(pm), open = pm.revealed.map((r, i) => (r ? -1 : i)).filter(i => i >= 0);
  if (!cand.length) return { move: open[randInt(rng, open.length)], q: 0, shared: true };
  const cover = new Array(BS.n * BS.n).fill(0), sinks = new Array(BS.n * BS.n).fill(0);
  for (const cells of cand) {
    const left = cells.filter(k => !pm.hits.includes(k));
    for (const k of left) cover[k]++;
    if (left.length === 1) sinks[left[0]]++;
  }
  let top = [];
  for (const k of open) {
    if (!top.length || cover[k] > cover[top[0]] || (cover[k] === cover[top[0]] && sinks[k] > sinks[top[0]])) top = [k];
    else if (cover[k] === cover[top[0]] && sinks[k] === sinks[top[0]]) top.push(k);
  }
  const move = top[randInt(rng, top.length)];
  return { move, q: sinks[move] / cand.length, shared: true };
}
