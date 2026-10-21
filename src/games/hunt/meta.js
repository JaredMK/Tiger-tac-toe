// Treasure Hunt: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Treasure Hunt', hint: 'Dig a cell: hot, warm, cool or cold. Dig up the treasure to win' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Treasure Hunt', play: 'Dig a square. It tells you if the treasure is hot, warm, cool or cold. Steps count up, down, left and right only, not diagonally.', win: 'Dig up the treasure.' };
export const scExplainer = { name: 'Treasure Hunt', play: 'Dig a square. It tells you if the treasure is hot, warm, cool or cold. Steps count up, down, left and right only, not diagonally. Both digs join the map when the round ends.', win: 'Dig up the treasure.' };   // in Super Chaos
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9z"/></svg>';
