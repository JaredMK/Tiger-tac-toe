'use strict';
// Letter Hive (December 2026): its puzzles, its rules and its computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/hive/rules.js');
const A = require('../../src/games/hive/ai.js');
const M = require('../../src/games/hive/meta.js');
const { HIVE_PUZZLES } = require('../../src/games/hive/puzzles.js');
const B = require('../../src/core/badwords.js');

const other = p => (p === 'X' ? 'O' : 'X');
const fresh = (seed, pz) => { const m = E.newMini('hive', E.makeRng(seed)); if (pz != null) m.pz = pz; return m; };
const by = (pz, n, full) => pz.words.filter(w => w.length === n && pz.full.includes(w) === !!full);

test('hive: Admin only, brain, a timed burst, a 60 s turn, held out of Find Match; its settings', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.realTime, M.turnSecs], ['admin', 'brain', '1.30.0', false, true, 60]);
  assert.ok(E.FIND_MATCH_HOLD.includes('hive'), 'what a phone found in its burst is the phone\'s word');
  assert.deepEqual(E.tuneFields('hive').map(f => f.k), ['again', 'secs', 'target', 'four', 'bonus', 'aiRare', 'aiMin', 'aiMax', 'aiShort', 'aiMinHard', 'aiMaxHard', 'aiShortHard', 'aiFullHard', 'aiMinEasy', 'aiMaxEasy', 'aiShortEasy']);
  const c = R.hiveCfg(fresh('a'));
  assert.deepEqual([c.target, c.secs, c.four, c.bonus, c.rare, c.ai.normal, c.ai.hard, c.ai.easy], [40, 20, 1, 7, 20, [1, 4, 45, 0], [2, 5, 50, 10], [1, 3, 35, 0]]);
  for (const bad of ['slot', 'jackpot', 'bet', 'queen bee', 'genius', 'pangram']) assert.ok(!JSON.stringify([M.info, M.explainer, M.goAgainText]).toLowerCase().includes(bad), bad);
});

test('hive: every puzzle keeps to the curation rules', () => {
  const n = R.hiveCount(), top = E.tuneFields('hive').find(f => f.k === 'target'), c = R.hiveCfg(fresh('a')), seen = new Set();
  assert.ok(n >= 40 && n <= 60, `${n} puzzles`); assert.equal(n, HIVE_PUZZLES.length);
  for (let i = 0; i < n; i++) {
    const pz = R.hivePuzzle(i), tag = `puzzle ${i} (${pz.letters})`;
    assert.match(pz.letters, /^[a-z]{7}$/, tag); assert.equal(new Set(pz.letters).size, 7, `${tag}: seven different letters`); assert.equal(pz.centre, pz.letters[0]);
    assert.ok(!pz.letters.includes('s'), `${tag}: no S`); assert.ok([...pz.letters].filter(ch => 'jqxz'.includes(ch)).length <= 1, `${tag}: one rare letter at most`);
    assert.equal(pz.letters.slice(1), [...pz.letters.slice(1)].sort().join(''), `${tag}: the outer letters in order`);
    const key = [...pz.letters].sort().join(''); assert.ok(!seen.has(key), `${tag}: its letters are another puzzle's`); seen.add(key);
    assert.ok(pz.words.length >= 30 && pz.words.length <= 70, `${tag}: ${pz.words.length} words`);
    assert.deepEqual(pz.words, [...new Set(pz.words)].sort(), `${tag}: its words in order, none twice`);
    const only = new RegExp(`^[${pz.letters}]{${R.HIVE.min},${R.HIVE.max}}$`);
    for (const w of pz.words) { assert.match(w, only, `${tag}: ${w}`); assert.ok(w.includes(pz.centre), `${tag}: ${w} has the centre letter`); }
    assert.ok(pz.full.length >= 1, `${tag}: a word with all seven letters`); for (const w of pz.full) assert.equal(new Set(w).size, 7);
    const total = pz.words.reduce((a, w) => a + R.hivePts(c, pz, w), 0);
    assert.ok(total >= 4 * top.max && total >= 4 * c.target, `${tag}: ${total} points, 4 times the highest target (${top.max})`);
    const plain = pz.words.filter(w => pz.plain.has(w));
    assert.ok(plain.length >= 15 && plain.reduce((a, w) => a + R.hivePts(c, pz, w), 0) >= 60, `${tag}: ${plain.length} everyday words`);
    assert.ok(pz.full.some(w => pz.plain.has(w)), `${tag}: an everyday full-hive word`);
  }
  assert.equal(R.hivePuzzle(n), R.hivePuzzle(0), 'a number past the list comes round'); assert.equal(R.hivePuzzle(-1), R.hivePuzzle(n - 1)); assert.equal(R.hivePuzzle('x'), R.hivePuzzle(0));
  assert.ok(JSON.stringify(HIVE_PUZZLES).length < 40000, 'the puzzles stay a few tens of KB');
});

test('hive: no offensive word in any list', () => {
  const bad = new Set(B.BADWORDS.concat(B.BAD_EXTRA, B.BAD_EXTRA_TOKENS).map(w => String(w).toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean));
  const roots = ['nigg', 'fuck', 'cunt', 'shit', 'fagg', 'twat', 'whore', 'slut', 'kike', 'dyke', 'wank', 'jizz', 'bitch', 'retard', 'chink', 'gook', 'piss', 'dildo', 'penis', 'vagin', 'pussy', 'porn', 'rapist', 'coon', 'negro', 'nazi'];
  for (let i = 0; i < R.hiveCount(); i++) for (const w of R.hivePuzzle(i).words) { assert.ok(!bad.has(w), w); assert.ok(!roots.some(r => w.startsWith(r)), w); }
});

test('hive: a deal; 4 letters score 1, a longer word its length, all seven letters 7 more', () => {
  const pzs = new Set(); for (let g = 0; g < 200; g++) pzs.add(fresh('d' + g).pz);
  assert.ok(pzs.size > 40, 'the deals spread over the puzzles');
  const m = fresh('b'), pz = R.hivePuzzle(m.pz), c = R.hiveCfg(m);
  assert.deepEqual([m.type, m.found, m.by, m.pts, m.n, m.last], ['hive', [], '', { X: 0, O: 0 }, { X: 0, O: 0 }, null]);
  for (const w of pz.words) assert.equal(R.hivePts(c, pz, w), (w.length === 4 ? 1 : w.length) + (pz.full.includes(w) ? 7 : 0), w);
  const w4 = by(pz, 4)[0], w5 = by(pz, 5)[0], w6 = by(pz, 6)[0], full = pz.full[0];
  let r = E.applyMove(m, 'X', { w: [w4, w5] }, E.makeRng('x'));
  assert.deepEqual([r.ok, r.outcome, r.note, !!r.again], [true, 'continue', 'words', false]);
  assert.deepEqual([m.found, m.by, m.pts, m.n, m.last], [[w4, w5], 'XX', { X: 6, O: 0 }, { X: 1, O: 0 }, { by: 'X', w: [w4, w5], pts: [1, 5], full: 0, from: 0, to: 6 }]);
  r = E.applyMove(m, 'O', { w: [full, w6] }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.pts.O, m.last.pts, m.last.full, m.by], ['continue', 'full', false, full.length + 7 + 6, [full.length + 7, 6], 1, 'XXOO']);
  E.setTune('hive', { four: 2, bonus: 10 });
  try { const t = fresh('b'), tz = R.hivePuzzle(t.pz); E.applyMove(t, 'X', { w: [by(tz, 4)[0], tz.full[0]] }, E.makeRng('x')); assert.deepEqual(t.last.pts, [2, tz.full[0].length + 10]); } finally { E.setTune('hive', null); }
});

test('hive: a word found is gone for both; junk in a burst is dropped, never scored; a bad move is refused', () => {
  const m = fresh('c'), pz = R.hivePuzzle(m.pz), [a, b, c5] = [by(pz, 4)[0], by(pz, 4)[1], by(pz, 5)[0]];
  E.applyMove(m, 'X', { w: [a] }, E.makeRng('x'));
  let r = E.applyMove(m, 'O', { w: [a, b, b, 'zzzz', '', a.toUpperCase(), ' ' + c5, pz.letters, 'ab', a.slice(0, 3)] }, E.makeRng('x'));
  assert.deepEqual([r.ok, r.outcome, m.last.w, m.last.pts, m.pts, m.found, m.by], [true, 'continue', [b], [1], { X: 1, O: 1 }, [a, b], 'XO'], 'only the one new word of the list counts, once');
  r = E.applyMove(m, 'X', { w: [b, a] }, E.makeRng('x'));
  assert.deepEqual([r.ok, r.note, m.pts.X, m.last.w, m.n], [true, 'none', 1, [], { X: 2, O: 1 }], 'the other player\'s word is gone too');
  r = E.applyMove(m, 'O', { w: [] }, E.makeRng('x')); assert.deepEqual([r.ok, r.outcome, r.note, m.n.O, m.last.to], [true, 'continue', 'none', 2, 1], 'an empty burst is a move');
  const before = JSON.stringify(m);
  for (const bad of [null, undefined, 'w', 5, [], {}, { w: 'word' }, { w: null }, { w: [1] }, { w: [null] }, { w: [[a]] }, { w: [{ w: a }] }, { w: Array(R.HIVE.cap + 1).fill(c5) }, { w: ['x'.repeat(40)] }]) assert.equal(E.applyMove(m, 'X', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  assert.equal(JSON.stringify(m), before, 'a refused move changes nothing');
  assert.equal(E.applyMove(m, 'X', { w: Array(R.HIVE.cap).fill(c5) }, E.makeRng('x')).ok, true); assert.deepEqual(m.last.w, [c5]);
  // why a typed word would not count: the view's line and the move agree
  assert.deepEqual([R.hiveWhy(pz, m.found, a.slice(0, 3)), R.hiveWhy(pz, m.found, [...pz.letters.slice(1, 5)].join('')), R.hiveWhy(pz, m.found, pz.centre.repeat(5)), R.hiveWhy(pz, m.found, a), R.hiveWhy(pz, m.found, by(pz, 4)[2])], ['short', 'centre', 'word', 'found', '']);
});

test('hive: the burst stops counting at the word that reaches the target; the square is won there', () => {
  const m = fresh('e'), pz = R.hivePuzzle(m.pz), long = pz.words.filter(w => w.length >= 6 && !pz.full.includes(w));
  m.pts.X = 38;
  const r = E.applyMove(m, 'X', { w: [by(pz, 4)[0], long[0], long[1], by(pz, 4)[1]] }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, r.winner, m.last.w, m.pts.X, m.found.length], ['win', 'won', undefined, [by(pz, 4)[0], long[0]], 39 + long[0].length, 2], 'nothing after the winning word counts');
  // a whole square from nothing, a word a turn, the short words first: it takes a good many
  const t = fresh('f'), tz = R.hivePuzzle(t.pz); let turns = 0, p = 'X', out;
  for (const w of tz.words.slice().sort((x, y) => x.length - y.length)) { out = E.applyMove(t, p, { w: [w] }, E.makeRng('x')); turns++; if (out.outcome !== 'continue') break; p = other(p); }
  assert.equal(out.outcome, 'win'); assert.ok(t.pts.X >= 40 || t.pts.O >= 40); assert.ok(turns > 8);
});

test('hive: winnable alone (the other side entering nothing); every word found: the higher score, level a draw', () => {
  for (let g = 0; g < 60; g++) {
    const rng = E.makeRng('alone' + g), m = fresh('al' + g), me = g % 2 ? 'O' : 'X'; let p = 'X', done = null;
    for (let k = 0; k < 400 && !done; k++) {
      const r = E.applyMove(m, p, p === me ? E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'easy' }).move : { w: [] }, rng);
      assert.ok(r.ok); if (r.outcome !== 'continue') done = r; else if (!r.again) p = other(p);
    }
    assert.ok(done && done.outcome === 'win' && (done.winner || p) === me, `square ${g}: the one player moving wins it`); assert.equal(m.pts[other(me)], 0);
  }
  const end = (x, o, last) => { const m = fresh('z', 3), pz = R.hivePuzzle(3), w = by(pz, 4)[0]; m.found = pz.words.filter(v => v !== w); m.by = 'X'.repeat(m.found.length); m.pts = { X: x, O: o }; const r = E.applyMove(m, last, { w: [w] }, E.makeRng('x')); return [r.outcome, r.winner || (r.outcome === 'win' ? last : null), r.note]; };
  assert.deepEqual(end(10, 3, 'X'), ['win', 'X', 'out']); assert.deepEqual(end(10, 30, 'X'), ['win', 'O', 'out'], 'the other player\'s, when theirs is the higher score');
  assert.deepEqual(end(9, 10, 'X'), ['draw', null, 'tie'], 'level: nobody\'s'); assert.deepEqual(end(39, 3, 'X'), ['win', 'X', 'won']);
  const full = fresh('z', 3), fz = R.hivePuzzle(3); full.found = fz.words.slice(); full.by = 'X'.repeat(fz.words.length); full.pts = { X: 20, O: 20 };
  assert.deepEqual(E.applyMove(full, 'O', { w: [] }, E.makeRng('x')).outcome, 'draw', 'a hive with nothing left never hangs');
});

test('hive: Go again on success: a burst with a full-hive word in it plays another; off by default', () => {
  const play = () => { const m = fresh('g'), pz = R.hivePuzzle(m.pz), a = E.applyMove(m, 'X', { w: [by(pz, 4)[0]] }, E.makeRng('x')), b = E.applyMove(m, 'O', { w: [pz.full[0]] }, E.makeRng('x')); return [!!a.again, !!b.again, b.note]; };
  assert.deepEqual(play(), [false, false, 'full']);
  E.setTune('hive', { again: 'on' });
  try { assert.deepEqual(play(), [false, true, 'full']); const m = fresh('g'), pz = R.hivePuzzle(m.pz); m.pts.X = 39; const r = E.applyMove(m, 'X', { w: [pz.full[0]] }, E.makeRng('x')); assert.deepEqual([r.outcome, !!r.again], ['win', false]); } finally { E.setTune('hive', null); }
  assert.ok(M.goAgainText.on && M.goAgainText.off === '' && M.explainer.play.includes('{goAgain}'));
});

test('hive: nothing is hidden; the flash; a timeout plays nothing; the state stays small', () => {
  const st = E.newMatch(E.makeRng('i'), { games: ['hive'] }), p = st.turn, mini = st.squares[4].mini, pz = R.hivePuzzle(mini.pz);
  assert.deepEqual(E.publicMini(mini, 'X'), JSON.parse(JSON.stringify(mini))); assert.deepEqual(E.publicMini(mini, 'O'), E.publicMini(mini, 'X'));
  assert.ok(E.playMove(st, 4, { w: [by(pz, 5)[0], by(pz, 4)[0], 'nope'] }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.hv).sort(), ['by', 'from', 'full', 'pts', 'to', 'w']); assert.deepEqual([st.flash.hv.by, st.flash.hv.w.length, st.flash.hv.to], [p, 2, 6]);
  assert.ok(E.playMs(st.flash) >= R.hiveShowMs(st.flash.hv)); assert.equal(R.timeoutClose(mini, p), null);
  // a long burst is laid out within its span: every word's moment before the result's
  const l = { w: Array(R.HIVE.cap).fill('word') }; assert.ok(R.hiveBeat(R.HIVE.cap) < R.HIVE.beat); assert.ok(R.hiveWordAt(l, R.HIVE.cap - 1) < R.hiveShowMs(l)); assert.equal(R.hiveShowMs(l), R.HIVE.pre + R.HIVE.span + R.HIVE.tail);
  assert.equal(R.hiveBeat(3), R.HIVE.beat); assert.equal(R.hiveShowMs({ w: [] }), R.HIVE.pre + R.HIVE.tail);
  const big = fresh('z', 0), bz = R.hivePuzzle(0); big.found = bz.words.slice(); big.by = 'X'.repeat(bz.words.length);
  assert.ok(JSON.stringify(big).length < 1500, 'a hive with every word found is still a small record');
});

test('hive: the computer by level: legal bursts no bigger than a person\'s, a lean to everyday words; whole squares end', () => {
  const stat = level => { let pts = 0, n = 0, plain = 0, len = 0, max = 0, min = 99; for (let k = 0; k < 600; k++) { const t = fresh('q' + k), pz = R.hivePuzzle(t.pz), rng = E.makeRng(level + k), mv = E.localBest(E.publicMini(t, 'X'), 'X', rng, {}, { level }).move; assert.equal(new Set(mv.w).size, mv.w.length); for (const w of mv.w) { assert.ok(pz.set.has(w)); n++; len += w.length; if (pz.plain.has(w)) plain++; } max = Math.max(max, mv.w.length); min = Math.min(min, mv.w.length); assert.ok(E.applyMove(t, 'X', mv, rng).ok); assert.equal(t.last.w.length, mv.w.length, 'every word of its burst counts'); pts += t.last.to; } return { pts: pts / 600, plain: plain / n, len: len / n, max, min }; };
  const e = stat('easy'), n = stat('normal'), h = stat('hard');
  assert.ok(e.pts < n.pts && n.pts < h.pts, `points a burst: easy ${e.pts.toFixed(1)} < normal ${n.pts.toFixed(1)} < hard ${h.pts.toFixed(1)}`);
  assert.deepEqual([e.min, e.max, n.min, n.max, h.min, h.max], [1, 3, 1, 4, 2, 5]);
  assert.ok(n.plain > 0.6 && e.len < n.len && n.len < h.len, `everyday words ${n.plain.toFixed(2)}; letters a word ${e.len.toFixed(2)} < ${n.len.toFixed(2)} < ${h.len.toFixed(2)}`);
  const pm = E.publicMini(fresh('n'), 'X'); assert.ok(A.needs(pm, 'X') > 2 && A.needs(pm, 'X') < 9, `needs ${A.needs(pm, 'X')}`); pm.pts.X = 39; assert.equal(A.needs(pm, 'X'), 1); pm.pts.X = 40; assert.equal(A.needs(pm, 'X'), 0);
  let wins = 0, first = 99;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('w' + g), t = fresh('sq' + g), lv = ['easy', 'normal', 'hard', 'random'][g % 4], n = { X: 0, O: 0 }; let q = 'X';
    for (let k = 0; k < 900; k++) { n[q]++; const mv = lv === 'random' ? E.randomLegalMove(t, q, rng) : E.localBest(E.publicMini(t, q), q, rng, {}, { level: lv }).move, r = E.applyMove(t, q, mv, rng); assert.ok(r.ok, JSON.stringify(mv)); if (r.outcome !== 'continue') { wins++; if (lv === 'normal') first = Math.min(first, n[r.winner || q]); break; } q = other(q); }
  }
  assert.equal(wins, 300); assert.ok(first >= 2, 'no Normal square is won in a first burst');
});
