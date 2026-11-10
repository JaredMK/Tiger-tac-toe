// Dominoes: the computer's play. It decides from its own hand, the line, the counts and the boneyard's size alone
// (never the other hand: rules.js HANDS_PUBLIC).
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { domCount, domEnds, domHand, domMoves, domPile, domSet, domPips, domTile, isDouble, tilePips } from './rules.js';

// Moves still needed: the tiles in hand, plus the draws a fuller boneyard is likely to cost.
export function needs(pm, p) {
  const n = domCount(pm, p);
  if (n <= 0) return 0;
  return n * (1 + 0.3 * Math.min(1, domPile(pm) / 8));
}
// Normal's placement score: the pips laid down (big tiles and doubles out first: a blocked end counts the pips left),
// the tiles still in hand that fit the line's new ends (options kept), and how many of the new end values the hand
// holds (the other side the likelier stuck on them).
function score(pm, me, mv, hand) {
  const t = domTile(pm, mv.t), ends = domEnds(pm);
  let s = tilePips(t) + (isDouble(t) ? 1.5 : 0);
  const rest = hand.filter(k => k !== mv.t);
  let nl, nr;
  if (!ends) { nl = t[0]; nr = t[1]; } else if (mv.e === 'L') { nl = t[0] === ends[0] ? t[1] : t[0]; nr = ends[1]; } else { nl = ends[0]; nr = t[0] === ends[1] ? t[1] : t[0]; }
  let fit = 0, hold = 0;
  for (const k of rest) { const u = domTile(pm, k); if (u[0] === nl || u[1] === nl || u[0] === nr || u[1] === nr) fit++; if (u[0] === nl || u[1] === nl) hold++; if (u[0] === nr || u[1] === nr) hold++; }
  s += 1.2 * Math.min(fit, 3) + 0.4 * hold;
  if (rest.length === 1 && fit) s += 4;                          // (the last tile fits after this one: out next move)
  return s;
}
function normalPick(pm, me, rng, moves, hand) {
  let top = [], best = -Infinity;
  for (const mv of moves) { const s = score(pm, me, mv, hand); if (s > best + 1e-9) { best = s; top = [mv]; } else if (Math.abs(s - best) <= 1e-9) top.push(mv); }
  return top[randInt(rng, top.length)];
}
export function best(pm, me, rng, style, ctx) {
  const hand = domHand(pm, me) || [], moves = domMoves(pm, me);
  if (!moves.length) return { move: domPile(pm) > 0 ? 'draw' : 'pass', q: 0, shared: false };   // (nothing fits: the draw, or the pass, is the move)
  const out = mv => ({ move: { t: mv.t, e: mv.e }, q: hand.length === 1 ? 1 : 0, shared: false });
  if (ctx && ctx.level === 'easy') { const r = moves[randInt(rng, moves.length)]; return out(r); }
  if (ctx && ctx.level === 'hard' && hand.length > 1) return out(hardPick(pm, me, rng, moves, hand, ctx));
  return out(normalPick(pm, me, rng, moves, hand));
}

// ---- Hard: a determinised search over the hidden tiles ----
// What it knows: its own hand, the line, both counts, the boneyard's size and the last move (never the other hand's
// faces, though they ride the public state: rules.js HANDS_PUBLIC). The tiles not in its hand and not on the line are
// unknown: each sample deals the other hand and the boneyard's order from them at random, in keeping with what the
// play implies (a side that has just passed, or drawn the boneyard dry without a fit, holds nothing that fits the
// line's ends), and that open-handed square is solved to its end by search (the mover's best against the other's
// best, the draws as the sample dealt them; a memo; a square too long to finish valued by the tiles and pips left).
// The placement that does best over the samples is taken (a win 1, a level block a half); Normal's score breaks a tie.
// Within ctx.until where there is one; HARD.samples deals where there is not.
const HARD = { samples: 48, maxSamples: 4000, nodes: 1500, work: 20000, least: 8 };   // samples: deals with no budget (fewer once they have cost `work` positions in all, never under `least`); maxSamples: the most with one; nodes: a deal's search before its leaves are valued by eye
const TA = {}, TB = {};
function tilesOf(pips) { if (!TA[pips]) { const s = domSet(pips); TA[pips] = s.map(t => t[0]); TB[pips] = s.map(t => t[1]); } return pips; }
const bits = x => { let n = 0; while (x) { x &= x - 1; n++; } return n; };
function hardPick(pm, me, rng, moves, hand, ctx) {
  const pips = tilesOf(domPips(pm)), A = TA[pips], B = TB[pips], N = A.length, set = domSet(pips), you = me === 'X' ? 'O' : 'X';
  const seen = new Set(hand);
  for (const t of pm.line) seen.add(set.findIndex(u => (u[0] === t[0] && u[1] === t[1]) || (u[0] === t[1] && u[1] === t[0])));
  const unknown = []; for (let k = 0; k < N; k++) if (!seen.has(k)) unknown.push(k);
  const nYou = Math.min(domCount(pm, you), unknown.length), until = ctx.until, ends0 = domEnds(pm), openDraw = !!pm.openDraw;
  // what the play implies. For sure: the other side's last move was a pass, or a draw that found nothing: none of its
  // tiles fits the line's ends. And from the line itself: while the boneyard holds tiles every turn ends in a placement,
  // so the two sides' tiles went down in turn, which (with who laid each tile and which end it is on) gives the order
  // of play, and with it the ends before each placement. The other side's counts say how many tiles it has drawn; if
  // any, its last draw came before one of its placements, and nothing it holds now fits the ends as they were then
  // (what it held did not fit, nor did the tiles drawn before the one it laid). Which placement that was is weighed by
  // the chance it needed no draw for the ones after it (domBars); one that the tiles left cannot bear out is ruled out.
  const l = pm.last, stuck = !!(ends0 && l && l.by === you && (l.kind === 'pass' || (l.kind === 'draw' && !l.fits)));
  const lackOf = bar => k => A[k] !== bar[0] && B[k] !== bar[0] && A[k] !== bar[1] && B[k] !== bar[1];
  const opts = [];                                               // { w, free, held }: a case, the tiles the other hand may hold in it, the ones it cannot (the boneyard's)
  let wAll = 0;
  for (const c of stuck ? [{ bar: ends0, w: 1 }] : domBars(pm, you, N)) {
    const free = c.bar ? unknown.filter(lackOf(c.bar)) : unknown;
    if (free.length < nYou) continue;
    opts.push({ w: c.w, free, held: c.bar ? unknown.filter(k => !free.includes(k)) : [] }); wAll += c.w;
  }
  if (!opts.length) { opts.push({ w: 1, free: unknown, held: [] }); wAll = 1; }
  let myMask = 0; for (const k of hand) myMask |= 1 << k;
  const pipsOf = m => { let s = 0; for (let k = 0; k < N; k++) if (m & (1 << k)) s += A[k] + B[k]; return s; };
  // one deal's search: hands as bit sets (h[0] mine, h[1] the other's), the line's ends, the boneyard drawn from its end
  let pile = null, memo = null, nodes = 0;
  const canPlay = (m, a, b) => { for (let k = 0; k < N; k++) if (m & (1 << k) && (A[k] === a || B[k] === a || A[k] === b || B[k] === b)) return true; return false; };
  const blockedV = (hm, ho) => { const x = pipsOf(hm), y = pipsOf(ho); return x < y ? 1 : y < x ? -1 : 0; };   // for the side holding hm
  // the value for the side to move (hm its hand, ho the other's): 1 a win, -1 a loss, 0 a level block
  const solve = (hm, ho, a, b, top) => {
    let fit = canPlay(hm, a, b);
    if (!fit) {
      while (top > 0 && !fit) { const k = pile[--top]; hm |= 1 << k; fit = A[k] === a || B[k] === a || A[k] === b || B[k] === b; }   // the draw: tiles until one fits
      if (!fit) {                                                // the boneyard is empty: a pass
        if (!canPlay(ho, a, b)) return blockedV(hm, ho);
        return -solve(ho, hm, a, b, top);
      }
    }
    const key = hm + ':' + ho + ':' + (a * 8 + b) + ':' + top;
    const got = memo.get(key); if (got !== undefined) return got;
    if (++nodes > HARD.nodes) { const x = bits(hm), y = bits(ho); return Math.max(-0.9, Math.min(0.9, (y - x) / 3 + (pipsOf(ho) - pipsOf(hm)) / 60)); }
    let v = -2;
    for (let k = 0; k < N && v < 1; k++) {
      if (!(hm & (1 << k))) continue;
      const x = A[k], y = B[k], rest = hm & ~(1 << k);
      for (let e = 0; e < 2; e++) {
        if (e === 1 && a === b) break;                           // both ends alike: one placement
        const end = e ? b : a; if (x !== end && y !== end) continue;
        const nv = x === end ? y : x, na = e ? a : nv, nb = e ? nv : b;
        let w;
        if (!rest) w = 1;
        else if (top === 0 && !canPlay(ho, na, nb) && !canPlay(rest, na, nb)) w = blockedV(rest, ho);
        else w = -solve(ho, rest, na, nb, top);
        if (w > v) v = w;
        if (v >= 1) break;
      }
    }
    memo.set(key, v);
    return v;
  };
  // my move at the root (the first tile too: the opener's draw)
  const after = mv => {
    const k = mv.t, x = A[k], y = B[k]; let rest = myMask & ~(1 << k), top = pile.length, na, nb;
    if (!ends0) { na = x; nb = y; if (openDraw && top > 0) rest |= 1 << pile[--top]; }
    else if (mv.e === 'L') { na = x === ends0[0] ? y : x; nb = ends0[1]; } else { na = ends0[0]; nb = x === ends0[1] ? y : x; }
    if (!rest) return 1;
    const ho = youMask;
    if (top === 0 && !canPlay(ho, na, nb) && !canPlay(rest, na, nb)) return blockedV(rest, ho);
    return -solve(ho, rest, na, nb, top);
  };
  let youMask = 0;
  const sum = moves.map(() => 0);
  const limit = until ? HARD.maxSamples : HARD.samples;
  let done = 0, spent = 0;
  for (let s = 0; s < limit; s++) {
    if (until ? s > 0 && until() <= 0 : s >= HARD.least && spent > HARD.work) break;
    let c = opts[0];
    if (opts.length > 1) { let x = rng() * wAll; for (const o of opts) { c = o; x -= o.w; if (x < 0) break; } }
    const f = c.free.slice(); mix(f, rng);
    const rest = f.slice(nYou).concat(c.held); mix(rest, rng);
    const deal = f.slice(0, nYou).concat(rest);
    youMask = 0; for (let j = 0; j < nYou; j++) youMask |= 1 << deal[j];
    pile = deal.slice(nYou); memo = new Map(); nodes = 0;
    for (let i = 0; i < moves.length; i++) sum[i] += after(moves[i]);
    done++; spent += nodes;
  }
  if (!done) return normalPick(pm, me, rng, moves, hand);
  let top = null, bestV = -Infinity;
  for (let i = 0; i < moves.length; i++) { const v = sum[i] / done + 1e-4 * score(pm, me, moves[i], hand); if (v > bestV) { bestV = v; top = moves[i]; } }
  return top;
}
function mix(a, rng) { for (let j = a.length - 1; j > 0; j--) { const r = randInt(rng, j + 1); const x = a[j]; a[j] = a[r]; a[r] = x; } }
// The cases for the other side's hand, from the order of play: [{ bar, w }], bar the ends none of its tiles fits (null:
// nothing known), w the case's weight. No tile drawn: nothing known. Else its last draw came before one of its
// placements (not the line's first tile): each one a case, in each order of play the line allows.
const KEPT = 0.6;                                           // the chance a placement after a draw needed no draw of its own, as play goes (measured: the last draw came k placements ago about 0.6^k as often)
export function domBars(pm, you, N) {
  const none = [{ bar: null, w: 1 }], line = pm.line, at = pm.left || 0;
  if (line.length < 2 || at >= line.length) return none;
  const opened = line[at][2] === you ? 1 : 0, played = (pm.played && pm.played[you]) || 0, n = domCount(pm, you);
  const drawn = n + played - Math.max(1, Math.min(tune(pm).hand, Math.floor((N - 1) / 2))) - (opened && pm.openDraw ? 1 : 0), plays = played - opened;
  if (!(drawn > 0) || plays <= 0) return none;
  // the orders of play: the left end's tiles outwards and the right end's, merged so that the sides take turns
  const out = [], bars = [];
  const walk = (li, ri, who) => {                                // li, ri: the next tile on the left and on the right; who laid the last
    if (out.length >= 64) return;
    if (li < 0 && ri >= line.length) { out.push(bars.slice()); return; }
    const a = line[li + 1][0], b = line[ri - 1][1];
    for (const k of [li, ri]) {
      if (k < 0 || k >= line.length || line[k][2] === who) continue;
      const mine = line[k][2] === you; if (mine) bars.push([a, b]);
      if (k === li) walk(li - 1, ri, line[k][2]); else walk(li, ri + 1, line[k][2]);
      if (mine) bars.pop();
      if (li === ri) break;
    }
  };
  walk(at - 1, at + 1, line[at][2]);
  if (!out.length) {                                             // (the sides did not take turns: a pass somewhere. The last placement alone, if it is the other side's)
    const l = pm.last, e = domEnds(pm);
    if (!(l && l.by === you && l.kind === 'play' && Array.isArray(l.tile))) return none;
    const p = Math.min(1, Math.max(1, drawn / 2.2) / plays);
    return [{ bar: l.e === 'L' ? [l.tile[1], e[1]] : [e[0], l.tile[0]], w: p }, { bar: null, w: 1 - p }].filter(c => c.w > 0);
  }
  const cases = [];
  for (const seq of out) {
    const m = seq.length, w = []; let sum = 0;
    for (let j = m - 1, q = 1; j >= 0; j--) { w[j] = q; sum += q; q *= KEPT; }   // the placements after j: each made from the hand, without a draw
    for (let j = 0; j < m; j++) cases.push({ bar: seq[j], w: w[j] / sum / out.length });
  }
  return cases;
}
