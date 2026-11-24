// Snake: its names, its "?" explainer, its icon, its release default and its settings. (Not Snakes and Ladders,
// id `snakes`: this is the one snake on a garden grid, id `snake`.)

export const info = { name: 'Snake',        hint: 'Swipe to steer. Eat your colour, not theirs. First to the target' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.14.0';   // (1.14.0: the first version with its rules as they are now, December 2026 audit; was 1.8.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds (each player's runs and apples are their own)
export const realTime = true;   // its move plays back in real time (a run): never sped up past the replay's own speed (core/timer.js moveRate)
export const explainer = { name: 'Snake', play: 'Swipe to turn. Eat your colour for a point; the other colour scores for the other player. The wall, a bomb or your tail ends the run.', win: 'First to {target} points.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17c0-2.2 1.8-4 4-4h8a3 3 0 0 0 0-6H9"/><circle cx="4.6" cy="17" r="2.1" fill="currentColor" fill-opacity=".35"/><circle cx="18.5" cy="6" r="2.2" fill="currentColor"/><path d="M18.5 3.8V2.6"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the points to win, the food of each colour on the
// grid, the snake's pace (a cell every `tick` ms at the start of a run, `speedUp` ms less per food eaten in it,
// never under `minTick`), the longest a run may last, and the computer's hands (how often each misses a turn by
// a tick, as a person does; faster play makes it err more; and how often it loses track for a few ticks after a
// food, which is what spreads a run's points as a person's spread). Tuned by tests/sim/snake.sim.js (November 2026:
// 30 points; Normal against Normal the winner takes about 4.9 runs and the first mover wins about 58%).
export const TUNE = [
  { k: 'target', label: 'Points to win', def: 30, min: 5, max: 60, step: 1, group: 'Rules' },
  { k: 'grow', label: 'Growth per food (cells)', def: 1, min: 0, max: 5, step: 1, group: 'Rules' },
  { k: 'ownFood', label: 'Own food on the grid', def: 3, min: 1, max: 6, step: 1, group: 'Rules' },
  { k: 'oppFood', label: 'Opponent food on the grid', def: 3, min: 0, max: 6, step: 1, group: 'Rules' },
  { k: 'bombs', label: 'Bombs on the grid', def: 2, min: 0, max: 8, step: 1, group: 'Rules' },
  { k: 'tick', label: 'Pace: ms per cell at the start of a run', def: 200, min: 80, max: 400, step: 10, group: 'Timing' },
  { k: 'speedUp', label: 'Faster per food eaten in the run (ms)', def: 5, min: 0, max: 30, step: 1, group: 'Timing' },
  { k: 'minTick', label: 'Fastest pace (ms per cell)', def: 100, min: 50, max: 300, step: 10, group: 'Timing' },
  { k: 'runCap', label: 'Attempt time limit (s)', def: 35, min: 10, max: 60, step: 5, group: 'Timing' },
  { k: 'aiErr', label: 'Normal: misses a turn (%)', def: 2, min: 0, max: 50, step: 0.5, group: 'Computer: Normal' },
  { k: 'aiGrow', label: 'Normal: misses more for every food of the run (%)', def: 0.5, min: 0, max: 30, step: 0.5, group: 'Computer: Normal' },
  { k: 'aiSlip', label: 'Normal: loses track after a food (%)', def: 18, min: 0, max: 60, step: 0.5, group: 'Computer: Normal' },
  { k: 'aiErrHard', label: 'Hard: misses a turn (%)', def: 0.5, min: 0, max: 50, step: 0.5, group: 'Computer: Hard' },
  { k: 'aiGrowHard', label: 'Hard: misses more for every food of the run (%)', def: 0.5, min: 0, max: 30, step: 0.5, group: 'Computer: Hard' },
  { k: 'aiSlipHard', label: 'Hard: loses track after a food (%)', def: 12, min: 0, max: 60, step: 0.5, group: 'Computer: Hard' },
  { k: 'aiTriesHard', label: 'Hard: runs it tries before choosing the best (as its time allows)', def: 1, min: 1, max: 5, step: 1, group: 'Computer: Hard' },
  { k: 'aiErrEasy', label: 'Easy: misses a turn (%)', def: 3, min: 0, max: 50, step: 0.5, group: 'Computer: Easy' },
  { k: 'aiGrowEasy', label: 'Easy: misses more for every food of the run (%)', def: 0.5, min: 0, max: 30, step: 0.25, group: 'Computer: Easy' },
  { k: 'aiSlipEasy', label: 'Easy: loses track after a food (%)', def: 24, min: 0, max: 60, step: 0.5, group: 'Computer: Easy' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/snake): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Swipe to steer and eat your colour. The wall, a bomb or your tail ends the run. Reach the target first.';
export const luckSkill = 4;
export const format = 'race';
