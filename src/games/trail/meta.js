// Trail Race: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Trail Race', hint: 'Grow your trail to the far side. Trails are walls. First across wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.25.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Trail Race', play: 'Grow your trail by up to {cells} squares a turn: forward or sideways, never back. Both trails are walls: nobody crosses one. If you have no way to go when your turn comes, your trail is rubbed out and you start again from your own edge.', win: 'First to reach the far edge.{evenText}' };
export const explainVars = v => ({ evenText: v.even === 'on' ? ' If the first player gets there first, the other player gets one turn to answer: the shorter trail wins.' : '' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21v-6h6V9h6V3"/><path d="M15 5l3-2.500L21 5"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the board's size (6, not the 7 first asked for: with nothing
// by chance who wins turns on the board's size, and at 7 the second to move took 70% of squares between two Normal
// computers over 8 turns each), how many squares a trail may grow a turn, and equal turns (rules.js; off: between two
// strong players it makes every square a draw, as without it the first to move takes every square).
export const TUNE = [
  { k: 'size', label: 'Board size', def: 6, min: 5, max: 9, step: 1, group: 'Board' },
  { k: 'cells', label: 'Squares a turn, at most', def: 2, min: 1, max: 4, step: 1, group: 'Rules' },
  { k: 'even', label: 'Equal turns (the other player answers; the shorter trail wins)', def: 'off', opts: ['off', 'on'], group: 'Rules' },
];
