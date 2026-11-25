// Hot Potato: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Hot Potato', hint: 'Toss the bomb away. It ticks after every turn on the board' };
export const release = 'admin';   // the default (the admin's dashboard can change it): Admin only on every platform
export const minVersion = '1.36.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const superChaos = false;   // (it ticks with the board's turns: Super Chaos's rounds have none)
export const explainer = { name: 'Hot Potato', play: 'Play here to toss the bomb to the other player. Only the player holding it can play here. After every turn on the board, the bomb may go off.', win: 'If it goes off while the other player holds it, the square is yours.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.500" cy="14" r="7"/><path d="M15.500 9l2.500-2.500"/><path d="M19 3.500l.5 1.500M21.500 5l-1.500.5M20.500 2l-.5 1.200"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the explosion's chance a tick, how it grows and its ceiling.
// The computer: one move and no choice in the square (ai.js); on the board it tosses a bomb it holds at once, unless it
// can win the match outright that turn (core/ai.js). No mistake setting: there is no weaker toss.
export const AI_LEVELS = { miss: false };
export const TUNE = [
  { k: 'start', label: 'Chance it goes off each tick, to start (%)', def: 10, min: 1, max: 100, step: 1, group: 'Rules' },
  { k: 'grace', label: 'Ticks before the chance starts to grow', def: 5, min: 0, max: 50, step: 1, group: 'Rules' },
  { k: 'inc', label: 'Chance added each step (%)', def: 1, min: 0, max: 50, step: 1, group: 'Rules' },
  { k: 'every', label: 'Ticks a step', def: 2, min: 1, max: 20, step: 1, group: 'Rules' },
  { k: 'cap', label: 'Highest chance (%)', def: 100, min: 1, max: 100, step: 1, group: 'Rules' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/hot-potato): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Toss the bomb to your rival. It ticks after every turn on the board. Be the one not holding it when it blows.';
export const luckSkill = 1;
export const format = 'shared';
