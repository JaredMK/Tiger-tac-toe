// Seating: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Seating',      hint: 'Take a seat at an empty table. Score when a customer sits across from you' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.7.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Seating', play: 'Take a seat at an empty table. You can see who\'s coming in next. If they sit across from you, you score.', win: 'Most customers seated across from you.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="6" width="8" height="12" rx="2" fill="currentColor" fill-opacity=".35"/><path d="M3.5 7.5v9M3.5 13h2.5v3.5M20.5 7.5v9M20.5 13H18v3.5"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the tables and colours dealt into each square (its seats).
export const TUNE = [
  { k: 'tables', label: 'Tables (odd: an even count ties half the squares)', def: 15, min: 7, max: 23, step: 2, group: 'Board' },
  { k: 'colors', label: 'Seat colours', def: 4, min: 2, max: 8, step: 1, group: 'Board' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 50, step: 5, group: 'Computer' },
];
