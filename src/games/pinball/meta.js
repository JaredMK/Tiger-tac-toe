// Pinball: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Pinball',      hint: 'Tap left or right to flip. Light every target first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'skill';   // the game's kind, an icon in the Advanced checklist: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Pinball', play: 'Tap left or right to flip. One ball per turn. Targets you hit stay lit.', win: 'Light every target first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3.5 18.5l6 2.5M20.5 18.5l-6 2.5"/><circle cx="13" cy="10" r="3" fill="currentColor"/><circle cx="6" cy="5" r="2" stroke-width="1.8"/><circle cx="18" cy="4.5" r="2" stroke-width="1.8"/></svg>';
export const PINB_DEFAULTS = { size: 1.7, save: 3, maxBall: 120, g: 1, bump: 1, spin: 1 };
// Its settings (the admin's Mini-game Settings; core/tune.js; the table's own stay in PINB_DEFAULTS): the
// targets dealt (rules.js: pinDeal) and the computer's hand (finger.js: fingHand).
export const TUNE = [
  { k: 'targets', label: 'Targets to light', def: 7, min: 3, max: 7, step: 1, group: 'Rules' },
  { k: 'aiReact0', label: 'Computer reaction, fastest (ms)', def: 50, min: 0, max: 400, step: 5, group: 'Computer' },
  { k: 'aiReact1', label: 'Computer reaction, slowest (ms)', def: 90, min: 0, max: 400, step: 5, group: 'Computer' },
  { k: 'aiJitter', label: 'Computer flip timing error (ms)', def: 50, min: 0, max: 200, step: 5, group: 'Computer' },
];
