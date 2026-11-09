// Find the Pair: its names, its "?" explainer, its icon and its release default.
import { MODE_TUNE } from '../../core/race.js';

export const info = { name: 'Find the Pair',       hint: 'Flip two cards. Find the matching pair' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Find the Pair', play: 'Flip two cards. Matching pairs in the deck: {pairs}.', win: 'Find a matching pair.' };   // ({pairs}: its setting, TUNE below)
export const raceExplainer = { name: 'Find the Pair', play: 'Flip two cards of your own copy of the deck. What you turn up is yours alone to remember, and the other player\'s flips show you nothing but their count. Matching pairs in the deck: {pairs}.', win: 'Find a matching pair first. The cards lie the same way for both of you.' };   // Race mode (core/race.js)
// Its settings (the admin's Mini-game Settings; core/tune.js): pairs dealt into the deck; mem read through tune(pm).
export const TUNE = [
  MODE_TUNE,
  { k: 'pairs', label: 'Matching pairs in the deck', def: 1, min: 1, max: 3, step: 1, group: 'Rules' },
  { k: 'mem', label: 'Computer remembers a seen card (%)', def: 100, min: 0, max: 100, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="3" y="6" width="11" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/></svg>';
