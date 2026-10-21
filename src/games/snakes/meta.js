// Snakes and Ladders: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Snakes and Ladders', hint: 'Roll and climb. Ladders lift you, snakes slide you down' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the game's kind, an icon in the Advanced checklist: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Snakes and Ladders', play: 'Roll and move up that many spaces. Ladders lift you up, snakes slide you down.', win: 'Reach the top first.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): the board is dealt with them, the die rolls by them.
export const TUNE = [
  { k: 'ladders', label: 'Ladders', def: 2, min: 0, max: 3, step: 1, group: 'Board' },
  { k: 'snakes', label: 'Snakes', def: 2, min: 0, max: 3, step: 1, group: 'Board' },
  { k: 'minSpan', label: 'Shortest ladder or snake (spaces)', def: 3, min: 2, max: 6, step: 1, group: 'Board' },
  { k: 'die', label: 'Die faces (highest roll)', def: 6, min: 3, max: 6, step: 1, group: 'Rules' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V3M10 21V3M4 7.5h6M4 12h6M4 16.5h6"/><path d="M14.5 21c4.5-.6 5-3.6 2.4-5.6s-2.6-4.8.4-6.2 3.4-2.6 2.6-5.2"/><circle cx="19.6" cy="3.8" r="1.4" fill="currentColor" stroke="none"/></svg>';
