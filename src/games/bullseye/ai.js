// Bullseye: the computer's play.
import { BULLS, bullsAimAt } from './rules.js';
import { tune } from '../../core/tune.js';

// The computer stops its two lines as a hand would: a bullseye, the inner ring, the rest of the board or a miss at
// its rates (the admin's: aiBull, aiMid, aiBoard, each counting the ones inside it), slipping as its lines speed up
// (a faster sweep is harder to stop where it wants). Easy a fifth worse, Hard an eighth better.
const LEVEL = { easy: 0.8, normal: 1, hard: 1.12 };
export function bullsRates(speed, t, level) {   // (t: the square's settings; the rates are chances of landing in that ring and no other)
  const f = Math.pow(1 / Math.max(1, speed), BULLS.ai.worse) * (LEVEL[level] || 1);
  const bull = Math.min(0.95, t.aiBull / 100 * f), mid = Math.min(0.97, Math.max(t.aiBull, t.aiMid) / 100 * f), all = Math.min(0.99, Math.max(t.aiBull, t.aiMid, t.aiBoard) / 100 * f);
  return { bull, mid: mid - bull, board: all - mid };
}
export function needs(pm, p) {
  const t = tune(pm), cfg = pm.cfg; let n = 0, pts = pm.pts[p], s = pm.speed[p] || 1;
  while (pts < t.goal && n < 60) { const r = bullsRates(s, t), hit = r.bull + r.mid + r.board; pts += r.bull * t.bullPts + r.mid * BULLS.midPts + r.board * BULLS.boardPts; s *= 1 + (cfg.ramp - 1) * hit; n++; }
  return Math.max(1, n);
}
export function best(pm, me, rng, style, ctx) {   // a ring at its rates, and a spot in it to match: the lines stopped there
  const t = tune(pm), r = bullsRates(pm.speed[me] || 1, t, ctx && ctx.level), u = rng(), cfg = pm.cfg, [cx, cy] = BULLS.at;
  const zone = u < r.bull ? 'bull' : u < r.bull + r.mid ? 'mid' : u < r.bull + r.mid + r.board ? 'board' : 'miss';
  let pt;
  if (zone === 'miss') {
    for (let k = 0; k < 60; k++) { pt = [2 + rng() * (BULLS.w - 4), 2 + rng() * (BULLS.wall - 4)]; if (Math.hypot(pt[0] - cx, pt[1] - cy) > cfg.board * 1.12 + 0.5) break; }
  } else {
    const lo = zone === 'bull' ? 0 : zone === 'mid' ? cfg.bull * 1.12 + 0.2 : cfg.mid * 1.06 + 0.2, hi = zone === 'bull' ? cfg.bull * 0.85 : zone === 'mid' ? cfg.mid * 0.92 : cfg.board * 0.92;
    const rad = lo + Math.sqrt(rng()) * Math.max(0, hi - lo), th = rng() * Math.PI * 2;
    pt = [cx + Math.cos(th) * rad, cy + Math.sin(th) * rad];
  }
  let q = 0; const need = t.goal - pm.pts[me];
  if (need <= t.bullPts) q += r.bull; if (need <= BULLS.midPts) q += r.mid; if (need <= BULLS.boardPts) q += r.board;
  return { move: bullsAimAt(pt[0], pt[1]), q: Math.min(0.95, q) };
}
