// Risk Wheels: its names, its "?" explainer, its icon and its release default, and its default settings.
import { wheelsConfig } from './rules.js';

export const info = { name: 'Risk Wheels',  hint: 'Pick a wheel and spin. First to 18' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the game's kind, an icon in the Advanced checklist: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Risk Wheels', play: 'Pick a wheel and spin. Each square deals three new wheels of ten equal segments: purple has a 10 (or two) and mostly zeros, green always pays a little, blue sits between. The darker a segment, the more it pays.', get win() { return `Reach ${wheelsConfig().target} first.`; } };   // (the target is the admin's)
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="8.5"/><path d="M12 13.5V5M12 13.5l7.4 4.3M12 13.5l-7.4 4.3"/><path d="M12 13.5V5a8.5 8.5 0 0 1 7.4 12.8z" fill="currentColor" fill-opacity=".35"/><path d="M9.8 1.2h4.4L12 4.4z" fill="currentColor"/></svg>';
// Its settings besides those below (the admin's Mini-game Settings; core/tune.js): the computer's mistakes.
export const TUNE = [
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
export const WHEEL_DEFAULTS = { target: 18, tensMin: 1, tensMax: 2, smallMax: 2, smallTop: 2, midLo: 0, midHi: 8, lowLo: 1, lowHi: 4, gap: 0.4 };
