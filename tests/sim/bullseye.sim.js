'use strict';
// Simulations: Bullseye (slow, never part of npm test: `npm run sim -- bullseye`). The two-tap aim at the board on the
// wall (a sideways line stopped, then an up-down one; the dart lands where they cross: December 2026): the computer
// against itself at each level over many dealt squares (the winner's throws, the first mover's wins), and hands alone on
// a square (perfect timing, a steady finger, a casual one, a loose one: each tap off by 0, 45, 70 and 100 ms, which is that
// many ms of the line's speed, so a faster sweep after a scoring throw is harder), at the defaults and a few other
// goals, boards, sweeps and speed-ups (src/games/bullseye/meta.js TUNE, BULL_DEFAULTS).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const gauss = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const B = E.BULLS, centre = (dx = 0, dy = 0) => E.bullsAimAt(B.at[0] + dx, B.at[1] + dy);
function versus(N, level) {
  let winner = 0, first = 0, least = 99;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('bull-sim:' + level + g), m = E.newMini('bullseye', rng), n = { X: 0, O: 0 }; let p = 'X';
    for (;;) { const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level, until: null }).move, rng); n[p]++; if (r.outcome === 'win') break; p = p === 'X' ? 'O' : 'X'; }
    winner += n[p]; if (p === 'X') first++; least = Math.min(least, n[p]);
  }
  return { winner: winner / N, first: first / N, least };
}
function solo(N, ms) {
  let tot = 0, least = 99; const z = { bull: 0, mid: 0, board: 0, miss: 0 };
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('bull-solo:' + g), m = E.newMini('bullseye', rng); let n = 0;
    while (m.pts.X < E.tune(m).goal && n < 200) { const u = B.w / E.bullsPeriod(m.cfg, m.speed.X); E.applyMove(m, 'X', centre(gauss(rng) * ms * u, gauss(rng) * ms * u), rng); z[m.last.zone]++; n++; }
    tot += n; least = Math.min(least, n);
  }
  const s = z.bull + z.mid + z.board + z.miss;
  return { mean: tot / N, least, zones: Object.entries(z).map(([k, v]) => `${k} ${(v / s * 100).toFixed(0)}%`).join(', ') };
}
function report(name, tuneSet, cfg) {
  E.setTune('bullseye', tuneSet || null); E.setBullsConfig(cfg || null);
  try {
    const out = { perfect: solo(2000, 0), steady: solo(3000, 45), casual: solo(3000, 70), loose: solo(3000, 100), easy: versus(3000, 'easy'), normal: versus(6000, 'normal'), hard: versus(3000, 'hard') };
    console.log(`${name}:`);
    for (const h of ['perfect', 'steady', 'casual', 'loose']) console.log(`  a ${h} hand alone: ${out[h].mean.toFixed(2)} throws (least ${out[h].least}); ${out[h].zones}`);
    for (const l of ['easy', 'normal', 'hard']) console.log(`  ${l} v ${l}: the winner ${out[l].winner.toFixed(2)} throws (least ${out[l].least}), the first mover ${(out[l].first * 100).toFixed(1)}%`);
    return out;
  } finally { E.setTune('bullseye', null); E.setBullsConfig(null); }
}
test('bullseye: the defaults (first to 7; the board 32, its inner ring 17.5, the bullseye 6.5; a sweep of 700 ms, 1.15 times faster per scoring throw; the computer\'s rates 12, 42 and 80%)', () => {
  const o = report('defaults');
  assert.ok(o.normal.winner >= 4 && o.normal.winner <= 6 && o.normal.first < 0.6, 'Normal: 4 to 6 throws for the winner, the first mover under 60%');
  assert.ok(o.perfect.least === 3 && o.hard.least >= 3, 'never in two throws');
  assert.ok(o.steady.mean < o.normal.winner && o.loose.mean > o.casual.mean + 1, 'a steady finger beats Normal; a loose one does not');
});
test('bullseye: other settings, for the admin (reports only)', () => {
  report('first to 5', { goal: 5 });
  report('first to 9', { goal: 9 });
  report('a faster sweep (550 ms)', null, Object.assign({}, E.BULL_DEFAULTS, { sweep: 550 }));
  report('a steeper speed-up (1.3)', null, Object.assign({}, E.BULL_DEFAULTS, { ramp: 1.3 }));
  report('a smaller board (26, 14, 5)', null, Object.assign({}, E.BULL_DEFAULTS, { board: 26, mid: 14, bull: 5 }));
  report('the computer\'s rates 25, 55, 90', { aiBull: 25, aiMid: 55, aiBoard: 90 });
});
