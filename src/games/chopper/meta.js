// Chopper: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Chopper',      hint: 'Hold to rise, let go to drop. First to 1,000 m' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Chopper', play: 'Hold to rise, let go to drop.', win: 'Reach 1,000 m first.' };
// Its settings (the admin's Mini-game Settings; core/tune.js), beside the runner config (config/run): dealt
// into the square's cfg when changed (shared/runner.js).
export const TUNE = [
  { k: 'grace', label: 'Clear start of each run (s)', def: 2, min: 1, max: 4, step: 0.25, group: 'Timing' },
  { k: 'up', label: 'Climb when held (m/s²)', def: 16, min: 12, max: 22, step: 1, group: 'Rules' },
  { k: 'down', label: 'Drop when let go (m/s²)', def: 15, min: 12, max: 22, step: 1, group: 'Rules' },
  { k: 'aiRuns', label: 'Computer: runs to finish (about)', def: 4.5, min: 2, max: 10, step: 0.5, group: 'Computer' },
  { k: 'aiSpread', label: 'Computer: run length spread (%)', def: 45, min: 15, max: 80, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h16M12 4.5V8"/><ellipse cx="13" cy="12" rx="6" ry="4" fill="currentColor" fill-opacity=".35"/><path d="M7 11.5H2.5l-1-2.5M8.5 19h10M11 16v3M16 16v3"/></svg>';
