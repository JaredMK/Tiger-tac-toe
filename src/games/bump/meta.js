// Bump: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Bump',         hint: 'Spin 1, 2 or 3. Land on your opponent to send them home' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'shared';   // what the players share, in its "?" label: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Bump', play: 'Spin and move 1, 2 or 3 spaces. Land on your opponent to send them back home.', win: 'Reach the finish first.' };
export const scExplainer = { name: 'Bump', play: 'Spin and move 1, 2 or 3 spaces. Bumps are settled when the round ends: land on the other piece to send it home; land on the same space together and both go home.', win: 'Reach the finish first.' };   // in Super Chaos
// Its settings (the admin's Mini-game Settings; core/tune.js): dealt into each square (pos).
export const TUNE = [
  { k: 'start', label: 'Both pieces start on (space, 0: Home)', def: 0, min: 0, max: 4, step: 1, group: 'Board' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="7" cy="15" r="4.2"/><circle cx="17" cy="15" r="4.2" fill="currentColor"/><path d="M12 3.5v3.2M7.6 5.2l1.8 2.4M16.4 5.2l-1.8 2.4"/></svg>';
