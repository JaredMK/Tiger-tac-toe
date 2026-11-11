'use strict';
// Poker Hands (November 2026): its rules and computer (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/poker/rules.js');
const A = require('../../src/games/poker/ai.js');

const at = v => () => v;                                              // (an rng that always says v)
test('poker: every hand ranked right, an ace high or low, and scored by the settings', () => {
  const cases = [
    [['2S', '2H', '9C', 'KD', '4S'], 'pair'], [['2S', '2H', '9C', '9D', '4S'], 'two'], [['7S', '7H', '7C', 'KD', '4S'], 'three'],
    [['5S', '6H', '7C', '8D', '9S'], 'straight'], [['AS', '2H', '3C', '4D', '5S'], 'straight'], [['TS', 'JH', 'QC', 'KD', 'AS'], 'straight'],
    [['QS', 'KH', 'AC', '2D', '3S'], 'none'], [['2H', '7H', '9H', 'JH', 'KH'], 'flush'], [['7S', '7H', '7C', 'KD', 'KS'], 'full'],
    [['7S', '7H', '7C', '7D', 'KS'], 'four'], [['5H', '6H', '7H', '8H', '9H'], 'sf'], [['AH', '2H', '3H', '4H', '5H'], 'sf'], [['3S', '8H', '9C', 'JD', 'KS'], 'none'],
  ];
  for (const [h, k] of cases) assert.equal(R.handRank(h), k, h.join(' '));
  const m = E.newMini('poker', E.makeRng('p'));
  assert.deepEqual(['pair', 'two', 'three', 'straight', 'flush', 'full', 'four', 'sf'].map(k => R.pokPoints(m)[k]), [1, 2, 3, 4, 5, 6, 8, 10]);
  E.setTune('poker', { flush: 7, target: 12 });
  try { const t = E.newMini('poker', E.makeRng('q')); assert.equal(R.pokPoints(t).flush, 7); assert.deepEqual(t.tune, { flush: 7, target: 12 }); } finally { E.setTune('poker', null); }
});
test('poker: Deal holds the turn; the draw replaces exactly the marked cards from the rest of the deck, scores, and ends the move', () => {
  const m = E.newMini('poker', E.makeRng('a'));
  assert.equal(E.applyMove(m, 'X', 'draw:00000', E.makeRng('x')).ok, false, 'no draw before a deal');
  const d = E.applyMove(m, 'X', 'deal', E.makeRng('b'));
  assert.deepEqual([d.ok, d.again], [true, true]);
  assert.equal(E.applyMove(m, 'X', 'deal', E.makeRng('b')).ok, false, 'one deal a move');
  const dealt = m.cur.hand.slice();
  assert.equal(new Set(dealt).size, 5);
  const r = E.applyMove(m, 'X', 'draw:10100', E.makeRng('c'));
  assert.ok(r.ok); assert.ok(!r.again, 'the move ends');
  const h = m.last.hand;
  assert.deepEqual([h[1], h[3], h[4]], [dealt[1], dealt[3], dealt[4]], 'the kept cards stay in their places');
  assert.ok(!dealt.includes(h[0]) && !dealt.includes(h[2]), 'the new cards are never ones dealt');
  assert.deepEqual(m.last.thrown, [1, 0, 1, 0, 0]); assert.equal(m.last.drawn.length, 2);
  assert.equal(m.last.pts, R.pokPoints(m)[R.handRank(h)]); assert.equal(m.score.X, m.last.pts); assert.equal(m.cur, null);
  for (const bad of ['draw:1111', 'draw:22222', 'x', null]) { E.applyMove(m, 'O', 'deal', E.makeRng('z')); assert.equal(E.applyMove(m, 'O', bad, E.makeRng('z')).ok, false); m.cur = null; }
});
test('poker: the first total at the target wins; with "Go again on success" on a scoring hand deals again; a timeout scores the hand as dealt', () => {
  const m = E.newMini('poker', E.makeRng('w')); m.score.X = 6;
  m.cur = { by: 'X', hand: ['2S', '2H', '9C', 'KD', '4S'] };
  assert.deepEqual([E.applyMove(m, 'X', 'draw:00000', at(0)).outcome, m.score.X], ['win', 7]);
  E.setTune('poker', { again: 'on' });
  try {
    const g = E.newMini('poker', E.makeRng('g')); g.cur = { by: 'O', hand: ['7S', '7H', '7C', 'KD', '4S'] };
    assert.equal(E.applyMove(g, 'O', 'draw:00000', at(0)).again, true);
    g.cur = { by: 'O', hand: ['3S', '8H', '9C', 'JD', 'KS'] };
    assert.ok(!E.applyMove(g, 'O', 'draw:00000', at(0)).again, 'nothing scored: the turn passes');
  } finally { E.setTune('poker', null); }
  const st = E.newMatch(E.makeRng('t'), { games: ['poker'] }), p = st.turn;
  E.playMove(st, 4, 'deal', E.makeRng('d')); E.endFlash(st);
  assert.equal(st.lock, 4, 'the deal holds the turn to its square');
  const hand = st.squares[4].mini.cur.hand.slice();
  st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('e'));
  assert.ok(t.ok); assert.equal(t.move, 'auto');
  assert.deepEqual(st.squares[4].mini.last.hand, hand, 'scored as dealt'); assert.equal(st.squares[4].mini.last.by, p);
});
test('poker: the computer: Hard throws by expected points (a pair kept, four to a straight flush drawn to, a made hand stood on); every level legal', () => {
  const P = R.pokPoints(E.newMini('poker', E.makeRng('k')));
  assert.equal(A.pokBest(['9S', '9H', '2C', '5D', 'KS'], P, E.makeRng('h1'), null).mask, '00111', 'the pair kept');
  assert.equal(A.pokBest(['5H', '6H', '7H', '8H', 'KS'], P, E.makeRng('h2'), null).mask, '00001', 'four to a straight flush: the odd card thrown');
  assert.equal(A.pokBest(['2H', '7H', '9H', 'JH', 'KH'], P, E.makeRng('h3'), null).mask, '00000', 'a flush stands');
  assert.equal(A.pokBest(['7S', '7H', '7C', '7D', 'KS'], P, E.makeRng('h4'), null).mask[4], '0', 'four of a kind: nothing to gain by throwing');
  assert.equal(A.pokPlain(['9S', '9H', '2C', '5D', 'KS']), '00111');
  assert.equal(A.pokPlain(['5H', '6H', '7H', '8H', 'KS']), '00001');
  for (const lvl of ['easy', 'normal', 'hard']) {
    for (let i = 0; i < 20; i++) {
      const rng = E.makeRng(lvl + i), m = E.newMini('poker', rng);
      assert.equal(E.localBest(E.publicMini(m), 'X', rng, {}, { level: lvl }).move, 'deal');
      E.applyMove(m, 'X', 'deal', rng);
      const b = E.localBest(E.publicMini(m), 'X', rng, {}, { level: lvl, until: null });
      assert.ok(R.MASK.test(b.move), b.move); assert.ok(E.applyMove(m, 'X', b.move, rng).ok);
    }
  }
  const t0 = performance.now(); A.pokBest(['2S', '7H', '9C', 'JD', 'KH'], P, E.makeRng('s'), null); assert.ok(performance.now() - t0 < 400, 'Hard is quick');
  assert.ok(A.needs(E.publicMini(E.newMini('poker', E.makeRng('n'))), 'X') > 3);
});
test('poker: the public view and the flash carry the hand and the scores; whole squares between the computers end with a winner', () => {
  const st = E.newMatch(E.makeRng('f'), { games: ['poker'] });
  assert.ok(E.playMove(st, 4, 'deal', E.makeRng('g')).ok);
  assert.deepEqual(Object.keys(st.flash.poker).sort(), ['by', 'hand', 'kind', 'score']);
  E.endFlash(st);
  assert.ok(E.playMove(st, 4, 'draw:11111', E.makeRng('h')).ok);
  assert.ok(['drawn', 'from', 'hand', 'pts', 'rank', 'thrown', 'to'].every(k => k in st.flash.poker));
  assert.ok(E.playMs(st.flash) >= R.pokTimes(st.flash.poker).end);
  assert.deepEqual(Object.keys(E.publicMini(st.squares[4].mini)).sort(), ['cur', 'hands', 'score', 'type', 'v']);
  for (let g = 0; g < 100; g++) {
    const rng = E.makeRng('sq' + g), m = E.newMini('poker', rng); let p = 'X', done = false;
    for (let k = 0; k < 200 && !done; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok); if (r.outcome === 'win') done = true; else if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
    assert.ok(done, 'a winner');
  }
});
