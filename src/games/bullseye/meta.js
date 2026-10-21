// Bullseye: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Bullseye',     hint: 'Stop both lines on the board. Bullseye 3, board 1. First to 5' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'skill';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Bullseye', play: 'Stop the sideways line, then the up-down line. The dart lands where they cross. Bullseye is 3, the board is 1.', win: 'First to 5.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M12 2.8v3M12 18.2v3" stroke-linecap="round"/></svg>';
export const BULL_DEFAULTS = { board: 9, bull: 2.5, sweep: 1040, ramp: 1.12 };   // the board's radius and the bullseye's (field units), ms per sweep across, the speed-up per scoring throw
