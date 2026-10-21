// Shelves: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Shelves',      hint: 'Mark shelves. Be on the most when they are full' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const explainer = { name: 'Shelves', play: 'Put a mark on a shelf. A grey mark lands somewhere after each move.', win: 'Be on the most of the {n} shelves. A tie goes to whoever moved second here.' };   // ({n}: its setting, TUNE below)
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M3 2.5v19M21 2.5v19M3 8h18M3 14h18M3 20h18"/><rect x="5.5" y="3.5" width="3.5" height="4" fill="currentColor" stroke="none"/><rect x="14" y="9.5" width="3.5" height="4" fill="currentColor" stroke="none"/><rect x="9.5" y="15.5" width="3.5" height="4" fill="currentColor" fill-opacity=".45" stroke="none"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the shelves and their spots dealt into each square (its cells).
export const TUNE = [
  { k: 'n', label: 'Shelves', def: 7, min: 5, max: 7, step: 1, group: 'Board' },
  { k: 'per', label: 'Spots a shelf', def: 3, min: 2, max: 4, step: 1, group: 'Board' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 50, step: 5, group: 'Computer' },
];
