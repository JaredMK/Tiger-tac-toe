'use strict';
// Run with:  node --test
// The card games and the wheel: Blackjack, Ride the Bus and Roulette, in the shared engine (engine.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bj = over => Object.assign(E.newMini('bj', lcg(1)), over || {});
const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));   // a room's games: just this one
// A Blackjack hand in play for p, with the hole card and the deck (the next card drawn is the last).
const inHand = (p, cards, up, hole, deck) => bj({ hand: { by: p, cards, up, doubled: false }, hole, deck });
// Play whole turns until the match is over: the computer on both sides.
function cpuMatch(games, seed, guard = 900) {
  const rng = lcg(seed), st = E.newMatch(rng, { games });
  let n = 0;
  while (!st.winner && n++ < guard) {
    const m = E.cpuMove(st, rng);
    const r = E.playMove(st, m.square, m.move, rng);
    assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
    E.endFlash(st);
  }
  return { st, n };
}

/* ===================================== Blackjack ===================================== */
test('blackjack: hand values, with aces as 1 or 11 (soft while an 11 still fits)', () => {
  const t = cards => { const v = E.bjTotal(cards); return [v.total, v.soft]; };
  assert.deepEqual(t(['AS', '6H']), [17, true], 'ace and six: soft 17');
  assert.deepEqual(t(['AS', '6H', '9C']), [16, false], 'the ace drops to 1');
  assert.deepEqual(t(['AS', 'AD']), [12, true], 'two aces: 12, one counts 11');
  assert.deepEqual(t(['AS', 'AD', '9C']), [21, true]);
  assert.deepEqual(t(['AS', 'AD', 'AH', 'AC']), [14, true]);
  assert.deepEqual(t(['KS', 'QH']), [20, false], 'face cards count 10');
  assert.deepEqual(t(['KS', 'QH', '2C']), [22, false], 'over 21');
  assert.deepEqual(t(['TS', '5D', '6C']), [21, false]);
  assert.equal(E.bjNatural(['AS', 'KD']), true);
  assert.equal(E.bjNatural(['AS', '5D', '5C']), false, '21 on three cards is not a natural');
});

test('blackjack: the dealer hits 16 or less and stands on every 17, soft ones too', () => {
  assert.deepEqual(E.bjDealerPlay(['TS', '6H'], ['2C', '5D']), ['TS', '6H', '5D'], '16: draws (to 21)');
  assert.deepEqual(E.bjDealerPlay(['TS', '7H'], ['2C', '5D']), ['TS', '7H'], 'hard 17: stands');
  assert.deepEqual(E.bjDealerPlay(['AS', '6H'], ['2C', '5D']), ['AS', '6H'], 'soft 17: stands');
  assert.deepEqual(E.bjDealerPlay(['AS', '5H'], ['KC', '5D']), ['AS', '5H', '5D'], 'soft 16 hits (to a soft 21, then stands)');
  assert.deepEqual(E.bjDealerPlay(['9S', '5H'], ['KC', '2D']), ['9S', '5H', '2D', 'KC'], '14, 16, then over');
});

test('blackjack: Deal, Hit and Stand; a win adds 1, a push, a loss or a bust nothing, and the tally never goes down', () => {
  // the player 10+7 against the dealer's 9 up and 7 down; hits a 2 (19), stands: the dealer has 16, draws a 4 (20): a loss
  let m = inHand('X', ['TS', '7H'], '9C', '7D', ['4H', '2S']);
  assert.deepEqual(E.applyMove(m, 'X', 'hit', lcg(1)), { ok: true, outcome: 'continue', note: 'hit', again: true });
  assert.deepEqual(m.hand.cards, ['TS', '7H', '2S']);
  assert.deepEqual(E.applyMove(m, 'X', 'stand', lcg(1)), { ok: true, outcome: 'continue', note: 'lose' });
  assert.deepEqual(m.last.dealer, ['9C', '7D', '4H']);
  assert.deepEqual([m.wins.X, m.hand, m.hole, m.deck], [0, null, null, null], 'nothing added, and the hand is over');
  // 19 against the dealer's 10 + 9: a push, and the same player is dealt a new hand at once
  for (let seed = 1; ; seed++) {
    m = inHand('O', ['TS', '9H'], 'KC', '9D', ['2S']);
    const r = E.applyMove(m, 'O', 'stand', lcg(seed));
    if (!r.again) continue;                                         // (the new hand was a natural: settled)
    assert.deepEqual(r, { ok: true, outcome: 'continue', note: 'push', again: true });
    assert.equal(m.wins.O, 0);
    assert.deepEqual(m.pushed.map(h => [h.cards, h.res]), [[['TS', '9H'], 'push']], 'the pushed hand is kept to show');
    assert.equal(m.hand.by, 'O'); assert.equal(m.hand.cards.length, 2);
    assert.equal(m.deck.length, 48, 'from a reshuffled 52-card deck');
    break;
  }
  // 20 against 10 + 6 + 8 (the dealer busts): a win
  m = inHand('X', ['KS', 'QH'], 'TC', '6D', ['8S']);
  m.wins.X = 1;
  assert.deepEqual(E.applyMove(m, 'X', 'stand'), { ok: true, outcome: 'continue', note: 'win' });
  assert.equal(m.wins.X, 2);
  // a bust: the hole card turns, the dealer draws nothing, the tally stays
  m = inHand('X', ['KS', '6H'], '5C', 'TD', ['9S', 'QH']);
  m.wins.X = 2;
  assert.equal(E.applyMove(m, 'X', 'hit').note, 'bust');
  assert.deepEqual([m.wins.X, m.last.dealer], [2, ['5C', 'TD']], 'still 2; the dealer only shows its two cards');
  // reaching 21 stands by itself
  m = inHand('O', ['5S', '6H'], '7C', 'TD', ['9S', 'KH']);
  assert.equal(E.applyMove(m, 'O', 'hit').note, 'win', 'K: 21, stands; dealer 17, stands');
  // the third win takes the square
  m = inHand('X', ['KS', 'QH'], 'TC', '7D', ['2S']);
  m.wins.X = 2;
  assert.deepEqual(E.applyMove(m, 'X', 'stand'), { ok: true, outcome: 'win', note: 'win' });
  // refused: a second deal, hitting without a hand, doubling on three cards, the other player's hand
  m = inHand('X', ['5S', '6H', '2C'], '7C', 'TD', ['9S']);
  assert.equal(E.applyMove(m, 'X', 'deal').ok, false);
  assert.equal(E.applyMove(m, 'X', 'double').reason, 'double');
  assert.equal(E.applyMove(m, 'O', 'hit').reason, 'busy');
  assert.equal(E.applyMove(bj(), 'X', 'hit').reason, 'nohand');
  assert.equal(E.applyMove(bj(), 'X', 'split').reason, 'bad');
});

test('blackjack: a double draws exactly one card, stands, and counts 2 if it wins (0 if it loses)', () => {
  let m = inHand('X', ['5S', '6H'], '6C', 'TD', ['8S', '9H']);   // 11, doubles: draws the 9 (20); dealer 16, draws the 8: bust
  assert.deepEqual(E.applyMove(m, 'X', 'double'), { ok: true, outcome: 'continue', note: 'win' });
  assert.deepEqual([m.last.cards, m.last.doubled, m.last.gain, m.wins.X], [['5S', '6H', '9H'], true, 2, 2]);
  m = inHand('O', ['5S', '6H'], '6C', 'KD', ['8S', '2H']);        // 13 after the double, no more cards; dealer 16 + 8: bust
  m.wins.O = 1;
  assert.deepEqual(E.applyMove(m, 'O', 'double'), { ok: true, outcome: 'win', note: 'win' }, 'a won double from a tally of 1 takes the square');
  assert.equal(m.wins.O, 3);
  m = inHand('X', ['5S', '6H'], 'TC', 'KD', ['2H']);              // 13 against 20
  assert.equal(E.applyMove(m, 'X', 'double').note, 'lose');
  assert.equal(m.wins.X, 0, 'a lost double costs nothing');
});

test('blackjack: a natural wins 1 at once, a push against a dealer natural; a dealer blackjack beats any other 21', () => {
  const o = E.bjOutcome;
  assert.deepEqual(o(['AS', 'KD'], ['9C', '8D'], false, true), { res: 'bj', gain: 1 });
  assert.deepEqual(o(['AS', 'KD'], ['AC', 'QD'], false, true), { res: 'push', gain: 0 });
  assert.deepEqual(o(['7S', '7D', '7C'], ['AC', 'QD'], false, false), { res: 'lose', gain: 0, dealerBj: true });
  // dealt for real: find seeds that deal a natural, and one that deals both sides one
  let found = 0, both = 0;
  for (let seed = 1; seed < 6000 && (found < 3 || !both); seed++) {
    const m = bj(), r = E.applyMove(m, 'X', 'deal', lcg(seed));
    const first = m.pushed ? m.pushed[0] : m.last || m.hand;
    if (!E.bjNatural(first.cards)) continue;
    if (m.pushed) {                                                 // both sides dealt a natural: a push, and a new hand
      both++;
      assert.deepEqual([first.res, first.dealer.length], ['push', 2]);
      assert.ok(E.bjNatural(first.dealer));
      assert.ok(r.again ? m.hand && m.hand.by === 'X' : r.note !== 'push', 'the turn goes on with a new hand');
      continue;
    }
    assert.equal(r.again, undefined, 'a natural is settled on the deal');
    assert.equal(m.hand, null);
    found++; assert.deepEqual([r.note, m.wins.X, m.last.dealer.length], ['bj', 1, 2], 'the dealer shows its two cards and draws nothing');
  }
  assert.ok(found >= 3 && both >= 1, `naturals dealt (${found}, both ${both})`);
});

test('blackjack: every hand is dealt from a fresh 52-card deck: two cards each, no card twice', () => {
  for (let seed = 1; seed < 300; seed++) {
    const m = bj(), r = E.applyMove(m, 'O', 'deal', lcg(seed));
    if (!r.again) continue;                                         // (a natural: settled)
    const all = m.hand.cards.concat(m.hand.up, m.hole, m.deck);
    assert.equal(all.length, 52); assert.equal(new Set(all).size, 52);
    assert.ok(all.every(E.isCard));
  }
});

test('blackjack: the hole card and the deck are never visible early (public view, online record, the move played back)', () => {
  for (let seed = 1; seed < 40; seed++) {
    const rec0 = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only('bj'), timer: 60 }, lcg(seed), 'g' + seed);
    assert.ok(rec0.state.squares.every(s => s.mini.type === 'bj'));
    const r = E.applyOnlineMove(rec0, 'X', 4, 'deal', lcg(seed + 1));
    assert.equal(r.ok, true);
    const full = E.fullState(r.rec), m = full.squares[4].mini;
    if (!m.hand) continue;                                          // a natural, settled: nothing hidden left
    const hole = m.hole, shown = JSON.stringify([r.rec.state, r.entries]);
    assert.ok(E.isCard(hole) && m.deck.length === 48, 'the server has the hole card and the deck');
    assert.ok(!shown.includes(`"${hole}"`), `the hole card ${hole} is nowhere in what the phones get`);
    assert.ok(!('hole' in r.rec.state.squares[4].mini) && !('deck' in r.rec.state.squares[4].mini));
    assert.deepEqual(r.entries[0].bj.dealer, [m.hand.up], 'the move played back shows the up card only');
    assert.equal(JSON.stringify(E.publicMini(m)).includes(`"${hole}"`), false, 'nor what the computer gets to see');
    // standing turns it over: then it is on show
    const s = E.applyOnlineMove(r.rec, 'X', 4, 'stand', lcg(seed + 2));
    assert.equal(s.ok, true);
    assert.equal(s.entries[0].bj.dealer[1], hole, 'once the dealer plays, the hole card shows');
    assert.equal(JSON.stringify(s.rec.secrets).includes(`"${hole}"`), false, 'and nothing of the hand is kept hidden any more');
    return;
  }
  assert.fail('no hand was left in play');
});

test('blackjack: the computer plays basic strategy, doubling more readily on a tally of 1', () => {
  const s = (cards, up, eager) => E.bjStrategy(cards, up, eager);
  assert.equal(s(['TS', '6H'], 'KC'), 'hit', '16 against a 10');
  assert.equal(s(['TS', '6H'], '6C'), 'stand', '16 against a 6');
  assert.equal(s(['TS', '2H'], '3C'), 'hit', '12 against a 3');
  assert.equal(s(['TS', '2H'], '4C'), 'stand');
  assert.equal(s(['5S', '6H'], '6C'), 'double', '11');
  assert.equal(s(['3S', '6H', '2C'], '6C'), 'hit', 'an 11 on three cards cannot double: hit');
  assert.equal(s(['5S', '5H'], 'AC'), 'hit', '10 against an ace');
  assert.equal(s(['AS', '7H'], '9C'), 'hit', 'soft 18 against a 9');
  assert.equal(s(['AS', '7H'], '4C'), 'double', 'soft 18 against a 4');
  assert.equal(s(['AS', '7H'], '7C'), 'stand', 'soft 18 against a 7');
  assert.equal(s(['AS', '8H'], '6C'), 'stand', 'soft 19');
  assert.equal(s(['4S', '4H'], '5C'), 'hit', '8: hit');
  assert.equal(s(['4S', '4H'], '5C', true), 'double', '...but on a tally of 1 it doubles');
  assert.equal(s(['AS', '8H'], '6C', true), 'double', 'soft 19 against a 6, on a tally of 1');
  const pm = E.publicMini(inHand('X', ['4S', '4H'], '5C', 'TD', ['2S']));
  assert.equal(E.localBest(Object.assign(pm, { wins: { X: 1, O: 0 } }), 'X', lcg(1)).move, 'double');
  assert.equal(E.localBest(Object.assign(pm, { wins: { X: 0, O: 0 } }), 'X', lcg(1)).move, 'hit');
  assert.equal(E.localBest(E.publicMini(bj()), 'O', lcg(1)).move, 'deal');
});

test('blackjack: a timeout stands (dealing first when no hand is in play); the turn ends', () => {
  const st = E.newMatch(lcg(3), { games: ['bj'], mode: 'online', timer: 60 });
  st.squares[0].mini = inHand('X', ['TS', '2H'], '9C', '8D', ['KS', '5H']);
  st.turn = 'X'; st.lock = 0;
  const r = E.timeoutMove(st, lcg(4));
  assert.deepEqual([r.ok, r.square, r.move], [true, 0, 'auto']);
  assert.deepEqual([st.squares[0].mini.hand, st.squares[0].mini.last.cards], [null, ['TS', '2H']], 'stood on 12');
  assert.equal(st.lock, null);
  const st2 = E.newMatch(lcg(5), { games: ['bj'], mode: 'online', timer: 60 });
  st2.turn = 'O';
  const r2 = E.timeoutMove(st2, lcg(6)), m2 = st2.squares[r2.square].mini;
  assert.equal(r2.move, 'auto');
  assert.equal(m2.hand, null, 'dealt and stood at once');
  assert.ok(m2.last && m2.last.cards.length === 2 && m2.last.by === 'O');
  assert.notEqual(m2.last.res, 'push', 'a push never ends the turn');
  assert.equal(st2.lock, null, 'the turn ends');
});

test('blackjack: pushes in a row stay in one turn: each one deals a new hand, until a hand is won or lost', () => {
  // a player stands into a push twice, then wins: one turn throughout, a fresh hand each time
  const st = E.newMatch(lcg(11), { games: ['bj'], mode: 'local' });
  st.turn = 'X';
  const sq = st.squares[0];
  const rig = (cards, up, hole, deck) => Object.assign(sq.mini, { hand: { by: 'X', cards, up, doubled: false }, hole, deck });
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
  // timeouts: every new hand a push brings is stood on, until one is won or lost
  let autos = 0;
  for (let seed = 1; seed < 6000 && autos < 3; seed++) {
    const st = E.newMatch(lcg(seed), { games: ['bj'], mode: 'online', timer: 60 });
    st.turn = 'O';
    const t = E.timeoutMove(st, lcg(seed + 7)), tm = st.squares[t.square].mini;
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
    assert.ok(['hit', 'stand', 'double'].includes(c.move));
    return;
  }
  assert.fail('no push dealt a new hand');
});

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

/* ===================================== Roulette ===================================== */
test('roulette: the wheel holds 1-24 (odd red, even black, alternating) and a green 0', () => {
  assert.deepEqual(E.RL.wheel.slice().sort((a, b) => a - b), Array.from({ length: 25 }, (_, k) => k));
  const w = E.RL.wheel.filter(n => n);
  for (let k = 1; k < w.length; k++) assert.notEqual(E.rlRed(w[k]), E.rlRed(w[k - 1]), 'red and black alternate round the wheel');
  assert.equal(E.rlRed(0), false);
});

test('roulette: every bet scores right, and the 0 rules', () => {
  const C = E.rlCovers;
  const nums = [1, 4, 7, 10, 13, 16, 19, 22];
  for (let n = 0; n <= 24; n++) {
    assert.equal(C(nums, n), nums.includes(n), `numbers, ${n}`);
    assert.equal(C('g1', n), n >= 1 && n <= 8); assert.equal(C('g2', n), n >= 9 && n <= 16); assert.equal(C('g3', n), n >= 17 && n <= 24);
    assert.equal(C('zero', n), n === 0);
  }
  assert.deepEqual(E.rlBet([22, 1, 4, 7, 10, 13, 16, 19]), nums, 'numbers sorted');
  for (const bad of [[1, 2, 3, 4, 5, 6, 7], [1, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7, 25], 'g4', 'red', null, [1.5, 2, 3, 4, 5, 6, 7, 8]]) assert.equal(E.rlBet(bad), null, JSON.stringify(bad));
  // through the move: the spin lands where the rng says (pocket k round the wheel)
  const at = n => () => (E.RL.wheel.indexOf(n) + 0.5) / 25;
  let m = E.newMini('rl', lcg(1));
  assert.deepEqual(E.applyMove(m, 'X', 'g2', at(13)), { ok: true, outcome: 'continue', note: 'hit' });
  assert.deepEqual(E.applyMove(m, 'X', 'g2', at(0)), { ok: true, outcome: 'continue', note: 'miss' }, '0 on a group: a miss');
  assert.deepEqual(E.applyMove(m, 'O', nums, at(0)), { ok: true, outcome: 'continue', note: 'miss' }, '0 on numbers: a miss');
  assert.deepEqual(E.applyMove(m, 'O', 'zero', at(5)), { ok: true, outcome: 'continue', note: 'miss' });
  assert.deepEqual(m.hits, { X: 1, O: 0 });
  assert.deepEqual(E.applyMove(m, 'X', nums, at(22)), { ok: true, outcome: 'win', note: 'hit' }, 'the second hit takes the square');
  m = E.newMini('rl', lcg(1));
  assert.deepEqual(E.applyMove(m, 'O', 'zero', at(0)), { ok: true, outcome: 'win', note: 'zero' }, 'a bet on 0, landing on 0: at once');
  assert.deepEqual(m.hits, { X: 0, O: 0 });
  assert.equal(E.applyMove(m, 'X', [1, 2, 3], at(1)).reason, 'bad');
});

test('roulette: many spins land evenly; a group or 8 numbers hit 8 in 25, green 0 one in 25', () => {
  const rng = lcg(424242), N = 100000, count = new Array(25).fill(0);
  let g = 0, n8 = 0, z = 0;
  for (let k = 0; k < N; k++) {
    const m = E.newMini('rl', lcg(1)), bet = k % 3 === 0 ? 'g3' : k % 3 === 1 ? [2, 3, 5, 8, 13, 17, 20, 24] : 'zero';
    E.applyMove(m, 'X', bet, rng);
    count[m.last.n]++;
    if (m.last.hit) { if (bet === 'zero') z++; else if (Array.isArray(bet)) n8++; else g++; }
  }
  for (let n = 0; n < 25; n++) assert.ok(Math.abs(count[n] / N - 1 / 25) < 0.004, `pocket ${n}: ${count[n] / N}`);
  assert.ok(Math.abs(g / (N / 3) - 8 / 25) < 0.012, `group ${g / (N / 3)}`);
  assert.ok(Math.abs(n8 / (N / 3) - 8 / 25) < 0.012, `numbers ${n8 / (N / 3)}`);
  assert.ok(Math.abs(z / (N / 3) - 1 / 25) < 0.006, `zero ${z / (N / 3)}`);
});

test('roulette: the computer bets a group as a rule, green 0 when the other side is a hit from a square that matters or it is well behind', () => {
  const pm = (x, o) => ({ type: 'rl', hits: { X: x, O: o } });
  const zeros = (p, ctx, n = 400) => { let k = 0; const rng = lcg(5); for (let i = 0; i < n; i++) if (E.localBest(p, 'X', rng, null, ctx).move === 'zero') k++; return k / n; };
  assert.equal(zeros(pm(0, 0), { value: 2, behind: 0 }), 0, 'level: never');
  assert.equal(zeros(pm(0, 1), { value: 2, behind: 0 }), 0, 'behind in an ordinary square: never');
  const crit = zeros(pm(0, 1), { value: E.AI.block + 1, behind: 0 });
  assert.ok(crit > 0.25 && crit < 0.55, `one hit from a square that matters: sometimes (${crit})`);
  const far = zeros(pm(0, 1), { value: 2, behind: 3 });
  assert.ok(far > 0.12 && far < 0.4, `well behind: now and then (${far})`);
  for (let i = 0; i < 50; i++) assert.ok(['g1', 'g2', 'g3'].includes(E.localBest(pm(1, 0), 'X', lcg(i), null, { value: 2, behind: 0 }).move));
});

test('roulette: a timeout bets a random group', () => {
  const seen = new Set();
  for (let seed = 1; seed < 40; seed++) {
    const st = E.newMatch(lcg(seed), { games: ['rl'], mode: 'online', timer: 60 });
    const r = E.timeoutMove(st, lcg(seed));
    assert.ok(['g1', 'g2', 'g3'].includes(r.move)); seen.add(r.move);
  }
  assert.equal(seen.size, 3);
});

/* ===================================== all three ===================================== */
test('the three are dealt, ticked by default, explained and timed like every other game', () => {
  for (const t of ['bj', 'bus', 'rl']) {
    assert.ok(E.TYPES.includes(t)); assert.ok(E.INFO[t] && E.INFO[t].name);
    assert.equal(E.defaultSetup().games[t], true, `${t} ticked by default`);
    assert.ok(E.playMs({ type: t, kind: 'move', bj: { from: 0, cards: ['2S', '3S'], dealer: ['4S'] } }) > 500);
  }
});

test('computer against computer: matches of only the three finish, each game on its own and all together', () => {
  for (const games of [['bj'], ['bus'], ['rl'], ['bj', 'bus', 'rl']]) {
    for (let seed = 1; seed <= 6; seed++) {
      const { st, n } = cpuMatch(games, seed * 31 + games.length);
      assert.ok(st.winner, `${games} match ${seed} finishes (${n} moves)`);
    }
  }
});

test('computer against computer: mixed matches with every game finish, and the three get played', () => {
  const played = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const rng = lcg(seed * 7 + 3), st = E.newMatch(rng);
    st.squares.forEach((sq, i) => { if (i < 3) sq.mini = E.newMini(['bj', 'bus', 'rl'][i], rng); });   // one of each in every match
    let n = 0;
    while (!st.winner && n++ < 900) {
      const m = E.cpuMove(st, rng);
      const r = E.playMove(st, m.square, m.move, rng);
      assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
      played.add(st.flash.type);
      E.endFlash(st);
    }
    assert.ok(st.winner, `match ${seed} finishes (${n} moves)`);
  }
  for (const t of ['bj', 'bus', 'rl']) assert.ok(played.has(t), `${t} was played`);
});

test('online: the three play through the match record, and a timeout plays out a hand in one go', () => {
  for (const t of ['bj', 'bus', 'rl']) {
    let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only(t), timer: 60 }, lcg(11), 'm' + t);
    assert.ok(rec.state.squares.every(s => s.mini.type === t));
    for (let k = 0; k < 40 && !rec.state.winner; k++) {
      const full = E.fullState(rec), mv = E.cpuMove(full, lcg(k + 1));
      const r = E.applyOnlineMove(rec, full.turn, mv.square, mv.move, lcg(k + 50));
      assert.equal(r.ok, true, `${t}: ${JSON.stringify(mv.move)} (${r.reason})`);
      rec = r.rec;
    }
    const to = E.applyOnlineTimeout(rec, lcg(77));
    assert.equal(to.ok, true);
    if (!to.lost) assert.equal(E.fullState(to.rec).lock, null, `${t}: after a timeout the turn has passed`);
  }
});
