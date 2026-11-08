// Dominoes: the computer's play. It decides from its own hand, the line, the counts and the boneyard's size alone
// (never the other hand: rules.js HANDS_PUBLIC).
import { randInt } from '../../core/random.js';
import { domCanPlay, domCount, domEnds, domHand, domMoves, domPile, domSet, domPips, domTile, isDouble, tilePips } from './rules.js';

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

// ---- Hard: playouts over the hidden tiles ----
// The tiles not in its hand and not on the line are unknown: the other hand and the boneyard are dealt from them at
// random, each candidate placement is played out with both sides on Normal's policy to the square's end, and the
// placement that wins the most playouts is taken. Within ctx.until where there is one; a fixed round of playouts
// (HARD.plays per candidate) where there is not.
const HARD = { plays: 40, maxRounds: 400, maxMoves: 80 };   // plays: playouts a candidate with no budget; maxRounds: the most with one (a budget that never runs out still ends)
function hardPick(pm, me, rng, moves, hand, ctx) {
  const pips = domPips(pm), set = domSet(pips), you = me === 'X' ? 'O' : 'X';
  const seen = new Set(hand);
  for (const t of pm.line) seen.add(set.findIndex(u => (u[0] === t[0] && u[1] === t[1]) || (u[0] === t[1] && u[1] === t[0])));
  const unknown = []; for (let k = 0; k < set.length; k++) if (!seen.has(k)) unknown.push(k);
  const nYou = domCount(pm, you), until = ctx.until;
  const wins = moves.map(() => 0), plays = moves.map(() => 0);
  const base = { pips, line: pm.line, left: pm.left || 0, hands: null, pile: null, played: { X: 0, O: 0 }, last: null };
  let round = 0, stop = false;
  for (; !stop && round < (until ? HARD.maxRounds : HARD.plays); round++) {
    for (let i = 0; i < moves.length; i++) {
      if (until && (round > 0 || i > 0) && until() <= 0) { stop = true; break; }
      const deal = unknown.slice();
      for (let j = deal.length - 1; j > 0; j--) { const r = randInt(rng, j + 1); const x = deal[j]; deal[j] = deal[r]; deal[r] = x; }
      const st = { pips, line: base.line.map(t => t.slice()), left: base.left, hands: { [me]: hand.slice(), [you]: deal.slice(0, nYou) }, pile: deal.slice(nYou), played: { X: 0, O: 0 }, last: null };
      const w = playout(st, me, moves[i], rng);
      plays[i]++; if (w === me) wins[i] += 1; else if (w === 'draw') wins[i] += 0.5;
    }
  }
  let top = [], bestR = -1;
  for (let i = 0; i < moves.length; i++) { const r = plays[i] ? wins[i] / plays[i] : -1; if (r > bestR + 1e-9) { bestR = r; top = [moves[i]]; } else if (Math.abs(r - bestR) <= 1e-9) top.push(moves[i]); }
  return top.length ? top[randInt(rng, top.length)] : normalPick(pm, me, rng, moves, hand);
}
// One square played to its end from `first`'s move, both sides on Normal: the winner ('X', 'O' or 'draw').
function playout(st, me, first, rng) {
  let p = me, mv = first;
  for (let n = 0; n < HARD.maxMoves; n++) {
    const r = step(st, p, mv);
    if (r) return r;
    p = p === 'X' ? 'O' : 'X';
    const ms = domMoves(st, p), hand = st.hands[p];
    mv = ms.length ? normalPick(st, p, rng, ms, hand) : st.pile.length ? 'draw' : 'pass';
  }
  return 'draw';
}
// A move applied to a playout square (rules.js apply, pared down: no checks a chosen move can fail).
function step(st, p, mv) {
  const hand = st.hands[p];
  if (mv === 'draw') { hand.push(st.pile.pop()); return blockedIn(st); }
  if (mv === 'pass') return blockedIn(st);
  const t = domTile(st, mv.t), ends = domEnds(st);
  let placed;
  if (!ends) placed = [t[0], t[1]];
  else if (mv.e === 'L') placed = t[1] === ends[0] ? [t[0], t[1]] : [t[1], t[0]];
  else placed = t[0] === ends[1] ? [t[0], t[1]] : [t[1], t[0]];
  hand.splice(hand.indexOf(mv.t), 1);
  if (mv.e === 'L' && ends) st.line.unshift(placed); else st.line.push(placed);
  if (!hand.length) return p;
  return blockedIn(st);
}
function blockedIn(st) {
  if (st.pile.length || domCanPlay(st, 'X') || domCanPlay(st, 'O')) return null;
  const px = st.hands.X.reduce((s, k) => s + tilePips(domTile(st, k)), 0), po = st.hands.O.reduce((s, k) => s + tilePips(domTile(st, k)), 0);
  return px === po ? 'draw' : px < po ? 'X' : 'O';
}
