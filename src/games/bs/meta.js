// Battleship: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Battleship',   hint: 'Sink the hidden ship. A hit fires again' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the game's kind, an icon in the Advanced checklist: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Battleship', play: "Fire at a square. Hit? Fire again. The ship's size is shown below.", win: 'Sink the ship.' };
export const scExplainer = { name: 'Battleship', play: 'Fire at a square of the {scN}×{scN} sea. Hit? Fire again. The ship is {scLen} squares long. Both players\' shots join the sea when the round ends.', win: 'Hit its last square. If you both do in the same round, the square resets.' };   // in Super Chaos ({scN}, {scLen}: its settings, TUNE below)
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
