// Apple Pick: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Apple Pick',  hint: 'Spin to pick apples into your bucket. Empty your tree first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.14.0';   // (1.14.0: the first version with its rules as they are now, December 2026 audit; was 1.3.0); the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds (each player's tree and bucket are their own)
export const explainer = { name: 'Apple Pick', play: 'Spin to pick apples into your bucket. Watch out for the bird and spills, which put apples back on the tree.', win: 'Empty your tree first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8.5c-1.2-1.3-3.3-1.5-4.8-.3-2 1.6-2.3 5-.6 7.9 1.3 2.3 3 3.7 4.3 3.4h2.2c1.3.3 3-1.1 4.3-3.4 1.7-2.9 1.4-6.3-.6-7.9-1.5-1.2-3.6-1-4.8.3z"/><path d="M12 8.5V6"/><path d="M12 6c.3-1.6 1.5-2.6 3.3-2.6-.2 1.7-1.4 2.7-3.3 2.6z" fill="currentColor"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js): the apples on each tree, the spinner's segments (how many
// of each kind: pick 1 to 4, the bird, a spill), what the bird takes and how much a spill tips back. Tuned by
// tests/sim/apple.sim.js (November 2026: 10 apples, two segments of each number, one bird, one spill, the bird takes 2,
// a spill tips half the bucket back: the winner takes about 5 spins, the first mover wins about 56%).
export const TUNE = [
  { k: 'apples', label: 'Apples on each tree', def: 10, min: 4, max: 30, step: 1, group: 'Rules' },
  { k: 'one', label: 'Segments: pick 1', def: 2, min: 0, max: 6, step: 1, group: 'Board' },
  { k: 'two', label: 'Segments: pick 2', def: 2, min: 0, max: 6, step: 1, group: 'Board' },
  { k: 'three', label: 'Segments: pick 3', def: 2, min: 0, max: 6, step: 1, group: 'Board' },
  { k: 'four', label: 'Segments: pick 4', def: 2, min: 0, max: 6, step: 1, group: 'Board' },
  { k: 'bird', label: 'Segments: bird', def: 1, min: 0, max: 4, step: 1, group: 'Board' },
  { k: 'spill', label: 'Segments: spill', def: 1, min: 0, max: 4, step: 1, group: 'Board' },
  { k: 'birdTakes', label: 'Apples the bird takes', def: 2, min: 1, max: 6, step: 1, group: 'Rules' },
  { k: 'spillPct', label: 'Spill: share of the bucket tipped back (%)', def: 50, min: 10, max: 100, step: 10, group: 'Rules' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/apple): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Spin to pick apples into your bucket. Birds and spills put some back. Empty your tree first.';
export const luckSkill = 1;
export const format = 'race';

// The computer's levels (core/tune.js levelTune): pure luck, nothing to choose (every level makes the one move there is:
// apple's ai.js), so no mistake rate; each level keeps its thinking time (feel only).
export const AI_LEVELS = { miss: false };
