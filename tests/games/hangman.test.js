'use strict';
// Hangman: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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

// ================================== Hangman ==================================
test('hangman: the embedded list holds unique common words of 5 to 7 letters', () => {
  assert.ok(L.WORDS_HANG.length >= 100, `only ${L.WORDS_HANG.length} words`);
  assert.equal(new Set(L.WORDS_HANG).size, L.WORDS_HANG.length);
  for (const w of L.WORDS_HANG) assert.match(w, /^[a-z]{5,7}$/, w);
  assert.equal(L.newMini('hangman', wordRng(L.WORDS_HANG, 'banana')).word, 'BANANA');
});

test('hangman: a right letter reveals every copy and grants another guess, a wrong one ends the turn', () => {
  const m = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  for (const bad of ['AB', '1', '', 5, null]) assert.equal(L.applyMove(m, 'X', bad).ok, false, `letter ${bad}`);
  assert.deepEqual(L.applyMove(m, 'X', 'p'), { ok: true, outcome: 'continue', note: 'hit', again: true });
  assert.deepEqual(m.letters, [{ l: 'P', by: 'X', hit: true }]);
  assert.deepEqual(L.applyMove(m, 'X', 'P'), { ok: false, reason: 'taken' });
  assert.deepEqual(L.applyMove(m, 'X', 'Z'), { ok: true, outcome: 'continue', note: 'miss' });
  assert.equal(L.applyMove(m, 'O', 'A').again, true);
  assert.equal(L.applyMove(m, 'O', 'L').again, true);
  const r = L.applyMove(m, 'O', 'E');
  assert.equal(r.outcome, 'win', 'revealing the final letter wins');
  assert.equal(r.again, undefined);
});

test('hangman: the bonus guess keeps the turn and locks the player to that square', () => {
  const st = matchWith(['hangman', 'ttt']);
  st.squares[0].mini = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  const r = L.playMove(st, 0, 'P');
  assert.equal(r.ok, true);
  assert.equal(st.flash.kind, 'again');
  assert.equal(st.flash.next, 'X');
  assert.equal(st.turn, 'X', 'turn does not pass');
  assert.equal(st.lock, 0);
  L.endFlash(st);
  assert.equal(st.screen, 'mini', 'stays in the mini-game');
  assert.equal(st.zoom, 0);
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'locked' }, 'cannot move elsewhere');
  assert.equal(L.playMove(st, 0, 'Z').ok, true);
  assert.equal(st.flash.kind, 'move');
  assert.equal(st.turn, 'X', 'the miss ends the move; the turn passes as the board comes back');
  assert.equal(st.done.next, 'O');
  assert.equal(st.lock, null);
  L.endFlash(st);
  assert.equal(st.screen, 'board');
  assert.equal(st.turn, 'O');
});

test('hangman: one player can reveal the whole word in a single turn (lopsided) and claims the square', () => {
  const st = matchWith(['hangman']);
  st.squares[0].mini = L.newMini('hangman', wordRng(L.WORDS_HANG, 'zebra'));
  for (const l of ['Z', 'E', 'B', 'R']) {
    assert.equal(turn(st, 0, l).kind, 'again');
    assert.equal(st.turn, 'X');
  }
  const f = turn(st, 0, 'A');
  assert.equal(f.kind, 'claim');
  assert.equal(st.squares[0].owner, 'X');
  assert.equal(st.lock, null, 'lock clears on the win');
  assert.equal(st.turn, 'O');
  assert.equal(st.moves, 5);
});

test('hangman tactics: the letter most common among the words still possible, and a known word is finished in one move', () => {
  const h = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  const pm = L.publicMini(h);
  const cand = L.hangmanCandidates(pm);
  assert.ok(cand.includes('APPLE') && cand.every(x => x.length === 5));
  const count = {};
  for (const x of cand) for (const ch of new Set(x)) count[ch] = (count[ch] || 0) + 1;
  const top = Math.max(...Object.values(count));
  const mv = L.localBest(pm, 'X', cpuRng()).move;
  assert.equal(count[mv], top, `${mv} is a most common letter`);
  // narrowed to one word: every guess hits and the square is claimed in a single move
  for (const l of ['A', 'P']) L.applyMove(h, 'O', l);
  L.applyMove(h, 'O', 'Z');
  const left = L.hangmanCandidates(L.publicMini(h));
  if (left.length === 1) {
    const st = cpuMatch('X', [h, 'ttt']);
    let guard = 0, f;
    do { const m = L.cpuMove(st, cpuRng()); f = L.playMove(st, m.square, m.move).flash; L.endFlash(st); } while (f.kind === 'again' && guard++ < 10);
    assert.equal(f.kind, 'claim');
    assert.equal(st.squares[0].owner, 'X');
  }
});

test('a timeout with a hangman letter owed guesses nothing: the turn ends there', () => {
  const st = matchWith(['hangman', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.timer = L.newTimer(30);
  st.lock = 0;                                                  // a right letter: another owed
  const letters = st.squares[0].mini.letters.length;
  const r = L.timeoutMove(st, seq(0.5));
  assert.deepEqual([r.ok, r.square, r.ended, st.squares[0].mini.letters.length, st.flash], [true, 0, true, letters, null], 'no letter guessed for the player');
  assert.equal(st.turn, 'O', 'the turn passes');
  assert.equal(st.lock, null);
});

test('hangman: the admin\'s settings (word lengths, the computer\'s random letters) are dealt into the square and played by', () => {
  E.setTune('hangman', { minLen: 7, maxLen: 7, miss: 60 });
  const ms = Array.from({ length: 8 }, (_, k) => E.newMini('hangman', E.makeRng('hang-tune' + k)));
  E.setTune('hangman', null);
  for (const m of ms) assert.equal(m.word.length, 7);
  assert.deepEqual(ms[0].tune, { minLen: 7, miss: 60 });
  const pm = E.publicMini(ms[0]), moves = new Set();
  for (let k = 0; k < 20; k++) moves.add(E.localBest(pm, 'X', E.makeRng('hang-ai' + k)).move);
  assert.ok(moves.size > 1, 'a random letter now and then');
  assert.ok(E.newMini('hangman', E.makeRng('hang-def')).word.length <= 7);
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
test('hangman, Hard: the race for the word: a letter some candidate holds, a known word finished, the sure finish taken, more squares than Normal, quickly', () => {
  const m = L.newMini('hangman', lcg(3));
  const pm = L.publicMini(m), cand = L.hangmanCandidates(pm);
  let b = L.localBest(pm, 'X', cpuRng(), {}, HARD);
  assert.match(b.move, /^[A-Z]$/); assert.ok(cand.some(w => w.includes(b.move)), 'a letter in some word still possible'); assert.equal(b.shared, true);
  // one word left: its letters, to the end
  const one = { type: 'hangman', word: 'PLANET', letters: [] };
  for (const l of 'PLANE') L.applyMove(one, 'X', l);
  b = L.localBest(L.publicMini(one), 'O', cpuRng(), {}, HARD);
  assert.equal(b.move, 'T'); assert.equal(b.q, 1);
  // two words apart by one letter each (the race's end): a letter that wins half the time; the sure finish when one word is left among several letters
  const two = L.WORDS_HANG.map(w => w.toUpperCase()).filter(w => w.length === 6);
  const found = [];
  for (let i = 0; i < two.length && !found.length; i++) for (let j = i + 1; j < two.length; j++) { let diff = 0; for (let k = 0; k < 6; k++) if (two[i][k] !== two[j][k]) diff++; if (diff === 1 && !two[i].split('').some(ch => two[j].includes(ch) && !two[i].includes(ch))) { found.push(two[i], two[j]); break; } }
  if (found.length) {
    const w = { type: 'hangman', word: found[0], letters: [] };
    for (const l of new Set(found[0].split('').filter((ch, k) => found[0][k] === found[1][k]))) L.applyMove(w, 'X', l);
    const pw = L.publicMini(w), cw = L.hangmanCandidates(pw);
    if (cw.length === 2) { const h = L.localBest(pw, 'O', cpuRng(), {}, HARD); assert.ok(found[0].includes(h.move) || found[1].includes(h.move), 'one of the two letters that tell'); assert.equal(h.q, 0.5); }
  }
  const r = raceOf('hangman', 80);
  assert.ok(r.hard > r.normal, `Hard wins the race: ${r.hard} to ${r.normal}`);
  const ms = [];
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); L.localBest(pm, 'X', cpuRng(), {}, HARD); ms.push(performance.now() - t0); }
  assert.ok(Math.min(...ms) < 60, `under 60 ms: ${ms.map(x => x.toFixed(1))}`);
  assert.ok(r.ms < 200, `never slow in the race (${r.ms.toFixed(1)} ms at worst)`);
  assert.deepEqual(L.localBest(pm, 'X', cpuRng(), {}, { level: 'normal', until: null }), L.localBest(pm, 'X', cpuRng()), 'Normal untouched');
});
test('hangman: a right letter keeps the turn with almost no pause before the next guess', () => {
  const H = require('../../src/games/hangman/rules.js');
  assert.ok(H.flashMs({ kind: 'again' }) <= 300, 'a right letter: the next guess almost at once');
  assert.equal(H.flashMs({ kind: 'move' }), 650, 'a miss or the solving letter: as before');
});

// ================================ Race mode (core/race.js) ================================
// The same word for both, each player's letters and revealed pattern their own (mini.side[p]); the other side sees only
// which blanks they have filled and their wrong count; a right letter still gives another go; online the record keeps each
// side's part apart and a move's entry is redacted; the computer plays from its own part alone.
const raceOn = on => E.setTune('hangman', on ? { mode: 'race' } : null);
const hangAt = st => st.squares.findIndex(q => q.mini.type === 'hangman');
function raceMatch(rng) { return E.newMatch(rng, { games: ['hangman', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'] }); }

test('hangman, race: dealt by the admin setting; each side its own letters and pattern, the same word; a right letter goes again; two on one phone play Shared', () => {
  raceOn(true);
  try {
    const m = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
    assert.equal(m.race, true); assert.equal(m.word, 'APPLE'); assert.equal(m.letters, undefined);
    assert.deepEqual(m.side, { X: { letters: [], pattern: [null, null, null, null, null] }, O: { letters: [], pattern: [null, null, null, null, null] } });
    assert.deepEqual(L.applyMove(m, 'X', 'P'), { ok: true, outcome: 'continue', note: 'hit', again: true });
    assert.deepEqual(m.side.X.pattern, [null, 'P', 'P', null, null]); assert.deepEqual(m.side.O.pattern, [null, null, null, null, null], "O's part is untouched");
    assert.deepEqual(L.applyMove(m, 'X', 'Z'), { ok: true, outcome: 'continue', note: 'miss' });
    assert.equal(L.applyMove(m, 'X', 'P').reason, 'taken'); assert.equal(L.applyMove(m, 'O', 'P').ok, true, 'the same letter is open to O (their letters are their own)');
    assert.deepEqual(E.raceShape(m, 'X'), { n: 2, wrong: 1, got: [false, true, true, false, false] }); assert.deepEqual(E.raceShape(m, 'O'), { n: 1, wrong: 0, got: [false, true, true, false, false] });
    for (const l of ['A', 'L']) assert.equal(L.applyMove(m, 'O', l).again, true);
    assert.deepEqual(L.applyMove(m, 'O', 'E'), { ok: true, outcome: 'win' }, 'O reveals the last letter of its own');
    assert.equal(E.hangmanCandidates(E.publicMini(m, 'X'), 'X').includes('APPLE'), true);
    // through the match: the bonus guess keeps the turn and locks the player to the square, as in Shared
    const st = raceMatch(E.makeRng('h-lock')); const k = hangAt(st); st.squares[k].mini = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
    const r = L.playMove(st, k, 'P'); assert.equal(r.ok, true); assert.equal(st.flash.kind, 'again'); assert.equal(st.turn, 'X'); assert.equal(st.lock, k);
    assert.deepEqual([st.flash.own, st.flash.letter], ['P', ''], 'a right letter rides as own alone: the header\'s "found" line names no letter');
    L.endFlash(st); assert.equal(L.playMove(st, k, 'Z').ok, true); assert.equal(st.done.next, 'O'); assert.deepEqual([st.done.own, st.done.letter], ['Z', 'Z']);
    assert.equal(E.raceFlashHide(st.done, st.squares[k].mini).own, undefined, 'the other phone never gets it');
    assert.equal(L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'), { shared: true }).race, undefined, 'two people on one phone: Shared');
    assert.ok(E.newMatch(E.makeRng('h-same'), { games: ['hangman'], vs: 'same' }).squares.every(q => !q.mini.race));
    assert.ok(E.newMatch(E.makeRng('h-cpu'), { games: ['hangman'], vs: 'cpu' }).squares.every(q => q.mini.race));
  } finally { raceOn(false); }
  assert.equal(L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple')).race, undefined, 'off: as ever');
});

test('hangman, race: the public view holds the shapes and one side\'s own part alone; hidden, the word is blanks alone; the record keeps each side\'s part for that side', () => {
  raceOn(true);
  try {
    const m = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
    L.applyMove(m, 'X', 'P'); L.applyMove(m, 'X', 'Z');
    const pub = E.publicMini(m);
    assert.equal(pub.word, undefined); assert.equal(pub.pattern, undefined); assert.equal(pub.len, 5); assert.deepEqual(pub.side, {});
    assert.deepEqual(pub.shape.X, { n: 2, wrong: 1, got: [false, true, true, false, false] }); assert.deepEqual(pub.shape.O, { n: 0, wrong: 0, got: [false, false, false, false, false] });
    const forO = E.publicMini(m, 'O');
    assert.deepEqual(Object.keys(forO.side), ['O']); assert.ok(!JSON.stringify(forO).includes('"P"') && !JSON.stringify(forO).includes('"Z"'), "X's letters are nowhere in O's view");
    const forX = E.publicMini(m, 'X');
    assert.deepEqual(forX.side.X.pattern, [null, 'P', 'P', null, null]); assert.equal(forX.side.O, undefined);
    const hidden = JSON.parse(JSON.stringify(m)); E.hideMini(hidden, 0, {});
    assert.equal(hidden.word, '_____', 'no letter of anyone\'s in the public word'); assert.equal(hidden.side, undefined); assert.equal(hidden.shape.X.wrong, 1);
    const st = raceMatch(E.makeRng('h-rec')); const k = hangAt(st);
    st.squares[k].mini = m; st.id = 'h1'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), ps = rec.state.squares[k].mini;
    assert.equal(ps.side, undefined); assert.equal(ps.word, '_____'); assert.equal(ps.shape.X.n, 2);
    assert.deepEqual(rec.sides.X[k].pattern, [null, 'P', 'P', null, null]); assert.deepEqual(rec.sides.O[k].letters, []);
    assert.ok(!JSON.stringify(rec.state).includes('APPLE'));
    const full = E.fullState(rec);
    assert.deepEqual(full.squares[k].mini.side, m.side); assert.equal(full.squares[k].mini.word, 'APPLE'); assert.equal(full.squares[k].mini.shape, undefined);
    assert.deepEqual(E.fullState(E.parseMatch(E.packMatch(rec))).squares[k].mini.side, m.side);
    const oneSide = E.fullState({ state: rec.state, secrets: rec.secrets, sides: { O: rec.sides.O } });
    assert.equal(oneSide.squares[k].mini.side.X, undefined); assert.deepEqual(oneSide.squares[k].mini.side.O, m.side.O);
  } finally { raceOn(false); }
});

test('hangman, race: an online move\'s entry is redacted for the other phone (no letter, no inputs), the blanks it filled and the wrong count alone; the mover\'s part reaches their side', () => {
  raceOn(true);
  try {
    const st = raceMatch(E.makeRng('h-online')); const k = hangAt(st); st.id = 'h2'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), word = rec.secrets[k].word, hitL = word[0], missL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(l => !word.includes(l));
    const r = E.applyOnlineMove(rec, 'X', k, hitL, E.makeRng('h-mv'), { rep: [[0, 'move', 'm=' + hitL]] });
    assert.ok(r.ok);
    const e = r.entries[0];
    assert.equal(e.kind, 'again'); assert.equal(e.m, undefined); assert.equal(e.letter, undefined); assert.equal(e.note, undefined); assert.equal(e.rep, undefined);
    assert.deepEqual(Object.keys(e.race).sort(), ['at', 'by', 'got', 'hit', 'n', 'wrong']); assert.equal(e.race.hit, true); assert.equal(e.race.wrong, 0); assert.ok(e.race.at.includes(0)); assert.equal(e.race.got[0], true);
    assert.equal(e.after.mini.side, undefined); assert.equal(e.after.mini.word, '_'.repeat(word.length)); assert.equal(e.after.mini.shape.X.n, 1);
    assert.ok(!JSON.stringify(r.rec.state).includes(`"${hitL}"`), 'the letter is nowhere in the public state');
    assert.equal(r.rec.sides.X[k].letters[0].l, hitL); assert.deepEqual(r.rec.sides.O[k].letters, []);
    const r2 = E.applyOnlineMove(r.rec, 'X', k, missL, E.makeRng('h-mv2'));
    assert.ok(r2.ok); assert.equal(r2.entries[0].race.hit, false); assert.equal(r2.entries[0].race.wrong, 1); assert.deepEqual(r2.entries[0].race.at, []);
    const r3 = E.applyOnlineMove(r2.rec, 'O', k, hitL, E.makeRng('h-mv3'));
    assert.ok(r3.ok, 'the same letter is open to O'); assert.equal(r3.rec.sides.O[k].letters.length, 1);
    raceOn(false);
    const st2 = raceMatch(E.makeRng('h-online')); const k2 = hangAt(st2); st2.id = 'h3'; st2.seq = 0; st2.recent = [];
    const e2 = E.applyOnlineMove(E.matchRecord(st2), 'X', k2, hitL, E.makeRng('h-mv'), { rep: [[0, 'move', 'm=' + hitL]] }).entries[0];
    assert.equal(e2.m, hitL); assert.ok(e2.rep); assert.equal(e2.race, undefined);
  } finally { raceOn(false); }
});

test('hangman, race: the computer plays from its own part alone and reveals the word (Normal and Hard); the flash as the other side sees it', () => {
  raceOn(true);
  try {
    for (const level of ['normal', 'hard']) {
      for (let g = 0; g < 8; g++) {
        const rng = E.makeRng('h-ai-' + level + g), m = L.newMini('hangman', rng);
        L.applyMove(m, 'X', m.word[0]);                                        // X's own letter: it must not help O
        let r, n = 0;
        do {
          const pm = E.publicMini(m, 'O');
          assert.equal(pm.side.X, undefined, "the computer never sees X's part");
          const b = E.localBest(pm, 'O', rng, E.STYLE0, level === 'hard' ? { level: 'hard', until: null } : {});
          assert.equal(b.shared, false);
          r = L.applyMove(m, 'O', b.move, rng); assert.equal(r.ok, true, `${level}: a legal letter (${b.move}: ${r.reason})`);
          n++;
        } while (r.outcome !== 'win' && n < 26);
        assert.equal(r.outcome, 'win', `${level}: the word revealed`); assert.equal(r.winner, undefined);
        assert.ok(n <= 20, `${level}: ${n} letters`);
      }
    }
    const m = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple')); L.applyMove(m, 'O', 'P'); L.applyMove(m, 'O', 'L');
    const pm = E.publicMini(m, 'X');
    assert.ok(E.needsOf(pm, 'X') > E.needsOf(pm, 'O'), 'O, three blanks filled, is reckoned nearer from its shape alone');
    const f = { kind: 'again', by: 'O', next: 'O', square: 0, type: 'hangman', note: 'hit', letter: 'L', m: 'L', rep: [[0, 'move', 'm=L']] };
    const h = E.raceFlashHide(f, m);
    assert.deepEqual(Object.keys(h).sort(), ['by', 'kind', 'next', 'race', 'square', 'type']); assert.deepEqual(h.race, { by: 'O', hit: true, at: [3], n: 2, wrong: 0, got: [false, true, true, true, false] });
    const st = raceMatch(E.makeRng('h-stats')); const k = hangAt(st); st.squares[k].mini = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
    for (const l of ['A', 'P', 'L']) L.endFlash(st, L.playMove(st, k, l));
    L.playMove(st, k, 'E'); assert.equal(st.squares[k].owner, 'X'); assert.equal(st.sqlog[0].race, 1);
  } finally { raceOn(false); }
});
