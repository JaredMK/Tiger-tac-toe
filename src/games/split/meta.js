// Shape Split: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Shape Split', hint: 'Cut the shape in half with one straight line. First to 6 points wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Shape Split', play: 'Drag one straight line across your shape to cut it into two equal halves. The nearer to half and half, the more you score: within {band1}% is {pts1}, within {band2}% is {pts2}, within {band3}% is {pts3}.', win: 'First to {target} points.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8 11 3l8 4 2 8-6 6-9-2-3-6z"/><path d="M3 20 21 4" stroke-dasharray="3 3"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the target, the three accuracy bands (how far from 50/50, in
// points of a percent, a cut may be) and what each scores, how many corners a shape has, and the computer's error.
export const TUNE = [
  { k: 'target', label: 'Points to take the square', def: 6, min: 2, max: 20, step: 1, group: 'Rules' },
  { k: 'band1', label: 'Best band: within (% of half)', def: 1, min: 1, max: 10, step: 1, group: 'Rules' },
  { k: 'pts1', label: 'Best band: points', def: 3, min: 1, max: 10, step: 1, group: 'Rules' },
  { k: 'band2', label: 'Middle band: within (% of half)', def: 3, min: 1, max: 20, step: 1, group: 'Rules' },
  { k: 'pts2', label: 'Middle band: points', def: 2, min: 0, max: 10, step: 1, group: 'Rules' },
  { k: 'band3', label: 'Outer band: within (% of half)', def: 6, min: 1, max: 30, step: 1, group: 'Rules' },
  { k: 'pts3', label: 'Outer band: points', def: 1, min: 0, max: 10, step: 1, group: 'Rules' },
  { k: 'corners', label: 'Shape complexity (corners)', def: 8, min: 4, max: 14, step: 1, group: 'Board' },
  { k: 'aiErr', label: 'Normal computer: error (% of the shape, typical)', def: 6, min: 1, max: 20, step: 1, group: 'Computer' },
  { k: 'aiErrHard', label: 'Hard computer: error (%)', def: 3, min: 1, max: 20, step: 1, group: 'Computer' },
  { k: 'aiErrEasy', label: 'Easy computer: error (%)', def: 10, min: 1, max: 20, step: 1, group: 'Computer' },
];
