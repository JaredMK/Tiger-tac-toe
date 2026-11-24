// Target Practice: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Target Practice', hint: 'Three taps to aim a dart. Knock out all your targets first to win' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its aim is timed taps: replayed as it was made (core/timer.js moveRate)
export const explainer = { name: 'Target Practice', play: 'One throw is three taps: stop the line sweeping across, stop the line sweeping up and down, then stop the circle as it shrinks and grows. The dart lands somewhere inside the circle: a smaller circle is a surer shot. A hit knocks the target out.', win: 'First to knock out all {targets} of their targets.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="3.500"/><path d="M11 13 21 3M17.500 3H21v3.500"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the targets each player has and their size (the field is 100
// across), how fast the two lines sweep (ms to cross once), the aiming circle's smallest and largest size and how
// fast it pulses (ms from one to the other), and the computer's aim.
export const TUNE = [
  { k: 'targets', label: 'Targets each', def: 4, min: 1, max: 7, step: 1, group: 'Rules' },
  { k: 'size', label: 'Target size (radius; the field is 100 across)', def: 11, min: 5, max: 20, step: 1, group: 'Board' },
  { k: 'sweepMs', label: 'Sliders: time to cross once (ms)', def: 1000, min: 300, max: 3000, step: 50, group: 'Timing' },
  { k: 'circleMin', label: 'Aiming circle: smallest (radius)', def: 5, min: 1, max: 30, step: 1, group: 'Board' },
  { k: 'circleMax', label: 'Aiming circle: largest (radius)', def: 26, min: 5, max: 50, step: 1, group: 'Board' },
  { k: 'pulseMs', label: 'Aiming circle: time from largest to smallest (ms)', def: 700, min: 200, max: 3000, step: 50, group: 'Timing' },
  { k: 'aiErr', label: 'Aim error (field units)', def: 7, min: 0, max: 30, step: 0.5, group: 'Computer: Normal' },
  { k: 'aiErrHard', label: 'Aim error (field units)', def: 5.5, min: 0, max: 30, step: 0.5, group: 'Computer: Hard' },
  { k: 'aiErrEasy', label: 'Aim error (field units)', def: 9, min: 0, max: 30, step: 0.5, group: 'Computer: Easy' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/target): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Stop two sweeping lines and a pulsing circle to throw. Knock out all your targets first.';
export const luckSkill = 4;
export const format = 'race';
