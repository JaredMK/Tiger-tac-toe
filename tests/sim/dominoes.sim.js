'use strict';
// Simulations: Dominoes. Slow, so never part of npm test:
// npm run sim -- dominoes
// The settings (meta.js TUNE) were picked here (November 2026): a double-six set, three tiles each, the line's opener
// drawing one with their first move. A turn is a placement (a draw that finds a tile keeps the turn), so the winner's
// turns are the tiles they laid. Measured with Normal against itself over 20000 squares: the winner about 6.0 turns
// (7.4 moves with the draws), the first mover about 48.6% (57.8% without the opener's draw), the game blocked about 3%,
// a level block (a draw, the square reset) about 0.3%. Four tiles each would be about 7.2 turns and 50%; a double-five
// set with four each about 5.8 turns, 47%, blocked 10%.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/dominoes/ai.js');

function squares(N, levels, seed) {
  let first = 0, wTurns = 0, wActs = 0, allTurns = 0, blocked = 0, ties = 0, draws = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng(seed + g), m = E.newMini('dominoes', rng), turns = { X: 0, O: 0 }, acts = { X: 0, O: 0 };
    let p = 'X';
    for (let k = 0; k < 300; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level: levels[p], until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok, JSON.stringify([b.move, r]));
      acts[p]++; if (b.move === 'draw') draws++;
      if (!r.again) turns[p]++;
      if (r.outcome === 'win') { const w = r.winner || p; if (w === 'X') first++; wTurns += turns[w] + (r.again ? 1 : 0); wActs += acts[w]; allTurns += turns.X + turns.O; if (r.note === 'blocked') blocked++; break; }
      if (r.outcome === 'draw') { ties++; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  const dec = N - ties;
  return { first: first / dec, turns: wTurns / dec, acts: wActs / dec, all: allTurns / dec, blocked: blocked / N, ties: ties / N, draws: draws / N };
}
const say = (what, r) => console.log(`Dominoes ${what}: first mover wins ${(100 * r.first).toFixed(1)}%; the winner's turns ${r.turns.toFixed(2)} (${r.acts.toFixed(2)} moves with the draws; both players ${r.all.toFixed(1)} turns); ${r.draws.toFixed(2)} draws a square; blocked ${(100 * r.blocked).toFixed(1)}%, level ${(100 * r.ties).toFixed(2)}%`);

test('dominoes: whole squares, Normal against itself, over many dealt squares: the first mover under 60%, the winner about 4 to 6 turns', () => {
  const r = squares(20000, { X: 'normal', O: 'normal' }, 'dominoes-sim');
  say('Normal v Normal', r);
  assert.ok(r.first < 0.6, `first-mover win rate under 60% (${(100 * r.first).toFixed(1)}%)`);
  assert.ok(r.turns >= 4 && r.turns <= 6.5, `about 4 to 6 turns for the winner (${r.turns.toFixed(2)})`);
  assert.ok(r.ties < 0.02, `a level block is rare (${(100 * r.ties).toFixed(2)}%)`);
});

test('dominoes: Hard against Normal: Hard wins more from either seat; Hard against itself stays under 60% for the first mover', () => {
  const hn = squares(1500, { X: 'hard', O: 'normal' }, 'dominoes-hn'), nh = squares(1500, { X: 'normal', O: 'hard' }, 'dominoes-nh'), hh = squares(1500, { X: 'hard', O: 'hard' }, 'dominoes-hh');
  say('Hard (first) v Normal', hn); say('Normal (first) v Hard', nh); say('Hard v Hard', hh);
  assert.ok(hn.first > 0.52, `Hard first beats Normal (${(100 * hn.first).toFixed(1)}%)`);
  assert.ok(nh.first < 0.5, `Hard second beats Normal (${(100 * (1 - nh.first)).toFixed(1)}%)`);
  assert.ok(hh.first < 0.6, `Hard v Hard first mover (${(100 * hh.first).toFixed(1)}%)`);
});

test('dominoes: the other settings, for the record: four tiles each; a double-five set; no opener\'s draw', () => {
  for (const [label, tune] of [['four each', { hand: 4 }], ['double-five, four each', { pips: 5, hand: 4 }], ['no opener draw', { openDraw: 0 }]]) {
    E.setTune('dominoes', tune);
    try { say(label, squares(4000, { X: 'normal', O: 'normal' }, 'dominoes-' + label)); } finally { E.setTune('dominoes', null); }
  }
});
