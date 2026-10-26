// Sniff: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Sniff',        hint: 'Walk the dog, any of 8 ways. Hotter, colder or the same? Find the treasure' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds (its own form: a dog each)
export const explainer = { name: 'Sniff', play: 'Move the dog one step, any of 8 ways. You\'ll see if it\'s getting hotter, colder or the same.', win: 'Be the one who finds the treasure.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read from the square's own values.
export const TUNE = [
  { k: 'minStart', label: 'Dog starts at least (cells from the treasure, straight line)', def: 3, min: 1, max: 4, step: 1, group: 'Board' },
  { k: 'hold', label: 'Hotter/colder shown for (ms)', def: 1200, min: 600, max: 4000, step: 100, group: 'Timing' },
  { k: 'memory', label: 'Computer remembers (last steps)', def: 3, min: 1, max: 8, step: 1, group: 'Computer' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 60, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><ellipse cx="12" cy="16" rx="4.8" ry="4"/><ellipse cx="5.4" cy="10.2" rx="2" ry="2.4"/><ellipse cx="9.4" cy="6.2" rx="2" ry="2.5"/><ellipse cx="14.6" cy="6.2" rx="2" ry="2.5"/><ellipse cx="18.6" cy="10.2" rx="2" ry="2.4"/></svg>';
export const scExplainer = { name: 'Sniff', play: 'You each have a dog, both starting in the middle. Move yours one step, any of 8 ways, to see if it\'s getting hotter, colder or the same.', win: 'Be the first dog onto the treasure.' };
