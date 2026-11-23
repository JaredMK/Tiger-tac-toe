// Treasure Hunt: its names, its "?" explainer, its icon and its release default.
import { MODE_TUNE } from '../../core/race.js';
import { huntRanges } from './rules.js';

export const info = { name: 'Treasure Hunt', hint: 'Dig a cell: hot, warm, cool or cold. Dig up the treasure to win' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.31.0';   // (1.31.0: the Hint difficulty setting, its bands one table read by the clue, the key and the computer; 1.14.0 before, the December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Treasure Hunt', play: 'Dig a square. It tells you if the treasure is {bandWords}. Steps count up, down, left and right only, not diagonally.{hintText}', win: 'Dig up the treasure.' };
export const raceExplainer = { name: 'Treasure Hunt', play: 'Each of you has your own treasure on your own map. Dig a square: it tells you if your treasure is {bandWords}. Steps count up, down, left and right only, not diagonally.{hintText} You can watch the other player\'s digs.', win: 'Dig up your treasure first.' };   // Race mode (core/race.js, rv 2)
export const scExplainer = { name: 'Treasure Hunt', play: 'Dig a square. It tells you if the treasure is {bandWords}. Steps count up, down, left and right only, not diagonally.{hintText} Both digs join the map when the round ends.', win: 'Dig up the treasure.' };   // in Super Chaos
// The bands in the explainer, from the square's Hint difficulty (rules.js HUNT_HINTS, `hints`): {bandWords} their names
// ("hot, warm, cool or cold"), and {hintText}, while the setting is not 'normal', how far each reaches (normal: nothing).
const BAND_WORD = [null, 'hot', 'warm', 'cool', 'cold'];
export function explainVars(v) {
  const rs = huntRanges(v.hints), names = rs.map(r => BAND_WORD[r.k]);
  const reach = (r, first) => (r.hi == null ? `${r.lo} or more` : r.hi === r.lo ? `${r.lo}${first ? ` step${r.lo === 1 ? '' : 's'}` : ''}` : `${r.lo} ${r.hi === r.lo + 1 ? 'or' : 'to'} ${r.hi}${first ? ' steps' : ''}`);
  const bandWords = `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
  if (!v.hints || v.hints === 'normal') return { bandWords, hintText: '' };
  return { bandWords, hintText: ` ${rs.map((r, k) => `${k ? names[k] : 'Hot is'} ${reach(r, !k)}${k ? '' : ' away'}`).join(', ')}.` };
}
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square (the grid, the mode).
export const TUNE = [
  MODE_TUNE,
  { k: 'hints', label: 'Hint difficulty (normal: Hot 1 step, Warm 2–3, Cool 4–5, Cold 6+; hard: Hot 1–2, Warm 3–5, Cool 6–8, Cold 9+; harder: Hot 1–3, Warm 4–6, Cold 7+)', def: 'normal', opts: ['normal', 'hard', 'harder'], group: 'Rules' },
  { k: 'n', label: 'Grid size (cells across)', def: 6, min: 4, max: 8, step: 1, group: 'Board' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 60, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9z"/></svg>';
