'use strict';
// Letter Hive (December 2026; new letters every turn, drawn at Go!, from 23 November 2026): its puzzles, its rules and
// its computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/hive/rules.js');
const A = require('../../src/games/hive/ai.js');
const M = require('../../src/games/hive/meta.js');
const { HIVE_PUZZLES } = require('../../src/games/hive/puzzles.js');
const B = require('../../src/core/badwords.js');

const other = p => (p === 'X' ? 'O' : 'X');
const fresh = seed => E.newMini('hive', E.makeRng(seed));
const by = (pz, n, full) => pz.words.filter(w => w.length === n && pz.full.includes(w) === !!full);
// The next Go! on this square draws puzzle k (every other puzzle marked as dealt here: the draw takes one not dealt yet).
const next = (m, k) => { m.used = Array.from({ length: R.hiveCount() }, (_, i) => i).filter(i => i !== k); };
// Go! for p, on puzzle k when given: the letters drawn; returns them.
const go = (m, p, k) => { if (k != null) next(m, k); const r = E.applyMove(m, p, R.HIVE_GO, E.makeRng('go:' + p + ':' + m.n[p])); assert.deepEqual([r.ok, r.outcome, r.note, r.again], [true, 'continue', 'go', true], 'Go! holds the turn'); return R.hivePuzzle(m.pz); };

test('hive: Admin only, brain, a timed burst, a 60 s turn, held out of Find Match; its settings', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.realTime, M.turnSecs], ['admin', 'brain', '1.31.0', false, true, 60]);
  assert.ok(E.FIND_MATCH_HOLD.includes('hive'), 'what a phone found in its burst is the phone\'s word');
  assert.deepEqual(E.gameFields('hive').map(f => f.k), ['again', 'secs', 'target', 'four', 'bonus', 'aiRare', 'aiMin', 'aiMax', 'aiShort', 'aiMinHard', 'aiMaxHard', 'aiShortHard', 'aiFullHard', 'aiMinEasy', 'aiMaxEasy', 'aiShortEasy']);
  const c = R.hiveCfg(fresh('a'));
  assert.deepEqual([c.target, c.secs, c.four, c.bonus, c.rare, c.ai.normal, c.ai.hard, c.ai.easy], [40, 20, 1, 7, 20, [1, 4, 45, 0], [2, 5, 50, 10], [1, 3, 35, 0]]);
  for (const bad of ['slot', 'jackpot', 'bet', 'queen bee', 'genius', 'pangram']) assert.ok(!JSON.stringify([M.info, M.explainer, M.goAgainText]).toLowerCase().includes(bad), bad);
  assert.match(M.explainer.play, /new letters, hidden until you tap Go!/, 'the explainer says the letters are new each turn and come with Go!');
});

test('hive: every puzzle keeps to the curation rules', () => {
  const n = R.hiveCount(), top = E.gameFields('hive').find(f => f.k === 'target'), c = R.hiveCfg(fresh('a')), seen = new Set();
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
    for (const w of pz.words) { assert.match(w, only, `${tag}: ${w}`); assert.ok(w.includes(pz.centre), `${tag}: ${w} has the centre letter`); assert.equal(R.hiveFullWord(w), pz.full.includes(w), `${tag}: ${w}: seven different letters in a word are all seven`); }
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

test('hive: no letters until Go!, which draws them by its own rng, never letters this square has dealt; a burst only on them', () => {
  const m = fresh('b');
  assert.deepEqual(m, { type: 'hive', v: 2, pz: null, used: [], go: null, found: [], by: '', pts: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }, 'dealt with no letters: nothing to study before Go!');
  assert.equal(E.applyMove(m, 'X', { w: [] }, E.makeRng('x')).ok, false, 'a burst before its Go! is refused');
  const pz = go(m, 'X');
  assert.deepEqual([m.go, m.used, m.n], ['X', [m.pz], { X: 0, O: 0 }]); assert.ok(Number.isInteger(m.pz) && m.pz >= 0 && m.pz < R.hiveCount());
  assert.equal(E.applyMove(m, 'X', R.HIVE_GO, E.makeRng('x')).ok, false, 'one Go! a burst: its letters stand');
  assert.equal(E.applyMove(m, 'O', { w: [pz.words[0]] }, E.makeRng('x')).ok, false, 'a burst on letters drawn for the other player is refused');
  // the draw: the move's own rng (the same rng, the same letters; the server's online), spread over the puzzles
  const at = seed => { const t = fresh('s'); E.applyMove(t, 'X', R.HIVE_GO, E.makeRng(seed)); return t.pz; };
  assert.equal(at('r1'), at('r1')); const pzs = new Set(); for (let g = 0; g < 300; g++) pzs.add(at('d' + g));
  assert.ok(pzs.size > 45, `the draws spread over the puzzles (${pzs.size})`);
  // every burst on new letters: a square never deals the same letters twice, until every puzzle has been dealt in it
  const t = fresh('all'), dealt = []; let p = 'X';
  for (let k = 0; k < R.hiveCount(); k++) { go(t, p); dealt.push(t.pz); assert.ok(E.applyMove(t, p, { w: [] }, E.makeRng('e')).ok); p = other(p); }
  assert.equal(new Set(dealt).size, R.hiveCount(), 'every puzzle once before any comes round again');
  const last = t.pz; go(t, p); assert.notEqual(t.pz, last, 'round again: never the letters just played'); assert.deepEqual(t.used, [t.pz]);
});

test('hive: 4 letters score 1, a longer word its length, all seven letters 7 more; a word found on any letters is gone for both', () => {
  const m = fresh('c'), c = R.hiveCfg(m), pz = go(m, 'X', 5);
  for (const w of pz.words) assert.equal(R.hivePts(c, pz, w), (w.length === 4 ? 1 : w.length) + (pz.full.includes(w) ? 7 : 0), w);
  const w4 = by(pz, 4)[0], w5 = by(pz, 5)[0];
  let r = E.applyMove(m, 'X', { w: [w4, w5] }, E.makeRng('x'));
  assert.deepEqual([r.ok, r.outcome, r.note, !!r.again], [true, 'continue', 'words', false]);
  assert.deepEqual([m.found, m.by, m.pts, m.n, m.go, m.last], [[w4, w5], 'XX', { X: 6, O: 0 }, { X: 1, O: 0 }, null, { by: 'X', pz: 5, w: [w4, w5], pts: [1, 5], full: 0, from: 0, to: 6 }]);
  go(m, 'O', 7); const pz7 = R.hivePuzzle(7);
  r = E.applyMove(m, 'O', { w: [pz7.full[0], by(pz7, 6)[0]] }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, m.pts.O, m.last.pts, m.last.full, m.last.pz, m.by], ['continue', 'full', pz7.full[0].length + 7 + 6, [pz7.full[0].length + 7, 6], 1, 7, 'XXOO']);
  // puzzles 0 and 1 share words: one found on the first set of letters scores nothing on the second, whoever found it
  const s = fresh('sh'), p0 = go(s, 'X', 0), p1 = R.hivePuzzle(1), both = p0.words.filter(w => p1.set.has(w));
  assert.ok(both.length >= 3, 'puzzles 0 and 1 have words in common');
  E.applyMove(s, 'X', { w: [both[0]] }, E.makeRng('x')); go(s, 'O', 1);
  r = E.applyMove(s, 'O', { w: [both[0], both[1]] }, E.makeRng('x'));
  assert.deepEqual([r.ok, s.last.w, s.found, s.by], [true, [both[1]], [both[0], both[1]], 'XO'], 'the word the other player found on other letters is dropped');
  go(s, 'X', 0); r = E.applyMove(s, 'X', { w: [both[1], both[0]] }, E.makeRng('x'));
  assert.deepEqual([r.note, s.last.w, s.pts.X], ['none', [], R.hivePts(R.hiveCfg(s), p0, both[0])], 'and back on the first letters, both are gone');
  E.setTune('hive', { four: 2, bonus: 10 });
  try { const t = fresh('b'), tz = go(t, 'X', 9); E.applyMove(t, 'X', { w: [by(tz, 4)[0], tz.full[0]] }, E.makeRng('x')); assert.deepEqual(t.last.pts, [2, tz.full[0].length + 10]); } finally { E.setTune('hive', null); }
});

test('hive: junk in a burst is dropped, never scored; a bad move is refused and changes nothing', () => {
  const m = fresh('j'), pz = go(m, 'X', 11), [a, b, c5] = [by(pz, 4)[0], by(pz, 4)[1], by(pz, 5)[0]];
  let r = E.applyMove(m, 'X', { w: [a, b, b, 'zzzz', '', a.toUpperCase(), ' ' + c5, pz.letters, 'ab', a.slice(0, 3)] }, E.makeRng('x'));
  assert.deepEqual([r.ok, r.outcome, m.last.w, m.last.pts, m.pts, m.found, m.by], [true, 'continue', [a, b], [1, 1], { X: 2, O: 0 }, [a, b], 'XX'], 'only the new words of the letters count, once');
  go(m, 'O', 11 + 1); r = E.applyMove(m, 'O', { w: [] }, E.makeRng('x'));
  assert.deepEqual([r.ok, r.outcome, r.note, m.n.O, m.last.to, m.go], [true, 'continue', 'none', 1, 0, null], 'an empty burst is a move');
  go(m, 'X', 11);
  const before = JSON.stringify(m);
  for (const bad of [null, undefined, 'w', 5, [], {}, { w: 'word' }, { w: null }, { w: [1] }, { w: [null] }, { w: [[a]] }, { w: [{ w: a }] }, { w: Array(R.HIVE.cap + 1).fill(c5) }, { w: ['x'.repeat(40)] }, 'auto', R.HIVE_GO]) assert.equal(E.applyMove(m, 'X', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  assert.equal(JSON.stringify(m), before, 'a refused move changes nothing');
  assert.equal(E.applyMove(m, 'X', { w: Array(R.HIVE.cap).fill(c5) }, E.makeRng('x')).ok, true); assert.deepEqual(m.last.w, [c5]);
  // why a typed word would not count: the view's line and the move agree
  assert.deepEqual([R.hiveWhy(pz, m.found, a.slice(0, 3)), R.hiveWhy(pz, m.found, [...pz.letters.slice(1, 5)].join('')), R.hiveWhy(pz, m.found, pz.centre.repeat(5)), R.hiveWhy(pz, m.found, a), R.hiveWhy(pz, m.found, by(pz, 4)[2])], ['short', 'centre', 'word', 'found', '']);
});

test('hive: the burst stops counting at the word that reaches the target; the square is won there', () => {
  const m = fresh('e'), pz = go(m, 'X', 13), long = pz.words.filter(w => w.length >= 6 && !pz.full.includes(w));
  m.pts.X = 38;
  const r = E.applyMove(m, 'X', { w: [by(pz, 4)[0], long[0], long[1], by(pz, 4)[1]] }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, r.winner, m.last.w, m.pts.X, m.found.length], ['win', 'won', undefined, [by(pz, 4)[0], long[0]], 39 + long[0].length, 2], 'nothing after the winning word counts');
  // a whole square from nothing, a word a turn, the short words first: it takes a good many
  const t = fresh('f'); let turns = 0, p = 'X', out;
  for (let k = 0; k < 400; k++) { const tz = go(t, p), w = tz.words.filter(x => !t.found.includes(x)).sort((x, y) => x.length - y.length)[0]; out = E.applyMove(t, p, { w: [w] }, E.makeRng('x')); turns++; if (out.outcome !== 'continue') break; p = other(p); }
  assert.equal(out.outcome, 'win'); assert.ok(t.pts.X >= 40 || t.pts.O >= 40); assert.ok(turns > 8);
});

test('hive: winnable alone (the other side entering nothing); nothing left to find anywhere: the higher score, level a draw', () => {
  for (let g = 0; g < 60; g++) {
    const rng = E.makeRng('alone' + g), m = fresh('al' + g), me = g % 2 ? 'O' : 'X'; let p = 'X', done = null;
    for (let k = 0; k < 400 && !done; k++) {
      const mv = p === me ? E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'easy' }).move : R.hiveGo(m) === p ? { w: [] } : R.HIVE_GO;
      const r = E.applyMove(m, p, mv, rng);
      assert.ok(r.ok, JSON.stringify(mv)); if (r.outcome !== 'continue') done = r; else if (!r.again) p = other(p);
    }
    assert.ok(done && done.outcome === 'win' && (done.winner || p) === me, `square ${g}: the one player moving wins it`); assert.equal(m.pts[other(me)], 0);
  }
  const every = []; for (let i = 0; i < R.hiveCount(); i++) for (const w of R.hivePuzzle(i).words) if (!every.includes(w)) every.push(w);
  const end = (x, o, p) => { const m = fresh('z'); m.found = every.slice(); m.by = 'X'.repeat(every.length); m.pts = { X: x, O: o }; const r = E.applyMove(m, p, R.HIVE_GO, E.makeRng('x')); return [r.outcome, r.winner || (r.outcome === 'win' ? p : null), r.note]; };
  assert.deepEqual(end(10, 3, 'X'), ['win', 'X', 'out']); assert.deepEqual(end(10, 30, 'X'), ['win', 'O', 'out'], 'the other player\'s, when theirs is the higher score');
  assert.deepEqual(end(20, 20, 'O'), ['draw', null, 'tie'], 'level: nobody\'s: a square with nothing left never hangs');
  const most = fresh('most'); most.found = every.filter(w => !R.hivePuzzle(4).words.includes(w)); most.by = 'X'.repeat(most.found.length);
  assert.ok(E.applyMove(most, 'X', R.HIVE_GO, E.makeRng('x')).ok); assert.equal(most.pz, 4, 'Go! deals letters with a word still to find');
});

test('hive: Go again on success: a burst with a full-hive word in it plays another turn, on new letters; off by default', () => {
  const play = () => { const m = fresh('g'), pa = go(m, 'X'), a = E.applyMove(m, 'X', { w: [by(pa, 4)[0]] }, E.makeRng('x')), pb = go(m, 'O'), b = E.applyMove(m, 'O', { w: [pb.full[0]] }, E.makeRng('x')); return [m, !!a.again, !!b.again, b.note]; };
  assert.deepEqual(play().slice(1), [false, false, 'full']);
  E.setTune('hive', { again: 'on' });
  try {
    const [m, a, b, note] = play(), was = m.used.slice(); assert.deepEqual([a, b, note, m.go], [false, true, 'full', null]);
    go(m, 'O'); assert.ok(!was.includes(m.pz), 'the turn played on: other letters again'); assert.deepEqual(m.used, was.concat([m.pz]));
    const w = fresh('g2'); go(w, 'X', 2); w.pts.X = 39; const r = E.applyMove(w, 'X', { w: [R.hivePuzzle(2).full[0]] }, E.makeRng('x')); assert.deepEqual([r.outcome, !!r.again], ['win', false]);
  } finally { E.setTune('hive', null); }
  assert.ok(M.goAgainText.on && M.goAgainText.off === '' && M.explainer.play.includes('{goAgain}'));
});

test('hive: nothing hidden; the flashes; a timeout after Go! sends the burst empty, before it nothing; the state stays small', () => {
  const st = E.newMatch(E.makeRng('i'), { games: ['hive'] }), p = st.turn, mini = st.squares[4].mini;
  assert.deepEqual(E.publicMini(mini, 'X'), JSON.parse(JSON.stringify(mini))); assert.deepEqual(E.publicMini(mini, 'O'), E.publicMini(mini, 'X'));
  assert.ok(E.playMove(st, 4, R.HIVE_GO, E.makeRng('s')).ok);
  assert.deepEqual([st.flash.kind, st.flash.hv, st.lock], ['again', { go: 1, by: p, pz: mini.pz }, 4], 'Go!: the turn held to the square, its letters in the flash');
  assert.equal(E.playMs(st.flash), R.hiveDealMs()); assert.equal(R.hiveDealAt(-1), 0); assert.ok(R.hiveDealAt(5) + R.HIVE.pop === R.hiveDealMs());
  E.endFlash(st);
  const pz = R.hivePuzzle(mini.pz);
  assert.ok(E.playMove(st, 4, { w: [by(pz, 5)[0], by(pz, 4)[0], 'nope'] }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.hv).sort(), ['by', 'from', 'full', 'pts', 'pz', 'to', 'w']); assert.deepEqual([st.flash.hv.by, st.flash.hv.w.length, st.flash.hv.to, st.flash.hv.pz], [p, 2, 6, mini.pz]);
  assert.ok(E.playMs(st.flash) >= R.hiveShowMs(st.flash.hv));
  assert.equal(st.squares[4].mv[p], 1, 'Go! and its burst count as one turn in the square');
  // a timeout: before Go!, nothing (a missed turn); after it, the burst goes in empty (the turn passes, not missed)
  const t = E.newMatch(E.makeRng('to'), { games: ['hive'], mode: 'online', timer: 30 }), q = t.turn, tm = t.squares[0].mini;
  assert.equal(R.timeoutClose(tm, q), null);
  let r = E.timeoutMove(t, E.makeRng('a')); assert.deepEqual([r.ok, r.missed], [true, q], 'before Go!: a missed turn');
  const q2 = t.turn; assert.ok(E.playMove(t, 0, R.HIVE_GO, E.makeRng('b')).ok); E.endFlash(t);
  assert.deepEqual(R.timeoutClose(t.squares[0].mini, q2), { w: [] }); assert.equal(R.timeoutClose(t.squares[0].mini, other(q2)), null);
  r = E.timeoutMove(t, E.makeRng('c'));
  assert.deepEqual([r.ok, r.closed, t.flash && t.flash.timeout, t.squares[0].mini.go, t.squares[0].mini.n[q2], t.timer.streak[q2]], [true, true, true, null, 1, 0], 'after Go!: the burst in empty, the turn over, not a miss');
  // a long burst is laid out within its span: every word's moment before the result's
  const l = { w: Array(R.HIVE.cap).fill('word') }; assert.ok(R.hiveBeat(R.HIVE.cap) < R.HIVE.beat); assert.ok(R.hiveWordAt(l, R.HIVE.cap - 1) < R.hiveShowMs(l)); assert.equal(R.hiveShowMs(l), R.HIVE.pre + R.HIVE.span + R.HIVE.tail);
  assert.equal(R.hiveBeat(3), R.HIVE.beat); assert.equal(R.hiveShowMs({ w: [] }), R.HIVE.pre + R.HIVE.tail);
  const big = fresh('z'); for (let k = 0; k < 20; k++) { go(big, 'X'); E.applyMove(big, 'X', { w: R.hivePuzzle(big.pz).words.filter(w => !big.found.includes(w)).slice(0, 3) }, E.makeRng('w')); }
  assert.ok(JSON.stringify(big).length < 1500, `a square after 20 bursts is still a small record (${JSON.stringify(big).length})`);
});

test('hive: a square dealt before (its letters dealt with it) plays on under the new rules, its words and points kept', () => {
  const old = { type: 'hive', pz: 3, found: [], by: '', pts: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }, p3 = R.hivePuzzle(3);
  old.found = [by(p3, 4)[0], by(p3, 5)[0]]; old.by = 'XO'; old.pts = { X: 1, O: 5 }; old.n = { X: 1, O: 1 }; old.last = { by: 'O', w: [by(p3, 5)[0]], pts: [5], full: 0, from: 0, to: 5 };
  assert.equal(R.hiveShown(old), 3, 'its last burst\'s letters (the one puzzle it had)'); assert.equal(R.hiveGo(old), null);
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(old)), 'X', { w: [by(p3, 4)[1]] }, E.makeRng('x')).ok, false, 'a burst with no Go! is refused, as on a new square');
  assert.equal(E.randomLegalMove(old, 'X', E.makeRng('r')), R.HIVE_GO); assert.equal(E.localBest(E.publicMini(old, 'X'), 'X', E.makeRng('r'), {}, { level: 'normal' }).move, R.HIVE_GO);
  const m = JSON.parse(JSON.stringify(old)), r = E.applyMove(m, 'X', R.HIVE_GO, E.makeRng('up'));
  assert.deepEqual([r.ok, m.v, m.used, m.go, m.found.length, m.pts, m.last.pz], [true, 2, [3, m.pz], 'X', 2, { X: 1, O: 5 }, 3]);
  assert.notEqual(m.pz, 3, 'other letters than the ones it was dealt (on show before)');
  assert.ok(E.applyMove(m, 'X', { w: [] }, E.makeRng('x')).ok);
});

test('hive: the computer: Go! first, then legal bursts no bigger than a person\'s by level, a lean to everyday words; whole squares end', () => {
  const pm0 = E.publicMini(fresh('n'), 'X'); assert.equal(E.localBest(pm0, 'X', E.makeRng('k'), {}, { level: 'hard' }).move, R.HIVE_GO, 'no letters drawn: Go!');
  const stat = level => { let pts = 0, n = 0, plain = 0, len = 0, max = 0, min = 99; for (let k = 0; k < 600; k++) { const t = fresh('q' + k), rng = E.makeRng(level + k); E.applyMove(t, 'X', E.localBest(E.publicMini(t, 'X'), 'X', rng, {}, { level }).move, rng); const pz = R.hivePuzzle(t.pz), mv = E.localBest(E.publicMini(t, 'X'), 'X', rng, {}, { level }).move; assert.equal(new Set(mv.w).size, mv.w.length); for (const w of mv.w) { assert.ok(pz.set.has(w)); n++; len += w.length; if (pz.plain.has(w)) plain++; } max = Math.max(max, mv.w.length); min = Math.min(min, mv.w.length); assert.ok(E.applyMove(t, 'X', mv, rng).ok); assert.equal(t.last.w.length, mv.w.length, 'every word of its burst counts'); pts += t.last.to; } return { pts: pts / 600, plain: plain / n, len: len / n, max, min }; };
  const e = stat('easy'), n = stat('normal'), h = stat('hard');
  assert.ok(e.pts < n.pts && n.pts < h.pts, `points a burst: easy ${e.pts.toFixed(1)} < normal ${n.pts.toFixed(1)} < hard ${h.pts.toFixed(1)}`);
  assert.deepEqual([e.min, e.max, n.min, n.max, h.min, h.max], [1, 3, 1, 4, 2, 5]);
  assert.ok(n.plain > 0.6 && e.len < n.len && n.len < h.len, `everyday words ${n.plain.toFixed(2)}; letters a word ${e.len.toFixed(2)} < ${n.len.toFixed(2)} < ${h.len.toFixed(2)}`);
  const pm = E.publicMini(fresh('n'), 'X'); assert.ok(A.needs(pm, 'X') > 3 && A.needs(pm, 'X') < 9, `needs ${A.needs(pm, 'X')}`); pm.pts.X = 39; assert.equal(A.needs(pm, 'X'), 1); pm.pts.X = 40; assert.equal(A.needs(pm, 'X'), 0);
  const fresh7 = A.hiveBurst(E.publicMini(fresh('n'), 'X'), 'normal', 'X'); assert.ok(fresh7 > 5 && fresh7 < 10, `a Normal burst on new letters is worth about 7 (${fresh7.toFixed(2)})`);
  let wins = 0, first = 99;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('w' + g), t = fresh('sq' + g), lv = ['easy', 'normal', 'hard', 'random'][g % 4], n = { X: 0, O: 0 }; let q = 'X', starts = true;
    for (let k = 0; k < 900; k++) { if (starts) n[q]++; const mv = lv === 'random' ? E.randomLegalMove(t, q, rng) : E.localBest(E.publicMini(t, q), q, rng, {}, { level: lv }).move, r = E.applyMove(t, q, mv, rng); assert.ok(r.ok, JSON.stringify(mv)); if (r.outcome !== 'continue') { wins++; if (lv === 'normal') first = Math.min(first, n[r.winner || q]); break; } starts = !r.again; if (!r.again) q = other(q); }
  }
  assert.equal(wins, 300); assert.ok(first >= 2, 'no Normal square is won in a first burst');
});
