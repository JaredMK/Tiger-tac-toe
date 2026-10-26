// Bullseye: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Bullseye',     hint: 'Stop both lines on the board. Bullseye 3, board 1. First to 5' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Bullseye', play: 'Stop the sideways line, then the up-down line. The dart lands where they cross. Bullseye is {bullPts}, the board is 1.', win: 'First to {goal}.' };   // ({bullPts}, {goal}: its settings, TUNE below)
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M12 2.8v3M12 18.2v3" stroke-linecap="round"/></svg>';
export const BULL_DEFAULTS = { board: 9, bull: 2.5, sweep: 1040, ramp: 1.12 };   // the board's radius and the bullseye's (field units), ms per sweep across, the speed-up per scoring throw
// Its settings (the admin's Mini-game Settings; core/tune.js) beyond config/bulls: the points, and the computer's rates at the start.
export const TUNE = [
  { k: 'goal', label: 'Points to win', def: 5, min: 3, max: 8, step: 1, group: 'Rules' },
  { k: 'bullPts', label: 'Bullseye points', def: 3, min: 2, max: 5, step: 1, group: 'Rules' },
  { k: 'aiBull', label: "Computer's bullseyes (%)", def: 15, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'aiBoard', label: "Computer's board hits, bullseyes included (%)", def: 60, min: 0, max: 100, step: 1, group: 'Computer' },
];
// The settings checked together (the admin's Save): a bullseye is a board hit, so never more bullseyes than board hits.
export const tuneCheck = v => (v.aiBull > v.aiBoard ? "Computer's bullseyes can't be more than its board hits (a bullseye counts as a board hit)." : null);
