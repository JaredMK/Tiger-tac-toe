// Bowling: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Bowling',      hint: 'Flick to roll. Every pin counts' };
export const BOWL_DEFAULTS = { aimMs: 733, meterMs: 600 };   // (the old two taps' speeds, config/bowling: nothing reads them since the flick, rules.js)
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.13.0';   // (1.13.0: the tighter rack and the pins' new physics, the flick, equal rolls)   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Bowling', play: 'Flick up the lane to roll: aim with the angle, roll harder with a faster flick. One roll a turn at a fresh rack.', win: '{target} pins.{evenText}' };
// {evenText} in the explainer: the first while "Equal rolls" is on, the second while off (the default) (ui/explainer.js fillTune).
export const evenText = { on: ' Rolled more often than the other player? They get one roll to beat you.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square; the roll's simulation reads the
// speed (physics.js: physOpt), the rules the target and Equal rolls (rules.js), the view the flick's feel (how fast a
// flick rolls slow and full, the angle's gain: rules.js bowlFlick), the computer its errors.
export const TUNE = [
  { k: 'target', label: 'Pins to win', def: 35, min: 10, max: 100, step: 1, group: 'Rules' },
  { k: 'even', label: 'Equal rolls (one roll to answer a finished game)', def: 'off', opts: ['off', 'on'], group: 'Rules' },
  { k: 'vMax', label: 'Full-power speed (units/s)', def: 150, min: 90, max: 200, step: 5, group: 'Rules' },
  { k: 'flickMin', label: 'Flick speed for the slowest roll (px/ms)', def: 0.4, min: 0.1, max: 1.5, step: 0.05, group: 'Rules' },
  { k: 'flickMax', label: 'Flick speed for a full-power roll (px/ms)', def: 1.7, min: 0.6, max: 4, step: 0.05, group: 'Rules' },
  { k: 'angleGain', label: 'Flick angle gain', def: 1, min: 0.5, max: 2, step: 0.05, group: 'Rules' },
  { k: 'aiAim', label: 'Computer aim error (mrad)', def: 30, min: 0, max: 150, step: 1, group: 'Computer' },
  { k: 'aiPow', label: 'Computer power error (%)', def: 4, min: 0, max: 20, step: 0.5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5c-2.5 0-2 3-1 5.5-3 3-3 8-1.5 13h5c1.5-5 1.5-10-1.5-13 1-2.5 1.5-5.5-1-5.5z"/><circle cx="17" cy="16" r="4.5"/><circle cx="16" cy="15" r=".6" fill="currentColor"/><circle cx="18.2" cy="15" r=".6" fill="currentColor"/><circle cx="17.1" cy="17.2" r=".6" fill="currentColor"/></svg>';
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
