// Scoop Stack: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Scoop Stack',  hint: 'Drag the cone to catch scoops. Stack to the target first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.28.0';   // (1.28.0: the view follows the stack's top from the first scoop, so a miss leaves the screen sooner; 1.14.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Scoop Stack', play: 'Drag the cone to catch scoops. Dodge the bad stuff. Your stack carries over between turns.', win: 'Stack to the target first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><path d="M7.5 13.5h9L12 22.5z" fill="currentColor" fill-opacity=".35"/><circle cx="12" cy="10.5" r="3.6"/><circle cx="12" cy="4.6" r="2.8" fill="currentColor"/></svg>';
export const SCOOP_DEFAULTS = { target: 25, v0: 5, v1: 8.5, gap0: 0.9, gap1: 0.6, haz0: 18, haz1: 38, sway: 1, cone: 12 };
// Its settings (the admin's Mini-game Settings; core/tune.js; the falls' stay in SCOOP_DEFAULTS): the misses
// an attempt allows (rules.js: scoopStart) and the computer's hand (finger.js: fingHand).
export const TUNE = [
  { k: 'maxSecs', label: 'Attempt time limit (s)', def: 20, min: 5, max: 60, step: 1, group: 'Timing' },   // (the computer's attempts: p95–p99 about 20 s; the attempt ends at it, progress kept: shared/finger.js fingCap)
  { k: 'misses', label: 'Misses allowed', def: 3, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'aiReact0', label: "Normal: reaction, fastest (ms)", def: 260, min: 0, max: 800, step: 10, group: 'Computer: Normal' },
  { k: 'aiReact1', label: "Normal: reaction, slowest (ms)", def: 360, min: 0, max: 800, step: 10, group: 'Computer: Normal' },
  { k: 'aiAim', label: "Normal: aim spread (% of a scoop)", def: 46, min: 0, max: 200, step: 1, group: 'Computer: Normal' },
  { k: 'aiLapse', label: "Normal: misses a hazard (%)", def: 20, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'aiReact0Easy', label: "Easy: reaction, fastest (ms)", def: 290, min: 0, max: 800, step: 10, group: 'Computer: Easy' },
  { k: 'aiReact1Easy', label: "Easy: reaction, slowest (ms)", def: 400, min: 0, max: 800, step: 10, group: 'Computer: Easy' },
  { k: 'aiAimEasy', label: "Easy: aim spread (% of a scoop)", def: 52, min: 0, max: 200, step: 1, group: 'Computer: Easy' },
  { k: 'aiLapseEasy', label: "Easy: misses a hazard (%)", def: 23, min: 0, max: 100, step: 1, group: 'Computer: Easy' },
  { k: 'aiReact0Hard', label: "Hard: reaction, fastest (ms)", def: 230, min: 0, max: 800, step: 10, group: 'Computer: Hard' },
  { k: 'aiReact1Hard', label: "Hard: reaction, slowest (ms)", def: 320, min: 0, max: 800, step: 10, group: 'Computer: Hard' },
  { k: 'aiAimHard', label: "Hard: aim spread (% of a scoop)", def: 40, min: 0, max: 200, step: 1, group: 'Computer: Hard' },
  { k: 'aiLapseHard', label: "Hard: misses a hazard (%)", def: 17, min: 0, max: 100, step: 1, group: 'Computer: Hard' },
];
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/scoop): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Drag the cone to catch scoops and dodge the bad stuff. Stack to the target first.';
export const luckSkill = 4;
export const format = 'race';
