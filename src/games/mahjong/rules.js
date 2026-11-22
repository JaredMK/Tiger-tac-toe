// Mahjong: the rules (pure: no page, no clock; the server runs the same code).
// A mini hand-building Mahjong (December 2026, v 2; the solitaire layouts before it are dealt again: `stale`). An
// original tile set: `suits` suits (Dots, Bars, Stars) of the numbers 1 to `nums`, and with `honours` on three honour
// tiles (Sun, Moon, Cloud), four of each tile. A tile is a code: its suit's letter and its number ('d3', 'b5', 's1'), an
// honour 'h' and 1 to 3. Each player holds `hand` (7) tiles, theirs alone: online the hand rides the per-side channel
// (sidePart/sideMerge, games/{id}/sides/{side}), never the public state, an entry or the other phone; the computer reads
// only its own (publicView with its side). A move is two steps:
//  - Take: the top of the wall ('wall', the taker's alone) or, in Shared, the top of the discard pile ('pile': on show,
//    so public). The turn is held to the square for the second step (`again`: the game's own step). With the tile taken
//    the hand holds `hand` + 1 tiles: complete, it wins the square at once (`note` 'mahjong': every tile in sets of three,
//    each three of a kind or a run of three in one suit, and one pair: two sets and a pair with 8 tiles).
//  - Discard: one tile of the hand (`{ d: tile }`), face up on the pile.
// Modes (`mode`, the admin's): Race (each player their own wall and their own discards: `wall.X`/`wall.O`,
// `pile.X`/`pile.O`; only the wall is drawn from) or Shared (one wall and one discard pile for both, `wall.S`/`pile.S`:
// a player can take the other's last discard). A wall run out: the pile under its top shuffled in (the move's rng: the
// server's online). Public: the piles, the walls' counts (`left`), the hands' sizes (`hn`), how many sets each hand
// holds (`sc`: never which), the take in hand (its tile only off the pile). A timeout between the steps throws the
// tile just taken (core/board.js timeoutClose: 'auto'). Never two people on one phone (meta.js samePhone: false).
import { needRng, shuffle } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const SUITS = ['d', 'b', 's'];                               // Dots, Bars, Stars
export const SUIT_NAME = { d: 'Dots', b: 'Bars', s: 'Stars', h: '' };
export const HONOURS = ['Sun', 'Moon', 'Cloud'];
export const MJ = { copies: 4 };
export function mjCfg(mini) {
  const t = tune(mini), hand = [4, 7, 10].includes(Number(t.hand)) ? Number(t.hand) : 7;
  return { mode: t.mode === 'race' ? 'race' : 'shared', hand, sets: (hand - 1) / 3, suits: Math.max(1, Math.min(3, Math.round(t.suits || 3))), nums: Math.max(3, Math.min(9, Math.round(t.nums || 5))), honours: t.honours === 'on' };
}
// The tile set: every tile `MJ.copies` times.
export function mjTiles(c) {
  const kinds = [];
  for (const s of SUITS.slice(0, c.suits)) for (let n = 1; n <= c.nums; n++) kinds.push(s + n);
  if (c.honours) for (let n = 1; n <= HONOURS.length; n++) kinds.push('h' + n);
  const out = []; for (const k of kinds) for (let j = 0; j < MJ.copies; j++) out.push(k);
  return out;
}
export const mjKinds = c => [...new Set(mjTiles(c))];
const ORDER = { d: 0, b: 1, s: 2, h: 3 };
export const mjSort = h => h.slice().sort((a, b) => ORDER[a[0]] - ORDER[b[0]] || Number(a.slice(1)) - Number(b.slice(1)));
export const mjName = t => (t[0] === 'h' ? HONOURS[Number(t.slice(1)) - 1] : `${t.slice(1)} of ${SUIT_NAME[t[0]]}`);
// A hand as counts by tile: index s*10+n for a suit, 40+n for an honour (runs: suited, consecutive, never across 9|1).
const idx = t => (t[0] === 'h' ? 40 + Number(t.slice(1)) : ORDER[t[0]] * 10 + Number(t.slice(1)));
const tileOf = i => (i >= 40 ? 'h' + (i - 40) : SUITS[Math.floor(i / 10)] + (i % 10));
const counts = h => { const c = new Array(44).fill(0); for (const t of h) c[idx(t)]++; return c; };
const runOk = i => i < 40 && (i % 10) <= 7;                        // (i, i+1, i+2 one suit: the number 1..7)
// Is this hand complete: every tile in sets and one pair (3k + 2 tiles)?
function complete(c, pair) {
  let i = 0; while (i < 44 && !c[i]) i++;
  if (i === 44) return pair;
  if (c[i] >= 3) { c[i] -= 3; const ok = complete(c, pair); c[i] += 3; if (ok) return true; }
  if (!pair && c[i] >= 2) { c[i] -= 2; const ok = complete(c, true); c[i] += 2; if (ok) return true; }
  if (runOk(i) && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; const ok = complete(c, pair); c[i]++; c[i + 1]++; c[i + 2]++; if (ok) return true; }
  return false;
}
export const mjComplete = h => h.length % 3 === 2 && complete(counts(h), false);
// How far a hand is from complete with `m` sets and a pair (the step count: -1 complete, 0 one tile away), and the best
// split of it (sets, partial sets, the pair) for the view's highlight and the computer.
export function mjShanten(h, m) {
  const c = counts(h); let best = 99;
  const go = (i, sets, parts, pair) => {
    while (i < 44 && !c[i]) i++;
    if (i === 44) { const s = 2 * m - 2 * Math.min(sets, m) - Math.min(parts, Math.max(0, m - sets)) - (pair ? 1 : 0); if (s < best) best = s; return; }
    if (c[i] >= 3) { c[i] -= 3; go(i, sets + 1, parts, pair); c[i] += 3; }
    if (runOk(i) && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; go(i, sets + 1, parts, pair); c[i]++; c[i + 1]++; c[i + 2]++; }
    if (c[i] >= 2) { c[i] -= 2; if (!pair) go(i, sets, parts, true); go(i, sets, parts + 1, pair); c[i] += 2; }
    if (i < 40 && (i % 10) <= 8 && c[i + 1]) { c[i]--; c[i + 1]--; go(i, sets, parts + 1, pair); c[i]++; c[i + 1]++; }
    if (runOk(i) && c[i + 2]) { c[i]--; c[i + 2]--; go(i, sets, parts + 1, pair); c[i]++; c[i + 2]++; }
    c[i]--; go(i, sets, parts, pair); c[i]++;
  };
  go(0, 0, 0, false);
  return best;
}
// The sets a hand holds side by side (the most, then a pair among the rest): { sets: [[t, t, t]...], pair: [t, t] | null }.
export function mjSets(h) {
  const c = counts(h), rest = new Array(44).fill(0); let best = { sets: [], pair: null, k: -1 };
  const go = (i, sets) => {
    while (i < 44 && !c[i]) i++;
    if (i === 44) {
      let pair = null;
      for (let j = 0; j < 44 && !pair; j++) if (rest[j] >= 2) pair = [tileOf(j), tileOf(j)];
      const k = sets.length * 2 + (pair ? 1 : 0);
      if (k > best.k) best = { sets: sets.map(x => x.slice()), pair, k };
      return;
    }
    if (c[i] >= 3) { c[i] -= 3; sets.push([tileOf(i), tileOf(i), tileOf(i)]); go(i, sets); sets.pop(); c[i] += 3; }
    if (runOk(i) && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; sets.push([tileOf(i), tileOf(i + 1), tileOf(i + 2)]); go(i, sets); sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++; }
    c[i]--; rest[i]++; go(i, sets); c[i]++; rest[i]--;            // (one of this tile left out of sets)
  };
  go(0, []);
  return { sets: best.sets, pair: best.pair };
}
const key = (mini, p) => (mini.mode === 'shared' ? 'S' : p);
export function create(type, rng) {
  const r = needRng(rng), c = mjCfg({ type, tune: tuneLive(type) }), mode = c.mode;
  const mini = { type, v: 2, mode, wall: {}, pile: {}, left: {}, hand: {}, hn: { X: c.hand, O: c.hand }, sc: { X: 0, O: 0 }, held: null, turns: { X: 0, O: 0 }, last: null };
  const keys = mode === 'shared' ? ['S'] : ['X', 'O'];
  for (const k of keys) { mini.wall[k] = shuffle(mjTiles(c), r); mini.pile[k] = []; }
  for (const p of ['X', 'O']) { const w = mini.wall[key(mini, p)]; mini.hand[p] = mjSort(w.splice(w.length - c.hand, c.hand)); mini.sc[p] = mjSets(mini.hand[p]).sets.length; }
  for (const k of keys) mini.left[k] = mini.wall[k].length;
  return mini;
}
export const stale = mini => mini.v !== 2;                         // (the solitaire squares from before: dealt again, core/records.js)
function draw(mini, p, rng) {
  const k = key(mini, p); if (!Array.isArray(mini.wall[k])) mini.wall[k] = [];
  let reshuf = false;
  if (!mini.wall[k].length) {
    const pile = mini.pile[k] || [], top = pile.pop();
    mini.wall[k] = shuffle(pile.splice(0), needRng(rng)); mini.pile[k] = top ? [top] : []; reshuf = true;
    if (!mini.wall[k].length) {                                    // (nothing at all: every tile not in a hand or on a pile, afresh)
      const c = mjCfg(mini), used = counts([...(mini.hand.X || []), ...(mini.hand.O || []), ...Object.values(mini.pile).flat()]);
      mini.wall[k] = shuffle(mjTiles(c).filter(t => { const i = idx(t); if (used[i] > 0) { used[i]--; return false; } return true; }), needRng(rng));
    }
  }
  const t = mini.wall[k].pop(); mini.left[k] = mini.wall[k].length;
  return { t, reshuf };
}
export function apply(mini, p, m, rng, idx0) {
  if (mini.v !== 2) return { ok: false, reason: 'stale' };
  if (!mini.hand || !Array.isArray(mini.hand[p])) return { ok: false, reason: 'secret' };
  if (mini.held && mini.held.by !== p) mini.held = null;
  const k = key(mini, p);
  if (m === 'wall' || m === 'pile') {
    if (mini.held) return { ok: false, reason: 'taken' };
    let t, reshuf = false;
    if (m === 'pile') { if (mini.mode !== 'shared') return { ok: false, reason: 'bad' }; t = (mini.pile[k] || []).pop(); if (!t) return { ok: false, reason: 'empty' }; }
    else ({ t, reshuf } = draw(mini, p, rng));
    mini.hand[p] = mjSort(mini.hand[p].concat(t)); mini.hn[p] = mini.hand[p].length;
    mini.held = { by: p, from: m, t };
    const win = mjComplete(mini.hand[p]);
    mini.sc[p] = mjSets(mini.hand[p]).sets.length;
    mini.last = Object.assign({ by: p, kind: 'take', from: m, reshuf, left: mini.left[k] }, m === 'pile' ? { t } : {}, win ? { win: true } : {});
    if (win) { mini.turns[p] += 1; mini.held = null; return { ok: true, outcome: 'win', note: 'mahjong' }; }
    return { ok: true, outcome: 'continue', note: 'take', again: true };
  }
  if (m === 'auto') { if (!mini.held) return { ok: false, reason: 'bad' }; m = { d: mini.held.t }; }
  if (!mini.held || !m || typeof m !== 'object' || typeof m.d !== 'string') return { ok: false, reason: 'bad' };
  const h = mini.hand[p], i = h.indexOf(m.d);
  if (i < 0) return { ok: false, reason: 'bad' };
  h.splice(i, 1); (mini.pile[k] = mini.pile[k] || []).push(m.d);
  mini.held = null; mini.turns[p] += 1; mini.hn[p] = h.length; mini.sc[p] = mjSets(h).sets.length;
  mini.last = { by: p, kind: 'discard', d: m.d, sc: mini.sc[p] };
  return { ok: true, outcome: 'continue', note: 'discard' };
}
export function timeoutClose(mini, p) { return mini.held && mini.held.by === p ? 'auto' : null; }
const pubHeld = h => (h ? Object.assign({ by: h.by, from: h.from }, h.from === 'pile' ? { t: h.t } : {}) : null);
const copyObj = o => JSON.parse(JSON.stringify(o || {}));
// What the board may show (and the computer for `forSide` may know): the piles, the counts, the take in hand (its tile
// only off the pile), forSide's own hand alone. A claimed square: both hands (its review).
export function publicView(mini, forSide) {
  const v = { type: 'mahjong', v: mini.v, mode: mini.mode, tune: mini.tune, pile: copyObj(mini.pile), left: copyObj(mini.left), hn: copyObj(mini.hn), sc: copyObj(mini.sc), held: pubHeld(mini.held), turns: copyObj(mini.turns), last: mini.last ? copyObj(mini.last) : null, hand: {} };
  if (forSide && mini.hand && Array.isArray(mini.hand[forSide])) { v.hand[forSide] = mini.hand[forSide].slice(); if (mini.held && mini.held.by === forSide) v.held.t = mini.held.t; }
  return v;
}
export function secret(mini) {
  if (mini.v !== 2 || !mini.hand || !mini.wall) return null;
  return { wall: copyObj(mini.wall), hand: { X: (mini.hand.X || []).slice(), O: (mini.hand.O || []).slice() }, held: mini.held ? Object.assign({}, mini.held) : null };
}
export function hide(m, k, st) { delete m.wall; if (m.hand) m.hand = {}; m.held = pubHeld(m.held); }
export function sidePart(mini, p) {
  if (!mini.hand || !Array.isArray(mini.hand[p])) return null;
  return Object.assign({ hand: mini.hand[p].slice() }, mini.held && mini.held.by === p ? { took: mini.held.t } : {});
}
export function sideMerge(mini, p, part) {
  if (!part || !Array.isArray(part.hand)) return;
  mini.hand = Object.assign({}, mini.hand, { [p]: part.hand.slice() });
  if (part.took && mini.held && mini.held.by === p) mini.held = Object.assign({}, mini.held, { t: part.took });
}
export function canMove(mini) { return true; }
export function randomMove(mini, p, rng, from, empties) {
  const r = needRng(rng), k = key(mini, p);
  if (!mini.held || mini.held.by !== p) return mini.mode === 'shared' && (mini.pile[k] || []).length && r() < 0.3 ? 'pile' : 'wall';
  const h = mini.hand[p]; return { d: h[Math.floor(r() * h.length)] };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const k = key(mini, p), pile = mini.pile[k] || [];
  flash.mj = Object.assign({}, mini.last, { top: pile.slice(-1)[0] || null, left: mini.left[k], hn: copyObj(mini.hn), sc: copyObj(mini.sc) });
}
// The move's moments (ms): a take slides the tile into the hand (`land`; a wall tile of one's own then turns up, `flip`;
// a wall run out gathers the pile first, `deal`); a discard slides it out onto the pile; a win lights the hand's sets.
export const MJT = { slide: 300, flip: 240, deal: 300, win: 520, hold: 420 };
export function mjTimes(r) {
  if (!r) return { end: MJT.hold };
  if (r.kind === 'take') { const at = r.reshuf ? MJT.deal : 0, land = at + MJT.slide, flip = land + (r.from === 'wall' ? MJT.flip : 0); return { at, land, flip, win: flip + 60, end: flip + (r.win ? MJT.win : 0) + 150 }; }
  return { at: 0, land: MJT.slide, end: MJT.slide + MJT.hold };
}
export function flashMs(f, winLen, won) { return mjTimes(f.mj).end + (won ? 600 : 0); }
