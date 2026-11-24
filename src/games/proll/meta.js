// Point Roll: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Point Roll', hint: 'Pick a number. Roll it before a 7 to score. First to 10 wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.25.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Point Roll', play: 'Pick a number from 2 to 12, but not 7. The dice roll until they make your number or a 7. Your number first: you score its points. A 7 first: nothing. Rarer numbers are worth more.', win: 'First to {target} points.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.500" y="8" width="10" height="10" rx="2"/><rect x="12.500" y="4" width="9" height="9" rx="2"/><circle cx="7.500" cy="13" r="1" fill="currentColor"/><circle cx="15.500" cy="7" r=".8" fill="currentColor"/><circle cx="18.500" cy="10" r=".8" fill="currentColor"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the target, each pair of numbers' points (2 and 12 are as rare
// as each other, and so on: a number's chance of coming before a 7 is 1 in 7, 1 in 4, 1 in 3, 2 in 5 and 5 in 11, so
// 14, 8, 6, 5 and 4 points are each worth about 2 a turn), and how many of a move's rolls are shown (its last ones).
export const TUNE = [
  { k: 'target', label: 'Points to take the square', def: 10, min: 5, max: 40, step: 1, group: 'Rules' },
  { k: 'p2', label: 'Points: 2 or 12', def: 14, min: 1, max: 40, step: 1, group: 'Rules' },
  { k: 'p3', label: 'Points: 3 or 11', def: 8, min: 1, max: 40, step: 1, group: 'Rules' },
  { k: 'p4', label: 'Points: 4 or 10', def: 6, min: 1, max: 40, step: 1, group: 'Rules' },
  { k: 'p5', label: 'Points: 5 or 9', def: 5, min: 1, max: 40, step: 1, group: 'Rules' },
  { k: 'p6', label: 'Points: 6 or 8', def: 4, min: 1, max: 40, step: 1, group: 'Rules' },
  { k: 'shown', label: 'Most rolls shown a move (its last ones)', def: 5, min: 2, max: 10, step: 1, group: 'Timing' },
  // The computer's risk appetite by level (ai.js longShare): how often it goes for a long shot, whatever it needs.
  { k: 'aiLongEasy', label: 'Long shots: share of its picks on 2, 3, 11 or 12 whatever it needs (%)', def: 50, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
  { k: 'aiLongNormal', label: 'Long shots: share of its picks on 2, 3, 11 or 12 whatever it needs (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer: Normal' },
  { k: 'aiLongHard', label: 'Long shots: share of its picks on 2, 3, 11 or 12 whatever it needs (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer: Hard' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/proll): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Pick a number, then roll until it comes up or a 7 does. Rarer numbers score more. Reach the target first.';
export const luckSkill = 1;
export const format = 'race';
