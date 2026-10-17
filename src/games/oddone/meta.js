// Odd One Out: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Odd One Out',  hint: 'Reveal, then tap the odd shade in 5 s. Three finds wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const explainer = { name: 'Odd One Out', play: "Tap Reveal to show the grid, then tap the tile that's a different shade within 5 seconds. No tap in time counts as a miss. It gets harder each time.", win: 'Find 3.' };
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" opacity=".45"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/></svg>';
export const ODD_DEFAULTS = { d1: 4, d2: 2.8, d3: 2 };                   // the difference at each level (ΔE 2000): noticeable, subtle, very subtle
