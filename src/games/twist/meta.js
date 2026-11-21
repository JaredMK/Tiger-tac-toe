// Twist Four: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Twist Four', hint: 'Place a piece, then twist a quarter of the board. Make a line to win' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Twist Four', play: 'Place one of your pieces on an empty spot, then twist one of the four quarters of the board a quarter turn, either way.', win: 'First to line up {line} in a row wins, straight or diagonal. If a twist makes a line for both, the player who twisted wins.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.500"/><rect x="13" y="13" width="8" height="8" rx="1.500"/><path d="M14 4.500c3 .200 5 2.200 5.500 5M19.500 9.500l-2.300-1M19.500 9.500l1.300-2.200"/><circle cx="7" cy="7" r="1.600" fill="currentColor"/><circle cx="17" cy="17" r="1.600" fill="currentColor"/></svg>';
// Its settings (the admin's Games page; core/tune.js): how many in a row win, and the board's size (its four quarters
// are half as wide: 3x3 on the 6x6 board, 2x2 on the 4x4).
export const TUNE = [
  { k: 'line', label: 'In a row to win', def: 4, min: 3, max: 5, step: 1, group: 'Rules' },
  { k: 'size', label: 'Board size (cells a side)', def: 6, opts: [4, 6], group: 'Board' },
];
