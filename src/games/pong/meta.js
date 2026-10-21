// Cup Pong: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Cup Pong',     hint: 'Swipe up to throw. Sink all three cups' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Cup Pong', play: 'Swipe up to throw. Aim with direction, distance with speed.', win: 'Sink all 3 of your cups.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 3h7l-1 10H5z"/><path d="M13 3h7l-1 10h-5z"/><path d="M8.5 13h7l-1 8h-5z"/><circle cx="12" cy="20.5" r="1.4" fill="currentColor" stroke="none"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the throw's scatter and the rim, and the computer's aim.
export const TUNE = [
  { k: 'spread', label: 'Throw scatter (table lengths)', def: 0.068, min: 0.02, max: 0.15, step: 0.002, group: 'Rules' },
  { k: 'rimIn', label: 'Rim balls that drop in (%)', def: 25, min: 0, max: 100, step: 1, group: 'Rules' },
  { k: 'aiAim', label: "Computer's aim error", def: 0.012, min: 0, max: 0.1, step: 0.001, group: 'Computer' },
  { k: 'aiPower', label: "Computer's power error", def: 0.018, min: 0, max: 0.1, step: 0.001, group: 'Computer' },
];
