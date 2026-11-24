// Darts Cricket: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Darts Cricket', hint: 'Stop both lines to throw. Close every number and the bullseye to win' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.25.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its aim is timed taps: replayed as it was made (core/timer.js moveRate)
export const explainer = { name: 'Darts Cricket', play: 'Stop the sideways line, then the up-down line. The dart lands where they cross. A dart in a numbered wedge marks that number{dblText}. The bullseye marks too{heartText}. {hits} marks close a number.{scoreText}', win: 'First to close every number and the bullseye.{scoreWin}' };
export const explainVars = v => ({
  dblText: v.doubles === 'on' ? ', its outer band twice' : '', heartText: v.heart > 0 ? ', its heart twice' : '',
  scoreText: v.scoring === 'on' ? ' A mark on a number you have closed and the other player has not is a point.' : '',
  scoreWin: v.scoring === 'on' ? ' You need at least as many points as the other player.' : '',
});
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.200"/><circle cx="12" cy="12" r="2.600"/><path d="M12 2.800v6.600M4 16.600l5.700-3.300M20 16.600l-5.700-3.300"/></svg>';
// Its settings (the admin's Games page; core/tune.js): how many numbers are in play (drawn from 15 to 20; the board
// has twice as many wedges, every other one dead), the marks that close a number, scoring on numbers the other player
// has not closed, whether a wedge's outer band counts twice and how wide it is, the bullseye's and its heart's size
// (the board's radius is 42 on a wall of 100), how fast the lines sweep, and the computer's aim.
export const TUNE = [
  { k: 'numbers', label: 'Numbers in play', def: 3, min: 2, max: 5, step: 1, group: 'Rules' },
  { k: 'hits', label: 'Marks to close a number', def: 2, min: 1, max: 3, step: 1, group: 'Rules' },
  { k: 'scoring', label: 'Scoring on numbers the other player has not closed', def: 'off', opts: ['off', 'on'], group: 'Rules' },
  { k: 'doubles', label: 'A wedge\'s outer band counts twice', def: 'on', opts: ['on', 'off'], group: 'Board' },
  { k: 'band', label: 'Outer band width (the board\'s radius is 42)', def: 12, min: 4, max: 20, step: 1, group: 'Board' },
  { k: 'bull', label: 'Bullseye size (radius)', def: 10, min: 4, max: 16, step: 0.5, group: 'Board' },
  { k: 'heart', label: 'Bullseye heart, counts twice (radius; 0: none)', def: 5, min: 0, max: 10, step: 0.5, group: 'Board' },
  { k: 'sweepMs', label: 'Lines: time to cross once (ms)', def: 900, min: 300, max: 3000, step: 50, group: 'Timing' },
  { k: 'aiErr', label: 'Aim error (wall units)', def: 7, min: 0, max: 30, step: 0.5, group: 'Computer: Normal' },
  { k: 'aiErrHard', label: 'Aim error (wall units)', def: 5.5, min: 0, max: 30, step: 0.5, group: 'Computer: Hard' },
  { k: 'aiErrEasy', label: 'Aim error (wall units)', def: 6, min: 0, max: 30, step: 0.5, group: 'Computer: Easy' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/cricket): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Stop two lines to throw darts at the numbers. Close every number and the bullseye first.';
export const luckSkill = 4;
export const format = 'race';
