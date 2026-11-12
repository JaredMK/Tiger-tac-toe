// Rock Paper Scissors: its names, its "?" explainer, its icon, its release default and its settings.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Rock Paper Scissors', hint: 'Throw against the house. First to 3 wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.15.0';   // the oldest client version that has this game (core/client.js; 1.15.0: the house throws at random, no deck)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Rock Paper Scissors', play: 'Pick rock, paper or scissors against the house. The house throws at random. Tie? Throw again.{goAgain}', win: 'Win {goal} throws.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Win? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). The wins to take the square.
// December 2026, the house at random (tests/sim/rps.sim.js): first to 3 is 4.4 turns each (the winner 4.7), the first mover
// 55.6%; first to 2, 2.7 turns, 58.6%; first to 4, 6.2 turns, 54.6%.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'goal', label: 'Wins to take the square', def: 3, min: 1, max: 6, step: 1, group: 'Rules' },
];
// The icon: a fist and a pair of scissors (drawn).
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9.5c0-1.4 1-2.3 2.2-2.3h3.6c1.3 0 2.2 1 2.2 2.2v3.4c0 2.4-1.8 4.2-4.2 4.2h-.6c-1.8 0-3.2-1.4-3.2-3.2z"/><path d="M5.6 7.2V5.9M7.6 7.2V5.6M9.6 7.4V6"/><circle cx="16" cy="16.6" r="2"/><circle cx="20.2" cy="16.6" r="2"/><path d="M16.9 14.9 21 5.5M19.3 14.9 15.2 5.5"/></svg>';
