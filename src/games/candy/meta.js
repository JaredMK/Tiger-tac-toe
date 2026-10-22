// Candy Race: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Candy Race',   hint: 'Spin, then hop to the next space of that colour' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'own';   // what the players share, in its "?" label: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Candy Race', play: 'Spin and jump to the next space of that colour.', win: 'Reach the finish first.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): the track is dealt with them.
export const TUNE = [
  { k: 'gap', label: 'Same colour at least (spaces apart)', def: 3, min: 1, max: 4, step: 1, group: 'Board' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18" stroke-width="1.6"/></svg>';
