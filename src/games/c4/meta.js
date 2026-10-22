// Connect 4: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Connect 4',    hint: 'Pieces drop. Four in a row wins' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'shared';   // what the players share, in its "?" label: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const explainer = { name: 'Connect 4', play: 'Drop a piece into a column.', win: '{k} in a row, any direction.' };   // ({k}: its setting, TUNE below)
// Its settings (the admin's Mini-game Settings; core/tune.js): read through tune(mini).
export const TUNE = [
  { k: 'k', label: 'Pieces in a row to win', def: 4, min: 3, max: 5, step: 1, group: 'Rules' },
  { k: 'depth', label: 'Computer look-ahead (moves)', def: 5, min: 1, max: 6, step: 1, group: 'Computer' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 50, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="19" r="3"/><circle cx="12" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 2v9M8.5 8 12 11.5 15.5 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
