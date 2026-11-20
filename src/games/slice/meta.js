// Fruit Slice: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Fruit Slice', hint: 'Swipe through the flying fruit. Dodge the bombs. First to 25 wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.25.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its move is a timed round (core/timer.js moveRate)
export const explainer = { name: 'Fruit Slice', play: 'A turn is one round of {secs} seconds. Swipe through the fruit as it flies: each one is a point. Slice a bomb and the round ends there and costs you {bombCost} points of it.', win: 'First to {target} points.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.500 13.500a7.500 7.500 0 0 0 15 0z"/><path d="M12 13.500V21"/><path d="M3 4l18 5"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the round's length, the target, how much fruit a round throws
// and how many bombs for it (a share of the fruit), how fast it flies (100: 1.9 s in the air), what a bomb costs, and
// the computer's hand: the share of the fruit it slices and of the bombs it strikes, by level.
export const TUNE = [
  { k: 'secs', label: 'Round length (s)', def: 10, min: 5, max: 20, step: 1, group: 'Rules' },
  { k: 'target', label: 'Points to take the square', def: 25, min: 8, max: 120, step: 1, group: 'Rules' },
  { k: 'fruits', label: 'Fruit thrown a round', def: 14, min: 6, max: 30, step: 1, group: 'Board' },
  { k: 'bombRate', label: 'Bombs (% of the fruit)', def: 30, min: 0, max: 60, step: 5, group: 'Board' },
  { k: 'bombCost', label: 'A bomb costs (points of the round)', def: 5, min: 0, max: 10, step: 1, group: 'Rules' },
  { k: 'speed', label: 'Fruit speed (%)', def: 100, min: 60, max: 180, step: 5, group: 'Timing' },
  { k: 'aiHit', label: 'Normal computer: fruit sliced (%)', def: 65, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'aiBomb', label: 'Normal computer: bombs struck (%)', def: 20, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'aiHitHard', label: 'Hard computer: fruit sliced (%)', def: 85, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'aiBombHard', label: 'Hard computer: bombs struck (%)', def: 8, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'aiHitEasy', label: 'Easy computer: fruit sliced (%)', def: 45, min: 0, max: 100, step: 1, group: 'Computer' },
  { k: 'aiBombEasy', label: 'Easy computer: bombs struck (%)', def: 28, min: 0, max: 100, step: 1, group: 'Computer' },
];
