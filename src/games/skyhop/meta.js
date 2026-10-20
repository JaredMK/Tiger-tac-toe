// Sky Hop: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Sky Hop',      hint: 'Drag to steer as you bounce up. Reach the top first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'skill';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Sky Hop', play: 'Drag to steer as you bounce up. Fall and your turn ends, but you keep your height.', win: 'Reach the top first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="4.2" fill="currentColor" fill-opacity=".35"/><path d="M12 4.8c0-1.6 1-2.6 2.4-2.8"/><path d="M4 21h7M14 16h6"/><path d="M8 16.5l1.6-2M16 12.5l-1.4 1.6" stroke-width="1.8"/></svg>';
export const HOP_DEFAULTS = { target: 150, bounce: 22, gap0: 3, gap1: 4.5, wide0: 1.5, wide1: 1.1, moveAt: 10, move: 65, moveV: 2.2, breakAt: 8, brk0: 25, brk: 60, hazAt: 15, hazGap: 25, fill0: 0.4, fill1: 0.2 };
