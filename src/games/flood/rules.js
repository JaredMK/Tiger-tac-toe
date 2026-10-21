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
