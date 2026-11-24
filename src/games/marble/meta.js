// Marble Toss: its names, its "?" explainer, its icon, its release default and its settings.
import { FLICK_TUNE } from '../shared/flick.js';

export const info = { name: 'Marble Toss', hint: 'Flick marbles into the holes. Far holes score more. First to 18 wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.25.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Marble Toss', play: 'Flick up the table to roll a marble: a faster flick rolls further. You get {marbles} marbles a turn. A marble that drops in a hole scores the number on it. A miss scores nothing.', win: 'First to {target} points.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="16" r="5"/><path d="M5.800 14.500a3 3 0 0 1 2.400-1.700"/><circle cx="17.500" cy="6.500" r="3.500"/><path d="M12 12.500l2.500-3"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the marbles a turn, the target, the table's layout of holes and
// what each size of hole scores, the holes' size (100: as drawn), the table's own spread (how far from its aim a
// marble may land), the flick's speeds and the computer's aim.
export const TUNE = [
  { k: 'marbles', label: 'Marbles a turn', def: 3, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'target', label: 'Points to take the square', def: 18, min: 4, max: 60, step: 1, group: 'Rules' },
  { k: 'layout', label: 'Hole layout', def: 'classic', opts: ['classic', 'ladder', 'corners'], group: 'Board' },
  { k: 'v1', label: 'Points: a big hole', def: 1, min: 1, max: 10, step: 1, group: 'Board' },
  { k: 'v2', label: 'Points: a middle hole', def: 2, min: 1, max: 10, step: 1, group: 'Board' },
  { k: 'v3', label: 'Points: a small hole', def: 4, min: 1, max: 10, step: 1, group: 'Board' },
  { k: 'hole', label: 'Hole size (%)', def: 100, min: 60, max: 160, step: 5, group: 'Board' },
  { k: 'spread', label: 'Spread: how far from its aim a marble may land (table units)', def: 2.5, min: 0, max: 10, step: 0.5, group: 'Board' },
  ...FLICK_TUNE,
  { k: 'aiErr', label: 'Aim error (table units)', def: 8.5, min: 0, max: 30, step: 0.5, group: 'Computer: Normal' },
  { k: 'aiErrHard', label: 'Aim error (table units)', def: 7, min: 0, max: 30, step: 0.5, group: 'Computer: Hard' },
  { k: 'aiErrEasy', label: 'Aim error (table units)', def: 10, min: 0, max: 30, step: 0.5, group: 'Computer: Easy' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/marble): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Flick marbles up the table into the holes. Each hole scores its number. Reach the target first.';
export const luckSkill = 4;
export const format = 'race';
