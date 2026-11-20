// Mahjong: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Mahjong', hint: 'Take off matching pairs of free tiles. First to clear their tiles wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // (with the whole layout to clear, every order of pairs takes as many turns: the deal decides) the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Mahjong', play: 'Tap two matching tiles to take them off. A tile is free when nothing lies on it and its left or right side is open.{chainText}', win: 'First to clear {goal} pairs.' };
export const explainVars = v => ({ chainText: (v.chain === 'off' ? '' : ' If your pair uncovers a tile underneath, go again.') + (v.even === 'off' ? '' : ' Whoever starts second always gets as many turns: finish level and it is a draw.') });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="9" height="13" rx="1.800"/><rect x="9.500" y="3" width="9" height="13" rx="1.800" fill="#fff"/><path d="M14 7v5M11.800 9.500h4.400"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the pairs that win, the layout's size in pairs (its shape goes
// with it), how many different pictures the tiles are drawn from, and whether a pair that uncovers a tile keeps the turn.
export const TUNE = [
  { k: 'goal', label: 'Pairs to take the square', def: 12, min: 2, max: 12, step: 1, group: 'Rules' },
  { k: 'chain', label: 'A pair that uncovers a tile keeps the turn', def: 'on', opts: ['on', 'off'], group: 'Rules' },
  { k: 'even', label: 'Equal turns (the second player may answer; level is a draw)', def: 'on', opts: ['on', 'off'], group: 'Rules' },
  { k: 'pairs', label: 'Layout size (pairs of tiles)', def: 12, opts: [6, 8, 9, 10, 12], group: 'Board' },
  { k: 'set', label: 'Pictures to draw the tiles from', def: 12, min: 6, max: 16, step: 1, group: 'Board' },
];
