// Trivia: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Trivia',       hint: 'Wrong answers get crossed out. Three right wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Trivia', play: 'Answer the question.', win: 'Get {goal} right.' };   // ({goal}: its setting, TUNE below)
export const scExplainer = { name: 'Trivia', play: 'Answer the question.', win: 'Get {goal} right.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): read through tune(mini).
export const TUNE = [
  { k: 'goal', label: 'Right answers to win', def: 3, min: 2, max: 5, step: 1, group: 'Rules' },
  { k: 'opts', label: 'Answers to choose from', def: 4, min: 2, max: 4, step: 1, group: 'Rules' },
  { k: 'know', label: 'Computer knows the answer (%)', def: 53, min: 0, max: 100, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8.5 9a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.3-1.5 2.3"/><circle cx="12" cy="18.5" r="1.1" fill="currentColor" stroke="none"/><rect x="2.5" y="2.5" width="19" height="19" rx="4"/></svg>';
