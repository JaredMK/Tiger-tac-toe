// Pool: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Pool',         hint: 'Sink two of your balls. The black ball loses' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const explainer = { name: 'Pool', play: 'Drag back from the white ball to aim and shoot. Sink your own ball to go again. Sink the white (a scratch) and it goes back on its spot, and the other player gets an extra ball of their colour on the table.', win: 'Sink two of your balls first. Sink the black ball and you lose.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square; the shots' simulation reads them (physics.js: physOpt).
export const TUNE = [
  { k: 'vMax', label: 'Full-power speed (units/s)', def: 300, min: 150, max: 360, step: 10, group: 'Rules' },
  { k: 'aiAim', label: 'Computer aim error (mrad)', def: 20, min: 0, max: 150, step: 1, group: 'Computer' },
  { k: 'aiPow', label: 'Computer power error (%)', def: 2.5, min: 0, max: 20, step: 0.5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="9" cy="15" r="4"/><circle cx="16.5" cy="8" r="3.5"/><path d="M3 21l3.5-3.5"/><circle cx="9" cy="15" r="1" fill="currentColor" stroke="none"/></svg>';
