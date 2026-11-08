'use strict';
// War: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/war/rules.js');
const A = require('../../src/games/war/ai.js');
const { timeoutClose } = require('../../src/core/board.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const WART = R.WART, WAR = R.WAR;
const mini = seed => E.newMini('war', E.makeRng(seed || 'war'));
// A deck rigged for p: the cards named come off the top in that order (the player's first, then the dealer's).
const rig = (m, p, ...top) => { m.deck[p] = ['2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'TC', 'JC', 'QC', 'KC'].concat(top.slice().reverse()); };
const DOWN = ['2D', '3D', '4D', '5D', '6D', '7D'];   // six cards nobody sees

/* ===================================== War ===================================== */
test('war: a fresh square: no rounds won, two shuffled decks of 52 (each player\'s own, hidden), nothing flipped; only Flip is a move', () => {
  const m = mini();
  assert.deepEqual([m.wins, m.flips, m.last], [{ X: 0, O: 0 }, { X: 0, O: 0 }, null]);
  assert.deepEqual([m.deck.X.length, m.deck.O.length], [52, 52]);
  assert.equal(new Set(m.deck.X).size, 52); assert.notDeepEqual(m.deck.X, m.deck.O, 'two shuffles');
  for (const bad of ['deal', 'roll', 'auto', 0, null, ['flip'], 'stand']) assert.equal(E.applyMove(mini(), 'X', bad, lcg(1)).ok, false);
  assert.equal(E.randomLegalMove(m, 'X', lcg(2)), 'flip');
  assert.throws(() => R.create('war'), /rng/, 'the engine needs an rng');
  assert.deepEqual(R.warRank('2S'), 0); assert.deepEqual(R.warRank('AS'), 12); assert.equal(R.warRank('TH'), 8);
});

test('war: the higher card wins the round (ace high, suits never matter), the dealer\'s higher loses it with nothing taken away; the deck goes down two a flip', () => {
  const m = mini('r1');
  rig(m, 'X', 'KH', '7S');                                               // the player's king against the dealer's seven
  assert.deepEqual(E.applyMove(m, 'X', 'flip', lcg(1)), { ok: true, outcome: 'continue', note: 'won' });
  assert.deepEqual([m.wins.X, m.flips.X, m.deck.X.length], [1, 1, 12]);
  assert.deepEqual(m.last, { by: 'X', battles: [{ p: 'KH', d: '7S' }], result: 'win', gain: 1, wars: 0 });
  rig(m, 'X', '2S', 'AH');
  assert.deepEqual(E.applyMove(m, 'X', 'flip', lcg(1)), { ok: true, outcome: 'continue', note: 'lost' });
  assert.deepEqual([m.wins.X, m.flips.X, m.last.result, m.last.gain], [1, 2, 'lose', 0], 'a loss: nothing taken away');
  rig(m, 'O', 'AS', 'KD');
  assert.deepEqual(E.applyMove(m, 'O', 'flip', lcg(1)), { ok: true, outcome: 'continue', note: 'won' });
  assert.deepEqual([m.wins, m.flips], [{ X: 1, O: 1 }, { X: 2, O: 1 }], 'each player\'s rounds are their own, from their own deck');
  rig(m, 'O', 'TS', 'TH', ...DOWN, '9H', 'QD');                          // a tie: war (three down each), then the dealer's queen
  assert.deepEqual(E.applyMove(m, 'O', 'flip', lcg(1)), { ok: true, outcome: 'continue', note: 'lost' });
  assert.deepEqual(m.last, { by: 'O', battles: [{ p: 'TS', d: 'TH' }, { p: '9H', d: 'QD' }], result: 'lose', gain: 0, wars: 1 });
  assert.equal(m.deck.O.length, 12, 'a war takes ten cards: two flipped, six down, two flipped');
});

test('war: a war won counts its worth (2 by default), a war on a war goes on until a card is higher, and the first to the goal takes the square', () => {
  const m = mini('r2');
  rig(m, 'X', 'QD', 'QC', ...DOWN, '9S', '5H');
  assert.deepEqual(E.applyMove(m, 'X', 'flip', lcg(1)), { ok: true, outcome: 'continue', note: 'won' });
  assert.deepEqual([m.wins.X, m.last.gain, m.last.wars, m.last.battles.length], [2, 2, 1, 2]);
  rig(m, 'O', '8D', '8C', ...DOWN, '4S', '4H', ...DOWN, 'AS', '3H');   // two wars deep
  assert.deepEqual(E.applyMove(m, 'O', 'flip', lcg(1)), { ok: true, outcome: 'continue', note: 'won' });
  assert.deepEqual([m.wins.O, m.last.gain, m.last.wars, m.last.battles.map(b => b.p + b.d)], [2, 2, 2, ['8D8C', '4S4H', 'AS3H']]);
  rig(m, 'X', '6D', '2C');
  assert.deepEqual(E.applyMove(m, 'X', 'flip', lcg(1)), { ok: true, outcome: 'win', note: 'won' }, 'the third round: the square');
  assert.equal(m.wins.X, 3);
  const n = mini('r3'); n.wins.O = 2; rig(n, 'O', 'JD', 'JC', ...DOWN, 'KS', '2H');
  assert.deepEqual(E.applyMove(n, 'O', 'flip', lcg(1)), { ok: true, outcome: 'win', note: 'won' }, 'a war won from 2: the square, the count held to the goal');
  assert.equal(n.wins.O, 3);
  // the admin's settings: dealt into the square and played by
  E.setTune('war', { goal: 2, warWorth: 1 });
  const t = E.newMini('war', E.makeRng('war-tune'));
  E.setTune('war', null);
  assert.deepEqual(t.tune, { goal: 2, warWorth: 1 });
  rig(t, 'X', 'QD', 'QC', ...DOWN, '9S', '5H');
  assert.deepEqual([E.applyMove(t, 'X', 'flip', lcg(1)).outcome, t.wins.X, t.last.gain], ['continue', 1, 1], 'a war worth 1 here');
  rig(t, 'X', '9D', '5C');
  assert.equal(E.applyMove(t, 'X', 'flip', lcg(1)).outcome, 'win', 'two rounds take it');
});

test('war: a deck under ten cards is reshuffled fresh before the flip, and one that runs out mid-war is refilled; the decks never go below empty', () => {
  const m = mini('r4');
  m.deck.X = ['2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', 'TS'];     // nine: under the line
  E.applyMove(m, 'X', 'flip', lcg(3));
  assert.ok(m.deck.X.length >= 42 && m.deck.X.length <= 50, `a fresh deck less the round (${m.deck.X.length})`);
  m.deck.X = ['2S', '3S', 'KD', 'KH', '4D', '5D', '6D', '7D', '8D', '9D', 'AH', 'AS'];   // twelve: played from; the aces tie, six go down, the kings tie, and the deck runs out under the second war's down cards
  const r = E.applyMove(m, 'X', 'flip', lcg(4));
  assert.ok(r.ok && m.last.battles.length >= 3 && ['win', 'lose'].includes(m.last.result), 'the war played out from a refilled deck');
  assert.deepEqual(m.last.battles.slice(0, 2), [{ p: 'AS', d: 'AH' }, { p: 'KH', d: 'KD' }]);
  assert.ok(m.deck.X.length > 28 && m.deck.X.length <= 46, `the fresh deck less the rest of the war (${m.deck.X.length})`);
  delete m.deck;                                                          // a square without its decks (never on a phone's own copy: the record's hidden part): still plays
  assert.equal(E.applyMove(m, 'O', 'flip', lcg(5)).ok, true);
  assert.ok(m.deck.O.length >= 42);
  // many flips: about half win, a tie every 17 flips or so, the count never past the goal, the win the goal reached
  const rng = E.makeRng('war-many');
  let flips = 0, won = 0, wars = 0, tied = 0;
  for (let g = 0; g < 600; g++) {
    const x = E.newMini('war', rng);
    for (let k = 0; k < 100; k++) {
      const p = k % 2 ? 'O' : 'X', res = E.applyMove(x, p, 'flip', rng);
      flips++; if (x.last.result === 'win') won++; wars += x.last.wars; if (x.last.wars) tied++;
      assert.ok(x.deck.X.length >= 0 && x.deck.O.length >= 0 && x.wins.X <= 3 && x.wins.O <= 3);
      if (res.outcome === 'win') { assert.equal(x.wins[p], 3); break; }
    }
  }
  assert.ok(Math.abs(won / flips - 0.5) < 0.03, `about half the flips win (${(won / flips).toFixed(3)})`);
  assert.ok(Math.abs(tied / flips - 3 / 51) < 0.015, `a tie about one flip in seventeen (${(tied / flips).toFixed(3)})`);
  assert.ok(wars >= tied, 'every tie a war');
});

test('war: in a match, one tap of Flip plays the round back card by card (warPlan) and the turn passes either way; the flash carries the cards, never the decks', () => {
  const st = E.newMatch(lcg(3), { games: ['war'] }), p0 = st.turn;
  rig(st.squares[0].mini, p0, 'QD', 'QC', ...DOWN, '9S', '5H');
  E.playMove(st, 0, 'flip', lcg(1));
  assert.deepEqual([st.flash.kind, st.flash.war.result, st.flash.war.gain, st.flash.war.wars, st.flash.war.battles.length, st.flash.war.deck], ['move', 'win', 2, 1, 2, undefined]);
  const plan = R.warPlan(st.flash.war);
  assert.deepEqual(plan.battles[0], { pAt: 0, pFlip: WART.slide, dAt: WART.gap, dFlip: WART.gap + WART.slide, judge: WART.gap + WART.slide + WART.flip + WART.judge, downAt: WART.gap + WART.slide + WART.flip + WART.judge + WART.war }, 'the player\'s card, the dealer\'s, the tie judged, the down cards');
  const b1 = plan.battles[1], from = plan.battles[0].downAt + WAR.down * WART.down + WART.lead;
  assert.deepEqual([b1.pAt, b1.judge, b1.downAt, plan.end], [from, from + WART.gap + WART.slide + WART.flip + WART.judge, undefined, from + WART.gap + WART.slide + WART.flip + WART.judge]);
  assert.equal(E.playMs(st.flash), plan.end + WART.result + WART.pip, 'the round plays out, the result held, the pips filling in');
  E.endFlash(st);
  assert.deepEqual([st.lock, st.turn, st.screen], [null, p0 === 'X' ? 'O' : 'X', 'board'], 'a round won passes the turn (no streak)');
  rig(st.squares[0].mini, st.turn, '2D', '9C');
  E.playMove(st, 0, 'flip', lcg(1));
  assert.deepEqual([st.flash.war.result, st.flash.war.gain], ['lose', 0]);
  assert.equal(E.playMs(st.flash), R.warPlan(st.flash.war).end + WART.result, 'a round lost: no pip');
  E.endFlash(st); assert.equal(st.turn, p0);
  assert.equal(E.localBest(E.publicMini(st.squares[0].mini), st.turn, lcg(1)).move, 'flip', 'the computer flips');
  assert.equal(R.flashMs({ war: null }, 0, false), WART.slide + WART.flip + WART.result);
});

test('war: the decks are the square\'s secret: never in the public view, the record or a move\'s entry; the cards turned are public; the view redraws the same without them', () => {
  const m = mini('r5');
  rig(m, 'X', 'KH', '7S'); E.applyMove(m, 'X', 'flip', lcg(1));
  const pub = E.publicMini(m);
  assert.equal(pub.deck, undefined); assert.deepEqual(pub.wins, { X: 1, O: 0 }); assert.deepEqual(pub.last.battles, [{ p: 'KH', d: '7S' }]);
  assert.deepEqual(Object.keys(E.secretOf(m)), ['deck']); assert.equal(E.secretOf(m).deck.X.length, 12);
  const hidden = JSON.parse(JSON.stringify(m)); R.hide(hidden, 0, null);
  assert.equal(hidden.deck, undefined); assert.deepEqual(hidden.last, m.last);
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === 'war']));
  const rec0 = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, lcg(3), 'war1');
  for (let k = 0; k < 9; k++) { assert.equal(rec0.state.squares[k].mini.deck, undefined, 'the record shows no deck'); assert.equal(rec0.secrets[k].deck.X.length, 52); }
  const p = rec0.state.turn;
  rec0.secrets[4].deck[p] = ['2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'TC', 'JC', 'QC', 'KC', '3S', 'AH'];
  const r = E.applyOnlineMove(rec0, p, 4, 'flip', lcg(1));
  assert.deepEqual([r.ok, r.entries[0].kind, r.entries[0].war.result, r.entries[0].war.battles, r.rec.state.turn], [true, 'move', 'win', [{ p: 'AH', d: '3S' }], p === 'X' ? 'O' : 'X']);
  assert.equal(JSON.stringify(r.rec.state).includes('"deck"'), false, 'no deck anywhere in the public record');
  assert.equal(JSON.stringify(r.entries).includes('"deck"'), false);
  assert.equal(r.rec.secrets[4].deck[p].length, 12, 'the deck played from, kept apart');
  const full = E.fullState(r.rec);
  assert.deepEqual([full.squares[4].mini.wins[p], full.squares[4].mini.deck[p].length], [1, 12], 'the server joins them again for the next move');
});

test('war: online, a timed-out turn flips nothing (the turn passes, a miss); nothing of a move is left half-made', () => {
  const st = E.newMatch(lcg(5), { games: ['war'], mode: 'online', timer: 60 }), i = 4;
  for (let k = 0; k < 9; k++) if (k !== i) st.squares[k].mini = E.newMini('ttt', lcg(k));
  st.turn = 'X'; st.timer.for = 'X'; st.timer.deadline = 1;
  for (let k = 0; k < 9; k++) if (k !== i) st.squares[k].owner = k % 2 ? 'X' : 'O';
  st.squares[0].owner = null; st.squares[0].mini = E.newMini('war', lcg(7));
  const r = E.applyOnlineTimeout(E.matchRecord(st), lcg(9));
  assert.deepEqual([r.ok, r.entries, r.missed], [true, [], 'X'], 'nothing flipped: no entry');
  const full = E.fullState(r.rec);
  assert.deepEqual([full.squares[0].mini.last, full.squares[0].mini.flips.X, full.lock, full.turn], [null, 0, null, 'O']);
  assert.equal(timeoutClose(E.newMini('war', lcg(1)), 'X'), null, 'no move under way to end');
});

test('war: the computer has one move, Flip; needs counts the rounds left at a flip\'s even chance; Hard is the same and quick', () => {
  const ctx = { level: 'hard', until: null };
  for (const wins of [0, 1, 2]) {
    const m = mini('ai' + wins); m.wins.X = wins;
    const pm = E.publicMini(m), t0 = performance.now(), h = A.best(pm, 'X', lcg(1), {}, ctx);
    assert.ok(performance.now() - t0 < 60);
    assert.deepEqual(h, A.best(pm, 'X', lcg(1), {}, {})); assert.equal(h.move, 'flip');
    assert.equal(A.needs(pm, 'X'), Math.max(1, (3 - wins) / A.WAR_WIN));
  }
  const m = mini('ai-q');
  assert.equal(A.best(E.publicMini(m), 'X', lcg(1), {}, {}).q, 0, 'three rounds off: no one flip takes it');
  m.wins.X = 1; assert.ok(A.best(E.publicMini(m), 'X', lcg(1), {}, {}).q > 0 && A.best(E.publicMini(m), 'X', lcg(1), {}, {}).q < 0.1, 'two off: only a war won takes it');
  m.wins.X = 2; assert.equal(A.best(E.publicMini(m), 'X', lcg(1), {}, {}).q, A.WAR_WIN, 'one off: a flip\'s chance');
  assert.ok(A.needs(E.publicMini(mini('n')), 'O') > A.needs(E.publicMini(m), 'X'));
});

test('war: Super Chaos: a round\'s move is one flip of the player\'s own round (their own deck), the default per-player merge keeps both', () => {
  const m = mini('sc');
  rig(m, 'X', 'KH', '7S'); rig(m, 'O', '2H', '7S');
  assert.deepEqual(R.scApply(m, 'X', 'flip', lcg(1)), { ok: true, outcome: 'continue', note: 'won' });
  assert.deepEqual(R.scApply(m, 'O', 'flip', lcg(1)), { ok: true, outcome: 'continue', note: 'lost' });
  assert.deepEqual([m.wins, m.flips], [{ X: 1, O: 0 }, { X: 1, O: 1 }]);
  const meta = require('../../src/games/war/meta.js');
  assert.deepEqual([meta.superChaos, meta.release, meta.minVersion, meta.category], [true, 'admin', '1.5.0', 'luck']);
  assert.deepEqual(meta.TUNE.map(t => [t.k, t.def]), [['goal', 3], ['warWorth', 2]]);
  assert.match(meta.explainer.win, /\{goal\}/); assert.match(meta.explainer.play, /\{warWorth\}/);
  assert.doesNotMatch(JSON.stringify(meta), /\b(bet|stake|wager|chip|payout)s?\b/i, 'no gambling words');
});
