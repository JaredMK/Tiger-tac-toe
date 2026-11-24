// Flap: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Flap',         hint: 'Tap to flap through the gaps. First to 450 m' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.9.0';   // (1.9.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Flap', play: 'Tap to flap through the gaps.', win: 'Reach the finish first.' };
// Its settings (the admin's Mini-game Settings; core/tune.js), beside the runner config (config/run): dealt
// into the square's cfg when changed (shared/runner.js).
export const TUNE = [
  { k: 'grace', label: 'Clear start of each run (s)', def: 2, min: 1, max: 4, step: 0.25, group: 'Timing' },
  { k: 'maxSecs', label: 'Attempt time limit (s)', def: 30, min: 5, max: 60, step: 1, group: 'Timing' },   // (shared/runner.js RUN_MAX: the same default)
  { k: 'gaps', label: 'Gap size (%)', def: 100, min: 95, max: 130, step: 5, group: 'Board' },
  { k: 'aiRunsEasy', label: 'Runs it takes to finish, about (more: shorter runs)', def: 5.5, min: 2, max: 12, step: 0.5, group: 'Computer: Easy' },
  { k: 'aiSpreadEasy', label: 'How much its run lengths vary (%)', def: 50, min: 15, max: 80, step: 5, group: 'Computer: Easy' },
  { k: 'aiRuns', label: 'Runs it takes to finish, about (more: shorter runs)', def: 4.5, min: 2, max: 12, step: 0.5, group: 'Computer: Normal' },   // (the key from before the levels: Normal's)
  { k: 'aiSpread', label: 'How much its run lengths vary (%)', def: 45, min: 15, max: 80, step: 5, group: 'Computer: Normal' },
  { k: 'aiRunsHard', label: 'Runs it takes to finish, about (more: shorter runs)', def: 3.5, min: 2, max: 12, step: 0.5, group: 'Computer: Hard' },
  { k: 'aiSpreadHard', label: 'How much its run lengths vary (%)', def: 40, min: 15, max: 80, step: 5, group: 'Computer: Hard' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><ellipse cx="10.5" cy="13" rx="7" ry="5.6" fill="currentColor" fill-opacity=".35"/><path d="M17.3 11.6l4.2 1.6-4.2 1.6"/><path d="M6.5 12.5c1.2-4 4-6.2 6.5-6.4-.8 2.2-2 4.6-3.6 6.4z" fill="currentColor"/><circle cx="13.6" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg>';
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/flap): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Tap to flap through the gaps. Reach the finish first.';
export const luckSkill = 4;
export const format = 'race';
