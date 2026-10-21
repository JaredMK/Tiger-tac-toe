// Craps: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Craps',        hint: '7 or 11 wins, 2, 3 or 12 loses. Win 3 rounds' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Craps', play: 'Tap Roll: the dice keep rolling until your round is won or lost. On the first roll, 7 or 11 wins and 2, 3 or 12 loses. Any other number is your point: rolling it again wins, a 7 loses.', win: 'Win {goal} rounds.' };   // ({goal}: its setting, TUNE below)
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini).
export const TUNE = [
  { k: 'goal', label: 'Rounds to win', def: 3, min: 2, max: 4, step: 1, group: 'Rules' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><rect x="2.5" y="8" width="10.5" height="10.5" rx="2.2" transform="rotate(-12 7.7 13.2)"/><rect x="11.5" y="4.5" width="10" height="10" rx="2.2" transform="rotate(10 16.5 9.5)"/><circle cx="5.6" cy="11.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.6" cy="15.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="9.5" r="1.1" fill="currentColor" stroke="none"/></svg>';
