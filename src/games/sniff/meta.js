// Sniff: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Sniff',        hint: 'Walk the dog, any of 8 ways. Hotter, colder or the same? Find the treasure' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const scTarget = 'own';   // in Super Chaos: a dog each, racing to the one treasure
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds (its own form: a dog each)
export const explainer = { name: 'Sniff', play: 'Move the dog one step, any of 8 ways. You\'ll see if it\'s getting hotter, colder or the same (as the crow flies), for a moment only: nothing stays on the board, so remember it.', win: 'Be the one who finds the treasure.' };
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><ellipse cx="12" cy="16" rx="4.8" ry="4"/><ellipse cx="5.4" cy="10.2" rx="2" ry="2.4"/><ellipse cx="9.4" cy="6.2" rx="2" ry="2.5"/><ellipse cx="14.6" cy="6.2" rx="2" ry="2.5"/><ellipse cx="18.6" cy="10.2" rx="2" ry="2.4"/></svg>';
export const scExplainer = { name: 'Sniff', play: 'You each have a dog, both starting in the middle. Move yours one step, any of 8 ways, to see if it\'s getting hotter, colder or the same. Both dogs\' paths stay on the board.', win: 'Be the first dog onto the treasure.' };
