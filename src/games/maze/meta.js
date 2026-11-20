// Maze Runner: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Maze Runner', hint: 'Dash through a hidden maze. A dead end ends your turn. First out wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Maze Runner', play: 'Pick a way and your runner dashes until the path forks or ends. The maze shows only where a runner has been. Keep going until a dead end stops you: that ends your turn.{boardText}', win: 'First to the flag wins.' };
export const explainVars = v => ({ boardText: v.boards === 'shared' ? ' One maze for both: what either finds, both see.' : ' A maze each, as long as the other.' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H9"/><path d="M3 8v13M8 3v9h5M13 16v5M18 8h-5M18 13v4"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the maze's size, the turns a maze should take a runner alone
// (the deal keeps drawing mazes until one is that long, on average, for a runner picking unexplored ways at random),
// and a maze each or one for both.
export const TUNE = [
  { k: 'size', label: 'Maze size (cells a side)', def: 6, min: 4, max: 7, step: 1, group: 'Board' },
  { k: 'turns', label: 'Target turns for a runner alone (a race ends sooner)', def: 6, min: 2, max: 8, step: 1, group: 'Board' },
  { k: 'boards', label: 'Mazes (separate: one each, equally long; shared: one for both)', def: 'separate', opts: ['separate', 'shared'], group: 'Rules' },
];
