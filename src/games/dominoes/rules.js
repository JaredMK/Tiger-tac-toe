// Dominoes: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, shuffle } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';

// Dominoes: a double-six set (28 tiles; TUNE `pips` picks a double-four or double-five set) dealt per square: each
// player a hand of `hand` tiles, the rest the boneyard (`pile`, drawn from its end). A move places one tile from the
// hand on either end of the line (the first tile starts it; `e`: 'L' or 'R'), or, with nothing that fits, draws from the
// boneyard until a tile fits (one move, `drew` tiles; then `again`: the turn goes on and a tile is placed; a timeout
// there ends the turn, nothing placed) or the boneyard runs out (the turn ends, a pass), or, with the boneyard empty
// already, passes. The line's opener draws one tile with their first move where the square says so (openDraw: the
// second mover's tempo back; TUNE). The first hand emptied wins the square ('out'); the game blocked (neither can play,
// the boneyard empty) goes to the fewer pips in hand ('blocked'); equal pips are a draw (the square resets, note 'tie').
// The line is kept as placed: line[k] = [a, b, by], a the value facing the left end, b the right, by who laid it; `left`
// counts the tiles placed on the left end (the view's snake keeps the first tile in place and grows both ways from it).
// Hands: HANDS_PUBLIC says whether both hands ride in the public view (the state both phones hold) or stay with the
// boneyard in the secrets (the server's `sec`). They ride in it for now (November 2026): the engine has no channel that
// hands one side its own secret (core/records.js splits a record into what both phones see and what the server alone
// keeps; the computer, too, decides from publicMini), so a hand kept in `sec` would never reach its owner's phone. The
// views draw only the viewer's own hand face up and the computer plays from its own hand alone (ai.js); once a per-side
// channel exists (`sideView` below is what it would send), HANDS_PUBLIC goes false and nothing else changes.
export const HANDS_PUBLIC = true;
export const DOM = { pips: 6, hand: 3 };   // the defaults (TUNE in meta.js: the deal reads tuneLive)
export const DOMT = { slide: 420, land: 160, hold: 520, draw: 520, pass: 420, count: 700 };   // the view's timings (ms into the move): a tile's slide to its end and landing, the result's hold; a draw's slide; the pips counted up on a blocked end
// The set: tile k is [a, b] with a <= b, in order (0-0, 0-1, 1-1, 0-2, 1-2, 2-2, ...).
const SETS = {};
export function domSet(pips) {
  if (!SETS[pips]) { const out = []; for (let b = 0; b <= pips; b++) for (let a = 0; a <= b; a++) out.push([a, b]); SETS[pips] = out; }
  return SETS[pips];
}
export const domTile = (mini, k) => domSet(domPips(mini))[k];
export const domPips = mini => (mini && Number.isInteger(mini.pips) ? mini.pips : DOM.pips);
export const domTileCount = pips => (pips + 1) * (pips + 2) / 2;
export const isDouble = t => t[0] === t[1];
export const tilePips = t => t[0] + t[1];
// The boneyard's size, from the full square (pile: the tiles) or the public one (pileN: their count).
export const domPile = mini => (Array.isArray(mini.pile) ? mini.pile.length : Number.isInteger(mini.pileN) ? mini.pileN : 0);
// Each player's tiles in hand (the count rides the public view as n; the hand itself where it is there).
export const domCount = (mini, p) => (mini.hands && Array.isArray(mini.hands[p]) ? mini.hands[p].length : mini.n && Number.isInteger(mini.n[p]) ? mini.n[p] : 0);
export const domHand = (mini, p) => (mini.hands && Array.isArray(mini.hands[p]) ? mini.hands[p] : null);
// The line's two ends: the values a tile must match ([left, right]), or null before the first tile.
export const domEnds = mini => (mini.line.length ? [mini.line[0][0], mini.line[mini.line.length - 1][1]] : null);
// Where a tile (its id) may go: 'L', 'R', both, or none; every end before the first tile.
export function domFits(mini, k) {
  const t = domTile(mini, k), ends = domEnds(mini);
  if (!ends) return ['L', 'R'];
  const out = [];
  if (t[0] === ends[0] || t[1] === ends[0]) out.push('L');
  if (t[0] === ends[1] || t[1] === ends[1]) out.push('R');
  return out;
}
// Every placement open to p: [{ t, e }] (an empty list: a draw, or a pass).
export function domMoves(mini, p) {
  const hand = domHand(mini, p) || [], out = [];
  for (const k of hand) for (const e of domFits(mini, k)) out.push({ t: k, e });
  return out;
}
export const domCanPlay = (mini, p) => (domHand(mini, p) || []).some(k => domFits(mini, k).length > 0);
export const handPips = (mini, p) => (domHand(mini, p) || []).reduce((s, k) => s + tilePips(domTile(mini, k)), 0);
export function create(type, rng) {
  const c = tuneLive(type), pips = c.pips, n = domTileCount(pips);
  const ids = shuffle(Array.from({ length: n }, (_, k) => k), needRng(rng));
  const each = Math.max(1, Math.min(c.hand, Math.floor((n - 1) / 2)));   // (a boneyard of at least one tile)
  const hands = { X: ids.splice(0, each).sort((a, b) => a - b), O: ids.splice(0, each).sort((a, b) => a - b) };
  return Object.assign({ type, pips, line: [], left: 0, hands, pile: ids, played: { X: 0, O: 0 }, last: null }, c.openDraw ? { openDraw: 1 } : {});
}
// A placement as the move names it: a tile id and an end, or a plain id where one end alone fits (or the first tile).
function parseMove(mini, m) {
  if (m && typeof m === 'object' && !Array.isArray(m)) {
    const t = m.t, e = m.e;
    if (!Number.isInteger(t) || t < 0 || t >= domTileCount(domPips(mini))) return null;
    if (e !== undefined && e !== 'L' && e !== 'R') return null;
    return { t, e };
  }
  if (Number.isInteger(m) && m >= 0 && m < domTileCount(domPips(mini))) return { t: m };
  return null;
}
export function apply(mini, p, m, rng, idx) {
  const hand = domHand(mini, p);
  if (!hand) return { ok: false, reason: 'bad' };
  const pileN = domPile(mini);
  if (m === 'draw' || m === 'pass') {
    if (domCanPlay(mini, p)) return { ok: false, reason: 'canplay' };          // (a tile fits: it must be played)
    if (m === 'draw') {
      if (!Array.isArray(mini.pile) || !mini.pile.length) return { ok: false, reason: 'empty' };
      const drew = [];
      let fits = false;
      while (mini.pile.length && !fits) { const k = mini.pile.pop(); drew.push(k); hand.push(k); fits = domFits(mini, k).length > 0; }   // tiles come one by one until one fits, or the boneyard is empty
      hand.sort((a, b) => a - b);
      mini.last = { by: p, kind: 'draw', drew: drew.length, fits, left: hand.length, pile: mini.pile.length };
      const end = blocked(mini, p);
      if (end) return end;
      return fits ? { ok: true, outcome: 'continue', note: 'draw', again: true } : { ok: true, outcome: 'continue', note: 'pass' };   // a tile fits: the turn goes on and it is played; the boneyard ran out first: the turn ends as a pass
    }
    if (pileN > 0) return { ok: false, reason: 'draw' };                        // (tiles in the boneyard: a draw, not a pass)
    mini.last = { by: p, kind: 'pass', left: hand.length, pile: 0 };
    return blocked(mini, p) || { ok: true, outcome: 'continue', note: 'pass' };
  }
  const mv = parseMove(mini, m);
  if (!mv) return { ok: false, reason: 'bad' };
  const at = hand.indexOf(mv.t);
  if (at < 0) return { ok: false, reason: 'nothand' };
  const fits = domFits(mini, mv.t);
  if (!fits.length) return { ok: false, reason: 'nofit' };
  const t = domTile(mini, mv.t), ends = domEnds(mini);
  let e = mv.e;
  if (!ends) e = 'R';                                                          // the first tile starts the line
  else if (!e) { if (fits.length === 1 || ends[0] === ends[1]) e = fits.includes('R') ? 'R' : 'L'; else return { ok: false, reason: 'end' }; }   // (both ends fit and differ: the move names one)
  if (!fits.includes(e)) return { ok: false, reason: 'nofit' };
  let placed;
  if (!ends) placed = [t[0], t[1]];
  else if (e === 'L') placed = t[1] === ends[0] ? [t[0], t[1]] : [t[1], t[0]];   // the value facing the line's left end on the right of the new tile
  else placed = t[0] === ends[1] ? [t[0], t[1]] : [t[1], t[0]];
  hand.splice(at, 1);
  const entry = [placed[0], placed[1], p];                                     // (the third value: who laid it, for the dot on its divider)
  if (e === 'L' && ends) { mini.line.unshift(entry); mini.left = (mini.left || 0) + 1; } else mini.line.push(entry);
  mini.played[p] = (mini.played[p] || 0) + 1;
  const pos = e === 'L' && ends ? 0 : mini.line.length - 1;
  mini.last = { by: p, kind: 'play', t: mv.t, tile: placed, e: ends ? e : 'R', pos: pos - (mini.left || 0), left: hand.length, pile: pileN };   // pos: the tile's slot from the first tile (negative: to its left)
  if (!ends && mini.openDraw && Array.isArray(mini.pile) && mini.pile.length) {   // the line's opener takes a tile from the boneyard with their first move (the second mover's tempo: TUNE openDraw)
    const k = mini.pile.pop(); hand.push(k); hand.sort((a, b) => a - b);
    mini.last.open = true; mini.last.left = hand.length; mini.last.pile = mini.pile.length;
  }
  if (!hand.length) return { ok: true, outcome: 'win', note: 'out' };
  return blocked(mini, p) || { ok: true, outcome: 'continue', note: 'play' };
}
// The game blocked: the boneyard empty and neither side able to play. Fewer pips in hand takes the square; level, a draw.
function blocked(mini, p) {
  if (domPile(mini) > 0 || domCanPlay(mini, 'X') || domCanPlay(mini, 'O')) return null;
  const pips = { X: handPips(mini, 'X'), O: handPips(mini, 'O') };
  mini.last = Object.assign(mini.last || { by: p }, { blocked: true, pips });
  if (pips.X === pips.O) return { ok: true, outcome: 'draw', note: 'tie' };
  const w = pips.X < pips.O ? 'X' : 'O';
  return { ok: true, outcome: 'win', winner: w, note: 'blocked' };
}
export function publicView(mini) {
  const v = { type: 'dominoes', pips: domPips(mini), openDraw: mini.openDraw ? 1 : 0, line: mini.line.map(t => t.slice()), left: mini.left || 0, n: { X: domCount(mini, 'X'), O: domCount(mini, 'O') }, pileN: domPile(mini), played: { X: (mini.played && mini.played.X) || 0, O: (mini.played && mini.played.O) || 0 }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
  if (HANDS_PUBLIC && mini.hands) v.hands = { X: (mini.hands.X || []).slice(), O: (mini.hands.O || []).slice() };
  return v;
}
// One side's own secret (its hand), for a per-side channel when the engine has one (see HANDS_PUBLIC).
export function sideView(mini, side) {
  return { hand: (domHand(mini, side) || []).slice() };
}
export function randomMove(mini, p, rng, from, empties) {
  const moves = domMoves(mini, p);
  if (moves.length) return from(moves);
  return domPile(mini) > 0 ? 'draw' : 'pass';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.dom = l ? JSON.parse(JSON.stringify(l)) : { by: p, kind: 'play' };
  return;
}
export function secret(mini) {
  const s = { pile: Array.isArray(mini.pile) ? mini.pile.slice() : [] };
  if (!HANDS_PUBLIC && mini.hands) s.hands = { X: (mini.hands.X || []).slice(), O: (mini.hands.O || []).slice() };
  return s;
}
export function hide(m, k, st) {
  if (Array.isArray(m.pile)) m.pileN = m.pile.length;
  delete m.pile;
  if (!HANDS_PUBLIC && m.hands) { m.n = { X: domCount(m, 'X'), O: domCount(m, 'O') }; delete m.hands; } else if (m.hands && !m.n) m.n = { X: domCount(m, 'X'), O: domCount(m, 'O') };
  return;
}
// How long a move's animation runs: the tile slides to its end and lands, then its result holds; a draw's tile slides
// from the boneyard; a pass knocks; a blocked end counts both hands' pips up before the result.
export function flashMs(f, winLen, won) {
  const d = f.dom || {}, T = DOMT;
  let ms = d.kind === 'draw' ? T.draw + 300 : d.kind === 'pass' ? T.pass + 300 : T.slide + T.land + T.hold;
  if (d.blocked) ms += T.count + 500;
  if (won && !d.blocked) ms += 500;
  return ms;
}
// The moments of a move (ms into it) the view and the sounds share.
export function domTimes(d) {
  const T = DOMT;
  if (d.kind === 'draw') return { land: T.draw, count: T.draw, end: T.draw + 300 };
  if (d.kind === 'pass') return { land: 0, count: 0, end: T.pass + 300 };
  const land = T.slide + T.land;
  return { land, count: land, pips: d.blocked ? land + T.hold : null, end: land + T.hold + (d.blocked ? T.count + 500 : 0) };
}
