// Wordle: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Wordle',       hint: 'Guess the hidden 5-letter word' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Wordle', play: "Guess a 5-letter word. Green is correct letter placement, yellow is in the word but different position, grey isn't in it.", win: 'Guess the word.' };
export const scExplainer = { name: 'Wordle', play: "Guess a 5-letter word. Your colours show at once; both players' guesses join the board when the round ends.", win: 'Guess the word.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): read through tune(mini).
export const TUNE = [
  { k: 'miss', label: 'Computer ignores the clues (%)', def: 0, min: 0, max: 60, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="7" width="6" height="6" rx="1"/><rect x="9" y="7" width="6" height="6" rx="1" opacity=".45"/><rect x="16" y="7" width="6" height="6" rx="1" opacity=".45"/><rect x="2" y="14" width="6" height="6" rx="1" opacity=".45"/><rect x="9" y="14" width="6" height="6" rx="1"/><rect x="16" y="14" width="6" height="6" rx="1" opacity=".45"/></svg>';
