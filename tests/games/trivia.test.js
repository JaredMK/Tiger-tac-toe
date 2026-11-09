'use strict';
// Trivia: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));

test('trivia: online, a new question stays face down on the server until revealed; the right answer stays there until someone picks it; a wrong pick tells nobody which is right', () => {
  const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only('trivia'), timer: 60 }, lcg(51), 'tq1');
  const pub = rec.state.squares[0].mini, sec = rec.secrets[0];
  assert.equal(pub.answer, undefined, 'nothing in the public state says which answer is right');
  assert.deepEqual([pub.shown, pub.ask], [false, { down: true, n: 4 }], 'face down: the phones know only that there is a question');
  assert.ok(sec.ask.q && sec.ask.opts.length === 4 && Number.isInteger(sec.answer), 'the question, its options and the answer are in the secrets');
  assert.equal(E.canMove(pub, 'X'), true, 'a face-down question is still a square to play');
  // the reveal: not a move; the turn and its clock go on; the player is held to the square
  assert.equal(E.applyOnlineReveal(rec, 'O', 0).reason, 'turn', 'only the player to move turns it up');
  let r = E.applyOnlineReveal(rec, 'X', 0);
  assert.equal(r.ok, true); assert.equal(r.entries, undefined, 'no move made');
  const up = r.rec.state.squares[0].mini;
  assert.equal(up.shown, true); assert.deepEqual(up.ask, sec.ask, 'turned up: the question for both phones'); assert.equal(up.answer, undefined, 'the answer still hidden');
  assert.equal(r.rec.state.lock, 0); assert.equal(r.rec.state.turn, 'X'); assert.equal(r.rec.state.seq, rec.state.seq, 'the same turn');
  assert.equal(E.applyOnlineReveal(r.rec, 'X', 0).reason, 'shown', 'once up, it is up');
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(up)), 'X', 0).reason, 'secret', 'a phone cannot judge a guess by itself');
  const right = sec.answer, wrong = (right + 1) % 4;
  r = E.applyOnlineMove(r.rec, 'X', 0, wrong, lcg(52));
  assert.equal(r.ok, true); assert.equal(r.entries[0].trivia.correct, false); assert.equal(r.entries[0].trivia.fresh, true, 'turned up in this turn: the other phone shows the reveal first');
  const leak = JSON.stringify(r.entries[0]) + JSON.stringify(r.rec.state);
  assert.equal(r.entries[0].trivia.right, undefined, 'the result of a wrong pick: no right answer in it');
  assert.ok(!/"right":\d/.test(leak) && !/"answer":\d/.test(leak), 'nor anywhere in what the phones get');
  const m1 = r.rec.state.squares[0].mini;
  assert.deepEqual(m1.crossed, [wrong], 'crossed out, for both phones'); assert.equal(m1.ask.id, sec.ask.id); assert.equal(m1.shown, true, 'still up for the next player');
  assert.equal(r.rec.state.lock, null, 'the turn over: nobody held');
  r = E.applyOnlineMove(r.rec, 'O', 0, right, lcg(53));
  assert.equal(r.ok, true); assert.equal(r.entries[0].trivia.correct, true, 'the server judges and tells both phones');
  assert.equal(r.entries[0].trivia.fresh, undefined, 'O found it already up: no reveal to show');
  assert.equal(r.entries[0].trivia.right, right, 'the right answer shows with the right pick');
  const after = r.rec.state.squares[0].mini;
  assert.equal(after.answer, undefined, 'the next question\'s answer is hidden again');
  assert.deepEqual([after.shown, after.ask], [false, { down: true, n: 4 }], 'the next question starts face down');
  assert.notEqual(r.rec.secrets[0].ask.id, sec.ask.id); assert.ok(Number.isInteger(r.rec.secrets[0].answer));
});

test('trivia: the reveal holds the player to the square: no other square this turn; out of time, an option is crossed out; a pick on a face-down question turns it up', () => {
  const st = E.newMatch(lcg(54), { games: ['trivia'] });
  const i = st.squares.findIndex(q => q.mini.type === 'trivia'), j = st.squares.findIndex((q, k) => k !== i && q.mini.type === 'trivia');
  assert.equal(st.squares[i].mini.shown, false, 'dealt face down');
  assert.equal(E.triviaReveal(st, i, 'X').ok, true);
  assert.equal(st.lock, i);
  assert.equal(E.playMove(st, j, 0, lcg(55)).reason, 'locked', 'another square: refused');
  assert.equal(E.triviaReveal(st, j, 'X').reason, 'locked');
  st.timer = E.newTimer(60);
  const t = E.timeoutMove(st, lcg(56));
  assert.equal(t.ok, true); assert.equal(t.square, i, 'out of time: the move is made in the square revealed');
  assert.equal(st.squares[i].mini.crossed.length, 1, 'one option crossed out'); assert.equal(st.squares[i].mini.shown, true);
  assert.deepEqual(st.squares[i].mv, { X: 1, O: 0 }, 'the pick after a reveal counts as the turn\'s move (stats)');
  assert.equal(st.flash.trivia.fresh, true);
  E.endFlash(st);
  assert.equal(st.lock, null); assert.equal(st.turn, 'O');
  // the computer (or a timeout) on a question still face down: turned up with the pick
  const k = st.squares.findIndex((q, n) => n !== i && q.mini.type === 'trivia' && !q.mini.shown);
  const r = E.playMove(st, k, st.squares[k].mini.answer, lcg(57));
  assert.equal(r.ok, true); assert.equal(st.flash.trivia.fresh, true); assert.equal(st.flash.trivia.correct, true);
  assert.equal(E.playMs(st.flash), E.TRIVIA.flip + E.TRIVIA.pause + E.TRIVIA.reveal, 'the playback: the reveal, the pause, the pick');
  assert.equal(st.squares[k].mini.shown, false, 'answered right: a new question, face down');
});

test('trivia: the admin\'s settings (right answers to win, options, the computer\'s knowledge) are dealt into the square and played by', () => {
  E.setTune('trivia', { goal: 2, opts: 2, know: 100 });
  const m = E.newMini('trivia', E.makeRng('tr-tune'));
  E.setTune('trivia', null);
  assert.deepEqual(m.tune, { goal: 2, opts: 2, know: 100 });
  const st = { squares: [{ mini: m }] }, rng = E.makeRng('tr-deal');
  E.triviaDeal(st, st.squares[0], rng);
  assert.equal(m.ask.opts.length, 2);
  const mv = E.localBest(E.publicMini(m), 'X', E.makeRng('tr-ai')).move;
  assert.equal(mv, m.answer, 'it knows it');
  assert.equal(E.applyMove(m, 'X', mv, rng).outcome, 'continue');
  E.triviaDeal(st, st.squares[0], rng);
  assert.equal(E.applyMove(m, 'X', m.answer, rng).outcome, 'win', 'two right wins');
});

/* ===================================== Race mode (core/race.js) ===================================== */
// The square's one question is the shared target; each player's picks are their own card (mini.side[p]: crossed, last);
// the other side sees only wrong tries made and right or not; the first right answer takes the square.
const raceOn = on => E.setTune('trivia', on ? { mode: 'race' } : null);
const raceMatch = seed => { raceOn(true); try { return E.newMatch(lcg(seed), { games: ['trivia'], vs: 'cpu' }); } finally { raceOn(false); } };
const triviaAt = st => st.squares.findIndex(q => q.mini.type === 'trivia');

test('trivia race: dealt by the setting; one question for both, each side its own card; a wrong pick crosses out on the picker\'s card alone; the first right answer wins', () => {
  const st = raceMatch(301), k = triviaAt(st), m = st.squares[k].mini;
  assert.equal(m.race, true); assert.deepEqual(m.side, { X: { crossed: [], last: null }, O: { crossed: [], last: null } });
  assert.equal(m.crossed, undefined, 'no shared cross-outs'); assert.equal(m.last, undefined);
  assert.ok(m.ask && m.ask.q && Number.isInteger(m.answer), 'the question dealt in (core/board.js triviaDeal)');
  assert.deepEqual(m.tune, { mode: 'race' });
  const right = m.answer, wrong = [0, 1, 2, 3].filter(x => x !== right), id = m.ask.id;
  assert.deepEqual(E.applyMove(m, 'X', wrong[0], lcg(1)), { ok: true, outcome: 'continue', note: 'wrong' });
  assert.deepEqual(m.side.X.crossed, [wrong[0]]); assert.deepEqual(m.side.O.crossed, [], "O's card is untouched");
  assert.equal(m.side.X.last.picked, wrong[0]); assert.equal('right' in m.side.X.last, false); assert.equal(m.side.O.last, null);
  assert.equal(E.applyMove(m, 'O', wrong[0], lcg(1)).ok, true, 'the same option is open to O (their own card)');
  assert.deepEqual(m.side.O.crossed, [wrong[0]]); assert.deepEqual(m.side.X.crossed, [wrong[0]]);
  assert.equal(E.applyMove(m, 'X', wrong[0], lcg(1)).reason, 'crossed', 'but not to X again');
  assert.equal(m.ask.id, id, 'the question stays'); assert.equal(m.shown, true);
  assert.deepEqual(E.applyMove(m, 'O', right, lcg(1)), { ok: true, outcome: 'win', note: 'right' }, 'the first right answer takes the square');
  assert.equal(m.right.O, 1); assert.equal(m.ask.id, id, 'the question stays for the review'); assert.equal(m.side.O.last.right, right);
  assert.deepEqual(E.raceShape(m, 'X'), { n: 1, right: false }); assert.deepEqual(E.raceShape(m, 'O'), { n: 1, right: true });
  // out of time: one option crossed out on the player's own card
  const st2 = raceMatch(302), k2 = triviaAt(st2), m2 = st2.squares[k2].mini;
  assert.equal(E.applyMove(m2, 'X', 'auto', lcg(2)).note, 'wrong'); assert.equal(m2.side.X.crossed.length, 1); assert.equal(m2.side.X.last.auto, true); assert.deepEqual(m2.side.O.crossed, []);
  // Shared and Same phone as ever
  const same = (() => { raceOn(true); try { return E.newMatch(lcg(303), { games: ['trivia'], vs: 'same' }); } finally { raceOn(false); } })();
  assert.ok(same.squares.every(q => !q.mini.race && Array.isArray(q.mini.crossed)), 'Same phone: every square Shared');
  assert.equal(E.newMini('trivia', lcg(3)).race, undefined, 'off: as ever');
});

test('trivia race: the reveal flow holds as in Shared; the public view shows the shapes and one side\'s own card alone; the record keeps each side\'s card for that side and a move\'s entry is redacted', () => {
  raceOn(true);
  try {
    const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only('trivia'), timer: 60 }, lcg(311), 'trq1');
    const pub = rec.state.squares[0].mini;
    assert.equal(pub.race, true); assert.equal(pub.side, undefined, 'no card in the public state'); assert.deepEqual(pub.shape, { X: { n: 0, right: false }, O: { n: 0, right: false } });
    assert.deepEqual([pub.shown, pub.ask], [false, { down: true, n: 4 }], 'face down, as in Shared'); assert.equal(pub.answer, undefined);
    assert.deepEqual(rec.sides.X[0], { crossed: [], last: null }); assert.deepEqual(rec.sides.O[0], { crossed: [], last: null });
    let r = E.applyOnlineReveal(rec, 'X', 0);
    assert.equal(r.ok, true); assert.equal(r.rec.state.squares[0].mini.shown, true); assert.equal(r.rec.state.lock, 0, 'held to the square');
    const right = rec.secrets[0].answer, wrong = (right + 1) % 4;
    r = E.applyOnlineMove(r.rec, 'X', 0, wrong, lcg(312), { rep: [[0, 'move', 'm=' + wrong]] });
    assert.equal(r.ok, true);
    const e = r.entries[0];
    assert.equal(e.m, undefined, 'the pick is not on the entry'); assert.equal(e.trivia, undefined, 'nor the question with it'); assert.equal(e.rep, undefined); assert.equal(e.note, undefined);
    assert.deepEqual(e.race, { by: 'X', correct: false, n: 1, right: false, fresh: true }, 'its shape change alone (the reveal to show)');
    assert.equal(e.after.mini.side, undefined); assert.deepEqual(e.after.mini.shape.X, { n: 1, right: false });
    assert.ok(!JSON.stringify(r.rec.state).includes('"picked"'), 'no pick anywhere in the public state');
    assert.deepEqual(r.rec.sides.X[0].crossed, [wrong], "the mover's own card holds it"); assert.deepEqual(r.rec.sides.O[0].crossed, []);
    assert.equal(r.rec.state.lock, null); assert.equal(r.rec.state.turn, 'O');
    const forX = E.publicMini(E.fullState(r.rec).squares[0].mini, 'X'), forO = E.publicMini(E.fullState(r.rec).squares[0].mini, 'O');
    assert.deepEqual(Object.keys(forX.side), ['X']); assert.deepEqual(forX.side.X.crossed, [wrong]); assert.equal(forX.shape.O.n, 0);
    assert.deepEqual(Object.keys(forO.side), ['O']); assert.equal(forO.side.X, undefined, "O never sees X's card"); assert.equal(forO.shape.X.n, 1);
    // the record round trip
    const full = E.fullState(r.rec);
    assert.deepEqual(full.squares[0].mini.side.X.crossed, [wrong]); assert.equal(full.squares[0].mini.answer, right); assert.equal(full.squares[0].mini.shape, undefined);
    const back = E.parseMatch(E.packMatch(r.rec));
    assert.deepEqual(E.fullState(back).squares[0].mini.side, full.squares[0].mini.side);
    // O's own card is clean: the same option is open; O's right answer wins and the entry says only that
    r = E.applyOnlineMove(r.rec, 'O', 0, wrong, lcg(313));
    assert.equal(r.ok, true); assert.deepEqual(r.rec.sides.O[0].crossed, [wrong]);
    r = E.applyOnlineMove(r.rec, 'X', 0, right, lcg(314));
    assert.equal(r.ok, true); assert.equal(r.entries[0].kind, 'claim'); assert.equal(r.entries[0].winner, 'X');
    assert.deepEqual(r.entries[0].race, { by: 'X', correct: true, n: 1, right: true });
    assert.equal(r.rec.state.squares[0].owner, 'X'); assert.equal(r.rec.sides.X[0], undefined, 'a claimed square: no card kept apart');
    assert.ok(r.rec.state.squares[0].mini.side.O, 'the finished square shows both cards');
  } finally { raceOn(false); }
});

test('trivia race: the computer plays from its own card alone and finishes the square; the Shared flow (a new question after a right answer) is untouched', () => {
  const st = raceMatch(321), k = triviaAt(st), m = st.squares[k].mini, rng = lcg(5);
  let won = false;
  for (let i = 0; i < 4 && !won; i++) {
    const pm = E.publicMini(m, 'O');
    assert.equal(pm.side.X, undefined); assert.equal(pm.crossed, undefined);
    const mv = E.localBest(pm, 'O', rng).move;
    assert.ok(!m.side.O.crossed.includes(mv), 'never one it crossed out');
    won = E.applyMove(m, 'O', mv, rng).outcome === 'win';
  }
  assert.ok(won, 'four picks at most');
  assert.ok(E.needsOf(E.publicMini(m, 'X'), 'X') >= 1);
  const fresh = raceMatch(322), fm = fresh.squares[triviaAt(fresh)].mini;
  E.applyMove(fm, 'X', 'auto', lcg(6)); E.applyMove(fm, 'X', 'auto', lcg(7));
  const pmX = E.publicMini(fm, 'O');
  assert.ok(E.needsOf(pmX, 'X') < E.needsOf(pmX, 'O'), "two wrong tries down, X's shape says they need less");
  // Shared: untouched
  const sh = E.newMatch(lcg(323), { games: ['trivia'] }), i = triviaAt(sh), sm = sh.squares[i].mini, id = sm.ask.id;
  const r = E.playMove(sh, i, sm.answer, lcg(8));
  assert.equal(r.ok, true); assert.equal(sm.right.X, 1); assert.ok(sm.ask && sm.ask.id !== id, 'a new question'); assert.equal(sm.shown, false); assert.deepEqual(sm.crossed, []);
  assert.equal(sh.flash.trivia.correct, true); assert.equal(sh.flash.race, undefined);
});
