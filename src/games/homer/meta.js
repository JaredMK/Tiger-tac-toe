// Home Run Heroes (the Home Run Derby of the December 2026 batch, under a name of its own): its names, its "?"
// explainer, its icon, its release default and its settings.

export const info = { name: 'Home Run Heroes', hint: 'Swing as each pitch crosses the plate. First to 4 home runs wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its move is played live and replayed as it was (core/timer.js moveRate)
export const explainer = { name: 'Home Run Heroes', play: 'Step up for {pitches} pitches. Tap to swing as the ball crosses the plate. Perfect timing is a home run; close is only a hit.', win: 'First to {goal} home runs.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 15.500 8.500a2.800 2.800 0 0 1 4 4L8 24" transform="translate(0 -2)"/><circle cx="6.500" cy="6.500" r="3"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the pitches an at-bat has, the home runs that win, how long a
// pitch is in the air (drawn per pitch between the fastest and the slowest), the timing windows either side of the
// perfect moment, and the computer's timing error at each level.
export const TUNE = [
  { k: 'goal', label: 'Home runs to take the square', def: 4, min: 1, max: 8, step: 1, group: 'Rules' },
  { k: 'pitches', label: 'Pitches in an at-bat', def: 3, min: 1, max: 6, step: 1, group: 'Rules' },
  { k: 'fastMs', label: 'Fastest pitch: time in the air (ms)', def: 430, min: 250, max: 1500, step: 10, group: 'Timing' },
  { k: 'slowMs', label: 'Slowest pitch: time in the air (ms)', def: 780, min: 250, max: 1500, step: 10, group: 'Timing' },
  { k: 'hrMs', label: 'Home run window: either side of perfect (ms)', def: 30, min: 10, max: 150, step: 5, group: 'Timing' },
  { k: 'hitMs', label: 'Hit window: either side of perfect (ms)', def: 90, min: 20, max: 300, step: 5, group: 'Timing' },
  { k: 'aiMs', label: 'Normal computer: timing error (ms)', def: 100, min: 10, max: 250, step: 5, group: 'Computer' },
  { k: 'aiMsHard', label: 'Hard computer: timing error (ms)', def: 60, min: 10, max: 250, step: 5, group: 'Computer' },
  { k: 'aiMsEasy', label: 'Easy computer: timing error (ms)', def: 150, min: 10, max: 250, step: 5, group: 'Computer' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/homer): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Tap to swing as the ball crosses the plate. Perfect timing is a home run. Hit enough first.';
export const luckSkill = 4;
export const format = 'race';
