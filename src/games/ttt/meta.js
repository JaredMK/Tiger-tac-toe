// Tic-Tac-Toe: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Tic-Tac-Toe',  hint: 'Three in a row wins' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'shared';   // what the players share, in its "?" label: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const explainer = { name: 'Tic-tac-toe', play: 'Place your mark.', win: 'Three in a row. Once nobody can get three in a row, the square resets.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read through tune(mini).
export const TUNE = [
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 50, step: 1, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8.5 3v18M15.5 3v18M3 8.5h18M3 15.5h18"/></svg>';
