// Bin Shot (the Paper Toss of the second December 2026 batch, under a name of its own: that one is another game's):
// its names, its "?" explainer, its icon, its release default and its settings.
import { FLICK_TUNE } from '../shared/flick.js';

export const info = { name: 'Bin Shot', hint: 'Flick the paper into the bin. Mind the fan. First to 3 wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.29.0';   // (1.29.0: the view from behind the thrower, the rim's bounce in or out)   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Bin Shot', play: 'Swipe up to throw the paper ball at the bin: the swipe\'s angle aims it, its speed throws it further. The fan beside the bin pushes it sideways: its arrow shows which way and its number how many bins wide. A ball on the rim may drop in or bounce out. The fan changes after every throw.', win: 'First to {goal} baskets.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10h12l-1.500 11h-9z"/><path d="M5 10h14"/><path d="M9.500 6.500l1.500-3 3 .5 1.500 2.500-2 2-3-.5z"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the baskets to win, how far away the bin is and how big (the
// floor is 100 wide), the fan's weakest and strongest push (how far it carries a throw sideways on its way to the
// bin, floor units), the room's own spread, the flick's speeds and the computer's aim.
export const TUNE = [
  { k: 'goal', label: 'Baskets to take the square', def: 3, min: 1, max: 7, step: 1, group: 'Rules' },
  { k: 'dist', label: 'Bin distance (the floor is 100 wide)', def: 80, min: 50, max: 95, step: 5, group: 'Board' },
  { k: 'bin', label: 'Bin size (radius)', def: 8, min: 5, max: 18, step: 0.5, group: 'Board' },
  { k: 'windMin', label: 'Fan: weakest push (floor units by the bin)', def: 4, min: 0, max: 40, step: 1, group: 'Board' },
  { k: 'windMax', label: 'Fan: strongest push', def: 26, min: 0, max: 40, step: 1, group: 'Board' },
  { k: 'rim', label: 'Rim width: how far outside the bin still hits the rim (floor units)', def: 3.5, min: 0, max: 8, step: 0.5, group: 'Board' },
  { k: 'rimIn', label: 'Rim forgiveness: a ball on the rim drops in (%)', def: 40, min: 0, max: 100, step: 5, group: 'Rules' },
  { k: 'spread', label: 'Spread: how far off its aim a throw may land (floor units)', def: 2, min: 0, max: 10, step: 0.5, group: 'Board' },
  ...FLICK_TUNE,
  { k: 'aiErr', label: 'Normal computer: aim error (floor units)', def: 8, min: 0, max: 30, step: 0.5, group: 'Computer' },
  { k: 'aiErrHard', label: 'Hard computer: aim error', def: 5, min: 0, max: 30, step: 0.5, group: 'Computer' },
  { k: 'aiErrEasy', label: 'Easy computer: aim error', def: 11, min: 0, max: 30, step: 0.5, group: 'Computer' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/toss): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Swipe to throw a paper ball into the bin while a fan pushes it sideways. Score enough baskets first.';
export const luckSkill = 4;
export const format = 'race';
