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

// ================================ Race mode v2 (core/race.js, rv 2) ================================
// Each player their own word, the same length and as near as the list allows in distinct letters (mini.tg, the square's
// secret); their own letters and revealed pattern in mini.side[p] (open to both); no wrong-letter limit; a right letter
// goes again; the first to reveal their whole word takes the square.
const R = require('../../src/games/hangman/rules.js');
const raceOn = on => E.setTune('hangman', on ? { mode: 'race' } : null);
const hangAt = st => st.squares.findIndex(q => q.mini.type === 'hangman');
function raceMatch(rng) { return E.newMatch(rng, { games: ['hangman', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], vs: 'cpu' }); }
const ALL = [...new Set(L.WORDS_HANG.map(w => w.toUpperCase()))], uniq = w => new Set(w).size;
const words = (m, X, O) => { m.tg = { X, O }; m.len = X.length; m.side = { X: { letters: [], pattern: new Array(X.length).fill(null) }, O: { letters: [], pattern: new Array(X.length).fill(null) } }; return m; };

test('hangman, race v2: two different words of one length, as near in distinct letters as the list allows; each side its own letters, judged against its own word; two on one phone play Shared', () => {
  raceOn(true);
  try {
    for (let k = 0; k < 200; k++) {
      const m = L.newMini('hangman', E.makeRng('hrv2-' + k)), { X: a, O: b } = m.tg;
      assert.equal(m.race, true); assert.equal(m.rv, 2); assert.equal(m.word, undefined); assert.equal(m.len, a.length);
      assert.notEqual(a, b, 'two different words'); assert.equal(a.length, b.length, 'the same length');
      assert.ok(ALL.includes(a) && ALL.includes(b));
      const best = Math.min(...ALL.filter(w => w.length === a.length && w !== a).map(w => Math.abs(uniq(w) - uniq(a))));
      const bestB = Math.min(...ALL.filter(w => w.length === b.length && w !== b).map(w => Math.abs(uniq(w) - uniq(b))));
      assert.ok(Math.abs(uniq(a) - uniq(b)) === best || Math.abs(uniq(a) - uniq(b)) === bestB, `${a}/${b}: as near in distinct letters as the list allows`);
      for (const p of ['X', 'O']) assert.deepEqual(m.side[p], { letters: [], pattern: new Array(a.length).fill(null) });
    }
    const m = words(L.newMini('hangman', E.makeRng('hrv2-a')), 'APPLE', 'MELON');
    assert.deepEqual(L.applyMove(m, 'X', 'P'), { ok: true, outcome: 'continue', note: 'hit', again: true });
    assert.deepEqual(m.side.X.pattern, [null, 'P', 'P', null, null]); assert.deepEqual(m.side.O.pattern, [null, null, null, null, null], "O's part is untouched");
    assert.deepEqual(L.applyMove(m, 'O', 'P'), { ok: true, outcome: 'continue', note: 'miss' }, "against O's own word");
    assert.equal(L.applyMove(m, 'X', 'P').reason, 'taken');
    for (const l of 'MELO') assert.equal(L.applyMove(m, 'O', l).again, true);
    assert.deepEqual(L.applyMove(m, 'O', 'N'), { ok: true, outcome: 'win' }, 'O reveals the last letter of its own word');
    assert.deepEqual(E.raceShape(m, 'O'), { n: 6, wrong: 1, got: 5 });
    assert.equal(L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'), { shared: true }).race, undefined, 'two people on one phone: Shared');
    assert.ok(E.newMatch(E.makeRng('h-same'), { games: ['hangman'], vs: 'same' }).squares.every(q => !q.mini.race));
    assert.ok(E.newMatch(E.makeRng('h-cpu'), { games: ['hangman'], vs: 'cpu' }).squares.every(q => q.mini.race && q.mini.rv === 2));
  } finally { raceOn(false); }
  assert.equal(L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple')).race, undefined, 'off: as ever');
});

test('hangman, race v2: no wrong-letter limit (every wrong letter of the alphabet, and on); a right letter keeps the turn through the match', () => {
  raceOn(true);
  try {
    const m = words(L.newMini('hangman', E.makeRng('hrv2-cap')), 'APPLE', 'MELON');
    const wrong = 'BCDFGHIJKMNOQRSTUVWXYZ'.split('');
    for (const l of wrong) assert.deepEqual(L.applyMove(m, 'X', l), { ok: true, outcome: 'continue', note: 'miss' });
    for (const l of 'APL') assert.equal(L.applyMove(m, 'X', l).again, true);
    assert.deepEqual(L.applyMove(m, 'X', 'E'), { ok: true, outcome: 'win' }, `found after ${wrong.length} wrong letters`);
    const st = raceMatch(E.makeRng('h-lock')), k = hangAt(st);
    const me = st.turn, w = st.squares[k].mini.tg[me];
    const r = L.playMove(st, k, w[0]); assert.equal(r.ok, true); assert.equal(st.flash.kind, 'again'); assert.equal(st.turn, me); assert.equal(st.lock, k);
    assert.equal(st.flash.letter, w[0], 'the letter rides the flash: open to both');
  } finally { raceOn(false); }
});

test('hangman, race v2: the words never reach the public view, the record\'s state or a move\'s entry while the square is open; both parts do; claimed, the words are public', () => {
  raceOn(true);
  try {
    const st = raceMatch(E.makeRng('h-rec')), k = hangAt(st), m = st.squares[k].mini, { X: wx, O: wo } = m.tg;
    const miss = 'QZXJVKWYBFGHMP'.split('').find(l => !wx.includes(l) && !wo.includes(l));
    L.applyMove(m, 'X', wx[1]); L.applyMove(m, 'O', miss);
    for (const side of [undefined, 'X', 'O']) {
      const pm = E.publicMini(m, side), js = JSON.stringify(pm);
      assert.ok(!js.includes(wx) && !js.includes(wo) && !js.includes('"tg"'), 'no word in the view');
      assert.equal(pm.len, wx.length); assert.ok(pm.side.X.pattern.includes(wx[1]), "X's revealed letters are open"); assert.equal(pm.side.O.letters[0].l, miss);
    }
    st.id = 'h1'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), js = JSON.stringify(rec.state);
    assert.ok(!js.includes(wx) && !js.includes(wo) && !js.includes('"tg"'), "the record's state holds no word");
    assert.deepEqual(rec.secrets[k], { tg: m.tg }); assert.deepEqual(rec.state.squares[k].mini.side, m.side);
    const full = E.fullState(E.parseMatch(E.packMatch(rec)));
    assert.deepEqual(full.squares[k].mini.tg, m.tg); assert.deepEqual(full.squares[k].mini.side, m.side); assert.equal(full.squares[k].mini.rv, 2, 'kept, not dealt again');
    const r = E.applyOnlineMove(rec, 'X', k, wx.split('').find(l => !m.side.X.letters.some(x => x.l === l)), E.makeRng('h-mv'));
    assert.ok(r.ok); const ej = JSON.stringify(r.entries) + JSON.stringify(r.rec.state);
    assert.ok(!ej.includes(wx) && !ej.includes(wo), 'no word in the entry or the state');
    // X misses (the turn passes), then O reveals its whole word: claimed, the words public
    const xMiss = 'QZXJVKWYBFGHMPUD'.split('').find(l => !wx.includes(l));
    const rm = E.applyOnlineMove(r.rec, 'X', k, xMiss, E.makeRng('h-mvm')); assert.ok(rm.ok, rm.reason);
    let rec2 = rm.rec;
    for (const l of [...new Set(wo)]) { const rr = E.applyOnlineMove(rec2, 'O', k, l, E.makeRng('h-' + l)); if (rr.ok) rec2 = rr.rec; }
    assert.equal(rec2.state.squares[k].owner, 'O'); assert.deepEqual(rec2.state.squares[k].mini.tg, m.tg, 'revealed once the square ends');
  } finally { raceOn(false); }
});

test('hangman, race v2: the computer reveals its own word from the public view alone at every level; Hard in fewer turns than Normal, quickly; needs reads each side\'s own pattern', () => {
  raceOn(true);
  try {
    const turns = {};
    for (const level of ['easy', 'normal', 'hard']) {
      let total = 0, worst = 0;
      for (let g = 0; g < (level === 'easy' ? 40 : 200); g++) {
        const rng = E.makeRng(`h-ai-${level}-${g}`), m = L.newMini('hangman', rng);
        L.applyMove(m, 'X', m.tg.X[0]);                                   // X's own letter: it must not help O
        let r, n = 0, t = 1;
        do {
          const pm = E.publicMini(m, 'O');
          assert.equal(pm.tg, undefined, 'never the word');
          const t0 = performance.now(), b = E.localBest(pm, 'O', rng, E.STYLE0, { level, until: null }); worst = Math.max(worst, performance.now() - t0);
          if (level === 'easy' && rng() < 0.3) b.move = E.randomLegalMove(m, 'O', rng);   // (Easy's careless moves)
          assert.equal(b.shared, false);
          r = L.applyMove(m, 'O', b.move, rng); assert.equal(r.ok, true, `${level}: ${b.move}: ${r.reason}`); n++;
          if (!r.again && r.outcome !== 'win') t++;
        } while (r.outcome !== 'win' && n < 30);
        assert.equal(r.outcome, 'win'); assert.equal(r.winner, undefined, `${level}: its own word revealed`);
        total += t;
      }
      turns[level] = total / (level === 'easy' ? 40 : 200);
      if (level === 'hard') assert.ok(worst < 200, `Hard: ${worst.toFixed(1)} ms at worst`);
    }
    assert.ok(turns.hard < turns.normal, `turns: ${JSON.stringify(turns)}`);
    const m = words(L.newMini('hangman', E.makeRng('h-need')), 'APPLE', 'MELON');
    for (const l of 'MEL') L.applyMove(m, 'O', l);
    const pm = E.publicMini(m, 'X');
    assert.ok(E.needsOf(pm, 'O') < E.needsOf(pm, 'X'), 'O, three blanks filled, is reckoned nearer');
    assert.deepEqual(E.hangmanCandidates(pm, 'O').includes('MELON'), true);
    const st = raceMatch(E.makeRng('h-stats')), k = hangAt(st), me = st.turn, w = st.squares[k].mini.tg[me];
    for (const l of [...new Set(w)]) { const rr = L.playMove(st, k, l); assert.ok(rr.ok, rr.reason); L.endFlash(st); }
    assert.equal(st.squares[k].owner, me, 'its own word revealed: its square'); assert.equal(st.sqlog[0].race, 1);
  } finally { raceOn(false); }
});

// ============================== Hard: the solved opening (November 2026) ==============================
test('hangman, Hard: a fresh word opens with the solved game\'s letter for its length (tests/sim/hangman-table.js); never a letter in no candidate', () => {
  const open = { 5: 'L', 6: 'E', 7: 'N' };
  for (const len of [5, 6, 7]) {
    const word = ALL.find(w => w.length === len), m = { type: 'hangman', word, letters: [] };
    const b = L.localBest(L.publicMini(m), 'X', lcg(2), {}, HARD);
    assert.equal(b.move, open[len], `${len} letters`);
    // a few letters on: still a letter some candidate holds
    L.applyMove(m, 'X', 'Q'); L.applyMove(m, 'O', 'Z');
    const pm = L.publicMini(m), c = L.hangmanCandidates(pm), h = L.localBest(pm, 'X', lcg(3), {}, HARD);
    assert.ok(c.some(w => w.includes(h.move)), `${h.move} is in a candidate`);
  }
});
