// Districts: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Districts',    hint: 'Place pieces. Lock more than half the regions' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.1.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Districts', play: 'Place a piece on any open dot. It counts for every region it touches. A grey piece lands on a random dot after each move. Once nobody can catch the leader of a region, it\'s locked for them.', win: 'Lock 3 regions first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><path d="M3 3h18v18H3z"/><path d="M3 11l7-1.5L12 3M10 9.5l3 6.5-10 2M13 16l8-3M10 9.5l11-1"/><circle cx="10" cy="9.5" r="2.2" fill="currentColor" stroke="none"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the map's regions and spots, dealt into each square (its map).
export const TUNE = [
  { k: 'regions', label: 'Regions', def: 5, min: 4, max: 6, step: 1, group: 'Board' },
  { k: 'spots', label: 'Spots', def: 16, min: 12, max: 20, step: 4, group: 'Board' },
  { k: 'depthEasy', label: 'How far it looks ahead (1: its own move, 2: your best answer too)', def: 1, opts: [1, 2], group: 'Computer: Easy' },
  { k: 'depth', label: 'How far it looks ahead (1: its own move, 2: your best answer too)', def: 2, opts: [1, 2], group: 'Computer: Normal' },   // (Hard: the expectimax over the grey pieces, solved late)
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/districts): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Place pieces on dots to lead the regions they touch. Lock three regions first to win.';
export const luckSkill = 4;
export const format = 'shared';
// The computer's levels (core/tune.js levelTune): its mistakes by level.
export const AI_LEVELS = { miss: { easy: 25, normal: 5, hard: 10 } };
