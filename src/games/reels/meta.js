// Fruit Reels (the Slot Machine of the December 2026 batch: no gambling words in a game's name or text): its names, its
// "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Fruit Reels', hint: 'Spin the reels. Three alike on a line score. First to the target wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.29.0';   // (1.29.0: the 3x3 window and its five lines, no hold)   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Fruit Reels', play: 'Spin the reels: nine pictures, three by three. Five lines score: the three rows and the two diagonals. Three alike on a line: cherries {tri1}, lemons {tri2}, bells {tri3}.{starText}', win: 'First to {target} points.' };
export const explainVars = v => ({ starText: v.stars === 'on' ? ' Three stars on a line win the square at once.' : ` Three stars ${v.tri4}.` });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M8.8 5v14M15.2 5v14"/><circle cx="5.7" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.3" cy="12" r="1.2"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the target, what each pattern scores, how often each picture
// comes up on a reel (its weight among the four), and whether three stars win the square outright.
export const TUNE = [
  { k: 'target', label: 'Points to take the square', def: 10, min: 4, max: 60, step: 1, group: 'Rules' },
  { k: 'stars', label: 'Three stars on a line win the square at once', def: 'on', opts: ['on', 'off'], group: 'Rules' },
  { k: 'tri1', label: 'Points: three cherries on a line', def: 3, min: 1, max: 30, step: 1, group: 'Rules' },
  { k: 'tri2', label: 'Points: three lemons on a line', def: 4, min: 1, max: 30, step: 1, group: 'Rules' },
  { k: 'tri3', label: 'Points: three bells on a line', def: 6, min: 1, max: 30, step: 1, group: 'Rules' },
  { k: 'tri4', label: 'Points: three stars on a line (when they do not win outright)', def: 10, min: 1, max: 40, step: 1, group: 'Rules' },
  { k: 'w1', label: 'Reel weight: cherry', def: 4, min: 1, max: 10, step: 1, group: 'Board' },
  { k: 'w2', label: 'Reel weight: lemon', def: 3, min: 1, max: 10, step: 1, group: 'Board' },
  { k: 'w3', label: 'Reel weight: bell', def: 2, min: 1, max: 10, step: 1, group: 'Board' },
  { k: 'w4', label: 'Reel weight: star', def: 1, min: 0, max: 10, step: 1, group: 'Board' },
];
