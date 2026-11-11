// War: its names, its "?" explainer, its icon and its release default.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'War',          hint: 'Flip against the dealer: the higher card wins the round. Win 3 rounds' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.5.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds (each player's own round against the dealer, from their own deck)
export const explainer = { name: 'War', play: 'Tap Flip: your card against the dealer\'s, and the higher card wins the round. A tie goes to war: three cards down each, then flip again. A war won counts {warWorth}.{goAgain}', win: 'Win {goal} rounds.' };   // ({goal}, {warWorth}: its settings, TUNE below)
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini).
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Win? Go again.', off: '' };
export const TUNE = [
  AGAIN_TUNE,
  { k: 'goal', label: 'Rounds to win', def: 3, min: 2, max: 5, step: 1, group: 'Rules' },
  { k: 'warWorth', label: 'A war won counts', def: 2, min: 1, max: 3, step: 1, group: 'Rules' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><rect x="2.6" y="5.2" width="9.2" height="13" rx="1.8" transform="rotate(-12 7.2 11.7)"/><rect x="12.2" y="5.2" width="9.2" height="13" rx="1.8" transform="rotate(12 16.8 11.7)"/><path d="M12 8.6l1.1 2.3 2.5.3-1.8 1.7.5 2.5L12 14.2l-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill="currentColor" stroke="none"/></svg>';
