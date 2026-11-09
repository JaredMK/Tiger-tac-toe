// Cup Pong: the computer's play.
import { randInt } from '../../core/random.js';
import { PONG, pongAimAt, pongAimXY, pongThrow } from './rules.js';
import { tune } from '../../core/tune.js';

const MAKE = 0.5;                                     // about what a throw at a cup makes (needs, and q when nothing better is known)
export function needs(pm, p) {
  return Math.max(1, pm.cups[p].filter(Boolean).length / MAKE);
}
const gauss = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
// The chance a throw aimed at table point (x, y) sinks a cup, by sampling: the computer's own error (eAim, ePower)
// on top of the square's scatter, against the cups standing (a near miss on one cup can drop into its neighbour).
export function pongMakeOdds(cups, x, y, eAim, ePower, t, rng, n = 160) {
  const a = pongAimXY(x, y);
  let made = 0;
  for (let k = 0; k < n; k++) if (pongThrow(cups, a.aim + gauss(rng) * eAim, a.power + gauss(rng) * ePower, rng, t).sunk) made++;
  return made / n;
}
// Normal aims at a cup still standing (a random one), with its error (aiAim, aiPower: the admin's). Easy is six times as
// loose. Hard aims to make: it tries each standing cup's centre and the points between standing cups (where one
// cup's rim miss is another's make), weighs each by sampling with half the error, and throws at the best; its q is
// that chance. No drift to allow for: the table has none (the scatter is the only luck).
export function best(pm, me, rng, style, ctx) {
  const up = pm.cups[me].map((c, k) => (c ? k : -1)).filter(k => k >= 0), t = tune(pm), level = ctx && ctx.level;
  if (!up.length) return { move: pongAimAt(0), q: 0 };
  const loose = level === 'easy' ? 6 : level === 'hard' ? 0.5 : 1, eAim = t.aiAim * loose, ePower = t.aiPower * loose;
  let target, q = MAKE;
  if (level === 'hard') {
    const pts = up.map(k => PONG.cups[k]);
    for (let i = 0; i < up.length; i++) for (let j = i + 1; j < up.length; j++) pts.push([(PONG.cups[up[i]][0] + PONG.cups[up[j]][0]) / 2, (PONG.cups[up[i]][1] + PONG.cups[up[j]][1]) / 2]);
    if (up.length === 3) pts.push([0, (0.825 + 0.93 * 2) / 3]);
    let bestQ = -1;
    for (const [x, y] of pts) { const o = pongMakeOdds(pm.cups[me], x, y, eAim, ePower, t, rng); if (o > bestQ) { bestQ = o; target = [x, y]; } }
    q = bestQ;
  } else target = PONG.cups[up[randInt(rng, up.length)]];
  const a = pongAimXY(target[0], target[1]);
  return { move: { aim: Math.max(-1, Math.min(1, a.aim + gauss(rng) * eAim)), power: Math.max(0, Math.min(1, a.power + gauss(rng) * ePower)) }, q };
}
