// Flood: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Flood',        hint: 'Pick a colour. What the blob grabs is yours. First to 18' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const explainer = { name: 'Flood', play: 'Pick a colour. The blob grows into it, and every square it grabs is yours.', win: 'Get {goal} squares first.' };   // ({goal}: its setting, TUNE below)
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><path d="M3 3h9v5h5v6h4v7H3z" fill="currentColor" fill-opacity=".35"/><path d="M3 3h18v18H3z"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js). The target stays at most 18 of the 35: one player always gets there.
export const TUNE = [
  { k: 'colors', label: 'Colours', def: 5, min: 3, max: 5, step: 1, group: 'Board' },
  { k: 'goal', label: 'Squares to win', def: 18, min: 10, max: 18, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 50, step: 5, group: 'Computer' },
];
