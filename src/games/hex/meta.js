// Hex: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Hex',          hint: 'X joins left to right, O joins top to bottom' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Hex', play: 'Claim a hex. X connects left to right, O connects top to bottom.', win: 'Complete your path.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read through tune(mini).
export const TUNE = [
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 50, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5z"/></svg>';
