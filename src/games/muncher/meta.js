// Muncher: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Muncher',      hint: 'Swipe to steer round the maze. Eat the dots, dodge the spooks' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.6.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do); 1.6.0: the 13 by 15 maze, four spooks, pellets and tunnels (a run from before would not replay the same)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds (each player's maze is their own: the default fork and merge)
export const realTime = true;   // its move plays back in real time (a run): never sped up past the replay's own speed (core/timer.js moveRate)
export const explainer = { name: 'Muncher', play: 'Tap Start, then swipe to steer through the maze and eat the dots. A turn pressed early is taken at the next opening; the side tunnels lead round to the other side. A power pellet turns the spooks blue for a moment: eat one for {ghostDots} dots. A spook catches you and the run ends, but what you ate stays eaten.', win: 'Eat {target} dots first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 7.8 13.5L12 12z" fill="currentColor" fill-opacity=".35"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="20" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="21" cy="14" r="1.2" fill="currentColor" stroke="none"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the target, the speeds, the spooks' phases, the pellets,
// a run's time and the computer's hand. Tuned by tests/sim/muncher.sim.js (November 2026): 75 dots of about 90 (a dot on every
// open cell), the muncher at 3.5 cells a second against the spooks' 3.9 (slower in the tunnels and frightened), a second's
// scatter then 7 of chase, a 7-second run, a spook eaten worth 12 dots: the Normal computer against itself takes about
// 4.5 runs for the winner, the first mover wins about 56%, over half the runs end on a spook.
export const TUNE = [
  { k: 'target', label: 'Dots to win', def: 75, min: 10, max: 120, step: 1, group: 'Rules' },
  { k: 'speed', label: 'Muncher speed (cells a second)', def: 3.5, min: 2, max: 8, step: 0.1, group: 'Rules' },
  { k: 'ghostSpeed', label: 'Spook speed (cells a second)', def: 3.9, min: 1, max: 8, step: 0.1, group: 'Rules' },
  { k: 'frightSpeed', label: 'Frightened spook speed (% of theirs)', def: 50, min: 20, max: 100, step: 5, group: 'Rules' },
  { k: 'tunnelSpeed', label: 'Spook speed in a tunnel (%)', def: 45, min: 20, max: 100, step: 5, group: 'Rules' },
  { k: 'pellets', label: 'Power pellets in the maze', def: 4, min: 0, max: 4, step: 1, group: 'Board' },
  { k: 'frightSecs', label: 'A pellet frightens the spooks for (s)', def: 4, min: 1, max: 12, step: 0.5, group: 'Timing' },
  { k: 'ghostDots', label: 'A spook eaten is worth (dots)', def: 12, min: 0, max: 20, step: 1, group: 'Rules' },
  { k: 'penSecs', label: 'An eaten spook waits in the pen (s)', def: 1.5, min: 0, max: 8, step: 0.5, group: 'Timing' },
  { k: 'scatterSecs', label: 'Spooks scatter to their corners for (s)', def: 1, min: 0.5, max: 15, step: 0.5, group: 'Timing' },
  { k: 'chaseSecs', label: 'Spooks chase for (s)', def: 7, min: 0.5, max: 30, step: 0.5, group: 'Timing' },
  { k: 'ambush', label: 'The ambusher aims this far ahead of you (cells)', def: 4, min: 0, max: 8, step: 1, group: 'Rules' },
  { k: 'near', label: 'The patroller chases within (cells)', def: 5, min: 0, max: 12, step: 1, group: 'Rules' },
  { k: 'grace', label: 'The first spook waits at the start (s)', def: 0, min: 0, max: 5, step: 0.5, group: 'Timing' },
  { k: 'release', label: 'Each next spook leaves after (s)', def: 0.5, min: 0, max: 3, step: 0.25, group: 'Timing' },
  { k: 'runSecs', label: 'Attempt time limit (s)', def: 7, min: 4, max: 40, step: 1, group: 'Timing' },
  { k: 'aiReact', label: 'Computer decides every (ms)', def: 200, min: 50, max: 500, step: 10, group: 'Computer' },
  { k: 'aiAvoid', label: 'Computer keeps this far from a spook (cells)', def: 2, min: 0, max: 5, step: 1, group: 'Computer' },
  { k: 'aiLapse', label: 'Computer forgets the spooks (%)', def: 10, min: 0, max: 100, step: 1, group: 'Computer' },
];
