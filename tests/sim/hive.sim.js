'use strict';
// Simulations: Letter Hive (slow, never part of npm test: `npm run sim -- hive`). The computer against itself, 500
// squares at Normal with the batch's asserts (3 to 6 turns each, mean and median; the first mover 45 to 60%; no
// square won in a first burst), then by setting and by level. The computer's words a burst stand in for a person's:
// Normal finds 1 to 4 words, mostly short everyday ones: about 7 points in a first burst and 8 to 9 over a square
// (as the short words go it is left with longer ones). A person's first bursts are likely worth more than that (three
// to five words, two of them of five letters or more: 10 to 15 points) and their later ones less, as the words that
// come to mind go. Real play decides the target.
// What it shows: Hard against Hard runs short (about 3 bursts each, 12 to 14 points a burst) and the first to move
// wins about 61% of those: its bursts vary less. Normal's range of 1 to 4 words (not 2 to 4) is what keeps the first
// mover under 60%: with 2 to 4 it was 60 to 63% at any target.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/hive/rules.js');
const { duel, line } = require('./duel.js');

test('hive: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('hive', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.equal(r.draws, 0);
  assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`);
  assert.ok(r.each >= 3 && r.each <= 6, `mean turns ${r.each}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('hive: no square is won in a first burst at Normal, few in a second; what a burst is worth by level', () => {
  const N = 4000, by = { 1: 0, 2: 0 }; let done = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('hive-first:' + g), m = E.newMini('hive', rng), n = { X: 0, O: 0 }; let p = 'X';
    for (let k = 0; k < 400; k++) { n[p]++; const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal', until: null }).move, rng); if (r.outcome !== 'continue') { done++; const t = n[r.winner || p]; if (t <= 2) by[t]++; break; } p = p === 'X' ? 'O' : 'X'; }
  }
  console.log(`  won in the winner's first burst: ${by[1]} of ${done}; in the second: ${by[2]} (${(100 * by[2] / done).toFixed(2)}%)`);
  assert.equal(by[1], 0); assert.ok(by[2] / done < 0.03);
  for (const level of ['easy', 'normal', 'hard']) {
    let pts = 0, words = 0, plain = 0; const K = 4000;
    for (let k = 0; k < K; k++) { const rng = E.makeRng(`hive-burst:${level}:${k}`), m = E.newMini('hive', rng), pz = R.hivePuzzle(m.pz); E.applyMove(m, 'X', E.localBest(E.publicMini(m, 'X'), 'X', rng, {}, { level, until: null }).move, rng); pts += m.last.to; words += m.last.w.length; plain += m.last.w.filter(w => pz.plain.has(w)).length; }
    console.log(`  a first burst at ${level}: ${(words / K).toFixed(2)} words, ${(pts / K).toFixed(2)} points, ${(100 * plain / words).toFixed(0)}% everyday words`);
  }
});
test('hive: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('hive', a, b, 4000, t)));
  T('the defaults, 4,000 squares', null);
  T('target 30', { target: 30 }); T('target 35', { target: 35 }); T('target 45', { target: 45 }); T('target 50', { target: 50 });
  T('Normal finds 2 to 4 words (as first tried)', { aiMin: 2 }); T('no lean to everyday words', { aiRare: 100 }); T('a 4-letter word scores 2', { four: 2 }); T('no full-hive bonus', { bonus: 0 });
  T('Go again on success', { again: 'on' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Hard v Hard, Go again on', { again: 'on' }, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard'); T('Normal v Easy', null, 'normal', 'easy'); T('Easy v Normal', null, 'easy', 'normal');
});
