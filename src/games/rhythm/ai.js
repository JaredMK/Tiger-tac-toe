// Rhythm Tap: the computer's play. It stands in for a finger: each note is tapped off its beat by an error of its
// level's size (ms, a normal spread: `aiMs`), or not at all with its level's chance (`aiMiss`); the round ends, as
// anyone's, at the miss that takes its last life.
import { gaussOf } from '../../core/random.js';
import { rhythmCfg, rhythmChart, rhythmScore } from './rules.js';

function taps(pm, me, rng, level) {
  const c = rhythmCfg(pm), [sd, miss] = c.ai[level] || c.ai.normal;
  return rhythmChart(pm, me).map(() => (rng() < miss / 100 ? null : Math.round(gaussOf(rng) * sd)));
}
const TYP = new Map();
function typical(pm, p) {                                          // about what a Normal round is worth on these settings (30 made-up rounds, kept)
  const c = rhythmCfg(pm), key = JSON.stringify([c.secs, c.beat, c.win, c.lives, c.dense, c.ai.normal]);
  if (!TYP.has(key)) { let s = 0, k = 0; const r = (() => { let x = 12345; return () => (x = (x * 16807) % 2147483647) / 2147483647; })(); for (; k < 30; k++) s += rhythmScore(c, rhythmChart(pm, p), taps(pm, p, r, 'normal')).pts; TYP.set(key, Math.max(1, s / k)); }
  return TYP.get(key);
}
export function needs(pm, p) { const c = rhythmCfg(pm), need = c.target - pm.score[p]; return need <= 0 ? 0 : Math.max(1, need / typical(pm, p)); }
export function best(pm, me, rng, style, ctx) { const c = rhythmCfg(pm); return { move: { d: taps(pm, me, rng, (ctx && ctx.level) || 'normal') }, q: c.target - pm.score[me] <= typical(pm, me) ? 0.5 : 0 }; }
