// Bingo: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

// ---------- Bingo ----------
// Each player has a card, `size` x `size` distinct numbers from 1 to `range`, dealt into the square (both cards
// public). A turn here is two steps: the player taps Pick numbers (the move 'draw': `offer` numbers drawn from the
// numbers not yet called, by that move's rng, so online by the server at that moment; nothing of them exists in the
// square, its record or the page before; `again`: the turn goes on, held to the square), then picks one of them (the
// move is its index): the number is called, out of the pool, and marked on BOTH cards wherever it appears (so a call
// can help the other side, or nobody), and the offer is spent (the next turn draws its own). The first card with a
// complete line (a row, a column, or a diagonal where `diag` is on) takes the square; both complete on the same call:
// a tie, the square resets (`note: 'tie'`). Nobody is ever obliged to call: a timeout plays nothing (after a draw too:
// the turn passes, not a miss), and an offer drawn and not called stays drawn for the next player here (either side:
// the offer is the square's, not a player's), who picks from it with no draw of their own.
export const BINGOT = { press: 120, fly: 360, land: 480, stamp: 220, line: 520, step: 90, won: 420, rest: 260 };   // a call: the chip lifts, flies to the cards, lands (the mark stamps on at land); a line: its cells light one after another (step apart) from `line` after the land; a square won: the flourish's end; a plain call rests a moment
// A draw (the move 'draw'): the press, the cage turning (from `spin` for `turn` ms), the balls rolling out one by one
// (the farthest place first, so none rolls over one already in: ball k of n at `ball` + (n - 1 - k) x `gap`, each `pop` ms
// from the cage's mouth to its place in the tray), a moment's rest.
export const BINGOD = { spin: 60, turn: 900, ball: 620, gap: 300, pop: 340, rest: 120 };
export const BINGO_LIMITS = { size: [3, 5], range: [10, 60], offer: [2, 4] };
const clampInt = (v, [lo, hi], def) => { const n = v == null || v === '' ? NaN : Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
export function bingoSettings(t) {
  const size = clampInt(t && t.size, BINGO_LIMITS.size, 3), offer = clampInt(t && t.offer, BINGO_LIMITS.offer, 3);
  const range = Math.max(size * size + 2, clampInt(t && t.range, BINGO_LIMITS.range, 26));   // (room for two cards that differ: at least two numbers off each card)
  return { size, range, offer, diag: !(t && Number(t.diag) === 0) };
}
export const bingoSize = mini => (mini && Number.isInteger(mini.n) && mini.n >= BINGO_LIMITS.size[0] ? mini.n : 4);
export const bingoDiag = mini => !(mini && mini.diag === false);
// The lines of a size x size card: its rows, its columns and (diag) both diagonals, as cell indexes (row-major).
const LINES = new Map();
export function bingoLines(n, diag) {
  const key = n + (diag ? 'd' : '');
  let l = LINES.get(key);
  if (l) return l;
  l = [];
  for (let r = 0; r < n; r++) l.push(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) l.push(Array.from({ length: n }, (_, r) => r * n + c));
  if (diag) { l.push(Array.from({ length: n }, (_, k) => k * n + k)); l.push(Array.from({ length: n }, (_, k) => k * n + (n - 1 - k))); }
  LINES.set(key, l);
  return l;
}
export const linesOf = mini => bingoLines(bingoSize(mini), bingoDiag(mini));
// `k` distinct numbers from `pool` (a list), drawn by the rng (a partial shuffle of a copy).
function draw(pool, k, rng) {
  const a = pool.slice(), out = [];
  for (let i = 0; i < k && a.length; i++) { const j = i + randInt(rng, a.length - i); const t = a[i]; a[i] = a[j]; a[j] = t; out.push(a[i]); }
  return out;
}
export const bingoPool = mini => { const c = new Set(mini.called || []); const out = []; for (let v = 1; v <= mini.range; v++) if (!c.has(v)) out.push(v); return out; };   // the numbers not yet called
export const isCalled = (mini, v) => Array.isArray(mini.called) && mini.called.includes(v);
// The marks on p's card: for each cell, whether its number has been called.
export const bingoMarks = (mini, p) => (mini.cards && mini.cards[p] ? mini.cards[p].map(v => isCalled(mini, v)) : []);
// Each line's count of marks on p's card.
export const lineCounts = (mini, p) => { const m = bingoMarks(mini, p); return linesOf(mini).map(l => l.reduce((s, i) => s + (m[i] ? 1 : 0), 0)); };
// p's best line: its marks so far (0 to size).
export const bingoBest = (mini, p) => Math.max(0, ...lineCounts(mini, p));
// The complete lines on p's card (their cells), if any.
export function bingoWon(mini, p) {
  const m = bingoMarks(mini, p), n = bingoSize(mini), won = linesOf(mini).filter(l => l.every(i => m[i]));
  return won.length ? [...new Set(won.flat())].sort((a, b) => a - b) : null;
}
export function create(type, rng) {
  rng = needRng(rng);
  const s = bingoSettings(tuneLive(type)), all = Array.from({ length: s.range }, (_, k) => k + 1);
  const cards = { X: draw(all, s.size * s.size, rng), O: draw(all, s.size * s.size, rng) };
  return { type, n: s.size, range: s.range, diag: s.diag, cards, called: [], callBy: [], offer: [], calls: { X: 0, O: 0 }, last: null };   // (no offer: the first turn draws it)
}
export const bingoDrawn = mini => Array.isArray(mini.offer) && mini.offer.length > 0;   // an offer drawn and waiting for its call
export const BINGO_DRAW = 'draw';
export function apply(mini, p, m, rng, idx) {
  const offer = Array.isArray(mini.offer) ? mini.offer : [];
  if (m === BINGO_DRAW) {                                                                       // Pick numbers: the offer drawn now, from the pool, by this move's rng
    if (offer.length) return { ok: false, reason: 'bad' };                                     // (one drawn already: it is called from first)
    const pool = bingoPool(mini);
    if (!pool.length) return { ok: false, reason: 'bad' };
    mini.offer = draw(pool, Math.min(pool.length, bingoSettings(tune(mini)).offer), needRng(rng));
    return { ok: true, outcome: 'continue', note: 'draw', again: true };                       // the turn goes on: the call from it
  }
  if (!idx(offer.length)) return { ok: false, reason: 'bad' };
  const v = offer[m];
  if (!Array.isArray(mini.called)) mini.called = [];
  if (!Array.isArray(mini.callBy)) mini.callBy = [];
  if (!mini.calls) mini.calls = { X: 0, O: 0 };
  const bestWas = { X: bingoBest(mini, 'X'), O: bingoBest(mini, 'O') };
  mini.called.push(v); mini.callBy.push(p); mini.calls[p] = (mini.calls[p] || 0) + 1;
  const hit = { X: mini.cards.X.indexOf(v), O: mini.cards.O.indexOf(v) };                       // where it marks on each card (-1: not on it)
  const won = { X: hit.X >= 0 ? bingoWon(mini, 'X') : null, O: hit.O >= 0 ? bingoWon(mini, 'O') : null };
  const left = bingoPool(mini).length;
  mini.last = { by: p, k: m, n: v, offer: offer.slice(), hit, won, was: bestWas, best: { X: bingoBest(mini, 'X'), O: bingoBest(mini, 'O') } };
  mini.offer = [];                                                                             // (spent: the next turn draws its own)
  if (won.X && won.O) return { ok: true, outcome: 'draw', note: 'tie' };                           // both complete on the one call: a tie, the square resets
  if (won.X || won.O) { const w = won.X ? 'X' : 'O'; mini.win = w; return { ok: true, outcome: 'win', winner: w, cells: won[w], note: w === p ? 'line' : 'gift' }; }   // (a call that completes only the other card hands them the square)
  if (!left) return { ok: true, outcome: 'draw', note: 'tie' };                             // (every number called and no line: cannot happen with a full card, kept safe)
  return { ok: true, outcome: 'continue', note: hit.X >= 0 || hit.O >= 0 ? 'mark' : 'miss' };
}
export function publicView(mini) {
  return { type: 'bingo', n: bingoSize(mini), range: mini.range, diag: bingoDiag(mini), cards: { X: (mini.cards && mini.cards.X || []).slice(), O: (mini.cards && mini.cards.O || []).slice() }, called: (mini.called || []).slice(), callBy: (mini.callBy || []).slice(), offer: (mini.offer || []).slice(), calls: { X: (mini.calls && mini.calls.X) || 0, O: (mini.calls && mini.calls.O) || 0 }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null, win: mini.win || null };
}
export function randomMove(mini, p, rng, from, empties) { const n = Array.isArray(mini.offer) ? mini.offer.length : 0; return n ? randInt(rng, n) : bingoPool(mini).length ? BINGO_DRAW : null; }   // (a timeout plays nothing: core/board.js timeoutClose)
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  if (m === BINGO_DRAW) { flash.bingo = { draw: true, by: p, offer: (mini.offer || []).slice(), size: bingoSize(mini) }; return; }   // the draw: the numbers that came out, in order (the replay rolls these out, never the square's)
  const l = mini.last;
  flash.bingo = { by: p, k: l.k, n: l.n, offer: l.offer.slice(), hit: Object.assign({}, l.hit), won: { X: l.won.X ? l.won.X.slice() : null, O: l.won.O ? l.won.O.slice() : null }, was: Object.assign({}, l.was), best: Object.assign({}, l.best), size: bingoSize(mini) };
}
// The moments of a call (ms from the move): the chip lifts (press), the number lands on the cards (land: the marks
// stamp on), a complete line lights cell by cell from `line` (step apart), the move's animation ends (end).
export function bingoTimes(a) {
  const land = BINGOT.land, size = a && a.size ? a.size : 4, lined = a && (a.won.X || a.won.O);
  const line = land + BINGOT.line, lineEnd = line + (size - 1) * BINGOT.step + BINGOT.stamp;
  return { land, line, end: lined ? lineEnd + BINGOT.won : land + BINGOT.rest };
}
// The moments of a draw (ms from the move): the cage turns from `spin`; ball k (its place in the tray) leaves the cage at balls[k] and is in
// its place `pop` later; the draw's animation ends a rest after the last is in (end).
export function bingoDrawTimes(a) {
  const D = BINGOD, n = a && Array.isArray(a.offer) ? a.offer.length : 3, balls = Array.from({ length: n }, (_, k) => D.ball + (n - 1 - k) * D.gap);
  const last = n ? D.ball + (n - 1) * D.gap + D.pop : D.spin + D.turn;
  return { spin: D.spin, stop: D.spin + D.turn, balls, end: Math.max(last, D.spin + D.turn) + D.rest };
}
export function flashMs(f, winLen, won) { return f.bingo && f.bingo.draw ? bingoDrawTimes(f.bingo).end : bingoTimes(f.bingo).end; }
