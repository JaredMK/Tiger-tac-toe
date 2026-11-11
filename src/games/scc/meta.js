// Ship, Captain & Crew: its names, its "?" explainer, its icon, its release default and its settings.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Ship, Captain & Crew', hint: 'Set aside a 6, a 5 and a 4; the other two dice are your cargo' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.8.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = false;   // never in Super Chaos (a turn of rolls held to the square)
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Scored? Go again.', off: '' };
export const explainer = { name: 'Ship, Captain & Crew', play: 'Roll up to {rolls} times. Set aside a 6, then a 5, then a 4. With all three, the other two dice are your cargo: reroll them or keep.{goAgain}', win: 'First to {target} cargo.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). The target was tuned by
// tests/sim/scc.sim.js to about 3 to 6 turns a player (November 2026).
export const TUNE = [
  AGAIN_TUNE,
  { k: 'target', label: 'Cargo to win', def: 22, min: 8, max: 60, step: 1, group: 'Rules' },
  { k: 'rolls', label: 'Rolls a turn', def: 3, min: 2, max: 5, step: 1, group: 'Rules' },
  { k: 'normalKeep', label: 'Computer (Normal) keeps a cargo of at least', def: 8, min: 2, max: 12, step: 1, group: 'Computer' },
  { k: 'easyKeep', label: 'Computer (Easy) keeps a cargo of at least', def: 6, min: 2, max: 12, step: 1, group: 'Computer' },
];
// A little ship with a mast and a crate on deck.
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15h18l-2.6 4.5H5.6z"/><path d="M12 3v12"/><path d="M12 4.5l6 6.5h-6"/><rect x="5.5" y="11" width="4.5" height="4" rx=".6"/></svg>';
