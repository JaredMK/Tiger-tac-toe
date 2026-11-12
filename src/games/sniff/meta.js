// Sniff: its names, its "?" explainer, its icon and its release default.
import { MODE_TUNE } from '../../core/race.js';

export const info = { name: 'Sniff',        hint: 'Walk the dog, any of 8 ways. Hotter, colder or the same? Find the treasure' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.15.0';   // (1.15.0: distance in steps, a diagonal counting one)   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds (its own form: a dog each)
export const explainer = { name: 'Sniff', play: 'Move the dog one step, any of 8 ways. A diagonal step counts the same as a straight one. You\'ll see if it\'s getting hotter, colder or the same.', win: 'Be the one who finds the treasure.' };
export const raceExplainer = { name: 'Sniff', play: 'You each have a dog and your own treasure, the same number of steps from where both dogs start. Move yours one step, any of 8 ways (a diagonal counts as one step), to see if it\'s getting hotter, colder or the same. You can watch the other dog.', win: 'Be the first dog onto your treasure.' };   // Race mode (core/race.js, rv 2)
// Its settings (the admin's Mini-game Settings; core/tune.js): read from the square's own values.
export const TUNE = [
  MODE_TUNE,
  { k: 'minStart', label: 'Dog starts at least (steps from the treasure, diagonals count one)', def: 3, min: 1, max: 4, step: 1, group: 'Board' },
  { k: 'hold', label: 'Hotter/colder shown for (ms)', def: 1200, min: 600, max: 4000, step: 100, group: 'Timing' },
  { k: 'memory', label: 'Computer remembers (last steps)', def: 3, min: 1, max: 8, step: 1, group: 'Computer' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 60, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><ellipse cx="12" cy="16" rx="4.8" ry="4"/><ellipse cx="5.4" cy="10.2" rx="2" ry="2.4"/><ellipse cx="9.4" cy="6.2" rx="2" ry="2.5"/><ellipse cx="14.6" cy="6.2" rx="2" ry="2.5"/><ellipse cx="18.6" cy="10.2" rx="2" ry="2.4"/></svg>';
export const scExplainer = { name: 'Sniff', play: 'You each have a dog, both starting in the middle. Move yours one step, any of 8 ways, to see if it\'s getting hotter, colder or the same.', win: 'Be the first dog onto the treasure.' };
