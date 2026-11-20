// Peg Jump Race: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Peg Jump Race', hint: 'Step or jump your pegs across the board. First to get all three home wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Peg Jump Race', play: 'Move one peg towards the far side: one step forward (straight or diagonal), or a jump over any peg next to it, yours or theirs. After a jump you may jump again with the same peg. A peg that reaches the far side is home.', win: 'First to get all {pegs} pegs home.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="18" r="2.600"/><circle cx="12" cy="18" r="2.600" fill="currentColor"/><circle cx="19" cy="18" r="2.600"/><path d="M5 13.500C6 6 18 6 19 13.500"/><path d="M16 11.500l3 2.200 2-3.200"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the pegs each player has and the board's size.
export const TUNE = [
  { k: 'pegs', label: 'Pegs each', def: 3, min: 2, max: 4, step: 1, group: 'Rules' },
  { k: 'rows', label: 'Board length (rows to cross)', def: 4, min: 3, max: 6, step: 1, group: 'Board' },
  { k: 'cols', label: 'Board width (columns)', def: 5, min: 4, max: 6, step: 1, group: 'Board' },
];
