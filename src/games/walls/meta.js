// Wall Race: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Wall Race', hint: 'Step your pawn or place a wall. First pawn to the far side wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Wall Race', play: 'On your turn step your pawn one square (not diagonally; pawns may share a square), or place one of your {walls} walls on a line between squares to slow the other pawn. A wall is two squares long and may never shut a pawn off from its far side.', win: 'First pawn to reach the far side wins.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.500"/><path d="M3 12h9" stroke-width="3.400"/><circle cx="16.500" cy="16.500" r="2.300" fill="currentColor"/><circle cx="7.500" cy="7.500" r="2.300"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the board's size and the walls each player has.
export const AI_LEVELS = { miss: { easy: 30, normal: 10, hard: 0 } };
export const TUNE = [
  { k: 'size', label: 'Board size (squares a side)', def: 5, min: 4, max: 7, step: 1, group: 'Board' },
  { k: 'walls', label: 'Walls each', def: 3, min: 0, max: 6, step: 1, group: 'Rules' },
  // The computer's levels (ai.js levelCfg): how far it looks, and whether it blocks with walls.
  { k: 'aiLookEasy', label: 'How far ahead it looks (1 its shortest way, 2+ moves searched)', def: 1, min: 1, max: 4, step: 1, group: 'Computer: Easy' },
  { k: 'aiBlockEasy', label: 'Puts down walls to block you when behind (looking 1 ahead)', def: 'off', opts: ['off', 'on'], group: 'Computer: Easy' },
  { k: 'aiLookNormal', label: 'How far ahead it looks (1 its shortest way, 2+ moves searched)', def: 1, min: 1, max: 4, step: 1, group: 'Computer: Normal' },
  { k: 'aiBlockNormal', label: 'Puts down walls to block you when behind (looking 1 ahead)', def: 'on', opts: ['off', 'on'], group: 'Computer: Normal' },
  { k: 'aiLookHard', label: 'How far ahead it looks (1 its shortest way, 2+ moves searched)', def: 3, min: 1, max: 4, step: 1, group: 'Computer: Hard' },
  { k: 'aiBlockHard', label: 'Puts down walls to block you when behind (looking 1 ahead)', def: 'on', opts: ['off', 'on'], group: 'Computer: Hard' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/walls): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Step your pawn or drop a wall to slow your rival. First pawn to the far side wins.';
export const luckSkill = 5;
export const format = 'shared';
