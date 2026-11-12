'use strict';
// Thirty-One (games/t31; v 2: one deck of 32 and one pile for both, each hand its side's own): its rules and AI, test by
// test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/t31/rules.js');
const A = require('../../src/games/t31/ai.js');

const fresh = seed => E.newMini('t31', E.makeRng(seed || 't31'));
// A square laid out by hand: p's hand, and the shared deck and pile when given.
const lay = (m, p, hand, deck, pile) => { m.hand[p] = hand.slice(); m.hn[p] = hand.length; if (deck) { m.deck = deck.slice(); m.left = deck.length; } if (pile) m.pile = pile.slice(); m.held = null; return m; };
const pv = (m, p) => E.publicMini(m, p);                          // what the computer for p sees: its own hand alone

test('t31: the score is the best single suit: an ace 11, the ten and the pictures 10 each, the rest their number; other suits nothing', () => {
  // all one suit
  assert.equal(R.t31Score(['AS', 'KS', 'QS']), 31);
  assert.equal(R.t31Score(['TS', 'JS', 'AS']), 31, 'a ten, a jack and an ace of one suit');
  assert.equal(R.t31Score(['TH', 'JH', 'QH']), 30, 'the ten and the pictures are 10 each');
  assert.equal(R.t31Score(['KD', 'QD', 'JD']), 30);
  assert.equal(R.t31Score(['7C', '8C', '9C']), 24, '7-8-9');
  assert.equal(R.t31Score(['AC', '9C', 'TC']), 30);
  // two tens and an ace, the hand the wrong score was seen on: every way the suits can fall
  assert.equal(R.t31Score(['TS', 'TH', 'AS']), 21, 'the ace with one ten');
  assert.equal(R.t31Score(['TS', 'TH', 'AD']), 11, 'three suits: the ace alone');
  assert.equal(R.t31Score(['TS', 'AS', 'TH']), 21, 'whatever the order');
  assert.equal(R.t31Score(['AH', 'TS', 'TD']), 11);
  assert.deepEqual(R.t31Best(['TS', 'TH', 'AS']), { score: 21, suit: 'S', cards: ['AS', 'TS'] });
  // split suits
  assert.equal(R.t31Score(['AS', 'KH', '9S']), 20);
  assert.equal(R.t31Score(['TD', 'JD', '7C']), 20);
  assert.equal(R.t31Score(['7C', '8H', '9D']), 9, 'three suits: the highest card');
  assert.deepEqual(R.t31Best(['7H', '8H', 'KC']), { score: 15, suit: 'H', cards: ['8H', '7H'] });
  assert.equal(R.t31Best(['KC', 'KH', 'KD']).score, 10, 'three of a kind is nothing special here');
  // every rank's worth, and every card of the deck a card
  assert.deepEqual(['7S', '8S', '9S', 'TS', 'JS', 'QS', 'KS', 'AS'].map(R.t31Val), [7, 8, 9, 10, 10, 10, 10, 11]);
  assert.equal(R.t31Deck().length, 32); assert.ok(R.t31Deck().every(c => '789TJQKA'.includes(c[0]) && R.t31Val(c) >= 7));
  // a held fourth card: the best three (what the best discard leaves), never more than three cards' worth
  assert.equal(R.t31Score(['TS', 'TH', '8C', 'AS']), 21, 'the card taken counts as soon as it is in the hand');
  assert.equal(R.t31Score(['7S', '8S', '9S', 'AS']), 28, 'four of a suit: its best three');
  assert.equal(R.t31Score(['AS', 'KS', 'QS', 'JS']), 31, 'never over 31');
  assert.equal(R.t31Score(['7C', '8H', '9D', 'TS']), 10);
  assert.deepEqual(R.t31Best(['7S', '8S', '9S', 'AS']).cards.sort(), ['8S', '9S', 'AS']);
  // an empty or short hand, and what is not a card
  assert.deepEqual(R.t31Best([]), { score: 0, suit: null, cards: [] });
  assert.equal(R.t31Score(null), 0); assert.equal(R.t31Score(undefined), 0);
  assert.equal(R.t31Score(['AS']), 11); assert.equal(R.t31Score(['AS', 'KS']), 21);
  assert.equal(R.t31Score(['AS', null, 'xx', 'KS']), 21, 'what is not a card counts nothing');
  // every hand of three from the deck, against the rule worked out the long way
  const deck = R.t31Deck(), val = c => ({ A: 11, K: 10, Q: 10, J: 10, T: 10 }[c[0]] || Number(c[0]));
  let n = 0;
  for (let i = 0; i < 32; i++) for (let j = i + 1; j < 32; j++) for (let k = j + 1; k < 32; k++) {
    const h = [deck[i], deck[j], deck[k]], want = Math.max(...'SHDC'.split('').map(s => h.filter(c => c[1] === s).reduce((a, c) => a + val(c), 0)));
    if (R.t31Score(h) !== want) assert.fail(`${h}: ${R.t31Score(h)}, not ${want}`);
    assert.ok(want >= 7 && want <= 31); n++;
  }
  assert.equal(n, 4960);
  assert.equal(E.tuneLive('t31').target, 30); assert.equal(E.tuneLive('t31').again, 'off');
});

test('t31: the deal: 32 cards, three cards of three suits each, the pile empty, the rest the one deck', () => {
  for (let g = 0; g < 200; g++) {
    const m = fresh('deal' + g);
    assert.equal(m.v, 2);
    for (const p of ['X', 'O']) { assert.equal(m.hand[p].length, 3); assert.equal(new Set(m.hand[p].map(c => c[1])).size, 3, 'three suits'); assert.ok(R.t31Score(m.hand[p]) <= 11); }
    assert.deepEqual(m.pile, []); assert.equal(m.deck.length, 26); assert.equal(m.left, 26);
    assert.equal(new Set([...m.hand.X, ...m.hand.O, ...m.deck]).size, 32, 'every card once');
  }
});

test('t31: one deck and one pile for both: a take (the pile or the deck; the turn held) then a discard onto the shared pile; the target wins', () => {
  const m = lay(lay(fresh(), 'X', ['7C', '8H', '9D'], ['KH', 'TS'], ['9C']), 'O', ['AS', 'KD', '7H']);
  assert.equal(E.applyMove(m, 'X', 'd0').ok, false, 'nothing to let go before a take');
  let r = E.applyMove(m, 'X', 'pile', E.makeRng('a'));
  assert.deepEqual([r.ok, r.again, r.note, m.hand.X.length, m.pile.length, m.hn.X], [true, true, 'take', 4, 0, 4]);
  assert.deepEqual(m.seen.X, ['9C'], 'a card off the pile was on show'); assert.equal(m.last.card, '9C');
  assert.equal(E.applyMove(m, 'X', 'deck').reason, 'taken', 'one take a turn');
  assert.equal(E.applyMove(m, 'X', 'pile').reason, 'taken');
  r = E.applyMove(m, 'X', 'd1', E.makeRng('b'));                      // the 8H goes: clubs 7 + 9 = 16
  assert.deepEqual([r.outcome, !!r.again, r.note, R.t31Score(m.hand.X)], ['continue', false, 'drop', 16]);
  assert.deepEqual(m.pile, ['8H']); assert.deepEqual(m.last, { by: 'X', kind: 'drop', card: '8H', k: 1 }, 'the move says the card and its place, never a score');
  assert.equal(m.turns.X, 1); assert.equal(m.hn.X, 3);
  // the other player takes that throw: the pile is one
  r = E.applyMove(m, 'O', 'pile', E.makeRng('c'));
  assert.ok(r.ok); assert.equal(m.hand.O[3], '8H'); assert.deepEqual(m.seen.O, ['8H']); assert.deepEqual(m.pile, []);
  assert.equal(E.applyMove(m, 'O', 'pile').reason, 'taken');
  r = E.applyMove(m, 'O', 'd3', E.makeRng('d')); assert.deepEqual(m.seen.O, [], 'thrown again: no longer held'); assert.deepEqual(m.pile, ['8H']);
  // the deck's top, the taker's alone
  r = E.applyMove(m, 'X', 'deck', E.makeRng('e'));
  assert.equal(m.hand.X[3], 'TS'); assert.equal(m.last.from, 'deck'); assert.equal(m.last.card, undefined, 'a deck card is the taker\'s alone'); assert.equal(m.left, 1);
  assert.equal(E.applyMove(m, 'X', 'd4').ok, false); assert.equal(E.applyMove(m, 'X', { d: 'TS' }).ok, false, 'the moves are d0 to d3');
  E.applyMove(m, 'X', 'd3', E.makeRng('f'));
  // an empty pile cannot be taken from
  const e = lay(fresh('e'), 'X', ['7C', '8H', '9D'], ['KH'], []);
  assert.equal(E.applyMove(e, 'X', 'pile').ok, false);
  // the target (30): 29 plays on, 30 wins, 31 wins
  const t = lay(fresh('t'), 'X', ['AH', 'KH', '7D'], ['7C'], ['8H']);   // hearts 29
  E.applyMove(t, 'X', 'pile'); r = E.applyMove(t, 'X', 'd2');
  assert.deepEqual([r.outcome, R.t31Score(t.hand.X)], ['continue', 29]);
  const u = lay(fresh('u'), 'X', ['AH', 'KH', '7D'], ['7C'], ['9H']);   // hearts 30: the target
  E.applyMove(u, 'X', 'pile'); r = E.applyMove(u, 'X', 'd2');
  assert.deepEqual([r.outcome, r.note], ['win', 'target']);
  const w = lay(fresh('w'), 'O', ['AS', 'KS', '7D'], ['7C'], ['QS']);
  E.applyMove(w, 'O', 'pile'); r = E.applyMove(w, 'O', 'd2');
  assert.deepEqual([r.outcome, r.note], ['win', 'thirtyone']);
  // a lower target, the admin's
  E.setTune('t31', { target: 24 });
  try {
    const l = lay(E.newMini('t31', E.makeRng('l')), 'X', ['7H', '8H', 'KD'], ['7C'], ['9H']);
    E.applyMove(l, 'X', 'pile'); r = E.applyMove(l, 'X', 'd2');
    assert.deepEqual([r.outcome, r.note], ['win', 'target']);
  } finally { E.setTune('t31', null); }
});

test('t31: the hands are each side\'s alone: never in the public state, an entry, a flash or the other side\'s view; nor the deck\'s order, nor a score; each side\'s part rides the per-side channel and comes back whole', () => {
  const st = E.newMatch(E.makeRng('th'), { games: ['t31'] }), k = 4, full = st.squares[k].mini, p = st.turn, q = p === 'X' ? 'O' : 'X';
  const rec = E.matchRecord(st), pub = rec.state.squares[k].mini;
  assert.deepEqual(pub.hand, {}, 'no hand in the public state'); assert.equal(pub.deck, undefined, 'nor the deck');
  assert.deepEqual(rec.sides[p][k].hand, full.hand[p]); assert.deepEqual(rec.sides[q][k].hand, full.hand[q]);
  assert.ok(Array.isArray(rec.secrets[k].hand.X) && Array.isArray(rec.secrets[k].deck), 'the server keeps them whole');
  const back = E.fullState(rec).squares[k].mini; assert.deepEqual(back.hand, full.hand); assert.deepEqual(back.deck, full.deck);
  const back2 = E.fullState(Object.assign({}, rec, { secrets: {} })).squares[k].mini; assert.deepEqual(back2.hand, full.hand, 'with no secrets, the sides alone put the hands back');
  // every card that is not public: both hands and the deck
  const hidden = m => [...m.hand.X, ...m.hand.O, ...m.deck];
  const free = (what, json, cards) => { for (const c of cards) assert.ok(!json.includes(`"${c}"`), `${what}: the card ${c} shows`); };
  free('the public square', JSON.stringify(pub), hidden(full));
  // a whole square played out through the record: each entry, each public square and each flash, move by move
  let r = rec, mover = p, seen = 0;
  const rng = E.makeRng('th-play');
  for (let n = 0; n < 400; n++) {
    const before = E.fullState(r).squares[k].mini;
    const mv = E.localBest(pv(before, mover), mover, rng, {}, { level: 'normal' }).move;
    const out = E.applyOnlineMove(r, mover, k, mv, rng);
    assert.ok(out.ok, out.reason);
    const after = E.fullState(out.rec).squares[k], e = out.entries[0], won = !!after.owner;
    if (after.mini.type !== 't31') break;
    if (!won) {
      const known = new Set([...after.mini.seen.X, ...after.mini.seen.O]);   // (a card off the pile was on show: public for as long as its taker holds it)
      for (const s of ['X', 'O']) assert.ok(after.mini.seen[s].every(c => after.mini.hand[s].includes(c)), 'seen: cards off the pile, still in that hand');
      const secretCards = hidden(after.mini).filter(c => !known.has(c));
      const pubNow = out.rec.state.squares[k].mini;
      free(`move ${n} ${mv}: the public square`, JSON.stringify(pubNow), secretCards);
      free(`move ${n} ${mv}: the entry`, JSON.stringify(e), secretCards);
      assert.deepEqual(pubNow.hand, {}); assert.equal(pubNow.deck, undefined); assert.deepEqual(e.after.mini.hand, {});
      assert.equal(e.t31.score, undefined, 'no score in a flash'); assert.equal(e.t31.suit, undefined); assert.equal(e.t31.before, undefined); assert.equal(e.t31.hand, undefined); assert.equal(e.t31.won, undefined);
      assert.ok(e.note === 'take' || e.note === 'drop', 'the note says nothing of a score: ' + e.note);
      if (mv === 'deck') { assert.equal(e.t31.card, undefined, 'a card off the deck is the taker\'s alone'); assert.equal(pubNow.held.card, undefined); assert.ok(out.rec.sides[mover][k].took, 'it rides the mover\'s side'); assert.equal(out.rec.sides[mover === 'X' ? 'O' : 'X'][k].took, undefined); }
      if (mv === 'pile') assert.equal(e.t31.card, before.pile[before.pile.length - 1]);
      for (const s of ['X', 'O']) {
        assert.deepEqual(out.rec.sides[s][k].hand, after.mini.hand[s], 'each side\'s own hand in its own node');
        const o = s === 'X' ? 'O' : 'X', view = pv(after.mini, s);
        assert.deepEqual(Object.keys(view.hand), [s], 'the computer\'s view: its own hand alone');
        free(`move ${n}: ${s}'s view`, JSON.stringify(Object.assign({}, view, { hand: {} })), [...after.mini.hand[o], ...after.mini.deck].filter(c => !known.has(c)));
      }
      assert.equal(pubNow.hn.X, after.mini.hand.X.length); assert.equal(pubNow.left, after.mini.deck.length);
      seen++;
    } else {
      assert.ok(e.t31.won && e.t31.won.score >= 30, 'a square won: the winning hand is open'); assert.deepEqual(e.t31.won.hand, after.mini.hand[mover]);
      assert.deepEqual(out.rec.state.squares[k].mini.hand, after.mini.hand, 'a claimed square\'s record is whole');
      break;
    }
    r = out.rec;
    if (e.kind !== 'again') mover = mover === 'X' ? 'O' : 'X';
  }
  assert.ok(seen > 6, 'moves checked: ' + seen);
});

test('t31: the deck run out: the pile under its top card is shuffled into a new one', () => {
  const m = lay(lay(fresh('r'), 'X', ['7C', '8H', '9D'], [], ['TD', 'JD', 'QD', 'KS']), 'O', ['AS', 'KD', '7H']);
  const r = E.applyMove(m, 'X', 'deck', E.makeRng('rs'));
  assert.ok(r.ok); assert.equal(m.last.reshuf, true); assert.deepEqual(m.pile, ['KS'], 'the top card stays');
  assert.ok(['TD', 'JD', 'QD'].includes(m.hand.X[3])); assert.equal(m.left, 2); assert.equal(m.deck.length, 2);
  // nothing under the top either: every card not in a hand or on the pile
  const n = lay(lay(fresh('r2'), 'X', ['7C', '8H', '9D'], [], ['KS']), 'O', ['AS', 'KD', '7H']);
  assert.ok(E.applyMove(n, 'X', 'deck', E.makeRng('rs2')).ok);
  assert.ok(!['7C', '8H', '9D', 'AS', 'KD', '7H', 'KS'].includes(n.hand.X[3])); assert.equal(n.left, 24);
});

test('t31: Go again on success: a discard that raises the score takes again; a timeout with a card taken lets that card go; never on one phone; a square from before is dealt again', () => {
  E.setTune('t31', { again: 'on' });
  try {
    const m = lay(fresh('g'), 'X', ['7C', '8H', '9D'], ['KH'], ['9C']);
    E.applyMove(m, 'X', 'pile'); const r = E.applyMove(m, 'X', 'd1');
    assert.deepEqual([r.again, r.note], [true, 'up']);
    E.applyMove(m, 'X', 'deck'); const s = E.applyMove(m, 'X', 'd3');   // the card taken thrown back: no higher
    assert.deepEqual([!!s.again, s.note], [false, 'drop']);
  } finally { E.setTune('t31', null); }
  const st = E.newMatch(E.makeRng('to'), { games: ['t31'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 'deck', E.makeRng('d')).ok); E.endFlash(st);
  assert.equal(st.lock, 4, 'the take holds the turn to the square');
  const before = st.squares[4].mini.hand[p].slice(0, 3), card = st.squares[4].mini.held.card;
  st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
  assert.ok(t.ok); assert.equal(t.move, 'auto');
  if (st.flash) E.endFlash(st);
  const m = st.squares[4].mini;
  assert.notEqual(st.turn, p, 'the turn passed'); assert.deepEqual(m.hand[p], before, 'the hand as it was'); assert.equal(m.pile[m.pile.length - 1], card, 'the card taken is on the pile'); assert.equal(m.held, null);
  assert.ok(E.NO_SAME_PHONE.includes('t31'), 'never two people on one phone');
  const same = E.newState(E.makeRng('sp')); same.setup.vs = 'same'; for (const g of E.TYPES) same.setup.games[g] = g === 't31' || g === 'ttt';
  assert.ok(E.startMatch(same, E.makeRng('sp'))); assert.ok(same.squares.every(q => q.mini.type === 'ttt'), 'Same phone never deals it');
  const old = E.newMatch(E.makeRng('old'), { games: ['t31'] });
  old.squares[2].mini = { type: 't31', v: 1, hand: { X: ['2C', '3H', '4D'], O: ['5C', '6H', '9D'] }, pile: { X: ['9C'], O: ['8C'] }, deck: { X: ['5S'], O: ['6S'] }, deckN: { X: 1, O: 1 }, held: null, turns: { X: 0, O: 0 }, last: null };
  const again = E.fullState(E.matchRecord(old)).squares[2].mini;
  assert.equal(again.v, 2, 'dealt again'); assert.ok(Array.isArray(again.pile) && again.hand.X.length === 3);
  assert.deepEqual(E.fullState(E.matchRecord(old)).squares[2].mini, again, 'the same on every phone and the server');
});

test('t31: the computer: its own hand alone; a winning take and discard always; Normal keeps its best score; Hard by expected value, wary of a suit the other side took off the pile; legal and quick', () => {
  const m = lay(lay(fresh('ai'), 'O', ['AS', 'KS', '7D'], null, ['9S']), 'X', ['7C', '8H', '9D']);   // the pile's 9S makes 30 in spades: a win
  let b = A.best(pv(m, 'O'), 'O', E.makeRng('x'), {}, { level: 'normal' });
  assert.deepEqual([b.move, b.q], ['pile', 1]);
  E.applyMove(m, 'O', 'pile');
  for (const level of ['easy', 'normal', 'hard']) assert.equal(A.best(pv(m, 'O'), 'O', E.makeRng('y'), {}, { level }).move, 'd2', level + ': the winning discard');
  const n = lay(fresh('n'), 'X', ['7H', '8H', '9C'], ['TS'], ['7D']);
  assert.equal(A.best(pv(n, 'X'), 'X', E.makeRng('z'), {}, { level: 'normal' }).move, 'deck', 'the pile does not help: draw');
  E.applyMove(n, 'X', 'deck');
  assert.ok(['d2', 'd3'].includes(A.best(pv(n, 'X'), 'X', E.makeRng('z'), {}, { level: 'normal' }).move), 'Normal lets the 9C or the TS go, keeping hearts');
  // Hard, two discards worth the same to it: the one of the suit the other side took off the pile stays in hand
  const g = lay(lay(fresh('gd'), 'X', ['AH', 'KH', '8S', '8D'], null, ['7C']), 'O', ['TD', 'JD', '9C']);
  g.held = { by: 'X', from: 'deck', card: '8D' }; g.seen.O = ['TD'];
  assert.equal(A.best(pv(g, 'X'), 'X', E.makeRng('g'), {}, { level: 'hard' }).move, 'd2', 'the 8S goes, not the 8D the other side wants');
  g.seen.O = ['TS']; g.hand.O = ['TS', 'JS', '9C'];
  assert.equal(A.best(pv(g, 'X'), 'X', E.makeRng('g'), {}, { level: 'hard' }).move, 'd3', 'and the other way round');
  // what it reckons with: never the other hand (the same answer whatever that hand holds, the public state the same)
  const a1 = lay(lay(fresh('k'), 'X', ['AH', '9S', '8D'], null, ['7C']), 'O', ['TD', 'JD', '9C']), a2 = lay(JSON.parse(JSON.stringify(a1)), 'O', ['KS', 'QS', 'JS']);
  for (const level of ['easy', 'normal', 'hard']) assert.deepEqual(A.best(pv(a1, 'X'), 'X', E.makeRng('s'), {}, { level }), A.best(pv(a2, 'X'), 'X', E.makeRng('s'), {}, { level }), level);
  assert.equal(A.t31Unseen(pv(a1, 'X'), 'X').length, 32 - 3 - 1);
  const t0 = performance.now(), h = A.best(pv(fresh('q'), 'X'), 'X', E.makeRng('w'), {}, { level: 'hard', until: null });
  assert.equal(h.move, 'deck', 'the pile is empty at the start'); assert.ok(performance.now() - t0 < 300, 'Hard is quick');
  assert.ok(A.needs(pv(fresh('q'), 'X'), 'X') >= 1); assert.ok(A.needs(pv(fresh('q'), 'X'), 'O') >= 1, 'the other side from public information alone');
});

test('t31: whole squares between the computers end with a winner in about 3 to 6 turns each, none before the winner\'s second turn', () => {
  let turns = 0, n = 0, first = 0;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('t31w' + g), m = E.newMini('t31', rng); let p = 'X';
    for (let k = 0; k < 600; k++) {
      const r = E.applyMove(m, p, E.localBest(pv(m, p), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok, r.reason);
      if (r.outcome !== 'continue') { assert.equal(r.outcome, 'win'); assert.ok(m.turns[p] >= 2, 'no win on a first turn'); turns += (m.turns.X + m.turns.O) / 2; n++; if (p === 'X') first++; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(n, 300); const avg = turns / n;
  assert.ok(avg >= 3 && avg <= 6, `turns each ${avg.toFixed(2)}`);
  assert.ok(first / n < 0.66, `the first mover ${(100 * first / n).toFixed(0)}% of 300`);
});
