'use strict';
// Hexapawn: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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
const typeRng = type => seq(pick(L.TYPES.indexOf(type), L.TYPES.length), 0.5);
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

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
const mini = (type, rng) => L.newMini(type, rng || lcg(11));

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

// ================================ Hexapawn ================================
// cells run row by row from the top: row 0 is O's home row, row 3 is X's; X moves up, O moves down
const hp = (...pairs) => { const c = new Array(12).fill(null); for (let k = 0; k < pairs.length; k += 2) c[pairs[k]] = pairs[k + 1]; return { type: 'hexapawn', cells: c, last: null }; };
const hpAt = (row, col) => row * 3 + col;

test('hexapawn: three pawns each on the home rows, two empty rows between them', () => {
  const m = mini('hexapawn');
  assert.deepEqual(m.cells, ['O', 'O', 'O', null, null, null, null, null, null, 'X', 'X', 'X']);
  assert.deepEqual(L.hpMoves(m.cells, 'X'), [[9, 6], [10, 7], [11, 8]], 'X can only step straight up');
  assert.deepEqual(L.hpMoves(m.cells, 'O'), [[0, 3], [1, 4], [2, 5]], 'O can only step straight down');
  assert.ok(!L.TYPES.includes('hexapawn') && L.OLD_TYPES.includes('hexapawn'), 'no longer dealt; an older match still plays it');
  assert.equal(L.INFO.hexapawn.name, 'Hexapawn', 'its name stays for older matches, history and stats');
  assert.equal(L.defaultSetup().games.hexapawn, undefined, 'not in the Mini-games list');
});

test('an older match with a Hexapawn square still plays it to the end: moves, the computer, a timed-out move, the record', () => {
  const rng = lcg(31);
  const st = matchWith(['hexapawn', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], rng);
  st.games = L.TYPES.concat(['hexapawn']);
  assert.equal(L.playMove(st, 0, [9, 6], rng).ok, true, 'a step forward');
  // the record for an online match (hidden values apart) and back
  const rec = L.matchRecord(st);
  const back = L.fullState(rec);
  assert.equal(back.squares[0].mini.type, 'hexapawn');
  assert.deepEqual(back.squares[0].mini.cells, st.squares[0].mini.cells);
  // the computer picks a legal Hexapawn move when that square is its best
  const cpu = L.newMatch(rng); cpu.cpu = 'O'; cpu.turn = 'O';
  cpu.squares.forEach((sq, i) => { sq.mini = i ? Object.assign(L.newMini('ttt', rng), { cells: ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'] }) : hp(hpAt(2, 0), 'X', hpAt(1, 1), 'O'); sq.owner = i ? 'X' : null; });
  const owners = [null, 'O', 'O', 'X', 'X', 'O', 'O', 'X', 'X'];                    // eight squares claimed, no line yet (O could still make one through it): only the Hexapawn square is open
  cpu.squares.forEach((sq, i) => { sq.owner = owners[i]; });
  assert.equal(L.mainResult(cpu.squares), null);
  const plan = L.cpuMove(cpu, rng);
  assert.equal(plan.square, 0);
  assert.ok(L.hpMoves(cpu.squares[0].mini.cells, 'O').some(([a, b]) => a === plan.move[0] && b === plan.move[1]), 'a legal move');
  // a timed-out turn there makes a random legal move
  const t = L.randomLegalMove(hp(hpAt(3, 1), 'X', hpAt(0, 1), 'O'), 'X', rng);
  assert.ok(L.hpMoves(hp(hpAt(3, 1), 'X', hpAt(0, 1), 'O').cells, 'X').some(([a, b]) => a === t[0] && b === t[1]));
});

test('hexapawn: pawns cannot move backward, sideways, two squares, diagonally into an empty square, or capture straight ahead', () => {
  // X on row 2 col 1 with an O pawn straight ahead; another O pawn diagonally ahead on the left
  const m = hp(hpAt(2, 1), 'X', hpAt(1, 1), 'O', hpAt(1, 0), 'O', hpAt(0, 2), 'O');
  const before = m.cells.slice();
  for (const [to, why] of [[hpAt(3, 1), 'backward'], [hpAt(2, 0), 'sideways left'], [hpAt(2, 2), 'sideways right'], [hpAt(1, 1), 'capture straight ahead'],
    [hpAt(1, 2), 'diagonally into an empty square'], [hpAt(0, 1), 'two squares'], [hpAt(3, 0), 'diagonally backward']]) {
    assert.deepEqual(L.applyMove(m, 'X', [hpAt(2, 1), to]), { ok: false, reason: 'illegal' }, why);
  }
  assert.deepEqual(L.applyMove(m, 'X', [hpAt(1, 1), hpAt(0, 1)]), { ok: false, reason: 'illegal' }, "not the other side's pawn");
  assert.deepEqual(L.applyMove(m, 'O', [hpAt(1, 1), hpAt(0, 1)]), { ok: false, reason: 'illegal' }, 'O cannot move up');
  assert.equal(L.applyMove(m, 'X', [hpAt(2, 1)]).ok, false);
  assert.equal(L.applyMove(m, 'X', 'up').ok, false);
  assert.deepEqual(m.cells, before, 'nothing moved');
  assert.deepEqual(L.hpMoves(m.cells, 'X'), [[hpAt(2, 1), hpAt(1, 0)]], 'its only move is the diagonal capture');
  const r = L.applyMove(m, 'X', [hpAt(2, 1), hpAt(1, 0)]);
  assert.equal(r.ok, true); assert.equal(r.outcome, 'continue'); assert.equal(r.note, 'capture');
  assert.equal(m.cells[hpAt(1, 0)], 'X'); assert.equal(m.cells[hpAt(2, 1)], null);
  assert.deepEqual(m.last, { from: hpAt(2, 1), to: hpAt(1, 0), by: 'X', capture: true });
});

test('hexapawn win 1: a pawn reaching the opposite home row claims the square', () => {
  const m = hp(hpAt(1, 1), 'X', hpAt(0, 0), 'O', hpAt(0, 2), 'O');
  const r = L.applyMove(m, 'X', [hpAt(1, 1), hpAt(0, 1)]);
  assert.equal(r.outcome, 'win'); assert.equal(r.note, 'through'); assert.deepEqual(r.cells, [hpAt(0, 1)]);
  const o = hp(hpAt(2, 2), 'O', hpAt(3, 1), 'X', hpAt(3, 0), 'X');   // O gets through by capturing onto X's home row
  const r2 = L.applyMove(o, 'O', [hpAt(2, 2), hpAt(3, 1)]);
  assert.equal(r2.outcome, 'win'); assert.equal(r2.note, 'through');
});

test('hexapawn: leaving the other side without a move wins nothing; when neither can move the square resets', () => {
  // X steps in front of O's only pawn: O is blocked, and so is X
  const st = matchWith(['hexapawn', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].mini = hp(hpAt(3, 0), 'X', hpAt(1, 0), 'O');
  st.games = ['ttt'];                                           // (the reset's only choice)
  const f = turn(st, 0, [hpAt(3, 0), hpAt(2, 0)], typeRng('ttt'));
  assert.equal(f.kind, 'draw', 'nobody can move: no winner'); assert.equal(f.note, 'stuck');
  assert.equal(st.squares[0].owner, null);
  assert.equal(st.squares[0].mini.type, 'ttt', 'the square resets with a new mini-game');
  assert.deepEqual(st.sqlog[0], { t: 'hexapawn', end: 'draw', w: null, X: 1, O: 0 });
  // capturing the last pawn does not win either: the pawn still has to get through
  const w = hp(hpAt(2, 1), 'X', hpAt(3, 2), 'X', hpAt(1, 0), 'O');
  assert.deepEqual(L.applyMove(w, 'X', [hpAt(2, 1), hpAt(1, 0)]), { ok: true, outcome: 'continue', note: 'capture' });
  assert.equal(w.cells.includes('O'), false);
  assert.equal(L.canMove(w, 'O'), false); assert.equal(L.canMove(w, 'X'), true);
  const r = L.applyMove(w, 'X', [hpAt(1, 0), hpAt(0, 0)]);
  assert.equal(r.outcome, 'win'); assert.equal(r.note, 'through', 'the far row is the only win');
});

test('hexapawn: a player with no move just plays elsewhere; being stuck never loses the square', () => {
  // X steps forward into a blocked spot of its own accord: X is stuck, but O can still move, so nothing is decided
  const m = hp(hpAt(3, 0), 'X', hpAt(1, 0), 'O', hpAt(0, 2), 'O', hpAt(0, 1), 'O');
  const r = L.applyMove(m, 'X', [hpAt(3, 0), hpAt(2, 0)]);
  assert.equal(r.outcome, 'continue');
  assert.equal(L.canMove(m, 'X'), false, 'X is stuck');
  assert.equal(L.canMove(m, 'O'), true);
  // O moves a pawn next to X's diagonal: X can capture again, so still nothing decided
  const freed = JSON.parse(JSON.stringify(m));
  const r2 = L.applyMove(freed, 'O', [hpAt(0, 1), hpAt(1, 1)]);
  assert.equal(r2.outcome, 'continue', 'the move freed X');
  assert.equal(L.canMove(freed, 'X'), true);
  // ...and a move that leaves X stuck does not win it for O any more
  const r3 = L.applyMove(m, 'O', [hpAt(0, 2), hpAt(1, 2)]);
  assert.equal(r3.outcome, 'continue'); assert.equal(L.canMove(m, 'X'), false);

  // in a match: a stuck player plays elsewhere, and cannot be made to move in that square
  const st = matchWith(['hexapawn', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].mini = hp(hpAt(2, 0), 'X', hpAt(1, 0), 'O', hpAt(0, 2), 'O');
  st.turn = 'X';
  assert.equal(L.anyMove(st, 'X'), true, 'X still has the other squares');
  assert.equal(L.playMove(st, 0, [hpAt(2, 0), hpAt(1, 0)], lcg(1)).ok, false);
  for (let k = 0; k < 6; k++) assert.notEqual(L.cpuMove(st, lcg(k)).square, 0, 'the computer plays elsewhere');
  st.timer = L.newTimer(30);
  for (let k = 0; k < 6; k++) {
    const copy = JSON.parse(JSON.stringify(st));
    const t = L.timeoutMove(copy, lcg(k));
    assert.equal(t.ok, true); assert.notEqual(t.square, 0, 'a timed-out random move goes elsewhere too');
  }
  assert.equal(st.squares[0].owner, null, 'being stuck lost nothing');
  // with no other square open, X has no move anywhere and is skipped
  for (let i = 1; i < 9; i++) st.squares[i].owner = [null, 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O'][i];
  assert.equal(L.anyMove(st, 'X'), false);
  assert.equal(L.anyMove(st, 'O'), true);
});

test('hexapawn tactics: full minimax takes a win now, stops the other side getting through, and plays every legal move only', () => {
  const win = L.localBest(L.publicMini(hp(hpAt(1, 1), 'X', hpAt(0, 0), 'O', hpAt(2, 2), 'O')), 'X', cpuRng());
  assert.equal(win.move[0], hpAt(1, 1)); assert.equal(Math.floor(win.move[1] / 3), 0, 'onto the far row (a step or a capture)'); assert.equal(win.win, true);
  // O threatens to reach X's home row from row 2; X must capture it
  const block = L.localBest(L.publicMini(hp(hpAt(2, 1), 'O', hpAt(3, 0), 'X', hpAt(3, 2), 'X', hpAt(0, 0), 'O')), 'X', cpuRng());
  assert.ok(block.move[1] === hpAt(2, 1), `X captures the runner (played ${JSON.stringify(block.move)})`);
  // from the start, with only the far row winning, perfect play on both sides locks the pawns: the square resets
  const start = mini('hexapawn').cells;
  assert.equal(L.hpSolve(start, 'X').v, 0);
  assert.equal(L.hpSolve(start, 'O').v, 0);
  // leaving the other side stuck is worth nothing by itself
  const lock = L.hpMovesValued(hp(hpAt(3, 0), 'X', hpAt(1, 0), 'O').cells, 'X');
  assert.deepEqual(lock.map(m => m.v), [0], 'a move that only blocks both sides: a reset');
  assert.equal(L.hpNeeds(start, 'X'), 3); assert.equal(L.hpNeeds(start, 'O'), 3, 'an even start: three rows each');
  const close = hp(hpAt(1, 1), 'X', hpAt(3, 0), 'X', hpAt(0, 0), 'O', hpAt(0, 2), 'O').cells;   // (a second X pawn, so O capturing one does not end it)
  assert.equal(L.hpNeeds(close, 'X'), 1, 'one step from the far row'); assert.equal(L.hpNeeds(close, 'O'), 3);
  const blocked = hp(hpAt(2, 0), 'X', hpAt(1, 0), 'O', hpAt(0, 2), 'O').cells;
  assert.equal(L.hpNeeds(blocked, 'X'), 3, 'a stuck player needs one more than its distance');
  // every move the computer picks over many games is legal
  const rng = lcg(55);
  for (let g = 0; g < 30; g++) {
    const m = mini('hexapawn');
    let p = g % 2 ? 'O' : 'X', guard = 0;
    while (guard++ < 30) {
      if (!L.canMove(m, 'X') && !L.canMove(m, 'O')) break;            // locked: the square would reset
      if (!L.canMove(m, p)) { p = L.other(p); continue; }
      const b = L.localBest(L.publicMini(m), p, rng);
      const r = L.applyMove(m, p, b.move);
      assert.equal(r.ok, true, `${p} ${JSON.stringify(b.move)} (${r.reason})`);
      if (r.outcome === 'win') break;
      p = L.other(p);
    }
    assert.ok(guard < 30, 'the game ends');
  }
});

test('hexapawn at the board level: a square nearly won is worth more than a fresh one', () => {
  const near = hp(hpAt(1, 1), 'X', hpAt(0, 0), 'O', hpAt(2, 2), 'O');
  const st = cpuMatch('X', [near, 'hexapawn', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  const m = L.cpuMove(st, cpuRng());
  assert.equal(m.square, 0, 'it goes for the square it can win at once');
  assert.equal(m.move[0], hpAt(1, 1)); assert.equal(Math.floor(m.move[1] / 3), 0);
  const g = L.moveGain(L.publicMini(near), 'X', L.localBest(L.publicMini(near), 'X', cpuRng()));
  assert.ok(g > 0.4, `claiming it is a big gain (${g.toFixed(2)})`);
});

test('hexapawn through playMove: the result carries the slide and the capture for the animation', () => {
  const st = matchWith(['hexapawn', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].mini = hp(hpAt(2, 1), 'X', hpAt(1, 0), 'O', hpAt(0, 2), 'O', hpAt(3, 2), 'X');
  const r = L.playMove(st, 0, [hpAt(2, 1), hpAt(1, 0)], lcg(1));
  assert.equal(r.ok, true);
  assert.equal(st.flash.type, 'hexapawn');
  assert.equal(st.flash.from, hpAt(2, 1)); assert.equal(st.flash.to, hpAt(1, 0)); assert.equal(st.flash.capture, true);
  L.endFlash(st);
  assert.equal(st.turn, 'O');
  // the public view and the online record carry the board as is (nothing hidden)
  const rec = L.matchRecord(Object.assign(st, { id: 'h', seq: 0, recent: [] }));
  assert.deepEqual(rec.state.squares[0].mini.cells, st.squares[0].mini.cells);
  assert.equal(rec.secrets[0], undefined);
});

test('hexapawn: the Hard computer plays the same full minimax, and between equal moves sets the trap with the fewest ways out', () => {
  const hard = { level: 'hard', until: null }, normal = { level: 'normal', until: null };
  const holds = (cells, p) => {                                // the replies for p that keep what the position is worth to p
    const v = L.hpSolve(cells, p).v;
    return L.hpMoves(cells, p).filter(([a, b]) => { const n = cells.slice(); n[b] = p; n[a] = null; return (Math.floor(b / 3) === L.hpGoalRow(p) ? 1 : -L.hpSolve(n, 'O' === p ? 'X' : 'O').v) === v; }).length;
  };
  const cells = ['O', null, null, 'X', 'O', 'O', null, null, 'X', null, 'X', null];     // O to move: a drawn square either way; [4, 7] leaves X one holding reply, [4, 8] two
  const pm = { type: 'hexapawn', cells };
  const h = L.localBest(pm, 'O', cpuRng(), {}, hard), n = L.localBest(pm, 'O', cpuRng(), {}, normal);
  assert.deepEqual(h.move, [4, 7]); assert.deepEqual(n.move, [4, 8], 'Normal as before');
  const vals = L.hpMovesValued(cells, 'O');
  assert.equal(vals.find(m => m.move[1] === 7).v, vals.find(m => m.move[1] === 8).v, 'the same value');
  assert.ok(holds(h.after.cells, 'X') < holds(n.after.cells, 'X'), 'fewer replies hold for X');
  assert.equal(h.after.type, 'hexapawn'); assert.equal(h.win, false);
  // a forced win is taken, the shortest; a move through wins now
  const open = L.localBest(L.publicMini(mini('hexapawn')), 'X', cpuRng(), {}, hard);
  assert.deepEqual(open.move, L.localBest(L.publicMini(mini('hexapawn')), 'X', cpuRng(), {}, normal).move, 'the opening: as Normal');
  const through = { type: 'hexapawn', cells: [null, null, null, null, 'X', null, null, null, null, null, null, null] };
  assert.deepEqual(L.localBest(through, 'X', cpuRng(), {}, hard), { move: [4, 1], win: true, after: { type: 'hexapawn', cells: [null, 'X', null, null, null, null, null, null, null, null, null, null] } });
  // legal moves everywhere, quickly
  const r = lcg(5);
  for (let k = 0; k < 10; k++) {
    const b = mini('hexapawn', lcg(k)); let p = 'X', dead = false;
    for (let i = 0; i < k % 5; i++) { if (!L.canMove(b, p)) { dead = true; break; } const mv = L.randomLegalMove(b, p, r); if (L.applyMove(b, p, mv, r).outcome !== 'continue') { dead = true; break; } p = L.other(p); }
    if (dead || !L.canMove(b, p)) continue;
    const t0 = performance.now(); const mv = L.localBest(L.publicMini(b), p, cpuRng(), {}, hard).move; const ms = performance.now() - t0;
    assert.ok(L.hpMoves(b.cells, p).some(([a, c]) => a === mv[0] && c === mv[1]), `a legal move (${JSON.stringify(mv)})`);
    assert.ok(ms < 60, `a Hard move in ${ms.toFixed(1)} ms`);
  }
});
