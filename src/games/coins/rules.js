// Coin Flip: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt, shuffle } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const COINS = { n: 5, max: 3, mystery: '?' };   // 2 X, 2 O and one mystery coin that belongs to nobody until it is flipped (n, max: the defaults of its settings, TUNE in meta.js)
export const coinMax = mini => tune(mini).flips || COINS.max;   // the most coins a flip turns: the square's own
// Coin flip: the coins a flip by p turns over: every coin that isn't p's when there are three or fewer,
// otherwise three of them picked at random.
export function coinPick(mini, p, rng) {
  const theirs = mini.coins.map((c, k) => (c !== p ? k : -1)).filter(k => k >= 0);
  const max = coinMax(mini);
  return (theirs.length > max ? shuffle(theirs, rng).slice(0, max) : theirs).sort((a, b) => a - b);
}
// As a player's turn starts, every open Coin flip square picks the coins their flip would turn, so they
// can be marked before Flip is tapped; the flip then turns exactly those.
export function markCoins(state, p, rng) {
  for (const sq of state.squares) if (!sq.owner && sq.mini.type === 'coins') sq.mini.marks = { by: p, coins: coinPick(sq.mini, p, rng) };
}
export function coinMarksFor(mini, p) {
  const mk = mini.marks, theirs = mini.coins.filter(c => c !== p).length;
  if (!mk || mk.by !== p || !Array.isArray(mk.coins) || mk.coins.length !== Math.min(coinMax(mini), theirs)) return null;
  return mk.coins.every(k => Number.isInteger(k) && mini.coins[k] !== undefined && mini.coins[k] !== p) && new Set(mk.coins).size === mk.coins.length ? mk.coins.slice().sort((a, b) => a - b) : null;
}
export function create(type, rng) {
  const h = (tuneLive(type).n - 1) / 2;                          // (the admin's setting: the coins, half each side and the mystery one)
  return { type, coins: shuffle([...new Array(h).fill('X'), ...new Array(h).fill('O'), COINS.mystery], rng), last: null };
}
export function apply(mini, p, m, rng, idx) {
  // One move flips up to three coins that aren't the player's: the other side's and the mystery
  // coin (it belongs to nobody until it lands). All of them when there are three or fewer,
  // otherwise three picked at random. The player's own coins are never flipped. Five the same wins;
  // with no coin of their own a player's flip can even hand the square to the other side.
  // The coins were picked (and marked) as the turn started; a game from before the marks picks now.
  if (m !== 'flip') return { ok: false, reason: 'bad' };
  const r = needRng(rng);
  if (!mini.coins.some(c => c !== p)) return { ok: false, reason: 'none' };
  const picked = coinMarksFor(mini, p) || coinPick(mini, p, r);
  mini.marks = null;
  const was = picked.map(k => mini.coins[k]);
  const results = picked.map(() => (randInt(r, 2) ? 'O' : 'X'));
  picked.forEach((k, j) => { mini.coins[k] = results[j]; });
  mini.last = { by: p, flipped: picked, results, was };
  const sym = mini.coins[0];
  if (sym !== COINS.mystery && mini.coins.every(c => c === sym)) return { ok: true, outcome: 'win', winner: sym, cells: mini.coins.map((c, k) => k) };
  return { ok: true, outcome: 'continue', note: 'flip' };
}
export function publicView(mini) {
  return { type: 'coins', coins: mini.coins.slice(), marks: mini.marks ? { by: mini.marks.by, coins: mini.marks.coins.slice() } : null };
}
export const COIN_NEEDS = [0, 2, 2.67, 3.14, 3.92, 4.55, 5.22];   // expected flips to turn n coins that aren't yours, flipping three at a time
// The same for any number of coins, flipping up to max at a time (each lands yours half the time).
export function coinNeeds(n, max = COINS.max) {
  if (max === COINS.max && n < COIN_NEEDS.length) return COIN_NEEDS[n];
  const E = [0], C = (a, b) => { let r = 1; for (let i = 0; i < b; i++) r = r * (a - i) / (i + 1); return r; };
  for (let k = 1; k <= n; k++) {
    const f = Math.min(k, max); let sum = 1;
    for (let j = 0; j < f; j++) sum += C(f, j) / Math.pow(2, f) * E[k - f + j];   // j of the f flipped still not yours
    E[k] = sum / (1 - Math.pow(0.5, f));
  }
  return E[n];
}
export function randomMove(mini, p, rng, from, empties) {
  return 'flip';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.n = mini.last.flipped.length; return;
}
export function flashMs(f, winLen, won) {
  return 1050 + (f.n - 1) * 80;
}
