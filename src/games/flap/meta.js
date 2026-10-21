// Flap: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Flap',         hint: 'Tap to flap through the gaps. First to 450 m' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'skill';   // the game's kind, an icon in the Advanced checklist: 'luck', 'skill' or 'brain'
export const target = 'course';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Flap', play: 'Tap to flap through the gaps. It gets faster, and you keep your distance when you crash.', win: 'Reach 450 m first.' };
// Its settings (the admin's Mini-game Settings; core/tune.js), beside the runner config (config/run): dealt
// into the square's cfg when changed (shared/runner.js).
export const TUNE = [
  { k: 'grace', label: 'Clear start of each run (s)', def: 2, min: 1, max: 4, step: 0.25, group: 'Timing' },
  { k: 'gaps', label: 'Gap size (%)', def: 100, min: 95, max: 130, step: 5, group: 'Board' },
  { k: 'aiRuns', label: 'Computer: runs to finish (about)', def: 4.5, min: 2, max: 10, step: 0.5, group: 'Computer' },
  { k: 'aiSpread', label: 'Computer: run length spread (%)', def: 45, min: 15, max: 80, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><ellipse cx="10.5" cy="13" rx="7" ry="5.6" fill="currentColor" fill-opacity=".35"/><path d="M17.3 11.6l4.2 1.6-4.2 1.6"/><path d="M6.5 12.5c1.2-4 4-6.2 6.5-6.4-.8 2.2-2 4.6-3.6 6.4z" fill="currentColor"/><circle cx="13.6" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg>';
