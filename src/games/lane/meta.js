// Lane Rush: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Lane Rush',    hint: 'Swipe between lanes, dodge the traffic. First to 1,000 m' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Lane Rush', play: 'Swipe to change lanes and dodge traffic.', win: 'Reach 1,000 m first.' };
// Its settings (the admin's Mini-game Settings; core/tune.js), beside the runner config (config/run): dealt
// into the square's cfg when changed (shared/runner.js).
export const TUNE = [
  { k: 'grace', label: 'Clear start of each run (s)', def: 2, min: 1, max: 4, step: 0.25, group: 'Timing' },
  { k: 'shift', label: 'Lane change time (ms)', def: 220, min: 150, max: 300, step: 10, group: 'Rules' },
  { k: 'aiRuns', label: 'Computer: runs to finish (about)', def: 4.5, min: 2, max: 10, step: 0.5, group: 'Computer' },
  { k: 'aiSpread', label: 'Computer: run length spread (%)', def: 45, min: 15, max: 80, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 3L3.5 21M17.5 3l3 18"/><path d="M12 3v3M12 9.5v3M12 16v3"/><rect x="13" y="12" width="5.5" height="8" rx="2" fill="currentColor" stroke="none"/></svg>';
