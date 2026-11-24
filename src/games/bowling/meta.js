// Bowling: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Bowling',      hint: 'Tap to aim, curve and roll. Every pin counts' };
export const BOWL_DEFAULTS = { aimMs: 733, meterMs: 600 };   // (the old two taps' speeds, config/bowling: nothing reads them since the flick and the three sweeps, rules.js)
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.16.0';   // (1.16.0: the first version with its rules as they are now, December 2026 audit; was 1.15.0); (1.13.0: the tighter rack and the pins' new physics, equal rolls; 1.15.0: the three sweeps and the curve)   ; the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Bowling', play: 'Three meters sweep in turn: tap to stop the aim, then the curve, then the power. A curve hooks the ball late, into the pins. One roll a turn at a fresh rack.', win: '{target} pins.{evenText}' };
// {evenText} in the explainer: the first while "Equal rolls" is on, the second while off (the default) (ui/explainer.js fillTune).
export const evenText = { on: ' Rolled more often than the other player? They get one roll to beat you.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square; the roll's simulation reads the
// speed and the hook (physics.js: physOpt), the rules the target and Equal rolls (rules.js), the view the three sweeps'
// periods (rules.js bowlWave), the computer its timing error on each tap (ai.js).
export const TUNE = [
  { k: 'target', label: 'Pins to win', def: 35, min: 10, max: 100, step: 1, group: 'Rules' },
  { k: 'even', label: 'Equal rolls (one roll to answer a finished game)', def: 'off', opts: ['off', 'on'], group: 'Rules' },
  { k: 'vMax', label: 'Full-power speed (units/s)', def: 150, min: 90, max: 200, step: 5, group: 'Rules' },
  { k: 'hook', label: 'Hook at full curve (mrad per unit rolled)', def: 10, min: 0, max: 25, step: 0.5, group: 'Rules' },
  { k: 'aimMs', label: 'Aim sweep, there and back (ms)', def: 1700, min: 600, max: 4000, step: 50, group: 'Rules' },
  { k: 'curveMs', label: 'Curve sweep, there and back (ms)', def: 1500, min: 600, max: 4000, step: 50, group: 'Rules' },
  { k: 'powerMs', label: 'Power sweep, there and back (ms)', def: 1300, min: 600, max: 4000, step: 50, group: 'Rules' },
  { k: 'aiMsEasy', label: 'Timing error on each meter (ms)', def: 65, min: 0, max: 300, step: 1, group: 'Computer: Easy' },
  { k: 'aiMs', label: 'Timing error on each meter (ms)', def: 45, min: 0, max: 300, step: 1, group: 'Computer: Normal' },
  { k: 'aiMsHard', label: 'Timing error on each meter (ms)', def: 32, min: 0, max: 300, step: 1, group: 'Computer: Hard' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5c-2.5 0-2 3-1 5.5-3 3-3 8-1.5 13h5c1.5-5 1.5-10-1.5-13 1-2.5 1.5-5.5-1-5.5z"/><circle cx="17" cy="16" r="4.5"/><circle cx="16" cy="15" r=".6" fill="currentColor"/><circle cx="18.2" cy="15" r=".6" fill="currentColor"/><circle cx="17.1" cy="17.2" r=".6" fill="currentColor"/></svg>';
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/bowling): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Stop the aim, curve and power meters to roll. Knock down enough pins first.';
export const luckSkill = 4;
export const format = 'race';
