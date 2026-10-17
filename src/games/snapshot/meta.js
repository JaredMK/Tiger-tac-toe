// Snapshot: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Snapshot',     hint: 'Memorise the pattern, tap it back. Three right wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Snapshot', play: 'Memorise the pattern in 5 seconds. Wait out the countdown, then tap it back in and Submit.', win: 'Get 3 right. The grid gets bigger each time.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/><rect x="9" y="3" width="6" height="6" fill="currentColor"/><rect x="3" y="15" width="6" height="6" fill="currentColor"/><rect x="15" y="9" width="6" height="6" fill="currentColor"/></svg>';

// Snapshot: a grid with some cells filled, shown for 5 seconds, then the grid blank with a 5-second
// countdown, then the player taps the cells back in and Submits: an exact match counts. Level 1: 4
// across by 5 down with 7; level 2: 5x5 with 9; level 3: 5 across by 6 down with 11. Never a trivial
// pattern: no full row or column, no solid block, no straight run of 4, nothing symmetric.
export const SNAP_DEFAULTS = { c1: 4, r1: 5, k1: 7, c2: 5, r2: 5, k2: 9, c3: 5, r3: 6, k3: 11, show: 5000, wait: 5000 };
