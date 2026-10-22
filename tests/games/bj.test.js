'use strict';
// Blackjack: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bj = over => Object.assign(E.newMini('bj', lcg(1)), over || {});
const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));   // a room's games: just this one
// A Blackjack hand in play for p, with the hole card and the deck (the next card drawn is the last).
const inHand = (p, cards, up, hole, deck) => bj({ hand: { by: p, cards, up }, hole, deck });

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
  // refused: a second deal, hitting without a hand, a double (there is none), the other player's hand
  m = inHand('X', ['5S', '6H'], '7C', 'TD', ['9S']);
  assert.equal(E.applyMove(m, 'X', 'deal').ok, false);
  assert.equal(E.applyMove(m, 'X', 'double').reason, 'bad', 'no Double');
  assert.equal(E.applyMove(m, 'O', 'hit').reason, 'busy');
  assert.equal(E.applyMove(bj(), 'X', 'hit').reason, 'nohand');
  assert.equal(E.applyMove(bj(), 'X', 'split').reason, 'bad');
});

test('blackjack: every win counts +1 (no doubling), a loss costs nothing', () => {
  let m = inHand('X', ['TS', '9H'], '6C', 'TD', ['8S']);           // 19 against 16 + 8: the dealer busts
  assert.deepEqual(E.applyMove(m, 'X', 'stand'), { ok: true, outcome: 'continue', note: 'win' });
  assert.deepEqual([m.last.gain, m.wins.X], [1, 1]);
  m = inHand('X', ['5S', '6H'], 'TC', 'KD', ['2H']);              // 11 stood against 20
  assert.equal(E.applyMove(m, 'X', 'stand').note, 'lose');
  assert.equal(m.wins.X, 0, 'a loss costs nothing');
  assert.equal(E.bjOutcome(['TS', '9H'], ['TC', '6D', '8S'], true, false).gain, 1, 'a hand from before marked doubled still counts 1');
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

test('blackjack: the computer plays basic strategy without doubling: hit or stand', () => {
  const s = (cards, up) => E.bjStrategy(cards, up);
  assert.equal(s(['TS', '6H'], 'KC'), 'hit', '16 against a 10');
  assert.equal(s(['TS', '6H'], '6C'), 'stand', '16 against a 6');
  assert.equal(s(['TS', '2H'], '3C'), 'hit', '12 against a 3');
  assert.equal(s(['TS', '2H'], '4C'), 'stand');
  assert.equal(s(['5S', '6H'], '6C'), 'hit', '11: hit (no double)');
  assert.equal(s(['5S', '5H'], 'AC'), 'hit', '10 against an ace');
  assert.equal(s(['AS', '7H'], '9C'), 'hit', 'soft 18 against a 9');
  assert.equal(s(['AS', '7H'], '4C'), 'stand', 'soft 18 against a 4: stand (no double)');
  assert.equal(s(['AS', '7H'], '7C'), 'stand', 'soft 18 against a 7');
  assert.equal(s(['AS', '6H'], '5C'), 'hit', 'soft 17');
  assert.equal(s(['AS', '8H'], '6C'), 'stand', 'soft 19');
  assert.equal(s(['TS', '7H'], 'AC'), 'stand', 'hard 17');
  for (const cards of [['2S', '3H'], ['TS', '6H'], ['AS', '7H'], ['9S', '2H']]) for (const up of ['2C', '6C', '9C', 'AC']) assert.ok(['hit', 'stand'].includes(s(cards, up)), 'never a double');
  const pm = E.publicMini(inHand('X', ['4S', '4H'], '5C', 'TD', ['2S']));
  assert.equal(E.localBest(Object.assign(pm, { wins: { X: 1, O: 0 } }), 'X', lcg(1)).move, 'hit');
  assert.equal(E.localBest(Object.assign(pm, { wins: { X: 0, O: 0 } }), 'X', lcg(1)).move, 'hit');
  assert.equal(E.localBest(E.publicMini(bj()), 'O', lcg(1)).move, 'deal');
  for (let k = 0; k < 30; k++) assert.ok(['hit', 'stand'].includes(E.randomLegalMove(inHand('X', ['5S', '6H'], '7C', 'TD', ['9S']), 'X', lcg(k))), 'a timeout never doubles');
});

test('blackjack: a timeout with a hand in play stands on it (no card drawn for the player); with no hand in play, nothing is dealt: the turn is missed', () => {
  const st = E.newMatch(lcg(3), { games: ['bj'], mode: 'online', timer: 60 });
  st.squares[0].mini = inHand('X', ['TS', '2H'], '9C', '8D', ['KS', '5H']);
  st.turn = 'X'; st.lock = 0;
  const r = E.timeoutMove(st, lcg(4));
  assert.deepEqual([r.ok, r.square, r.move, r.closed], [true, 0, 'auto', true]);
  assert.deepEqual([st.squares[0].mini.hand, st.squares[0].mini.last.cards], [null, ['TS', '2H']], 'stood on 12');
  assert.equal(st.lock, null);
  const st2 = E.newMatch(lcg(5), { games: ['bj'], mode: 'online', timer: 60 });
  st2.turn = 'O';
  const before = JSON.stringify(st2.squares.map(q => q.mini.hand));
  assert.deepEqual(E.timeoutMove(st2, lcg(6)), { ok: true, missed: 'O' });
  assert.equal(JSON.stringify(st2.squares.map(q => q.mini.hand)), before, 'nothing dealt');
  assert.deepEqual([st2.lock, st2.turn, st2.flash], [null, 'X', null], 'the turn passes');
});

test('blackjack: the admin\'s settings (hands to win, the dealer\'s stand) are dealt into the square and played by', () => {
  E.setTune('bj', { goal: 1, stand: 15 });
  const m = E.newMini('bj', lcg(1));
  E.setTune('bj', null);
  assert.deepEqual(m.tune, { goal: 1, stand: 15 });
  assert.deepEqual(E.newMini('bj', lcg(1)).tune, undefined, 'back to the defaults: nothing kept');
  // the dealer stands on 15 now; one win takes the square
  Object.assign(m, { hand: { by: 'X', cards: ['TS', '9H'], up: '9C' }, hole: '6D', deck: ['4H'] });
  assert.deepEqual(E.applyMove(m, 'X', 'stand', lcg(1)), { ok: true, outcome: 'win', note: 'win' });
  assert.deepEqual(m.last.dealer, ['9C', '6D'], '15: the dealer stands');
  assert.equal(E.publicMini(m).tune.goal, 1);
});

test('blackjack: the Hard computer hits or stands by the chance of winning the hand (a push dealt again), over the deck as it shows, for the square\'s own dealer', () => {
  const A = require('../../src/games/bj/ai.js'), ctx = { level: 'hard', until: null };
  const at = (cards, up, over) => { const m = inHand('X', cards, up, 'TD', ['2S']); Object.assign(m, over || {}); return A.best(E.publicMini(m), 'X', lcg(1), {}, ctx); };
  const t0 = performance.now();
  assert.equal(at(['TS', '6H'], 'KC').move, 'hit', '16 against a 10'); assert.equal(at(['TS', '6H'], '6C').move, 'stand', '16 against a 6');
  assert.equal(at(['AS', '7H'], '9C').move, 'hit', 'soft 18 against a 9'); assert.equal(at(['9S', '5H'], '6C').move, 'stand');
  assert.ok(performance.now() - t0 < 60, 'four Hard moves, the first with its deal table, under 60 ms');
  assert.equal(at(['3S', '9H'], '3C').move, 'stand', '12 against a 3: a win is a win, a push is a hand again (basic strategy, playing for money, hits)');
  assert.equal(E.bjStrategy(['3S', '9H'], '3C'), 'hit');
  assert.equal(at(['TS', '6H'], 'KC', { tune: { stand: 15 } }).move, 'stand', 'a dealer standing on 15: 16 holds against a 10'); assert.equal(at(['9S', '5H'], '6C', { tune: { stand: 15 } }).move, 'hit', 'and 14 against a 6 hits');
  assert.equal(at(['TS', '2H'], '4C', { tune: { stand: 19 } }).move, 'stand', 'a dealer drawing to 19 busts a lot: 12 stands');
  const v = A.bjHard(['TS', '6H'], 'KC', 17);
  assert.ok(v.hit > v.stand && v.hit > 0.2 && v.hit < 0.25, 'the hand\'s worth: ' + v.hit.toFixed(3) + ' hit, ' + v.stand.toFixed(3) + ' stand');
  const w = A.pushWorth(17); assert.ok(w > 0.45 && w < 0.5, 'a fresh hand is worth about 0.47 (0.43 won outright, a push dealt again): ' + w.toFixed(3));
  assert.equal(A.best(E.publicMini(bj()), 'X', lcg(1), {}, ctx).move, 'deal');
  const h = at(['TS', '6H'], 'KC', { wins: { X: 2, O: 0 } }); assert.ok(h.q > 0.2 && h.q < 0.25, 'one hand from the square: q is the hand\'s worth');
  for (let k = 0; k < 5; k++) { const t1 = performance.now(); at(['7S', '5H'], ['2C', '5C', '8C', 'TC', 'AC'][k]); assert.ok(performance.now() - t1 < 60); }
  assert.equal(at(['3S', '9H'], '3C', { tune: null }).move, 'stand'); assert.equal(A.best(E.publicMini(inHand('X', ['3S', '9H'], '3C', 'TD', ['2S'])), 'X', lcg(1), {}, {}).move, 'hit', 'the usual computer: basic strategy, as before');
});
