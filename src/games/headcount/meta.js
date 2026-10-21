// Headcount: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Headcount',    hint: 'Count the critters as they cross. Three right wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'own';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Headcount', play: 'Count the critters the question asks for as they cross. Ignore the others.', win: 'Get 3 right. It gets harder each time.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><ellipse cx="9" cy="13" rx="5" ry="4" fill="currentColor" fill-opacity=".35"/><circle cx="15.5" cy="13" r="2.3" fill="currentColor"/><path d="M6 9.5L4 7.5M9 9V7M12 9.5l1.5-2M6 16.5L4 18.5M9 17v2M12 16.5l1.5 2"/><path d="M19 5h3M20.5 3.5v3" stroke-width="1.8"/></svg>';
export const HEAD_DEFAULTS = { n1lo: 14, n1hi: 20, d1lo: 4, d1hi: 7, cross1: 1800, gap1: 430, n2lo: 18, n2hi: 25, d2lo: 7, d2hi: 11, cross2: 1800, gap2: 330, n3lo: 22, n3hi: 30, d3lo: 8, d3hi: 12, cross3: 2000, gap3: 300 };   // n: how many to count; d: decoys; cross: ms to cross the field (moving); gap: ms between starts, about
