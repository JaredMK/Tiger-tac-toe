// Patterns: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Patterns',     hint: 'What comes next? Wrong picks get crossed out. Three right wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const target = 'shared';   // the header's icon: 'shared' (one board for both), 'own' (each player's own progress) or 'course' (one course for both, each their own distance)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Patterns', play: 'Pick what comes next, or what\'s missing. Wrong answers get crossed out and the puzzle stays until someone gets it.', win: 'Get {goal} right.' };   // ({goal}: its setting, TUNE below)
export const scExplainer = { name: 'Patterns', play: 'Pick what comes next, or what\'s missing. When the round ends, wrong answers are crossed out for both, and a new puzzle comes if anyone got it.', win: 'Get {goal} right.' };   // in Super Chaos
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="3.8" cy="14" r="1.7" fill="currentColor" stroke="none"/><circle cx="9.4" cy="14" r="2.8" fill="currentColor" stroke="none"/><rect x="14.5" y="7.5" width="8" height="12" rx="2" stroke-dasharray="2.4 1.9"/><path d="M17 11.6a1.6 1.6 0 1 1 2.3 1.4c-.6.3-.8.7-.8 1.2"/><circle cx="18.5" cy="16.7" r=".5" fill="currentColor"/></svg>';
// Its settings (the admin's Mini-game Settings; core/tune.js). The kinds: each one's share of the puzzles dealt.
export const TUNE = [
  { k: 'goal', label: 'Right answers to win', def: 3, min: 2, max: 5, step: 1, group: 'Rules' },
  { k: 'num', label: 'Number puzzles (share)', def: 40, min: 0, max: 100, step: 1, group: 'Rules' },
  { k: 'shape', label: 'Shape puzzles (share)', def: 38, min: 0, max: 100, step: 1, group: 'Rules' },
  { k: 'dots', label: 'Dot puzzles (share)', def: 22, min: 0, max: 100, step: 1, group: 'Rules' },
  { k: 'mid', label: 'Gap in the middle (%)', def: 25, min: 0, max: 100, step: 5, group: 'Rules' },
  { k: 'right', label: 'Computer right (%)', def: 60, min: 0, max: 100, step: 5, group: 'Computer' },
];
