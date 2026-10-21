// Districts: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Districts',    hint: 'Place pieces. Lead the most regions when the map is full' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const explainer = { name: 'Districts', play: 'Place a piece. It counts for every region it touches. A grey piece lands somewhere after each move.', win: 'Lead in the most regions when the map is full. Ties go to the player who moved second.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><path d="M3 3h18v18H3z"/><path d="M3 11l7-1.5L12 3M10 9.5l3 6.5-10 2M13 16l8-3M10 9.5l11-1"/><circle cx="10" cy="9.5" r="2.2" fill="currentColor" stroke="none"/></svg>';
