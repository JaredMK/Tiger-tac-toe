// Trail Race: the computer's play. A position is how many steps the other player still needs to their far row less
// how many it needs itself (rules.js trailDist: round both trails, never back; no way at all counts as a long way).
// Normal takes the move that leaves the best position, any of the best at random; Hard looks at the other player's
// best answer to each move first (within ctx.until); Easy mostly steps forward, a move at random three times in ten.
import { trailCfg, trailDist, trailMoves, trailTry } from './rules.js';

const far = (mini, p) => { const d = trailDist(mini, p); return d === Infinity ? mini.n * 3 : d; };
const lead = (mini, me) => far(mini, me === 'X' ? 'O' : 'X') - far(mini, me);
export function needs(pm, p) { const c = trailCfg(pm), d = far(pm, p); return pm.final && pm.final.by === p ? 1 : d <= 0 ? 0 : Math.max(1, Math.ceil(d / c.cells)); }
export function best(pm, me, rng, style, ctx) {
  const c = trailCfg(pm), level = (ctx && ctx.level) || 'normal', o = me === 'X' ? 'O' : 'X', moves = trailMoves(pm, me, c.cells);
  if (pm.final && pm.final.by === me) return { move: 'claim', q: 1 };
  if (!moves.length) return { move: null, q: 0 };
  const win = moves.find(m => trailTry(pm, me, m, c.cells).won); if (win) return { move: win, q: 1 };
  if (level === 'easy' && rng() < 0.3) return { move: moves[Math.floor(rng() * moves.length)], q: 0 };
  const until = ctx && typeof ctx.until === 'function' ? ctx.until : null;
  const scored = moves.map(m => {
    const t = trailTry(pm, me, m, c.cells); let v = lead(t.mini, me) + m.length * 0.01;
    if (level === 'hard' && !(until && until() < 5)) {              // the other player's best answer: a win for them is the worst, else the position they leave
      let worst = Infinity;
      for (const a of trailMoves(t.mini, o, c.cells)) { const u = trailTry(t.mini, o, a, c.cells); worst = Math.min(worst, u.won ? -100 : lead(u.mini, me)); if (worst <= -100) break; }
      if (worst !== Infinity) v = worst + v * 0.05;
    }
    return { m, v, k: rng() };
  }).sort((a, b) => (b.v - a.v) || (a.k - b.k));
  const top = scored.filter(e => e.v >= scored[0].v - (level === 'hard' ? 0.001 : 0.25));
  return { move: top[Math.floor(rng() * top.length)].m, q: 0 };
}
