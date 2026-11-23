// Takeover: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Takeover',     hint: 'Take a square and the ones around it. Most squares wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.14.0';   // (1.14.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Takeover', play: 'Tap an empty square to take it and the squares around it, even your opponent\'s.', win: 'Own the most when the board is full.' };
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="2.5" width="6" height="6" rx="1.2"/><rect x="2.5" y="9" width="6" height="6" rx="1.2"/><rect x="9" y="9" width="6" height="6" rx="1.2"/><rect x="15.5" y="9" width="6" height="6" rx="1.2"/><rect x="9" y="15.5" width="6" height="6" rx="1.2"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the board's side dealt into each square (its cells).
export const TUNE = [
  { k: 'size', label: 'Board size (cells a side)', def: 5, opts: [5, 7], group: 'Board' },
  { k: 'depth', label: 'Computer look-ahead (moves)', def: 2, opts: [1, 2], group: 'Computer' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 50, step: 5, group: 'Computer' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/takeover): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Take an empty square and every square around it, even your rival\'s. Own the most when it\'s full.';
export const luckSkill = 5;
export const format = 'shared';
