// Race mode (November 2026): a shared-information game (Five Letters, Hangman, Sea Battle, Codebreaker, Higher/Lower,
// Treasure Hunt, Sniff, Find the Pair, Trivia, Patterns) played as a solo race. Both players chase the same target,
// but each player's guesses and feedback are private (`mini.side[p]`: their own part of the square) and the other
// side sees only a shape of their progress (`raceShape`: rows of colours, counts, "Hot"...). Online, the record keeps
// each side's part apart (`core/records.js`: `sides.X`/`sides.O`, written by the server to games/{id}/sides/{side},
// readable by that side alone), the public state carries the shapes (`raceHide`), and a move's entry is redacted for
// the other phone (`raceFlashHide`: the move, its inputs and its feedback stripped, `f.race` the shape change alone).
// The mode is the game's admin setting (meta.js TUNE `mode`: 'shared' | 'race'), read when a square is dealt
// (`raceDealt`); two people on one phone always play Shared (the deal's `opts.shared`). Pure: no page, no clock.
import { rulesOf } from '../games/index.js';
import { tuneLive } from './tune.js';

export const RACE_TYPES = ['wordle', 'hangman', 'bs', 'mastermind', 'hilo', 'hunt', 'sniff', 'memory', 'trivia', 'patterns'];
export const MODE_TUNE = { k: 'mode', label: 'Mode (Shared: one board; Race: private guesses, same target)', def: 'shared', opts: ['shared', 'race'], group: 'Rules' };   // (each race game's TUNE carries it)
// Dealt as a race: the game is one of them, its setting says so, and the deal allows it (opts.shared: two people on one phone).
export const raceDealt = (type, opts) => !(opts && opts.shared) && RACE_TYPES.includes(type) && tuneLive(type).mode === 'race';
export const isRace = mini => !!(mini && mini.race);
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
export const raceSides = mini => (isRace(mini) && mini.side ? { X: mini.side.X || null, O: mini.side.O || null } : null);
// Strip the private parts in place, leaving the shapes (the public state, a move's `after`).
export function raceHide(m) {
  if (!isRace(m)) return;
  m.shape = { X: raceShape(m, 'X') || {}, O: raceShape(m, 'O') || {} };
  delete m.side;
}
// The square as one side may see it: both shapes, and that side's own part alone (none for no side: the board's miniature).
export function raceView(mini, forSide) {
  if (!isRace(mini)) return mini;
  const v = clone(mini), own = forSide ? raceSide(mini, forSide) : null;
  v.shape = { X: raceShape(mini, 'X') || {}, O: raceShape(mini, 'O') || {} };
  v.side = own ? { [forSide]: clone(own) } : {};
  return v;
}
// A move's flash as the other side may see it: the move itself (`m`), the mover's inputs (`rep`), the feedback and
// every game field go; `race` (the rules' raceFlash: the shape change, e.g. the new row's colours, "Hot") stays.
const FLASH_KEEP = new Set(['kind', 'by', 'next', 'square', 'type', 'pass', 'timeout', 'winner', 'counts', 'newType', 'drawn', 'seq', 'moves', 'after', 'before', 'race', 'recap', 'recapMore']);
export function raceFlashHide(f, mini) {
  if (!f || f.race && Object.keys(f).every(k => FLASH_KEEP.has(k))) return f;
  const g = rulesOf(f.type), out = {};
  for (const k of Object.keys(f)) if (FLASH_KEEP.has(k)) out[k] = f[k];
  if (!out.race) out.race = g && g.raceFlash ? g.raceFlash(f, mini) || { by: f.by } : { by: f.by };
  return out;
}
