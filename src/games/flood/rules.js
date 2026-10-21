// Flood: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { other } from '../../core/util.js';
import { tune, tuneLive } from '../../core/tune.js';

// Flood: a 6x6 grid of five colours. The top-left cell starts the blob, shared by both players and not
// scored. A move picks a colour other than the blob's: the whole blob takes it, and every cell of that
// colour joined to the blob is absorbed and scored to the mover (shown in their colour). First to 18 of
// the 35 cells wins (with 35 there is no tie).
export const FLOOD = { n: 6, colors: 5, goal: 18 };
// A square's own (the admin's settings: the colours, the target, the computer's mistakes; FLOOD without a type).
export const floodCfg = m => Object.assign({}, FLOOD, tune(m));
export const floodNear = i => { const n = FLOOD.n, r = Math.floor(i / n), c = i % n, out = []; if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n); if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1); return out; };
// The cells a colour would absorb, in waves out from the blob (each wave one step further): [[...], [...]].
export function floodWaves(colors, owner, c) {
  const inBlob = owner.map(x => x != null), seen = inBlob.slice(), waves = [];
  let front = [];
  owner.forEach((x, i) => { if (x != null) for (const k of floodNear(i)) if (!seen[k] && colors[k] === c) { seen[k] = true; front.push(k); } });
  while (front.length) {
    waves.push(front);
    const next = [];
    for (const i of front) for (const k of floodNear(i)) if (!seen[k] && colors[k] === c) { seen[k] = true; next.push(k); }
    front = next;
  }
  return waves;
}
export const floodGain = (pm, c) => floodWaves(pm.colors, pm.owner, c).reduce((s, w) => s + w.length, 0);
export function floodApply(pm, c, p) {
  const colors = pm.colors.slice(), owner = pm.owner.slice(), score = { X: pm.score.X, O: pm.score.O };
  const waves = floodWaves(colors, owner, c);
  owner.forEach((x, i) => { if (x != null) colors[i] = c; });
  for (const w of waves) for (const i of w) { owner[i] = p; colors[i] = c; score[p] += 1; }
  return { colors, owner, score, waves };
}
// The computer, two moves deep: the colour with the most cells for it less the other player's best answer.
export function floodSearch(pm, me, rng) {
  const o = other(me), blob = pm.colors[0], { colors: nc, goal } = floodCfg(pm);
  let best = null;
  for (let c = 0; c < nc; c++) {
    if (c === blob) continue;
    const a = floodApply(pm, c, me), gain = a.score[me] - pm.score[me];
    let reply = 0;
    if (a.score[me] < goal) for (let d = 0; d < nc; d++) { if (d === c) continue; const g = floodGain({ colors: a.colors, owner: a.owner }, d); if (g > reply) reply = g; }
    const v = (a.score[me] >= goal ? 1000 : 0) + (gain > 0 ? 100 : 0) + gain - 0.6 * reply + (rng ? rng() * 0.01 : 0);   // a colour that grabs nothing only when none grabs anything (else both sides could stall)
    if (!best || v > best.v) best = { c, v, gain, after: { type: 'flood', colors: a.colors, owner: a.owner, score: a.score }, win: a.score[me] >= goal };
  }
  return best;
}
// ---- Hard: iterative deepening negamax with alpha-beta and a transposition table ----
// The grid as bytes (the colours; the owners: 0 nobody, 1 the searcher, 2 the other side, 3 the start),
// copied a ply at a time for the undo (36 cells: nothing). Only colours that grab something are played (one
// that grabs nothing is a pass, and the blob always touches a cell it can take until someone has won), in
// order of what they grab, the table's best first. The leaf value: the lead in cells; the goal reached, a
// win (sooner better). Deeper each round until the time (until: the ms left, checked every 256 nodes) or,
// without a clock, FLOOD_HARD.depth plies or FLOOD_HARD.nodes nodes; the last round completed is the
// answer (a forced win or loss ends the rounds early). The table is a fixed array keyed by two hashes
// (Zobrist over the owners and the blob's colour, from a fixed seed), emptied every call.
export const FLOOD_HARD = { depth: 10, nodes: 20000, win: 1000 };
const FN = FLOOD.n * FLOOD.n;
const fzob = (() => { let s = 0x1b873593 >>> 0; const t = new Uint32Array(FN * 8 + 16); for (let i = 0; i < t.length; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; t[i] = s; } return t; })();
const FNB = (() => { const at = new Int32Array(FN + 1), of = []; for (let i = 0; i < FN; i++) { at[i] = of.length; for (const k of floodNear(i)) of.push(k); } at[FN] = of.length; return { at, of: Int8Array.from(of) }; })();
const FTT_N = 1 << 14, FTT = { key: new Float64Array(FTT_N), v: new Int32Array(FTT_N), d: new Int8Array(FTT_N), f: new Int8Array(FTT_N), m: new Int8Array(FTT_N) };
const FQ = new Int8Array(FN), FSEEN = new Uint8Array(FN);
// The best colour for me: { c, v, gain, after, win, depth, nodes }.
export function floodHard(pm, me, until = null, cap = FLOOD_HARD) {
  const { colors: nc, goal } = floodCfg(pm), WIN = cap.win, at = FNB.at, of = FNB.of;
  const col = Uint8Array.from(pm.colors), own = new Uint8Array(FN), score = [0, pm.score[me], pm.score[other(me)]];
  const COL = Array.from({ length: FN + 1 }, () => new Uint8Array(FN)), OWN = Array.from({ length: FN + 1 }, () => new Uint8Array(FN)), GAINS = Array.from({ length: FN + 1 }, () => new Int8Array(8)), ORD = Array.from({ length: FN + 1 }, () => new Int8Array(8));
  let h1 = 0, h2 = 0, nodes = 0, stop = false;
  const hashOwn = (k, o) => { h1 ^= fzob[8 * k + o]; h2 ^= fzob[8 * k + 4 + o]; };
  const hashBlob = c => { h1 ^= fzob[FN * 8 + c]; h2 ^= fzob[FN * 8 + 8 + c]; };
  pm.owner.forEach((x, k) => { if (x == null) return; own[k] = x === me ? 1 : x === '-' ? 3 : 2; hashOwn(k, own[k]); });
  hashBlob(col[0]);
  FTT.d.fill(-1);
  // the cells colour c would grab (the blob's neighbours of that colour and on through them), into FQ; how many
  const grab = c => {
    let qt = 0;
    FSEEN.fill(0);
    for (let i = 0; i < FN; i++) { if (!own[i]) continue; for (let j = at[i], z = at[i + 1]; j < z; j++) { const k = of[j]; if (!own[k] && !FSEEN[k] && col[k] === c) { FSEEN[k] = 1; FQ[qt++] = k; } } }
    for (let qh = 0; qh < qt; qh++) { const i = FQ[qh]; for (let j = at[i], z = at[i + 1]; j < z; j++) { const k = of[j]; if (!own[k] && !FSEEN[k] && col[k] === c) { FSEEN[k] = 1; FQ[qt++] = k; } } }
    return qt;
  };
  const play = (c, s, n, ply) => {   // colour c for s, its n cells in FQ (grab(c) just called); the position saved for the undo
    COL[ply].set(col); OWN[ply].set(own);
    hashBlob(col[0]);
    for (let i = 0; i < FN; i++) if (own[i]) col[i] = c;
    for (let q = 0; q < n; q++) { const k = FQ[q]; own[k] = s; col[k] = c; hashOwn(k, s); }
    score[s] += n;
    hashBlob(c);
  };
  const unplay = (c, s, n, ply) => {
    hashBlob(c);
    for (let q = 0; q < n; q++) { const k = FQ[q]; hashOwn(k, s); }
    score[s] -= n;
    col.set(COL[ply]); own.set(OWN[ply]);
    hashBlob(col[0]);
  };
  const order = (ply) => {   // the colours that grab something, most first; GAINS their grabs
    const g = GAINS[ply], o = ORD[ply], blob = col[0];
    let m = 0;
    for (let c = 0; c < nc; c++) {
      if (c === blob) continue;
      const n = grab(c);
      if (!n) continue;
      g[c] = n;
      let q = m++;
      while (q > 0 && g[o[q - 1]] < n) { o[q] = o[q - 1]; q--; }
      o[q] = c;
    }
    return m;
  };
  const search = (s, depth, alpha, beta, ply) => {   // the value for s, s to move
    if ((++nodes & 255) === 0 && (until ? until() <= 0 : nodes > cap.nodes)) { stop = true; return 0; }
    const key = h1 * 1048576 + (h2 & 0xfffff), x = ((h1 ^ h2) >>> 0) & (FTT_N - 1), hit = FTT.key[x] === key && FTT.d[x] >= 0;
    let first = -1;
    if (hit) {
      if (FTT.d[x] >= depth) {
        const v = FTT.v[x], f = FTT.f[x];
        if (f === 0) return v;
        if (f === 1) { if (v > alpha) alpha = v; } else if (v < beta) beta = v;
        if (alpha >= beta) return v;
      }
      first = FTT.m[x];
    }
    const t = 3 - s, g = GAINS[ply], o = ORD[ply], m = order(ply), a0 = alpha;
    if (depth === 0) return score[s] - score[t];
    if (!m) return score[s] - score[t];                        // (nothing to grab: cannot happen before a win)
    let best = -Infinity, bm = -1;
    for (let i = -1; i < m; i++) {
      const c = i < 0 ? first : o[i];
      if (c < 0 || (i >= 0 && c === first)) continue;
      const n = grab(c);
      play(c, s, n, ply);
      const v = score[s] >= goal ? WIN - ply : -search(t, depth - 1, -beta, -alpha, ply + 1);
      unplay(c, s, n, ply);
      if (stop) return 0;
      if (v > best) { best = v; bm = c; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    FTT.key[x] = key; FTT.v[x] = best; FTT.d[x] = depth; FTT.f[x] = best <= a0 ? 2 : best >= beta ? 1 : 0; FTT.m[x] = bm;
    return best;
  };
  const m0 = order(0), cs = m0 ? Array.from(ORD[0].subarray(0, m0)) : Array.from({ length: nc }, (_, c) => c).filter(c => c !== col[0]);
  let bc = cs[0], bv = 0, depth = 0;
  const max = until ? FN : cap.depth;
  for (let d = 1; d <= max && !stop; d++) {
    let alpha = -Infinity, top = bc, pick = -1;
    for (let i = -1; i < cs.length; i++) {
      const c = i < 0 ? top : cs[i];
      if (i >= 0 && c === top) continue;
      const n = grab(c);
      play(c, 1, n, 0);
      const v = score[1] >= goal ? WIN - 1 : -search(2, d - 1, -Infinity, -alpha, 1);
      unplay(c, 1, n, 0);
      if (stop) break;
      if (v > alpha) { alpha = v; pick = c; }
    }
    if (stop) break;
    bc = pick; bv = alpha; depth = d;
    if (Math.abs(bv) >= WIN - FN) break;                      // decided: no round deeper changes it
  }
  const a = floodApply(pm, bc, me);
  return { c: bc, v: bv, gain: a.score[me] - pm.score[me], after: { type: 'flood', colors: a.colors, owner: a.owner, score: a.score }, win: a.score[me] >= goal, depth, nodes };
}
export function create(type, rng) {   // five colours at random; the start cell's neighbours never its colour (the blob starts as one cell)
  const nc = tuneLive(type).colors;                          // (the admin's settings: how many colours)
  const r = needRng(rng), N = FLOOD.n * FLOOD.n, colors = Array.from({ length: N }, () => randInt(r, nc));
  for (const k of floodNear(0)) while (colors[k] === colors[0]) colors[k] = randInt(r, nc);
  const owner = new Array(N).fill(null); owner[0] = '-';      // '-': the blob's start, nobody's
  return { type, colors, owner, score: { X: 0, O: 0 }, last: null };
}
export function apply(mini, p, m, rng, idx) {   // a colour other than the blob's: the blob takes it and grows
  const cf = floodCfg(mini);
  if (!Number.isInteger(m) || m < 0 || m >= cf.colors || m === mini.colors[0]) return { ok: false, reason: 'bad' };
  const before = mini.colors[0], a = floodApply(mini, m, p);
  mini.colors = a.colors; mini.owner = a.owner; mini.score = a.score;
  mini.last = { by: p, color: m, from: before, waves: a.waves, gain: a.waves.reduce((t, w) => t + w.length, 0) };
  if (mini.score[p] >= cf.goal) return { ok: true, outcome: 'win', note: 'flood' };
  return { ok: true, outcome: 'continue', note: mini.last.gain ? 'grow' : 'none' };
}
export function publicView(mini) {
  return { type: 'flood', colors: mini.colors.slice(), owner: mini.owner.slice(), score: { X: mini.score.X, O: mini.score.O } };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(Array.from({ length: floodCfg(mini).colors }, (_, c) => c).filter(c => c !== mini.colors[0]));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.flood = { color: l.color, from: l.from, waves: l.waves.map(w => w.slice()), gain: l.gain, score: { X: mini.score.X, O: mini.score.O } }; return;
}
export function flashMs(f, winLen, won) {
  return FLOOD_MS.base + (f.flood ? f.flood.waves.length : 0) * FLOOD_MS.wave + (won ? 600 : 0);
}
export const FLOOD_MS = { base: 650, wave: 120 };
