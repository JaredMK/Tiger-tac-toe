// Race mode (November 2026; reworked the same month, `rv: 2`): a shared-information game (Five Letters, Hangman, Sea
// Battle, Codebreaker, Higher/Lower, Treasure Hunt, Sniff, Find the Pair, Trivia, Patterns) played as a solo race.
// Each player has a target of their own (their word, ship, code, number, treasure, card layout, questions), dealt to
// be as hard as the other's, hidden from both until it is found or the square ends (the game's `secret`/`hide`, as a
// Shared square's target is); everything else is open: each player's guesses and feedback (`mini.side[p]`, public),
// shown beside their own as a second, smaller board (ui/race.js). No move limits in a race: the first to solve wins.
// The mode is the game's admin setting (meta.js TUNE `mode`: 'shared' | 'race'), read when a square is dealt
// (`raceDealt`); two people on one phone always play Shared (the deal's `opts.shared`). Pure: no page, no clock.
// A race square from before the rework (no `rv`: one shared target, private parts) is dealt again as it is met
// (core/records.js fullState: `raceRedeal`); the old privacy paths stay for it until then.
import { rulesOf } from '../games/index.js';
import { tuneLive } from './tune.js';

export const RACE_TYPES = ['wordle', 'hangman', 'bs', 'mastermind', 'hilo', 'hunt', 'sniff', 'memory', 'trivia', 'patterns'];
export const RACE_V = 2;                                            // a race square's version (rv): each player their own hidden target, the rest open
export const MODE_TUNE = { k: 'mode', label: 'Mode (Shared: one board; Race: each their own target, no limits)', def: 'shared', opts: ['shared', 'race'], group: 'Rules' };   // (each race game's TUNE carries it)
// Dealt as a race: the game is one of them, its setting says so, and the deal allows it (opts.shared: two people on one phone).
export const raceDealt = (type, opts) => !(opts && opts.shared) && RACE_TYPES.includes(type) && tuneLive(type).mode === 'race';
export const isRace = mini => !!(mini && mini.race);
export const raceOld = mini => isRace(mini) && mini.rv !== RACE_V;   // a race square from before the rework (one target, private parts)
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
// p's own part of the square (their guesses and feedback), or null where this copy has not got it.
export const raceSide = (mini, p) => (mini && mini.side && mini.side[p]) || null;
// What anyone may see of p's progress: from their own part where this copy has it (the rules' raceShape), else the
// shape the record carries.
export function raceShape(mini, p) {
  if (!isRace(mini)) return null;
  if (mini.side && mini.side[p]) { const g = rulesOf(mini.type); return g.raceShape ? g.raceShape(mini, p) : {}; }
  return mini.shape && mini.shape[p] ? mini.shape[p] : null;
}
// Both sides' parts, for the record (null where a side has none yet).
export const raceSides = mini => (raceOld(mini) && mini.side ? { X: mini.side.X || null, O: mini.side.O || null } : null);   // (a reworked race keeps nothing apart but its targets: those are the game's secrets)
// Strip the private parts in place, leaving the shapes (the public state, a move's `after`).
export function raceHide(m) {
  if (!raceOld(m)) return;
  m.shape = { X: raceShape(m, 'X') || {}, O: raceShape(m, 'O') || {} };
  delete m.side;
}
// The square as one side may see it: both shapes, and that side's own part alone (none for no side: the board's miniature).
export function raceView(mini, forSide) {
  if (!raceOld(mini)) return mini;                                 // (a reworked race: everything in the square is open but the targets, which the public state never holds)
  const v = clone(mini), own = forSide ? raceSide(mini, forSide) : null;
  v.shape = { X: raceShape(mini, 'X') || {}, O: raceShape(mini, 'O') || {} };
  v.side = own ? { [forSide]: clone(own) } : {};
  return v;
}
// A move's flash as the other side may see it: the move itself (`m`), the mover's inputs (`rep`), the feedback and
// every game field go; `race` (the rules' raceFlash: the shape change, e.g. the new row's colours, "Hot") stays.
const FLASH_KEEP = new Set(['kind', 'by', 'next', 'square', 'type', 'pass', 'timeout', 'winner', 'counts', 'newType', 'drawn', 'seq', 'moves', 'after', 'before', 'race', 'recap', 'recapMore']);
export function raceFlashHide(f, mini) {
  if (!f || (mini && !raceOld(mini)) || f.race && Object.keys(f).every(k => FLASH_KEEP.has(k))) return f;   // (a reworked race: nothing in a move is private)
  const g = rulesOf(f.type), out = {};
  for (const k of Object.keys(f)) if (FLASH_KEEP.has(k)) out[k] = f[k];
  if (!out.race) out.race = g && g.raceFlash ? g.raceFlash(f, mini) || { by: f.by } : { by: f.by };
  return out;
}
