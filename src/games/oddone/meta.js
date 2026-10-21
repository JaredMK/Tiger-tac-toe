// Odd One Out: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Odd One Out',  hint: 'Reveal, then tap the odd shade in 5 s. Three finds wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Odd One Out', play: "Tap Reveal to show the grid, then tap the tile that's a different shade within {secs} seconds. No tap in time counts as a miss. It gets harder each time.", win: 'Find {goal}.' };   // ({secs}, {goal}: its settings, TUNE below)
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" opacity=".45"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/></svg>';
export const ODD_DEFAULTS = { d1: 4, d2: 2.8, d3: 2 };                   // the difference at each level (ΔE 2000): noticeable, subtle, very subtle
// Its settings (the admin's Mini-game Settings; core/tune.js) beyond config/oddone: the finds to win, the grid at
// each level, the time to pick, and how often the computer finds it at each level.
export const TUNE = [
  { k: 'goal', label: 'Finds to win', def: 3, min: 2, max: 6, step: 1, group: 'Rules' },
  { k: 'n1', label: 'Grid size, level 1 (tiles across)', def: 3, min: 3, max: 6, step: 1, group: 'Board' },
  { k: 'n2', label: 'Grid size, level 2 (tiles across)', def: 4, min: 3, max: 6, step: 1, group: 'Board' },
  { k: 'n3', label: 'Grid size, level 3 (tiles across)', def: 5, min: 3, max: 6, step: 1, group: 'Board' },
  { k: 'secs', label: 'Time to pick (s)', def: 5, min: 2, max: 15, step: 1, group: 'Timing' },
  { k: 'ai1', label: "Computer's finds, level 1 (%)", def: 75, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'ai2', label: "Computer's finds, level 2 (%)", def: 60, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'ai3', label: "Computer's finds, level 3 (%)", def: 45, min: 0, max: 100, step: 1, group: 'Computer' },
];
