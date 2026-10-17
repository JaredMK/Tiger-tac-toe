// Wordle: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Wordle',       hint: 'Guess the hidden 5-letter word' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Wordle', play: "Guess a 5-letter word. Green is correct letter placement, yellow is in the word but different position, grey isn't in it.", win: 'Guess the word.' };
export const scExplainer = { name: 'Wordle', play: "Guess a 5-letter word. Your colours show at once; both players' guesses join the board when the round ends.", win: 'Guess the word.' };   // in Super Chaos
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="7" width="6" height="6" rx="1"/><rect x="9" y="7" width="6" height="6" rx="1" opacity=".45"/><rect x="16" y="7" width="6" height="6" rx="1" opacity=".45"/><rect x="2" y="14" width="6" height="6" rx="1" opacity=".45"/><rect x="9" y="14" width="6" height="6" rx="1"/><rect x="16" y="14" width="6" height="6" rx="1" opacity=".45"/></svg>';
