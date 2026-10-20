// Clash Grid: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Clash Grid',   hint: 'Claim a cell. Same cell as your opponent: blocked. Four in a row wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const scOnly = true;       // made for simultaneous rounds: never dealt in a normal match
export const explainer = { name: 'Clash Grid', play: 'Claim a square. Pick the same square as your opponent in the same round and it\'s blocked for good.', win: 'Four in a row.' };
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1.2"/><rect x="9.25" y="9.25" width="5.5" height="5.5" rx="1.2"/><rect x="16" y="16" width="5.5" height="5.5" rx="1.2"/><rect x="16" y="2.5" width="5.5" height="5.5" rx="1.2" opacity=".35"/><rect x="2.5" y="16" width="5.5" height="5.5" rx="1.2" opacity=".35"/><path d="M15.2 3.5l5.3 5.3M20.5 3.5l-5.3 5.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
