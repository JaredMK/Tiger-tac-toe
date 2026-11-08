// Bingo: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Bingo', hint: 'Pick numbers, then call one of the three balls; it marks every card it is on. Complete a line first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.5.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = false;   // one shared pool of numbers and one draw a turn: not a game for simultaneous rounds
export const explainer = { name: 'Bingo', play: 'Tap Pick numbers and {offer} balls roll out. Call one: it marks every card it is on, yours and theirs.', win: 'Complete a line on your card first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/><circle cx="6" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the card's size (a line is a full row, column or diagonal),
// the numbers' range, how many numbers come up each turn, and whether diagonals count. Tuned by tests/sim/bingo.sim.js
// (November 2026: a 3x3 card from 1 to 26, three numbers a turn, diagonals on: the winner takes about 4.9 calls, the first mover
// wins about 55% of the decided squares, about 7% of squares tie; 1 to 20 made games of 4.1 calls, 1 to 30 of 5.5).
export const TUNE = [
  { k: 'size', label: 'Card size (n x n)', def: 3, min: 3, max: 5, step: 1, group: 'Board' },
  { k: 'range', label: 'Numbers run from 1 to', def: 26, min: 10, max: 60, step: 1, group: 'Board' },
  { k: 'offer', label: 'Numbers offered each turn', def: 3, min: 2, max: 4, step: 1, group: 'Rules' },
  { k: 'diag', label: 'Diagonals count (1 = yes, 0 = no)', def: 1, min: 0, max: 1, step: 1, group: 'Rules' },
];
