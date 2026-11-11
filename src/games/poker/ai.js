// Poker Hands: the computer's play (November 2026).
import { randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';
import { HANDS, handRank, pokPoints, pokRest } from './rules.js';

// Cards as numbers for speed: rank 0..12 (2..A) times 4 plus the suit.
const RANKS = '23456789TJQKA', SUITS = 'SHDC';
const toN = c => RANKS.indexOf(c[0]) * 4 + SUITS.indexOf(c[1]);
const cnt = new Int8Array(13);
// The hand's rank index (into HANDS) from five card numbers.
function rankIdx(a, b, c, d, e) {
  cnt.fill(0);
  cnt[a >> 2]++; cnt[b >> 2]++; cnt[c >> 2]++; cnt[d >> 2]++; cnt[e >> 2]++;
  const flush = (a & 3) === (b & 3) && (a & 3) === (c & 3) && (a & 3) === (d & 3) && (a & 3) === (e & 3);
  let pairs = 0, three = false, four = false, distinct = 0, lo = 13, hi = -1;
  for (let r = 0; r < 13; r++) { const k = cnt[r]; if (!k) continue; distinct++; if (r < lo) lo = r; if (r > hi) hi = r; if (k === 2) pairs++; else if (k === 3) three = true; else if (k === 4) four = true; }
  const straight = distinct === 5 && (hi - lo === 4 || (hi === 12 && cnt[0] && cnt[1] && cnt[2] && cnt[3]));
  if (straight && flush) return 8;
  if (four) return 7;
  if (three && pairs) return 6;
  if (flush) return 5;
  if (straight) return 4;
  if (three) return 3;
  if (pairs === 2) return 2;
  if (pairs === 1) return 1;
  return 0;
}
// The expected points of keeping `keep` (card numbers) and drawing the rest from `rest`: exact for up to three cards
// drawn (every draw counted), sampled (`samples` draws, the same ones for every keep: a fair comparison) for four or five.
function keepEv(keep, rest, P, samples) {
  const n = 5 - keep.length, h = new Int16Array(5);
  for (let i = 0; i < keep.length; i++) h[i] = keep[i];
  const R = rest.length, k0 = keep.length;
  let tot = 0, cntN = 0;
  if (n === 0) return P[rankIdx(h[0], h[1], h[2], h[3], h[4])];
  if (n <= 3) {
    const rec = (from, j) => {
      if (j === 5) { tot += P[rankIdx(h[0], h[1], h[2], h[3], h[4])]; cntN++; return; }
      for (let i = from; i < R; i++) { h[j] = rest[i]; rec(i + 1, j + 1); }
    };
    rec(0, k0);
    return tot / cntN;
  }
  for (const s of samples) { for (let j = 0; j < n; j++) h[k0 + j] = rest[s[j]]; tot += P[rankIdx(h[0], h[1], h[2], h[3], h[4])]; }
  return tot / samples.length;
}
const SAMPLES = 2500;
function sampleSet(R, rng) {                                         // SAMPLES draws of five distinct positions in 0..R-1
  const out = [];
  for (let s = 0; s < SAMPLES; s++) { const pick = []; while (pick.length < 5) { const x = randInt(rng, R); if (!pick.includes(x)) pick.push(x); } out.push(pick); }
  return out;
}
const MEMO = new Map();
// Hard: every one of the 32 ways to throw, by expected points (the square's own points table); ties to fewer thrown.
export function pokBest(hand, P, rng, until) {
  const pts = HANDS.map(k => P[k]), key = hand.join('') + '|' + pts.join(',');
  if (MEMO.has(key)) return MEMO.get(key);
  const nums = hand.map(toN), rest = pokRest(hand).map(toN), samples = sampleSet(rest.length, rng);
  let best = null;
  const masks = Array.from({ length: 32 }, (_, m) => m).sort((a, b) => bits(a) - bits(b));
  for (const m of masks) {
    if (best && bits(m) >= 4 && typeof until === 'function' && until() <= 0) break;   // (out of time: what it has)
    const keep = nums.filter((_, i) => !(m >> i & 1)), ev = keepEv(keep, rest, pts, samples);
    if (!best || ev > best.ev + 1e-9) best = { mask: m, ev };
  }
  const out = { mask: maskStr(best.mask), ev: best.ev };
  if (MEMO.size > 2000) MEMO.clear();
  MEMO.set(key, out);
  return out;
}
const bits = m => (m & 1) + (m >> 1 & 1) + (m >> 2 & 1) + (m >> 3 & 1) + (m >> 4 & 1);
const maskStr = m => Array.from({ length: 5 }, (_, i) => (m >> i & 1)).join('');
// Normal: the plain player's keeps: a made straight, flush or better stands; else the rank groups (pairs, trips, quads);
// else four to a flush; else four in a row (open or not); else throw all five.
export function pokPlain(hand) {
  const k = handRank(hand);
  if (['straight', 'flush', 'full', 'four', 'sf'].includes(k)) return '00000';
  const byRank = {}; hand.forEach((c, i) => (byRank[c[0]] = byRank[c[0]] || []).push(i));
  const groups = Object.values(byRank).filter(g => g.length >= 2).flat();
  if (groups.length) return hand.map((_, i) => (groups.includes(i) ? 0 : 1)).join('');
  const bySuit = {}; hand.forEach((c, i) => (bySuit[c[1]] = bySuit[c[1]] || []).push(i));
  const four = Object.values(bySuit).find(g => g.length === 4);
  if (four) return hand.map((_, i) => (four.includes(i) ? 0 : 1)).join('');
  const RV = '23456789TJQKA', v = hand.map(c => RV.indexOf(c[0]));
  for (let i = 0; i < 5; i++) {                                       // four within a span of five ranks (an ace low too)
    const others = v.filter((_, j) => j !== i), lo = Math.min(...others), hi = Math.max(...others);
    const low = others.map(x => (x === 12 ? -1 : x)), llo = Math.min(...low), lhi = Math.max(...low);
    if ((hi - lo <= 4) || (lhi - llo <= 4)) return hand.map((_, j) => (j === i ? 1 : 0)).join('');
  }
  return '11111';
}
// The points a move scores on average for this player's play (from tests/sim/poker.sim.js, the default points table).
export const POK_AVG = { hard: 1.28, normal: 1.18, easy: 0.63 };
export function needs(pm, p) {
  const t = tune(pm), left = Math.max(0, t.target - pm.score[p]);
  return Math.max(1, left / POK_AVG.normal + (goAgain(pm) ? 0 : 0.25));
}
// q: the chance this move takes the square: the chance its hand scores at least what is left (a rough table of the
// plain player's hands, tests/sim/poker.sim.js: at least 1 point 75%, 2 points 25%, 3 points 11%, 4 points 4%).
const AT_LEAST = [1, 0.75, 0.245, 0.11, 0.037, 0.024, 0.016, 0.003, 0.002, 0.001, 0.001];
export function best(pm, me, rng, style, ctx) {
  const t = tune(pm), lvl = ctx && ctx.level, left = Math.max(0, t.target - pm.score[me]);
  const q = AT_LEAST[Math.min(AT_LEAST.length - 1, left)] || 0;
  const cur = pm.cur && pm.cur.by === me ? pm.cur : null;
  if (!cur) return { move: 'deal', q };
  if (lvl === 'easy') return { move: 'draw:' + Array.from({ length: 5 }, () => (rng() < 0.5 ? 1 : 0)).join(''), q };
  if (lvl === 'hard') return { move: 'draw:' + pokBest(cur.hand, pokPoints(pm), rng, ctx && ctx.until).mask, q };
  if (t.miss && rng() * 100 < t.miss) return { move: 'draw:' + Array.from({ length: 5 }, () => (rng() < 0.5 ? 1 : 0)).join(''), q };
  return { move: 'draw:' + pokPlain(cur.hand), q };
}
