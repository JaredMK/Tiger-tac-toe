// Rummy Lite: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Rummy Lite',   hint: 'Take a card, throw one. First to two melds wins' };
export const samePhone = false;   // never two people on one phone: each hand would be on show to the other (games/index.js NO_SAME_PHONE)
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.17.0';   // (1.17.0: the first version with its rules as they are now, December 2026 audit; was 1.11.0); the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Rummy Lite', play: 'Take the top card of the pile or the deck, then throw one onto the pile. A meld is three of a kind, or three in a row in one suit (an ace is low or high).{goAgain}', win: 'Hold {melds} melds.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Made a new meld? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with rmyCfg(mini) (rules.js). `ranks`: the ranks in
// the shared deck, from the ace up (13: a full deck); a smaller deck makes melds sooner. Tuned by tests/sim/rummy.sim.js.
// The computer's levels (core/tune.js levelTune): its mistakes are careless takes and throws (ai.js worse): Easy 70%, Normal 20%, Hard never.
export const AI_LEVELS = { miss: { easy: 70, normal: 20 } };
export const TUNE = [
  AGAIN_TUNE,
  { k: 'hand', label: 'Cards in a hand', def: 6, min: 6, max: 8, step: 1, group: 'Rules' },
  { k: 'melds', label: 'Melds to win', def: 2, min: 1, max: 2, step: 1, group: 'Rules' },
  { k: 'ranks', label: 'Ranks in the deck (from the ace up)', def: 8, min: 5, max: 13, step: 1, group: 'Rules' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><rect x="3" y="6" width="8" height="12" rx="1.6" transform="rotate(-14 7 12)"/><rect x="8" y="5" width="8" height="12" rx="1.6"/><rect x="13" y="6" width="8" height="12" rx="1.6" transform="rotate(14 17 12)"/></svg>';
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/rummy): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Take a card, throw one away. Make melds: three of a kind or three in a row. Hold enough melds first.';
export const luckSkill = 2;
export const format = 'shared';
