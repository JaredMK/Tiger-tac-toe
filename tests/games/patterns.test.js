'use strict';
// Patterns: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));

/* ===================================== Patterns ===================================== */
test('patterns: 1,000 puzzles, every one with exactly one option that fits its rule and no two options alike', () => {
  const rng = E.makeRng('pat-1000'), kinds = {}, fams = {};
  let last = null, middle = 0;
  for (let k = 0; k < 1000; k++) {
    const g = E.patPuzzle(rng, last);
    assert.ok(g, 'a puzzle every time');
    last = g.puz.fam;
    const { puz, answer } = g;
    assert.equal(puz.opts.length, 4, 'four options');
    assert.equal(puz.seq.filter(x => x == null).length, 1, 'one gap');
    assert.equal(new Set(puz.opts.map(E.patKey)).size, 4, `no duplicate options: ${g.rule}`);
    assert.deepEqual(E.patFitting(puz, puz.opts), [answer], `exactly one fits: ${g.rule} ${JSON.stringify(puz)}`);
    if (puz.seq.indexOf(null) !== puz.seq.length - 1) middle++;
    kinds[g.rule.replace(' (gap)', '')] = 1; fams[puz.fam] = (fams[puz.fam] || 0) + 1;
  }
  for (const k of ['add', 'subtract', 'multiply', 'alternate', 'squares', 'fibonacci', 'two sequences', 'turn', 'sides', 'size', 'colour', 'fill', 'dots add', 'dots double', 'dots triangle', 'dots +2 -1']) assert.ok(kinds[k], `the ${k} kind comes up`);
  assert.ok(fams.num > 300 && fams.shape > 300 && fams.dots > 120, `every family often: ${JSON.stringify(fams)}`);
  assert.ok(middle > 150 && middle < 350, `missing-middle puzzles about a quarter of the time (${middle})`);
});
test('patterns: a wrong pick is crossed out for both and the puzzle stays; the right one scores and a new puzzle comes; 3 right wins', () => {
  const rng = E.makeRng('pat-rules'), m = E.newMini('patterns', rng), first = JSON.stringify(m.puz);
  const wrong = [0, 1, 2, 3].filter(k => k !== m.answer);
  let r = E.applyMove(m, 'X', wrong[0], rng);
  assert.equal(r.ok, true); assert.equal(r.outcome, 'continue'); assert.equal(r.note, 'wrong');
  assert.deepEqual(m.crossed, [wrong[0]]); assert.equal(JSON.stringify(m.puz), first, 'the same puzzle');
  assert.equal('right' in m.last, false, 'a wrong pick never carries the answer');
  assert.equal(E.applyMove(m, 'O', wrong[0], rng).reason, 'crossed', 'a crossed-out option cannot be picked again');
  r = E.applyMove(m, 'O', wrong[1], rng);
  assert.deepEqual(m.crossed, [wrong[0], wrong[1]], 'crossed out for both');
  r = E.applyMove(m, 'X', m.answer, rng);
  assert.equal(r.note, 'right'); assert.equal(m.right.X, 1); assert.deepEqual(m.crossed, []);
  assert.notEqual(JSON.stringify(m.puz), first, 'a new puzzle for the next turn');
  for (const bad of [-1, 4, 1.5, 'a', null]) assert.equal(E.applyMove(m, 'O', bad, rng).ok, false, `refused: ${bad}`);
  E.applyMove(m, 'X', m.answer, rng);
  r = E.applyMove(m, 'X', m.answer, rng);
  assert.equal(r.outcome, 'win', 'the third right answer wins');
});
test('patterns: online the answer stays on the server; a timeout is one wrong pick, never the answer', () => {
  const rng = E.makeRng('pat-secret');
  for (let k = 0; k < 200; k++) {
    const m = E.newMini('patterns', rng), hidden = JSON.parse(JSON.stringify(m));
    E.hideMini(hidden);
    assert.equal('answer' in hidden, false); assert.equal('rule' in hidden, false);
    assert.equal(E.applyMove(hidden, 'X', 0, rng).reason, 'secret', 'a phone without the answer cannot judge');
    assert.deepEqual(E.secretOf(m), { answer: m.answer, rule: m.rule });
    assert.equal(E.randomLegalMove(m, 'X', rng), 'auto');
    const r = E.applyMove(m, 'X', 'auto', rng);
    assert.equal(r.note, 'wrong'); assert.equal(m.crossed.length, 1); assert.notEqual(m.crossed[0], m.answer);
  }
  // the flash for a wrong pick: no answer in it
  const st = E.newMatch(rng, { games: only('patterns') }), i = 4, mini = st.squares[i].mini;
  E.playMove(st, i, [0, 1, 2, 3].find(k => k !== mini.answer), rng);
  assert.equal('right' in st.flash.pat, false); assert.equal(st.flash.pat.correct, false);
});
test('patterns: the computer is right about 60% of the time and never picks a crossed-out option', () => {
  const rng = E.makeRng('pat-ai');
  let right = 0, n = 0;
  for (let k = 0; k < 3000; k++) {
    const m = E.newMini('patterns', rng);
    if (k % 3) E.applyMove(m, 'O', [0, 1, 2, 3].find(j => j !== m.answer), rng);
    const b = E.localBest(E.publicMini(m, 'X'), 'X', rng);
    assert.ok(!(m.crossed || []).includes(b.move), 'never a crossed-out option');
    n++; if (b.move === m.answer) right++;
  }
  assert.ok(Math.abs(right / n - 0.6) < 0.035, `right ${(100 * right / n).toFixed(1)}%`);
});

/* ---------- the admin's Mini-game Settings ---------- */
test('patterns: the admin\'s settings: two to win, dot puzzles only with the gap in the middle, and the computer always right', () => {
  E.setTune('patterns', { goal: 2, num: 0, shape: 0, dots: 100, mid: 100, right: 100 });
  try {
    const rng = E.makeRng('pat-tune'), m = E.newMini('patterns', rng);
    assert.equal(m.puz.fam, 'dots'); assert.notEqual(m.puz.seq.indexOf(null), m.puz.seq.length - 1, 'the gap in the middle');
    assert.equal(E.applyMove(m, 'X', m.answer, rng).outcome, 'continue');
    assert.equal(m.puz.fam, 'dots');
    const b = E.localBest(E.publicMini(m), 'X', rng);
    assert.equal(b.move, m.answer, 'right every time');
    assert.equal(E.applyMove(m, 'X', m.answer, rng).outcome, 'win', 'two right wins');
  } finally { E.setTune('patterns', null); }
  assert.equal(E.newMini('patterns', E.makeRng('pat-tune')).tune, undefined);
});

/* ===================================== Race mode (core/race.js) ===================================== */
// The square's one puzzle is the shared target; each player's picks are their own card (mini.side[p]: crossed, last);
// the other side sees only wrong tries made and right or not; the first right pick takes the square.
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const raceOn = on => E.setTune('patterns', on ? { mode: 'race' } : null);
const raceMini = seed => { raceOn(true); try { return E.newMini('patterns', lcg(seed)); } finally { raceOn(false); } };

test('patterns race: dealt by the setting; one puzzle for both, each side its own card; a wrong pick crosses out on the picker\'s card alone; the first right pick wins', () => {
  const m = raceMini(401), first = JSON.stringify(m.puz);
  assert.equal(m.race, true); assert.deepEqual(m.side, { X: { crossed: [], last: null }, O: { crossed: [], last: null } });
  assert.equal(m.crossed, undefined, 'no shared cross-outs'); assert.equal(m.last, undefined); assert.deepEqual(m.tune, { mode: 'race' });
  const right = m.answer, wrong = [0, 1, 2, 3].filter(x => x !== right);
  assert.deepEqual(E.applyMove(m, 'X', wrong[0], lcg(1)), { ok: true, outcome: 'continue', note: 'wrong' });
  assert.deepEqual(m.side.X.crossed, [wrong[0]]); assert.deepEqual(m.side.O.crossed, [], "O's card is untouched"); assert.equal('right' in m.side.X.last, false);
  assert.equal(E.applyMove(m, 'O', wrong[0], lcg(1)).ok, true, 'the same option is open to O');
  assert.equal(E.applyMove(m, 'X', wrong[0], lcg(1)).reason, 'crossed');
  assert.equal(JSON.stringify(m.puz), first, 'the same puzzle');
  assert.deepEqual(E.applyMove(m, 'O', right, lcg(1)), { ok: true, outcome: 'win', note: 'right' }, 'the first right pick takes the square');
  assert.equal(JSON.stringify(m.puz), first, 'the puzzle stays for the review'); assert.equal(m.side.O.last.right, right);
  assert.deepEqual(E.raceShape(m, 'X'), { n: 1, right: false }); assert.deepEqual(E.raceShape(m, 'O'), { n: 1, right: true });
  const m2 = raceMini(402);
  assert.equal(E.applyMove(m2, 'X', 'auto', lcg(2)).note, 'wrong'); assert.equal(m2.side.X.crossed.length, 1); assert.equal(m2.side.X.last.auto, true);
  assert.equal(E.newMini('patterns', lcg(3), { shared: true }).race, undefined, 'two people on one phone: Shared');
  assert.equal(E.newMini('patterns', lcg(3)).race, undefined, 'off: as ever');
});

test('patterns race: the public view shows the shapes and one side\'s own card alone; the record keeps each side\'s card for that side and a move\'s entry is redacted', () => {
  raceOn(true);
  try {
    const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only('patterns'), timer: 60 }, lcg(411), 'ptq1');
    const pub = rec.state.squares[0].mini;
    assert.equal(pub.race, true); assert.equal(pub.side, undefined); assert.equal(pub.answer, undefined); assert.ok(pub.puz, 'the puzzle is the shared target, in the open');
    assert.deepEqual(pub.shape, { X: { n: 0, right: false }, O: { n: 0, right: false } });
    assert.deepEqual(rec.sides.X[0], { crossed: [], last: null });
    const right = rec.secrets[0].answer, wrong = (right + 1) % 4;
    let r = E.applyOnlineMove(rec, 'X', 0, wrong, lcg(412), { rep: [[0, 'move', 'm=' + wrong]] });
    assert.equal(r.ok, true);
    const e = r.entries[0];
    assert.equal(e.m, undefined); assert.equal(e.pat, undefined); assert.equal(e.rep, undefined); assert.equal(e.note, undefined);
    assert.deepEqual(e.race, { by: 'X', correct: false, n: 1, right: false });
    assert.equal(e.after.mini.side, undefined); assert.deepEqual(e.after.mini.shape.X, { n: 1, right: false });
    assert.ok(!JSON.stringify(r.rec.state).includes('"picked"'));
    assert.deepEqual(r.rec.sides.X[0].crossed, [wrong]); assert.deepEqual(r.rec.sides.O[0].crossed, []);
    const full = E.fullState(r.rec);
    const forX = E.publicMini(full.squares[0].mini, 'X'), forO = E.publicMini(full.squares[0].mini, 'O');
    assert.deepEqual(Object.keys(forX.side), ['X']); assert.equal(forO.side.X, undefined); assert.equal(forO.shape.X.n, 1); assert.equal(forX.crossed, undefined);
    assert.deepEqual(E.fullState(E.parseMatch(E.packMatch(r.rec))).squares[0].mini.side, full.squares[0].mini.side);
    r = E.applyOnlineMove(r.rec, 'O', 0, wrong, lcg(413));
    assert.equal(r.ok, true, "the same option is open to O (their own card)");
    r = E.applyOnlineMove(r.rec, 'X', 0, right, lcg(414));
    assert.equal(r.entries[0].kind, 'claim'); assert.equal(r.entries[0].winner, 'X'); assert.deepEqual(r.entries[0].race, { by: 'X', correct: true, n: 1, right: true });
    assert.ok(r.rec.state.squares[0].mini.side.O, 'the finished square shows both cards');
  } finally { raceOn(false); }
});

test('patterns race: the computer plays from its own card alone and finishes the square; Shared is untouched', () => {
  const m = raceMini(421), rng = lcg(5);
  let won = false;
  for (let i = 0; i < 4 && !won; i++) {
    const pm = E.publicMini(m, 'O');
    assert.equal(pm.side.X, undefined); assert.equal(pm.crossed, undefined);
    const mv = E.localBest(pm, 'O', rng).move;
    assert.ok(!m.side.O.crossed.includes(mv), 'never one it crossed out');
    won = E.applyMove(m, 'O', mv, rng).outcome === 'win';
  }
  assert.ok(won, 'four picks at most');
  const m2 = raceMini(422); E.applyMove(m2, 'X', 'auto', lcg(6)); E.applyMove(m2, 'X', 'auto', lcg(7));
  const pm = E.publicMini(m2, 'O');
  assert.ok(E.needsOf(pm, 'X') < E.needsOf(pm, 'O'), "two wrong tries down, X's shape says they need less");
  const sh = E.newMini('patterns', lcg(423)), first = JSON.stringify(sh.puz);
  assert.equal(E.applyMove(sh, 'X', sh.answer, lcg(8)).note, 'right'); assert.equal(sh.right.X, 1); assert.notEqual(JSON.stringify(sh.puz), first, 'a new puzzle, as ever'); assert.deepEqual(sh.crossed, []);
});
