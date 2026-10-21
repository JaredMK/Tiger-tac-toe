// Trivia: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Trivia',       hint: 'Wrong answers get crossed out. Three right wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Trivia', play: 'A new question starts face down. Tap Reveal to see it, then you must answer it this turn. Wrong answers get crossed out and the question stays up, for both players, until someone gets it.', win: 'Get 3 right.' };
export const scExplainer = { name: 'Trivia', play: 'Both players see the question. Pick an answer. When the round ends, wrong answers are crossed out for both, and a new question comes if anyone got it.', win: 'Get 3 right.' };   // in Super Chaos
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8.5 9a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.3-1.5 2.3"/><circle cx="12" cy="18.5" r="1.1" fill="currentColor" stroke="none"/><rect x="2.5" y="2.5" width="19" height="19" rx="4"/></svg>';
