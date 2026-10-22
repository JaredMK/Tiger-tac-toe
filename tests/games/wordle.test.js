'use strict';
// Wordle: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const wordRng = (list, word) => seq(pick(list.indexOf(word), list.length));

function matchWith(types, rng = lcg(7)) {
  const st = L.newMatch(rng);
  types.forEach((t, i) => { st.squares[i].mini = L.newMini(t, rng); });
  return st;
}
// make one full turn as the UI does: the move, then the result overlay clearing, which (unless the
// same player goes again or the match is over) brings the board back and passes the turn
function turn(st, i, m, rng) {
  const r = L.playMove(st, i, m, rng || lcg(99));
  assert.equal(r.ok, true, `move ${JSON.stringify(m)} in square ${i} should be accepted (${r.reason})`);
  const flash = st.flash;
  L.endFlash(st);
  return flash;
}

// ================================ Computer player ================================
const cpuRng = () => lcg(314);
// a match where the computer plays `me`, with the given squares (type names or ready-made minis)
function cpuMatch(me, squares, owners = []) {
  const st = matchWith(squares.map(s => (typeof s === 'string' ? s : s.type)));
  for (let i = squares.length; i < 9; i++) st.squares[i].mini = L.newMini('ttt', lcg(900 + i));   // the rest: fresh, plain squares (what the pool happens to deal must not decide a tactics test)
  squares.forEach((s, i) => { if (typeof s !== 'string') st.squares[i].mini = s; });
  owners.forEach((o, i) => { if (o) st.squares[i].owner = o; });
  st.cpu = me; st.turn = me;
  return st;
}

// ================================== Wordle ==================================
test('wordle: the hidden word comes from a list of common words, all of them valid guesses', () => {
  assert.ok(L.WORDS5.length >= 200, `only ${L.WORDS5.length} words`);
  assert.equal(new Set(L.WORDS5).size, L.WORDS5.length, 'duplicates in the list');
  for (const w of L.WORDS5) {
    assert.match(w, /^[a-z]{5}$/, w);
    assert.ok(L.VALID5.has(w.toUpperCase()), `${w} is not in the valid-guess list`);
  }
  const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  assert.equal(m.word, 'CRANE');
  assert.deepEqual(m.guesses, []);
  for (let k = 0; k < 100; k++) assert.ok(L.WORDS5.includes(L.newMini('wordle', Math.random).word.toLowerCase()));
});

test('wordle: the valid-guess list holds several thousand real 5-letter words', () => {
  assert.ok(L.VALID5.size >= 5000, `only ${L.VALID5.size} valid words`);
  for (const w of L.VALID5) assert.match(w, /^[A-Z]{5}$/, w);
  for (const w of ['CRANE', 'ABOUT', 'HOUSE', 'MOUSE', 'LOUSE', 'QUEUE', 'ZEBRA', 'PIZZA', 'FJORD']) assert.ok(L.VALID5.has(w), w);
  for (const w of ['ZZZZZ', 'AEIOU', 'QQQQQ', 'XKCDS', 'ABCDE']) assert.ok(!L.VALID5.has(w), `${w} should not be a word`);
});

test('wordle: feedback marks follow the standard rules, duplicates included', () => {
  assert.deepEqual(L.wordleMarks('CRANE', 'CRANE'), ['g', 'g', 'g', 'g', 'g']);
  assert.deepEqual(L.wordleMarks('NACRE', 'CRANE'), ['y', 'y', 'y', 'y', 'g']);
  assert.deepEqual(L.wordleMarks('LLAMA', 'ALLEY'), ['y', 'g', 'y', 'x', 'x']);
  assert.deepEqual(L.wordleMarks('EERIE', 'BREAD'), ['y', 'x', 'y', 'x', 'x']);
  assert.deepEqual(L.wordleMarks('ZZZZZ', 'CRANE'), ['x', 'x', 'x', 'x', 'x']);
});

test('wordle: real words are accepted in any case, non-words and malformed guesses are rejected', () => {
  const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  for (const bad of ['CRAN', 'CRANES', 'CR4NE', 'CRAN ', 12345, null, ['C', 'R', 'A', 'N', 'E']]) {
    assert.deepEqual(L.applyMove(m, 'X', bad), { ok: false, reason: 'bad' }, `guess ${JSON.stringify(bad)}`);
  }
  for (const nonword of ['ZZZZZ', 'zzzzz', 'ABCDE', 'QQQQQ']) {
    assert.deepEqual(L.applyMove(m, 'X', nonword), { ok: false, reason: 'notword' }, nonword);
  }
  assert.equal(m.guesses.length, 0, 'rejected guesses leave no trace');
  assert.deepEqual(L.applyMove(m, 'X', 'mouse'), { ok: true, outcome: 'continue', note: 'guess' });
  assert.deepEqual(m.guesses[0], { by: 'X', word: 'MOUSE', marks: ['x', 'x', 'x', 'x', 'g'] });
  assert.equal(L.applyMove(m, 'O', 'about').outcome, 'continue');
  assert.deepEqual(m.guesses[1].marks, ['y', 'x', 'x', 'x', 'x']);
  assert.equal(L.applyMove(m, 'O', 'crane').outcome, 'win');
  assert.equal(m.guesses.length, 3, 'every real guess stays on record');
});

test('wordle: an invalid guess does not use up the turn', () => {
  const st = matchWith(['wordle', 'ttt']);
  st.squares[0].mini = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  st.draft = 'ZZZZZ';
  const before = JSON.stringify(st);
  assert.deepEqual(L.playMove(st, 0, 'ZZZZZ'), { ok: false, reason: 'notword' });
  assert.equal(JSON.stringify(st), before, 'nothing changed: same turn, no flash, the typed letters kept');
  assert.equal(st.turn, 'X');
  assert.equal(st.flash, null);
  assert.equal(st.moves, 0);
  assert.equal(turn(st, 0, 'MOUSE').kind, 'move', 'the same player then makes a real guess');
  assert.equal(st.turn, 'O');
  assert.equal(st.moves, 1);
});

test('wordle: a player may keep guessing on consecutive turns and the turn passes each time', () => {
  const st = matchWith(['wordle', 'ttt']);
  st.squares[0].mini = L.newMini('wordle', wordRng(L.WORDS5, 'house'));
  turn(st, 0, 'MOUSE'); turn(st, 1, 0);
  turn(st, 0, 'LOUSE'); turn(st, 1, 1);
  const f = turn(st, 0, 'HOUSE');
  assert.equal(f.kind, 'claim');
  assert.equal(st.squares[0].owner, 'X');
  assert.deepEqual(st.squares[0].mini.guesses.map(g => g.by), ['X', 'X', 'X']);
  assert.equal(st.draft, '', 'typed letters are cleared after a move');
});

test('wordle tactics: guesses stay consistent with the feedback and the last word is taken', () => {
  const w = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  L.applyMove(w, 'O', 'CRATE');
  const cand = L.wordleCandidates(L.publicMini(w));
  assert.ok(cand.includes('CRANE'));
  assert.ok(cand.every(x => x.startsWith('CRA') && x.endsWith('E') && x[3] !== 'T'));
  const st = cpuMatch('X', [w, 'ttt']);
  const mv = L.cpuMove(st, cpuRng());
  assert.ok(cand.includes(mv.move), `guess ${mv.move} fits`);
  assert.equal(L.playMove(st, 0, mv.move).ok, true);
  const fresh = L.localBest(L.publicMini(L.newMini('wordle', wordRng(L.WORDS5, 'house'))), 'X', cpuRng());
  assert.ok(L.VALID5.has(fresh.move) && L.WORDS5.includes(fresh.move.toLowerCase()), 'the opening guess is a real common word');
});

test('wordle: the admin\'s settings (the computer ignoring the clues) are dealt into the square and played by', () => {
  E.setTune('wordle', { miss: 60 });
  const m = E.newMini('wordle', E.makeRng('wordle-tune'));
  E.setTune('wordle', null);
  assert.deepEqual(m.tune, { miss: 60 });
  E.applyMove(m, 'X', m.word === 'CRANE' ? 'SLOTH' : 'CRANE', anyRng());
  const pm = E.publicMini(m), cand = E.wordleCandidates(pm);
  let off = 0;
  for (let k = 0; k < 20; k++) { const lb = E.localBest(pm, 'O', E.makeRng('wordle-ai' + k)); if (!cand.includes(lb.move)) off++; }
  assert.ok(off > 0 && off < 20, 'some guesses ignore the clues');
});

// ================================ The Hard computer ================================
const HARD = { level: 'hard', until: null };
function raceOf(type, n) {
  const lcg2 = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out = { hard: 0, normal: 0, ms: 0 };
  for (let k = 0; k < n; k++) {
    const rng = lcg2(500 + k), m = E.newMini(type, rng), hardSide = k % 2 ? 'O' : 'X';
    let p = 'X';
    for (let t = 0; t < 60; t++) {
      const pm = E.publicMini(m), hard = p === hardSide, t0 = performance.now();
      const b = E.localBest(pm, p, rng, {}, hard ? HARD : {});
      if (hard) out.ms = Math.max(out.ms, performance.now() - t0);
      const r = E.applyMove(m, p, b.move, rng);
      assert.equal(r.ok, true, `${type}: a legal move (${JSON.stringify(b.move)})`);
      if (r.outcome === 'win') { out[hard ? 'hard' : 'normal']++; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  return out;
}
test('wordle, Hard: the race for the word: legal guesses that could be the word, the last candidates guessed, more squares than Normal, quickly', () => {
  const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  let b = L.localBest(L.publicMini(m), 'X', cpuRng(), {}, HARD);
  assert.ok(L.VALID5.has(b.move), 'a fresh square: a real word'); assert.equal(b.shared, true);
  L.applyMove(m, 'X', 'SLATE');
  const pm = L.publicMini(m), cand = L.wordleCandidates(pm);
  b = L.localBest(pm, 'O', cpuRng(), {}, HARD);
  assert.ok(L.VALID5.has(b.move));
  if (cand.includes(b.move)) assert.equal(b.q, 1 / cand.length, 'a guess that could be the word');
  else { assert.equal(b.q, 0); assert.ok(cand.length > 2 && cand.length <= 12, 'a word outside them only with few left, when it leaves the other side least'); }
  L.applyMove(m, 'O', b.move);
  if (m.guesses[1].word !== 'CRANE') {
    const pm2 = L.publicMini(m), c2 = L.wordleCandidates(pm2), h = L.localBest(pm2, 'X', cpuRng(), {}, HARD);
    assert.ok(L.VALID5.has(h.move)); if (c2.length <= 2) assert.ok(c2.includes(h.move), 'the last candidates: guessed');
  }
  const r = raceOf('wordle', 80);
  assert.ok(r.hard > r.normal, `Hard wins the race: ${r.hard} to ${r.normal}`);
  const ms = [];
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); L.localBest(pm, 'O', cpuRng(), {}, HARD); ms.push(performance.now() - t0); }
  assert.ok(Math.min(...ms) < 60, `under 60 ms: ${ms.map(x => x.toFixed(1))}`);
  assert.ok(r.ms < 200, `never slow in the race (${r.ms.toFixed(1)} ms at worst)`);
  assert.deepEqual(L.localBest(pm, 'O', cpuRng(), {}, { level: 'normal', until: null }), L.localBest(pm, 'O', cpuRng()), 'Normal untouched');
});

test('wordle: each player has 5 guesses (the setting); a 5th that misses hands the square to the other player', () => {
  const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  assert.equal(m.limit, 5);
  for (const w of ['SLATE', 'MOUNT', 'BRICK', 'FUDGY']) assert.equal(L.applyMove(m, 'X', w).outcome, 'continue');
  for (const w of ['PLUMB', 'GHOST', 'WINDY', 'SHAKE']) assert.equal(L.applyMove(m, 'O', w).outcome, 'continue', 'O\'s own five');
  assert.deepEqual([E.wordleLeft(m, 'X'), E.wordleLeft(m, 'O')], [1, 1]);
  assert.deepEqual(L.applyMove(m, 'O', 'TRACE'), { ok: true, outcome: 'win', winner: 'X', note: 'out' }, 'O\'s 5th misses: X claims');
  assert.equal(L.applyMove(m, 'O', 'CRANE').reason, 'out', 'no 6th guess');
  assert.equal(L.applyMove(m, 'X', 'XXXXX').reason, 'notword', 'a non-word still costs nothing');
  assert.deepEqual(L.applyMove(m, 'X', 'CRANE'), { ok: true, outcome: 'win' }, 'a 5th that finds it wins');
  assert.equal(L.publicMini(m).limit, 5);
  // the setting: 3 guesses each
  E.setTune('wordle', { limit: 3 });
  const m3 = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  E.setTune('wordle', null);
  for (const w of ['SLATE', 'MOUNT']) L.applyMove(m3, 'X', w);
  assert.equal(L.applyMove(m3, 'X', 'BRICK').winner, 'O');
  // an older square (no limit) plays on as it was
  const old = L.newMini('wordle', wordRng(L.WORDS5, 'crane')); delete old.limit;
  for (let k = 0; k < 7; k++) assert.equal(L.applyMove(old, 'X', 'SLATE').outcome, 'continue');
  // through the match: the square is the other player's, and the flash says so
  const st = L.newMatch(seq(0.5));
  st.squares[0].mini = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  for (const w of ['SLATE', 'MOUNT', 'BRICK', 'FUDGY']) st.squares[0].mini.guesses.push({ by: 'X', word: w, marks: E.wordleMarks(w, 'CRANE') });
  const r = L.playMove(st, 0, 'PLUMB');
  assert.equal(r.ok, true);
  assert.equal(st.squares[0].owner, 'O');
  assert.equal(r.flash.kind, 'claim'); assert.equal(r.flash.winner, 'O'); assert.equal(r.flash.note, 'out'); assert.equal(r.flash.left, 0);
});

test('wordle: the computer\'s last guess is always a word that could be it, and it weighs the loss', () => {
  const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  for (const w of ['SLATE', 'MOUNT', 'BRICK', 'FUDGY']) L.applyMove(m, 'X', w);
  const pm = L.publicMini(m), cand = E.wordleCandidates(pm);
  for (const level of ['easy', 'normal', 'hard']) {
    const r = L.localBest(pm, 'X', cpuRng(), null, { level });
    assert.ok(cand.includes(r.move), `${level}: ${r.move} is a candidate`);
    assert.ok(r.qLose > 0 || cand.length === 1, `${level}: the last guess weighs the loss`);
  }
  assert.ok(E.needsOf(pm, 'X') >= 1);
});
