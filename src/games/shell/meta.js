// Shell Game: its names, its "?" explainer, its icon, its release default and its settings.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Shell Game',   hint: 'Follow the ball as the cups shuffle. More cups each level' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.22.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const realTime = true;   // its round plays in real time: the mover's own shuffle is never sped up (core/timer.js moveRate)
export const explainer = { name: 'Shell Game', play: 'Watch the ball, then follow its cup as they shuffle. More cups each level.{goAgain}', win: 'Pick right {levels} times.' };
export const goAgainText = { on: ' Right? Go again.', off: '' };   // {goAgain}: while "Go again on success" is on (ui/explainer.js fillTune)
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M2.5 15l1.6-8h4.8l1.6 8z"/><path d="M13.5 12l1.6-8h4.8l1.6 8z"/><circle cx="17.5" cy="18" r="2.6" fill="currentColor" stroke="none"/><path d="M2 19h8"/></svg>';

// The levels there can be (the admin plays 1 to 5 of them: `levels`), and each level's values in the three presets
// (the admin's page fills its fields from one, then edits by hand: admin.js presets). Normal is the default.
//   c  cups; ms the travel time of the first swap (a cup's slide to the next place); sw swaps (steps) in the shuffle;
//   pr extra swaps that may run at the same time (0 to 2); far 'yes': a cup may swap with one two or three places away;
//   rp the tempo ramp in % (the last swap that much faster than the first); sh the ball on show before the cups cover it (ms);
//   ai the computer's right picks in %.
// Normal aims at a focused player's 80%, 60% and 40% at levels 1 to 3 (tests/sim/shell.sim.js: the tracking model the
// figures come from, and what blind guessing gives: 33%, 25%, 20%).
export const SHELL_MAX = 5;
const P = (c, ms, sw, pr, far, rp, sh, ai) => ({ c, ms, sw, pr, far, rp, sh, ai });
export const SHELL_PRESETS = {
  Gentle: [P(3, 420, 5, 0, 'no', 10, 1500, 95), P(4, 360, 7, 0, 'no', 20, 1400, 90), P(5, 330, 8, 1, 'yes', 20, 1300, 80), P(6, 310, 9, 1, 'yes', 25, 1300, 70), P(7, 295, 10, 1, 'yes', 25, 1300, 60)],
  Normal: [P(3, 300, 7, 0, 'no', 25, 1200, 80), P(4, 290, 8, 1, 'yes', 30, 1100, 60), P(5, 275, 10, 1, 'yes', 35, 1000, 40), P(6, 250, 12, 2, 'yes', 40, 1000, 25), P(7, 235, 13, 2, 'yes', 45, 1000, 20)],
  Brutal: [P(3, 255, 9, 0, 'no', 35, 900, 48), P(4, 245, 11, 1, 'yes', 40, 800, 30), P(5, 245, 12, 1, 'yes', 40, 800, 26), P(6, 235, 13, 2, 'yes', 45, 800, 21), P(7, 225, 14, 2, 'yes', 45, 800, 18)],
};
// A preset as the settings it fills: { c1, ms1, sw1, ... ai5 } (the admin's page; the tests).
export const presetValues = name => { const out = {}; (SHELL_PRESETS[name] || []).forEach((l, i) => { for (const k of Object.keys(l)) out[k + (i + 1)] = l[k]; }); return out; };
export const PRESETS = Object.fromEntries(Object.keys(SHELL_PRESETS).map(n => [n, presetValues(n)]));   // (admin.js: a game's presets, by name)
export const PRESET_NOTE = 'A preset fills every level\'s values below (the cups, the shuffle and the computer); change any by hand after, then Save.';

const D = SHELL_PRESETS.Normal;
const level = i => {
  const n = i + 1, g = `Level ${n}`, d = D[i];
  return [
    { k: 'c' + n, label: `Level ${n}: cups`, def: d.c, min: 2, max: 7, step: 1, group: g },
    { k: 'ms' + n, label: `Level ${n}: cup travel time (ms; lower is faster)`, def: d.ms, min: 80, max: 1200, step: 5, group: g },
    { k: 'sw' + n, label: `Level ${n}: swaps`, def: d.sw, min: 1, max: 40, step: 1, group: g },
    { k: 'pr' + n, label: `Level ${n}: extra swaps at the same time (0 to 2)`, def: d.pr, min: 0, max: 2, step: 1, group: g },
    { k: 'far' + n, label: `Level ${n}: swaps between cups that are not neighbours`, def: d.far, opts: ['no', 'yes'], group: g },
    { k: 'rp' + n, label: `Level ${n}: tempo ramp (%: how much faster the last swap is)`, def: d.rp, min: 0, max: 150, step: 5, group: g },
    { k: 'sh' + n, label: `Level ${n}: the ball on show before the cups cover it (ms)`, def: d.sh, min: 400, max: 5000, step: 50, group: g },
  ];
};
// The computer's levels (shared/attention.js attOkAt): Normal right as often as the rates above; Easy that share of them;
// Hard right that share of the rounds Normal would miss as well.
const AIEASY = { k: 'aiEasyPct', label: "Easy: right this share of Normal's rate (%)", def: 70, min: 0, max: 100, step: 5, group: 'Computer: Easy' };
const AIHARD = { k: 'aiHardPct', label: "Hard: of the rounds Normal gets wrong, the share it gets right (%)", def: 40, min: 0, max: 100, step: 5, group: 'Computer: Hard' };
export const TUNE = [
  { k: 'levels', label: 'Levels to win', def: 3, min: 1, max: SHELL_MAX, step: 1, group: 'Rules' },
  AGAIN_TUNE,
  ...[0, 1, 2, 3, 4].flatMap(level),
  ...[0, 1, 2, 3, 4].map(i => ({ k: 'ai' + (i + 1), label: `Normal: right picks at level ${i + 1} (%)`, def: D[i].ai, min: 0, max: 100, step: 1, group: 'Computer: Normal' })),
  AIEASY,
  AIHARD,
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/shell): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Watch the ball, then follow its cup as they shuffle. Pick right at every level first.';
export const luckSkill = 4;
export const format = 'race';
