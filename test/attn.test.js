'use strict';
// Run with:  node --test
// Headcount, Flash and Snapshot: the attention games. Every round checked against what it shows: the
// count, the one right option, the exact pattern; the rules, the computer, the timeout, the configs.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Headcount ===================================== */
test('headcount: the count is what crossed; decoys never count; every creature crosses the whole field, and none ever covers another', () => {
  const cfg = E.headConfig(), dirs = { 0: new Set(), 1: new Set(), 2: new Set() };
  for (let level = 0; level < 3; level++) {
    const L = level + 1;
    for (let k = 0; k < 600; k++) {
      const r = E.headRound(level, lcg(k * 7 + level));
      const targets = r.items.filter(o => o.k === r.t), decoys = r.items.filter(o => o.k !== r.t);
      assert.equal(E.attTruth('headcount', r), targets.length, 'the answer: the ones asked for, counted');
      assert.ok(targets.length >= cfg['n' + L + 'lo'] && targets.length <= cfg['n' + L + 'hi'], `level ${L}: ${targets.length} to count`);
      if (L === 1) assert.equal(decoys.length, 0, 'level 1: one kind only');
      else { assert.ok(decoys.length >= cfg['d' + L + 'lo'] && decoys.length <= cfg['d' + L + 'hi'], `level ${L}: ${decoys.length} decoys`); assert.ok(decoys.every(o => o.k === r.d) && r.d !== r.t, 'decoys: another kind (or colour)'); }
      assert.equal(E.headAsk(r), `How many ${E.HEAD_KINDS[r.t][1]} were there?`);
      for (const o of r.items) {
        r.items.forEach(o2 => dirs[level].add(o2.dir));
        assert.ok(o.t >= E.HEAD.lead && o.t + o.d <= r.ms, 'starts after the lead-in, gone before the question');
        assert.equal(E.headAt(o, o.t), o.dir > 0 ? -E.HEAD.size / 2 : 100 + E.HEAD.size / 2, 'in from the edge (just out of sight)');
        assert.equal(E.headAt(o, o.t + o.d), o.dir > 0 ? 100 + E.HEAD.size / 2 : -E.HEAD.size / 2, 'out at the far edge');
        assert.ok(o.d >= 500 && o.lane >= 0 && o.lane < E.HEAD.lanes, 'in sight long enough, in a lane');
      }
      for (let i = 0; i < r.items.length; i++) for (let j = i + 1; j < r.items.length; j++) {
        const a = r.items[i], b = r.items[j];
        if (a.lane !== b.lane) continue;
        for (let ms = Math.max(a.t, b.t); ms <= Math.min(a.t + a.d, b.t + b.d); ms += 10) { const xa = E.headAt(a, ms), xb = E.headAt(b, ms); if (xa != null && xb != null) assert.ok(Math.abs(xa - xb) >= E.HEAD.size, `level ${L} round ${k}: two in lane ${a.lane} never cover each other`); }
      }
      if (L === 1) { const g = r.items.slice(1).map((o, i) => o.t - r.items[i].t); assert.ok(g.every(x => x >= cfg.gap1 * 0.85), 'level 1: spaced out, steadily'); }
    }
  }
  assert.deepEqual([...dirs[0]], [1]); assert.deepEqual([...dirs[1]], [1]); assert.deepEqual([...dirs[2]].sort(), [-1, 1], 'level 3 alone: both directions');
});

/* ===================================== Flash ===================================== */
// The question answered again here, from its words and the items shown, independently of the engine.
function answerOf(items, text) {
  const has = (it, w) => it[0] === w || it[1] === w, words = ['star', 'heart', 'bolt', 'blue', 'green', 'purple'];
  let m;
  if ((m = text.match(/^How many (blue|green|purple) items\?$/))) return items.filter(it => it[1] === m[1]).length;
  if ((m = text.match(/^How many (star|heart|bolt)s\?$/))) return items.filter(it => it[0] === m[1]).length;
  if ((m = text.match(/^How many (blue|green|purple) (star|heart|bolt)s\?$/))) return items.filter(it => it[1] === m[1] && it[0] === m[2]).length;
  if ((m = text.match(/^How many items were NOT (blue|green|purple)\?$/))) return items.filter(it => it[1] !== m[1]).length;
  if ((m = text.match(/^How many items were NOT (star|heart|bolt)s\?$/))) return items.filter(it => it[0] !== m[1]).length;
  if ((m = text.match(/^What was the (\d+)(st|nd|rd|th) item\?$/))) return items[Number(m[1]) - 1].join(':');
  if ((m = text.match(/^Which item came right after the first (star|heart|bolt|blue item|green item|purple item)\?$/))) { const w = m[1].replace(' item', ''); const k = items.findIndex(it => has(it, w)); return items[k + 1].join(':'); }
  if ((m = text.match(/^Which item came right before the last (star|heart|bolt)\?$/))) { let k = -1; items.forEach((it, j) => { if (it[0] === m[1]) k = j; }); return items[k - 1].join(':'); }
  throw new Error('a question not understood: ' + text + words.length);
}
test('flash: 8 items, a shape in a colour (never the X or O colours); every question has exactly one right option, checked against the items shown; near-miss wrong options', () => {
  const cfg = E.flashConfig(), kinds = { 0: new Set(), 1: new Set(), 2: new Set() };
  assert.ok(!E.FLASH.colours.some(c => ['red', 'yellow', 'orange'].includes(c)), 'colours apart from X (red) and O (yellow)');
  for (let level = 0; level < 3; level++) {
    for (let k = 0; k < 2000; k++) {
      const r = E.flashRound(level, lcg(k * 11 + level));
      assert.equal(r.items.length, 8); assert.equal(r.ms, cfg['ms' + (level + 1)]);
      assert.ok(r.items.every(it => E.FLASH.shapes.includes(it[0]) && E.FLASH.colours.includes(it[1])));
      assert.ok(new Set(r.items.map(it => it[0])).size >= 2 && new Set(r.items.map(it => it[1])).size >= 2, 'never one shape or one colour throughout');
      kinds[level].add(r.q.kind);
      const truth = answerOf(r.items, r.q.text), key = o => (Array.isArray(o) ? o.join(':') : o);
      assert.equal(r.opts.length, 4);
      assert.equal(new Set(r.opts.map(key)).size, 4, 'four different options');
      assert.equal(r.opts.filter(o => key(o) === truth).length, 1, `exactly one right option: ${r.q.text} ${JSON.stringify(r.items)} ${JSON.stringify(r.opts)}`);
      assert.equal(key(r.opts[r.ans]), truth, 'and it is the one the engine marks');
      if (typeof truth === 'number') { assert.ok(level < 2, 'counts at levels 1 and 2'); assert.ok(r.opts.every(o => o >= 0 && o <= 8) && r.opts.filter(o => o !== truth && Math.abs(o - truth) <= 3).length >= 2, `near misses (one or two off; at most one a similar combination's count): ${r.opts} for ${truth}`); assert.ok(r.opts.some(o => Math.abs(o - truth) === 1), 'one off among them'); }
      else assert.ok(level === 2 && r.opts.every(o => Array.isArray(o)), 'level 3: icons');
    }
  }
  assert.deepEqual([...kinds[0]].sort(), ['colour', 'shape']); assert.deepEqual([...kinds[1]].sort(), ['combo', 'notColour', 'notShape']); assert.deepEqual([...kinds[2]].sort(), ['after', 'before', 'nth']);
});

/* ===================================== Snapshot ===================================== */
test('snapshot: 4x4 with 6, 4x5 with 8, 5x5 with 10; never a trivial pattern; only an exact match counts', () => {
  const sizes = [[4, 4, 6], [4, 5, 8], [5, 5, 10]];
  for (let level = 0; level < 3; level++) {
    const [c, rr, k] = sizes[level];
    for (let n = 0; n < 2000; n++) {
      const r = E.snapRound(level, lcg(n * 13 + level));
      assert.deepEqual([r.c, r.r, r.cells.length, r.show], [c, rr, k, 5000]);
      const on = new Set(r.cells), at = (x, y) => on.has(y * c + x);
      for (let y = 0; y < rr; y++) assert.ok(!Array.from({ length: c }, (_, x) => at(x, y)).every(Boolean), 'no full row');
      for (let x = 0; x < c; x++) assert.ok(!Array.from({ length: rr }, (_, y) => at(x, y)).every(Boolean), 'no full column');
      const xs = r.cells.map(i => i % c), ys = r.cells.map(i => Math.floor(i / c));
      assert.ok((Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1) > k, 'no solid block');
      assert.ok(!r.cells.every(i => at(c - 1 - (i % c), Math.floor(i / c))) && !r.cells.every(i => at(i % c, rr - 1 - Math.floor(i / c))), 'not mirror-symmetric');
      assert.equal(E.snapTrivial(r.cells, c, rr), null);
    }
  }
  const r = E.snapRound(1, lcg(5));
  assert.equal(E.attJudge('snapshot', r, r.cells.slice().reverse()), true, 'the same cells, in any order');
  assert.equal(E.attJudge('snapshot', r, r.cells.slice(1)), false, 'one missed');
  const extra = Array.from({ length: 20 }, (_, i) => i).find(i => !r.cells.includes(i));
  assert.equal(E.attJudge('snapshot', r, r.cells.concat(extra)), false, 'one too many');
  assert.equal(E.attJudge('snapshot', r, r.cells.slice(1).concat(extra)), false, 'one in the wrong place');
  assert.equal(E.snapTrivial([0, 1, 2, 3, 6, 9], 4, 4), 'row'); assert.equal(E.snapTrivial([5, 6, 9, 10, 13, 14], 4, 4), 'block'); assert.equal(E.snapTrivial([0, 5, 10, 15, 3, 6], 4, 4), 'line');
});

/* ===================================== the rules ===================================== */
test('attention games: one round a move; right moves the player on a level, wrong does not; a fresh round each time; out of time counts as wrong; first to 3 right wins', () => {
  for (const type of E.ATT_TYPES) {
    const m = E.newMini(type, lcg(3));
    assert.deepEqual(m.right, { X: 0, O: 0 }); assert.equal(m.round.X.level, 0); assert.equal(m.round.O.level, 0);
    for (const bad of ['x', -1, null, type === 'snapshot' ? [99] : 100, type === 'snapshot' ? [0, 0] : 1.5]) assert.equal(E.applyMove(m, 'X', bad, lcg(1)).ok, false, `${type}: ${JSON.stringify(bad)} refused`);
    const r0 = m.round.X;
    let res = E.applyMove(m, 'X', E.attWrong(type, r0, lcg(2)), lcg(4));
    assert.deepEqual([res.ok, res.outcome, res.note, m.right.X, m.last.correct], [true, 'continue', 'wrong', 0, false], `${type}: wrong, no progress`);
    assert.deepEqual(m.last.truth, E.attTruth(type, r0), 'the right answer, for the result'); assert.notDeepEqual(m.round.X, r0, 'a fresh round'); assert.equal(m.round.X.level, 0);
    res = E.applyMove(m, 'X', 'auto', lcg(5));
    assert.deepEqual([res.ok, m.last.correct, m.last.answer, m.right.X], [true, false, null, 0], `${type}: out of time is wrong`);
    for (let k = 1; k <= 3; k++) {
      const lv = m.round.X.level;
      res = E.applyMove(m, 'X', E.attTruth(type, m.round.X), lcg(10 + k));
      assert.equal(m.last.correct, true); assert.equal(m.right.X, k); assert.equal(m.last.level, lv);
      if (k < 3) { assert.equal(res.outcome, 'continue'); assert.equal(m.round.X.level, k, 'the next level'); }
    }
    assert.equal(res.outcome, 'win'); assert.equal(m.right.O, 0, 'each player\'s own progress');
    assert.equal(E.randomLegalMove(E.newMini(type, lcg(6)), 'X', lcg(7)), 'auto');
  }
});

test('attention games: Start holds the player to the square (online too); a timeout then answers that round, wrong; the answer counts as the turn\'s move', () => {
  for (const type of E.ATT_TYPES) {
    const st = E.newMatch(lcg(21), { games: [type] });
    st.turn = 'X'; st.lock = null;
    const i = 4, j = 2, r0 = st.squares[i].mini.round.X;
    assert.equal(E.attStart(st, i, 'O').reason, 'turn', 'not the other player');
    assert.equal(E.attStart(st, i, 'X').ok, true); assert.equal(st.lock, i);
    assert.equal(E.attStart(st, j, 'X').reason, 'locked', 'no other round once started');
    assert.equal(E.playMove(st, j, E.attTruth(type, st.squares[j].mini.round.X), lcg(22)).reason, 'locked', 'no move anywhere else');
    st.timer = E.newTimer(60);
    const t = E.timeoutMove(st, lcg(23));
    assert.deepEqual([t.ok, t.square], [true, i], `${type}: out of time, in the square started`);
    assert.deepEqual([st.squares[i].mini.last.answer, st.squares[i].mini.last.correct, st.squares[i].mini.right.X], [null, false, 0], 'wrong');
    assert.deepEqual(st.squares[i].mini.last.round, r0, 'the round started');
    assert.deepEqual(st.squares[i].mv, { X: 1, O: 0 }, 'counted as the turn\'s move');
    E.endFlash(st); assert.equal(st.lock, null); assert.equal(st.turn, 'O');
    // online: Start through the server, then the timeout
    const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: Object.fromEntries(E.TYPES.map(g => [g, g === type])), timer: E.normTimer(60) }, lcg(24), 'g');
    const turn = rec.state.turn, k = 6;
    assert.equal(E.applyOnlineStart(rec, E.other(turn), k).ok, false);
    const s1 = E.applyOnlineStart(rec, turn, k);
    assert.equal(s1.ok, true); assert.equal(s1.rec.state.lock, k);
    const to = E.applyOnlineTimeout(s1.rec, lcg(25));
    assert.equal(to.ok, true); assert.equal(to.entries[0].square, k, 'the timeout answers the round started');
    assert.deepEqual([to.rec.state.squares[k].mini.last.correct, to.rec.state.squares[k].mini.last.answer, to.rec.state.lock], [false, null, null]);
  }
});

test('attention games: the computer gets about 85%, 65% and 45% right at levels 1-3, and its misses are near misses', () => {
  for (const type of E.ATT_TYPES) for (const [level, want] of [[0, 0.85], [1, 0.65], [2, 0.45]]) {
    const rng = lcg(91 + level); let ok = 0; const N = 1200;
    for (let k = 0; k < N; k++) {
      const m = E.newMini(type, lcg(k)); m.right.X = level; m.round.X = E.attRound(type, level, lcg(k + 5));
      const b = E.localBest(E.publicMini(m), 'X', rng);
      assert.ok(E.attValid(type, m.round.X, b.move), 'a real answer');
      if (E.attJudge(type, m.round.X, b.move)) ok++;
      else if (type === 'headcount') assert.ok(Math.abs(b.move - E.attTruth(type, m.round.X)) <= 2, 'one or two off');
    }
    assert.ok(Math.abs(ok / N - want) < 0.045, `${type} level ${level + 1}: ${(ok / N).toFixed(3)} (wanted ~${want})`);
  }
});

test('attention games: the move\'s playback (someone else\'s round at full length, their answer, the result); the timed-out turn skips the round; dealt in a match and played to the end by the computer', () => {
  for (const type of E.ATT_TYPES) {
    const st = E.newMatch(lcg(8), { games: [type] });
    const i = st.squares.findIndex(q => q.mini.type === type), r = st.squares[i].mini.round.X;
    E.playMove(st, i, E.attTruth(type, r), lcg(9));
    assert.deepEqual([st.flash.att.correct, st.flash.att.truth, st.flash.att.right.X], [true, E.attTruth(type, r), 1]);
    assert.equal(E.playMs(st.flash), E.attMs(type, r) + E.ATT.pause + E.ATT.show, `${type}: the round, a pause, the result`);
    E.endFlash(st);
    st.timer = E.newTimer(60); const t = E.timeoutMove(st, lcg(10));
    assert.equal(t.ok, true); assert.equal(st.flash.att.correct, false); assert.equal(E.playMs(st.flash), E.ATT.show, 'timed out: no round to replay');
    // the computer against itself
    const m = E.newMatch(lcg(20), { games: [type] }); let n = 0;
    while (!m.winner && n++ < 400) { if (m.flash) E.endFlash(m); if (m.winner) break; const c = E.cpuMove(m, lcg(30 + n)); const res = E.playMove(m, c.square, c.move, lcg(40 + n)); assert.equal(res.ok, true, `${type}: ${JSON.stringify(c.move)}`); }
    assert.ok(m.winner, `${type}: a match of it played to the end (${n} moves)`);
  }
});

test('attention games: the admin\'s values, checked one by one (off its range: the default); new rounds by them', () => {
  E.setHeadConfig({ n1lo: 3, n1hi: 3, cross1: 99999, gap1: 'x' });
  assert.equal(E.headConfig().n1lo, 3); assert.equal(E.headConfig().cross1, E.HEAD_DEFAULTS.cross1); assert.equal(E.headConfig().gap1, E.HEAD_DEFAULTS.gap1);
  assert.equal(E.attTruth('headcount', E.headRound(0, lcg(1))), 3, 'three to count, as set');
  E.setHeadConfig({ n2lo: 9, n2hi: 4 }); assert.ok(E.headConfig().n2hi >= E.headConfig().n2lo, 'a range kept the right way round');
  E.setHeadConfig(null);
  E.setFlashConfig({ ms1: 700, n: 10 }); const f = E.flashRound(0, lcg(2)); assert.deepEqual([f.ms, f.items.length], [700, 10]); E.setFlashConfig(null);
  E.setSnapConfig({ c1: 3, r1: 3, k1: 20, show: 3000 }); const s = E.snapRound(0, lcg(3)); assert.deepEqual([s.c, s.r, s.cells.length, s.show], [3, 3, 7, 3000], 'never more cells than the grid allows'); E.setSnapConfig(null);
  assert.deepEqual(E.snapConfig(), E.SNAP_DEFAULTS);
  assert.ok(E.TEST_TYPES.includes('headcount') && E.TEST_TYPES.includes('flash') && E.TEST_TYPES.includes('snapshot'), 'admin only to begin with');
});
