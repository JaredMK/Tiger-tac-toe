// Odd One Out: its names, its "?" explainer, its icon and its release default, and its default settings.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Odd One Out',  hint: 'Reveal, then tap the odd shade in 5 s. Three finds wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.16.0';   // (1.16.0: the first version with its rules as they are now, December 2026 audit; was 1.0.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Odd One Out', play: "Reveal, then tap the odd shade within {secs} seconds.{goAgain}", win: 'Find {goal}.' };   // ({secs}, {goal}: its settings, TUNE below)
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" opacity=".45"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/></svg>';
export const ODD_DEFAULTS = { d1: 4, d2: 2.8, d3: 2 };                   // the difference at each level (ΔE 2000): noticeable, subtle, very subtle
// Its settings (the admin's Mini-game Settings; core/tune.js) beyond config/oddone: the finds to win, the grid at
// each level, the time to pick, and how often the computer finds it at each level.
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Found it? Go again.', off: '' };
export const TUNE = [
  AGAIN_TUNE,
  { k: 'goal', label: 'Finds to win', def: 3, min: 2, max: 6, step: 1, group: 'Rules' },
  { k: 'n1', label: 'Grid size, level 1 (tiles across)', def: 3, min: 3, max: 6, step: 1, group: 'Board' },
  { k: 'n2', label: 'Grid size, level 2 (tiles across)', def: 4, min: 3, max: 6, step: 1, group: 'Board' },
  { k: 'n3', label: 'Grid size, level 3 (tiles across)', def: 5, min: 3, max: 6, step: 1, group: 'Board' },
  { k: 'secs', label: 'Time to pick (s)', def: 5, min: 2, max: 15, step: 1, group: 'Timing' },
  { k: 'aiSkillEasy', label: "Easy: finds the odd one this share of Normal's rate (%)", def: 75, min: 10, max: 200, step: 5, group: 'Computer: Easy' },
  { k: 'ai1', label: "Normal: finds it, level 1 (%)", def: 75, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'ai2', label: "Normal: finds it, level 2 (%)", def: 60, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'ai3', label: "Normal: finds it, level 3 (%)", def: 45, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'aiSkillHard', label: "Hard: finds the odd one this share of Normal's rate (%, at most 99%)", def: 125, min: 10, max: 200, step: 5, group: 'Computer: Hard' },
];
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/oddone): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Reveal the tiles, then tap the odd shade out before time runs out. Find enough first.';
export const luckSkill = 4;
export const format = 'race';
