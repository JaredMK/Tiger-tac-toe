'use strict';
// Rock Paper Scissors (November 2026): its rules and computer, test by test (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/rps/rules.js');
const A = require('../../src/games/rps/ai.js');

const at = v => () => v;                                          // an rng that always says v (the house's draw: the card at that share of the deck)
const deck = (m, p, r, pp, s) => { m.deck[p] = { r, p: pp, s }; };

test('rps: each player their own house deck, 3 of each by default, its counts public; the settings are the admin\'s', () => {
  const m = E.newMini('rps', E.makeRng('a'));
  assert.deepEqual(m.deck, { X: { r: 3, p: 3, s: 3 }, O: { r: 3, p: 3, s: 3 } });
  assert.deepEqual(m.score, { X: 0, O: 0 });
  const pub = E.publicMini(m);
  assert.deepEqual(pub.deck.X, { r: 3, p: 3, s: 3 });
  E.setTune('rps', { rocks: 5, papers: 1, scissors: 0, goal: 2 });
  try { const t = E.newMini('rps', E.makeRng('b')); assert.deepEqual(t.deck.O, { r: 5, p: 1, s: 0 }); assert.equal(R.rpsCfg(t).goal, 2); } finally { E.setTune('rps', null); }
});

test('rps: a throw against the house: a win scores 1 and ends the turn, a loss ends it with nothing, a tie keeps the turn to throw again; the card comes off the deck', () => {
  const m = E.newMini('rps', E.makeRng('c'));
  deck(m, 'X', 1, 0, 0);
  let r = E.applyMove(m, 'X', 'p', at(0));                        // paper against the house's only card, a rock
  assert.deepEqual([r.outcome, r.note, !!r.again, m.score.X], ['continue', 'won', false, 1]);
  assert.equal(m.last.h, 'r'); assert.equal(m.last.reshuf, true, 'its last card thrown: the deck is turned over');
  assert.deepEqual(m.deck.X, { r: 3, p: 3, s: 3 });
  deck(m, 'X', 0, 0, 2);
  r = E.applyMove(m, 'X', 'p', at(0));                            // paper against scissors: lost
  assert.deepEqual([r.note, !!r.again, m.score.X, m.deck.X.s], ['lost', false, 1, 1]);
  deck(m, 'X', 0, 2, 1);
  r = E.applyMove(m, 'X', 'p', at(0));                            // paper against paper: a tie, throw again
  assert.deepEqual([r.note, r.again, m.tie], ['tie', true, 'X']);
  assert.deepEqual(m.deck.X, { r: 0, p: 1, s: 1 });
  assert.equal(E.applyMove(m, 'X', 'x', at(0)).ok, false, 'never a throw that is not one');
  // the flash carries the throws, the verdict and the deck after
  const st = E.newMatch(E.makeRng('d'), { games: ['rps'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 's', E.makeRng('e')).ok);
  assert.deepEqual(Object.keys(st.flash.rps).sort(), ['deck', 'h', 'res', 'reshuf', 'score', 't']);
  assert.ok(E.playMs(st.flash) >= R.rpsTimes(st.flash.rps).end);
  if (st.flash.rps.res === 'tie') assert.equal(st.lock, 4, 'a tie holds the turn to its square');
  else assert.equal(st.flash.by, p);
});

test('rps: first to the goal takes the square; with "Go again on success" on, a win keeps the turn', () => {
  const m = E.newMini('rps', E.makeRng('f')); m.score.X = 2;
  deck(m, 'X', 2, 2, 2);
  const r = E.applyMove(m, 'X', 'p', at(0));                      // rock drawn first
  assert.deepEqual([r.outcome, m.score.X], ['win', 3]);
  E.setTune('rps', { again: 'on' });
  try {
    const t = E.newMini('rps', E.makeRng('g'));
    assert.equal(E.applyMove(t, 'O', 'p', at(0)).again, true);
  } finally { E.setTune('rps', null); }
});

test('rps: the computer: Normal beats the house\'s likeliest next throw; Hard by the chance of winning the move (ties thrown again); Easy any throw', () => {
  const m = E.newMini('rps', E.makeRng('h'));
  deck(m, 'X', 1, 4, 2);                                          // papers most likely: scissors
  for (let k = 0; k < 10; k++) assert.equal(E.localBest(E.publicMini(m), 'X', E.makeRng('n' + k), {}, { level: 'normal' }).move, 's');
  // rocks and papers alike, no scissors: Normal either beater; Hard paper (a rock beaten, a paper a tie to throw again; scissors would lose to every rock)
  deck(m, 'X', 2, 2, 0);
  const seen = new Set(); for (let k = 0; k < 30; k++) seen.add(E.localBest(E.publicMini(m), 'X', E.makeRng('m' + k), {}, { level: 'normal' }).move);
  assert.deepEqual([...seen].sort(), ['p', 's']);
  for (let k = 0; k < 10; k++) assert.equal(E.localBest(E.publicMini(m), 'X', E.makeRng('h' + k), {}, { level: 'hard' }).move, 'p');
  const S = A.rpsSolve({ r: 5, p: 5, s: 5 });
  assert.ok(S.vFull > 0.5 && S.vFull < 0.6, `a full deck's move is won ${S.vFull.toFixed(3)} of the time`);
  assert.ok(A.needs(E.publicMini(m), 'X') > 1);
  const easy = new Set(); for (let k = 0; k < 40; k++) easy.add(E.localBest(E.publicMini(m), 'X', E.makeRng('e' + k), {}, { level: 'easy' }).move);
  assert.equal(easy.size, 3);
});

test('rps: a timeout while a tie waits plays nothing (the turn passes, not a miss)', () => {
  const st = E.newMatch(E.makeRng('i'), { games: ['rps'] }), p = st.turn, m = st.squares[4].mini;
  deck(m, p, 0, 0, 3);
  assert.ok(E.playMove(st, 4, 's', at(0)).ok); E.endFlash(st);
  assert.equal(st.lock, 4);
  st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
  assert.ok(t.ok && t.ended); assert.notEqual(st.turn, p);
  assert.equal(st.timer.timeouts[p], 0, 'not a miss');
});

test('rps: whole squares between the computers end with a winner in 3 to 6 turns each', () => {
  let turns = 0, wins = 0;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('w' + g), m = E.newMini('rps', rng); let p = 'X'; const n = { X: 0, O: 0 }; let fresh = true;
    for (let k = 0; k < 400; k++) {
      if (fresh) n[p]++;
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok);
      if (r.outcome !== 'continue') { wins++; turns += n.X + n.O; break; }
      fresh = !r.again; if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(wins, 300);
  const each = turns / wins / 2;
  assert.ok(each >= 3 && each <= 6, `turns each ${each.toFixed(2)}`);
});
test('rps: a deck set to nothing at all is one of each, so the house always throws', () => {
  E.setTune('rps', { rocks: 0, papers: 0, scissors: 0 });
  try { const m = E.newMini('rps', E.makeRng('z')); assert.deepEqual(m.deck.X, { r: 1, p: 1, s: 1 }); for (let k = 0; k < 8; k++) assert.ok(E.applyMove(m, 'X', 'r', E.makeRng('z' + k)).ok); } finally { E.setTune('rps', null); }
});
