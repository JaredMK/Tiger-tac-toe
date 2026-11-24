// Pinball: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Pinball',      hint: 'Tap left or right to flip. Light every target first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.16.0';   // (1.16.0: the first version with its rules as they are now, December 2026 audit; was 1.13.0); (1.13.0: the November 2026 rework: a new table and the ball worked out in the engine's own arithmetic, a move its inputs alone; an older client's ball would not be the server's) the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Pinball', play: 'Tap left or right to flip. One ball per turn.', win: 'Light every target first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3.5 18.5l6 2.5M20.5 18.5l-6 2.5"/><circle cx="13" cy="10" r="3" fill="currentColor"/><circle cx="6" cy="5" r="2" stroke-width="1.8"/><circle cx="18" cy="4.5" r="2" stroke-width="1.8"/></svg>';
export const PINB_DEFAULTS = { size: 1.3, save: 3, maxBall: 120, g: 1, bump: 1, spin: 1 };
// Its settings (the admin's Mini-game Settings; core/tune.js; the table's own stay in PINB_DEFAULTS): the
// targets dealt (rules.js: pinDeal) and the computer's hand (finger.js: fingHand).
export const TUNE = [
  { k: 'targets', label: 'Targets to light', def: 7, min: 3, max: 7, step: 1, group: 'Rules' },
  { k: 'maxSecs', label: 'Attempt time limit (s)', def: 30, min: 5, max: 60, step: 1, group: 'Timing' },   // (from Start; at the limit the ball ends as a drain, its targets kept: physics-sim.js pinStep. The computer's balls: median 9.5 s, p95 25 s, p99 30 s)
  { k: 'aiReact0', label: "Normal: reaction, fastest (ms)", def: 50, min: 0, max: 400, step: 5, group: 'Computer: Normal' },
  { k: 'aiReact1', label: "Normal: reaction, slowest (ms)", def: 90, min: 0, max: 400, step: 5, group: 'Computer: Normal' },
  { k: 'aiJitter', label: "Normal: flip timing error (ms)", def: 50, min: 0, max: 200, step: 5, group: 'Computer: Normal' },
  { k: 'aiLetGo', label: "Normal: lets a ball go by unflipped (%)", def: 0, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'aiAnyPull', label: "Normal: launches at any strength, not for a target (%)", def: 25, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'aiReact0Easy', label: "Easy: reaction, fastest (ms)", def: 110, min: 0, max: 400, step: 5, group: 'Computer: Easy' },
  { k: 'aiReact1Easy', label: "Easy: reaction, slowest (ms)", def: 150, min: 0, max: 400, step: 5, group: 'Computer: Easy' },
  { k: 'aiJitterEasy', label: "Easy: flip timing error (ms)", def: 110, min: 0, max: 200, step: 5, group: 'Computer: Easy' },
  { k: 'aiLetGoEasy', label: "Easy: lets a ball go by unflipped (%)", def: 20, min: 0, max: 100, step: 1, group: 'Computer: Easy' },
  { k: 'aiAnyPullEasy', label: "Easy: launches at any strength, not for a target (%)", def: 100, min: 0, max: 100, step: 1, group: 'Computer: Easy' },
  { k: 'aiReact0Hard', label: "Hard: reaction, fastest (ms)", def: 20, min: 0, max: 400, step: 5, group: 'Computer: Hard' },
  { k: 'aiReact1Hard', label: "Hard: reaction, slowest (ms)", def: 40, min: 0, max: 400, step: 5, group: 'Computer: Hard' },
  { k: 'aiJitterHard', label: "Hard: flip timing error (ms)", def: 10, min: 0, max: 200, step: 5, group: 'Computer: Hard' },
  { k: 'aiLetGoHard', label: "Hard: lets a ball go by unflipped (%)", def: 0, min: 0, max: 100, step: 1, group: 'Computer: Hard' },
  { k: 'aiAnyPullHard', label: "Hard: launches at any strength, not for a target (%; Hard also aims its flips at an unlit target)", def: 0, min: 0, max: 100, step: 1, group: 'Computer: Hard' },
];
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/pinball): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Tap left or right to flip. One ball a turn. Light every target first.';
export const luckSkill = 3;
export const format = 'race';
