// Flash: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Flash',        hint: 'Watch 8 items flash by, answer one question. Three right wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.0.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Flash', play: 'Cards flash by one at a time. Remember them and answer a question.', win: 'Get 3 right.' };
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6z"/></svg>';
export const FLASH_DEFAULTS = { n1: 6, n2: 7, n3: 8, ms1: 500, ms2: 500, ms3: 500 };
// Its settings (the admin's Mini-game Settings; core/tune.js) beyond config/flash: how often the computer gets a round right at each level.
export const TUNE = [
  { k: 'ai1', label: "Computer's right answers, level 1 (%)", def: 80, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'ai2', label: "Computer's right answers, level 2 (%)", def: 70, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'ai3', label: "Computer's right answers, level 3 (%)", def: 60, min: 0, max: 100, step: 1, group: 'Computer' },
];
export const realTime = true;   // its move plays back in real time (a run, a recording, a timed round): never sped up past the replay's own speed (core/timer.js moveRate)
