// Key Drop: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Key Drop', hint: 'Slide the key right, then up, to a keyhole. First to 2 prizes wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.26.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its aim is two timed holds: replayed as it was made (core/timer.js moveRate)
export const explainer = { name: 'Key Drop', play: 'Each player has their own machine. Hold the button: the key slides right. Let go and it stops. Hold again: it slides up. Let go, and the key pushes forward. In a keyhole, it knocks that prize into your prize box. You get one hold each way.{rampText}', win: 'First to {goal} prizes.' };
// {rampText} in the explainer: its sentence only while the speed-up is on (ui/explainer.js fillTune).
export function explainVars(v) { return { rampText: v.ramp === 'on' ? ' The key gets a little faster with each attempt.' : '' }; }
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.500" cy="15.500" r="4.500"/><path d="M10.700 12.300 20 3M16.500 6.500l3 3M14 9l2.500 2.500"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the prizes to win, the key's speed each way (the machine's face
// is 100 across and 100 up), how close to a keyhole's middle counts, the wall's size, whether the key speeds up with
// each of a player's attempts (and by how much), and the computer's timing.
export const TUNE = [
  { k: 'goal', label: 'Prizes to win', def: 2, min: 1, max: 6, step: 1, group: 'Rules' },
  { k: 'speedX', label: 'Key speed sideways (units a second; the wall is 100 across)', def: 45, min: 15, max: 120, step: 1, group: 'Timing' },
  { k: 'speedY', label: 'Key speed upwards (units a second)', def: 45, min: 15, max: 120, step: 1, group: 'Timing' },
  { k: 'tol', label: 'Keyhole tolerance (how far off still goes in, units)', def: 2.5, min: 0.5, max: 8, step: 0.1, group: 'Board' },
  { k: 'cols', label: 'Prize wall: columns', def: 3, min: 2, max: 5, step: 1, group: 'Board' },
  { k: 'rows', label: 'Prize wall: rows', def: 3, min: 2, max: 4, step: 1, group: 'Board' },
  { k: 'ramp', label: 'The key speeds up a little with each attempt', def: 'off', opts: ['off', 'on'], group: 'Timing' },
  { k: 'rampPct', label: 'Speed added an attempt while that is on (%)', def: 6, min: 1, max: 25, step: 1, group: 'Timing' },
  // The computer's levels (core/tune.js AI_GROUPS: the admin shows them as Computer: Easy, Normal, Hard; the keys are kept,
  // so a square dealt before reads its own values; each level's thinking time is added after these, levelTune).
  { k: 'aiMsEasy', label: 'Timing error letting go of the key (ms, a typical miss)', def: 95, min: 0, max: 400, step: 5, group: 'Computer: Easy' },
  { k: 'aiMs', label: 'Timing error letting go of the key (ms, a typical miss)', def: 70, min: 0, max: 400, step: 5, group: 'Computer: Normal' },
  { k: 'aiMsHard', label: 'Timing error letting go of the key (ms, a typical miss)', def: 55, min: 0, max: 400, step: 5, group: 'Computer: Hard' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/keydrop): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Hold to slide the key right, then up. Stop it at a keyhole to knock a prize down. Win enough first.';
export const luckSkill = 5;
export const format = 'race';
