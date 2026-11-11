// Shut the Box: its names, its "?" explainer, its icon, its release default and its settings.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Shut the Box', hint: 'Roll, then flip down tiles that add up to it. Shut them all' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.8.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Shut the Box', play: 'Roll, then flip down open tiles that add up to the roll. Roll one die once your tiles add up to {oneDie} or less. No way to make it? Your turn ends.{goAgain}', win: 'Shut all your tiles first.' };   // ({oneDie}: its setting, TUNE below)
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Flipped some? Roll again.', off: '' };
// Its settings (the admin's Mini-game Settings; core/tune.js): read with tune(mini). Tuned by tests/sim/shut.sim.js
// (November 2026): the user's rules (tiles 1 to 6, one die at 6 or less) give about 5 turns a player.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'tiles', label: 'Tiles in each box (1 to …)', def: 6, min: 4, max: 9, step: 1, group: 'Rules' },
  { k: 'oneDie', label: 'One die once the open tiles add up to (or less)', def: 6, min: 0, max: 12, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M6.5 9v6M10.5 9v6M14.5 9v3M18 9v6"/><path d="M13.5 15h2" stroke-linecap="round"/></svg>';
