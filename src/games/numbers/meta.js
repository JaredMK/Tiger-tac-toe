// Number Target: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Number Target', hint: 'Make the target from the numbers with + − × ÷. First exact hit wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.25.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const turnSecs = 60;   // an online turn's seconds in this game (core/timer.js turnSecs): the attempt and a moment to think
export const explainer = { name: 'Number Target', play: 'Both players get the same numbers and the same target. A turn is one attempt of {secs} seconds: tap a number, a sign and another number to work a result out, and go on from there. Use each number once at most. After {attempts} misses each, a new puzzle is dealt.', win: 'The first to make the target exactly.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3.500"/><path d="M7 8.500h4M9 6.500v4M13.500 8.500h4M7.500 14l3 3M10.500 14l-3 3M13.500 14.500h4M13.500 17h4"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the seconds an attempt has, how many numbers a puzzle gives
// (two of them from 10, 15, 20, 25 and 50, the rest from 1 to 9), the range the target is dealt in, the attempts each
// before a new puzzle, and the computer's chance of finding the way in one attempt, by level.
export const TUNE = [
  { k: 'secs', label: 'Seconds an attempt', def: 20, min: 8, max: 60, step: 1, group: 'Rules' },
  { k: 'attempts', label: 'Attempts each before a new puzzle', def: 2, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'numbers', label: 'Numbers in a puzzle', def: 6, min: 4, max: 6, step: 1, group: 'Board' },
  { k: 'tmin', label: 'Target: smallest', def: 30, min: 10, max: 900, step: 5, group: 'Board' },
  { k: 'tmax', label: 'Target: largest', def: 300, min: 20, max: 999, step: 5, group: 'Board' },
  { k: 'aiPct', label: 'Normal computer: finds the way in an attempt (%)', def: 10, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'aiPctHard', label: 'Hard computer: finds the way (%)', def: 22, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'aiPctEasy', label: 'Easy computer: finds the way (%)', def: 5, min: 0, max: 100, step: 1, group: 'Computer' },
];
