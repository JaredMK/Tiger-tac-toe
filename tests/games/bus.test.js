'use strict';
// Ride the Bus: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Ride the Bus ===================================== */
test('ride the bus: ace high, and a tie is wrong (round 2: an equal value; round 3: equal to either card)', () => {
  const R = E.busRight;
  assert.equal(R(['AS'], 'higher', 'KD'), false, 'nothing is higher than an ace');
  assert.equal(R(['AS'], 'lower', 'KD'), true);
  assert.equal(R(['2S'], 'lower', 'AD'), false, 'the ace is high, not low');
  assert.equal(R(['2S'], 'higher', 'AD'), true);
  assert.equal(R(['7S'], 'higher', '7H'), false, 'a tie: wrong either way');
  assert.equal(R(['7S'], 'lower', '7H'), false);
  assert.equal(R(['4S', '9H'], 'inside', '7D'), true);
  assert.equal(R(['9H', '4S'], 'inside', '7D'), true, 'the order of cards 1 and 2 does not matter');
  assert.equal(R(['4S', '9H'], 'outside', 'AD'), true);
  assert.equal(R(['4S', '9H'], 'outside', '2D'), true);
  for (const c of ['4D', '9C']) { assert.equal(R(['4S', '9H'], 'inside', c), false); assert.equal(R(['4S', '9H'], 'outside', c), false, `${c}: equal to a card is wrong`); }
  assert.equal(R(['5S', '6H'], 'inside', '5D'), false, 'nothing fits between 5 and 6');
  assert.equal(R([], 'red', 'QH'), true); assert.equal(R([], 'red', 'QD'), true); assert.equal(R([], 'black', 'QC'), true); assert.equal(R([], 'red', 'QS'), false);
  assert.equal(R(['2S', '5H', '9C'], 'H', 'KH'), true); assert.equal(R(['2S', '5H', '9C'], 'D', 'KH'), false);
});

test('ride the bus: a right guess keeps the card and goes on in the same turn; a wrong one ends the turn and keeps the progress', () => {
  const st = E.newMatch(lcg(9), { games: ['bus'] }), m = st.squares[0].mini;
  st.turn = 'X';
  // round 1 right (the rng draws until a red card comes), round 2 wrong
  let r, seed = 1;
  for (;; seed++) { const t = JSON.parse(JSON.stringify(st)); r = E.playMove(t, 0, 'red', lcg(seed)); if (t.squares[0].mini.last.right) break; }
  r = E.playMove(st, 0, 'red', lcg(seed));
  assert.deepEqual([r.flash.kind, st.lock, m.prog.X.length], ['again', 0, 1], 'right: kept, and the same player goes on');
  const card1 = m.prog.X[0];
  E.endFlash(st);
  assert.equal(st.screen, 'mini');
  for (seed = 1; ; seed++) { const t = JSON.parse(JSON.stringify(st)); E.playMove(t, 0, 'higher', lcg(seed)); if (!t.squares[0].mini.last.right) break; }
  r = E.playMove(st, 0, 'higher', lcg(seed));
  assert.deepEqual([r.flash.kind, st.lock, m.prog.X], ['move', null, [card1]], 'wrong: the turn ends, card 1 is kept');
  assert.notEqual(m.last.card, card1);
  E.endFlash(st);
  assert.equal(st.turn, 'O');
  assert.deepEqual(m.prog.O, [], 'the other player has their own progress');
  // next visit: round 2 again, with a new card
  st.turn = 'X';
  assert.equal(E.publicMini(m).prog.X.length, 1);
  assert.equal(E.applyMove(m, 'X', 'red', lcg(1)).reason, 'bad', 'not round 1 any more');
});

test('ride the bus: cards come from a reshuffled deck without the player\'s kept cards; passing round 4 wins', () => {
  const kept = ['QH', '4C', '9D'];
  for (let seed = 1; seed < 3000; seed++) {
    const m = Object.assign(E.newMini('bus', lcg(1)), { prog: { X: kept.slice(), O: [] } });
    E.applyMove(m, 'X', 'S', lcg(seed));
    assert.ok(!kept.includes(m.last.card), `${m.last.card} was kept already`);
  }
  assert.equal(E.busDeck(kept).length, 49);
  const m = Object.assign(E.newMini('bus', lcg(1)), { prog: { X: kept.slice(), O: [] } });
  let seed = 1, r;
  for (;; seed++) { const t = JSON.parse(JSON.stringify(m)); r = E.applyMove(t, 'X', 'S', lcg(seed)); if (r.note === 'right') break; }
  assert.deepEqual(E.applyMove(m, 'X', 'S', lcg(seed)), { ok: true, outcome: 'win', note: 'right' }, 'the suit right: the square');
  assert.equal(m.prog.X.length, 4);
});

test('ride the bus: the odds, and the computer picks the best guess', () => {
  const odds = k => Object.fromEntries(E.busOdds(k).map(o => [o.guess, Math.round(o.p * 51)]));
  assert.deepEqual(odds(['2S']), { higher: 48, lower: 0 }, 'above a 2: 48 of the 51 left (three 2s tie)');
  assert.deepEqual(odds(['AS']), { higher: 0, lower: 48 });
  const st = Object.fromEntries(E.busOdds(['4S', '9H']).map(o => [o.guess, o.p * 50]));
  assert.deepEqual([Math.round(st.inside), Math.round(st.outside)], [16, 28], '5-8 inside (16); 2, 3 and 10-A outside (4 + 4 + 20)');
  const pm = { type: 'bus', prog: { X: ['4S', '9H'], O: [] } };
  assert.equal(E.localBest(pm, 'X', lcg(1)).move, 'outside');
  assert.equal(E.localBest({ type: 'bus', prog: { X: ['KS'], O: [] } }, 'X', lcg(1)).move, 'lower');
  const suits = E.localBest({ type: 'bus', prog: { X: ['5S', '6S', 'QS'], O: [] } }, 'X', lcg(1)).move;
  assert.notEqual(suits, 'S', 'with three spades kept, never spades');
});

test('ride the bus: a timeout is one random guess, and the turn ends even when it is right', () => {
  for (let seed = 1; seed < 60; seed++) {
    const st = E.newMatch(lcg(seed), { games: ['bus'], mode: 'online', timer: 60 });
    st.turn = 'X';
    const r = E.timeoutMove(st, lcg(seed + 100));
    assert.equal(r.ok, true);
    assert.ok(['red', 'black'].includes(r.move));
    assert.equal(st.lock, null, 'the turn ends');
    assert.equal(st.flash.kind === 'again', false);
  }
});

test('ride the bus: the admin\'s settings (a tie right, the computer\'s mistakes) are dealt into the square and played by', () => {
  E.setTune('bus', { ties: 'right', miss: 100 });
  const m = E.newMini('bus', E.makeRng('bus-tune'));
  E.setTune('bus', null);
  assert.deepEqual(m.tune, { ties: 'right', miss: 100 });
  // a tie is right: higher and lower both count an equal value
  const odds = Object.fromEntries(E.busOdds(['7S'], true).map(o => [o.guess, Math.round(o.p * 51)]));
  assert.deepEqual(odds, { higher: 31, lower: 23 });
  m.prog.X = ['7S'];
  const rng = E.makeRng('bus-tie');
  let ties = 0;
  for (let k = 0; k < 200; k++) { const c = JSON.parse(JSON.stringify(m)), r = E.applyMove(c, 'X', 'higher', rng); if (c.last.card[0] === '7') { ties++; assert.equal(c.last.right, true); } assert.ok(r.ok); }
  assert.ok(ties > 0);
  // a mistake rate of 100: the computer's suit guess is any suit, not just the likeliest
  m.prog.X = ['2H', '3H', '4H'];
  const seen = new Set(); for (let k = 0; k < 40; k++) seen.add(E.localBest(E.publicMini(m), 'X', rng).move);
  assert.ok(seen.size > 1);
});
