// Blackjack: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Blackjack',    hint: 'Beat the dealer without going over 21. First to 3 wins' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Blackjack', play: 'Hit or stand. Beat the dealer without going over 21. Tie? Play another hand.', win: 'First to 3 wins.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M12 6.8c-1.3 1.8-3.9 3.2-3.9 5.4 0 1.3.9 2 1.9 2 .7 0 1.3-.3 1.6-.8-.1 1-.5 1.6-1.3 2.1h3.4c-.8-.5-1.2-1.1-1.3-2.1.3.5.9.8 1.6.8 1 0 1.9-.7 1.9-2 0-2.2-2.6-3.6-3.9-5.4z" fill="currentColor" stroke="none"/></svg>';
