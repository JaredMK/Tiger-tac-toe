// Mystery Face: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Mystery Face', hint: 'Guess a face and see which of its features match. First to find theirs wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.24.0';   // the oldest client version that has this game (core/client.js)
export const category = 'brain';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Mystery Face', play: 'Tap a face to guess it. {clueText} Use the clues to narrow it down.{boardText}', win: 'First to guess their mystery face wins.' };
const CLUE = { which: 'Each of its features gets a tick if the mystery face has the same one, a cross if not.', one: 'You are shown one feature it shares with the mystery face, or that it shares none.', count: 'You are told how many of its features the mystery face shares.' };
export const explainVars = v => ({ clueText: CLUE[v.clue] || CLUE.which, boardText: v.boards === 'shared' ? ' One mystery face for both: every clue shows for both.' : ' You each have your own mystery face.' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M5 9c2-5 12-5 14 0"/><path d="M10.200 16.500c.300-1.600 2.700-2.400 2.800-4 .100-1.800-2.500-2.200-3-.500"/><path d="M12 19.200v.100" stroke-width="2.800"/></svg>';
// Its settings (the admin's Games page; core/tune.js): how many faces are on the board, how many features tell them
// apart, how many kinds each feature comes in, and a mystery face each or one for both.
export const TUNE = [
  { k: 'faces', label: 'Faces on the board', def: 16, min: 9, max: 20, step: 1, group: 'Board' },
  { k: 'traits', label: 'Features (hat, eyes, mouth, colour, collar)', def: 5, min: 3, max: 5, step: 1, group: 'Board' },
  { k: 'vals', label: 'Kinds of each feature', def: 3, min: 2, max: 4, step: 1, group: 'Board' },
  { k: 'clue', label: 'Clue (which: a tick or cross on each feature; one: one feature in common; count: how many match)', def: 'which', opts: ['which', 'one', 'count'], group: 'Rules' },
  { k: 'boards', label: 'Mystery faces (separate: one each; shared: one for both)', def: 'separate', opts: ['separate', 'shared'], group: 'Rules' },
];
