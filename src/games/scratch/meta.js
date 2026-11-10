// Scratch & Match: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Scratch & Match', hint: 'Scratch panels on your card. Show three of a kind first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.5.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds (each player's card is their own)
export const explainer = { name: 'Scratch & Match', play: 'Scratch a panel on your card to show its picture. Three of the same picture always sit in a line. When two matching pictures show in a line, the third panel scratches itself right away, in the same move.', win: 'Show three of a kind first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/><path d="M5.2 5.2l2.6 2.6M17.2 16.2l1.6 1.6" stroke-width="2.6"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): how many different pictures a square uses, how many of
// them appear three times on a card (each along a line), and how many of the other pictures appear twice (the rest
// once). Tuned by tests/sim/scratch.sim.js (November 2026: 6 pictures, one line, two pairs: the winner takes about
// 4.9 scratches, the first mover wins about 54%).
export const TUNE = [
  { k: 'kinds', label: 'Different pictures on the cards', def: 6, min: 4, max: 8, step: 1, group: 'Board' },
  { k: 'lines', label: 'Pictures that appear three times (each in a line)', def: 1, min: 1, max: 2, step: 1, group: 'Rules' },
  { k: 'pairs', label: 'Other pictures that appear twice', def: 2, min: 0, max: 3, step: 1, group: 'Rules' },
];
