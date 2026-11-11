// Thirty-One: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Thirty-One', hint: 'Take a card, let one go. Your best suit counts. Reach the target or hit 31' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.10.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Thirty-One', play: 'You hold 3 cards. Take the top of your discard pile or draw from your deck, then let one card go. Only your best suit counts: aces 11, pictures 10, others their number.{goAgain}', win: 'Reach {target} in one suit, or exactly 31 at once.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Raised your score? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). Tuned by tests/sim/t31.sim.js (November
// 2026): Normal v Normal, turns each at a target of 24: 4.35, 25: 4.9, 26: 5.6, 27: 6.5, 29: 9.1, 31: 17.7, so 25 (below the
// 27-31 first asked for, which run past 6 turns a player).
export const TUNE = [
  AGAIN_TUNE,
  { k: 'target', label: 'Score to win', def: 26, min: 21, max: 31, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><rect x="2.4" y="6" width="9" height="13" rx="1.8" transform="rotate(-14 6.9 12.5)"/><rect x="7.5" y="4.6" width="9" height="13" rx="1.8"/><rect x="12.6" y="6" width="9" height="13" rx="1.8" transform="rotate(14 17.1 12.5)"/><path d="M12 9.2v3.4M10.3 10.9h3.4"/></svg>';
