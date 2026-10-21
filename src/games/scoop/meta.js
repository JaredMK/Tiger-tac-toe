// Scoop Stack: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Scoop Stack',  hint: 'Drag the cone to catch scoops. Stack to the target first' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'skill';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const target = 'course';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Scoop Stack', play: 'Drag the cone to catch scoops. Dodge the bad stuff. Your stack carries over between turns.', win: 'Stack to the target first.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><path d="M7.5 13.5h9L12 22.5z" fill="currentColor" fill-opacity=".35"/><circle cx="12" cy="10.5" r="3.6"/><circle cx="12" cy="4.6" r="2.8" fill="currentColor"/></svg>';
export const SCOOP_DEFAULTS = { target: 25, v0: 5, v1: 8.5, gap0: 0.9, gap1: 0.6, haz0: 18, haz1: 38, sway: 1, cone: 12 };
