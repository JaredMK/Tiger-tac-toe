// Flash: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Flash',        hint: 'Watch 8 items flash by, answer one question. Three right wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Flash', play: 'Cards flash by one at a time. Then say how many there were of a shape or a colour.', win: 'Get 3 right. It gets harder each time.' };
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6z"/></svg>';
export const FLASH_DEFAULTS = { n1: 6, n2: 7, n3: 8, ms1: 500, ms2: 500, ms3: 500 };
