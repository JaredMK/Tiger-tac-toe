// Standoff Grid: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Standoff Grid',   hint: 'Claim a cell. Same cell as your opponent: blocked. Four in a row wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const scOnly = true;       // made for simultaneous rounds: never dealt in a normal match
export const explainer = { name: 'Standoff Grid', play: 'Claim a square. Pick the same square as your opponent in the same round and it\'s blocked for good.', win: '{need} in a row.' };   // ({need}: its setting, TUNE below)
// Its settings (the admin's Mini-game Settings; core/tune.js): the grid is dealt with them, lines read by them.
export const TUNE = [
  { k: 'n', label: 'Grid size (cells across)', def: 5, opts: [4, 5, 6], group: 'Board' },
  { k: 'need', label: 'In a row to win', def: 4, min: 3, max: 4, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 60, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1.2"/><rect x="9.25" y="9.25" width="5.5" height="5.5" rx="1.2"/><rect x="16" y="16" width="5.5" height="5.5" rx="1.2"/><rect x="16" y="2.5" width="5.5" height="5.5" rx="1.2" opacity=".35"/><rect x="2.5" y="16" width="5.5" height="5.5" rx="1.2" opacity=".35"/><path d="M15.2 3.5l5.3 5.3M20.5 3.5l-5.3 5.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
