'use strict';
// Rummy Lite (November 2026): its rules and computer (npm test). Each player their own hand, deck (hidden) and pile.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/rummy/rules.js');
const A = require('../../src/games/rummy/ai.js');

const mini = seed => E.newMini('rummy', E.makeRng('rmy-' + (seed || 1)));
const lay = (m, p, hand, deck, pile) => { m.hand[p] = hand.slice(); if (deck) { m.deck[p] = deck.slice(); m.left[p] = deck.length; } if (pile) m.pile[p] = pile.slice(); return m; };

test('rummy: melds are sets (three of a rank) or runs (three in a row in one suit, an ace low or high, never round the corner)', () => {
  assert.equal(R.rmyMeld('4S', '4H', '4D'), 'set');
  assert.equal(R.rmyMeld('4S', '5S', '6S'), 'run');
  assert.equal(R.rmyMeld('AS', '2S', '3S'), 'run', 'an ace low');
  assert.equal(R.rmyMeld('QS', 'KS', 'AS'), 'run', 'an ace high');
  assert.equal(R.rmyMeld('KS', 'AS', '2S'), false, 'not round the corner');
  assert.equal(R.rmyMeld('4S', '5H', '6S'), false, 'a run keeps to one suit');
  assert.equal(R.rmyMelds(['AS', '2S', '3S', '4H', '4D', '4C']).n, 2, 'two melds side by side');
  assert.equal(R.rmyMelds(['3S', '4S', '5S', '5H', '5D', '9C']).n, 1, 'a card in two melds counts once');
  assert.equal(R.rmyMelds(['4S', '5S', '6S', '6H', '6D', '6C', 'KD']).n, 2, 'the best split: 4-5-6 and the other three 6s');
});

test('rummy: a move is Take (pile or deck, the turn held), then Throw; two melds after the throw win; the deck is the server\'s alone', () => {
  const m = lay(mini(), 'X', ['AS', '2S', '3S', '4H', '4D', '9C'], ['5S', '4C'], ['KH']);
  let r = E.applyMove(m, 'X', 'deck', E.makeRng('t'));
  assert.deepEqual([r.ok, r.again, r.note], [true, true, 'take']);
  assert.equal(m.held.c, '4C'); assert.equal(m.hand.X.length, 7); assert.equal(m.left.X, 1);
  assert.equal(E.applyMove(m, 'X', 'pile', E.makeRng('t')).reason, 'taken', 'one take a move');
  assert.equal(E.applyMove(m, 'X', { d: 'QS' }, E.makeRng('t')).ok, false, 'only a card in the hand');
  r = E.applyMove(m, 'X', { d: '9C' }, E.makeRng('t'));
  assert.deepEqual([r.ok, r.outcome, r.note], [true, 'win', 'melds']);
  assert.deepEqual(m.pile.X.slice(-1), ['9C']);
  // the pile's card: known; a throw that leaves one meld goes on
  const n = lay(mini(2), 'O', ['5H', '6H', '9C', '9D', 'KS', '2C'], null, ['7H']);
  r = E.applyMove(n, 'O', 'pile', E.makeRng('u')); assert.equal(n.held.c, '7H');
  r = E.applyMove(n, 'O', { d: '2C' }, E.makeRng('u'));
  assert.deepEqual([r.outcome, r.note, !!r.again], ['continue', 'meld', false], '"Go again on success" off: the turn ends');
  // hidden: the decks never in the public view; how many are left is
  const pub = E.publicMini(mini(3));
  assert.equal(pub.deck, undefined); assert.equal(typeof pub.left.X, 'number'); assert.ok(Array.isArray(pub.pile.X));
  const s = R.secret(mini(3)); assert.ok(Array.isArray(s.deck.X) && s.deck.X.length > 0);
  const h = mini(3); R.hide(h); assert.equal(h.deck, undefined);
});

test('rummy: the deck run out: the pile under its top card is shuffled into a new one; each deck is ace to 6 by default (24 cards)', () => {
  const m = mini(4);
  assert.equal(R.rmyDeck(R.rmyCfg(m).ranks).length, 24);
  assert.equal(m.hand.X.length, 6); assert.equal(m.left.X + m.hand.X.length + m.pile.X.length, 24);
  lay(m, 'X', ['AS', '5H', '2C', '3D', '6C', '4S'], [], ['2D', '3H', '6H', '5D']);
  const r = E.applyMove(m, 'X', 'deck', E.makeRng('rs'));
  assert.ok(r.ok); assert.equal(m.last.reshuf, true); assert.deepEqual(m.pile.X, ['5D'], 'the top card stays');
  assert.ok(['2D', '3H', '6H'].includes(m.held.c)); assert.equal(m.left.X, 2);
});

test('rummy: a timeout between the steps puts the card taken back on the pile; with "Go again on success" on, a new meld takes again', () => {
  const st = E.newMatch(E.makeRng('rt'), { games: ['rummy'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 'deck', E.makeRng('a')).ok); E.endFlash(st);
  assert.equal(st.lock, 4, 'the take holds the turn to its square');
  const c = st.squares[4].mini.held.c;
  st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
  assert.ok(t.ok); assert.equal(t.move, 'auto'); if (st.flash) E.endFlash(st);
  const m = st.squares[4].mini;
  assert.equal(m.held, null); assert.equal(m.pile[p].slice(-1)[0], c, 'the card taken is back on the pile'); assert.equal(m.hand[p].length, 6);
  E.setTune('rummy', { again: 'on' });
  try {
    const g = lay(E.newMini('rummy', E.makeRng('ga')), 'X', ['5H', '6H', '9C', '9D', 'KS', '2C'], null, ['7H']);
    E.applyMove(g, 'X', 'pile', E.makeRng('g'));
    const r = E.applyMove(g, 'X', { d: '2C' }, E.makeRng('g'));
    assert.deepEqual([r.note, r.again], ['meld', true]);
  } finally { E.setTune('rummy', null); }
});

test('rummy: the computer: legal at every level; Normal and Hard take the pile\'s card that completes the hand; Hard throws the card that keeps the most outs', () => {
  const m = lay(mini(5), 'X', ['AS', '2S', '3S', '4H', '4D', '9C'], null, ['4C']);
  for (const level of ['normal', 'hard']) assert.equal(E.localBest(E.publicMini(m), 'X', E.makeRng('a'), {}, { level }).move, 'pile');
  m.hand.X.push('4C'); m.held = { by: 'X', from: 'pile', c: '4C', before: 1 }; m.pile.X = [];
  for (const level of ['easy', 'normal', 'hard']) {
    const mv = E.localBest(E.publicMini(m), 'X', E.makeRng('b'), {}, { level }).move;
    assert.ok(mv && m.hand.X.includes(mv.d), level);
  }
  assert.deepEqual(E.localBest(E.publicMini(m), 'X', E.makeRng('b'), {}, { level: 'hard' }).move, { d: '9C' });
  // Hard: two runs started (4-5 of spades, 4-5 of hearts) and two loose: it throws a loose card, never a run's
  const k = lay(mini(6), 'O', ['4S', '5S', '4H', '5H', 'AC', '2D', '6D'], null, ['3C']);
  k.held = { by: 'O', from: 'deck', c: '6D', before: 0 };
  const t = E.localBest(E.publicMini(k), 'O', E.makeRng('c'), {}, { level: 'hard' }).move;
  assert.ok(['AC', '2D', '6D'].includes(t.d), JSON.stringify(t));
  assert.ok(A.needs(E.publicMini(mini(7)), 'X') >= 1);
});

test('rummy: whole squares between the computers end with a winner in about 3 to 6 turns each', () => {
  let turns = 0, wins = 0;
  for (let g = 0; g < 150; g++) {
    const rng = E.makeRng('rw' + g), m = E.newMini('rummy', rng); let p = 'X'; const n = { X: 0, O: 0 };
    for (let k = 0; k < 300; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok, r.reason);
      if (r.note !== 'take') n[p]++;
      if (r.outcome === 'win') { wins++; turns += (n.X + n.O) / 2; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(wins, 150); const avg = turns / wins;
  assert.ok(avg >= 3 && avg <= 6.5, `turns each ${avg.toFixed(2)}`);
});
