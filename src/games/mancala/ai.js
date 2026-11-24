// Mancala Race: the computer's play. Easy sows any pit. Normal takes the pit that banks most this turn, a go-again
// counted as worth a little more, then the one that leaves the other side least to capture. Hard searches: whole
// turns for each side (go-agains played on), a few turns deep, by the difference in banks (and who gets there first).
// Both know the end by an empty side (`v: 2`, rules.js): a sowing that leaves either side with no seeds ends the
// square there, every seed left going to its owner's bank, so it is valued by the banks it ends on (a win, a loss or a
// draw), never by the seeds it banks.
import { tune } from '../../core/tune.js';
import { mancCfg, mancFinal, mancMoves, mancSow } from './rules.js';

const other = p => (p === 'X' ? 'O' : 'X');
const WIN = 1000;
function search(pits, bank, p, me, c, depth) {
  if (bank[me] >= c.target) return WIN + depth; if (bank[other(me)] >= c.target) return -WIN - depth;
  const fin = c.sweep ? mancFinal(pits, bank) : null;            // (a side with no seeds: the sweep has ended the square)
  if (fin) return fin[me] === fin[other(me)] ? 0 : fin[me] > fin[other(me)] ? WIN + depth : -WIN - depth;
  const moves = pits[p].map((v, i) => (v > 0 ? i : -1)).filter(i => i >= 0);
  if (!moves.length) return bank[me] === bank[other(me)] ? 0 : bank[me] > bank[other(me)] ? 500 : -500;   // (a square from before: nothing to sow on your turn ends it)
  if (depth <= 0) return bank[me] - bank[other(me)];
  let best = p === me ? -Infinity : Infinity;
  for (const i of moves) { const r = mancSow(pits, bank, p, i, c), v = search(r.pits, r.bank, r.again ? p : other(p), me, c, r.again ? depth : depth - 1); best = p === me ? Math.max(best, v) : Math.min(best, v); }
  return best;
}
// A sowing that ends the square by the sweep: its final banks (null: the square goes on, or the target took it first).
const sweptBy = (r, p, c) => (c.sweep && r.bank[p] < c.target ? mancFinal(r.pits, r.bank) : null);
export function needs(pm, p) { const c = mancCfg(pm), left = c.target - pm.bank[p]; return left <= 0 ? 0 : Math.max(1, left / 2); }
// Each level's play is its settings (meta.js TUNE, Computer: Easy / Normal / Hard): how far it looks (`aiLook<Level>`:
// 0 any pit, 1 the pit that banks most this turn (a go-again a little more), 2 or more a search over whole turns for
// each side, that many turns deep) and, at look 1, whether it guards against the other side's best reply
// (`aiGuard<Level>`: less half what they could bank with one sowing after it, a capture above all).
const LV = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const LOOK = { easy: 1, normal: 1, hard: 3 }, GUARD = { easy: 'off', normal: 'on', hard: 'on' };
export function levelCfg(pm, level) {
  const t = tune(pm), L = LV[level] ? level : 'normal', k = LV[L], n = Number(t['aiLook' + k]);
  return { look: Number.isFinite(n) && t['aiLook' + k] !== '' && t['aiLook' + k] != null ? n : LOOK[L], guard: (t['aiGuard' + k] || GUARD[L]) === 'on' };
}
export function best(pm, me, rng, style, ctx) {
  const c = mancCfg(pm), level = (ctx && ctx.level) || 'normal', cfg = levelCfg(pm, level), moves = mancMoves(pm, me), pick = a => a[Math.floor(rng() * a.length)], o = other(me);
  if (!moves.length) return { move: 'end', q: 0 };
  const q = c.target - pm.bank[me] <= 3 ? 0.4 : 0.05;
  if (cfg.look <= 0) return { move: pick(moves), q };
  const scored = moves.map(i => {
    const r = mancSow(pm.pits, pm.bank, me, i, c), fin = sweptBy(r, me, c);
    if (cfg.look >= 2) {                                         // (a win at once is taken, never a later one; a loss at once only with nothing else left)
      const now = r.bank[me] >= c.target ? 1 : fin ? Math.sign(fin[me] - fin[o]) : null, d = cfg.look - 1;
      return { i, v: now === 1 ? 2 * WIN : now === -1 ? -2 * WIN : now === 0 ? 0 : search(r.pits, r.bank, r.again ? me : o, me, c, r.again ? d + 1 : d) };
    }
    if (fin) return { i, v: fin[me] === fin[o] ? 0 : fin[me] > fin[o] ? 100 : -100 };   // (the square ends here: won, lost or level)
    // Look 1: what it banks now, a go-again a little more, and (guarding) less the most the other side could bank with
    // one sowing after (a reply that ends the square by the sweep: what the banks it ends on give them over this side)
    let reply = 0;
    if (cfg.guard && !r.again) for (const j of r.pits[o].map((v, k) => (v > 0 ? k : -1)).filter(k => k >= 0)) {
      const s = mancSow(r.pits, r.bank, o, j, c), f2 = sweptBy(s, o, c);
      reply = Math.max(reply, f2 ? f2[o] - r.bank[o] - (f2[me] - r.bank[me]) : s.bank[o] - r.bank[o] + (s.again ? 0.5 : 0));
    }
    return { i, v: (r.bank[me] >= c.target ? 100 : 0) + r.bank[me] - pm.bank[me] + (r.again ? 0.8 : 0) - reply * 0.5 };
  });
  const top = Math.max(...scored.map(s => s.v));
  return { move: pick(scored.filter(s => s.v >= top - 1e-9)).i, q };
}
// A weaker pit a person might sow (the mistake rate, core/ai.js aiSlip): any other pit with seeds, the ones that bank
// something now first (a pit that looks fine on its face).
export function worse(pm, me, rng, ctx) {
  const c = mancCfg(pm), moves = mancMoves(pm, me).filter(i => i !== (ctx && ctx.best));
  if (!moves.length) return null;
  return moves[Math.floor(rng() * moves.length)];
}
