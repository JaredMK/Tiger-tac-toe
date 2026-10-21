// The mini-games through the registry: a new square (newMini), a move (applyMove), the public view, a
// random legal move; each game's own rules do the work (src/games/<game>/rules.js).
import { needRng, randInt } from './random.js';
import { BS } from '../games/bs/rules.js';
import { BULL_DEFAULTS } from '../games/bullseye/meta.js';
import { BULLS } from '../games/bullseye/rules.js';
import { C4 } from '../games/c4/rules.js';
import { hpMoves } from '../games/hexapawn/rules.js';
import { PLINKO_DEFAULTS } from '../games/plinko/meta.js';
import { PLINKO } from '../games/plinko/rules.js';
import { WHEEL_DEFAULTS } from '../games/wheels/meta.js';
import { WHEELS, WHEEL_SEGS } from '../games/wheels/rules.js';
import { rulesOf } from '../games/index.js';
import { tuneSnap } from './tune.js';

// Does p have a legal move in this mini-game? Only Hexapawn can leave a player stuck; every other game
// always offers a move. A stuck player simply plays in another square.
export function canMove(mini, p) { return mini.type === 'hexapawn' ? hpMoves(mini.cells, p).length > 0 : mini.type === 'trivia' ? !!(mini.ask && (mini.ask.q || mini.ask.down)) : mini.type === 'patterns' ? !!mini.puz : mini.type === 'golf' ? !mini.holed[p] : true; }   // (Trivia: only with its question dealt)
// Saved games and rooms from before Connect 4 grew to 7 columns: the old 5-wide board gets an empty
// column on each side, so every piece keeps its place (and its support) in the middle five.
export function upgradeMini(mini) {
  // Risk Wheels from when each wheel had two segments sized to their chances: ten equal segments, the first value on its share (to the nearest tenth).
  if (mini && mini.type === 'wheels' && !mini.wheels && mini.cfg) {
    const c = mini.cfg; mini.target = c.target || WHEEL_DEFAULTS.target; mini.wheels = {};
    for (const w of WHEELS) { const x = c[w] || { a: 0, pa: 50, b: 0 }, n = Math.max(1, Math.min(9, Math.round(x.pa / 10))); mini.wheels[w] = Array.from({ length: WHEEL_SEGS }, (_, k) => (k < n ? x.a : x.b)); }
    delete mini.cfg;
  }
  // Craps from when a move was a whole round: no round under way.
  if (mini && mini.type === 'craps') { if (mini.point === undefined) mini.point = null; if (mini.live === undefined) mini.live = null; if (!Array.isArray(mini.rolls)) mini.rolls = []; }
  // Plinko from when one bin was the WIN bin: that bin is worth 5, the rest 3, 3, 2, 2, 1, 1 in order; points from 0.
  if (mini && mini.type === 'plinko' && !Array.isArray(mini.vals)) {
    const w = Number.isInteger(mini.win) ? mini.win : 3, rest = [3, 3, 2, 2, 1, 1];
    mini.vals = Array.from({ length: PLINKO.slots }, (_, b) => (b === w ? 5 : rest.shift()));
    mini.pts = { X: 0, O: 0 }; mini.used = new Array(PLINKO.slots).fill(false); mini.bonus = { x: Math.min(11, w * 2 + 1), r: 4 }; mini.target = PLINKO_DEFAULTS.target; mini.last = null;
    delete mini.win;
  }
  if (mini && mini.type === 'plinko') { if (!Array.isArray(mini.used)) mini.used = Array.from({ length: PLINKO.slots }, (_, k) => !!(mini.used && mini.used[k])); if (!mini.pts) mini.pts = { X: 0, O: 0 }; mini.pts.X = mini.pts.X || 0; mini.pts.O = mini.pts.O || 0; }
  // Trivia from when each player had their own question: the square keeps one of them (X's, else O's).
  if (mini && mini.type === 'trivia' && mini.ask && typeof mini.ask === 'object' && !('q' in mini.ask) && ('X' in mini.ask || 'O' in mini.ask)) {
    const p = mini.ask.X ? 'X' : mini.ask.O ? 'O' : null, ans = mini.answers || {};
    mini.ask = p ? mini.ask[p] : null;
    mini.answer = p && Number.isInteger(ans[p]) ? ans[p] : null;
    mini.crossed = [];
    delete mini.answers;
  }
  if (mini && mini.type === 'trivia' && !Array.isArray(mini.crossed)) mini.crossed = [];
  if (mini && mini.type === 'trivia' && typeof mini.shown !== 'boolean') mini.shown = !!mini.ask;   // (a square from before the reveal: its question was always on show)
  // Bullseye from the bar and its three hits: the hits become points, on a board in the middle of the field.
  if (mini && mini.type === 'bullseye' && !mini.pts) {
    mini.pts = { X: (mini.hits && mini.hits.X) || 0, O: (mini.hits && mini.hits.O) || 0 };
    mini.cfg = Object.assign({}, BULL_DEFAULTS); mini.pos = [BULLS.w / 2, BULLS.h / 2];
    if (!mini.speed) mini.speed = { X: 1, O: 1 };
    delete mini.hits; mini.last = null;
  }
  if (mini && mini.type === 'c4' && Array.isArray(mini.cells) && mini.cells.length === 5 * C4.rows && C4.cols === 7) {
    const at = k => Math.floor(k / 5) * 7 + (k % 5) + 1;
    const cells = new Array(C4.cols * C4.rows).fill(null);
    mini.cells.forEach((c, k) => { cells[at(k)] = c; });
    mini.cells = cells;
    if (Number.isInteger(mini.last)) mini.last = at(mini.last);
    if (Array.isArray(mini.winCells)) mini.winCells = mini.winCells.map(at);
  }
  // ...and from before Battleship grew to 4x4 with ships of 1 to 4 cells: the old 3x3 sea sits in the
  // top-left corner and its one-cell ship becomes a Patrol Boat.
  if (mini && mini.type === 'bs' && Array.isArray(mini.revealed) && mini.revealed.length === 9) {
    const at = k => Math.floor(k / 3) * BS.n + (k % 3);
    const revealed = new Array(BS.n * BS.n).fill(null);
    mini.revealed.forEach((c, k) => { revealed[at(k)] = c; });
    mini.revealed = revealed; mini.len = 1;
    if (Number.isInteger(mini.hidden)) { mini.ship = [at(mini.hidden)]; delete mini.hidden; }
    mini.hits = mini.ship && revealed[mini.ship[0]] ? mini.ship.slice() : [];
    if (Number.isInteger(mini.last)) mini.last = at(mini.last);
    if (Array.isArray(mini.winCells)) mini.winCells = mini.winCells.map(at);
  }
  if (mini && mini.type === 'bs' && !Array.isArray(mini.hits)) mini.hits = [];   // an empty list does not survive the database
  return mini;
}
export function anyMove(state, p) { return state.squares.some(s => !s.owner && canMove(s.mini, p)); }

// A square keeps the settings it was dealt with (core/tune.js): only those that differ from the defaults.
export function withTune(mini) { const s = mini && tuneSnap(mini.type); if (s) mini.tune = s; return mini; }
export function newMini(type, rng) {
  const game = rulesOf(type);
  if (game.create) return withTune(game.create(type, rng));
  throw new Error('unknown mini-game: ' + type);
}

// One move by player p in a mini-game. Mutates mini.
// Returns { ok:false, reason } or { ok:true, outcome:'win'|'draw'|'continue', cells?, note?, again? }.
// again = the same player moves again at once (Hangman after a correct letter).
export function applyMove(mini, p, m, rng) {
  const idx = (max) => Number.isInteger(m) && m >= 0 && m < max;
  const game = rulesOf(mini.type);
  if (game.apply) return game.apply(mini, p, m, rng, idx);
  return { ok: false, reason: 'bad' };
}

// What a player can see of a mini-game. Hidden information is left out, not blanked.
export function publicMini(mini) {
  const game = rulesOf(mini.type);
  if (game.publicView) { const v = game.publicView(mini); if (mini.tune && v && typeof v === 'object' && !v.tune) v.tune = mini.tune; return v; }   // (its settings: never secret)
  throw new Error('unknown mini-game: ' + mini.type);
}
export function randomLegalMove(mini, p, rng) {
  rng = needRng(rng);
  const from = a => a[randInt(rng, a.length)];
  const empties = (arr, ok) => arr.map((c, k) => (ok(c) ? k : -1)).filter(k => k >= 0);
  const game = rulesOf(mini.type);
  if (game.randomMove) return game.randomMove(mini, p, rng, from, empties);
  return null;
}
