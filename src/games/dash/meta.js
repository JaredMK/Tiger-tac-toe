// Dash: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Dash',         hint: 'Jump the hazards, duck the flyers. First to 550 m' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.9.0';   // (1.9.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Dash', play: 'Tap to jump, hold to jump higher.', win: 'Reach the finish first.' };
// Its settings (the admin's Mini-game Settings; core/tune.js), beside the runner config (config/run): dealt
// into the square's cfg when changed (shared/runner.js).
export const TUNE = [
  { k: 'grace', label: 'Clear start of each run (s)', def: 2, min: 1, max: 4, step: 0.25, group: 'Timing' },
  { k: 'maxSecs', label: 'Attempt time limit (s)', def: 20, min: 5, max: 60, step: 1, group: 'Timing' },   // (shared/runner.js RUN_MAX: the same default)
  { k: 'jump', label: 'Jump strength (%)', def: 100, min: 90, max: 110, step: 5, group: 'Rules' },
  { k: 'aiRunsEasy', label: 'Easy: runs it takes to finish (about; it crashes sooner)', def: 6.5, min: 2, max: 12, step: 0.5, group: 'Computer: Easy' },
  { k: 'aiRuns', label: 'Normal: runs it takes to finish (about)', def: 4.5, min: 2, max: 10, step: 0.5, group: 'Computer: Normal' },
  { k: 'aiRunsHard', label: 'Hard: runs it takes to finish (about)', def: 3.2, min: 1, max: 10, step: 0.5, group: 'Computer: Hard' },
  { k: 'aiSpread', label: 'Computer: run length spread (%)', def: 45, min: 15, max: 80, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="15.5" cy="4.5" r="2"/><path d="M8.5 20.5l2.5-5.5L7.5 12l3.5-4 3 2.5 3.5-1"/><path d="M11 15l3.5 2.5 1 3"/><path d="M2.5 20.5h4"/></svg>';
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/dash): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Tap to jump, hold to jump higher. Run the course and reach the finish first.';
export const luckSkill = 4;
export const format = 'race';
