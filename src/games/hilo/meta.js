// Higher/Lower: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Higher/Lower', hint: 'Guess the number from 1 to 30 in 5 guesses' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the game's kind, an icon in the Advanced checklist: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Higher/Lower', play: "Guess a number from 1 to {hi}. You'll be told higher or lower.", win: 'Guess it. Use up {limit} guesses and you lose the square.' };   // ({hi}, {limit}: its settings, TUNE below)
export const scExplainer = { name: 'Higher/Lower', play: "Guess a number from 1 to {hi}. You'll be told higher or lower; both guesses join the list when the round ends.", win: 'Guess it. Use up {limit} guesses and you lose the square.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square (top, limit).
export const TUNE = [
  { k: 'hi', label: 'Highest number', def: 30, min: 10, max: 99, step: 1, group: 'Rules' },
  { k: 'limit', label: 'Guesses each', def: 5, min: 2, max: 12, step: 1, group: 'Rules' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 10 6-6 6 6M6 14l6 6 6-6"/></svg>';
