// Hex: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Hex',          hint: 'X joins left to right, O joins top to bottom' };
export const release = 'admin';   // the default (the admin's dashboard can change it): Admin only: with no swap rule the first mover wins far over 60% between the computer players (tests/sim/hex.sim.js)
export const minVersion = '1.8.0';   // (1.8.0: the first version with its rules as they are now, December 2026 audit; was 1.1.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Hex', play: 'Claim a hex. X connects left to right, O connects top to bottom.', win: 'Complete your path.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read through tune(mini).
export const TUNE = [
  { k: 'aiLookEasy', label: "Easy: how often it thinks about the other side's reply (% of moves)", def: 90, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiBlockEasy', label: "Easy: how often it notices the other side's winning cell and blocks it (%)", def: 90, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiPoolEasy', label: 'Easy: picks at random among this many of the cells that look best', def: 2, min: 1, max: 16, step: 1, group: 'Computer: Easy' },
  { k: 'aiNodesHard', label: 'Hard: how hard it thinks (thousands of positions a move, within its time on a phone)', def: 2, min: 1, max: 100, step: 1, group: 'Computer: Hard' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5z"/></svg>';
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/hex): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Claim hexes. X joins left to right, O top to bottom. Complete your path first.';
export const luckSkill = 5;
export const format = 'shared';
// The computer's levels (core/tune.js levelTune): Hard slips now and then to a good-looking cell that is not its best
// (ai.js worse), else on a board this small it would never lose a square.
export const AI_LEVELS = { miss: { hard: 12 }, think: { hard: 250 } };
