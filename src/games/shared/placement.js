// Takeover, Flood, Seating, Districts, Shelves and Roads: what the placement games share.
import { randInt } from '../../core/random.js';

// A score race's moves still needed, for the computer's choice of square: from the lead and the moves left,
// set so that the chance either side takes the square (winChance) is about the logistic of the lead.
export function raceNeeds(lead, remain, scale) {
  const w = 1 / (1 + Math.exp(-lead / scale));
  return Math.max(0.3, 2 * Math.max(0.5, remain) * (1 - w));
}
// Seating, Shelves and Roads: after the move, a random empty place for the customer, the grey mark or the block.
export const randomEmpty = (arr, rng) => { const e = arr.map((x, i) => (x ? -1 : i)).filter(i => i >= 0); return e.length ? e[randInt(rng, e.length)] : null; };
// Seating, Districts, Shelves and Roads: the mark goes down; then the customer walks to their seat, or the
// grey mark or the block drops in; a moment's hold.
export const PLACE_MS = { mark: 350, walk: 900, drop: 500, hold: 400 };   // slide: the board gliding to its next spot, as the next throw is lined up
