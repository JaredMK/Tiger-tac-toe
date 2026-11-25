'use strict';
// The computer against itself in one mini-game (the December 2026 batch's simulations: `npm run sim -- <game>`): N dealt
// squares between two levels, X first. A turn is a player's stretch of moves until the turn passes. Returns each
// player's turns (mean and median), the winner's, the first mover's share of the decided squares, the draws and any
// square that never ended.
const E = require('../engine.js');

const median = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function duel(type, lx, lo, N, tuneSet, opts) {
  const o = opts || {};
  E.setTune(type, tuneSet || null);
  const each = [], winner = [], out = { first: 0, draws: 0, open: 0, decided: 0, moves: 0 };
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng(`${type}-duel:${o.seed || ''}:${g}`), m = E.newMini(type, rng), lv = { X: lx, O: lo }, n = { X: 0, O: 0 };
      let p = 'X', fresh = true, done = false;
      for (let k = 0; k < (o.cap || 3000); k++) {
        if (fresh) n[p]++;
        const b = E.localBest(E.publicMini(m, p), p, rng, {}, { level: lv[p], until: null });
        const r = E.applyMove(m, p, b.move, rng);
        if (!r.ok) throw new Error(`${type}: the computer's move was refused (${r.reason}): ${JSON.stringify(b.move)}`);
        out.moves++;
        if (r.outcome !== 'continue') {
          done = true;
          if (r.outcome === 'draw') out.draws++;
          else { const w = r.winner || p; out.decided++; if (w === 'X') out.first++; each.push((n.X + n.O) / 2); winner.push(n[w]); }
          break;
        }
        if (!r.again && typeof (E.rulesOf(type) || {}).boardTick === 'function') {   // a turn over: a game that ticks with the board's turns (Hot Potato's bomb) ticks
          const w = E.rulesOf(type).boardTick(m, rng);
          if (w) { done = true; out.decided++; if (w === 'X') out.first++; each.push((n.X + n.O) / 2); winner.push(n[w]); break; }
        }
        fresh = !r.again; if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
      if (!done) out.open++;
    }
  } finally { E.setTune(type, null); }
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  return { n: N, each: mean(each), eachMed: median(each), winner: mean(winner), winnerMed: median(winner), first: out.decided ? out.first / out.decided : 0, draws: out.draws / N, open: out.open, moves: out.moves / N };
}
const line = (label, r) => `  ${label}: turns each ${r.each.toFixed(2)} (median ${r.eachMed}), the winner's ${r.winner.toFixed(2)} (median ${r.winnerMed}), first mover ${(100 * r.first).toFixed(1)}%${r.draws ? `, draws ${(100 * r.draws).toFixed(1)}%` : ''}${r.open ? `, NEVER ENDED ${r.open}` : ''}`;
module.exports = { duel, line, median };
