// Roads: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Roads',        hint: 'Claim the edges of a honeycomb. The longest unbroken road wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const explainer = { name: 'Roads', play: 'Claim an edge of the honeycomb. A random edge gets blocked after each move.', win: 'Have the longest unbroken road.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V12h8V4h8"/><g fill="currentColor" stroke="none"><circle cx="4" cy="4" r="1.6"/><circle cx="20" cy="20" r="1.6"/><circle cx="12" cy="20" r="1.6"/><circle cx="20" cy="12" r="1.6"/></g></svg>';
// The honeycomb for new squares (the admin's config/roads): 'hex7', 7 hexagons (30 edges), or 'hex4', a smaller
// diamond of 4 (19 edges).
export const ROADS_DEFAULTS = { layout: 'hex7' };
