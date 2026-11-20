// Fruit Reels (the Slot Machine of the December 2026 batch: no gambling words in a game's name or text): its names, its
// "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Fruit Reels', hint: 'Spin three reels. Match fruit for points. First to 10 wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Fruit Reels', play: 'Spin the three reels, or hold one reel from your last spin and spin the other two. Two alike score {pair}. Three cherries {tri1}, lemons {tri2}, bells {tri3}.{starText}', win: 'First to {target} points.' };
export const explainVars = v => ({ starText: v.stars === 'on' ? ' Three stars win the square at once.' : ` Three stars ${v.tri4}.` });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M8.8 5v14M15.2 5v14"/><circle cx="5.7" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.3" cy="12" r="1.2"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the target, what each pattern scores, how often each picture
// comes up on a reel (its weight among the four), and whether three stars win the square outright.
export const TUNE = [
  { k: 'target', label: 'Points to take the square', def: 10, min: 5, max: 40, step: 1, group: 'Rules' },
  { k: 'stars', label: 'Three stars win the square at once', def: 'on', opts: ['on', 'off'], group: 'Rules' },
  { k: 'pair', label: 'Points: two alike', def: 2, min: 0, max: 10, step: 1, group: 'Rules' },
  { k: 'tri1', label: 'Points: three cherries', def: 4, min: 1, max: 30, step: 1, group: 'Rules' },
  { k: 'tri2', label: 'Points: three lemons', def: 5, min: 1, max: 30, step: 1, group: 'Rules' },
  { k: 'tri3', label: 'Points: three bells', def: 7, min: 1, max: 30, step: 1, group: 'Rules' },
  { k: 'tri4', label: 'Points: three stars (when they do not win outright)', def: 10, min: 1, max: 40, step: 1, group: 'Rules' },
  { k: 'w1', label: 'Reel weight: cherry', def: 4, min: 1, max: 10, step: 1, group: 'Board' },
  { k: 'w2', label: 'Reel weight: lemon', def: 3, min: 1, max: 10, step: 1, group: 'Board' },
  { k: 'w3', label: 'Reel weight: bell', def: 2, min: 1, max: 10, step: 1, group: 'Board' },
  { k: 'w4', label: 'Reel weight: star', def: 1, min: 0, max: 10, step: 1, group: 'Board' },
];
