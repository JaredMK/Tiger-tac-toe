// Roulette: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Roulette',     hint: 'Bet 8 numbers, a group or green 0. Two hits wins' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Roulette', play: 'Bet on 8 numbers, a group of 8, or green 0, then spin.', win: '{goal} hits, or hit green 0 for an instant win.' };   // ({goal}: its setting, TUNE below)
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v5.9M12 15.3v5.9M2.8 12h5.9M15.3 12h5.9" stroke-width="1.8"/><circle cx="17.6" cy="6.4" r="1.6" fill="currentColor" stroke="none"/></svg>';
export const scExplainer = { name: 'Roulette', play: 'Bet on 8 numbers, a group of 8, or green 0, then spin.', win: '{goal} hits, or hit green 0 for an instant win.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini).
export const TUNE = [
  { k: 'goal', label: 'Hits to win', def: 2, min: 2, max: 4, step: 1, group: 'Rules' },
  { k: 'zeroCrit', label: 'Computer bets 0 to stop a near win (%)', def: 40, min: 0, max: 100, step: 5, group: 'Computer' },
  { k: 'zeroBehind', label: 'Computer bets 0 when behind (%)', def: 25, min: 0, max: 100, step: 5, group: 'Computer' },
];
