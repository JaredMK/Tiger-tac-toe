'use strict';
// Simulations: Blackjack. Slow, so never part of npm test:
// npm run sim -- bj
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bj = over => Object.assign(E.newMini('bj', lcg(1)), over || {});
// A Blackjack hand in play for p, with the hole card and the deck (the next card drawn is the last).
const inHand = (p, cards, up, hole, deck) => bj({ hand: { by: p, cards, up }, hole, deck });

test('blackjack: pushes in a row stay in one turn: each one deals a new hand, until a hand is won or lost', () => {
  // a player stands into a push twice, then wins: one turn throughout, a fresh hand each time
  const st = E.newMatch(lcg(11), { games: ['bj'], mode: 'local' });
  st.turn = 'X';
  const sq = st.squares[0];
  const rig = (cards, up, hole, deck) => Object.assign(sq.mini, { hand: { by: 'X', cards, up }, hole, deck });
  rig(['TS', '9H'], 'KC', '9D', ['2S']);
  st.lock = 0;
  let seed = 100;
  for (let k = 1; k <= 2; k++) {
    let r;
    do { const keep = JSON.parse(JSON.stringify(st)); r = E.playMove(st, 0, 'stand', lcg(seed++)); if (st.lock !== 0) { Object.assign(st, keep); rig(['TS', '9H'], 'KC', '9D', ['2S']); } } while (st.lock !== 0);
    assert.equal(r.ok, true);
    assert.equal(sq.mini.pushed.length, 1, `push ${k}: shown before the new hand`);
    assert.ok(sq.mini.hand && sq.mini.hand.by === 'X' && sq.mini.deck.length === 48, `push ${k}: a new hand from a reshuffled deck`);
    assert.deepEqual(sq.mini.wins, { X: 0, O: 0 });
    E.endFlash(st);
    assert.deepEqual([st.turn, st.lock], ['X', 0], `push ${k}: still X's turn, held on this square`);
    assert.equal(E.applyMove(sq.mini, 'O', 'hit').reason, 'busy', 'O cannot touch the hand');
    rig(k === 1 ? ['KS', '8H'] : ['KS', 'QH'], 'TC', k === 1 ? '8D' : '7D', ['2S']);   // 18 v 18 (a push again), then 20 v 17
  }
  const w = E.playMove(st, 0, 'stand', lcg(seed));
  assert.equal(w.ok, true);
  assert.equal(sq.mini.last.res, 'win');
  assert.equal(sq.mini.pushed, null);
  assert.equal(st.lock, null, 'the win ends the turn');
  E.endFlash(st);
  assert.deepEqual([st.turn, sq.mini.wins.X], ['O', 1]);
  // the stand a timeout makes on a hand under way ('auto'): every new hand a push brings is stood on, until one is won or lost
  let autos = 0;
  for (let seed = 1; seed < 6000 && autos < 3; seed++) {
    const st = E.newMatch(lcg(seed), { games: ['bj'], mode: 'online', timer: 60 });
    st.turn = 'O';
    E.playMove(st, 0, 'auto', lcg(seed + 7), { forced: true, noAgain: true });
    const tm = st.squares[0].mini;
    if (!tm.pushed) continue;
    if (tm.pushed.length >= 2) autos++;
    assert.ok(tm.pushed.every(h => h.res === 'push' && h.by === 'O'));
    assert.notEqual(tm.last.res, 'push');
    assert.equal(tm.hand, null, 'a timeout plays every new hand out (standing)');
    assert.equal(st.lock, null, 'and the turn ends on the win or the loss');
    E.endFlash(st);
    assert.equal(st.turn, 'X');
  }
  assert.ok(autos >= 3, `timeouts through two pushes or more (${autos})`);
  // the computer, through a push: it plays the new hand in the same turn
  for (let seed = 1; seed < 400; seed++) {
    const st = E.newMatch(lcg(seed), { games: ['bj'], mode: 'cpu' });
    st.squares[0].mini = inHand('X', ['TS', '9H'], 'KC', '9D', ['2S']);
    st.turn = 'X'; st.lock = 0;
    const p = E.playMove(st, 0, 'stand', lcg(seed));
    if (!(p.ok && st.lock === 0)) continue;                         // (the new hand was a natural)
    E.endFlash(st);
    assert.equal(st.turn, 'X', 'still X to play');
    const c = E.cpuMove(st, lcg(seed));
    assert.equal(c.square, 0, 'the computer plays its new hand');
    assert.ok(['hit', 'stand'].includes(c.move), 'hit or stand, never a double');
    return;
  }
  assert.fail('no push dealt a new hand');
});
