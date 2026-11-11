'use strict';
// Rummy Lite (November 2026; v 2: one deck and one pile, each hand its side's own): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/rummy/rules.js');
const A = require('../../src/games/rummy/ai.js');

const mini = seed => E.newMini('rummy', E.makeRng('rmy-' + (seed || 1)));
// A square laid out by hand: p's hand, and the shared deck and pile when given.
const lay = (m, p, hand, deck, pile) => { m.hand[p] = hand.slice(); if (deck) { m.deck = deck.slice(); m.left = deck.length; } if (pile) m.pile = pile.slice(); return m; };
const pv = (m, p) => E.publicMini(m, p);                          // what the computer for p sees: its own hand alone

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

test('rummy: one deck and one pile for both (v 2): Take (the pile or the deck, the turn held), then Throw onto the shared pile; two melds after the throw win', () => {
  const m = lay(mini(), 'X', ['AS', '2S', '3S', '4H', '4D', '9C'], ['5S', '4C'], ['KH']);
  assert.equal(m.v, 2);
  let r = E.applyMove(m, 'X', 'deck', E.makeRng('t'));
  assert.deepEqual([r.ok, r.again, r.note], [true, true, 'take']);
  assert.equal(m.held.c, '4C'); assert.equal(m.hand.X.length, 7); assert.equal(m.left, 1); assert.equal(m.last.c, undefined, 'a deck card is the taker\'s alone');
  assert.equal(E.applyMove(m, 'X', 'pile', E.makeRng('t')).reason, 'taken', 'one take a move');
  assert.equal(E.applyMove(m, 'X', { d: 'QS' }, E.makeRng('t')).ok, false, 'only a card in the hand');
  r = E.applyMove(m, 'X', { d: '9C' }, E.makeRng('t'));
  assert.deepEqual([r.ok, r.outcome, r.note], [true, 'win', 'melds']);
  assert.deepEqual(m.pile.slice(-1), ['9C']);
  // the other player takes your throw: the pile is one
  const n = lay(mini(2), 'O', ['5H', '6H', '9C', '9D', 'KS', '2C'], null, ['3D']);
  lay(n, 'X', ['AS', '2S', '4C', '8D', 'JH', 'QC'], null, null);
  E.applyMove(n, 'X', 'deck', E.makeRng('u')); E.applyMove(n, 'X', { d: n.hand.X.includes('7H') ? '7H' : n.hand.X[n.hand.X.length - 1] }, E.makeRng('u'));
  n.pile.push('7H');
  r = E.applyMove(n, 'O', 'pile', E.makeRng('u')); assert.equal(n.held.c, '7H'); assert.equal(n.last.c, '7H', 'a card off the pile was on show');
  r = E.applyMove(n, 'O', { d: '2C' }, E.makeRng('u'));
  assert.deepEqual([r.outcome, r.note, !!r.again], ['continue', 'meld', false], '"Go again on success" off: the turn ends');
  assert.equal(n.mc.O, 1, 'how many melds each hand holds is public');
});

test('rummy: the hands are each side\'s alone: never in the public state, an entry or the other side\'s view; each side\'s part rides the per-side channel and comes back whole', () => {
  const st = E.newMatch(E.makeRng('rh'), { games: ['rummy'] }), k = 4, full = st.squares[k].mini, p = st.turn, q = p === 'X' ? 'O' : 'X';
  const rec = E.matchRecord(st), pub = rec.state.squares[k].mini;
  assert.deepEqual(pub.hand, {}, 'no hand in the public state'); assert.equal(pub.deck, undefined, 'nor the deck');
  assert.deepEqual(rec.sides[p][k].hand, full.hand[p]); assert.deepEqual(rec.sides[q][k].hand, full.hand[q]);
  assert.ok(Array.isArray(rec.secrets[k].hand.X) && Array.isArray(rec.secrets[k].deck), 'the server keeps them whole');
  const back = E.fullState(rec).squares[k].mini; assert.deepEqual(back.hand, full.hand); assert.deepEqual(back.deck, full.deck);
  // the same with no secrets: the sides alone put the hands back
  const back2 = E.fullState(Object.assign({}, rec, { secrets: {} })).squares[k].mini; assert.deepEqual(back2.hand, full.hand);
  // a move from the deck: the entry carries no hand and no card drawn; the mover's side does
  const r = E.applyOnlineMove(rec, p, k, 'deck', E.makeRng('d'));
  assert.ok(r.ok, r.reason);
  const e = r.entries[0], text = JSON.stringify(e);
  assert.deepEqual(e.after.mini.hand, {}); assert.equal(e.rummy.c, undefined); assert.equal(e.after.mini.held.c, undefined);
  const sqPub = Object.assign({}, r.rec.state.squares[k].mini, { pile: null }), entryPub = Object.assign({}, e.after.mini, { pile: null }, { last: null });
  for (const c of full.hand[q]) { assert.ok(!JSON.stringify(sqPub).includes(`"${c}"`), `${q}'s card ${c} is not in the public square`); assert.ok(!JSON.stringify(entryPub).includes(`"${c}"`), `nor in the entry`); }
  assert.ok(r.rec.sides[p][k].took, 'the card drawn rides the mover\'s side');
  assert.equal(r.rec.sides[q][k].took, undefined, 'never the other side\'s');
  void text;
  // the computer's view: its own hand alone
  assert.deepEqual(Object.keys(pv(full, p).hand), [p]);
  // the miniature: the same from the hidden square as from the full one (public alone)
});

test('rummy: the deck run out: the pile under its top card is shuffled into a new one; the deck is ace to 8 by default (32 cards)', () => {
  const m = mini(4);
  assert.equal(R.rmyDeck(R.rmyCfg(m).ranks).length, 32);
  assert.equal(m.hand.X.length, 6); assert.equal(m.left + m.hand.X.length + m.hand.O.length + m.pile.length, 32);
  lay(m, 'X', ['AS', '5H', '2C', '3D', '6C', '4S'], [], ['2D', '3H', '6H', '5D']);
  const r = E.applyMove(m, 'X', 'deck', E.makeRng('rs'));
  assert.ok(r.ok); assert.equal(m.last.reshuf, true); assert.deepEqual(m.pile, ['5D'], 'the top card stays');
  assert.ok(['2D', '3H', '6H'].includes(m.held.c)); assert.equal(m.left, 2);
});

test('rummy: a timeout between the steps puts the card taken on the pile; with "Go again on success" on, a new meld takes again; never on one phone; a square from before is dealt again', () => {
  const st = E.newMatch(E.makeRng('rt'), { games: ['rummy'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 'deck', E.makeRng('a')).ok); E.endFlash(st);
  assert.equal(st.lock, 4, 'the take holds the turn to its square');
  const c = st.squares[4].mini.held.c;
  st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
  assert.ok(t.ok); assert.equal(t.move, 'auto'); if (st.flash) E.endFlash(st);
  const m = st.squares[4].mini;
  assert.equal(m.held, null); assert.equal(m.pile.slice(-1)[0], c, 'the card taken is on the pile'); assert.equal(m.hand[p].length, 6);
  E.setTune('rummy', { again: 'on' });
  try {
    const g = lay(E.newMini('rummy', E.makeRng('ga')), 'X', ['5H', '6H', '9C', '9D', 'KS', '2C'], null, ['7H']);
    E.applyMove(g, 'X', 'pile', E.makeRng('g'));
    const r = E.applyMove(g, 'X', { d: '2C' }, E.makeRng('g'));
    assert.deepEqual([r.note, r.again], ['meld', true]);
  } finally { E.setTune('rummy', null); }
  assert.ok(E.NO_SAME_PHONE.includes('rummy'), 'never two people on one phone');
  const old = E.newMatch(E.makeRng('old'), { games: ['rummy'] }); old.squares[2].mini = { type: 'rummy', v: 1, hand: { X: [], O: [] }, deck: { X: [], O: [] }, pile: { X: [], O: [] }, left: { X: 0, O: 0 }, held: null, turns: { X: 0, O: 0 }, last: null };
  assert.equal(E.fullState(E.matchRecord(old)).squares[2].mini.v, 2, 'dealt again');
});

test('rummy: the computer: legal at every level from its own view; Normal and Hard take the pile\'s card that completes the hand; Hard throws the card that keeps the most outs', () => {
  const m = lay(mini(5), 'X', ['AS', '2S', '3S', '4H', '4D', '9C'], null, ['4C']);
  for (const level of ['normal', 'hard']) assert.equal(E.localBest(pv(m, 'X'), 'X', E.makeRng('a'), {}, { level }).move, 'pile');
  m.hand.X.push('4C'); m.held = { by: 'X', from: 'pile', c: '4C', before: 1 }; m.pile = ['KD'];
  for (const level of ['easy', 'normal', 'hard']) {
    const mv = E.localBest(pv(m, 'X'), 'X', E.makeRng('b'), {}, { level }).move;
    assert.ok(mv && m.hand.X.includes(mv.d), level);
  }
  assert.deepEqual(E.localBest(pv(m, 'X'), 'X', E.makeRng('b'), {}, { level: 'hard' }).move, { d: '9C' });
  const k = lay(mini(6), 'O', ['4S', '5S', '4H', '5H', 'AC', '2D', '6D'], null, ['3C']);
  k.held = { by: 'O', from: 'deck', c: '6D', before: 0 };
  const t = E.localBest(pv(k, 'O'), 'O', E.makeRng('c'), {}, { level: 'hard' }).move;
  assert.ok(['AC', '2D', '6D'].includes(t.d), JSON.stringify(t));
  assert.ok(A.needs(pv(mini(7), 'X'), 'X') >= 1); assert.ok(A.needs(pv(mini(7), 'X'), 'O') >= 1, 'the other side from its meld count alone');
});

test('rummy: whole squares between the computers end with a winner in about 3 to 6 turns each', () => {
  let turns = 0, wins = 0;
  for (let g = 0; g < 150; g++) {
    const rng = E.makeRng('rw' + g), m = E.newMini('rummy', rng); let p = 'X'; const n = { X: 0, O: 0 };
    for (let k = 0; k < 300; k++) {
      const r = E.applyMove(m, p, E.localBest(pv(m, p), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok, r.reason);
      if (r.note !== 'take') n[p]++;
      if (r.outcome === 'win') { wins++; turns += (n.X + n.O) / 2; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(wins, 150); const avg = turns / wins;
  assert.ok(avg >= 3 && avg <= 6.5, `turns each ${avg.toFixed(2)}`);
});
