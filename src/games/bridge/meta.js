// Glass Bridge: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Glass Bridge', hint: 'Hop from row to row. Some glass breaks. First across wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.29.0';   // (1.29.0: a fall sends the player back to the start) the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Glass Bridge', play: 'Hop to a platform in the next row. Safe glass holds and you hop again. Weak glass breaks for good: your turn ends and you go back to the start.', win: 'First across wins.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="7.5" height="6" rx="1.2"/><rect x="13.5" y="3.5" width="7.5" height="6" rx="1.2"/><rect x="3" y="14.5" width="7.5" height="6" rx="1.2"/><path d="M14 15l3 2.5-2 1.5 3.5 2"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the rows, how many platforms a row has and how many of them
// break (drawn per row between the two figures; a row always keeps one safe platform), and one bridge for both or one each.
export const TUNE = [
  { k: 'rows', label: 'Rows to cross', def: 6, min: 3, max: 9, step: 1, group: 'Board' },
  { k: 'pmin', label: 'Platforms in a row, at least', def: 3, min: 2, max: 3, step: 1, group: 'Board' },
  { k: 'pmax', label: 'Platforms in a row, at most', def: 3, min: 2, max: 3, step: 1, group: 'Board' },
  { k: 'bmin', label: 'Weak platforms in a row, at least', def: 2, min: 0, max: 2, step: 1, group: 'Board' },
  { k: 'bmax', label: 'Weak platforms in a row, at most', def: 2, min: 0, max: 2, step: 1, group: 'Board' },
  { k: 'boards', label: 'Bridges (shared: one for both; separate: one each, equally hard)', def: 'shared', opts: ['shared', 'separate'], group: 'Rules' },
];
