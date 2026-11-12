// Thirty-One: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Thirty-One', hint: 'Take a card, let one go. Your best suit counts. Reach the target' };
export const samePhone = false;   // never two people on one phone: each hand would be on show to the other (games/index.js NO_SAME_PHONE)
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.16.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Thirty-One', play: 'One deck (7 to ace) and one pile for both. You hold 3 cards, yours alone. Take the top card of the pile or of the deck, then let one go. Only your best suit counts: ace 11, ten and pictures 10, others their number.{goAgain}', win: 'Reach {target} in one suit.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Raised your score? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). Tuned by tests/sim/t31.sim.js (November
// 2026, the rework: one deck of 32 for both, three suits dealt, the pile empty at the start; a square is never won on
// a first turn). Normal v Normal, turns each (the winner's; the first mover) at a target of 27: 2.5 (2.8; 67%), 28: 2.8
// (3.1; 65%), 29: 3.2 (3.5; 61%), 30: 4.0 (4.3; 58%), 31: 5.7 (6.0; 56%, one square in five past eight turns and 2.5% never
// won: each side can sit on what the other needs), so 30: an ace with a ten or picture and a 9 or better, or three cards
// worth 10. At 30: Hard v Hard 4.4 (4.7; 56%), Easy v Easy 5.6 (5.9; 56%); Hard beats Normal 65%.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'target', label: 'Score to win', def: 30, min: 24, max: 31, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><rect x="2.4" y="6" width="9" height="13" rx="1.8" transform="rotate(-14 6.9 12.5)"/><rect x="7.5" y="4.6" width="9" height="13" rx="1.8"/><rect x="12.6" y="6" width="9" height="13" rx="1.8" transform="rotate(14 17.1 12.5)"/><path d="M12 9.2v3.4M10.3 10.9h3.4"/></svg>';
