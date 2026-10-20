// Patterns: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Patterns',     hint: 'What comes next? Wrong picks get crossed out. Three right wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the Advanced checklist's group: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Patterns', play: 'Pick what comes next, or what\'s missing. Wrong answers get crossed out and the puzzle stays until someone gets it.', win: 'Get 3 right.' };
export const scExplainer = { name: 'Patterns', play: 'Pick what comes next, or what\'s missing. When the round ends, wrong answers are crossed out for both, and a new puzzle comes if anyone got it.', win: 'Get 3 right.' };   // in Super Chaos
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="3.8" cy="14" r="1.7" fill="currentColor" stroke="none"/><circle cx="9.4" cy="14" r="2.8" fill="currentColor" stroke="none"/><rect x="14.5" y="7.5" width="8" height="12" rx="2" stroke-dasharray="2.4 1.9"/><path d="M17 11.6a1.6 1.6 0 1 1 2.3 1.4c-.6.3-.8.7-.8 1.2"/><circle cx="18.5" cy="16.7" r=".5" fill="currentColor"/></svg>';
