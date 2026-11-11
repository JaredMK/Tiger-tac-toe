// Poker Hands: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Poker Hands',  hint: 'Deal five cards, throw some away, draw once. Better hands score more' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.10.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = false;   // (not dealt in Super Chaos)
// The hands, one line each, under Play and Win in the "?" (ui/explainer.js: a game's explainerList, "Label: meaning"; the points are the defaults).
export const explainerList = { pr: 'Pair (1): two cards of one rank.', tp: 'Two pair (2): two pairs of different ranks.', tk: 'Three of a kind (3): three cards of one rank.', st: 'Straight (4): five ranks in a row (an ace can be low: A-2-3-4-5).', fl: 'Flush (5): all five of one suit.', fh: 'Full house (6): three of one rank plus two of another.', fk: 'Four of a kind (8): four cards of one rank.', sf: 'Straight flush (10): five in a row, all of one suit.' };
export const explainer = { name: 'Poker Hands', play: 'Tap Deal for five cards. Tap any you want to throw away, then Draw once to replace them. Your hand scores points by what it makes.{goAgain}', win: 'First to {target} points.' };   // ({target}: its setting, TUNE below)
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Scored? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). The target tuned by
// tests/sim/poker.sim.js (November 2026): 7 points: Normal v Normal 5.0 turns each (the winner 5.3), the first mover
// 57%; Hard v Hard 5.0, 55%; 6 points 4.3 turns, 57%; 8 points 5.7, 57%.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'target', label: 'Points to win', def: 7, min: 2, max: 30, step: 1, group: 'Rules' },
  { k: 'pair', label: 'Points: pair', def: 1, min: 0, max: 10, step: 1, group: 'Rules' },
  { k: 'two', label: 'Points: two pair', def: 2, min: 0, max: 10, step: 1, group: 'Rules' },
  { k: 'three', label: 'Points: three of a kind', def: 3, min: 0, max: 15, step: 1, group: 'Rules' },
  { k: 'straight', label: 'Points: straight', def: 4, min: 0, max: 15, step: 1, group: 'Rules' },
  { k: 'flush', label: 'Points: flush', def: 5, min: 0, max: 20, step: 1, group: 'Rules' },
  { k: 'full', label: 'Points: full house', def: 6, min: 0, max: 20, step: 1, group: 'Rules' },
  { k: 'four', label: 'Points: four of a kind', def: 8, min: 0, max: 30, step: 1, group: 'Rules' },
  { k: 'sf', label: 'Points: straight flush', def: 10, min: 0, max: 30, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate, Normal (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5.5" width="9" height="13" rx="1.6" transform="rotate(-12 7.5 12)"/><rect x="8" y="4" width="9" height="13" rx="1.6"/><rect x="12.5" y="5.5" width="9" height="13" rx="1.6" transform="rotate(12 17 12)"/><path d="M17 9.5l1.6 2.2L17 13.9l-1.6-2.2z" fill="currentColor" stroke="none"/></svg>';
