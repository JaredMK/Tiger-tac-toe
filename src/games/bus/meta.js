// Ride the Bus: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Ride the Bus', hint: 'Colour, higher or lower, inside or outside, then the suit' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Ride the Bus', play: 'Guess red or black, then higher or lower, then inside or outside, then the suit. Miss and your turn ends, but you keep your progress.', win: 'Get through all four.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini).
export const TUNE = [
  { k: 'ties', label: 'A tie (equal value) is', def: 'wrong', opts: ['wrong', 'right'], group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M2.5 10.5h19M8.5 4v6.5M15 4v6.5"/><circle cx="7" cy="18.5" r="2" fill="currentColor"/><circle cx="17" cy="18.5" r="2" fill="currentColor"/></svg>';
