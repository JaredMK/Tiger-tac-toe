// Four in a Row: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Four in a Row',    hint: 'Pieces drop. Four in a row wins' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Four in a Row', play: 'Drop a piece into a column.', win: '{k} in a row, any direction.' };   // ({k}: its setting, TUNE below)
// Its settings (the admin's Mini-game Settings; core/tune.js): read through tune(mini).
export const TUNE = [
  { k: 'k', label: 'Pieces in a row to win', def: 4, min: 3, max: 5, step: 1, group: 'Rules' },
  { k: 'depth', label: 'Computer look-ahead (moves)', def: 5, min: 1, max: 6, step: 1, group: 'Computer' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 50, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="19" r="3"/><circle cx="12" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 2v9M8.5 8 12 11.5 15.5 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
