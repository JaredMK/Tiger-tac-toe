// Rummy Lite: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Rummy Lite',   hint: 'Take a card, throw one. First to two melds wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.10.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Rummy Lite', play: 'Take the top card of your pile or your deck, then throw one card onto your pile. A meld is three of a kind, or three in a row in one suit (an ace is low or high).{goAgain}', win: 'Hold {melds} melds.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Made a new meld? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with rmyCfg(mini) (rules.js). `ranks`: the ranks in
// each player's deck, from the ace up (13: a full deck); a smaller deck makes melds sooner: 6 (the ace to 6, 24 cards) brings the
// square to about 5.5 turns each for Normal (a full deck: 18). Tuned by tests/sim/rummy.sim.js.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'hand', label: 'Cards in a hand', def: 6, min: 6, max: 8, step: 1, group: 'Rules' },
  { k: 'melds', label: 'Melds to win', def: 2, min: 1, max: 2, step: 1, group: 'Rules' },
  { k: 'ranks', label: 'Ranks in each deck (from the ace up)', def: 6, min: 5, max: 13, step: 1, group: 'Rules' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><rect x="3" y="6" width="8" height="12" rx="1.6" transform="rotate(-14 7 12)"/><rect x="8" y="5" width="8" height="12" rx="1.6"/><rect x="13" y="6" width="8" height="12" rx="1.6" transform="rotate(14 17 12)"/></svg>';
