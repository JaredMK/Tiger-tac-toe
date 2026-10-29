// Scoop Stack: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Scoop Stack',  hint: 'Drag the cone to catch scoops. Stack to the target first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Scoop Stack', play: 'Drag the cone to catch scoops. Dodge the bad stuff. Your stack carries over between turns.', win: 'Stack to the target first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><path d="M7.5 13.5h9L12 22.5z" fill="currentColor" fill-opacity=".35"/><circle cx="12" cy="10.5" r="3.6"/><circle cx="12" cy="4.6" r="2.8" fill="currentColor"/></svg>';
export const SCOOP_DEFAULTS = { target: 25, v0: 5, v1: 8.5, gap0: 0.9, gap1: 0.6, haz0: 18, haz1: 38, sway: 1, cone: 12 };
// Its settings (the admin's Mini-game Settings; core/tune.js; the falls' stay in SCOOP_DEFAULTS): the misses
// an attempt allows (rules.js: scoopStart) and the computer's hand (finger.js: fingHand).
export const TUNE = [
  { k: 'misses', label: 'Misses allowed', def: 3, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'aiReact0', label: 'Computer reaction, fastest (ms)', def: 260, min: 0, max: 800, step: 10, group: 'Computer' },
  { k: 'aiReact1', label: 'Computer reaction, slowest (ms)', def: 360, min: 0, max: 800, step: 10, group: 'Computer' },
  { k: 'aiAim', label: 'Computer aim spread (% of a scoop)', def: 46, min: 0, max: 200, step: 1, group: 'Computer' },
  { k: 'aiLapse', label: 'Computer misses a hazard (%)', def: 20, min: 0, max: 100, step: 1, group: 'Computer' },
];
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
