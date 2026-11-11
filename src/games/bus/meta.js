// Ride the Bus: its names, its "?" explainer, its icon and its release default.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Ride the Bus', hint: 'Colour, higher or lower, inside or outside, then the suit' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Ride the Bus', play: 'Guess red or black, then higher or lower, then inside or outside, then the suit.{goAgain}', win: 'Get through all four.' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini).
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Right? Go again. Miss and your turn ends, but you keep your progress.', off: ' One guess a turn: you keep your progress.' };
export const TUNE = [
  AGAIN_TUNE,
  { k: 'ties', label: 'A tie (equal value) is', def: 'wrong', opts: ['wrong', 'right'], group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M2.5 10.5h19M8.5 4v6.5M15 4v6.5"/><circle cx="7" cy="18.5" r="2" fill="currentColor"/><circle cx="17" cy="18.5" r="2" fill="currentColor"/></svg>';
