// Treasure Hunt: its names, its "?" explainer, its icon and its release default.
import { MODE_TUNE } from '../../core/race.js';

export const info = { name: 'Treasure Hunt', hint: 'Dig a cell: hot, warm, cool or cold. Dig up the treasure to win' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Treasure Hunt', play: 'Dig a square. It tells you if the treasure is hot, warm, cool or cold. Steps count up, down, left and right only, not diagonally.', win: 'Dig up the treasure.' };
export const raceExplainer = { name: 'Treasure Hunt', play: 'Each of you has your own treasure on your own map. Dig a square: it tells you if your treasure is hot, warm, cool or cold. Steps count up, down, left and right only, not diagonally. You can watch the other player\'s digs.', win: 'Dig up your treasure first.' };   // Race mode (core/race.js, rv 2)
export const scExplainer = { name: 'Treasure Hunt', play: 'Dig a square. It tells you if the treasure is hot, warm, cool or cold. Steps count up, down, left and right only, not diagonally. Both digs join the map when the round ends.', win: 'Dig up the treasure.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square (the grid, the mode).
export const TUNE = [
  MODE_TUNE,
  { k: 'n', label: 'Grid size (cells across)', def: 6, min: 4, max: 8, step: 1, group: 'Board' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 60, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9z"/></svg>';
