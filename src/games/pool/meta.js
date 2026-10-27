// Pool: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Pool',         hint: 'Sink all your balls (three each). The black ball loses' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Pool', play: 'Drag to aim and shoot. Sink your own ball to go again. Sink the white and a ball comes back for you: one of your sunk balls, or a new one if none is sunk.', win: 'Sink all your balls on the table first. Sink the black ball and you lose.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square; the shots' simulation reads them (physics.js: physOpt).
export const TUNE = [
  { k: 'vMax', label: 'Full-power speed (units/s)', def: 300, min: 150, max: 360, step: 10, group: 'Rules' },
  { k: 'aiAim', label: 'Computer aim error (mrad)', def: 20, min: 0, max: 150, step: 1, group: 'Computer' },
  { k: 'aiPow', label: 'Computer power error (%)', def: 2.5, min: 0, max: 20, step: 0.5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="9" cy="15" r="4"/><circle cx="16.5" cy="8" r="3.5"/><path d="M3 21l3.5-3.5"/><circle cx="9" cy="15" r="1" fill="currentColor" stroke="none"/></svg>';
