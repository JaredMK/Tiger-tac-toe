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
export const AI_LEVELS = { miss: { easy: 50, normal: 20, hard: 0 }, think: { normal: 200, hard: 400 } };
export const TUNE = [
  { k: 'line', label: 'In a row to win', def: 4, min: 3, max: 5, step: 1, group: 'Rules' },
  { k: 'size', label: 'Board size (cells a side)', def: 6, opts: [4, 6], group: 'Board' },
  // The computer's levels (ai.js levelCfg): how it picks, whether it blocks; its mistakes are aiMiss<Level>.
  { k: 'aiLookEasy', label: 'How it picks (0 any move that does not lose at once, 1 its best move by score)', def: 1, min: 0, max: 1, step: 1, group: 'Computer: Easy' },
  { k: 'aiBlockEasy', label: 'Blocks a line you could make next move', def: 'off', opts: ['off', 'on'], group: 'Computer: Easy' },
  { k: 'aiLookNormal', label: 'How it picks (0 any move that does not lose at once, 1 its best move by score)', def: 1, min: 0, max: 1, step: 1, group: 'Computer: Normal' },
  { k: 'aiBlockNormal', label: 'Blocks a line you could make next move', def: 'on', opts: ['off', 'on'], group: 'Computer: Normal' },
  { k: 'aiLookHard', label: 'How it picks (0 any move that does not lose at once, 1 its best move by score)', def: 1, min: 0, max: 1, step: 1, group: 'Computer: Hard' },
  { k: 'aiBlockHard', label: 'Blocks a line you could make next move', def: 'on', opts: ['off', 'on'], group: 'Computer: Hard' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/twist): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Place a piece, then twist a quarter of the board. Line up four in a row first.';
export const luckSkill = 5;
export const format = 'shared';
