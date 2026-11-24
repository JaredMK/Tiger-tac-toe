// Barrel Launch: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Barrel Launch', hint: 'Tap to fire into the barrel above. First to the top wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.33.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its move is one timed tap: replayed as it was made (core/timer.js moveRate)
export const explainer = { name: 'Barrel Launch', play: 'Each player has their own column of barrels, and every barrel swings. Tap to fire from your barrel. Land in the barrel above and you fire again. Miss and you drop back into your barrel, and your turn ends.{rampText}', win: 'First to the top barrel ({top} up).' };
// {rampText} in the explainer: its sentence only while the speed-up is on (ui/explainer.js fillTune).
export function explainVars(v) { return { rampText: v.ramp === 'on' ? ' The higher you climb, the faster the barrels swing.' : '' }; }
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.500" y="12.500" width="7" height="9" rx="2" transform="rotate(-24 7 17)"/><rect x="13.500" y="2.500" width="7" height="9" rx="2" transform="rotate(16 17 7)"/><path d="M9.500 11.500C10.500 8.500 12 7 13.500 6.500" stroke-dasharray="1.200 2.600"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the barrels to the top, the swing's time and its angle, how far
// apart the barrels stand, how close to the next barrel's middle a shot must pass to be caught, whether the swing
// speeds up higher up (and by how much), and the computer's timing.
export const TUNE = [
  { k: 'top', label: 'Barrels to the top', def: 7, min: 3, max: 12, step: 1, group: 'Rules' },
  { k: 'win', label: 'Catch window: how far from the next barrel\'s middle a shot still lands in it (units; a barrel is 15 across)', def: 6.5, min: 1.5, max: 12, step: 0.5, group: 'Rules' },
  { k: 'period', label: 'Swing speed: ms for one swing there and back (less is faster)', def: 1700, min: 600, max: 4000, step: 50, group: 'Timing' },
  { k: 'ramp', label: 'The barrels swing faster higher up', def: 'off', opts: ['off', 'on'], group: 'Timing' },
  { k: 'rampPct', label: 'Faster for each barrel up while that is on (%)', def: 8, min: 1, max: 30, step: 1, group: 'Timing' },
  { k: 'amp', label: 'Swing angle: degrees each way from straight up', def: 40, min: 15, max: 70, step: 1, group: 'Board' },
  { k: 'gap', label: 'Barrel gap: how far up the next barrel is (units; a barrel is 19 long)', def: 52, min: 30, max: 80, step: 1, group: 'Board' },
  { k: 'aiMs', label: 'Timing error (ms)', def: 60, min: 0, max: 400, step: 5, group: 'Computer: Normal' },
  { k: 'aiMsHard', label: 'Timing error (ms)', def: 50, min: 0, max: 400, step: 5, group: 'Computer: Hard' },
  { k: 'aiMsEasy', label: 'Timing error (ms)', def: 70, min: 0, max: 400, step: 5, group: 'Computer: Easy' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/barrel): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Tap to fire from barrel to barrel up your column. Miss and your turn ends. Reach the top first.';
export const luckSkill = 5;
export const format = 'race';
