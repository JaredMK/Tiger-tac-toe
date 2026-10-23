// Bowling: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Bowling',      hint: 'Frames of two rolls, the second at the pins left standing. Every pin counts' };
export const BOWL_DEFAULTS = { aimMs: 733, meterMs: 600 };   // the arrow: one side of the lane to the other in this long; the power meter: empty to full (config/bowling)
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'own';   // what the players share, in its "?" label: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Bowling', play: 'Two taps, as in Darts: an arrow sweeps across the lane, tap to lock your aim; then the power meter rises and falls, tap to lock the power. Each turn is a frame of up to two rolls: the second goes at the pins left standing, and a strike ends the frame. Every pin down counts; no bonuses.', win: '{target} pins total.' };
// Its settings (the admin's Mini-game Settings; core/tune.js; the taps' speeds stay in BOWL_DEFAULTS): dealt into each square; the roll's simulation reads them (physics.js: physOpt).
export const TUNE = [
  { k: 'target', label: 'Pins to win', def: 35, min: 10, max: 100, step: 1, group: 'Rules' },
  { k: 'vMax', label: 'Full-power speed (units/s)', def: 150, min: 90, max: 200, step: 5, group: 'Rules' },
  { k: 'aiAim', label: 'Computer aim error (mrad)', def: 25, min: 0, max: 150, step: 1, group: 'Computer' },
  { k: 'aiPow', label: 'Computer power error (%)', def: 4, min: 0, max: 20, step: 0.5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5c-2.5 0-2 3-1 5.5-3 3-3 8-1.5 13h5c1.5-5 1.5-10-1.5-13 1-2.5 1.5-5.5-1-5.5z"/><circle cx="17" cy="16" r="4.5"/><circle cx="16" cy="15" r=".6" fill="currentColor"/><circle cx="18.2" cy="15" r=".6" fill="currentColor"/><circle cx="17.1" cy="17.2" r=".6" fill="currentColor"/></svg>';
