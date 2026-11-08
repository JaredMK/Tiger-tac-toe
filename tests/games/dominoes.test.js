'use strict';
// Dominoes: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/dominoes/ai.js');
const R = require('../../src/games/dominoes/rules.js');
const { timeoutClose } = require('../../src/core/board.js');
E.setPhysics(require('../physics.js'));
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const id = (a, b) => { const [x, y] = a <= b ? [a, b] : [b, a]; return y * (y + 1) / 2 + x; };   // a tile's id in the set (0-0, 0-1, 1-1, 0-2, ...)
const sq = o => Object.assign({ type: 'dominoes', pips: 6, line: [], left: 0, hands: { X: [], O: [] }, pile: [], played: { X: 0, O: 0 }, last: null }, o);
const all = () => Array.from({ length: 28 }, (_, k) => k);

/* ===================================== Dominoes ===================================== */
test('dominoes: the deal: a double-six set of 28 tiles, three each by default (the opener draws one more), the rest the boneyard; no tile twice; the admin\'s set and hands', () => {
  assert.equal(R.domSet(6).length, 28); assert.deepEqual(R.domSet(6).slice(0, 5), [[0, 0], [0, 1], [1, 1], [0, 2], [1, 2]]); assert.deepEqual(R.domSet(6)[27], [6, 6]);
  assert.equal(R.domTileCount(5), 21); assert.equal(R.domTileCount(4), 15);
  const m = E.newMini('dominoes', E.makeRng('dm'));
  assert.equal(m.pips, 6); assert.equal(m.hands.X.length, 3); assert.equal(m.hands.O.length, 3); assert.equal(m.pile.length, 22); assert.equal(m.openDraw, 1);
  assert.deepEqual([...m.hands.X, ...m.hands.O, ...m.pile].sort((a, b) => a - b), all());
  assert.deepEqual(m.line, []); assert.equal(m.left, 0); assert.equal(m.last, null);
  assert.ok(m.hands.X.every((k, i) => i === 0 || k > m.hands.X[i - 1]), 'a hand kept sorted');
  E.setTune('dominoes', { pips: 5, hand: 9, openDraw: 0 });
  const m5 = E.newMini('dominoes', E.makeRng('dm5'));
  E.setTune('dominoes', null);
  assert.deepEqual(m5.tune, { pips: 5, hand: 9, openDraw: 0 });
  assert.equal(m5.pips, 5); assert.equal(m5.hands.X.length, 9); assert.equal(m5.pile.length, 3); assert.equal(m5.openDraw, undefined);
  assert.equal(R.domTile(m5, 20)[1], 5);
  for (const bad of ['roll', -1, 28, null, [1], { t: 'x' }, { t: 3, e: 'M' }]) assert.equal(E.applyMove(m, 'X', bad, lcg(1)).ok, false, JSON.stringify(bad));
});

test('dominoes: placing: the first tile starts the line (and the opener draws one), a tile goes on the end it matches, turned to meet it; both ends fitting, the move names one; the line\'s left end counts in `left`', () => {
  const m = sq({ hands: { X: [id(2, 5), id(3, 4), id(5, 5)], O: [id(2, 2), id(4, 6), id(1, 3)] }, pile: [id(0, 0), id(6, 6), id(1, 1)], openDraw: 1 });
  assert.deepEqual(R.domEnds(m), null); assert.deepEqual(R.domFits(m, id(3, 4)), ['L', 'R']);
  assert.equal(E.applyMove(m, 'X', { t: id(2, 2) }, lcg(1)).reason, 'nothand');
  assert.deepEqual(E.applyMove(m, 'X', { t: id(2, 5) }, lcg(1)), { ok: true, outcome: 'continue', note: 'play' });
  assert.deepEqual(m.line, [[2, 5, 'X']]); assert.deepEqual(R.domEnds(m), [2, 5]);
  assert.deepEqual(m.hands.X, [id(1, 1), id(3, 4), id(5, 5)], 'the opener drew the boneyard\'s top tile (1-1)'); assert.equal(m.pile.length, 2);
  assert.deepEqual(m.last, { by: 'X', kind: 'play', t: id(2, 5), tile: [2, 5], e: 'R', pos: 0, left: 3, pile: 2, open: true });
  // O: 2-2 fits the left end alone (a double, turned either way), 4-6 fits nothing, 1-3 nothing
  assert.deepEqual(R.domFits(m, id(2, 2)), ['L']); assert.deepEqual(R.domFits(m, id(4, 6)), []); assert.deepEqual(R.domFits(m, id(1, 3)), []);
  assert.equal(E.applyMove(m, 'O', { t: id(4, 6), e: 'R' }, lcg(1)).reason, 'nofit');
  assert.equal(E.applyMove(m, 'O', { t: id(2, 2), e: 'R' }, lcg(1)).reason, 'nofit', 'the end named must take it');
  assert.equal(E.applyMove(m, 'O', 'draw', lcg(1)).reason, 'canplay', 'a tile fits: no draw');
  assert.equal(E.applyMove(m, 'O', { t: id(2, 2) }, lcg(1)).ok, true, 'one end alone: the end need not be named');
  assert.deepEqual(m.line, [[2, 2, 'O'], [2, 5, 'X']]); assert.equal(m.left, 1); assert.equal(m.last.pos, -1); assert.equal(m.last.e, 'L');
  // X: 5-5 fits the right end; 3-4 nothing; the ends 2 and 5
  assert.equal(E.applyMove(m, 'X', { t: id(5, 5), e: 'R' }, lcg(1)).ok, true);
  assert.deepEqual(m.line.map(t => t.slice(0, 2)), [[2, 2], [2, 5], [5, 5]]); assert.deepEqual(R.domEnds(m), [2, 5]);
  // a tile fitting both ends with different values must name one; a 2-5 would: give X one
  m.hands.X.push(id(2, 5)); m.hands.X.sort((a, b) => a - b);
  assert.deepEqual(R.domFits(m, id(2, 5)), ['L', 'R']);
  assert.equal(E.applyMove(m, 'X', { t: id(2, 5) }, lcg(1)).reason, 'end');
  assert.equal(E.applyMove(m, 'X', { t: id(2, 5), e: 'L' }, lcg(1)).ok, true);
  assert.deepEqual(m.line[0].slice(0, 2), [5, 2], 'turned so its 2 meets the line\'s 2'); assert.deepEqual(R.domEnds(m), [5, 5]); assert.equal(m.left, 2);
  // both ends the same value: no end needed (the right one is taken)
  m.hands.O.push(id(5, 6));
  assert.equal(E.applyMove(m, 'O', { t: id(5, 6) }, lcg(1)).ok, true); assert.equal(m.last.e, 'R'); assert.deepEqual(m.line[m.line.length - 1].slice(0, 2), [5, 6]);
  assert.equal(m.played.X, 3); assert.equal(m.played.O, 2);
});

test('dominoes: drawing: with nothing that fits, tiles come off the boneyard until one does and the turn goes on (again); the boneyard running out first ends the turn as a pass; a pass alone only once it is empty', () => {
  const m = sq({ line: [[3, 4, 'X']], hands: { X: [id(0, 0), id(1, 1)], O: [id(2, 2), id(5, 5), id(6, 6)] }, pile: [id(4, 6), id(1, 2), id(5, 6)] });   // the pile is drawn from its end: 5-6, then 1-2, then 4-6
  assert.equal(E.applyMove(m, 'O', 'pass', lcg(1)).reason, 'draw', 'tiles in the boneyard: a draw, not a pass');
  assert.deepEqual(E.applyMove(m, 'O', 'draw', lcg(1)), { ok: true, outcome: 'continue', note: 'draw', again: true });
  assert.deepEqual(m.last, { by: 'O', kind: 'draw', drew: 3, fits: true, left: 6, pile: 0 }, 'three tiles until the 4-6 fit');
  assert.deepEqual(m.hands.O, [id(1, 2), id(2, 2), id(5, 5), id(4, 6), id(5, 6), id(6, 6)]);
  assert.equal(E.applyMove(m, 'O', 'draw', lcg(1)).reason, 'canplay');
  assert.equal(E.applyMove(m, 'O', { t: id(4, 6) }, lcg(1)).ok, true); assert.deepEqual(R.domEnds(m), [3, 6]);
  // X: nothing fits, the boneyard empty: a pass (O can still play its 5-6 or 6-6: not blocked)
  assert.equal(E.applyMove(m, 'X', 'draw', lcg(1)).reason, 'empty');
  assert.deepEqual(E.applyMove(m, 'X', 'pass', lcg(1)), { ok: true, outcome: 'continue', note: 'pass' });
  assert.deepEqual(m.last, { by: 'X', kind: 'pass', left: 2, pile: 0 });
  // a draw that runs the boneyard dry without a fit ends the turn (no again), as a pass
  const m2 = sq({ line: [[3, 4, 'X']], hands: { X: [id(0, 0)], O: [id(2, 2), id(3, 5)] }, pile: [id(1, 1), id(0, 1)] });
  const r = E.applyMove(m2, 'X', 'draw', lcg(1));
  assert.deepEqual(r, { ok: true, outcome: 'continue', note: 'pass' }); assert.deepEqual(m2.last, { by: 'X', kind: 'draw', drew: 2, fits: false, left: 3, pile: 0 });
  assert.equal(E.randomLegalMove(m2, 'X', lcg(2)), 'pass'); assert.deepEqual(E.randomLegalMove(m2, 'O', lcg(2)), { t: id(3, 5), e: 'L' });
  assert.equal(E.randomLegalMove(sq({ hands: { X: [id(0, 0)], O: [] }, pile: [1] }), 'O', lcg(3)), 'draw');
});

test('dominoes: the end: the last tile out wins the square; the game blocked goes to the fewer pips in hand (the other side can win it on the opponent\'s move); level pips are a draw (the square resets)', () => {
  const m = sq({ line: [[3, 4, 'X']], hands: { X: [id(4, 4)], O: [id(2, 2), id(5, 5)] }, pile: [] });
  assert.deepEqual(E.applyMove(m, 'X', { t: id(4, 4) }, lcg(1)), { ok: true, outcome: 'win', note: 'out' });
  assert.deepEqual(m.hands.X, []); assert.equal(m.last.left, 0);
  // blocked by O's draw running out: X holds 0-0 (0 pips), O 6-6 and 5-5 (22): X wins on O's move
  const b = sq({ line: [[3, 4, 'X']], hands: { X: [id(0, 0)], O: [id(6, 6), id(5, 5)] }, pile: [id(1, 1)] });
  assert.deepEqual(E.applyMove(b, 'O', 'draw', lcg(1)), { ok: true, outcome: 'win', winner: 'X', note: 'blocked' });
  assert.deepEqual(b.last, { by: 'O', kind: 'draw', drew: 1, fits: false, left: 3, pile: 0, blocked: true, pips: { X: 0, O: 24 } });
  // blocked by a placement: the tile laid leaves neither side a move, the boneyard empty
  const c = sq({ line: [[3, 4, 'X']], hands: { X: [id(4, 4), id(1, 1)], O: [id(0, 0)] }, pile: [] });
  assert.deepEqual(E.applyMove(c, 'X', { t: id(4, 4) }, lcg(1)), { ok: true, outcome: 'win', winner: 'O', note: 'blocked' });
  assert.deepEqual(c.last.pips, { X: 2, O: 0 });
  // level: a draw (the square resets, core/board.js)
  const d = sq({ line: [[3, 4, 'X']], hands: { X: [id(4, 4), id(0, 2)], O: [id(1, 1)] }, pile: [] });
  assert.deepEqual(E.applyMove(d, 'X', { t: id(4, 4) }, lcg(1)), { ok: true, outcome: 'draw', note: 'tie' });
  assert.deepEqual(d.last.pips, { X: 2, O: 2 });
  // through playMove: the square goes to the winner; a level block resets it
  const st = E.newMatch(E.makeRng('dm-st'), { games: ['ttt', 'dominoes'] });
  st.squares[0] = { owner: null, mini: sq({ line: [[3, 4, 'X']], hands: { X: [id(4, 4), id(1, 1)], O: [id(0, 0)] }, pile: [] }) }; st.turn = 'X';
  const r = E.playMove(st, 0, { t: id(4, 4), e: 'R' }, lcg(2));
  assert.ok(r.ok); assert.equal(st.squares[0].owner, 'O'); assert.equal(st.flash.kind, 'claim'); assert.equal(st.flash.winner, 'O'); assert.equal(st.flash.note, 'blocked');
  assert.deepEqual(st.flash.dom, { by: 'X', kind: 'play', t: id(4, 4), tile: [4, 4], e: 'R', pos: 1, left: 1, pile: 0, blocked: true, pips: { X: 2, O: 0 } });
  assert.deepEqual(st.flash.m, { t: id(4, 4), e: 'R' }, 'the move rides the flash for the replay');
  const st2 = E.newMatch(E.makeRng('dm-st2'), { games: ['ttt', 'dominoes'] });
  st2.squares[0] = { owner: null, mini: sq({ line: [[3, 4, 'X']], hands: { X: [id(4, 4), id(0, 2)], O: [id(1, 1)] }, pile: [] }) }; st2.turn = 'X'; st2.flash = null; st2.done = null;
  const r2 = E.playMove(st2, 0, { t: id(4, 4), e: 'R' }, lcg(3));
  assert.ok(r2.ok, JSON.stringify(r2)); assert.equal(st2.flash.kind, 'draw'); assert.equal(st2.flash.note, 'tie'); assert.equal(st2.squares[0].owner, null); assert.ok(st2.flash.newType, 'a new mini-game dealt');
});

test('dominoes: the public view carries the line, both counts and the boneyard\'s size, never its tiles (the hands ride it for now: HANDS_PUBLIC); the record hides the boneyard and gives it back whole', () => {
  const m = E.newMini('dominoes', E.makeRng('dm-pub'));
  const pv = E.publicMini(m);
  assert.equal(pv.pile, undefined); assert.equal(pv.pileN, 22); assert.deepEqual(pv.n, { X: 3, O: 3 }); assert.deepEqual(pv.line, []); assert.equal(pv.openDraw, 1);
  assert.equal(R.HANDS_PUBLIC, true); assert.deepEqual(pv.hands, m.hands); assert.notEqual(pv.hands.X, m.hands.X, 'a copy');
  assert.deepEqual(E.secretOf(m), { pile: m.pile });
  assert.deepEqual(R.sideView(m, 'O'), { hand: m.hands.O });
  const st = E.newMatch(E.makeRng('dm-rec'), { games: ['dominoes'] });
  const rec = E.matchRecord(st);
  for (const q of rec.state.squares) { assert.equal(q.mini.pile, undefined); assert.equal(q.mini.pileN, 22); assert.deepEqual(q.mini.n, { X: 3, O: 3 }); }
  for (let k = 0; k < 9; k++) assert.equal(rec.secrets[k].pile.length, 22);
  const full = E.fullState(rec);
  full.squares.forEach((q, k) => { assert.deepEqual(q.mini.pile, st.squares[k].mini.pile); assert.deepEqual(q.mini.hands, st.squares[k].mini.hands); });
  assert.equal(R.domPile(rec.state.squares[0].mini), 22); assert.equal(R.domPile(full.squares[0].mini), 22);
  assert.equal(R.domCount(rec.state.squares[0].mini, 'X'), 3);
  // the counts and the size follow a move through the record
  const side = rec.state.turn, mini0 = E.fullState(rec).squares[0].mini;
  const mv = E.applyOnlineMove(rec, side, 0, { t: mini0.hands[side][0], e: 'R' }, lcg(4));
  assert.ok(mv.ok, JSON.stringify(mv));
  const q = mv.rec.state.squares[0].mini;
  assert.equal(q.line.length, 1); assert.equal(q.n[side], 3, 'played one, drew one (the opener)'); assert.equal(q.pileN, 21); assert.equal(mv.rec.secrets[0].pile.length, 21);
  assert.equal(mv.entries[0].dom.kind, 'play'); assert.equal(mv.entries[0].after.mini.pile, undefined);
  assert.equal(E.applyOnlineMove(mv.rec, mv.rec.state.turn, 0, 'auto', lcg(5)).ok, false, 'no automatic move from a phone');
});

test('dominoes: a timeout plays nothing: the turn is missed; a turn held by a draw (a tile that fits still to place) ends there, nothing placed, no miss', () => {
  const m = sq({ line: [[3, 4, 'X']], hands: { X: [id(0, 0)], O: [id(2, 2), id(5, 5), id(6, 6)] }, pile: [id(3, 3), id(1, 2)] });
  assert.equal(timeoutClose(m, 'O'), null);
  const st = E.newMatch(E.makeRng('dm-to'), { games: ['ttt', 'dominoes'] });
  st.squares[0] = { owner: null, mini: m }; st.turn = 'O'; st.timer = E.newTimer(30); st.lock = null;
  const r = E.timeoutMove(st, lcg(1));
  assert.deepEqual([r.ok, r.missed, st.turn, m.line.length], [true, 'O', 'X', 1]);
  // the draw holds the turn to the square
  st.turn = 'O'; st.flash = null; st.done = null;
  const d = E.playMove(st, 0, 'draw', lcg(2));
  assert.ok(d.ok); assert.equal(st.flash.kind, 'again'); assert.equal(st.lock, 0); assert.equal(st.turn, 'O');
  st.flash = null; E.endFlash && E.endFlash(st, false);
  const t = E.timeoutMove(st, lcg(3));
  assert.deepEqual([t.ok, t.ended, t.square, st.turn, st.lock], [true, true, 0, 'X', null]);
  assert.equal(m.line.length, 1, 'nothing placed for a player out of time'); assert.equal(st.timer.streak.O, 0, 'not a miss');
});

test('dominoes: the computer: needs falls with the hand (more with a full boneyard); Normal lays a fitting tile (the biggest, options kept), draws with nothing that fits, passes with the boneyard empty; Hard keeps to its budget and plays legally; q is 1 on its last tile', () => {
  const rng = lcg(7);
  const pm = E.publicMini(sq({ line: [[3, 4, 'X']], hands: { X: [id(0, 0), id(4, 6), id(3, 3)], O: [id(1, 1), id(2, 2), id(5, 5)] }, pile: all().filter(k => ![id(3, 4), id(0, 0), id(4, 6), id(3, 3), id(1, 1), id(2, 2), id(5, 5)].includes(k)) }));
  assert.ok(A.needs(pm, 'X') > 3 && A.needs(pm, 'X') < 4.5, 'three tiles and a full boneyard: ' + A.needs(pm, 'X'));
  assert.equal(A.needs(E.publicMini(sq({ line: [[3, 4, 'X']], hands: { X: [], O: [id(1, 1)] } })), 'X'), 0);
  assert.ok(A.needs(Object.assign({}, pm, { pileN: 0 }), 'X') < A.needs(pm, 'X'));
  for (const level of ['easy', 'normal', 'hard']) {
    const b = A.best(pm, 'X', rng, {}, { level, until: null });
    assert.ok([id(4, 6), id(3, 3)].includes(b.move.t), level + ': a tile that fits'); assert.equal(b.q, 0); assert.equal(b.shared, false);
    assert.equal(A.best(pm, 'O', rng, {}, { level, until: null }).move, 'draw', level + ': nothing fits: a draw');
    assert.equal(A.best(Object.assign({}, pm, { pileN: 0 }), 'O', rng, {}, { level, until: null }).move, 'pass');
  }
  const n = A.best(pm, 'X', rng, {}, { level: 'normal' });
  assert.equal(n.move.t, id(4, 6), 'Normal: the biggest tile that fits (10 pips), its end the 4'); assert.equal(n.move.e, 'R');
  const last = E.publicMini(sq({ line: [[3, 4, 'X']], hands: { X: [id(4, 6)], O: [id(1, 1)] }, pile: [id(0, 0)] }));
  assert.equal(A.best(last, 'X', rng, {}, { level: 'normal' }).q, 1, 'the last tile: the square');
  assert.equal(A.best(last, 'X', rng, {}, { level: 'hard' }).q, 1);
  // Hard: within a budget, and always a legal placement
  let calls = 0;
  const t0 = Date.now(), h = A.best(pm, 'X', rng, {}, { level: 'hard', until: () => { calls++; return 60 - (Date.now() - t0); } });
  assert.ok(Date.now() - t0 < 400, 'kept to its time'); assert.ok(calls > 0);
  assert.ok(R.domFits(pm, h.move.t).includes(h.move.e));
  for (let g = 0; g < 40; g++) {
    const m = E.newMini('dominoes', E.makeRng('dm-ai' + g));
    for (let k = 0; k < 6; k++) { const p = k % 2 ? 'O' : 'X', b = A.best(E.publicMini(m), p, rng, {}, { level: k % 3 ? 'hard' : 'normal', until: null }); const r = E.applyMove(m, p, b.move, rng); assert.ok(r.ok, JSON.stringify([b.move, r])); if (r.outcome !== 'continue') break; }
  }
  assert.deepEqual(E.localBest(pm, 'O', rng).move, 'draw');
  assert.equal(E.needsOf(pm, 'X'), A.needs(pm, 'X'));
});

test('dominoes: whole squares, computer against computer: every one ends, the winner takes about 4 to 6 turns, the first mover wins under 60%', () => {
  let first = 0, wTurns = 0, ties = 0;
  const N = 600;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('dm-sq' + g), m = E.newMini('dominoes', rng), turns = { X: 0, O: 0 };
    let p = 'X', done = false;
    for (let k = 0; k < 300 && !done; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level: g % 2 ? 'hard' : 'normal', until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok, JSON.stringify([b.move, r]));
      if (!r.again) turns[p]++;
      if (r.outcome === 'win') { done = true; const w = r.winner || p; if (w === 'X') first++; wTurns += turns[w] + (r.again ? 1 : 0); }
      else if (r.outcome === 'draw') { done = true; ties++; }
      else if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
    assert.ok(done, 'no end');
    assert.deepEqual([...m.hands.X, ...m.hands.O, ...m.pile, ...m.line.map(t => id(t[0], t[1]))].sort((a, b) => a - b), all(), 'every tile accounted for');
  }
  const dec = N - ties;
  assert.ok(first / dec < 0.6, `the first mover: ${(100 * first / dec).toFixed(1)}%`);
  assert.ok(wTurns / dec >= 4 && wTurns / dec <= 6.6, `the winner's turns: ${(wTurns / dec).toFixed(2)}`);
  assert.ok(ties / N < 0.03, `level blocks: ${(100 * ties / N).toFixed(1)}%`);
});

test('dominoes: the flash and its timings: a placement slides and lands, a draw slides off the boneyard, a pass knocks, a blocked end counts the pips; never dealt in Super Chaos', () => {
  const T = R.DOMT;
  assert.equal(R.flashMs({ dom: { kind: 'play' } }, 4, false), T.slide + T.land + T.hold);
  assert.equal(R.flashMs({ dom: { kind: 'play', left: 0 } }, 4, true), T.slide + T.land + T.hold + 500);
  assert.equal(R.flashMs({ dom: { kind: 'play', blocked: true } }, 4, true), T.slide + T.land + T.hold + T.count + 500);
  assert.equal(R.flashMs({ dom: { kind: 'draw', drew: 2 } }, 4, false), T.draw + 300);
  assert.equal(R.flashMs({ dom: { kind: 'pass' } }, 4, false), T.pass + 300);
  assert.deepEqual(R.domTimes({ kind: 'play' }), { land: T.slide + T.land, count: T.slide + T.land, pips: null, end: T.slide + T.land + T.hold });
  assert.equal(R.domTimes({ kind: 'play', blocked: true }).pips, T.slide + T.land + T.hold);
  assert.ok(!E.scTypes().includes('dominoes'));
  assert.ok(E.TYPES.includes('dominoes')); assert.ok(E.TEST_TYPES.includes('dominoes'), 'Admin only by default');
});
