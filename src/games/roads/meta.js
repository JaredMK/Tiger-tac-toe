// Roads: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Roads',        hint: 'Claim the edges of a honeycomb. The longest unbroken road wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Roads', play: 'Claim an edge of the honeycomb. Random edges get blocked after each move.', win: 'Have the longest unbroken road. The square ends early once the other player can no longer catch up.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V12h8V4h8"/><g fill="currentColor" stroke="none"><circle cx="4" cy="4" r="1.6"/><circle cx="20" cy="20" r="1.6"/><circle cx="12" cy="20" r="1.6"/><circle cx="20" cy="12" r="1.6"/></g></svg>';
// The honeycomb for new squares (the admin's config/roads): 'hex7', 7 hexagons (30 edges), or 'hex4', a smaller
// diamond of 4 (19 edges).
export const ROADS_DEFAULTS = { layout: 'hex7' };
// Its Mini-game Settings (core/tune.js; the honeycomb stays in config/roads above).
export const TUNE = [
  { k: 'blocks', label: 'Edges blocked after each move', def: 1, min: 0, max: 2, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 50, step: 5, group: 'Computer' },
];
