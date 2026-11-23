// Castle Smash: its names, its "?" explainer, its icon, its release default and its settings.
import { AGAIN_TUNE } from '../../core/tune.js';

export const info = { name: 'Castle Smash', hint: 'Fling boulders at the other castle. Smash its crystal to win' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.31.0';   // (1.31.0: the camera's intro, its flashMs) the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its move plays back in real time (a recording): never sped up past the replay's own speed (core/timer.js moveRate)
export const explainer = { name: 'Castle Smash', play: 'Drag back to aim your catapult, further for more power, and let go to fling a boulder at the other castle. Timber snaps, stone cracks and then crumbles, and what falls stays fallen.{goAgain}', win: 'Smash the other castle\'s crystal first: hit it hard with a boulder, crush it under a falling block or knock it off its perch.' };
// {goAgain} in the explainer: the text below while "Go again on success" is on (AGAIN_TUNE), the other while off (ui/explainer.js fillTune).
export const goAgainText = { on: ' Break a timber or knock a block clean out of the castle to shoot again.', off: '' };
// The icon: a tower with its battlements and its door, a boulder on its way to it.
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.500 21V10h1.500V8h2.500v2h2V8H19v2h1.500v11z"/><path d="M14 21v-3.500a1.500 1.500 0 0 1 3 0V21"/><circle cx="5.500" cy="6" r="2.600"/><path d="M2 11l1.500-1.300M3.500 13.500l1.300-1.100"/></svg>';
// Its settings (the admin's Games page; core/tune.js), read with rules.js castleCfg: how high a castle is built, the
// catapult's top speed, the boulder's and the stone's weight, what breaks timber, cracks stone and ends the core (a
// punch: the speed two things meet at times the striker's weight, in tenths; the boulder weighs 1.5 at 100%), and the computer's hand by level (its aim's and its
// power's error, a normal spread; Hard keeps the best of `aiTries` such throws). Tuned by tests/sim/castle.sim.js.
export const TUNE = [
  AGAIN_TUNE,
  { k: 'layers', label: 'Castle height (layers of stone)', def: 4, min: 3, max: 5, step: 1, group: 'Board' },
  { k: 'stone', label: 'Stone weight (%)', def: 100, min: 40, max: 250, step: 10, group: 'Board' },
  { k: 'power', label: 'Catapult top speed (units/s)', def: 600, min: 480, max: 780, step: 20, group: 'Rules' },
  { k: 'weight', label: 'Boulder weight (%)', def: 100, min: 40, max: 250, step: 10, group: 'Rules' },
  { k: 'woodTough', label: 'Timber strength (the punch that breaks it, tenths)', def: 50, min: 10, max: 200, step: 5, group: 'Rules' },
  { k: 'stoneTough', label: 'Stone: the boulder\'s punch that cracks it (tenths)', def: 45, min: 10, max: 200, step: 5, group: 'Rules' },
  { k: 'stoneHits', label: 'Stone: hard hits before it crumbles', def: 2, min: 1, max: 4, step: 1, group: 'Rules' },
  { k: 'coreTough', label: 'Crystal strength (the punch that smashes it, tenths)', def: 55, min: 10, max: 200, step: 5, group: 'Rules' },
  { k: 'aiAim', label: 'Normal computer: aim error (mrad)', def: 40, min: 0, max: 300, step: 5, group: 'Computer' },
  { k: 'aiPow', label: 'Normal computer: power error (%)', def: 4, min: 0, max: 30, step: 0.5, group: 'Computer' },
  { k: 'aiAimHard', label: 'Hard computer: aim error (mrad)', def: 20, min: 0, max: 300, step: 5, group: 'Computer' },
  { k: 'aiPowHard', label: 'Hard computer: power error (%)', def: 2, min: 0, max: 30, step: 0.5, group: 'Computer' },
  { k: 'aiTries', label: 'Hard computer: throws it tries and keeps the best of', def: 4, min: 1, max: 8, step: 1, group: 'Computer' },
  { k: 'aiAimEasy', label: 'Easy computer: aim error (mrad)', def: 80, min: 0, max: 300, step: 5, group: 'Computer' },
  { k: 'aiPowEasy', label: 'Easy computer: power error (%)', def: 8, min: 0, max: 30, step: 0.5, group: 'Computer' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/castle): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Fling boulders with your catapult at the other castle. Smash its crystal first to win.';
export const luckSkill = 4;
export const format = 'shared';
