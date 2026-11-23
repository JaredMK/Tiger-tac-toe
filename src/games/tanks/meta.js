// Tank Duel: its names, its "?" explainer, its icon, its release default and its settings (December 2026).
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Tank Duel', hint: 'Drive, aim and fire over the hills. Mind the wind. Knock out the other tank' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.30.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Tank Duel', play: 'Drive if you like, drag on the field to set your barrel\'s angle and power, then fire. The wind (its arrow and number are at the top) bends the shot. A blast hurts any tank near it, yours too: a direct hit takes {hitDmg}.{goAgain}', win: 'Take the other tank\'s health from {health} to 0.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' A direct hit? Fire again.', off: '' };
// The icon: a tank, its barrel raised, a shell on its way.
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.500" y="14.500" width="15" height="5" rx="2.500"/><path d="M6.500 14.500v-2a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2"/><path d="M12.500 10.500l5.500-4.500"/><path d="M21 3.500h.01"/></svg>';
// Its settings (the admin's Games page; core/tune.js): read with tankCfg(mini). A tank's health, what a direct hit and
// a blast beside the hull take, how far a blast reaches and how big a bite it takes out of the ground, the drive a
// move, the steepest step a tank climbs, the wind's weakest and strongest, the pull on a shell and a full-power
// shot's speed (the field is 100 wide: at 30 and 60 a full shot at 45 degrees carries 120), the hills' height, and
// the computer's aim: its error on the angle (degrees) and on the power (points), a normal spread each, by level;
// Hard's error after it has seen its last shot fall (same two columns as now).
// Tuned by tests/sim/tanks.sim.js (December 2026): Normal v Normal 4.8 turns each (median 4.5), the first mover 54-56%,
// never a square before a player's third shot; Hard v Hard 3.2 turns, 65% (see the sim's header for every setting).
export const TUNE = [
  AGAIN_TUNE,
  { k: 'health', label: 'Health', def: 100, min: 20, max: 300, step: 10, group: 'Rules' },
  { k: 'hitDmg', label: 'Direct hit: damage', def: 40, min: 5, max: 300, step: 5, group: 'Rules' },
  { k: 'splash', label: 'A blast right beside the hull: % of a direct hit', def: 70, min: 0, max: 100, step: 5, group: 'Rules' },
  { k: 'blast', label: 'Blast: how far from the hull it still hurts (the field is 100 wide)', def: 9, min: 1, max: 30, step: 0.5, group: 'Rules' },
  { k: 'fuel', label: 'Drive: columns a move', def: 6, min: 0, max: 20, step: 1, group: 'Rules' },
  { k: 'crater', label: 'Crater size (radius)', def: 5, min: 0, max: 15, step: 0.5, group: 'Board' },
  { k: 'climb', label: 'Steepest step a tank climbs (a column)', def: 3, min: 1, max: 10, step: 1, group: 'Board' },
  { k: 'hills', label: 'Hills: height (%; 0 flat)', def: 100, min: 0, max: 200, step: 10, group: 'Board' },
  { k: 'windMin', label: 'Wind: weakest', def: 0, min: 0, max: 20, step: 1, group: 'Board' },
  { k: 'windMax', label: 'Wind: strongest', def: 8, min: 0, max: 20, step: 1, group: 'Board' },
  { k: 'gravity', label: 'Gravity', def: 30, min: 15, max: 60, step: 1, group: 'Board' },
  { k: 'speed', label: 'A full-power shot\'s speed', def: 60, min: 40, max: 100, step: 1, group: 'Board' },
  { k: 'aiAng', label: 'Normal computer: angle error (degrees)', def: 3.5, min: 0, max: 20, step: 0.25, group: 'Computer' },
  { k: 'aiPow', label: 'Normal computer: power error', def: 5, min: 0, max: 30, step: 0.25, group: 'Computer' },
  { k: 'aiAngHard', label: 'Hard computer: angle error', def: 3, min: 0, max: 20, step: 0.25, group: 'Computer' },
  { k: 'aiPowHard', label: 'Hard computer: power error', def: 4, min: 0, max: 30, step: 0.25, group: 'Computer' },
  { k: 'aiRange', label: 'Hard computer: its error once it has seen a shot fall (%)', def: 75, min: 10, max: 100, step: 5, group: 'Computer' },
  { k: 'aiAngEasy', label: 'Easy computer: angle error', def: 5, min: 0, max: 20, step: 0.25, group: 'Computer' },
  { k: 'aiPowEasy', label: 'Easy computer: power error', def: 7, min: 0, max: 30, step: 0.25, group: 'Computer' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/tanks): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Aim, set your power and fire as the wind bends your shot. Knock the other tank to zero.';
export const luckSkill = 4;
export const format = 'shared';
