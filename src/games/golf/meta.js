// Mini Golf: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Mini Golf',    hint: 'Drag back to aim and set power. First ball in the cup wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Mini Golf', play: 'Drag to aim and set power, then let go. Balls can knock each other.', win: 'Sink your ball first.' };
export const scExplainer = { name: 'Mini Golf', play: 'Drag back to aim and set power, then let go to lock in your shot.', win: 'Sink your ball.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square; the shots' simulation reads them (physics.js: physOpt).
export const TUNE = [
  { k: 'holeSpeed', label: 'Fastest a ball drops in (units/s)', def: 32, min: 16, max: 60, step: 1, group: 'Rules' },
  { k: 'kick', label: 'Bumper kick (units/s)', def: 18, min: 0, max: 40, step: 1, group: 'Board' },
  { k: 'aiAim', label: 'Computer aim error (mrad)', def: 35, min: 0, max: 200, step: 1, group: 'Computer' },
  { k: 'aiPow', label: 'Computer power error (%)', def: 4, min: 0, max: 20, step: 0.5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14"/><path d="M12 3l7 3-7 3"/><ellipse cx="12" cy="18.5" rx="7" ry="2.5"/><circle cx="6" cy="14" r="1.8" fill="currentColor" stroke="none"/></svg>';
