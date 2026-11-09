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

/* ===================================== Race mode (core/race.js, rv: 2) ===================================== */
// Each player their own questions (side[p]: ask, shown, crossed, last), the i-th of each from the same band (difficulty and
// category); the right places (tg) and the questions still face down (tq) are the secrets; a right answer scores and deals
// that player their next; the first to the goal takes the square. No try caps.
const raceOn = on => E.setTune('trivia', on ? { mode: 'race' } : null);
const raceMatch = (seed, extra) => { raceOn(true); try { return E.newMatch(lcg(seed), Object.assign({ games: ['trivia'], vs: 'cpu' }, extra || {})); } finally { raceOn(false); } };
const triviaAt = st => st.squares.findIndex(q => q.mini.type === 'trivia');
const bandBank = () => ({ questions: ['easy', 'medium'].flatMap(d => ['Science', 'History', 'Sports'].flatMap(c => Array.from({ length: 6 }, (_, i) => ({ id: `${d[0]}${c[0]}${i}`, diff: d, cat: c, q: `${c} ${d} question ${i}?`, a: `Right ${d}${c}${i}`, wrong: ['Wa' + i, 'Wb' + i, 'Wc' + i] })))) });
const qOf = (m, p) => (m.side[p].shown ? m.side[p].ask : m.tq[p]);

test('trivia race: each player their own question, the i-th of each from the same band, never the same one; a move is the mover\'s alone; first to the goal wins', () => {
  E.setTriviaBank(bandBank());
  try {
    const st = raceMatch(301), k = triviaAt(st), m = st.squares[k].mini, rng = lcg(9);
    assert.equal(m.race, true); assert.equal(m.rv, 2);
    for (const p of ['X', 'O']) { assert.deepEqual(m.side[p].ask, { down: true, n: 4 }, 'dealt face down'); assert.equal(m.side[p].shown, false); assert.ok(Number.isInteger(m.tg[p])); }
    assert.equal(E.canMove(m, 'X'), true, 'a square to play');
    const band = q => { const b = bandBank().questions.find(x => x.id === q.id); return b.diff + b.cat; };
    let rounds = 0;
    while (!st.squares[k].owner && rounds < 40) {
      for (const p of ['X', 'O']) {
        if (st.squares[k].owner) break;
        const qx = qOf(m, 'X'), qo = qOf(m, 'O');
        if (m.right.X === m.right.O && qx && qo) { assert.notEqual(qx.id, qo.id, 'two different questions'); assert.equal(band(qx), band(qo), 'of equal difficulty: the same band'); }
        const before = JSON.stringify(m.side[p === 'X' ? 'O' : 'X']), mine = qOf(m, p);
        st.turn = p; st.lock = null; st.flash = null; st.done = null;
        const pick = (rounds + (p === 'X' ? 0 : 1)) % 3 ? m.tg[p] : [0, 1, 2, 3].find(i => i !== m.tg[p] && !m.side[p].crossed.includes(i));
        const r = E.playMove(st, k, pick, rng);
        assert.equal(r.ok, true, JSON.stringify(r));
        assert.equal(JSON.stringify(m.side[p === 'X' ? 'O' : 'X']), before, 'the other part untouched');
        assert.equal(st.flash.trivia.q, mine.q, 'the flash: the mover\'s own question');
        E.endFlash(st);
      }
      rounds++;
    }
    assert.ok(st.squares[k].owner, 'someone reached the goal');
    assert.equal(m.right[st.squares[k].owner], 3);
    // Same phone: always Shared; off: as ever
    const same = (() => { raceOn(true); try { return E.newMatch(lcg(303), { games: ['trivia'], vs: 'same' }); } finally { raceOn(false); } })();
    assert.ok(same.squares.every(q => !q.mini.race && Array.isArray(q.mini.crossed)), 'Same phone: every square Shared');
    assert.equal(E.newMini('trivia', lcg(3)).race, undefined, 'off: as ever');
  } finally { E.setTriviaBank(bank(40)); }
});

test('trivia race: no try cap: a player crosses out every wrong option and still answers; Shared keeps its flow', () => {
  const st = raceMatch(305), k = triviaAt(st), m = st.squares[k].mini;
  for (let i = 0; i < 3; i++) { st.turn = 'X'; st.lock = null; assert.equal(E.playMove(st, k, 'auto', lcg(10 + i)).ok, true); E.endFlash(st); }
  assert.equal(m.side.X.crossed.length, 3, 'three wrong tries');
  st.turn = 'X'; st.lock = null;
  assert.equal(E.playMove(st, k, m.tg.X, lcg(14)).ok, true); assert.equal(st.flash.trivia.correct, true); assert.equal(m.right.X, 1);
  assert.equal(m.side.X.shown, false, 'their next question, face down'); assert.deepEqual(m.side.X.crossed, []);
  assert.equal(m.side.O.crossed.length, 0, 'the other untouched');
});

test('trivia race: online, the right places and the face-down questions stay on the server; each reveals their own; the record and the computer\'s view carry no target', () => {
  raceOn(true);
  try {
    const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only('trivia'), timer: 60 }, lcg(311), 'tqr1');
    const pub = rec.state.squares[0].mini, sec = rec.secrets[0];
    assert.equal(pub.race, true); assert.equal(pub.tg, undefined); assert.equal(pub.tq, undefined); assert.equal(pub.bands, undefined);
    assert.deepEqual(pub.side.X.ask, { down: true, n: 4 }, 'face down: only that there is one');
    assert.ok(sec.tq.X.q && sec.tq.O.q && sec.tq.X.id !== sec.tq.O.id, 'both questions in the secrets, different');
    const text = JSON.stringify(rec.state);
    for (const p of ['X', 'O']) assert.ok(!text.includes(sec.tq[p].q), 'no face-down question in the public state');
    let r = E.applyOnlineReveal(rec, 'X', 0);
    assert.equal(r.ok, true);
    const up = r.rec.state.squares[0].mini;
    assert.equal(up.side.X.shown, true); assert.deepEqual(up.side.X.ask, sec.tq.X, 'X\'s turned up, for both phones'); assert.deepEqual(up.side.O.ask, { down: true, n: 4 }, 'O\'s still down');
    assert.equal(r.rec.secrets[0].tq.X, undefined); assert.ok(r.rec.secrets[0].tq.O);
    assert.equal(E.applyOnlineReveal(r.rec, 'X', 0).reason, 'shown');
    assert.equal(E.applyMove(JSON.parse(JSON.stringify(up)), 'X', 0).reason, 'secret', 'a phone cannot judge a guess by itself');
    const wrong = (sec.tg.X + 1) % 4;
    r = E.applyOnlineMove(r.rec, 'X', 0, wrong, lcg(312));
    assert.equal(r.ok, true); assert.equal(r.entries[0].trivia.correct, false); assert.equal(r.entries[0].trivia.right, undefined);
    assert.deepEqual(r.rec.state.squares[0].mini.side.X.crossed, [wrong], 'on the picker\'s card, for both to see');
    const leak = JSON.stringify(r.entries[0]) + JSON.stringify(r.rec.state);
    assert.ok(!/"tg"|"tq"|"answer":\d/.test(leak), 'no right place anywhere the phones get');
    // the computer's view: open parts alone (and, at most, its own right place)
    const full = E.fullState(r.rec), pm = E.publicMini(full.squares[0].mini, 'O');
    assert.ok(!/"tg"|"tq"|"bands"/.test(JSON.stringify(pm)), 'no secrets in the computer\'s view');
    assert.ok(pm.answer === undefined || pm.answer === full.squares[0].mini.tg.O, 'never the other side\'s right place');
    assert.ok(!JSON.stringify(pm).includes(full.squares[0].mini.tq.O.q), 'never a face-down question');
    // O answers theirs right without a reveal (turned up with the pick): the entry says so
    r = E.applyOnlineMove(r.rec, 'O', 0, sec.tg.O, lcg(313));
    assert.equal(r.ok, true); assert.equal(r.entries[0].trivia.correct, true); assert.equal(r.entries[0].trivia.fresh, true);
    const after = r.rec.state.squares[0].mini;
    assert.equal(after.right.O, 1); assert.deepEqual(after.side.O.ask, { down: true, n: 4 }, 'O\'s next, face down');
    assert.ok(r.rec.secrets[0].tq.O && r.rec.secrets[0].tq.O.id !== sec.tq.O.id);
  } finally { raceOn(false); }
});

test('trivia race: the computer plays its own questions at every level and takes the square; needs counts its own ladder', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const st = raceMatch(321 + level.length), k = triviaAt(st), m = st.squares[k].mini, rng = lcg(5 + level.length);
    let n = 0;
    while (!st.squares[k].owner && n < 60) {
      st.turn = 'O'; st.lock = k; st.flash = null; st.done = null;
      const plan = E.cpuMove(st, rng, null, { level });
      assert.ok(plan && plan.square === k);
      assert.ok(plan.move === 'auto' || !m.side.O.crossed.includes(plan.move), 'never one it crossed out');
      assert.equal(E.playMove(st, k, plan.move, rng).ok, true); E.endFlash(st); n++;
    }
    assert.equal(st.squares[k].owner, 'O', `${level}: the computer reached the goal`);
    assert.ok(n <= 3 * 4, `${level}: ${n} picks at most three questions' worth`);
  }
  const fresh = raceMatch(331), fm = fresh.squares[triviaAt(fresh)].mini;
  const a = E.needsOf(E.publicMini(fm, 'O'), 'X');
  fm.right.X = 2;
  assert.ok(E.needsOf(E.publicMini(fm, 'O'), 'X') < a, 'closer to the goal: needs less');
});

test('trivia race: a claimed square keeps its secrets in the open (the review shows them)', () => {
  raceOn(true);
  try {
    let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only('trivia'), timer: 60 }, lcg(341), 'tqr2');
    for (let i = 0; i < 3; i++) {
      const full = E.fullState(rec), m = full.squares[0].mini;
      let r = E.applyOnlineMove(rec, 'X', 0, m.tg.X, lcg(342 + i)); assert.equal(r.ok, true); rec = r.rec;
      if (i < 2) { const o = E.fullState(rec).squares[0].mini; r = E.applyOnlineMove(rec, 'O', 0, [0, 1, 2, 3].find(k => k !== o.tg.O && !o.side.O.crossed.includes(k)), lcg(350 + i)); assert.equal(r.ok, true); rec = r.rec; }
    }
    const pub = rec.state.squares[0].mini;
    assert.equal(rec.state.squares[0].owner, 'X');
    assert.ok(Number.isInteger(pub.tg.X) && Number.isInteger(pub.tg.O), 'the right places, once the square is won');
  } finally { raceOn(false); }
});
