// Maze Runner: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Maze Runner', hint: 'Dash through a hidden maze. A dead end ends your turn. First out wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.34.0';   // (1.34.0: energy, the squares a turn may run, `cap`/`en`, end 'tired'; 1.32.0: the win reveals the whole maze, last.rev; 1.27.0 before) the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Maze Runner', play: 'Pick a way and your runner dashes until the path forks or ends. The maze shows only where a runner has been. Keep going until a dead end stops you: that ends your turn.{energyText}{boardText}', win: 'First to the flag wins.' };
export const explainVars = v => ({ energyText: Number(v.energy) > 0 ? ` Each turn your runner has energy for ${Math.round(v.energy)} squares: when it runs out, the runner stops where it is and your turn ends.` : '', boardText: v.boards === 'one' ? ' One runner for both: you take turns moving it, and whoever gets it to the flag wins.' : v.boards === 'shared' ? ' One maze for both: what either finds, both see.' : ' A maze each, as long as the other.' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H9"/><path d="M3 8v13M8 3v9h5M13 16v5M18 8h-5M18 13v4"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the maze's width and height (cells), its branching (the share of
// the maze grown from random cells: more branches and dead ends; the rest grows newest-first, longer corridors), the
// shortest the path from the door to the flag may be (cells), the turns a maze should take a runner alone (the deal
// keeps drawing mazes until one is that long, on average, for a runner picking unexplored ways at random), and the
// energy (the squares a runner may run in one turn: it stops where the energy runs out; 0 no limit), and the boards: a maze each, one maze with a runner each, or one maze and one runner both players move.
export const TUNE = [
  { k: 'cols', label: 'Maze width (cells)', def: 8, min: 4, max: 12, step: 1, group: 'Board' },
  { k: 'rows', label: 'Maze height (cells)', def: 10, min: 4, max: 14, step: 1, group: 'Board' },
  { k: 'branch', label: 'Branching (% grown from random cells: more branches and dead ends)', def: 60, min: 0, max: 100, step: 5, group: 'Board' },
  { k: 'minPath', label: 'Shortest path from the door to the flag (cells)', def: 22, min: 4, max: 120, step: 1, group: 'Board' },
  { k: 'turns', label: 'Target turns for a runner alone (a race ends sooner)', def: 8, min: 2, max: 20, step: 1, group: 'Board' },
  { k: 'energy', label: 'Squares per turn (energy: the runner stops where it runs out; 0: no limit)', def: 10, min: 0, max: 40, step: 1, group: 'Rules' },
  { k: 'boards', label: 'Mazes (separate: one each, equally long; shared: one for both, a runner each; one: one runner both players move)', def: 'separate', opts: ['separate', 'shared', 'one'], group: 'Rules' },
  { k: 'aiStrayEasy', label: 'Easy: picks any way at all, even a dead end it knows (%; it also ignores how far a turn can run)', def: 30, min: 0, max: 100, step: 5, group: 'Computer: Easy' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/maze): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Pick a way and your runner dashes to the next fork. A dead end ends your turn. First to the flag wins.';
export const luckSkill = 2;
export const format = 'race';
