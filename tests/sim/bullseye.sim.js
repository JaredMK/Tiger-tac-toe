'use strict';
// Simulations: Bullseye (slow, never part of npm test: `npm run sim -- bullseye`). The flick throw at the board on
// the wall (November 2026): the computer against itself at each level over many dealt squares (the winner's throws,
// the first mover's wins), and hands alone on a square (a perfect aim, a careful flick, a sloppy one: the errors on
// the aim, 4 and 8.5 degrees, and the power, a tenth and a fifth of the range, as Cup Pong's balance uses), at the defaults and a few other goals, boards and scatters
// (src/games/bullseye/meta.js TUNE, BULL_DEFAULTS).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const gauss = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const B = E.BULLS, centre = () => E.bullsAimAt(B.at[0], B.at[1]);
function versus(N, level) {
  let winner = 0, first = 0, least = 99;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('bull-sim:' + level + g), m = E.newMini('bullseye', rng), n = { X: 0, O: 0 }; let p = 'X';
    for (;;) { const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level, until: null }).move, rng); n[p]++; if (r.outcome === 'win') break; p = p === 'X' ? 'O' : 'X'; }
    winner += n[p]; if (p === 'X') first++; least = Math.min(least, n[p]);
  }
  return { winner: winner / N, first: first / N, least };
}
function solo(N, ea, ep) {
  let tot = 0, least = 99; const z = { bull: 0, mid: 0, board: 0, miss: 0 };
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('bull-solo:' + g), m = E.newMini('bullseye', rng); let n = 0;
    while (m.pts.X < E.tune(m).goal && n < 200) { const a = centre(); E.applyMove(m, 'X', { aim: a.aim + gauss(rng) * ea, power: a.power + gauss(rng) * ep }, rng); z[m.last.zone]++; n++; }
    tot += n; least = Math.min(least, n);
  }
  const s = z.bull + z.mid + z.board + z.miss;
  return { mean: tot / N, least, zones: Object.entries(z).map(([k, v]) => `${k} ${(v / s * 100).toFixed(0)}%`).join(', ') };
}
function report(name, tuneSet, cfg) {
  E.setTune('bullseye', tuneSet || null); E.setBullsConfig(cfg || null);
  try {
    const out = { perfect: solo(3000, 0, 0), careful: solo(3000, 0.072 / B.angle, 0.1), sloppy: solo(3000, 0.15 / B.angle, 0.2), easy: versus(3000, 'easy'), normal: versus(6000, 'normal'), hard: versus(3000, 'hard') };
    console.log(`${name}:`);
    for (const h of ['perfect', 'careful', 'sloppy']) console.log(`  a ${h} hand alone: ${out[h].mean.toFixed(2)} throws (least ${out[h].least}); ${out[h].zones}`);
    for (const l of ['easy', 'normal', 'hard']) console.log(`  ${l} v ${l}: the winner ${out[l].winner.toFixed(2)} throws (least ${out[l].least}), the first mover ${(out[l].first * 100).toFixed(1)}%`);
    return out;
  } finally { E.setTune('bullseye', null); E.setBullsConfig(null); }
}
test('bullseye: the defaults (first to 7; the board 32, its inner ring 17.5, the bullseye 6.5; scatter 5; the computer\'s aim error 19)', () => {
  const o = report('defaults');
  assert.ok(o.normal.winner >= 4 && o.normal.winner <= 6 && o.normal.first < 0.6, 'Normal: 4 to 6 throws for the winner, the first mover under 60%');
  assert.ok(o.perfect.least >= 3 && o.hard.least >= 3, 'never in two throws');
  assert.ok(o.careful.mean < o.normal.winner + 0.5 && o.sloppy.mean > o.careful.mean + 1.5, 'a careful finger keeps up with Normal; a sloppy one does not');
});
test('bullseye: other settings, for the admin (reports only)', () => {
  report('first to 5', { goal: 5 });
  report('first to 9', { goal: 9 });
  report('scatter 8', { spread: 8 });
  report('a smaller board (26, 14, 5)', null, { board: 26, mid: 14, bull: 5 });
  report('the computer\'s aim error 14', { aiErr: 14 });
});
