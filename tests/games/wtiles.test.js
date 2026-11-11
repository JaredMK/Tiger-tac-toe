'use strict';
// Word Tiles (November 2026): its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/wtiles/rules.js');
const A = require('../../src/games/wtiles/ai.js');

const empty = () => new Array(49).fill(null);
const rc = (r, c) => r * 7 + c;
// A square laid out by hand for X: a board, a rack and a bag.
function laid(board, rack, bag) {
  const m = E.newMini('wtiles', E.makeRng('wt-lay'));
  m.board.X = board.slice(); m.rack.X = rack.split(''); if (bag) m.bag.X = bag.split('');
  return m;
}

test('wtiles: the word list: ENABLE words of 2 to 7 letters, the offensive ones left out', () => {
  const { set } = R.wtDict();
  assert.ok(set.size > 50000 && set.size < 55000, `${set.size} words`);
  for (const w of ['CAT', 'TILES', 'NIGGLE', 'SPICY', 'AA', 'QUIZ']) assert.ok(R.wtIsWord(w), w);
  for (const w of ['FUCK', 'CUNT', 'SHIT', 'SLUT', 'WHORE', 'FAGGOT', 'NIGGER', 'BITCH', 'RAPIST', 'XYZZY', 'DOGHOUSES']) assert.ok(!R.wtIsWord(w), w);
  assert.ok([...set].every(w => /^[A-Z]{2,7}$/.test(w)));
});

test('wtiles: the first word goes through the centre; one row or column, no gaps; every word made must be a word; the premium squares score', () => {
  const b = empty(), rack = 'CATSXYZ'.split('');
  assert.equal(R.wtCheck(b, rack, [[rc(0, 0), 'C'], [rc(0, 1), 'A'], [rc(0, 2), 'T']]).reason, 'centre');
  assert.equal(R.wtCheck(b, rack, [[rc(3, 2), 'C'], [rc(4, 3), 'A']]).reason, 'line');
  assert.equal(R.wtCheck(b, rack, [[rc(3, 1), 'C'], [rc(3, 3), 'A'], [rc(3, 4), 'T']]).reason, 'gap');
  assert.deepEqual([R.wtCheck(b, rack, [[rc(3, 3), 'X'], [rc(3, 4), 'Z']]).reason, R.wtCheck(b, rack, [[rc(3, 3), 'X'], [rc(3, 4), 'Z']]).w], ['word', 'XZ']);
  assert.equal(R.wtCheck(b, rack, [[rc(3, 3), 'C'], [rc(3, 3), 'A']]).ok, false, 'never two tiles on one square');
  assert.equal(R.wtCheck(b, rack, [[rc(3, 3), 'Q']]).ok, false, 'never a tile the rack has not');
  // CAT across the centre (a double word): C3 + A1 + T1 = 5, doubled = 10
  const cat = R.wtCheck(b, rack, [[rc(3, 2), 'C'], [rc(3, 3), 'A'], [rc(3, 4), 'T']]);
  assert.deepEqual([cat.ok, cat.score, cat.words[0].w], [true, 10, 'CAT']);
  // CATS from (3,0): the double letter at (3,0) doubles the C: 6 + 1 + 1 + 1 = 9, the centre's double word: 18
  assert.equal(R.wtCheck(b, rack, [[rc(3, 0), 'C'], [rc(3, 1), 'A'], [rc(3, 2), 'T'], [rc(3, 3), 'S']]).score, 18);
});

test('wtiles: later words join on; the words across a new tile count and must be words; one tile can make a word', () => {
  const b = empty(); b[rc(3, 2)] = 'C'; b[rc(3, 3)] = 'A'; b[rc(3, 4)] = 'T';
  const rack = 'SOEDRTH'.split('');
  assert.equal(R.wtCheck(b, rack, [[rc(0, 0), 'D'], [rc(0, 1), 'O']]).reason, 'connect');
  // S at the end: CATS (one tile, across)
  const s = R.wtCheck(b, rack, [[rc(3, 5), 'S']]);
  assert.deepEqual([s.ok, s.words.map(w => w.w)], [true, ['CATS']]);
  // HOT down through the T of CAT: H at (1,4), O at (2,4) — (1,4) is plain, (2,4) a triple letter: H4 + O3 + T1 = 8
  const hot = R.wtCheck(b, rack, [[rc(1, 4), 'H'], [rc(2, 4), 'O']]);
  assert.deepEqual([hot.ok, hot.words[0].w, hot.score], [true, 'HOT', 8]);
  // a tile under the A making AD down and a non-word across with nothing: DE under A? D at (4,3): AD down; across (4,2)? nothing
  const ad = R.wtCheck(b, rack, [[rc(4, 3), 'D']]);
  assert.deepEqual([ad.ok, ad.words.map(w => w.w)], [true, ['AD']]);
  // a word whose cross word is no word is refused
  const bad = R.wtCheck(b, rack, [[rc(4, 2), 'H'], [rc(4, 3), 'O'], [rc(4, 4), 'T']]);   // HOT under CAT: CH, AO, TT are no words
  assert.equal(bad.ok, false);
});

test('wtiles: a move lays the word, scores it, refills the rack from the hidden bag (a fresh one when empty); swap puts the rack back; the bag never public', () => {
  const m = laid(empty(), 'CATSXYZ', 'EE');
  const r = E.applyMove(m, 'X', [[rc(3, 2), 'C'], [rc(3, 3), 'A'], [rc(3, 4), 'T']], E.makeRng('a'));
  assert.ok(r.ok); assert.equal(m.score.X, 10); assert.equal(m.rack.X.length, 7);
  assert.deepEqual(m.rack.X.slice(0, 4), ['S', 'X', 'Y', 'Z']); assert.ok(m.bag.X.length > 40, 'the bag ran out: a fresh one');
  assert.equal(m.board.X[rc(3, 3)], 'A');
  assert.equal(E.applyMove(m, 'X', [[rc(0, 0), 'S'], [rc(0, 1), 'X']], E.makeRng('b')).ok, false, 'a word that does not join is refused');
  const before = m.rack.X.slice().sort().join(''), n = m.bag.X.length;
  const sw = E.applyMove(m, 'X', 'swap', E.makeRng('c'));
  assert.deepEqual([sw.ok, sw.note, m.rack.X.length, m.bag.X.length, m.score.X], [true, 'swap', 7, n, 10]);
  assert.notEqual(m.rack.X.slice().sort().join('') + m.bag.X.join(''), before, '(the rack drawn again)');
  const pub = E.publicMini(m);
  assert.ok(!('bag' in pub)); assert.equal(pub.bagN.X, m.bag.X.length);
  assert.deepEqual(R.secret(m).bag.X, m.bag.X);
});

test('wtiles: first to the target wins; "Go again on success" on keeps the turn after a word', () => {
  E.setTune('wtiles', { target: 15 });
  try {
    const m = laid(empty(), 'CATSXYZ');
    m.score.X = 6;
    const r = E.applyMove(m, 'X', [[rc(3, 2), 'C'], [rc(3, 3), 'A'], [rc(3, 4), 'T']], E.makeRng('w'));
    assert.deepEqual([r.outcome, m.score.X], ['win', 16]);
  } finally { E.setTune('wtiles', null); }
  E.setTune('wtiles', { again: 'on' });
  try {
    const m = laid(empty(), 'CATSXYZ');
    const r = E.applyMove(m, 'X', [[rc(3, 2), 'C'], [rc(3, 3), 'A'], [rc(3, 4), 'T']], E.makeRng('g'));
    assert.equal(r.again, true);
    assert.equal(E.applyMove(m, 'X', 'swap', E.makeRng('h')).again, undefined, 'a swap never keeps it');
  } finally { E.setTune('wtiles', null); }
});

test('wtiles: the computer: every word it finds is legal; Hard the best-scoring one; no word, a swap; quickly', () => {
  const m = laid(empty(), 'RETAINS');
  const all = R.wtMoves(m.board.X, m.rack.X);
  assert.ok(all.length > 100);
  for (const x of all.slice(0, 200)) assert.ok(R.wtCheck(m.board.X, m.rack.X, x.t).ok);
  const top = Math.max(...all.map(x => x.score)), t0 = Date.now();
  const h = A.best(E.publicMini(m), 'X', E.makeRng('hd'), {}, { level: 'hard', until: null });
  assert.ok(Date.now() - t0 < 400, 'Hard is quick');
  assert.equal(R.wtCheck(m.board.X, m.rack.X, h.move).score, top, 'Hard plays the best-scoring word');
  for (const lv of ['easy', 'normal']) { const b = A.best(E.publicMini(m), 'X', E.makeRng(lv), {}, { level: lv, until: null }); assert.ok(R.wtCheck(m.board.X, m.rack.X, b.move).ok, lv); }
  const stuck = laid(empty(), 'QQQQQQQ');
  assert.equal(A.best(E.publicMini(stuck), 'X', E.makeRng('s'), {}, { level: 'hard', until: null }).move, 'swap');
  assert.ok(A.needs(E.publicMini(m), 'X') > 1);
});

test('wtiles: whole squares between the computers end with a winner; the flash carries the word; a timeout plays nothing', () => {
  for (let g = 0; g < 12; g++) {
    const rng = E.makeRng('wt-whole' + g), m = E.newMini('wtiles', rng);
    let p = 'X', done = false;
    for (let k = 0; k < 80 && !done; k++) {
      const r = E.applyMove(m, p, A.best(E.publicMini(m), p, rng, {}, { level: 'normal', until: null }).move, rng);
      assert.ok(r.ok, r.reason); done = r.outcome === 'win'; p = p === 'X' ? 'O' : 'X';
    }
    assert.ok(done, 'a winner');
  }
  const st = E.newMatch(E.makeRng('wt-st'), { games: ['wtiles'] }), p = st.turn, mini = st.squares[4].mini;
  const mv = A.best(E.publicMini(mini), p, E.makeRng('m'), {}, { level: 'hard', until: null }).move;
  assert.ok(E.playMove(st, 4, mv, E.makeRng('pm')).ok);
  assert.equal(st.flash.wt.kind, 'word'); assert.ok(st.flash.wt.pts > 0); assert.ok(E.playMs(st.flash) >= R.wtTimes(st.flash.wt).end);
  assert.equal(R.timeoutClose, undefined, 'a draft is the phone\'s own: nothing of a move is under way on the square to close');
});
