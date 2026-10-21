// Bullseye: the computer's play.
import { r3 } from '../../core/util.js';
import { BULLS, bullsRates } from './rules.js';
import { tune } from '../../core/tune.js';

export function needs(pm, p) {
  const t = tune(pm); let n = 0, pts = pm.pts[p], s = pm.speed[p]; while (pts < t.goal && n < 60) { const r = bullsRates(s, t), e = r.bull * t.bullPts + r.board * BULLS.boardPts; pts += e; s *= 1 + (pm.cfg.ramp - 1) * (r.bull + r.board); n++; } return Math.max(1, n);
}
export function best(pm, me, rng, style, ctx) {   // the bullseye, the board or a miss at its rates (15%, 45%, 40% at the start), and a spot to match
  const t = tune(pm), r = bullsRates(pm.speed[me], t), u = rng(), cfg = pm.cfg, [cx, cy] = pm.pos;
  const kind = u < r.bull ? 'bull' : u < r.bull + r.board ? 'board' : 'miss';
  let pt;
  if (kind === 'miss') {
    for (let k = 0; k < 60; k++) { pt = [2 + rng() * (BULLS.w - 4), 2 + rng() * (BULLS.h - 4)]; if (Math.hypot(pt[0] - cx, pt[1] - cy) > cfg.board * 1.12 + 0.5) break; }
  } else {
    const lo = kind === 'bull' ? 0 : Math.min(cfg.bull * 1.12 + 0.2, cfg.board * 0.9), hi = kind === 'bull' ? cfg.bull * 0.85 : cfg.board * 0.92;
    const rad = lo + Math.sqrt(rng()) * (hi - lo), th = rng() * Math.PI * 2;
    pt = [cx + Math.cos(th) * rad, cy + Math.sin(th) * rad];
  }
  return { move: { x: r3(Math.max(0, Math.min(1, pt[0] / BULLS.w))), y: r3(Math.max(0, Math.min(1, pt[1] / BULLS.h))) }, q: Math.min(0.95, (r.bull * t.bullPts + r.board) / 2) };
}
