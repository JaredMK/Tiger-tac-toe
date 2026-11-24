// Number Shuffle: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Number Shuffle', hint: 'Put the digits in order. Higher or lower? Find the hidden number' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.28.0';   // the oldest client version that has this game as it is (core/client.js): Number Target until 1.28.0
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Number Shuffle', play: 'Everyone gets the same {n} digits. A hidden order of them makes a number. Arrange the digits and guess: you are told whether the hidden number is higher or lower.{modeText}', win: 'The first to guess the exact order.' };
export const explainVars = v => ({ modeText: v.mode === 'shared' ? ' There is one hidden number: every guess and answer helps both players.' : ' Each player has their own hidden number.' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3.500"/><path d="M7 8.500h4M9 6.500v4M13.500 8.500h4M7.500 14l3 3M10.500 14l-3 3M13.500 14.500h4M13.500 17h4"/></svg>';
// Its settings (the admin's Games page; core/tune.js): Race (a hidden order each) or Shared (one for both, every guess
// and answer for both), and how many digits (their orders: 3 digits 6, 4 digits 24, 5 digits 120, 6 digits 720).
export const AI_LEVELS = { miss: { easy: 40, normal: 0, hard: 0 }, think: { normal: 150, hard: 300 } };
export const TUNE = [
  { k: 'mode', label: 'Mode (race: a hidden number each; shared: one for both)', def: 'race', opts: ['race', 'shared'], group: 'Rules' },
  { k: 'n', label: 'Digits', def: 5, min: 3, max: 7, step: 1, group: 'Board' },
  // The computer's levels (ai.js): how near the middle of what is left it guesses.
  { k: 'aiHalfEasy', label: 'How near the middle of what is left it guesses (%: 100 halves it every guess)', def: 0, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiHalfNormal', label: 'How near the middle of what is left it guesses (%: 100 halves it every guess)', def: 0, min: 0, max: 100, step: 5, group: 'Computer: Normal' },
  { k: 'aiHalfHard', label: 'How near the middle of what is left it guesses (%: 100 halves it every guess)', def: 100, min: 0, max: 100, step: 5, group: 'Computer: Hard' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/numbers): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Arrange the digits to guess a hidden number and hear higher or lower. Find the exact order first.';
export const luckSkill = 4;
export const format = 'race';
