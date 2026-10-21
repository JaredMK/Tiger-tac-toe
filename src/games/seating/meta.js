// Seating: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Seating',      hint: 'Take seats. Both seats of a table make it yours' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const explainer = { name: 'Seating', play: 'Seat yourself at any table. After each move a customer takes a seat of their colour (you\'ll see who\'s next). If none of their colour is free, they walk out.', win: 'Fill the most tables with your own pair.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="6" width="8" height="12" rx="2" fill="currentColor" fill-opacity=".35"/><path d="M3.5 7.5v9M3.5 13h2.5v3.5M20.5 7.5v9M20.5 13H18v3.5"/></svg>';
