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

// ================================ Race mode (core/race.js) ================================
// The same word for both, each player's guesses and colours their own (mini.side[p]); the other side sees only the rows
// of colours; online the record keeps each side's part apart and a move's entry is redacted; the computer plays from its
// own part alone.
const raceOn = on => E.setTune('wordle', on ? { mode: 'race' } : null);
const wordleAt = st => st.squares.findIndex(q => q.mini.type === 'wordle');
function raceMatch(rng) { return E.newMatch(rng, { games: ['wordle', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'] }); }

test('wordle, race: dealt by the admin setting; each side its own guesses, the same word; a last guess that misses hands the square over; two on one phone play Shared', () => {
  raceOn(true);
  try {
    const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
    assert.equal(m.race, true); assert.equal(m.word, 'CRANE'); assert.equal(m.guesses, undefined); assert.deepEqual(m.side, { X: { guesses: [] }, O: { guesses: [] } });
    assert.deepEqual(m.tune, { mode: 'race' });
    assert.deepEqual(L.applyMove(m, 'X', 'slate'), { ok: true, outcome: 'continue', note: 'guess' });
    assert.equal(m.side.X.guesses.length, 1); assert.deepEqual(m.side.X.guesses[0].marks, ['x', 'x', 'g', 'x', 'g']); assert.deepEqual(m.side.O.guesses, [], "O's part is untouched");
    assert.equal(L.applyMove(m, 'O', 'slate').ok, true, 'the same word is open to O (their rows are their own)');
    assert.deepEqual([E.wordleLeft(m, 'X'), E.wordleLeft(m, 'O')], [4, 4]);
    assert.equal(L.applyMove(m, 'X', 'zzzzz').reason, 'notword'); assert.equal(m.side.X.guesses.length, 1, 'a non-word costs nothing');
    assert.deepEqual(L.applyMove(m, 'O', 'crane'), { ok: true, outcome: 'win' }, 'the same word wins for O');
    assert.deepEqual(E.raceShape(m, 'X'), { n: 1, left: 4, rows: ['xxgxg'] }); assert.deepEqual(E.raceShape(m, 'O'), { n: 2, left: 3, rows: ['xxgxg', 'ggggg'] });
    // the last guess missed: the square goes to the other player, from this side's own count alone
    const m2 = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
    for (const w of ['slate', 'bloom', 'frown', 'pithy']) assert.equal(L.applyMove(m2, 'X', w).outcome, 'continue');
    assert.equal(L.applyMove(m2, 'O', 'slate').outcome, 'continue', "O's own five");
    assert.deepEqual(L.applyMove(m2, 'X', 'quirk'), { ok: true, outcome: 'win', winner: 'O', note: 'out' });
    assert.equal(L.newMini('wordle', wordRng(L.WORDS5, 'crane'), { shared: true }).race, undefined, 'two people on one phone: Shared');
    assert.ok(E.newMatch(E.makeRng('w-same'), { games: ['wordle'], vs: 'same' }).squares.every(q => !q.mini.race));
    assert.ok(E.newMatch(E.makeRng('w-cpu'), { games: ['wordle'], vs: 'cpu' }).squares.every(q => q.mini.race));
  } finally { raceOn(false); }
  assert.equal(L.newMini('wordle', wordRng(L.WORDS5, 'crane')).race, undefined, 'off: as ever');
});

test('wordle, race: the public view holds the shapes and one side\'s own part alone; the record keeps each side\'s part for that side; hidden, the word is gone', () => {
  raceOn(true);
  try {
    const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
    L.applyMove(m, 'X', 'slate'); L.applyMove(m, 'X', 'crony');
    const pub = E.publicMini(m);
    assert.equal(pub.word, undefined); assert.deepEqual(pub.side, {}); assert.deepEqual(pub.shape.X, { n: 2, left: 3, rows: ['xxgxg', 'ggxgx'] }); assert.deepEqual(pub.shape.O, { n: 0, left: 5, rows: [] });
    const forO = E.publicMini(m, 'O');
    assert.deepEqual(Object.keys(forO.side), ['O'], "O's own part alone"); assert.equal(forO.side.X, undefined); assert.ok(!JSON.stringify(forO).includes('SLATE'), "X's letters are nowhere in O's view");
    const forX = E.publicMini(m, 'X');
    assert.equal(forX.side.X.guesses.length, 2); assert.equal(forX.side.O, undefined);
    assert.deepEqual(E.wordleCandidates(forX, 'X'), E.wordleCandidates({ guesses: m.side.X.guesses }), 'the candidates from its own part');
    const hidden = JSON.parse(JSON.stringify(m)); E.hideMini(hidden, 0, {});
    assert.equal(hidden.word, undefined); assert.equal(hidden.side, undefined); assert.equal(hidden.shape.X.n, 2);
    // the record
    const st = raceMatch(E.makeRng('w-rec')); const k = wordleAt(st);
    st.squares[k].mini = m; st.id = 'w1'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), ps = rec.state.squares[k].mini;
    assert.equal(ps.side, undefined); assert.equal(ps.word, undefined); assert.deepEqual(ps.shape.O, { n: 0, left: 5, rows: [] }); assert.equal(ps.shape.X.n, 2);
    assert.equal(rec.sides.X[k].guesses.length, 2); assert.deepEqual(rec.sides.O[k], { guesses: [] });
    assert.ok(!JSON.stringify(rec.state).includes('CRANE') && !JSON.stringify(rec.state).includes('SLATE'));
    const full = E.fullState(rec);
    assert.deepEqual(full.squares[k].mini.side, m.side); assert.equal(full.squares[k].mini.word, 'CRANE'); assert.equal(full.squares[k].mini.shape, undefined);
    const back = E.parseMatch(E.packMatch(rec));
    assert.deepEqual(E.fullState(back).squares[k].mini.side, m.side);
    const oneSide = E.fullState({ state: rec.state, secrets: rec.secrets, sides: { O: rec.sides.O } });   // a phone: its own side alone
    assert.equal(oneSide.squares[k].mini.side.X, undefined); assert.deepEqual(oneSide.squares[k].mini.side.O, { guesses: [] });
  } finally { raceOn(false); }
});

test('wordle, race: an online move\'s entry is redacted for the other phone (no word, no marks, no inputs), its row of colours alone; the mover\'s part reaches their side', () => {
  raceOn(true);
  try {
    const st = raceMatch(E.makeRng('w-online')); const k = wordleAt(st); st.id = 'w2'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), word = rec.secrets[k].word, guess = word === 'SLATE' ? 'CRANE' : 'SLATE';
    const r = E.applyOnlineMove(rec, 'X', k, guess, E.makeRng('w-mv'), { rep: [[0, 'key', 'k=S'], [300, 'enter']] });
    assert.ok(r.ok);
    const e = r.entries[0];
    assert.equal(e.m, undefined); assert.equal(e.word, undefined); assert.equal(e.marks, undefined); assert.equal(e.note, undefined); assert.equal(e.rep, undefined); assert.equal(e.left, undefined);
    assert.deepEqual(Object.keys(e.race).sort(), ['by', 'left', 'n', 'row', 'rows']); assert.equal(e.race.n, 1); assert.equal(e.race.left, 4); assert.equal(e.race.row, E.wordleMarks(guess, word).join('')); assert.deepEqual(e.race.rows, [e.race.row]);
    assert.equal(e.after.mini.side, undefined); assert.equal(e.after.mini.shape.X.n, 1);
    assert.ok(!JSON.stringify(r.rec.state).includes(guess), 'the guess is nowhere in the public state');
    assert.equal(r.rec.sides.X[k].guesses[0].word, guess, "the mover's own part holds it"); assert.deepEqual(r.rec.sides.O[k].guesses, []);
    const r2 = E.applyOnlineMove(r.rec, 'O', k, guess, E.makeRng('w-mv2'));
    assert.ok(r2.ok, 'the same guess is open to O'); assert.equal(r2.rec.sides.O[k].guesses.length, 1);
    // a shared square's entry is as ever
    raceOn(false);
    const st2 = raceMatch(E.makeRng('w-online')); const k2 = wordleAt(st2); st2.id = 'w3'; st2.seq = 0; st2.recent = [];
    const e2 = E.applyOnlineMove(E.matchRecord(st2), 'X', k2, 'SLATE', E.makeRng('w-mv'), { rep: [[0, 'enter']] }).entries[0];
    assert.equal(e2.m, 'SLATE'); assert.ok(e2.rep); assert.equal(e2.race, undefined);
  } finally { raceOn(false); }
});

test('wordle, race: the computer plays from its own part alone and finds the word (Normal and Hard), never a refused word; the flash as the other side sees it', () => {
  raceOn(true);
  try {
    for (const level of ['normal', 'hard']) {
      let found = 0, moves = 0;
      for (let g = 0; g < 12; g++) {
        const rng = E.makeRng('w-ai-' + level + g), m = L.newMini('wordle', rng);
        L.applyMove(m, 'X', m.word === 'SLATE' ? 'CRANE' : 'SLATE');            // X's own guess: it must not help or hinder O
        let r;
        for (let i = 0; i < 5; i++) {
          const pm = E.publicMini(m, 'O');
          assert.equal(pm.side.X, undefined, "the computer never sees X's part");
          const b = E.localBest(pm, 'O', rng, E.STYLE0, level === 'hard' ? { level: 'hard', until: null } : {});
          assert.ok(!E.BAD5.has(b.move), 'never a refused word'); assert.equal(b.shared, false, 'a race: its guesses help nobody else');
          r = L.applyMove(m, 'O', b.move, rng); assert.equal(r.ok, true, `${level}: a legal guess (${b.move}: ${r.reason})`);
          moves++;
          if (r.outcome === 'win') { if (!r.winner) found++; break; }
        }
      }
      assert.ok(found >= 9, `${level}: found ${found} of 12 within 5 guesses of its own`);
    }
    const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane')); L.applyMove(m, 'O', 'slate');
    const pm = E.publicMini(m, 'X');
    assert.ok(E.needsOf(pm, 'X') > E.needsOf(pm, 'O'), 'O, a row in, is reckoned nearer from its shape alone');
    const f = { kind: 'move', by: 'O', next: 'X', square: 0, type: 'wordle', note: 'guess', word: 'SLATE', left: 4, m: 'SLATE', rep: [[0, 'enter']] };
    const h = E.raceFlashHide(f, m);
    assert.deepEqual(Object.keys(h).sort(), ['by', 'kind', 'next', 'race', 'square', 'type']); assert.deepEqual(h.race, { by: 'O', row: 'xxgxg', n: 1, left: 4, rows: ['xxgxg'] });
    const st = raceMatch(E.makeRng('w-stats')); const k = wordleAt(st);
    const r = L.playMove(st, k, st.squares[k].mini.word);
    assert.ok(r.ok); assert.equal(st.sqlog[0].race, 1);
  } finally { raceOn(false); }
});
