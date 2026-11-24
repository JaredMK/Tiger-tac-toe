// Mahjong: its names, its "?" explainer, its icon, its release default and its settings (December 2026: a mini
// hand-building Mahjong in place of the solitaire layouts).

export const info = { name: 'Mahjong', hint: 'Draw a tile, throw one. First to two sets and a pair wins' };
export const samePhone = false;   // never two people on one phone: each hand would be on show to the other (games/index.js NO_SAME_PHONE)
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.29.0';   // (1.29.0: the hand-building game); the oldest client version that has this game (core/client.js)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Mahjong', play: 'Take a tile from the wall{pileText}, then throw one away. A set is three of a kind, or three in a row in one suit.', win: 'Hold {setText} and a pair after you take a tile.' };
export const explainVars = v => {
  const hand = [4, 7, 10].includes(Number(v.hand)) ? Number(v.hand) : 7, m = (hand - 1) / 3;
  return { pileText: v.mode === 'race' ? '' : ' or the top of the discard pile', setText: m === 1 ? 'a set' : `${['', 'one', 'two', 'three'][m]} sets` };
};
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="6" height="14" rx="1.4"/><rect x="9" y="5" width="6" height="14" rx="1.4"/><rect x="15.5" y="5" width="6" height="14" rx="1.4"/><circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/></svg>';
// Its settings (the admin's Games page; core/tune.js): read with mjCfg(mini) (rules.js). A hand of 4 wins with a set and
// a pair, 7 with two sets and a pair, 10 with three. Tuned by tests/sim/mahjong.sim.js.
// The computer's levels (core/tune.js levelTune): its mistakes are careless throws (ai.js worse): Easy 50%, Normal 25%, Hard never.
export const AI_LEVELS = { miss: { easy: 50, normal: 25 } };
export const TUNE = [
  { k: 'mode', label: 'Mode', def: 'shared', opts: ['shared', 'race'], group: 'Rules' },
  { k: 'hand', label: 'Tiles in a hand', def: 7, opts: [4, 7, 10], group: 'Rules' },
  { k: 'suits', label: 'Suits', def: 3, min: 1, max: 3, step: 1, group: 'Board' },
  { k: 'nums', label: 'Numbers in a suit', def: 5, min: 3, max: 9, step: 1, group: 'Board' },
  { k: 'honours', label: 'Honour tiles (Sun, Moon, Cloud)', def: 'off', opts: ['on', 'off'], group: 'Board' },
];
// Its Game lineup card's back (ui/lineup.js; the admin's Lineup card overrides them, config/lineup/mahjong): what it is and how to win, where it sits from luck (1) to skill (5), and race (each their own) or shared (head-to-head).
export const lineupBlurb = 'Take a tile, throw one away. Build sets of three and a pair. Complete your hand first.';
export const luckSkill = 2;
export const format = 'shared';
