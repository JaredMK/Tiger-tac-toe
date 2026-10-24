// Five Letters: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Five Letters',       hint: 'Guess the hidden 5-letter word' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Five Letters', play: "Guess a 5-letter word. Green is correct letter placement, yellow is in the word but different position, grey isn't in it.", win: 'Guess the word. Use up {limit} guesses and you lose the square.' };   // ({limit}: its setting, TUNE below)
export const scExplainer = { name: 'Five Letters', play: "Guess a 5-letter word.", win: 'Guess the word. Use up {limit} guesses and you lose the square.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): the guesses each, dealt into each square (limit); the rest read through tune(mini).
export const TUNE = [
  { k: 'limit', label: 'Guesses each', def: 5, min: 2, max: 12, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer ignores the clues (%)', def: 0, min: 0, max: 60, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="7" width="6" height="6" rx="1"/><rect x="9" y="7" width="6" height="6" rx="1" opacity=".45"/><rect x="16" y="7" width="6" height="6" rx="1" opacity=".45"/><rect x="2" y="14" width="6" height="6" rx="1" opacity=".45"/><rect x="9" y="14" width="6" height="6" rx="1"/><rect x="16" y="14" width="6" height="6" rx="1" opacity=".45"/></svg>';
