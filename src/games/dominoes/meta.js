// Dominoes: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Dominoes',     hint: 'Match the ends of the line. First to empty their hand wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.5.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = false;   // Super Chaos: never dealt there (a turn-based shared line with hidden hands cannot be played in simultaneous rounds)
export const samePhone = false;   // Same phone: never dealt there (each player's hand would be on show to the other; read by the setup's checklist and the local deal once the core knows the flag)
export const explainer = { name: 'Dominoes', play: 'Put down a tile that matches either end of the line. Nothing fits? Draw one from the pile, or pass when it is empty.', win: 'Empty your hand first. If the game blocks, the fewest pips in hand wins.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><rect x="3" y="7" width="18" height="10" rx="2.2" transform="rotate(-25 12 12)"/><path d="M12 7.6v8.8" transform="rotate(-25 12 12)"/><g fill="currentColor" stroke="none" transform="rotate(-25 12 12)"><circle cx="6.4" cy="9.6" r="1.1"/><circle cx="8.8" cy="12" r="1.1"/><circle cx="6.4" cy="14.4" r="1.1"/><circle cx="15.6" cy="10" r="1.1"/><circle cx="17.6" cy="14" r="1.1"/></g></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the set, the hands dealt into each square and the opener's
// draw. Tuned by tests/sim/dominoes.sim.js (November 2026): a double-six set, three tiles each, the line's opener drawing
// one with their first move: the Normal computer against itself takes about 6.0 turns for the winner (its placements;
// 7.4 moves with the draws), the first mover wins about 48% (60% without the opener's draw); the game blocks about 4% of
// the time, a level block (a draw, the square reset) about 0.1%. Hard beats Normal from either seat (57% first, 55%
// second). Four tiles each would be about 7 turns; a double-five set with four each about 5.8 turns, blocked 11%.
export const TUNE = [
  { k: 'pips', label: 'Set (highest pip count)', def: 6, opts: [4, 5, 6], group: 'Board' },
  { k: 'hand', label: 'Tiles in each hand', def: 3, min: 2, max: 9, step: 1, group: 'Rules' },
  { k: 'openDraw', label: 'Starting the line costs a draw', def: 1, opts: [0, 1], group: 'Rules' },
];
