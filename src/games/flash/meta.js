// Flash: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Flash',        hint: 'Watch 8 items flash by, answer one question. Three right wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the game's kind, an icon in the Advanced checklist: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Flash', play: 'Cards flash by one at a time. Then say how many there were of a shape or a colour.', win: 'Get 3 right. It gets harder each time.' };
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6z"/></svg>';
export const FLASH_DEFAULTS = { n1: 6, n2: 7, n3: 8, ms1: 500, ms2: 500, ms3: 500 };
// Its settings (the admin's Mini-game Settings; core/tune.js) beyond config/flash: how often the computer gets a round right at each level.
export const TUNE = [
  { k: 'ai1', label: "Computer's right answers, level 1 (%)", def: 80, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'ai2', label: "Computer's right answers, level 2 (%)", def: 70, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'ai3', label: "Computer's right answers, level 3 (%)", def: 60, min: 0, max: 100, step: 1, group: 'Computer' },
];
