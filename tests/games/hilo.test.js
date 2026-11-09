'use strict';
// Higher/Lower: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics
// Trivia needs its questions (the page fetches trivia.json; the server has it as a file): a small made-up bank here.
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
// The engine takes all its randomness from the caller. Where a test does not care which random choice
// is made, these wrappers hand it a fixed seeded generator.
const anyRng = () => E.makeRng('any');
const L = Object.assign({}, E, {
  newState: rng => E.newState(rng || anyRng()),
  startMatch: (st, rng) => E.startMatch(st, rng || anyRng()),
  newMatch: (rng, setup) => E.newMatch(rng || anyRng(), setup),
  playMove: (st, i, m, rng, opts) => E.playMove(st, i, m, rng || anyRng(), opts),
  cpuMove: (st, rng) => E.cpuMove(st, rng || anyRng()),
  timeoutMove: (st, rng) => E.timeoutMove(st, rng || anyRng()),
  randomLegalMove: (mini, p, rng) => E.randomLegalMove(mini, p, rng || anyRng()),
  applyMove: (mini, p, m, rng, ...rest) => E.applyMove(mini, p, m, rng || anyRng(), ...rest),
});

// ---- helpers ----
// rng that yields a fixed sequence of values in [0, 1)
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
// rng value that makes randInt(rng, n) return k
const pick = (k, n) => (k + 0.5) / n;

// ============================== Higher / lower ==============================
test('hilo: the number comes from the rng (1 to 30), guesses narrow the range, the number wins', () => {
  for (let k = 0; k < 30; k++) assert.equal(L.newMini('hilo', seq(pick(k, 30))).target, k + 1);
  const m = L.newMini('hilo', seq(pick(12, 30)));   // target 13
  assert.deepEqual([m.target, m.lo, m.hi, m.top, m.limit], [13, 1, 30, 30, 5]);
  assert.equal(L.applyMove(m, 'X', 0).ok, false);
  assert.equal(L.applyMove(m, 'X', 31).ok, false);
  assert.equal(L.applyMove(m, 'X', 2.5).ok, false);
  assert.deepEqual(L.applyMove(m, 'X', 10), { ok: true, outcome: 'continue', note: 'higher' });
  assert.equal(m.lo, 11); assert.equal(m.hi, 30);
  assert.deepEqual(L.applyMove(m, 'X', 15), { ok: true, outcome: 'continue', note: 'lower' });
  assert.equal(m.hi, 14);
  assert.equal(L.applyMove(m, 'O', 10).ok, false, 'outside the remaining range');
  assert.equal(L.applyMove(m, 'O', 13).outcome, 'win');
  assert.deepEqual(m.guesses.map(g => [g.by, g.n, g.res]), [['X', 10, 'higher'], ['X', 15, 'lower'], ['O', 13, 'hit']]);
  assert.deepEqual(E.publicMini(m).limit, 5); assert.equal('target' in E.publicMini(m), false);
});

test('hilo: an older square (1 to 20, no limit) plays on as it was: counting up always ends the game', () => {
  for (let t = 1; t <= 20; t++) {
    const m = { type: 'hilo', target: t, lo: 1, hi: 20, guesses: [] };
    let r, n = 0;
    do { r = L.applyMove(m, 'X', m.lo); n++; } while (r.outcome !== 'win' && n < 25);
    assert.equal(r.outcome, 'win', `target ${t}`);
    assert.equal(n, t, 'counting up from 1 takes exactly t guesses');
    assert.equal(r.winner, undefined, 'the guesser\'s');
  }
});

test('hilo: each player has 5 guesses; a 5th that misses hands the square to the other player (either side)', () => {
  const m = L.newMini('hilo', seq(pick(29, 30)));   // target 30
  for (const n of [1, 2, 3, 4]) assert.equal(L.applyMove(m, 'X', n).outcome, 'continue');
  for (const n of [5, 6, 7, 8]) assert.equal(L.applyMove(m, 'O', n).outcome, 'continue', 'O\'s own five');
  assert.deepEqual([E.hiloLeft(m, 'X'), E.hiloLeft(m, 'O')], [1, 1]);
  assert.deepEqual(L.applyMove(m, 'O', 9), { ok: true, outcome: 'win', winner: 'X', note: 'out' }, 'O\'s 5th misses: X claims');
  const m2 = L.newMini('hilo', seq(pick(29, 30)));
  for (const n of [1, 2, 3, 4]) L.applyMove(m2, 'X', n);
  assert.deepEqual(L.applyMove(m2, 'X', 5), { ok: true, outcome: 'win', winner: 'O', note: 'out' }, 'X\'s 5th misses: O claims');
  assert.equal(L.applyMove(m2, 'X', 6).reason, 'out', 'no 6th guess');
  const m3 = L.newMini('hilo', seq(pick(4, 30)));   // target 5
  for (const n of [1, 2, 3, 4]) L.applyMove(m3, 'X', n);
  assert.deepEqual(L.applyMove(m3, 'X', 5), { ok: true, outcome: 'win' }, 'a 5th that finds it wins');
  // through the match: the square is the other player's, and the flash says so
  const st = L.newMatch(seq(0.5));
  st.squares[0].mini = L.newMini('hilo', seq(pick(29, 30)));
  st.squares[0].mini.guesses = [1, 2, 3, 4].map(n => ({ by: 'X', n, res: 'higher' })); st.squares[0].mini.lo = 5;
  const r = L.playMove(st, 0, 5);
  assert.equal(r.ok, true);
  assert.equal(st.squares[0].owner, 'O');
  assert.equal(r.flash.kind, 'claim'); assert.equal(r.flash.winner, 'O'); assert.equal(r.flash.note, 'out');
});

test('hilo: the computer halves the range, finds any number from 1 to 30 within its 5 guesses alone, and avoids a last-guess gamble', () => {
  for (let t = 1; t <= 30; t++) {
    const m = L.newMini('hilo', seq(pick(t - 1, 30)));
    let r, n = 0;
    do { r = L.applyMove(m, 'X', L.localBest(E.publicMini(m), 'X', seq(0.5)).move); n++; } while (r.outcome !== 'win' && n < 6);
    assert.equal(r.outcome, 'win'); assert.equal(r.winner, undefined, `target ${t}: found by X`);
    assert.ok(n <= 5, `target ${t}: ${n} guesses`);
  }
  const pm = { type: 'hilo', lo: 1, hi: 10, top: 30, limit: 5, guesses: [1, 2, 3, 4].map(n => ({ by: 'X', n: 30 - n, res: 'lower' })) };
  const b = L.localBest(pm, 'X', seq(0.5));
  assert.ok(b.qLose > 0.8, 'its last guess on 10 numbers: a likely loss');
  assert.ok(E.moveGain(pm, 'X', b) < 0, 'not worth it');
  assert.equal(L.localBest(pm, 'O', seq(0.5)).qLose, 0, 'O still has all five');
});

test('hilo: the Hard computer guesses to be the one who lands on the number (every miss narrows it for the other side too), and beats the halver', () => {
  const A = require('../../src/games/hilo/ai.js'), ctx = { level: 'hard', until: null };
  const t0 = performance.now();
  const pm = (lo, hi, used) => ({ type: 'hilo', lo, hi, top: 30, limit: 5, guesses: [].concat(...['X', 'O'].map(p => Array.from({ length: (used || {})[p] || 0 }, () => ({ by: p, n: 0, res: 'lower' })))) });
  const three = A.best(pm(11, 13), 'X', seq(0.5), {}, ctx);
  assert.ok(three.move === 11 || three.move === 13, 'three numbers: an end (2 in 3 to win; the middle, 1 in 3)');
  assert.deepEqual(A.hiloRace(3, 5, 5), { w: 2 / 3, wh: 2 / 3, k: 1 });
  assert.equal(L.localBest(pm(11, 13), 'X', seq(0.5)).move, 12, '(the usual computer halves)');
  assert.ok(Math.abs(A.hiloRace(30, 5, 5).w - 0.5) < 1e-9, 'thirty numbers, five guesses each: a coin toss against the best play');
  assert.ok(A.hiloRace(30, 5, 5).wh > 0.6, 'but against a halver: ' + A.hiloRace(30, 5, 5).wh.toFixed(3));
  const b = A.best(pm(1, 30), 'X', seq(0.5), {}, ctx);
  assert.ok(Number.isInteger(b.move) && b.move >= 1 && b.move <= 30 && b.shared && b.q === 1 / 30, 'a legal guess, the usual shape');
  assert.equal(A.best(pm(1, 10, { X: 4 }), 'X', seq(0.5), {}, ctx).qLose, 0.9, 'its last guess: a likely loss, as ever');
  assert.ok(performance.now() - t0 < 60, 'under 60 ms');
  // Hard against the halver, both ways round, from fresh squares
  const rng = E.makeRng('hilo-hard');
  let hardWins = 0;
  for (let g = 0; g < 200; g++) {
    const side = g % 2 ? 'O' : 'X', m = L.newMini('hilo', rng);
    let p = 'X', r;
    for (let n = 0; n < 12; n++) { r = L.applyMove(m, p, L.localBest(E.publicMini(m), p, rng, E.STYLE0, p === side ? ctx : {}).move, rng); assert.equal(r.ok, true); if (r.outcome === 'win') break; p = p === 'X' ? 'O' : 'X'; }
    if ((r.winner || p) === side) hardWins++;
  }
  assert.ok(hardWins > 110, 'Hard won ' + hardWins + ' of 200');
  for (let k = 0; k < 5; k++) { const t1 = performance.now(); A.best(pm(1, 99 - k, { X: k, O: 1 }), 'X', seq(0.5), {}, ctx); assert.ok(performance.now() - t1 < 60); }
});

// ================================ Race mode v2 (core/race.js, rv 2) ================================
// Each player their own number in the same range (mini.tg, the square's secret), their own guesses and range in
// mini.side[p] (open to both), no guess limit; the first to find their own number takes the square.
const R = require('../../src/games/hilo/rules.js');
const raceOn = on => E.setTune('hilo', on ? { mode: 'race' } : null);
function raceMatch(rng) { return E.newMatch(rng, { games: ['hilo', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], vs: 'cpu' }); }
const hiloAt = st => st.squares.findIndex(q => q.mini.type === 'hilo');

test('hilo, race v2: two different numbers from the same range, each side its own range and guesses, judged against its own number; two on one phone play Shared', () => {
  raceOn(true);
  try {
    for (let k = 0; k < 200; k++) {
      const m = L.newMini('hilo', E.makeRng('hrv2-' + k));
      assert.equal(m.race, true); assert.equal(m.rv, 2); assert.equal(m.target, undefined); assert.equal(m.limit, undefined, 'no limit in a race');
      assert.notEqual(m.tg.X, m.tg.O, 'two different numbers');
      for (const p of ['X', 'O']) { assert.ok(Number.isInteger(m.tg[p]) && m.tg[p] >= 1 && m.tg[p] <= m.top, 'the same range'); assert.deepEqual(m.side[p], { lo: 1, hi: m.top, guesses: [] }); }
    }
    const m = L.newMini('hilo', E.makeRng('hrv2-a')), { X: tx, O: to } = m.tg;
    const miss = (t) => (t === 1 ? 2 : 1);                        // a guess below (or above) the number: never it
    const r = L.applyMove(m, 'X', miss(tx));
    assert.equal(r.ok, true); assert.equal(r.outcome, 'continue'); assert.equal(m.side.X.guesses.length, 1);
    assert.deepEqual(m.side.O, { lo: 1, hi: m.top, guesses: [] }, "O's part is untouched");
    assert.equal(r.note, miss(tx) < tx ? 'higher' : 'lower', "judged against X's own number");
    assert.deepEqual(L.applyMove(m, 'O', to), { ok: true, outcome: 'win' }, "O's own number wins for O");
    assert.equal(L.applyMove(L.newMini('hilo', E.makeRng('hrv2-a')), 'X', to === tx ? 0 : to).outcome === 'win', to === tx, "the other's number is not X's");
    assert.equal(L.newMini('hilo', E.makeRng('hrv2-b'), { shared: true }).race, undefined, 'two people on one phone: Shared');
    assert.ok(E.newMatch(E.makeRng('h-same'), { games: ['hilo'], vs: 'same' }).squares.every(q => !q.mini.race));
  } finally { raceOn(false); }
  assert.equal(L.newMini('hilo', E.makeRng('hrv2-c')).race, undefined, 'off: as ever');
});

test('hilo, race v2: no guess limit (counting up from 1 always finds it, no square handed over); Shared keeps its 5', () => {
  raceOn(true);
  try {
    const m = L.newMini('hilo', E.makeRng('hrv2-cap'));
    m.tg.X = m.top; m.tg.O = 1;
    for (let n = 1; n < m.top; n++) assert.deepEqual(L.applyMove(m, 'X', n), { ok: true, outcome: 'continue', note: 'higher' }, `guess ${n}: no limit`);
    assert.deepEqual(L.applyMove(m, 'X', m.top), { ok: true, outcome: 'win' });
    assert.equal(E.hiloLimit(m), 0); assert.equal(E.hiloLeft(m, 'X'), Infinity);
    assert.equal(E.publicMini(m).limit, 0);
    const f = {}; R.moveFlash(m.top, 'X', [1, 1], 0, m, f); assert.equal(f.left, null, 'no "left" on the flash');
  } finally { raceOn(false); }
  const s = L.newMini('hilo', seq(pick(29, 30)));
  for (const n of [1, 2, 3, 4]) L.applyMove(s, 'X', n);
  assert.deepEqual(L.applyMove(s, 'X', 5), { ok: true, outcome: 'win', winner: 'O', note: 'out' }, 'Shared: the 5th miss still hands it over');
});

test('hilo, race v2: the numbers never reach the public view or the record\'s state while the square is open; both parts do; claimed, they are public', () => {
  raceOn(true);
  try {
    const st = raceMatch(E.makeRng('hrv2-rec')), k = hiloAt(st), m = st.squares[k].mini;
    L.applyMove(m, 'X', 15 === m.tg.X ? 16 : 15); L.applyMove(m, 'O', 3 === m.tg.O ? 4 : 3);
    for (const side of [undefined, 'X', 'O']) {
      const pm = E.publicMini(m, side), js = JSON.stringify(pm);
      assert.equal(pm.tg, undefined); assert.equal(pm.target, undefined); assert.doesNotMatch(js, /"tg"|"target"/, 'no number in the view');
      assert.equal(pm.side.X.guesses.length, 1); assert.equal(pm.side.O.guesses.length, 1, 'both parts open');
      assert.equal(pm.rv, 2);
    }
    st.id = 'h1'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), ps = rec.state.squares[k].mini;
    assert.equal(ps.tg, undefined); assert.doesNotMatch(JSON.stringify(rec.state), /"tg"|"target"/);
    assert.deepEqual(rec.secrets[k], { tg: m.tg }); assert.deepEqual(ps.side, m.side, 'the parts ride the public state');
    const full = E.fullState(E.parseMatch(E.packMatch(rec)));
    assert.deepEqual(full.squares[k].mini.tg, m.tg); assert.deepEqual(full.squares[k].mini.side, m.side); assert.equal(full.squares[k].mini.rv, 2, 'kept, not dealt again');
    // online: a move's entry and its after carry no number
    const r = E.applyOnlineMove(rec, 'X', k, m.side.X.lo === m.tg.X ? m.side.X.lo + 1 : m.side.X.lo, E.makeRng('hrv2-mv'));
    assert.ok(r.ok); assert.doesNotMatch(JSON.stringify(r.entries) + JSON.stringify(r.rec.state), /"tg"|"target"/);
    assert.equal(r.rec.state.squares[k].mini.side.X.guesses.length, 2);
    // claimed: the numbers are public
    const fs = E.fullState(r.rec); fs.squares[k].mini.side.O.lo = fs.squares[k].mini.tg.O; fs.squares[k].mini.side.O.hi = fs.squares[k].mini.tg.O;
    const r2 = E.applyOnlineMove(E.matchRecord(fs), 'O', k, fs.squares[k].mini.tg.O, E.makeRng('hrv2-mv2'));
    assert.ok(r2.ok); assert.equal(r2.rec.state.squares[k].owner, 'O'); assert.deepEqual(r2.rec.state.squares[k].mini.tg, m.tg, 'revealed once the square ends');
  } finally { raceOn(false); }
});

test('hilo, race v2: the computer finds its own number from the public view alone, at every level, with no limit; it halves; needs reads each side\'s own range', () => {
  raceOn(true);
  try {
    for (const level of ['easy', 'normal', 'hard']) {
      for (let g = 0; g < 40; g++) {
        const rng = E.makeRng(`hrv2-ai-${level}-${g}`), m = L.newMini('hilo', rng);
        let r, n = 0;
        do {
          const pm = E.publicMini(m, 'O');
          assert.equal(pm.tg, undefined, 'never the number');
          const b = E.localBest(pm, 'O', rng, E.STYLE0, { level, until: null });
          if (level === 'easy' && rng() < 0.3) b.move = E.randomLegalMove(m, 'O', rng);   // (Easy's careless moves)
          assert.equal(b.shared, false);
          r = L.applyMove(m, 'O', b.move, rng); assert.equal(r.ok, true, `${level}: ${b.move}`); n++;
        } while (r.outcome !== 'win' && n < 40);
        assert.equal(r.outcome, 'win'); assert.equal(r.winner, undefined, `${level}: its own number found`);
        if (level !== 'easy') assert.ok(n <= 5, `${level}: ${n} guesses (halving: 5 at most on 30)`);
      }
    }
    const m = L.newMini('hilo', E.makeRng('hrv2-need')); m.side.O.lo = 10; m.side.O.hi = 12;
    const pm = E.publicMini(m, 'X');
    assert.ok(E.needsOf(pm, 'O') < E.needsOf(pm, 'X'), 'O, three numbers left, is nearer');
    assert.equal(E.localBest(pm, 'O', seq(0.5), E.STYLE0, { level: 'hard', until: null }).move, 11, 'the middle of its own range');
    // through a match against the computer: the square is claimed by whoever finds their own first
    const st = raceMatch(E.makeRng('hrv2-match'));
    for (let t = 0; t < 400 && !st.winner; t++) {
      const c = E.cpuMove(st, E.makeRng('c' + t), E.STYLE0, { level: t % 2 ? 'hard' : 'normal' }); if (!c) break;
      const r = L.playMove(st, c.square, c.move); assert.equal(r.ok, true, r.reason); L.endFlash(st); st.done = null; st.screen = 'board'; st.zoom = null;
      if (st.squares.some(q => q.owner && q.mini.type === 'hilo')) break;
    }
    const won = st.squares.find(q => q.owner && q.mini.type === 'hilo');
    assert.ok(won, 'a race square claimed'); const part = won.mini.side[won.owner];
    assert.equal(part.guesses[part.guesses.length - 1].n, won.mini.tg[won.owner], 'by finding its own number');
  } finally { raceOn(false); }
});
