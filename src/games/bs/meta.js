// Sea Battle: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Sea Battle',   hint: 'Sink the hidden ship. A hit fires again' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Sea Battle', play: "Fire at a square. Hit? Fire again.", win: 'Sink the ship.' };
export const scExplainer = { name: 'Sea Battle', play: 'Fire at a square. Hit? Fire again.', win: 'Hit its last square. If you both do in the same round, the square resets.' };   // in Super Chaos ({scN}, {scLen}: its settings, TUNE below)
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square (n, len).
export const TUNE = [
  { k: 'n', label: 'Sea size (cells across)', def: 4, opts: [4, 5], group: 'Board' },
  { k: 'lenMin', label: 'Shortest ship (cells)', def: 1, min: 1, max: 4, step: 1, group: 'Rules' },
  { k: 'lenMax', label: 'Longest ship (cells)', def: 4, min: 1, max: 4, step: 1, group: 'Rules' },
  { k: 'scN', label: 'Super Chaos sea size (cells across)', def: 5, opts: [4, 5], group: 'Board' },
  { k: 'scLen', label: 'Super Chaos ship (cells)', def: 3, min: 2, max: 4, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 60, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>';
