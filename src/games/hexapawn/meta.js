// Hexapawn: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Hexapawn',     hint: 'Step forward, capture diagonally. Reach the far row to win' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const retired = true;   // no longer dealt; older matches still play it out
export const explainer = { name: 'Hexapawn', play: 'Move a pawn forward, or capture diagonally.', win: 'Get a pawn to the far side.' };
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="3.3"/><path d="M9.3 10.2h5.4l1.4 6.3H7.9z"/><path d="M6 17.6h12v3.2H6z"/></svg>';
