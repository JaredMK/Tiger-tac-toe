// Pig: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Pig', hint: "Roll and bank. A 1 loses this turn's points. First to 20 wins" };   // ('piggy': Risky Rolls keeps the id `pig` from when it carried the name)
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Pig', play: 'Roll the die as often as you like, then bank your points. Roll a {bust} and this turn\'s points are gone.{maxText}', win: 'First to bank {target} points.' };
// {maxText}: said only while the admin has a roll limit on.
export const explainVars = v => ({ maxText: v.maxRolls > 0 ? ` At most ${v.maxRolls} rolls a turn.` : '' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="13" rx="8.5" ry="7"/><path d="M5.5 8 4 4l4.5 2.5M18.5 8 20 4l-4.5 2.5"/><path d="M9.5 12.5v2M14.5 12.5v2"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the target, the number that busts, a roll limit (0: none), the
// die, and where the computer banks.
export const TUNE = [
  { k: 'target', label: 'Points to take the square', def: 25, min: 10, max: 100, step: 1, group: 'Rules' },
  { k: 'bust', label: 'The number that loses the turn\'s points', def: 1, min: 1, max: 6, step: 1, group: 'Rules' },
  { k: 'maxRolls', label: 'Most rolls a turn (0: no limit)', def: 0, min: 0, max: 10, step: 1, group: 'Rules' },
  { k: 'sides', label: 'Die', def: 6, opts: [6, 8], group: 'Rules' },
  { k: 'aiBank', label: 'Normal computer banks at (points this turn)', def: 9, min: 2, max: 30, step: 1, group: 'Computer' },
  { k: 'aiBankEasy', label: 'Easy computer banks at (points this turn)', def: 4, min: 2, max: 30, step: 1, group: 'Computer' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/piggy): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Roll as often as you dare, then bank. Roll the bust number and lose the turn\'s points. Bank the target first.';
export const luckSkill = 2;
export const format = 'race';
