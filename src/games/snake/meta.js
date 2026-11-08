// Snake: its names, its "?" explainer, its icon, its release default and its settings. (Not Snakes and Ladders,
// id `snakes`: this is the one snake on a garden grid, id `snake`.)

export const info = { name: 'Snake',        hint: 'Swipe to steer. Eat your colour, not theirs. First to the target' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.5.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds (each player's runs and apples are their own)
export const realTime = true;   // its move plays back in real time (a run): never sped up past the replay's own speed (core/timer.js moveRate)
export const explainer = { name: 'Snake', play: 'Tap Start, then swipe to turn. Red food is X\'s, yellow is O\'s. Eat your own colour for a point; the other colour gives the other player a point. The wall or your own tail ends the run.', win: 'First to {target} points.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17c0-2.2 1.8-4 4-4h8a3 3 0 0 0 0-6H9"/><circle cx="4.6" cy="17" r="2.1" fill="currentColor" fill-opacity=".35"/><circle cx="18.5" cy="6" r="2.2" fill="currentColor"/><path d="M18.5 3.8V2.6"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the points to win, the food of each colour on the
// grid, the snake's pace (a cell every `tick` ms at the start of a run, `speedUp` ms less per food eaten in it,
// never under `minTick`), the longest a run may last, and the computer's hands (how often each misses a turn by
// a tick, as a person does; faster play makes it err more; and how often it loses track for a few ticks after a
// food, which is what spreads a run's points as a person's spread). Tuned by tests/sim/snake.sim.js (November 2026:
// 30 points; Normal against Normal the winner takes about 4.9 runs and the first mover wins about 58%).
export const TUNE = [
  { k: 'target', label: 'Points to win', def: 30, min: 5, max: 60, step: 1, group: 'Rules' },
  { k: 'food', label: 'Food of each colour on the grid', def: 3, min: 1, max: 4, step: 1, group: 'Rules' },
  { k: 'tick', label: 'Pace: ms per cell at the start of a run', def: 200, min: 80, max: 400, step: 10, group: 'Timing' },
  { k: 'speedUp', label: 'Faster per food eaten in the run (ms)', def: 5, min: 0, max: 30, step: 1, group: 'Timing' },
  { k: 'minTick', label: 'Fastest pace (ms per cell)', def: 100, min: 50, max: 300, step: 10, group: 'Timing' },
  { k: 'runCap', label: 'Longest run (seconds)', def: 35, min: 10, max: 60, step: 5, group: 'Timing' },
  { k: 'aiErr', label: 'Computer misses a turn, Normal (%)', def: 2, min: 0, max: 50, step: 0.5, group: 'Computer' },
  { k: 'aiGrow', label: 'Normal: more per food of the run (%)', def: 0.5, min: 0, max: 30, step: 0.5, group: 'Computer' },
  { k: 'aiSlip', label: 'Normal: loses track after a food (%)', def: 18, min: 0, max: 60, step: 0.5, group: 'Computer' },
  { k: 'aiErrHard', label: 'Computer misses a turn, Hard (%)', def: 1, min: 0, max: 50, step: 0.5, group: 'Computer' },
  { k: 'aiGrowHard', label: 'Hard: more per food of the run (%)', def: 0.5, min: 0, max: 30, step: 0.5, group: 'Computer' },
  { k: 'aiSlipHard', label: 'Hard: loses track after a food (%)', def: 15, min: 0, max: 60, step: 0.5, group: 'Computer' },
];
