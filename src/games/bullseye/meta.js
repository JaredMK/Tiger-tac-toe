// Bullseye: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Bullseye',     hint: 'Flick to throw a dart. Bullseye 3, rings 2 and 1. First to 7' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.13.0';   // (1.13.0: the flick throw at a board on the wall, { aim, power }) the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Bullseye', play: 'Flick up to throw a dart: aim with the angle, throw higher with a faster flick. Bullseye is {bullPts}, the inner ring 2, the outer ring 1.', win: 'First to {goal}.' };   // ({bullPts}, {goal}: its settings, TUNE below)
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M12 2.8v3M12 18.2v3" stroke-linecap="round"/></svg>';
export const BULL_DEFAULTS = { board: 32, mid: 17.5, bull: 6.5 };   // the board's rings (config/bulls, the admin's card): the radii of the whole board, of its inner ring and of the bullseye, in wall units (the wall is 100 across)
// Its settings (the admin's Mini-game Settings; core/tune.js) beyond config/bulls: the points, the throw's scatter,
// the flick's feel (how fast a flick throws low and high, the angle's gain: rules.js bullsFlick), and the computer's aim.
export const TUNE = [
  { k: 'goal', label: 'Points to win', def: 7, min: 3, max: 12, step: 1, group: 'Rules' },
  { k: 'bullPts', label: 'Bullseye points', def: 3, min: 3, max: 5, step: 1, group: 'Rules' },
  { k: 'spread', label: 'Throw scatter (wall units)', def: 5, min: 0, max: 16, step: 0.25, group: 'Rules' },
  { k: 'flickMin', label: 'Flick speed for the lowest throw (px/ms)', def: 0.4, min: 0.1, max: 1.5, step: 0.05, group: 'Rules' },
  { k: 'flickMax', label: 'Flick speed for the highest throw (px/ms)', def: 1.7, min: 0.6, max: 4, step: 0.05, group: 'Rules' },
  { k: 'angleGain', label: 'Flick angle gain', def: 1, min: 0.5, max: 2, step: 0.05, group: 'Rules' },
  { k: 'aiErr', label: "Computer's aim error (wall units)", def: 19, min: 0, max: 45, step: 0.5, group: 'Computer' },
];
