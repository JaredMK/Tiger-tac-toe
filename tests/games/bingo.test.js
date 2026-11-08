'use strict';
// Bingo: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/bingo/ai.js');
const R = require('../../src/games/bingo/rules.js');
const { timeoutClose } = require('../../src/core/board.js');
E.setPhysics(require('../physics.js'));
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = seed => E.newMini('bingo', E.makeRng(seed || 'bg'));
// A square set by hand: numbers 1 to 26, X's card 1..16, O's card 9..24 (eight shared: 9 to 16; 25 and 26 on neither), the offer given, nothing called.
const fixed = (offer, called) => {
  const m = mini();
  m.n = 4; m.range = 26; m.diag = true; m.cards = { X: Array.from({ length: 16 }, (_, k) => k + 1), O: Array.from({ length: 16 }, (_, k) => k + 9) };
  m.called = (called || []).slice(); m.callBy = m.called.map(() => 'X'); m.offer = offer.slice(); m.calls = { X: 0, O: 0 }; m.last = null; delete m.win;
  return m;
};
const call = (m, p, k, rng) => E.applyMove(m, p, k, rng || lcg(7));

/* ===================================== Bingo ===================================== */
test('bingo: the defaults: 3x3 cards of distinct numbers from 1 to 26, both public, nothing drawn and nothing called', () => {
  const m = mini();
  assert.deepEqual([m.n, m.range, m.diag, m.called, m.callBy, m.calls, m.last], [3, 26, true, [], [], { X: 0, O: 0 }, null]);
  for (const p of ['X', 'O']) {
    assert.equal(m.cards[p].length, 9); assert.equal(new Set(m.cards[p]).size, 9, 'distinct');
    assert.ok(m.cards[p].every(v => Number.isInteger(v) && v >= 1 && v <= 26));
  }
  assert.deepEqual(m.offer, [], 'no numbers before Pick numbers');
  assert.notDeepEqual(m.cards.X, m.cards.O);
  assert.equal(R.bingoLines(4, true).length, 10); assert.equal(R.bingoLines(4, false).length, 8); assert.equal(R.bingoLines(3, true).length, 8);
  assert.deepEqual(R.bingoLines(3, true)[6], [0, 4, 8]); assert.deepEqual(R.bingoLines(3, true)[7], [2, 4, 6]);
  for (const bad of ['spin', 0, -1, 3, null, [0], 1.5, 'auto']) assert.equal(E.applyMove(m, 'X', bad, lcg(1)).ok, false, String(bad));   // (a call before the draw too)
  assert.equal(E.randomLegalMove(m, 'X', lcg(2)), 'draw');
  const d = E.applyMove(m, 'X', 'draw', lcg(2));
  assert.deepEqual(d, { ok: true, outcome: 'continue', note: 'draw', again: true });
  const r = E.randomLegalMove(m, 'X', lcg(2)); assert.ok(Number.isInteger(r) && r >= 0 && r < 3);
  m.offer = [];
  assert.equal(E.secretOf(m), null, 'no secret');
  const pv = E.publicMini(m);
  assert.deepEqual(pv, { type: 'bingo', n: 3, range: 26, diag: true, cards: m.cards, called: [], callBy: [], offer: m.offer, calls: { X: 0, O: 0 }, last: null, win: null });
  assert.ok(pv.cards !== m.cards && pv.offer !== m.offer, 'copies');
});

test('bingo: a call marks the number on both cards wherever it is and takes it out of the pool; the offer is spent and the next turn draws its own (Pick numbers: the move\'s rng); a number on one card or none still counts as a call', () => {
  const m = fixed([3, 12, 20]);
  assert.deepEqual(call(m, 'X', 1), { ok: true, outcome: 'continue', note: 'mark' });   // 12: on both cards
  assert.deepEqual([m.called, m.callBy, m.calls], [[12], ['X'], { X: 1, O: 0 }]);
  assert.deepEqual([m.last.by, m.last.k, m.last.n, m.last.offer, m.last.hit, m.last.won], ['X', 1, 12, [3, 12, 20], { X: 11, O: 3 }, { X: null, O: null }]);
  assert.deepEqual(m.last.was, { X: 0, O: 0 }); assert.deepEqual(m.last.best, { X: 1, O: 1 });
  assert.deepEqual(m.offer, [], 'the offer spent: the next turn draws its own');
  assert.equal(R.bingoPool(m).length, 25);
  assert.equal(E.applyMove(m, 'O', 0, lcg(1)).ok, false, 'no call without a draw');
  assert.ok(E.applyMove(m, 'O', 'draw', lcg(8)).ok);
  assert.equal(m.offer.length, 3); assert.ok(!m.offer.includes(12), 'a called number never comes up again'); assert.ok(m.offer.every(v => v >= 1 && v <= 26)); assert.equal(new Set(m.offer).size, 3);
  assert.ok(R.bingoMarks(m, 'X')[11] && R.bingoMarks(m, 'O')[3]);
  m.offer = [3, 20, 22];
  assert.deepEqual(call(m, 'O', 0), { ok: true, outcome: 'continue', note: 'mark' });   // 3: X's card only
  assert.deepEqual(m.last.hit, { X: 2, O: -1 }); assert.deepEqual(m.last.best, { X: 1, O: 1 }, 'X\'s 3 (row 0) and 12 (row 2) share no line');
  m.offer = [25, 20, 5];
  assert.deepEqual(call(m, 'X', 0), { ok: true, outcome: 'continue', note: 'miss' });   // 25: on no card
  assert.deepEqual(m.last.hit, { X: -1, O: -1 }); assert.equal(m.calls.X, 2);
  // the draw is the move's rng's alone: the same rng the same numbers (the record's replay agrees), another rng others
  const a = fixed([]), b = fixed([]), c = fixed([]);
  call(a, 'X', 'draw', E.makeRng('same')); call(b, 'X', 'draw', E.makeRng('same')); call(c, 'X', 'draw', E.makeRng('other'));
  assert.deepEqual(a.offer, b.offer); assert.notDeepEqual(a.offer, c.offer);
  // the draw follows the pool: only uncalled numbers, and fewer when fewer are left
  const f = fixed([], Array.from({ length: 24 }, (_, k) => k + 1));
  assert.ok(call(f, 'X', 'draw').ok); assert.deepEqual(f.offer.slice().sort((x, y) => x - y), [25, 26]);
  assert.equal(call(f, 'X', 'draw').ok, false, 'one draw at a time: its call first');
});

test('bingo: the first complete line (a row, a column or a diagonal) takes the square, for whichever card completes it; both on the one call is a tie (the square resets); diagonals can be switched off', () => {
  // X's row 0 is 1, 2, 3, 4: three called, the 4 wins it
  let m = fixed([4, 20, 21], [1, 2, 3]);
  assert.deepEqual(call(m, 'X', 0), { ok: true, outcome: 'win', winner: 'X', cells: [0, 1, 2, 3], note: 'line' });
  assert.equal(m.win, 'X'); assert.deepEqual(m.last.won, { X: [0, 1, 2, 3], O: null });
  // O's column 0 is 9, 13, 17, 21: X calls the 21 and hands O the square
  m = fixed([21, 20, 5], [9, 13, 17]);
  assert.deepEqual(call(m, 'X', 0), { ok: true, outcome: 'win', winner: 'O', cells: [0, 4, 8, 12], note: 'gift' });
  // a diagonal: X's 1, 6, 11, 16
  m = fixed([16, 20, 5], [1, 6, 11]);
  assert.equal(call(m, 'O', 0).winner, 'X');
  m = fixed([16, 20, 5], [1, 6, 11]); m.diag = false;
  assert.deepEqual(call(m, 'O', 0), { ok: true, outcome: 'continue', note: 'mark' }, 'diagonals off: no line');
  // a tie: 12 completes X's row 2 (9, 10, 11, 12) and O's row 0 (9, 10, 11, 12) together
  m = fixed([12, 20, 5], [9, 10, 11]);
  assert.deepEqual(call(m, 'X', 0), { ok: true, outcome: 'draw', note: 'tie' });
  assert.deepEqual(m.last.won, { X: [8, 9, 10, 11], O: [0, 1, 2, 3] }); assert.equal(m.win, undefined);
  // through playMove: the claim, the flash's record of the call, and the square's end timed after the line's flourish
  const st = E.newMatch(E.makeRng('bg-st'), { games: ['ttt', 'bingo'] });
  st.squares[0] = { owner: null, mini: fixed([4, 20, 21], [1, 2, 3]) }; st.turn = 'X';
  const r = E.playMove(st, 0, 0, lcg(3));
  assert.ok(r.ok); assert.equal(st.flash.kind, 'claim'); assert.equal(st.flash.note, 'line'); assert.equal(st.flash.m, 0); assert.equal(st.squares[0].owner, 'X');
  assert.deepEqual(st.flash.bingo, { by: 'X', k: 0, n: 4, offer: [4, 20, 21], hit: { X: 3, O: -1 }, won: { X: [0, 1, 2, 3], O: null }, was: { X: 3, O: 0 }, best: { X: 4, O: 0 }, size: 4 });
  assert.deepEqual(st.squares[0].mini.winCells, [0, 1, 2, 3]);
  const T = R.BINGOT, t = R.bingoTimes(st.flash.bingo);
  assert.deepEqual(t, { land: T.land, line: T.land + T.line, end: T.land + T.line + 3 * T.step + T.stamp + T.won });
  assert.equal(E.playMs(st.flash, 4), t.end);
  assert.equal(R.flashMs({ bingo: { size: 4, won: { X: null, O: null } } }, 4, false), T.land + T.rest, 'a plain call: the stamp, then a moment');
  // a tie through playMove resets the square to another game
  const st2 = E.newMatch(E.makeRng('bg-tie'), { games: ['ttt', 'bingo'] });
  st2.squares[0] = { owner: null, mini: fixed([12, 20, 5], [9, 10, 11]) }; st2.turn = 'O';
  const r2 = E.playMove(st2, 0, 0, lcg(4));
  assert.ok(r2.ok); assert.equal(st2.flash.kind, 'draw'); assert.equal(st2.flash.note, 'tie'); assert.equal(st2.squares[0].owner, null); assert.ok(st2.flash.newType);
});

test('bingo: the settings: card size, range, offer and diagonals from the admin\'s card; a range too small for two different cards is widened', () => {
  E.setTune('bingo', { size: 4, range: 12, offer: 4, diag: 0 });
  const m = mini('bg-tune');
  E.setTune('bingo', null);
  assert.deepEqual(m.tune, { size: 4, range: 12, offer: 4, diag: 0 });
  assert.deepEqual([m.n, m.range, m.diag, m.cards.X.length, m.offer.length], [4, 18, false, 16, 0], 'a range too small for two 4x4 cards is widened to 18');
  assert.deepEqual(R.bingoSettings({ size: 5, range: 10 }), { size: 5, range: 27, offer: 3, diag: true });
  assert.deepEqual(R.bingoSettings(null), { size: 3, range: 26, offer: 3, diag: true });
  assert.deepEqual(R.bingoSettings({ size: 9, range: 99, offer: 9, diag: 1 }), { size: 5, range: 60, offer: 4, diag: true });
  assert.equal(E.publicMini(m).tune, m.tune, 'its settings ride the public view');
  // the draw follows the square's own settings
  assert.ok(call(m, 'X', 'draw', lcg(5)).ok); assert.equal(m.offer.length, 4);
  assert.ok(call(m, 'X', 3, lcg(5)).ok); assert.equal(m.offer.length, 0);
});

test('bingo: over thousands of random calls no number is ever called twice, every offer comes from the pool, and every square ends with a line (or a tie) before the pool runs dry', () => {
  const rng = E.makeRng('bg-random');
  let wins = 0, ties = 0, gifts = 0;
  for (let g = 0; g < 400; g++) {
    const m = mini('g' + g);
    let p = 'X', done = false;
    for (let k = 0; k < 120 && !done; k++) {
      const pool = R.bingoPool(m);
      assert.ok(m.offer.every(v => pool.includes(v)), 'the offer from the pool');
      const mv = E.randomLegalMove(m, p, rng), was = m.called.length;
      assert.equal(mv === 'draw', !m.offer.length, 'a draw exactly when nothing is drawn');
      const r = E.applyMove(m, p, mv, rng);
      assert.ok(r.ok);
      if (mv === 'draw') { assert.deepEqual([r.again, r.note, m.called.length], [true, 'draw', was]); assert.ok(m.offer.length === 3 && m.offer.every(v => pool.includes(v))); continue; }   // (the turn goes on: its call next)
      assert.ok(!r.again, 'one call a turn');
      assert.equal(new Set(m.called).size, m.called.length, 'never twice');
      if (r.outcome === 'win') { done = true; wins++; if (r.winner !== p) gifts++; assert.ok(R.bingoWon(m, r.winner)); assert.equal(m.win, r.winner); }
      else if (r.outcome === 'draw') { done = true; ties++; assert.equal(r.note, 'tie'); }
      else p = p === 'X' ? 'O' : 'X';
    }
    assert.ok(done, 'no end');
  }
  assert.equal(wins + ties, 400); assert.ok(ties > 0 && ties < 120, `ties ${ties}`); assert.ok(gifts > 0, 'a random caller sometimes hands the square over');
});

test('bingo: a timeout plays nothing (no call for a player out of time); after a draw the turn passes (not a miss) and the drawn offer waits for the next player here, who calls from it with no draw; online and across a reload too', () => {
  // nothing drawn: a missed turn, nothing drawn for them
  let m = fixed([]);
  assert.equal(timeoutClose(m, 'X'), null);
  let st = E.newMatch(E.makeRng('bg-to'), { games: ['ttt', 'bingo'] });
  st.squares[0] = { owner: null, mini: m }; st.turn = 'X'; st.timer = E.newTimer(30); st.lock = 0; st.lockBy = 'open';
  let r = E.timeoutMove(st, lcg(1));
  assert.deepEqual([r.ok, r.missed, st.turn, m.called, m.offer], [true, 'X', 'O', [], []], 'nothing drawn');
  // drawn, then out of time: the turn ends (not a miss), nothing called, the offer stays drawn
  m = fixed([]);
  st = E.newMatch(E.makeRng('bg-to2'), { games: ['ttt', 'bingo'] });
  st.squares[0] = { owner: null, mini: m }; st.turn = 'X'; st.timer = E.newTimer(30);
  const d = E.playMove(st, 0, 'draw', E.makeRng('bg-d'));
  assert.ok(d.ok); assert.deepEqual([st.flash.kind, st.flash.note, st.lock, st.flash.m], ['again', 'draw', 0, 'draw']);
  assert.deepEqual(st.flash.bingo, { draw: true, by: 'X', offer: m.offer.slice(), size: 4 }, 'the flash carries the numbers drawn, in order');
  assert.equal(R.flashMs(st.flash), R.bingoDrawTimes(st.flash.bingo).end);
  const drawn = m.offer.slice();
  E.endFlash(st);
  assert.deepEqual([st.screen, st.zoom, st.lock], ['mini', 0, 0], 'held to the square for the call');
  assert.equal(E.leaveSquare(st), false, 'no leaving before the call');
  r = E.timeoutMove(st, lcg(1));
  assert.deepEqual([r.ok, r.ended, r.missed, st.turn, st.lock, st.timer.streak.X, st.timer.timeouts.X], [true, true, undefined, 'O', null, 0, 0], 'the turn over, not missed');
  assert.deepEqual([m.called, m.offer], [[], drawn], 'nothing called; the offer still drawn');
  assert.equal(E.randomLegalMove(m, 'O', lcg(3)) === 'draw', false, 'the next player calls from it');
  assert.equal(E.playMove(st, 0, 'draw', lcg(3)).ok, false, 'no second draw over it');
  const c = E.playMove(st, 0, 1, lcg(3));
  assert.ok(c.ok); assert.deepEqual([st.flash.kind, st.flash.bingo.n, st.flash.bingo.offer, m.calls], ['move', drawn[1], drawn, { X: 0, O: 1 }]);
  assert.equal(st.squares[0].mv.O, 1, 'their turn\'s move (no bonus)');
  // online: the draw is the server's move (its rng), an entry like a bonus move; the call follows; a reload keeps the drawn offer
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === 'bingo']));
  let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, lcg(3), 'bg');
  const p = rec.state.turn;
  assert.ok(rec.state.squares.every(s => !s.mini.offer || !s.mini.offer.length), 'no numbers anywhere in the record before a draw');
  assert.deepEqual(rec.secrets || {}, {}, 'and none kept apart: nothing exists until the draw');
  const t = E.applyOnlineTimeout(rec, lcg(2));
  assert.deepEqual([t.ok, t.entries, t.missed], [true, [], p]);
  rec = t.rec;
  const q = rec.state.turn;
  assert.equal(E.applyOnlineMove(rec, q, 0, 1, lcg(4)).ok, false, 'no call before the draw');
  const dr = E.applyOnlineMove(rec, q, 0, 'draw', E.makeRng('server'));
  assert.ok(dr.ok, JSON.stringify(dr));
  assert.deepEqual([dr.entries[0].kind, dr.entries[0].bingo.draw, dr.entries[0].bingo.offer.length, dr.rec.state.lock, dr.rec.state.turn], ['again', true, 3, 0, q]);
  const back = E.parseMatch(E.packMatch(dr.rec));                         // (a reload: the record as the database holds it)
  assert.deepEqual(back.state.squares[0].mini.offer, dr.entries[0].bingo.offer, 'the drawn offer survives the reload');
  const to = E.applyOnlineTimeout(back, lcg(6));
  assert.ok(to.ok); assert.equal(to.missed, null); assert.equal(to.rec.state.turn, q === 'X' ? 'O' : 'X');
  assert.deepEqual(to.rec.state.squares[0].mini.offer, dr.entries[0].bingo.offer, 'out of time after the draw: the offer waits');
  const mv = E.applyOnlineMove(to.rec, to.rec.state.turn, 0, 2, lcg(4));
  assert.ok(mv.ok, JSON.stringify(mv)); assert.equal(mv.entries[0].bingo.n, dr.entries[0].bingo.offer[2], 'the next player calls from it');
  assert.equal(mv.rec.state.squares[0].mini.called.length, 1, 'a call through the record');
  assert.deepEqual(mv.rec.state.squares[0].mini.offer || [], [], 'spent');
  assert.equal(E.applyOnlineMove(mv.rec, mv.rec.state.turn, 0, 'auto', lcg(5)).ok, false, 'no automatic move from a phone');
  const dr2 = E.applyOnlineMove(mv.rec, mv.rec.state.turn, 0, 'draw', lcg(5));
  assert.ok(dr2.ok); assert.equal(E.applyOnlineMove(dr2.rec, dr2.rec.state.turn, 0, 7, lcg(5)).ok, false, 'a pick outside the offer refused');
});

test('bingo: the computer: a line now is the move at every level; a number that completes only the other card is never called while another is open; Normal advances its own best line over the other\'s; needs falls as a line fills', () => {
  const rng = lcg(9), pm = m => E.publicMini(m);
  for (const level of ['easy', 'normal', 'hard']) {
    assert.deepEqual(A.best(pm(fixed([20, 4, 21], [1, 2, 3])), 'X', rng, {}, { level, until: null }), { move: 1, q: 1 }, level + ': the 4 completes the row');
    const b = A.best(pm(fixed([21, 20, 5], [9, 13, 17])), 'X', rng, {}, { level, until: null });
    assert.notEqual(b.move, 0, level + ': never the 21 (O\'s column)'); assert.equal(b.q, 0);
  }
  // 1, 2, 3 called: X's row 0 wants the 4; of 4 (X only), 18 (O only) and 22 (nobody), Normal calls the 4
  assert.equal(A.best(pm(fixed([18, 22, 4], [1, 2, 3])), 'X', rng, {}, { level: 'normal', until: null }).move, 2);
  // O, with X's row at three: of 5 (X's card alone) and 25 (nobody), O calls the 25 rather than feed X's card
  assert.equal(A.best(pm(fixed([5, 25], [1, 2, 3])), 'O', rng, {}, { level: 'normal', until: null }).move, 1);
  // needs: the fewest unmarked numbers in any line
  assert.equal(A.needs(pm(fixed([1, 2, 3])), 'X'), 4);
  assert.equal(A.needs(pm(fixed([5, 6, 7], [1, 2])), 'X'), 2);
  assert.equal(A.needs(pm(fixed([5, 6, 7], [1, 2, 3])), 'X'), 1);
  assert.equal(A.needs(pm(fixed([5, 6, 7], [1, 2, 3, 4])), 'X'), 0);
  assert.equal(A.needs(pm(fixed([5, 6, 7], [1, 2, 3])), 'O'), 4, 'nothing of O\'s called');
  assert.equal(E.needsOf(pm(fixed([5, 6, 7], [1, 2])), 'X'), 2);
  const drawn = seed => { const m = mini(seed); assert.ok(E.applyMove(m, 'X', 'draw', lcg(4)).ok); return m; };   // (a square with its numbers drawn)
  assert.equal(E.localBest(pm(mini()), 'O', rng).move, 'draw');
  assert.ok(Number.isInteger(E.localBest(pm(drawn()), 'O', rng).move));
  // Hard keeps to its clock: a budget already spent gives a move at once
  const t0 = Date.now(), h = A.best(pm(drawn('bg-h')), 'X', rng, {}, { level: 'hard', until: () => 0 });
  assert.ok(Number.isInteger(h.move) && Date.now() - t0 < 400);
  assert.ok(Number.isInteger(A.best(pm(drawn('bg-h2')), 'X', rng, {}, { level: 'hard', until: () => 50 }).move));
  for (const level of ['easy', 'normal', 'hard']) assert.deepEqual(A.best(pm(fixed([])), 'X', rng, {}, { level, until: null }), { move: 'draw', q: 0 }, level + ': nothing drawn: Pick numbers first');
  assert.deepEqual(A.best(pm(fixed([], Array.from({ length: 26 }, (_, k) => k + 1))), 'X', rng, {}, { level: 'normal' }), { move: null, q: 0 }, 'nothing left to draw: no move');
});

test('bingo: whole squares, computer against computer: every one ends, the winner takes about 4 to 6 calls, the first mover wins under 60% of the decided squares', () => {
  let first = 0, dec = 0, wCalls = 0, ties = 0;
  const N = 500;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('bg-sq' + g), m = mini('sq' + g);
    let p = 'X', done = false;
    for (let k = 0; k < 120 && !done; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level: g % 50 === 0 ? 'hard' : 'normal', until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok);
      if (b.move === 'draw') { assert.ok(r.again); continue; }               // (the draw, then the same player's call)
      if (r.outcome === 'win') { done = true; dec++; if (r.winner === 'X') first++; wCalls += m.calls[r.winner]; }
      else if (r.outcome === 'draw') { done = true; ties++; }
      else p = p === 'X' ? 'O' : 'X';
    }
    assert.ok(done, 'no end');
  }
  assert.ok(first / dec < 0.6, `the first mover: ${(100 * first / dec).toFixed(1)}%`);
  assert.ok(wCalls / dec >= 4 && wCalls / dec <= 6, `the winner's calls: ${(wCalls / dec).toFixed(2)}`);
  assert.ok(ties / N < 0.2, `ties ${(100 * ties / N).toFixed(1)}%`);
});

test('bingo: not dealt in Super Chaos', () => {
  assert.ok(!E.scTypes().includes('bingo'));
});
