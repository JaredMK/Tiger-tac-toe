// Puzzle Build: its names, its "?" explainer, its icon, its release default and its settings (December 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Puzzle Build', hint: 'Draw a piece and fit it into the picture before the timer runs out. Place more than half to win' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.30.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const superChaos = false;   // one shared puzzle and one piece on show at a time: not a game for simultaneous rounds
export const explainer = { name: 'Puzzle Build', play: 'You both build one picture puzzle. Draw a piece: it fits next to a piece on the board.{rotText} Tap its place, or drag it there, within {secs} seconds. Right: it locks in and scores you a point. Wrong or too slow: it goes back in the pile.{edgeText}{goAgain}', win: 'Place more than half of the pieces.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Right? Draw the next piece.', off: '' };
// {rotText} and {edgeText}: a sentence for each option, only while it is on (ui/explainer.js fillTune).
export const explainVars = v => ({ rotText: v.rotate === 'on' ? ' It comes out turned and fits only the right way up: tap Rotate, or the piece, to turn it.' : '', edgeText: v.edges === 'on' ? ' A piece from the edge of the picture has a flag and a stripe along its outer side.' : '' });
// The icon: a jigsaw piece (a knob on its top and its right, a socket in its bottom and its left).
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7.500h4.200c-.900-2.300.300-4 2-4s2.900 1.700 2 4H16.500v4.300c2.300-.900 4 .300 4 2s-1.700 2.900-4 2V20H12.200c.900-2.300-.300-3.800-2-3.800s-2.900 1.500-2 3.800H4v-4.200c2.300.900 3.800-.300 3.800-2S6.300 10.900 4 11.800z"/></svg>';
// Its settings (the admin's Games page; core/tune.js). The grid (an odd one starts with its centre piece in place unless
// that is switched off; an even one has no centre and starts empty), the edge pieces marked (a stripe along each side
// on the picture's border and a flag: the view alone), the pieces drawn turned (each must be turned the right way up to
// fit: rules.js), the piece timer on the mover's phone, how often the computer finds a piece's place at each level
// (with four or more places to choose between; with fewer it is surer, with one it cannot miss: ai.js jigChance) and,
// with the pieces turned, how often it turns one the right way up. Tuned by tests/sim/jigsaw.sim.js: see its header for
// the numbers, the draws above all (eight pieces between two players who never miss is always 4-4).
export const TUNE = [
  AGAIN_TUNE,
  { k: 'size', label: 'Grid size (n x n pieces)', def: 3, min: 3, max: 5, step: 1, group: 'Board' },
  { k: 'centre', label: 'Centre piece in place at the start (odd grids only: an even grid has no centre and starts empty)', def: 'off', opts: ['on', 'off'], group: 'Board' },   // (off by default, December 2026: on, eight pieces between two careful players often ends 4-4, a draw; off, nine pieces, never a draw)
  { k: 'edges', label: 'Mark edge pieces', def: 'off', opts: ['off', 'on'], group: 'Board' },   // (a stripe along each side on the picture's border and a flag in a corner, on the piece on show and the pieces placed)
  { k: 'rotate', label: 'Pieces drawn rotated', def: 'off', opts: ['off', 'on'], group: 'Rules' },   // (a quarter, half or three-quarter turn; Rotate turns it on the player's phone and it fits only the right way up)
  { k: 'secs', label: 'Piece timer (seconds to place a piece)', def: 8, min: 3, max: 30, step: 1, group: 'Timing' },
  { k: 'aiEasy', label: 'Easy computer: right placements (%)', def: 55, min: 5, max: 100, step: 1, group: 'Computer' },
  { k: 'aiNormal', label: 'Normal computer: right placements (%)', def: 75, min: 5, max: 100, step: 1, group: 'Computer' },
  { k: 'aiHard', label: 'Hard computer: right placements (%)', def: 92, min: 5, max: 100, step: 1, group: 'Computer' },
  { k: 'aiTurnEasy', label: 'Easy computer: rotated pieces turned the right way up (%)', def: 75, min: 5, max: 100, step: 1, group: 'Computer' },   // (with "Pieces drawn rotated" on)
  { k: 'aiTurnNormal', label: 'Normal computer: rotated pieces turned the right way up (%)', def: 90, min: 5, max: 100, step: 1, group: 'Computer' },
  { k: 'aiTurnHard', label: 'Hard computer: rotated pieces turned the right way up (%)', def: 97, min: 5, max: 100, step: 1, group: 'Computer' },
];
