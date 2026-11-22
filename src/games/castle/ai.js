// Castle Smash: the computer's play.
// Its candidates are throws that pass through a few points of the other castle (its core, the roof over the core, the
// top and the middle of the wall that faces it) at a spread of elevations, flat to lobbed (castleCands). Each is played
// through the real simulation on a copy of the castle (sim.js castleShot, quick: no recording) and scored by how much
// nearer it brings the core's end: the core ended is the best there is; else the shield about the core it takes away
// (castleShield), the blocks it breaks or knocks out, and how far it shifts the core. Then its hand: the chosen throw
// is off by its level's error in aim and in power (a normal spread: `aiAim`/`aiPow`, Hard's and Easy's own). Easy
// weighs only a few of the candidates; Hard throws `aiTries` such unsteady throws in its head and keeps the best
// (a steadier hand, never a perfect one), inside `ctx.until`. Without the physics library (the page's worker, a
// page still loading) it throws at the core by geometry alone.
import { gaussOf } from '../../core/random.js';
import { other } from '../../core/util.js';
import { CS, castleAimAt, castleBox, castleCfg, castleCore, castleLib, castleMove, castleShield, castleShot } from './rules.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export function castleCands(blocks, c) {
  const core = castleCore(blocks), out = [];
  if (!core) return out;
  const cx = core[1] / 10, ch = core[2] / 10, [x0, , top] = castleBox(blocks);
  const add = (x, h, aims) => { for (const a of aims) { const s = castleAimAt(x, h, a, c.vMax); if (s) out.push(s); } };
  add(cx, ch, [0.3, 0.55, 0.8, 1.05, 1.3]);
  add(cx, top + 4, [0.95, 1.25]);
  add(x0 + 6, Math.max(12, top - 14), [0.3, 0.6]);
  add(x0 + 6, Math.max(10, top * 0.45), [0.25, 0.5]);
  return out;
}
// What a throw came to, for the computer.
export function castleScore(before, r) {
  if (r.core) return 1000;
  if (r.kind !== 'hit') return -5;
  const a = castleCore(before), b = castleCore(r.blocks), shift = a && b ? Math.hypot(a[1] - b[1], a[2] - b[2]) / 10 : 0;
  return 30 * (castleShield(before) - castleShield(r.blocks)) + 6 * (r.broke + r.off) + 5 * r.cracked + Math.min(10, shift) + Math.min(4, r.moved * 0.5);
}
export function needs(pm, p) {
  const t = pm.c[other(p)];
  return castleCore(t) ? Math.max(1, 1 + castleShield(t) / 2.2) : 0;
}
// Every candidate's score against a castle as it lies: worked out once and kept while the castle lies so (a board may
// hold several castles, and the computer is asked about each of them every turn: only the one just struck has changed).
const KEPT = new Map();
function weighed(target, c, M) {
  const key = JSON.stringify([target, c.vMax, c.ball, c.stone, c.woodTough, c.stoneTough, c.stoneHits, c.coreTough]);
  let v = KEPT.get(key);
  if (!v) { v = castleCands(target, c).map(s => castleScore(target, castleShot(M, target, s, c, true))); if (KEPT.size >= 40) KEPT.delete(KEPT.keys().next().value); KEPT.set(key, v); }
  return v;
}
const wobble = (s, err, rng) => castleMove({ aim: clamp(s.aim + gaussOf(rng) * err[0], CS.aimLo, CS.aimHi), power: clamp(s.power + gaussOf(rng) * err[1], 0, 1) });
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', c = castleCfg(pm), err = c.ai[level] || c.ai.normal, target = pm.c[other(me)], M = castleLib();
  const until = ctx && typeof ctx.until === 'function' ? ctx.until : null, late = () => !!until && until() <= 0;   // (the ms Hard may still spend: its extra throws stop there; the candidates are always all weighed)
  const all = castleCands(target, c);
  let cands = all;
  if (!cands.length) return { move: wobble({ aim: 0.8, power: 0.7 }, err, rng), q: 0 };
  if (!M) return { move: wobble(cands[Math.min(2, cands.length - 1)], err, rng), q: 0.05 };
  if (level === 'easy') { const k = Math.floor(rng() * cands.length); cands = [cands[k], cands[(k + 3) % cands.length], cands[(k + 5) % cands.length]]; }
  const sc = weighed(target, c, M);
  let top = null;
  cands.forEach(s => { const v = sc[all.indexOf(s)]; if (!top || v > top.sc) top = { s, sc: v }; });
  let move = wobble(top.s, err, rng);
  if (level === 'hard') {
    let bs = -Infinity;
    for (let k = 0; k < Math.max(1, c.tries); k++) {
      const m = k ? wobble(top.s, err, rng) : move, sc = castleScore(target, castleShot(M, target, m, c, true));
      if (sc > bs) { bs = sc; move = m; }
      if (late()) break;
    }
  }
  return { move, q: top.sc >= 1000 ? (level === 'hard' ? 0.6 : level === 'easy' ? 0.25 : 0.45) : 0.03 };
}
