'use strict';
// Gem Swap (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/gems/rules.js');
const M = require('../../src/games/gems/meta.js');
const A = require('../../src/games/gems/ai.js');

const other = p => (p === 'X' ? 'O' : 'X');
const arr = s => R.gemsArr(s);
// A square with a board of the test's own (rows of digits, every cell given).
const square = (rows, pts) => { const m = E.newMini('gems', E.makeRng('sq')); m.n = rows.length; m.b = rows.join(''); if (pts) m.pts = pts; return m; };
const sound = (g, n) => R.gemsLines(g, n).length === 0 && R.gemsMoves(g, n).length > 0;
// (Equal turns is on by default from December 2026; these tests were written for the first to the target winning at once, so they deal with it off unless a test says otherwise.)
const OFF = { even: 'off' };
E.setTune('gems', OFF);
const withTune = (t, fn) => { E.setTune('gems', Object.assign({}, OFF, t)); try { return fn(); } finally { E.setTune('gems', OFF); } };

test('gems: Admin only, brain; a 7x7 board of six kinds, 32 to win, nothing hidden', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder], ['admin', 'brain', '1.30.0', false]);
  assert.deepEqual(E.gameFields('gems').map(f => f.k), ['again', 'againAt', 'target', 'even', 'size', 'kinds', 'aiEasy', 'aiNormal', 'aiHard']);
  E.setTune('gems', null); const m = E.newMini('gems', E.makeRng('a')); E.setTune('gems', OFF);
  assert.deepEqual([m.n, m.kinds, m.b.length, m.pts, m.last, m.tune], [7, 6, 49, { X: 0, O: 0 }, null, undefined]);
  assert.equal(R.gemsCfg(m).even, true, 'Equal turns on by default');
  assert.ok(/^[0-5]{49}$/.test(m.b));
  assert.equal(E.secretOf(m), null);
  assert.deepEqual(R.gemsCfg(m).target, 32);
  assert.equal(JSON.stringify(E.publicMini(m)), JSON.stringify(Object.assign({}, m, { tune: undefined })), 'the public view is the whole square: nothing to hide');
  assert.equal(R.timeoutClose(m, 'X'), null);
  assert.ok(!/slot|jackpot|bet|casino|bejewel|candy/i.test(JSON.stringify([M.info, M.explainer])));
});

test('gems: every dealt board, at every size and number of kinds, has no line ready and a swap to make; so has a shuffled one; a deal ends under an rng that never varies', () => {
  for (const n of [5, 6, 7, 8]) for (const kinds of [4, 5, 6]) {
    const rng = E.makeRng(`deal:${n}:${kinds}`);
    for (let k = 0; k < 60; k++) { const g = R.gemsDeal(n, kinds, rng); assert.equal(g.length, n * n); assert.ok(g.every(v => Number.isInteger(v) && v >= 0 && v < kinds)); assert.ok(sound(g, n), `a dealt ${n}x${n} of ${kinds}`); }
    for (let k = 0; k < 20; k++) assert.ok(sound(R.gemsOpen(n, kinds, rng), n), `an opening ${n}x${n} of ${kinds}`);
    const dead = Array.from({ length: n * n }, (_, i) => (i % n + 2 * Math.floor(i / n)) % 3);   // stripes: no line, no swap
    assert.deepEqual([R.gemsLines(dead, n).length, R.gemsMoves(dead, n).length], [0, 0]);
    for (let k = 0; k < 20; k++) { const g = R.gemsShuffle(dead, n, kinds, rng); assert.ok(sound(g, n), 'a shuffled board'); }
    assert.ok(sound(R.gemsPlain(n), n), 'the set board');
  }
  for (const v of [0, 0.5, 0.999]) { const g = R.gemsDeal(7, 6, () => v); assert.ok(sound(g, 7), `a deal under a constant ${v}`); }
  withTune({ size: 5, kinds: 4 }, () => { const m = E.newMini('gems', E.makeRng('b')); assert.deepEqual([m.n, m.kinds, m.b.length], [5, 4, 25]); assert.deepEqual(m.tune, { even: 'off', size: 5, kinds: 4 }); });
  // the opening is a settled board: a fresh deal's best swap is surer of more than a board in play gives
  const rng = E.makeRng('settle'), best = g => Math.max(...R.gemsMoves(g, 7).map(m => R.gemsResolve(g, 7, 6, m[0], m[1], null).pts));
  let fresh = 0, open = 0; for (let k = 0; k < 300; k++) { fresh += best(R.gemsDeal(7, 6, rng)); open += best(R.gemsOpen(7, 6, rng)); }
  assert.ok(fresh / 300 > open / 300 + 1, `a fresh deal's best swap ${(fresh / 300).toFixed(2)}, an opening board's ${(open / 300).toFixed(2)}`);
});

test('gems: a move is two neighbours whose swap makes a line; anything else is refused and changes nothing', () => {
  const m = square(['0102345', '1021534', '2345012', '3450123', '4501234', '5012345', '0123450']);
  assert.ok(sound(arr(m.b), 7));
  const before = JSON.stringify(m), rng = E.makeRng('x');
  for (const bad of [null, undefined, 'swap', 7, [], {}, { a: 0 }, { a: 0, b: '1' }, { a: 0.5, b: 1 }, { a: -1, b: 0 }, { a: 48, b: 49 }])
    assert.deepEqual([E.applyMove(m, 'X', bad, rng).ok, E.applyMove(m, 'X', bad, rng).reason], [false, 'bad'], JSON.stringify(bad));
  for (const far of [{ a: 0, b: 0 }, { a: 0, b: 2 }, { a: 0, b: 8 }, { a: 6, b: 7 }, { a: 0, b: 14 }, { a: 13, b: 14 }]) assert.equal(E.applyMove(m, 'X', far, rng).reason, 'apart', JSON.stringify(far));   // (6 and 7: the end of one row and the start of the next)
  assert.equal(E.applyMove(m, 'X', { a: 3, b: 4 }, rng).reason, 'noline');
  assert.equal(JSON.stringify(m), before, 'nothing changed');
  // 0 1 0 / 1 0 2: the 0 under the 1 goes up: three 0s along the top
  assert.ok(R.gemsValid(arr(m.b), 7, 1, 8)); assert.ok(R.gemsValid(arr(m.b), 7, 8, 1), 'either way round');
  const r = E.applyMove(m, 'O', { a: 8, b: 1 }, rng);
  assert.deepEqual([r.ok, r.outcome, m.last.by, m.last.a, m.last.b, m.last.steps[0].x], [true, 'continue', 'O', 8, 1, [0, 1, 2]]);
  assert.equal(m.last.was, JSON.parse(before).b);
  assert.ok(m.pts.O >= 3 && m.pts.X === 0);
});

test('gems: the board settles: lines go, gems fall, the top fills, and again; a gem in two lines counts once; the points are the gems removed', () => {
  // a cross: the swap brings a 0 to the middle of a row of 0s and a column of 0s (five cells in all, the middle one once)
  const g = arr(['12012', '34043', '00100', '21032', '43023'].join('')), n = 5;
  assert.equal(R.gemsLines(g, n).length, 0);
  const res = R.gemsResolve(g, n, 5, 12, 17, null);                // the 1 in the middle goes down, the 0 under it comes up
  assert.deepEqual(res.steps[0].x, [2, 7, 10, 11, 12, 13, 14], 'the row of five and the column of three: seven cells, the crossing once');
  assert.equal(res.pts, res.steps.reduce((s, st) => s + st.x.length, 0));
  // with no rng the new gems are not known (-1) and line up with nothing
  assert.ok(res.g.filter(v => v === -1).length === 7 && R.gemsLines(res.g, n).every(i => res.g[i] >= 0));
  assert.deepEqual([res.g[20], res.g[21], res.g[23], res.g[24]], [4, 3, 2, 3], 'the bottom row stays');
  assert.deepEqual([res.g[10], res.g[11], res.g[13], res.g[14]], [3, 4, 4, 3], 'the row above the line came down into it');
  assert.equal(R.gemsResolve(g, n, 5, 0, 1, null), null, 'a swap that makes no line: nothing');
  // a cascade the board itself decides: clearing the 1s lets the two 2s above them fall beside the 2 that was swapped
  const c = arr(['30343', '04034', '02242', '11213', '34120'].join(''));
  assert.equal(R.gemsLines(c, 5).length, 0);
  const cas = R.gemsResolve(c, 5, 5, 17, 18, null);                // the 2 and the 1 in the fourth row change places: 1 1 1
  assert.deepEqual(cas.steps.map(s => s.x), [[15, 16, 17], [16, 17, 18]], 'three 1s, then the two 2s that fell beside the 2');
  assert.equal(cas.pts, 6);
});

test('gems: what a move records plays it again exactly; the points equal the gems removed; the board left has no line and a swap; a board with no swap is shuffled', () => {
  let moves = 0, shuffles = 0, cascades = 0;
  for (const [size, kinds, games] of [[7, 6, 60], [7, 5, 20], [5, 6, 60], [8, 4, 10]]) withTune({ size, kinds, target: 80 }, () => {
    for (let g = 0; g < games; g++) {
      const rng = E.makeRng(`rec:${size}:${kinds}:${g}`), m = E.newMini('gems', rng); let p = 'X';
      for (let k = 0; k < 40; k++) {
        const was = m.b, pts = m.pts[p], r = E.applyMove(m, p, E.randomLegalMove(m, p, rng), rng), l = m.last;
        assert.ok(r.ok, r.reason); moves++;
        assert.equal(l.was, was); assert.equal(l.n, l.steps.reduce((s, st) => s + st.x.length, 0)); assert.ok(l.n >= 3);
        assert.deepEqual([l.from, l.to, m.pts[p]], [pts, pts + l.n, pts + l.n], 'a point a gem');
        for (const st of l.steps) { assert.equal(new Set(st.x).size, st.x.length); assert.equal(st.g.length, st.x.length, 'as many new gems as went'); assert.ok(new RegExp(`^[0-${kinds - 1}]+$`).test(st.g)); }
        const fr = R.gemsFrames(l, m.n);
        assert.equal(fr.length, l.steps.length + 2);
        l.steps.forEach((st, i) => assert.deepEqual(R.gemsLines(fr[i + 1], m.n), st.x, 'each step removes exactly the lines on the board before it'));
        const end = R.gemsStr(fr[fr.length - 1]);
        if (l.sh) { shuffles++; assert.equal(m.b, l.sh); assert.equal(R.gemsMoves(arr(end), m.n).length, 0, 'shuffled only where no swap was left'); assert.equal(arr(end).slice().sort().join(''), arr(l.sh).slice().sort().join(''), 'the same gems, laid out again'); }
        else assert.equal(m.b, end, 'the steps replay to the board');
        assert.ok(sound(arr(m.b), m.n));
        if (l.steps.length > 1) cascades++;
        if (r.outcome !== 'continue') break;
        p = other(p);
      }
    }
  });
  assert.ok(moves > 2000 && cascades > 300 && shuffles > 20, `${moves} moves, ${cascades} cascades, ${shuffles} shuffles`);
});

test('gems: first to the target takes the square at once; a player moving alone gets there; random play always ends', () => {
  const m = square(['0102345', '1021534', '2345012', '3450123', '4501234', '5012345', '0123450'], { X: 29, O: 31 });
  const r = E.applyMove(m, 'X', { a: 1, b: 8 }, E.makeRng('w'));
  assert.deepEqual([r.outcome, r.note, r.winner], ['win', 'won', undefined]); assert.ok(m.pts.X >= 32);
  for (let g = 0; g < 40; g++) {                                    // O never moves (every turn missed): X still wins
    const rng = E.makeRng('alone' + g), s = E.newMini('gems', rng); let done = false;
    for (let k = 0; k < 40 && !done; k++) { const x = E.applyMove(s, 'X', E.randomLegalMove(s, 'X', rng), rng); assert.ok(x.ok); done = x.outcome === 'win'; }
    assert.ok(done, 'won alone'); assert.equal(s.pts.O, 0);
  }
  let turns = 0;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('rand' + g), s = E.newMini('gems', rng); let p = 'X', end = null;
    for (let k = 0; k < 60 && !end; k++) { const x = E.applyMove(s, p, E.randomLegalMove(s, p, rng), rng); assert.ok(x.ok); turns++; if (x.outcome !== 'continue') end = x; else p = other(p); }
    assert.ok(end && end.outcome === 'win', 'the square ended'); assert.ok(Math.max(s.pts.X, s.pts.O) >= 32);
  }
  assert.ok(turns / 300 > 6, 'no square is over in a turn or two as a rule');
});

test('gems: Go again on success: off, a swap is the turn; on, a swap that removes enough gems keeps it', () => {
  const play = (tune, n) => withTune(tune, () => {
    let again = 0, small = 0;
    for (let g = 0; g < n; g++) {
      const rng = E.makeRng('ga' + g), m = E.newMini('gems', rng); let p = 'X';
      for (let k = 0; k < 60; k++) {
        const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal' }).move, rng); assert.ok(r.ok);
        if (r.outcome !== 'continue') break;
        if (r.again) { again++; assert.ok(m.last.n >= R.gemsCfg(m).againAt); assert.equal(m.go, p); assert.equal(r.note, 'combo'); } else { if (R.gemsCfg(m).again) assert.ok(m.last.n < R.gemsCfg(m).againAt); small++; assert.equal(m.go, null); p = other(p); }
      }
    }
    return { again, small };
  });
  assert.equal(play(null, 12).again, 0);
  const on = play({ again: 'on' }, 12); assert.ok(on.again > 10 && on.small > 10);
  assert.ok(play({ again: 'on', againAt: 12 }, 12).again < on.again);
  assert.equal(E.gameFields('gems').find(f => f.k === 'again').def, 'off');
  assert.equal(M.explainVars({ again: 'on', againAt: 6 }).goAgain, ' Burst 6 or more with one swap and you go again.'); assert.equal(M.explainVars({ again: 'off' }).goAgain, '');
});

test('gems: Equal turns (a setting, on by default): the first to move reaching the target gives the other player a turn to answer', () => {
  const rows = ['0102345', '1021534', '2345012', '3450123', '4501234', '5012345', '0123450'], mv = { a: 1, b: 8 };
  const at = (pts, turns) => { const m = square(rows, pts); m.turns = turns; return m; };
  assert.equal(E.gameFields('gems').find(f => f.k === 'even').def, 'on');
  withTune({ even: 'on' }, () => {
    // X has had a turn more once it moves: it reaches the target and the square waits for O's answer
    let m = at({ X: 30, O: 10 }, { X: 3, O: 3 }), r = E.applyMove(m, 'X', mv, E.makeRng('e1'));
    assert.deepEqual([r.outcome, r.note, r.again, m.final.by, m.final.pts], ['continue', 'reached', undefined, 'X', m.pts.X]); assert.ok(m.pts.X >= 33, 'the totals are kept whole');
    // O, moving second, reaches it with turns level: its square at once
    m = at({ X: 10, O: 30 }, { X: 3, O: 2 }); r = E.applyMove(m, 'O', mv, E.makeRng('e2')); assert.deepEqual([r.outcome, r.note], ['win', 'won']);
    // the answer: past the leader takes it, level is a draw, short leaves it to the leader
    const answer = (o, seed) => { const s = at({ X: 34, O: o }, { X: 4, O: 3 }); s.final = { by: 'X', pts: 34 }; const x = E.applyMove(s, 'O', mv, E.makeRng(seed)); return [x.outcome, x.note, x.winner, s.pts.O]; };
    let seen = {};
    for (let k = 0; k < 40; k++) for (const o of [20, 28, 30, 31, 33]) { const [out, note, w, pts] = answer(o, 'ans' + k); seen[note] = 1; if (pts > 34) assert.deepEqual([out, note, w], ['win', 'passed', undefined]); else if (pts === 34) assert.deepEqual([out, note], ['draw', 'tie']); else assert.deepEqual([out, note, w], ['win', 'held', 'X']); }
    assert.deepEqual(Object.keys(seen).sort(), ['held', 'passed', 'tie']);
    // an answer never made (O's turn missed): the leader's next swap there takes the square
    m = at({ X: 34, O: 20 }, { X: 4, O: 3 }); m.final = { by: 'X', pts: 34 }; r = E.applyMove(m, 'X', mv, E.makeRng('e3')); assert.deepEqual([r.outcome, r.note, r.winner], ['win', 'unanswered', undefined]);
    // the computer answering goes for all it can get; the square's needs are one move for either side
    m = at({ X: 34, O: 20 }, { X: 4, O: 3 }); m.final = { by: 'X', pts: 34 };
    assert.deepEqual([A.needs(E.publicMini(m), 'X'), A.needs(E.publicMini(m), 'O')], [1, 1]);
    for (const level of ['easy', 'normal', 'hard']) assert.ok(E.applyMove(JSON.parse(JSON.stringify(m)), 'O', E.localBest(E.publicMini(m, 'O'), 'O', E.makeRng(level), {}, { level, until: null }).move, E.makeRng('z')).ok);
    // whole squares: they end, some by an answer, a few level
    let notes = {};
    for (let g = 0; g < 200; g++) { const rng = E.makeRng('ev' + g), s = E.newMini('gems', rng); let p = 'X', end = null; for (let k = 0; k < 60 && !end; k++) { const x = E.applyMove(s, p, E.localBest(E.publicMini(s, p), p, rng, {}, { level: 'normal' }).move, rng); assert.ok(x.ok); if (x.outcome !== 'continue') end = x; else p = other(p); } assert.ok(end); notes[end.note] = (notes[end.note] || 0) + 1; }
    assert.ok(notes.won && notes.passed && notes.held, JSON.stringify(notes));
  });
  const off = at({ X: 30, O: 10 }, { X: 3, O: 3 }); assert.equal(E.applyMove(off, 'X', mv, E.makeRng('e1')).outcome, 'win');
  assert.ok(M.explainVars({ even: 'on' }).evenText.length > 20); assert.equal(M.explainVars({ even: 'off' }).evenText, '');
});

test('gems: the computer: always a legal swap at every level; Normal the swap sure of most; Hard takes a win, leaves less behind, and keeps to its time', () => {
  const known = (m, mv) => R.gemsResolve(arr(m.b), m.n, m.kinds, mv.a, mv.b, null);
  const bestKnown = g => Math.max(0, ...R.gemsMoves(g, 7).map(x => R.gemsResolve(g, 7, 6, x[0], x[1], null).pts));
  E.setTune('gems', { aiNormal: 0 });                               // (Normal's swaps at random off: its own choice tested here)
  let left = { normal: 0, hard: 0 }, n = 0;
  for (let g = 0; g < 60; g++) {
    const rng = E.makeRng('ai' + g), m = E.newMini('gems', rng); let p = 'X';
    for (let k = 0; k < 8; k++) {
      const pm = E.publicMini(m, p), top = bestKnown(arr(m.b));
      for (const level of ['easy', 'normal', 'hard']) {
        const b = E.localBest(pm, p, E.makeRng(level + g + k), {}, { level, until: level === 'hard' && k % 2 ? () => 0 : null }), res = known(m, b.move);
        assert.ok(res, `${level}: a swap that makes a line`); assert.ok(b.q >= 0 && b.q <= 1);
        if (level === 'normal') assert.equal(res.pts, top, 'Normal takes the swap sure of most');
        if (level !== 'easy' && !(level === 'hard' && k % 2)) left[level] += bestKnown(res.g);
      }
      n++;
      const r = E.applyMove(m, p, E.randomLegalMove(m, p, rng), rng); if (r.outcome !== 'continue') break; p = other(p);
    }
  }
  E.setTune('gems', null);
  assert.ok(left.hard < left.normal, `Hard leaves the other side less (${left.hard} against ${left.normal})`);
  // a win on the board is taken at once, at every level that thinks
  const w = square(['0102345', '1021534', '2345012', '3450123', '4501234', '5012345', '0123450'], { X: 29, O: 0 });
  for (const level of ['normal', 'hard']) { const b = E.localBest(E.publicMini(w, 'X'), 'X', E.makeRng(level), {}, { level, until: null }); assert.ok(known(w, b.move).pts >= 3); assert.equal(b.q, 1); }
  assert.ok(A.needs(E.publicMini(w), 'O') > A.needs(E.publicMini(w), 'X')); assert.equal(A.needs(E.publicMini(w), 'X'), 1);
  // Hard against Easy over whole squares
  let hard = 0;
  for (let g = 0; g < 40; g++) {
    const rng = E.makeRng('he' + g), m = E.newMini('gems', rng), lv = g % 2 ? { X: 'hard', O: 'easy' } : { X: 'easy', O: 'hard' }; let p = 'X';
    for (let k = 0; k < 80; k++) { const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: lv[p], until: null }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome !== 'continue') { if (lv[r.winner || p] === 'hard') hard++; break; } p = other(p); }
  }
  assert.ok(hard >= 26, `Hard beat Easy in ${hard} of 40`);
});

test('gems: a move is the server\'s: two draws of the new gems never agree, so a phone never shows its own guess; the flash carries the whole move and its time', () => {
  for (const kinds of [4, 5, 6]) withTune({ kinds }, () => {
    for (let g = 0; g < 30; g++) {
      const m = E.newMini('gems', E.makeRng(`pr:${kinds}:${g}`));
      for (const mv of R.gemsMoves(arr(m.b), m.n)) {
        const a = JSON.parse(JSON.stringify(m)), b = JSON.parse(JSON.stringify(m));
        E.applyMove(a, 'X', { a: mv[0], b: mv[1] }, E.makeRng('pa')); E.applyMove(b, 'X', { a: mv[0], b: mv[1] }, E.makeRng('pb'));   // (net/moves.js predictMove's two seeds)
        assert.notEqual(JSON.stringify(a.last), JSON.stringify(b.last));
      }
    }
  });
  const st = E.newMatch(E.makeRng('i'), { games: ['gems'] }), mv = E.randomLegalMove(st.squares[4].mini, 'X', E.makeRng('j'));
  assert.ok(E.playMove(st, 4, mv, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.gs).filter(k => k !== 'sh').sort(), ['a', 'b', 'by', 'from', 'n', 'steps', 'to', 'was']);
  const T = R.gemsTimes(st.flash.gs), G = R.GEMS, k = st.flash.gs.steps.length;
  assert.equal(T.steps.length, k); assert.equal(T.steps[0].pop, G.swap); assert.equal(T.casc, G.swap + k * (G.pop + G.fall + G.gap));
  assert.equal(R.flashMs(st.flash, 0, false), T.end + G.hold); assert.equal(R.flashMs(st.flash, 0, true), T.end + G.hold + 500);
  assert.equal(R.gemsTimes({ steps: [{}, {}], sh: 'x' }).end, G.swap + 2 * (G.pop + G.fall + G.gap) + G.shuffle);
});

test('gems: a board in play always has a swap to make: thousands of moves at every size and number of kinds, by random hands and the computer, never leave a board with no swap or a line standing; a board left with none is shuffled and the shuffle is on the record', () => {
  let boards = 0, shuffles = 0;
  for (const n of [5, 6, 7, 8]) for (const kinds of [4, 5, 6]) withTune({ size: n, kinds }, () => {
    for (let sq = 0; sq < 6; sq++) {
      const rng = E.makeRng(`play:${n}:${kinds}:${sq}`); let m = E.newMini('gems', rng);
      assert.ok(sound(R.gemsArr(m.b), n), `the opening board ${n}x${n} of ${kinds}`);
      let p = 'X';
      for (let k = 0; k < 120; k++) {
        const level = ['easy', 'normal', 'hard'][k % 3], all = R.gemsMoves(R.gemsArr(m.b), n);
        assert.ok(all.length > 0, `a swap to make (${n}x${n} of ${kinds}, square ${sq}, move ${k})`);
        const mv = k % 2 ? { a: all[Math.floor(rng() * all.length)][0], b: all[Math.floor(rng() * all.length)][1] } : E.localBest(E.publicMini(m, p), p, rng, {}, { level, until: null }).move;
        let r = E.applyMove(m, p, mv, rng);
        if (!r.ok) { const one = all[Math.floor(rng() * all.length)]; r = E.applyMove(m, p, { a: one[0], b: one[1] }, rng); }
        assert.equal(r.ok, true, 'a swap the board offers is taken');
        const g = R.gemsArr(m.b); boards++;
        assert.ok(sound(g, n), `after the move: no line standing and a swap to make (${n}x${n} of ${kinds})`);
        if (m.last.sh) { shuffles++; assert.equal(m.last.sh, m.b, 'a shuffle is on the record: the board laid out again is the board in play'); }
        if (r.outcome !== 'continue') { m = E.newMini('gems', rng); assert.ok(sound(R.gemsArr(m.b), n), 'a fresh square'); p = 'X'; continue; }   // (a square won: play on in a fresh one)
        p = r.again ? p : p === 'X' ? 'O' : 'X';
      }
    }
  });
  // a move that leaves no swap is followed by a shuffle (forced: a board whose only swap clears the way to a dead one)
  const n = 5, dead = Array.from({ length: n * n }, (_, i) => (i % n + 2 * Math.floor(i / n)) % 3);
  assert.equal(R.gemsMoves(dead, n).length, 0);
  for (let k = 0; k < 40; k++) { const g = R.gemsShuffle(dead, n, 3, E.makeRng('dead' + k)); assert.ok(sound(g, n)); boards++; }
  assert.ok(boards > 5000, `boards checked: ${boards}`);
  console.log(`  ${boards} boards checked, ${shuffles} shuffles in play`);
});
