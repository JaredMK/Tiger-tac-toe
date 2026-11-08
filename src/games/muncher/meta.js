// Muncher: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Muncher',      hint: 'Swipe to steer round the maze. Eat the dots, dodge the spooks' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.5.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds (each player's maze is their own: the default fork and merge)
export const realTime = true;   // its move plays back in real time (a run): never sped up past the replay's own speed (core/timer.js moveRate)
export const explainer = { name: 'Muncher', play: 'Tap Start, then swipe to steer through the maze and eat the dots. A spook catches you and the run ends, but the dots you ate stay eaten.', win: 'Eat the target number of dots first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 7.8 13.5L12 12z" fill="currentColor" fill-opacity=".35"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="20" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="21" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the target, the spooks, the speeds, a run's time and the
// computer's hand. Tuned by tests/sim/muncher.sim.js (November 2026): 18 dots of about 21 (a dot on every other cell),
// two spooks a touch faster than the muncher and nearly always after it, 7 seconds a run: the Normal computer against
// itself takes about 5.7 runs for the winner, the first mover wins about 59%.
export const TUNE = [
  { k: 'target', label: 'Dots to win', def: 18, min: 5, max: 48, step: 1, group: 'Rules' },
  { k: 'ghosts', label: 'Spooks in the maze', def: 2, min: 1, max: 2, step: 1, group: 'Board' },
  { k: 'speed', label: 'Muncher speed (cells a second)', def: 3.5, min: 2, max: 7, step: 0.1, group: 'Rules' },
  { k: 'ghostSpeed', label: 'Spook speed (cells a second)', def: 3.8, min: 1, max: 7, step: 0.1, group: 'Rules' },
  { k: 'chase', label: 'Spooks head for you at a junction (%)', def: 90, min: 0, max: 100, step: 5, group: 'Rules' },
  { k: 'grace', label: 'Spooks wait at the start (s)', def: 1, min: 0, max: 5, step: 0.5, group: 'Timing' },
  { k: 'runSecs', label: 'A run lasts at most (s)', def: 7, min: 4, max: 40, step: 1, group: 'Timing' },
  { k: 'aiReact', label: 'Computer decides every (ms)', def: 200, min: 50, max: 500, step: 10, group: 'Computer' },
  { k: 'aiAvoid', label: 'Computer keeps this far from a spook (cells)', def: 2, min: 0, max: 5, step: 1, group: 'Computer' },
  { k: 'aiLapse', label: 'Computer forgets the spooks (%)', def: 20, min: 0, max: 100, step: 1, group: 'Computer' },
];
