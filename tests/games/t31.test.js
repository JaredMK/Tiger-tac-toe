'use strict';
// Thirty-One (games/t31): its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/t31/rules.js');
const A = require('../../src/games/t31/ai.js');

const hold = (m, p, hand, pile, deck) => { m.hand[p] = hand.slice(); m.pile[p] = pile.slice(); if (deck) { m.deck[p] = deck.slice(); m.deckN[p] = deck.length; } m.held = null; return m; };
const fresh = seed => E.newMini('t31', E.makeRng(seed || 't31'));

test('t31: the best single suit counts: aces 11, the 10 and picture cards 10, the rest their number; other suits nothing', () => {
  assert.equal(R.t31Score(['AS', 'KS', 'QS']), 31);
  assert.equal(R.t31Score(['AS', 'KH', '9S']), 20);
  assert.equal(R.t31Score(['TD', 'JD', '2C']), 20);
  assert.equal(R.t31Score(['2C', '3H', '4D']), 4);
  assert.deepEqual(R.t31Best(['7H', '8H', 'KC']), { score: 15, suit: 'H' });
  const m = fresh();
  assert.equal(m.hand.X.length, 3); assert.equal(m.pile.X.length, 1); assert.equal(m.deck.X.length, 48);
  assert.equal(E.tuneLive('t31').target, 26); assert.equal(E.tuneLive('t31').again, 'off');
});

test('t31: a turn is a take (the discard pile or the deck; the turn held) then a discard; the target wins, exactly 31 wins at once', () => {
  const m = hold(fresh(), 'X', ['2C', '3H', '4D'], ['9C'], ['5S', 'KH']);
  assert.equal(E.applyMove(m, 'X', 'd0').ok, false, 'nothing to let go before a take');
  let r = E.applyMove(m, 'X', 'pile', E.makeRng('a'));
  assert.deepEqual([r.ok, r.again, m.hand.X.length, m.pile.X.length], [true, true, 4, 0]);
  assert.equal(E.applyMove(m, 'X', 'deck').ok, false, 'one take a turn');
  r = E.applyMove(m, 'X', 'd1', E.makeRng('b'));                      // the 3H goes: clubs 2 + 9 = 11
  assert.deepEqual([r.outcome, !!r.again, R.t31Score(m.hand.X), m.pile.X.slice(-1)[0]], ['continue', false, 11, '3H']);
  r = E.applyMove(m, 'X', 'deck', E.makeRng('c'));                    // the deck's top: KH, turned up as it comes
  assert.equal(m.hand.X[3], 'KH'); assert.equal(m.last.from, 'deck');
  // exactly 31 at once, whatever the target
  E.setTune('t31', { target: 31 });
  try {
    const w = hold(fresh('w'), 'O', ['AS', 'KS', '2D'], ['QS'], ['3C']);
    E.applyMove(w, 'O', 'pile');
    r = E.applyMove(w, 'O', 'd2');
    assert.deepEqual([r.outcome, r.note], ['win', 'thirtyone']);
  } finally { E.setTune('t31', null); }
  const t = hold(fresh('t'), 'X', ['AH', 'KH', '2D'], ['4H'], ['4C']);   // hearts 25: under the target, 26
  E.applyMove(t, 'X', 'pile'); r = E.applyMove(t, 'X', 'd2');
  assert.deepEqual([r.outcome, R.t31Score(t.hand.X)], ['continue', 25]);
  const u = hold(fresh('u'), 'X', ['AH', 'KH', '2D'], ['5H'], ['4C']);   // hearts 26: the target
  E.applyMove(u, 'X', 'pile'); r = E.applyMove(u, 'X', 'd2');
  assert.deepEqual([r.outcome, r.note], ['win', 'target']);
});

test('t31: the deck is hidden (never in the public view, the record or a move\'s entry); a deck run out is refilled from the pile but its top', () => {
  const m = fresh('h'), pub = E.publicMini(m);
  assert.equal(pub.deck, undefined); assert.equal(pub.deckN.X, 48);
  const st = E.newMatch(E.makeRng('hm'), { games: ['t31'] });
  st.id = 'm'; st.seq = 0; st.recent = [];
  const rec = E.matchRecord(st);
  assert.ok(!JSON.stringify(rec.state).includes('"deck":{'), 'no deck in the record\'s public state');
  const r = hold(fresh('r'), 'X', ['2C', '3C', '4C'], ['5D', '6D', '7D'], []);
  E.applyMove(r, 'X', 'deck', E.makeRng('rs'));
  assert.deepEqual(r.pile.X, ['7D'], 'the top stays'); assert.equal(r.last.reshuf, true);
  assert.ok(['5D', '6D'].includes(r.hand.X[3])); assert.equal(r.deck.X.length, 1);
});

test('t31: Go again on success: a discard that raises the score takes again; a timeout with a card taken lets that card go', () => {
  E.setTune('t31', { again: 'on' });
  try {
    const m = hold(fresh('g'), 'X', ['2C', '3H', '4D'], ['9C'], ['5S']);
    E.applyMove(m, 'X', 'pile'); const r = E.applyMove(m, 'X', 'd1');
    assert.deepEqual([r.again, r.note], [true, 'up']);
  } finally { E.setTune('t31', null); }
  const st = E.newMatch(E.makeRng('to'), { games: ['t31'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 'deck', E.makeRng('d')).ok); E.endFlash(st);
  assert.equal(st.lock, 4, 'the take holds the turn to the square');
  const before = st.squares[4].mini.hand[p].slice(0, 3);
  st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
  assert.ok(t.ok); assert.equal(t.move, 'auto');
  if (st.flash) E.endFlash(st);
  assert.notEqual(st.turn, p, 'the turn passed'); assert.deepEqual(st.squares[4].mini.hand[p], before, 'the hand as it was');
});

test('t31: the computer: a winning take and discard always; Normal keeps its best score; Hard by expected value, legal and quick', () => {
  const m = hold(fresh('ai'), 'O', ['AS', 'KS', '2D'], ['9S'], ['3C']);   // the pile's 9S makes 30 in spades: a win
  let b = A.best(E.publicMini(m, 'O'), 'O', E.makeRng('x'), {}, { level: 'normal' });
  assert.deepEqual([b.move, b.q], ['pile', 1]);
  E.applyMove(m, 'O', 'pile');
  for (const level of ['easy', 'normal', 'hard']) assert.equal(A.best(E.publicMini(m, 'O'), 'O', E.makeRng('y'), {}, { level }).move, 'd2', level + ': the winning discard');
  const n = hold(fresh('n'), 'X', ['7H', '8H', '2C'], ['3D'], ['4S']);
  assert.equal(A.best(E.publicMini(n, 'X'), 'X', E.makeRng('z'), {}, { level: 'normal' }).move, 'deck', 'the pile does not help: draw');
  E.applyMove(n, 'X', 'deck');
  assert.ok(['d2', 'd3'].includes(A.best(E.publicMini(n, 'X'), 'X', E.makeRng('z'), {}, { level: 'normal' }).move), 'Normal lets the 2C or the 4S go, keeping hearts');
  const t0 = performance.now(), h = A.best(E.publicMini(fresh('q'), 'X'), 'X', E.makeRng('w'), {}, { level: 'hard', until: null });
  assert.ok(['deck', 'pile'].includes(h.move)); assert.ok(performance.now() - t0 < 300, 'Hard is quick');
  assert.ok(A.needs(E.publicMini(fresh('q'), 'X'), 'X') >= 1);
});

test('t31: whole squares between the computers end with a winner in about 3 to 6 turns each', () => {
  let turns = 0, n = 0;
  for (let g = 0; g < 200; g++) {
    const rng = E.makeRng('t31w' + g), m = E.newMini('t31', rng); let p = 'X';
    for (let k = 0; k < 300; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok);
      if (r.outcome !== 'continue') { assert.equal(r.outcome, 'win'); turns += (m.turns.X + m.turns.O) / 2; n++; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(n, 200); const avg = turns / n;
  assert.ok(avg >= 3 && avg <= 6, `turns each ${avg.toFixed(2)}`);
});
