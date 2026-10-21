// Dash: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Dash',         hint: 'Jump the hazards, duck the flyers. First to 550 m' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'skill';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'course';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Dash', play: 'Tap to jump, hold to jump higher. Duck low flyers by staying down. It gets faster as you go, and you keep your distance when you crash.', win: 'Reach 550 m first.' };
// Its settings (the admin's Mini-game Settings; core/tune.js), beside the runner config (config/run): dealt
// into the square's cfg when changed (shared/runner.js).
export const TUNE = [
  { k: 'grace', label: 'Clear start of each run (s)', def: 2, min: 1, max: 4, step: 0.25, group: 'Timing' },
  { k: 'jump', label: 'Jump strength (%)', def: 100, min: 90, max: 110, step: 5, group: 'Rules' },
  { k: 'aiRuns', label: 'Computer: runs to finish (about)', def: 4.5, min: 2, max: 10, step: 0.5, group: 'Computer' },
  { k: 'aiSpread', label: 'Computer: run length spread (%)', def: 45, min: 15, max: 80, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="15.5" cy="4.5" r="2"/><path d="M8.5 20.5l2.5-5.5L7.5 12l3.5-4 3 2.5 3.5-1"/><path d="M11 15l3.5 2.5 1 3"/><path d="M2.5 20.5h4"/></svg>';
