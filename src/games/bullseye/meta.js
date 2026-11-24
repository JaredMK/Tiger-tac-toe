// Bullseye: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Bullseye',     hint: 'Stop both lines on the board. Bullseye 3, rings 2 and 1. First to 7' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.14.0';   // (1.14.0: the two-tap aim at a board on the wall, { x, y }; 1.13.0 was the flick, { aim, power }) the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Bullseye', play: 'Stop the sideways line, then the up-down line. The dart lands where they cross. Bullseye is {bullPts}, the inner ring 2, the outer ring 1.', win: 'First to {goal}.' };   // ({bullPts}, {goal}: its settings, TUNE below)
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M12 2.8v3M12 18.2v3" stroke-linecap="round"/></svg>';
export const BULL_DEFAULTS = { board: 32, mid: 17.5, bull: 6.5, sweep: 700, ramp: 1.15 };   // the board's rings (config/bulls, the admin's card): the radii of the whole board, of its inner ring and of the bullseye, in wall units (the wall is 100 across); ms for a line to sweep across at the start; the speed-up of a player's lines per scoring throw
// Its settings (the admin's Mini-game Settings; core/tune.js) beyond config/bulls: the points, and the computer's rates at the start.
export const TUNE = [
  { k: 'goal', label: 'Points to win', def: 7, min: 3, max: 12, step: 1, group: 'Rules' },
  { k: 'bullPts', label: 'Bullseye points', def: 3, min: 3, max: 5, step: 1, group: 'Rules' },
  { k: 'aiSkillEasy', label: "Easy: how often it lands where Normal would (% of Normal's hits in each ring)", def: 70, min: 10, max: 200, step: 1, group: 'Computer: Easy' },
  { k: 'aiBull', label: "Normal: bullseyes (% of throws)", def: 12, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'aiMid', label: "Normal: inner-ring hits, bullseyes included (% of throws)", def: 42, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'aiBoard', label: "Normal: board hits, every ring included (% of throws)", def: 80, min: 0, max: 100, step: 1, group: 'Computer: Normal' },
  { k: 'aiSkillHard', label: "Hard: how often it lands where Normal would (% of Normal's hits in each ring)", def: 125, min: 10, max: 200, step: 1, group: 'Computer: Hard' },
];
// The settings checked together (the admin's Save): a bullseye is an inner-ring hit and that a board hit.
export const tuneCheck = v => (v.aiBull > v.aiMid || v.aiMid > v.aiBoard ? "Computer's bullseyes can't be more than its inner-ring hits, nor those more than its board hits (each counts in the next)." : null);
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/bullseye): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Stop two sweeping lines to throw a dart where they cross. Score the target first.';
export const luckSkill = 4;
export const format = 'race';
