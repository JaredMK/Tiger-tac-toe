// Dice Combo: its names, its "?" explainer, its icon, its release default and its settings (November 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Dice Combo',        hint: 'Roll five dice, hold some, roll again. Claim 3 combos' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.8.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = false;   // (not dealt in Super Chaos)
// The combos, one line each, under Play and Win in the "?" (ui/explainer.js: a game's explainerList, "Label: meaning").
export const explainerList = { k3: 'Three of a kind: three dice the same (like 4-4-4).', k4: 'Four of a kind: four dice the same.', fh: 'Full house: three of one number plus two of another.', ss: 'Small straight: 4 in a row (like 2-3-4-5).', ls: 'Large straight: 5 in a row (1-2-3-4-5 or 2-3-4-5-6).', y5: 'Five alike: all five dice the same. It also counts as three or four of a kind.' };
export const explainer = { name: 'Dice Combo', play: 'Roll five dice up to {rolls} times. Tap dice to hold them between rolls. Then claim a combo not yet on your card. Nothing fits? Your turn ends.{goAgain}', win: 'Claim {goal} combos.' };   // ({rolls}, {goal}: its settings, TUNE below)
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Claimed one? Go again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). Tuned by tests/sim/combo.sim.js
// (November 2026): 3 combos, 2 rolls a move: each player about 4 turns (Normal 4.3, Hard 3.9), the first mover 57-58%.
// 3 rolls was 3.0-3.3 turns and a first mover at 61-68%; 4 combos with 3 rolls 4.4-5.0 turns and 58-60%.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'goal', label: 'Combos to win', def: 3, min: 1, max: 6, step: 1, group: 'Rules' },
  { k: 'rolls', label: 'Rolls a move', def: 2, min: 1, max: 4, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate, Normal (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="2.5" y="3" width="8" height="8" rx="1.8"/><rect x="13.5" y="3" width="8" height="8" rx="1.8"/><rect x="8" y="13" width="8" height="8" rx="1.8"/><circle cx="6.5" cy="7" r="1.1" fill="currentColor"/><circle cx="17.5" cy="7" r="1.1" fill="currentColor"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/></svg>';
