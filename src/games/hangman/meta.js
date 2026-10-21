// Hangman: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Hangman',      hint: 'Right letter: go again. Last letter wins' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Hangman', play: 'Guess a letter. Got one right? Go again.', win: 'Reveal the last letter.' };
export const scExplainer = { name: 'Hangman', play: "Guess a letter. Got one right? Go again. You see the letters found before the round and your own; everyone's join when the round ends.", win: 'Reveal the last letter yourself. Finished only by both players together, the word resets.' };   // in Super Chaos
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 21h8M8 21V3h9v4"/><circle cx="17" cy="10" r="2.5"/><path d="M17 12.5v5"/></svg>';
