// Tic-Tac-Toe: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Tic-Tac-Toe',  hint: 'Three in a row wins' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Tic-tac-toe', play: 'Place your mark.', win: 'Three in a row. No line left? The square resets.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read through tune(mini).
export const TUNE = [
  { k: 'aiDepthEasy', label: 'Easy: how many marks ahead it looks (1 = only its own three in a row, 2 = also the other side\'s to block, 3 = forks, 9 = everything)', def: 1, min: 0, max: 9, step: 1, group: 'Computer: Easy' },
  { k: 'aiBlockEasy', label: 'Easy: how often it notices a line to block anyway (%)', def: 70, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiDepthNormal', label: 'Normal: how many marks ahead it looks (2 = wins and blocks, 3 = forks, 9 = everything)', def: 2, min: 0, max: 9, step: 1, group: 'Computer: Normal' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8.5 3v18M15.5 3v18M3 8.5h18M3 15.5h18"/></svg>';
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/ttt): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Place your mark. Three in a row wins.';
export const luckSkill = 5;
export const format = 'shared';
// The computer's levels (core/tune.js levelTune): Normal now and then plays the worst cell (ai.js worse), so Hard, which never
// loses a square, can win one; Easy's own mistakes are its short look-ahead (aiDepthEasy, aiBlockEasy).
export const AI_LEVELS = { miss: { normal: 8 }, think: { hard: 250 } };
