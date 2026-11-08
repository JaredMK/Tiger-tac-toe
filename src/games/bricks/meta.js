// Brick Break: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Brick Break', hint: 'Drag the paddle, keep the ball up. Clear your wall first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.5.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = false;   // Super Chaos: not dealt (a timed attempt after Start, which the simultaneous rounds' server path keeps to the finger games)
export const realTime = true;   // its move plays back in real time (a run, a recording): never sped up past the replay's own speed (core/timer.js moveRate)
export const explainer = { name: 'Brick Break', play: 'Tap Start, then drag to move the paddle. Bounce the ball into the bricks. Bricks you break stay broken; the ball past the paddle ends your go.', win: 'Clear your wall first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5.5" height="3" rx=".8" fill="currentColor" fill-opacity=".35"/><rect x="9.5" y="3" width="5.5" height="3" rx=".8" fill="currentColor" fill-opacity=".35"/><rect x="16" y="3" width="5" height="3" rx=".8" fill="currentColor" fill-opacity=".35"/><rect x="6" y="7" width="5.5" height="3" rx=".8" fill="currentColor" fill-opacity=".35"/><rect x="12.5" y="7" width="5.5" height="3" rx=".8" fill="currentColor" fill-opacity=".35"/><circle cx="12" cy="14.5" r="1.6" fill="currentColor"/><path d="M7 20h10"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the wall, the ball, the paddle, a go's time, and the
// computer's hand (rules.js brkHand). Tuned by tests/sim/bricks.sim.js (November 2026: a 5x7 wall, the ball at 8 units
// a second gaining 3% a second, a paddle 2.2 units wide, 25 seconds a go: Normal breaks about 8 bricks a go in 15 s,
// Hard about 15; Normal against Normal the winner takes about 5.3 goes and the first mover wins about 57%).
export const TUNE = [
  { k: 'rows', label: 'Wall rows', def: 5, min: 2, max: 8, step: 1, group: 'Board' },
  { k: 'cols', label: 'Wall columns', def: 7, min: 3, max: 10, step: 1, group: 'Board' },
  { k: 'speed', label: 'Ball speed (units/s)', def: 8, min: 3, max: 14, step: 0.5, group: 'Rules' },
  { k: 'speedUp', label: 'Ball speeds up (% per second, to 1.6x)', def: 3, min: 0, max: 10, step: 0.5, group: 'Rules' },
  { k: 'paddle', label: 'Paddle width (units, of 10)', def: 2.2, min: 1, max: 5, step: 0.1, group: 'Rules' },
  { k: 'runSecs', label: 'A go lasts at most (s)', def: 25, min: 10, max: 55, step: 1, group: 'Timing' },
  { k: 'aiReact0', label: 'Computer reaction, fastest (ms)', def: 180, min: 0, max: 800, step: 10, group: 'Computer' },
  { k: 'aiReact1', label: 'Computer reaction, slowest (ms)', def: 300, min: 0, max: 800, step: 10, group: 'Computer' },
  { k: 'aiAim', label: 'Computer aim spread (cm)', def: 55, min: 0, max: 300, step: 5, group: 'Computer' },
  { k: 'aiLapse', label: 'Computer misses a return (%)', def: 13, min: 0, max: 100, step: 1, group: 'Computer' },
];
