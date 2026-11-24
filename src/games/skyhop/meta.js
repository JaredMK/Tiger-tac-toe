// Sky Hop: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Sky Hop',      hint: 'Drag to steer as you bounce up. Reach the top first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.14.0';   // (1.14.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Sky Hop', play: 'Drag to steer as you bounce up. Fall and your turn ends, but you keep your height.', win: 'Reach the top first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="4.2" fill="currentColor" fill-opacity=".35"/><path d="M12 4.8c0-1.6 1-2.6 2.4-2.8"/><path d="M4 21h7M14 16h6"/><path d="M8 16.5l1.6-2M16 12.5l-1.4 1.6" stroke-width="1.8"/></svg>';
export const HOP_DEFAULTS = { target: 150, bounce: 22, gap0: 3, gap1: 4.5, wide0: 1.5, wide1: 1.1, moveAt: 10, move: 65, moveV: 2.2, breakAt: 8, brk0: 25, brk: 60, hazAt: 15, hazGap: 25, fill0: 0.4, fill1: 0.2 };
// Its settings (the admin's Mini-game Settings; core/tune.js; the course's stay in HOP_DEFAULTS): the computer's hand (finger.js: fingHand).
export const TUNE = [
  { k: 'maxSecs', label: 'Attempt time limit (s)', def: 25, min: 5, max: 60, step: 1, group: 'Timing' },   // (the computer's attempts: p95–p99 about 25 s; the attempt ends at it, progress kept: shared/finger.js fingCap)
  { k: 'aiReact0', label: "Normal: reaction, fastest (ms)", def: 220, min: 0, max: 800, step: 10, group: 'Computer: Normal' },
  { k: 'aiReact1', label: "Normal: reaction, slowest (ms)", def: 320, min: 0, max: 800, step: 10, group: 'Computer: Normal' },
  { k: 'aiAim', label: "Normal: aim spread (cm)", def: 65, min: 0, max: 300, step: 5, group: 'Computer: Normal' },
  { k: 'aiLapse', label: "Normal: misses a hazard (%)", def: 15, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'aiMisjudge', label: "Normal: misjudges a moving platform (%)", def: 50, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'aiReact0Easy', label: "Easy: reaction, fastest (ms)", def: 250, min: 0, max: 800, step: 10, group: 'Computer: Easy' },
  { k: 'aiReact1Easy', label: "Easy: reaction, slowest (ms)", def: 360, min: 0, max: 800, step: 10, group: 'Computer: Easy' },
  { k: 'aiAimEasy', label: "Easy: aim spread (cm)", def: 75, min: 0, max: 300, step: 5, group: 'Computer: Easy' },
  { k: 'aiLapseEasy', label: "Easy: misses a hazard (%)", def: 18, min: 0, max: 100, step: 1, group: 'Computer: Easy' },
  { k: 'aiMisjudgeEasy', label: "Easy: misjudges a moving platform (%)", def: 55, min: 0, max: 100, step: 1, group: 'Computer: Easy' },
  { k: 'aiReact0Hard', label: "Hard: reaction, fastest (ms)", def: 190, min: 0, max: 800, step: 10, group: 'Computer: Hard' },
  { k: 'aiReact1Hard', label: "Hard: reaction, slowest (ms)", def: 280, min: 0, max: 800, step: 10, group: 'Computer: Hard' },
  { k: 'aiAimHard', label: "Hard: aim spread (cm)", def: 55, min: 0, max: 300, step: 5, group: 'Computer: Hard' },
  { k: 'aiLapseHard', label: "Hard: misses a hazard (%)", def: 12, min: 0, max: 100, step: 1, group: 'Computer: Hard' },
  { k: 'aiMisjudgeHard', label: "Hard: misjudges a moving platform (%)", def: 44, min: 0, max: 100, step: 1, group: 'Computer: Hard' },
];
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/skyhop): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Drag to steer as you bounce up. Fall and your turn ends, but you keep your height. Reach the top first.';
export const luckSkill = 4;
export const format = 'race';
