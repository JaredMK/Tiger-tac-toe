// Peg Jump Race: the computer's play. A position is worth the rows its pegs have crossed less the other side's
// (`value`). Normal takes the move that gains most now (a jump's chain played on while it gains), and thinks twice about a
// move that hands the other side a jump (`aiWary`). Easy plays the same greedy way without that care (`aiWaryEasy` off)
// and slips more often (its mistake rate: any legal move). Hard looks ahead: its whole turn, the other side's best reply,
// its own best turn after (a search over whole turns, chains included, `aiDepthHard` turns deep), within `ctx.until`.
import { other } from '../../core/util.js';
import { pegDir, pegMoves } from './rules.js';
import { tune } from '../../core/tune.js';

const clone = m => ({ rows: m.rows, cols: m.cols, pegs: { X: m.pegs.X.map(q => (q ? q.slice() : null)), O: m.pegs.O.map(q => (q ? q.slice() : null)) }, home: { X: m.home.X, O: m.home.O }, hop: m.hop ? { by: m.hop.by, k: m.hop.k } : null });
const crossed = (m, p) => m.pegs[p].reduce((s, q) => s + (q ? (p === 'X' ? m.rows - 1 - q[0] : q[0]) : m.rows - 0.4), 0);   // (a peg home: a little more than the far row)
export const value = (m, p) => crossed(m, p) - crossed(m, other(p));
function play(m, p, mv) {                                         // the move made on a copy: { m, more }
  const c = clone(m), far = p === 'X' ? 0 : c.rows - 1;
  c.pegs[p][mv.k] = mv.home ? null : mv.to.slice(); if (mv.home) c.home[p]++;
  void far; c.hop = null;
  if (mv.jump && !mv.home) { c.hop = { by: p, k: mv.k }; if (!pegMoves(c, p).length) c.hop = null; }
  return c;
}
// Every whole turn p can make from m: [{ first (its first move), m (the position after) }], chains to every stopping place.
function turns(m, p, first, out, depth) {
  for (const mv of pegMoves(m, p)) {
    const c = play(m, p, mv), f = first || mv;
    if (c.hop && depth < 6) { const stop = clone(c); stop.hop = null; out.push({ first: f, m: stop }); turns(c, p, f, out, depth + 1); } else { c.hop = null; out.push({ first: f, m: c }); }
  }
  return out;
}
const done = (m, p) => m.pegs[p].every(q => !q);
function search(m, p, me, depth, until) {
  if (done(m, me)) return 100 + depth; if (done(m, other(me))) return -100 - depth;
  if (depth === 0 || (typeof until === 'function' && until() <= 0)) return value(m, me);   // (ctx.until: the ms a Hard search may still spend; none: a fixed depth)
  const base = clone(m); if (base.hop && base.hop.by !== p) base.hop = null;
  const ts = turns(base, p, null, [], 0);
  if (!ts.length) return search(base, other(p), me, depth - 1, until);
  let best = p === me ? -Infinity : Infinity;
  for (const t of ts) { const v = search(t.m, other(p), me, depth - 1, until); best = p === me ? Math.max(best, v) : Math.min(best, v); }
  return best;
}
// The turns a side still needs: the rows still to cross, at about a row and a third a turn.
export function needs(pm, p) { const left = pm.pegs[p].reduce((s, q) => s + (q ? (p === 'X' ? q[0] : pm.rows - 1 - q[0]) : 0), 0); return left <= 0 ? 0 : Math.max(1, left / 1.35); }
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', all = pegMoves(pm, me), pick = a => a[Math.floor(rng() * a.length)], q = pm.pegs[me].filter(Boolean).length <= 1 ? 0.5 : 0.05;
  if (!all.length) return { move: pm.hop && pm.hop.by === me ? 'stop' : 'pass', q: 0 };
  const out = m => ({ k: m.k, to: m.to });
  const t = tune(pm), depth = Math.max(1, Math.min(4, Math.round(Number(t.aiDepthHard) || 2))), wary = level === 'easy' ? t.aiWaryEasy === 'on' : t.aiWary !== 'off';
  const base = clone(pm), ts = turns(base, me, null, [], 0);
  let scored;
  if (level === 'hard') scored = ts.map(t => ({ t, v: search(t.m, other(me), me, depth, ctx && ctx.until) + value(t.m, me) * 0.01 }));
  else scored = ts.map(t => { const theirs = pegMoves(t.m, other(me)).some(x => x.jump), had = pegMoves(Object.assign(clone(pm), { hop: null }), other(me)).some(x => x.jump); return { t, v: value(t.m, me) - (wary && theirs && !had ? 0.6 : 0) }; });
  const top = Math.max(...scored.map(s => s.v)), bestTurns = scored.filter(s => s.v >= top - 1e-9);
  // mid-chain, stopping here may be the best "turn": the position as it stands
  if (pm.hop && pm.hop.by === me) { const stay = level === 'hard' ? search(Object.assign(clone(pm), { hop: null }), other(me), me, depth, ctx && ctx.until) + value(pm, me) * 0.01 : value(pm, me); if (stay > top + 1e-9) return { move: 'stop', q }; }
  return { move: out(pick(bestTurns).t.first), q };
}
void pegDir;
