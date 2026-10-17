// Pinball: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Pinball',      hint: 'Tap left or right to flip. Light every target first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const explainer = { name: 'Pinball', play: 'Tap left or right to flip. One ball per turn. Targets you hit stay lit.', win: 'Light every target first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3.5 18.5l6 2.5M20.5 18.5l-6 2.5"/><circle cx="13" cy="10" r="3" fill="currentColor"/><circle cx="6" cy="5" r="2" stroke-width="1.8"/><circle cx="18" cy="4.5" r="2" stroke-width="1.8"/></svg>';
export const PINB_DEFAULTS = { size: 1.7, save: 3, maxBall: 120, g: 1, bump: 1, spin: 1 };
