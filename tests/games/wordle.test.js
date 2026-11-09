'use strict';
// Five Letters: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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

// ================================== Five Letters ==================================
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

test('wordle: no offensive word is ever the answer, and an offensive guess is refused without using a guess', () => {
  const { BAD5 } = require('../../src/games/wordle/words.js');
  assert.ok(BAD5.size > 20, 'the offensive 5-letter words from the username list');
  for (const w of L.WORDS5) assert.ok(!BAD5.has(w.toUpperCase()), `${w} is never dealt as the answer`);
  const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  const bad = [...BAD5][0];
  assert.deepEqual(L.applyMove(m, 'X', bad), { ok: false, reason: 'notallowed' });
  assert.deepEqual(L.applyMove(m, 'X', bad.toLowerCase()), { ok: false, reason: 'notallowed' }, 'in any case');
  assert.equal(m.guesses.length, 0, 'no guess spent');
  const st = matchWith(['wordle', 'ttt']);
  st.squares[0].mini = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  const before = JSON.stringify(st);
  assert.deepEqual(L.playMove(st, 0, bad), { ok: false, reason: 'notallowed' });
  assert.equal(JSON.stringify(st), before, 'the same turn, nothing changed');
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
test('wordle: the computer never guesses a refused word (Easy\'s slips, Hard\'s probes draw from the clean list)', () => {
  const rng = E.makeRng('w-clean'), A = require('../../src/games/wordle/ai.js');
  for (let k = 0; k < 400; k++) {
    const m = E.newMini('wordle', rng); m.tune = Object.assign({}, m.tune, { miss: 100 });   // every Easy move a slip: a word at random
    const g = A.best(E.publicMini(m), 'X', rng, {}, { level: 'easy' });
    assert.ok(!E.BAD5.has(String(g.move).toUpperCase()), `${g.move} is refused`);
  }
});
test('Five Letters: a random move is never a refused word', () => {
  const R = require('../../src/games/wordle/rules.js'), W = require('../../src/games/wordle/words.js');
  let k = 0; const from = a => { const bad = a.filter(w => W.BAD5.has(w.toUpperCase())); assert.equal(bad.length, 0, `refused words offered: ${bad.slice(0, 3)}`); return a[k++ % a.length]; };
  R.randomMove({}, 'X', null, from);
});

// ================================ Race mode v2 (core/race.js, rv 2) ================================
// Each player their own word from the one answer list (mini.tg, the square's secret), their own guesses and colours in
// mini.side[p] (open to both, letters and all), no guess limit; the first to find their own word takes the square.
const R = require('../../src/games/wordle/rules.js');
const raceOn = on => E.setTune('wordle', on ? { mode: 'race' } : null);
const wordleAt = st => st.squares.findIndex(q => q.mini.type === 'wordle');
function raceMatch(rng) { return E.newMatch(rng, { games: ['wordle', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], vs: 'cpu' }); }
const ANS = new Set(L.WORDS5.map(w => w.toUpperCase()));
const notIt = (...ws) => ['SLATE', 'CRANE', 'MOUNT', 'BRICK'].find(w => !ws.includes(w));

test('wordle, race v2: two different words from the one answer list; each side its own rows, judged against its own word; two on one phone play Shared', () => {
  raceOn(true);
  try {
    for (let k = 0; k < 200; k++) {
      const m = L.newMini('wordle', E.makeRng('wrv2-' + k));
      assert.equal(m.race, true); assert.equal(m.rv, 2); assert.equal(m.word, undefined); assert.equal(m.limit, undefined, 'no limit in a race');
      assert.notEqual(m.tg.X, m.tg.O, 'two different words');
      assert.ok(ANS.has(m.tg.X) && ANS.has(m.tg.O), 'both from the answer list (the same difficulty)');
      assert.deepEqual(m.side, { X: { guesses: [] }, O: { guesses: [] } });
    }
    const m = L.newMini('wordle', E.makeRng('wrv2-a'));
    m.tg = { X: 'CRANE', O: 'MOUNT' };
    assert.deepEqual(L.applyMove(m, 'X', 'slate'), { ok: true, outcome: 'continue', note: 'guess' });
    assert.deepEqual(m.side.X.guesses[0].marks, ['x', 'x', 'g', 'x', 'g'], "against X's own word"); assert.deepEqual(m.side.O.guesses, [], "O's part is untouched");
    assert.deepEqual(L.applyMove(m, 'O', 'slate').ok, true); assert.deepEqual(m.side.O.guesses[0].marks, ['x', 'x', 'x', 'y', 'x'], "against O's own word");
    assert.equal(L.applyMove(m, 'X', 'zzzzz').reason, 'notword'); assert.equal(m.side.X.guesses.length, 1, 'a non-word costs nothing');
    assert.equal(L.applyMove(m, 'X', 'mount').outcome, 'continue', "O's word is not X's");
    assert.deepEqual(L.applyMove(m, 'O', 'mount'), { ok: true, outcome: 'win' }, "O's own word wins for O");
    assert.deepEqual(E.raceShape(m, 'O'), { n: 2, best: 'ggggg' });
    assert.equal(L.newMini('wordle', wordRng(L.WORDS5, 'crane'), { shared: true }).race, undefined, 'two people on one phone: Shared');
    assert.ok(E.newMatch(E.makeRng('w-same'), { games: ['wordle'], vs: 'same' }).squares.every(q => !q.mini.race));
    assert.ok(E.newMatch(E.makeRng('w-cpu'), { games: ['wordle'], vs: 'cpu' }).squares.every(q => q.mini.race && q.mini.rv === 2));
  } finally { raceOn(false); }
  assert.equal(L.newMini('wordle', wordRng(L.WORDS5, 'crane')).race, undefined, 'off: as ever');
});

test('wordle, race v2: no guess limit (twelve misses and on, nothing handed over); Shared keeps its 5', () => {
  raceOn(true);
  try {
    const m = L.newMini('wordle', E.makeRng('wrv2-cap')); m.tg = { X: 'CRANE', O: 'MOUNT' };
    for (let k = 0; k < 12; k++) assert.deepEqual(L.applyMove(m, 'X', 'SLATE'), { ok: true, outcome: 'continue', note: 'guess' }, `guess ${k + 1}: no limit`);
    assert.deepEqual(L.applyMove(m, 'X', 'CRANE'), { ok: true, outcome: 'win' });
    assert.equal(E.wordleLimit(m), 0); assert.equal(E.wordleLeft(m, 'X'), Infinity); assert.equal(E.publicMini(m).limit, 0);
    const f = {}; R.moveFlash('CRANE', 'X', null, 0, m, f); assert.equal(f.left, null, 'no "left" on the flash');
  } finally { raceOn(false); }
  const s = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  for (const w of ['SLATE', 'MOUNT', 'BRICK', 'FUDGY']) L.applyMove(s, 'X', w);
  assert.deepEqual(L.applyMove(s, 'X', 'PLUMB'), { ok: true, outcome: 'win', winner: 'O', note: 'out' }, 'Shared: the 5th miss still hands it over');
});

test('wordle, race v2: the words never reach the public view, the record\'s state or a move\'s entry while the square is open; both players\' rows do; claimed, the words are public', () => {
  raceOn(true);
  try {
    const st = raceMatch(E.makeRng('wrv2-rec')), k = wordleAt(st), m = st.squares[k].mini, { X: wx, O: wo } = m.tg;
    L.applyMove(m, 'X', notIt(wx, wo)); L.applyMove(m, 'O', notIt(wx, wo));
    for (const side of [undefined, 'X', 'O']) {
      const pm = E.publicMini(m, side), js = JSON.stringify(pm);
      assert.ok(!js.includes(wx) && !js.includes(wo) && !/"tg"|"word":"[A-Z]{5}"/.test(js.replace(/"word":"(SLATE|CRANE|MOUNT|BRICK)"/g, '')), 'no word in the view');
      assert.equal(pm.side.X.guesses.length, 1); assert.equal(pm.side.O.guesses[0].word, notIt(wx, wo), "both players' rows, letters and all");
    }
    st.id = 'w1'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), js = JSON.stringify(rec.state);
    assert.ok(!js.includes(wx) && !js.includes(wo) && !js.includes('"tg"'), "the record's state holds no word");
    assert.deepEqual(rec.secrets[k], { tg: m.tg }); assert.deepEqual(rec.state.squares[k].mini.side, m.side, 'the parts ride the public state');
    const full = E.fullState(E.parseMatch(E.packMatch(rec)));
    assert.deepEqual(full.squares[k].mini.tg, m.tg); assert.deepEqual(full.squares[k].mini.side, m.side); assert.equal(full.squares[k].mini.rv, 2, 'kept, not dealt again');
    const g = notIt(wx, wo, 'SLATE');
    const r = E.applyOnlineMove(rec, 'X', k, g, E.makeRng('w-mv'), { rep: [[0, 'key', 'k=S'], [300, 'enter']] });
    assert.ok(r.ok); const ej = JSON.stringify(r.entries) + JSON.stringify(r.rec.state);
    assert.ok(!ej.includes(wx) && !ej.includes(wo), "no word in the entry or the state");
    assert.equal(r.entries[0].word, g, 'the guess itself is open'); assert.equal(r.rec.state.squares[k].mini.side.X.guesses[1].word, g);
    const r2 = E.applyOnlineMove(r.rec, 'O', k, wo, E.makeRng('w-mv2'));
    assert.ok(r2.ok); assert.equal(r2.rec.state.squares[k].owner, 'O'); assert.deepEqual(r2.rec.state.squares[k].mini.tg, m.tg, 'revealed once the square ends');
  } finally { raceOn(false); }
});

test('wordle, race v2: the computer finds its own word from the public view alone at every level, never a refused word; Hard in fewer guesses; needs reads each side\'s own rows', () => {
  raceOn(true);
  try {
    const avg = {};
    for (const level of ['easy', 'normal', 'hard']) {
      let total = 0;
      for (let g = 0; g < 30; g++) {
        const rng = E.makeRng(`w-ai-${level}-${g}`), m = L.newMini('wordle', rng);
        L.applyMove(m, 'X', notIt(m.tg.X, m.tg.O));                     // X's own guess: it must not help or hinder O
        let r, n = 0;
        do {
          const pm = E.publicMini(m, 'O');
          assert.equal(pm.tg, undefined, 'never the word');
          const b = E.localBest(pm, 'O', rng, E.STYLE0, { level, until: null });
          if (level === 'easy' && rng() < 0.3) b.move = E.randomLegalMove(m, 'O', rng);   // (Easy's careless moves)
          assert.ok(!E.BAD5.has(b.move), 'never a refused word'); assert.equal(b.shared, false);
          r = L.applyMove(m, 'O', b.move, rng); assert.equal(r.ok, true, `${level}: ${b.move}: ${r.reason}`); n++;
        } while (r.outcome !== 'win' && n < 60);
        assert.equal(r.outcome, 'win'); assert.equal(r.winner, undefined, `${level}: its own word found`);
        total += n;
      }
      avg[level] = total / 30;
    }
    assert.ok(avg.normal <= 5 && avg.hard <= avg.normal + 0.1, `guesses: ${JSON.stringify(avg)}`);
    const m = L.newMini('wordle', E.makeRng('w-need')); m.tg = { X: 'CRANE', O: 'MOUNT' }; L.applyMove(m, 'O', 'COUNT');
    const pm = E.publicMini(m, 'X');
    assert.ok(E.needsOf(pm, 'O') < E.needsOf(pm, 'X'), 'O, a row in, is reckoned nearer from its own rows');
    assert.deepEqual(E.wordleCandidates(pm, 'O'), E.wordleCandidates({ guesses: m.side.O.guesses }), "O's candidates from O's own rows");
    const st = raceMatch(E.makeRng('w-stats')), k = wordleAt(st);
    const r = L.playMove(st, k, st.squares[k].mini.tg[st.turn]);
    assert.ok(r.ok); assert.equal(st.squares[k].owner, r.flash.by); assert.equal(st.sqlog[0].race, 1);
  } finally { raceOn(false); }
});
