// Flood: the computer's play.
import { randInt } from '../../core/random.js';
import { other } from '../../core/util.js';
import { FLOOD, floodApply, floodCfg, floodHard, floodNear, floodSearch } from './rules.js';

// ---- Hard: the square solved, every move ----
// The cells not yet in the blob never change colour, so they fall into regions (touching cells of one colour) that
// are grabbed whole: a colour grabs every region of it that touches the blob. A position is the set of regions
// grabbed (one 32-bit mask), the mover's score (the other side's follows) and whose move it is; from a fresh board
// the whole game is a few hundred to a few thousand positions, so every call solves the square exactly
// (floodSolve), with the players moving in turn.
// A colour that grabs nothing is a legal move (a pass), and it is the right one when every grab loses and the other
// side, were it to move, could only lose too: whoever grabs first there loses the square. Two players who both
// know it would pass for ever, so such a position is level (0) and FLOOD_PASS sets how often Hard passes when that
// is its only way not to lose (the rest of the time it grabs, so two computers never stall for good).
export const FLOOD_PASS = 0.9;
const FN = FLOOD.n * FLOOD.n, MAXR = 31, T_BITS = 15, T_N = 1 << T_BITS;
const K1 = new Int32Array(T_N), K2 = new Int8Array(T_N), TV = new Int8Array(T_N);
// The regions of a position: 0 the blob (every owned cell), then one per patch of a colour outside it; each one's
// size, its neighbours (a mask) and each colour's regions (a mask). null with more regions than a mask holds.
export function floodRegions(pm, nc) {
  const id = new Int8Array(FN).fill(-1), size = [0], colour = [pm.colors[0]], stack = [];
  for (let i = 0; i < FN; i++) if (pm.owner[i] != null) id[i] = 0;
  let n = 1;
  for (let i = 0; i < FN; i++) {
    if (id[i] >= 0) continue;
    if (n > MAXR) return null;
    const k = n++, c = pm.colors[i];
    size.push(0); colour.push(c); id[i] = k; stack.push(i);
    while (stack.length) { const x = stack.pop(); size[k]++; for (const y of floodNear(x)) if (id[y] < 0 && pm.colors[y] === c) { id[y] = k; stack.push(y); } }
  }
  if (n > MAXR) return null;
  const adj = new Int32Array(n), of = new Int32Array(nc);
  for (let i = 0; i < FN; i++) for (const y of floodNear(i)) if (id[y] !== id[i]) adj[id[i]] |= 1 << id[y];
  for (let k = 1; k < n; k++) if (colour[k] < nc) of[colour[k]] |= 1 << k;
  return { n, size: Int8Array.from(size), adj, of, nc };
}
// The solver on one position's regions. grabs(A, F, sm, so): the best a grab does for the mover (A the regions
// grabbed, F the regions touching them, sm and so the mover's score and the other side's): 1 a win, 0 level,
// -1 a loss, -2 nothing left to grab. value(): the same with the pass counted.
function solver(G, goal) {
  const size = G.size, adj = G.adj, of = G.of, nc = G.nc;
  K1.fill(-1);
  let nodes = 0;
  const gainOf = S => { let g = 0; while (S) { const b = S & -S; S ^= b; g += size[31 - Math.clz32(b)]; } return g; };
  const grow = (F, S) => { while (S) { const b = S & -S; S ^= b; F |= adj[31 - Math.clz32(b)]; } return F; };
  const canPass = F => { let z = 0; for (let c = 0; c < nc; c++) if (!(F & of[c])) z++; return z >= 2; };   // (the blob's own colour never touches it: a second colour that grabs nothing is the pass)
  const grabs = (A, F, sm, so) => {
    nodes++;
    const h = (Math.imul(A, 0x9e3779b1) ^ Math.imul(sm + 1, 0x85ebca6b)) >>> (32 - T_BITS);
    if (K1[h] === A && K2[h] === sm) return TV[h];
    let best = -2;
    for (let c = 0; c < nc; c++) if ((F & of[c]) && sm + gainOf(F & of[c]) >= goal) { best = 1; break; }   // a win at once
    if (best < 1) for (let c = 0; c < nc; c++) {
      const S = F & of[c];
      if (!S) continue;
      const A2 = A | S, v = -value(A2, grow(F, S) & ~A2, so, sm + gainOf(S));
      if (v > best) { best = v; if (v === 1) break; }
    }
    K1[h] = A; K2[h] = sm; TV[h] = best;
    return best;
  };
  const value = (A, F, sm, so) => {
    const g = grabs(A, F, sm, so);
    if (g === -2) return 0;                                      // (the board all grabbed and nobody there: cannot happen with the target at 18 or less)
    if (g >= 0 || !canPass(F)) return g;
    return grabs(A, F, so, sm) > 0 ? -1 : 0;                     // a pass: the other side grabs and wins, or has nothing better than passing back
  };
  return { grabs, value, gainOf, grow, canPass, nodes: () => nodes };
}
// The square as it stands with `to` to move: { v: 1 | 0 | -1 for the mover, moves: [{ c, gain, v, slips }] }
// (every legal colour; slips: for a losing grab, the share of the other side's grabs that let the win go).
export function floodSolve(pm, to, cf = floodCfg(pm)) {
  const G = floodRegions(pm, cf.colors);
  if (!G) return null;
  const S = solver(G, cf.goal), A = 1, F = G.adj[0], sm = pm.score[to], so = pm.score[other(to)], blob = pm.colors[0], moves = [];
  for (let c = 0; c < cf.colors; c++) {
    if (c === blob) continue;
    const R = F & G.of[c], gain = S.gainOf(R);
    if (!R) { const g = S.grabs(A, F, so, sm); moves.push({ c, gain: 0, v: g > 0 ? -1 : 0, slips: 0 }); continue; }
    if (sm + gain >= cf.goal) { moves.push({ c, gain, v: 1, slips: 0 }); continue; }
    const A2 = A | R, F2 = S.grow(F, R) & ~A2, v = -S.value(A2, F2, so, sm + gain);
    let bad = 0, tot = 0;
    if (v < 0) for (let d = 0; d < cf.colors; d++) {
      const R2 = F2 & G.of[d];
      if (!R2) continue;
      tot++;
      const g2 = S.gainOf(R2), A3 = A2 | R2;
      if (so + g2 < cf.goal && S.value(A3, S.grow(F2, R2) & ~A3, sm + gain, so + g2) >= 0) bad++;
    }
    moves.push({ c, gain, v, slips: tot ? bad / tot : 0 });
  }
  return { v: moves.length ? Math.max(...moves.map(m => m.v)) : 0, moves, nodes: S.nodes() };
}
// What Hard has worked out about a position, for needs(): kept by the position object itself (the public view the
// square choice passes to best and then to needs, and the `after` best returns), so the other levels' reckoning
// of a square is untouched.
const KNOWN = new WeakMap();
const SURE = 12, EDGE = [1 / (1 + SURE), 0.5, SURE / (1 + SURE)];   // a side's chance of the square by its solved value (-1, 0, 1): 12 in 13 for a win in turn
function known(pm, cf, me, chance) {   // me's chance of the square as the moves each side still needs: the likelier side its grabs to the target, the other in proportion
  const o = other(me), base = q => Math.max(0.5, (cf.goal - pm.score[q]) / 3.2);
  if (chance === 0.5) { const n = (base(me) + base(o)) / 2; return { [me]: n, [o]: n }; }
  const f = chance > 0.5 ? me : o, c = Math.max(chance, 1 - chance), n = base(f);
  return { [f]: n, [other(f)]: n * c / (1 - c) };
}
// Hard's colour: a win (the biggest grab among them); else a level grab, else the pass that keeps it level
// (FLOOD_PASS of the time); else the grab the other side is likeliest to go wrong against. With it, what the
// position is worth before (the mean of moving first here and second) and after the move.
function hardPick(pm, me, rng, cf) {
  const s = floodSolve(pm, me, cf);
  if (!s) return null;
  const top = (list, key) => { const m = Math.max(...list.map(key)), t = list.filter(x => key(x) === m); return t[t.length > 1 ? randInt(rng, t.length) : 0]; };
  const grabs = s.moves.filter(m => m.gain > 0), wins = grabs.filter(m => m.v === 1), level = grabs.filter(m => m.v === 0), pass = s.moves.filter(m => !m.gain && m.v === 0);
  const m = wins.length ? top(wins, x => x.gain) : level.length ? top(level, x => x.gain) : pass.length && (!grabs.length || rng() < FLOOD_PASS) ? pass[0]
    : grabs.length ? top(grabs, x => x.slips * 100 + x.gain) : s.moves[0];
  const theirs = floodSolve(pm, other(me), cf);
  KNOWN.set(pm, known(pm, cf, me, (EDGE[s.v + 1] + 1 - EDGE[theirs.v + 1]) / 2));
  return { c: m.c, chance: EDGE[m.v + 1] };
}

// The moves p still needs: its grabs to the target at the usual rate; where Hard has solved the position (KNOWN),
// from who takes the square.
export function needs(pm, p) {
  const k = KNOWN.get(pm);
  if (k) return k[p];
  return Math.max(0.5, (floodCfg(pm).goal - pm.score[p]) / 3.2);
}
export function best(pm, me, rng, style, ctx) {
  const cf = floodCfg(pm), hard = !!(ctx && ctx.level === 'hard');
  if (cf.miss && rng() < cf.miss / 100) {                   // (the admin's settings: a mistake now and then, any colour but the blob's)
    const cs = Array.from({ length: cf.colors - 1 }, (_, k) => (k >= pm.colors[0] ? k + 1 : k)), c = cs[randInt(rng, cs.length)], a = floodApply(pm, c, me);
    return { move: c, after: { type: 'flood', colors: a.colors, owner: a.owner, score: a.score }, win: a.score[me] >= cf.goal };
  }
  const h = hard ? hardPick(pm, me, rng, cf) : null;
  if (h) {
    const a = floodApply(pm, h.c, me), after = { type: 'flood', colors: a.colors, owner: a.owner, score: a.score }, win = a.score[me] >= cf.goal;
    if (!win) KNOWN.set(after, known(after, cf, me, h.chance));
    return { move: h.c, after, win };
  }
  const b = hard ? floodHard(pm, me, ctx.until) : floodSearch(pm, me, rng);   // (Hard on a board too broken up to solve: the deep search, as the time allows)
  return { move: b.c, after: b.after, win: b.win };
}
