'use strict';
// Simulations: Shell Game (slow, never part of npm test: `npm run sim -- shell`). The presets against a model of a
// focused player following the ball's cup, to place each level's default values (meta.js SHELL_PRESETS).
//
// THE MODEL (an estimate, not a measurement of people: the admin's own play should correct it):
// - The player follows one cup. Nothing is lost while the followed cup stands still: one object among identical ones
//   is held without effort (the multiple-object-tracking findings: one target is tracked almost without error until
//   speed or crowding breaks it).
// - The risk is at a swap of the followed cup: the two cups pass each other, and the eye may leave with the wrong one.
//   The chance rises steeply as the swap gets shorter: a logistic in the swap's time, half the swaps lost at D50
//   (140 ms: about the 7-a-second limit at which one tracked object among replacing ones is lost), with a spread of
//   SPREAD (40 ms): about 2% at 300 ms, 6% at 250 ms, 18% at 200 ms, 32% at 170 ms.
// - A swap between cups that are not neighbours crosses the table faster for its time, though its arcs swing wider (its
//   time counts as shorter by the square root of its reach: a little harder than a neighbours' swap of the same length);
//   another swap running at the same time pulls the eye (the odds of a slip 1.4 times); a pair swapping straight back
//   gives no time to settle (1.3 times).
// - Once on the wrong cup, the player follows that one as faithfully (and can be carried back by a later slip).
// - LAPSE (3%) of rounds are lost to a blink or a wandering mind: a blind guess.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const MODEL = { d50: 140, spread: 40, far: 0.5, both: 1.4, back: 1.3, lapse: 0.03 };
function slip(step, s, prevMain, M) {
  const reach = s[1] - s[0], d = step.d / Math.pow(reach, M.far);
  let odds = Math.exp(-(d - M.d50) / M.spread);
  if (step.sw.length > 1) odds *= M.both;
  if (prevMain && prevMain[0] === s[0] && prevMain[1] === s[1]) odds *= M.back;
  return odds / (1 + odds);
}
function watch(r, rng, M) {
  const plan = E.shellPlan(r);
  if (rng() < M.lapse) return Math.floor(rng() * r.n) === plan.ballAt;
  let eye = r.ball, prev = null;                                  // the place of the cup the player is following
  for (const step of plan.steps) {
    for (const s of step.sw) {
      if (eye !== s[0] && eye !== s[1]) continue;
      const to = eye === s[0] ? s[1] : s[0];
      if (rng() >= slip(step, s, prev, M)) eye = to;                // followed: the eye goes with its cup (a slip: it stays with the place's new cup)
    }
    prev = step.sw[0];
  }
  return eye === plan.ballAt;
}
function rate(name, level, N, M) {
  const t = Object.assign({}, E.tuneDefaults('shell'), E.shellPreset(name));
  let ok = 0, ms = 0, moved = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng(`shell-sim:${name}:${level}:${g}`), r = E.shellRound(level, rng, t), plan = E.shellPlan(r);
    if (watch(r, rng, M || MODEL)) ok++;
    ms += plan.ms;
    let b = r.ball; for (const s of plan.steps) for (const [a, c] of s.sw) { if (b === a) { b = c; moved++; } else if (b === c) { b = a; moved++; } }
  }
  return { ok: ok / N, secs: ms / N / 1000, moved: moved / N };
}
test('shell: each preset\'s levels against the tracking model (a focused player), with blind guessing beside them', () => {
  const N = 20000;
  for (const name of Object.keys(E.SHELL_PRESETS)) {
    console.log(`  ${name}:`);
    E.SHELL_PRESETS[name].forEach((L, i) => {
      const r = rate(name, i, N);
      console.log(`    level ${i + 1} (${L.c} cups, ${L.ms} ms, ${L.sw} swaps, ramp ${L.rp}%): right ${(100 * r.ok).toFixed(1)}% (a blind guess ${(100 / L.c).toFixed(0)}%), ${r.secs.toFixed(1)} s a round, the ball's cup moves ${r.moved.toFixed(1)} times; the computer ${L.ai}%`);
    });
  }
  const n = [0, 1, 2].map(i => rate('Normal', i, N).ok);
  for (const [i, aim] of [[0, 0.8], [1, 0.6], [2, 0.4]]) assert.ok(Math.abs(n[i] - aim) < 0.05, `Normal level ${i + 1}: ${(100 * n[i]).toFixed(1)}% by the model, aimed at ${100 * aim}%`);
});
test('shell: how the model\'s figures move with its own assumptions (a sharper and a duller eye)', () => {
  for (const [what, M] of [['a sharper eye (half lost at 120 ms)', Object.assign({}, MODEL, { d50: 120 })], ['a duller eye (half lost at 165 ms)', Object.assign({}, MODEL, { d50: 165 })]]) {
    console.log(`  Normal, ${what}: ${[0, 1, 2].map(i => (100 * rate('Normal', i, 12000, M).ok).toFixed(0) + '%').join(', ')}`);
  }
});
