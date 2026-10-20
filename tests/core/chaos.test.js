'use strict';
// The engine's core: Super Chaos, simultaneous rounds against the computer (src/core/chaos.js and the games'
// Super Chaos hooks) (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../engine.js');
const PHYS = require('../physics.js');
E.setPhysics(PHYS);
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });

// ---- helpers ----
const fixed = v => () => v;                                     // an rng that always gives v (randInt(rng, n) = floor(v * n))
const sq = mini => ({ owner: null, mini, mv: { X: 0, O: 0 } });
const hilo = target => ({ type: 'hilo', target, lo: 1, hi: 20, guesses: [] });
const wordle = word => ({ type: 'wordle', word, guesses: [] });
const hangman = word => ({ type: 'hangman', word, letters: [] });
const bump = pos => ({ type: 'bump', pos, last: null });
const golf = (hole, X, O) => ({ type: 'golf', hole, balls: { X, O }, holed: { X: false, O: false }, shots: { X: 0, O: 0 }, last: null });
// A Super Chaos match against the computer (it plays O) on these squares (the rest Higher/Lower squares nobody
// plays), a round just begun; the computer's move is the one given ({ square, moves, rng }), else its own.
function round(minis, cpu, owners) {
  const rng = E.makeRng('sc');
  const st = E.newState(rng);
  st.setup.local = { pick: 'X', p2: 'cpu', n1: '', n2: '' };
  E.seatLocal(st.setup, rng);
  assert.ok(E.startChaos(st, rng));
  st.squares = Array.from({ length: 9 }, (_, i) => Object.assign(sq(minis[i] || hilo(20)), owners && owners[i] ? { owner: owners[i] } : {}));
  E.scBegin(st, rng);
  if (cpu) st.sc.cpu = E.scCpu(st, cpu.rng || rng, cpu);
  return st;
}
// The human's move in square i: each step in turn (a move that goes on takes several), then back to the board.
function human(st, i, moves, rng) {
  for (const m of moves) {
    const r = E.playMove(st, i, m, rng || E.makeRng('h'));
    assert.ok(r.ok, 'the human\'s move: ' + JSON.stringify(r));
    st.flash = null;
  }
  assert.ok(st.sc.me, 'the human\'s move is in');
  E.leaveSquare(st);
}
const resolve = st => E.chaosResolve(st, E.makeRng('resolve'));

test('Super Chaos: a square both players win in the same round resets with a new random Super Chaos game; a square one wins is claimed', () => {
  const st = round([wordle('CRANE'), wordle('SLATE')], { square: 0, moves: ['CRANE'] });
  human(st, 0, ['CRANE']);
  const rc = resolve(st);
  assert.equal(st.squares[0].owner, null, 'not claimed');
  assert.deepEqual(rc.resets.map(x => [x.square, x.from, x.why]), [[0, 'wordle', 'both']]);
  assert.ok(E.scTypes().includes(st.squares[0].mini.type), 'a Super Chaos game');
  assert.deepEqual(st.squares[0].mv, { X: 0, O: 0 }, 'a fresh game');
  assert.ok(!st.squares[0].mini.guesses || !st.squares[0].mini.guesses.length);
  assert.deepEqual(st.sqlog.map(e => [e.t, e.end]), [['wordle', 'draw']], 'counted as a reset, not a win');
  assert.equal(st.winner, null);
  // the next round: the human wins one square, the computer plays elsewhere
  E.chaosNext(st, E.makeRng('n'));
  st.sc.cpu = E.scCpu(st, E.makeRng('c'), { square: 1, moves: ['CRANE'] });
  human(st, 2, [20]);
  const rc2 = resolve(st);
  assert.deepEqual(rc2.claims, [{ square: 2, by: 'X' }]);
  assert.equal(st.squares[2].owner, 'X');
  assert.equal(st.squares[1].owner, null);
  assert.deepEqual(st.squares[1].mini.guesses.map(g => [g.by, g.word]), [['O', 'CRANE']], 'the computer\'s guess now in the square');
});

test('Super Chaos: both players completing three in a row in the same round is a draw; one line wins', () => {
  const owners = { 0: 'X', 1: 'X', 3: 'O', 4: 'O' };
  const st = round({ 2: hilo(7), 5: hilo(9) }, { square: 5, moves: [9] }, owners);
  human(st, 2, [7]);
  const rc = resolve(st);
  assert.deepEqual(rc.claims.map(c => [c.square, c.by]).sort(), [[2, 'X'], [5, 'O']]);
  assert.equal(st.winner, 'draw');
  assert.equal(st.winReason, 'both');
  assert.deepEqual(rc.result.lines, [[0, 1, 2], [3, 4, 5]]);
  // only one line: a win
  const st2 = round({ 2: hilo(7), 5: hilo(9) }, { square: 5, moves: [3] }, owners);
  human(st2, 2, [7]);
  resolve(st2);
  assert.equal(st2.winner, 'X');
  assert.equal(st2.winReason, 'line');
  assert.deepEqual(st2.winLine, [0, 1, 2]);
  assert.deepEqual(E.scMainResult(st2.squares).winner, 'X');
});

test('Super Chaos: one move per player per round, however many steps it takes', () => {
  const st = round([hangman('ABBA'), wordle('CRANE'), wordle('CRANE')], { square: 2, moves: ['SLATE'] });
  assert.equal(E.playMove(st, 0, 'A', E.makeRng('h')).flash.kind, 'again', 'a right letter: guess on');
  st.flash = null;
  assert.equal(E.playMove(st, 1, 'SLATE', E.makeRng('h')).reason, 'locked', 'held to the square while the move goes on');
  assert.equal(E.playMove(st, 0, 'Z', E.makeRng('h')).ok, true, 'a miss ends the move');
  st.flash = null;
  assert.deepEqual(st.sc.me, { square: 0, out: 'continue', win: false });
  assert.equal(st.squares[0].mv.X, 1, 'one move for the stats');
  E.leaveSquare(st);
  assert.equal(E.playMove(st, 1, 'SLATE', E.makeRng('h')).reason, 'moved', 'no second move this round');
  assert.equal(E.playMove(st, 0, 'B', E.makeRng('h')).reason, 'moved');
  assert.equal(E.chaosTimeout(st, E.makeRng('t')).ok, false, 'nor a timeout move');
  assert.equal(st.sc.cpu.steps.length, 1, 'the computer made one move too');
  assert.equal(st.sc.cpu.square, 2);
  resolve(st);
  assert.equal(st.squares[2].mini.guesses.length, 1);
  assert.equal(E.playMove(st, 1, 'SLATE', E.makeRng('h')).reason, 'moved', 'not during the recap either');
  E.chaosNext(st, E.makeRng('n'));
  assert.equal(st.sc.round, 2);
  assert.equal(E.playMove(st, 1, 'SLATE', E.makeRng('h')).ok, true, 'the next round: a move again');
  // the computer's own choice: one move, played to its end, without seeing the human's
  for (let k = 0; k < 20; k++) {
    const s2 = round([hangman('ABBA'), wordle('CRANE'), { type: 'pig', bank: { X: 0, O: 0 }, turn: null, last: null }]);
    const c = s2.sc.cpu;
    assert.ok(c && Number.isInteger(c.square));
    assert.equal(c.steps.filter(f => f.kind !== 'again').length, 1, 'one move ends: ' + c.steps.map(f => f.kind).join(','));
  }
});

test('Super Chaos: each player sees only their own move until the recap', () => {
  const st = round([wordle('CRANE'), wordle('TRAIN')], { square: 0, moves: ['SLATE'] });
  assert.deepEqual(st.squares[0].mini.guesses, [], 'the computer has moved, and none of it shows');
  assert.deepEqual(E.publicMini(st.squares[0].mini).guesses, []);
  assert.deepEqual(st.sc.cpu.mini.guesses.map(g => g.word), ['SLATE'], 'kept apart until the round ends');
  human(st, 0, ['BRINE']);
  assert.deepEqual(st.squares[0].mini.guesses.map(g => g.word), ['BRINE'], 'the human sees their own guess only');
  const rc = resolve(st);
  assert.deepEqual(st.squares[0].mini.guesses.map(g => [g.by, g.word]), [['X', 'BRINE'], ['O', 'SLATE']], 'both join the history');
  assert.equal(rc.cpu.square, 0);
  assert.equal(rc.cpu.steps[0].word, 'SLATE', 'the recap tells the computer\'s move');
  // Trivia: a wrong pick of the computer's is crossed out for both only at the round's end; each right answer scores, and a new question comes
  const t = round([{ type: 'trivia', right: { X: 0, O: 0 }, ask: null, answer: null, crossed: [], asked: [], shown: false, last: null }]);
  E.scSquareMini(t, t.squares[0], 'trivia', E.makeRng('q'));
  E.scBegin(t, E.makeRng('b'));
  const m = t.squares[0].mini, right = m.answer, wrong = [0, 1, 2, 3].filter(k => k !== right);
  assert.equal(m.shown, true, 'face up for both');
  t.sc.cpu = E.scCpu(t, E.makeRng('c'), { square: 0, moves: [wrong[0]] });
  human(t, 0, [wrong[1]]);
  assert.deepEqual(t.squares[0].mini.crossed, [wrong[1]], 'the human sees their own cross-out only');
  resolve(t);
  assert.deepEqual(t.squares[0].mini.crossed, [wrong[0], wrong[1]].sort(), 'both crossed out for both');
  assert.equal(t.squares[0].mini.ask.id, m.ask.id, 'the question stays');
  E.chaosNext(t, E.makeRng('n'));
  t.sc.cpu = E.scCpu(t, E.makeRng('c'), { square: 0, moves: [right] });
  human(t, 0, [right]);
  assert.equal(t.squares[0].mini.ask.id, m.ask.id, 'a right answer keeps the question on show until the round ends');
  resolve(t);
  assert.deepEqual(t.squares[0].mini.right, { X: 1, O: 1 }, 'each right answer scores');
  assert.notEqual(t.squares[0].mini.ask.id, m.ask.id, 'a new question');
  assert.deepEqual(t.squares[0].mini.crossed, []);
});

test('Super Chaos Hangman: a word only the two players finished together resets; finishing it in your own view wins', () => {
  const st = round([hangman('ABBA')], { square: 0, moves: ['B', 'Y'] });
  human(st, 0, ['A', 'Z']);
  assert.deepEqual(E.publicMini(st.squares[0].mini).pattern, ['A', null, null, 'A'], 'the human sees their own letters');
  const rc = resolve(st);
  assert.deepEqual(rc.resets.map(x => [x.square, x.why]), [[0, 'merged']]);
  assert.equal(st.squares[0].owner, null);
  // the human finishes the word in their own view: theirs, though the computer found letters too
  const s2 = round([hangman('ABBA')], { square: 0, moves: ['B', 'Y'] });
  human(s2, 0, ['A', 'B']);
  resolve(s2);
  assert.equal(s2.squares[0].owner, 'X');
  // both finish it in their own view: a reset, as any square both win
  const s3 = round([hangman('ABBA')], { square: 0, moves: ['B', 'A'] });
  human(s3, 0, ['A', 'B']);
  assert.deepEqual(resolve(s3).resets.map(x => x.why), ['both']);
});

test('Super Chaos Bump: both pieces move; landing on the same space sends both home; a lone mover bumps as usual', () => {
  // X from 2 spins 3 (to 5), O from 3 spins 2 (to 5): both home
  const st = round([bump({ X: 2, O: 3 })], { square: 0, moves: ['spin'], rng: fixed(0.5) });
  human(st, 0, ['spin'], fixed(0.9));
  assert.deepEqual(st.squares[0].mini.pos, { X: 5, O: 3 }, 'the human sees only their own piece move');
  resolve(st);
  assert.deepEqual(st.squares[0].mini.pos, { X: 0, O: 0 });
  // O moves away from where X lands: no bump
  const s2 = round([bump({ X: 2, O: 5 })], { square: 0, moves: ['spin'], rng: fixed(0.5) });
  human(s2, 0, ['spin'], fixed(0.9));
  resolve(s2);
  assert.deepEqual(s2.squares[0].mini.pos, { X: 5, O: 7 });
  // the computer plays elsewhere: X lands on O's piece and sends it home
  const s3 = round([bump({ X: 2, O: 5 })], { square: 1, moves: [3] });
  human(s3, 0, ['spin'], fixed(0.9));
  resolve(s3);
  assert.deepEqual(s3.squares[0].mini.pos, { X: 5, O: 0 });
  // both reach the finish in the same round: a reset
  const s4 = round([bump({ X: 8, O: 9 })], { square: 0, moves: ['spin'], rng: fixed(0.5) });
  human(s4, 0, ['spin'], fixed(0.9));
  assert.deepEqual(resolve(s4).resets.map(x => x.why), ['both']);
});

test('Super Chaos Bump: nothing is knocked during the round; the knock is settled at its end, and the recap plays it', () => {
  // the computer plays elsewhere: X lands on O's piece; O stays put until the round ends
  const st = round([bump({ X: 2, O: 5 })], { square: 1, moves: [3] });
  human(st, 0, ['spin'], fixed(0.9));
  assert.deepEqual(st.squares[0].mini.pos, { X: 5, O: 5 }, 'both on the same space, nobody knocked yet');
  assert.equal(st.squares[0].mini.last.bumped, false);
  const rc = resolve(st);
  assert.deepEqual(st.squares[0].mini.pos, { X: 5, O: 0 }, 'O knocked home at the round\'s end');
  assert.deepEqual(rc.pre[0].pos, { X: 5, O: 5 }, 'the recap shows both where they landed first');
  assert.deepEqual(rc.resolve.map(x => [x.square, x.flash.type, x.flash.scr.knocked, x.flash.by, x.flash.kind]), [[0, 'bump', ['O'], 'X', 'move']]);
  // both land on the same space: both home, and the recap plays both knocks
  const s2 = round([bump({ X: 2, O: 3 })], { square: 0, moves: ['spin'], rng: fixed(0.5) });
  human(s2, 0, ['spin'], fixed(0.9));
  const r2 = resolve(s2);
  assert.deepEqual(s2.squares[0].mini.pos, { X: 0, O: 0 });
  assert.deepEqual(r2.resolve[0].flash.scr, { knocked: ['X', 'O'], at: { X: 5, O: 5 }, moves: { X: { from: 2, to: 5, spin: 3 }, O: { from: 3, to: 5, spin: 2 } } });
  assert.equal(r2.resolve[0].joint, true, 'both moved here: replayed together');
  assert.deepEqual(r2.pre[0].pos, { X: 2, O: 3 }, 'from where the round began');
  // both moved here without meeting: both hop at once, nobody knocked
  const s3 = round([bump({ X: 2, O: 5 })], { square: 0, moves: ['spin'], rng: fixed(0.5) });
  human(s3, 0, ['spin'], fixed(0.9));
  const r3 = resolve(s3);
  assert.deepEqual(r3.resolve.map(x => [x.joint, x.flash.scr.knocked, x.flash.scr.moves]), [[true, [], { X: { from: 2, to: 5, spin: 3 }, O: { from: 5, to: 7, spin: 2 } }]]);
  assert.deepEqual(s3.squares[0].mini.pos, { X: 5, O: 7 });
  // the computer elsewhere and no meeting: nothing to replay at the end (the human's move was seen live)
  const s4 = round([bump({ X: 2, O: 8 })], { square: 1, moves: [3] });
  human(s4, 0, ['spin'], fixed(0.9));
  assert.deepEqual(resolve(s4).resolve, []);
});

test('Super Chaos Roulette: one spin a round per square, drawn as the round begins: both bets there land on the same number, each at once on the mover\'s screen', () => {
  const rl = hits => ({ type: 'rl', hits, spins: [], last: null });
  const spinIs = (st, i, n) => { st.squares[i].mini.spin = n; st.sc.base[i].spin = n; };
  // both bet in the same square: 3 comes up for both; X's 1–8 hits, O's 9–16 misses
  const st = round([rl({ X: 0, O: 0 })]);
  assert.ok(Number.isInteger(st.squares[0].mini.spin), 'the round\'s spin is drawn as it begins');
  spinIs(st, 0, 3);
  st.sc.cpu = E.scCpu(st, E.makeRng('c'), { square: 0, moves: ['g2'] });
  human(st, 0, ['g1'], fixed(0.99));
  const mine = st.squares[0].mini;
  assert.deepEqual([mine.hits.X, mine.last.n, mine.last.hit], [1, 3, true], 'the spin and its result at once, on the round\'s number');
  assert.deepEqual([st.sc.cpu.mini.last.n, st.sc.cpu.mini.last.hit], [3, false], 'the computer\'s bet landed on the same spin');
  const rc = E.chaosResolve(st, E.makeRng('r'));
  const m = st.squares[0].mini;
  assert.deepEqual(rc.resolve, [], 'nothing left to settle at the round\'s end');
  assert.deepEqual(m.spins, [{ n: 3, by: 'X', hit: true }], 'one spin in the square\'s history');
  assert.deepEqual(m.hits, { X: 1, O: 0 });
  // the next round draws a new spin
  const draws = new Set();
  for (let k = 0; k < 8; k++) { E.chaosNext(st, E.makeRng('n' + k)); draws.add(st.squares[0].mini.spin); st.sc.recap = { round: st.sc.round }; }
  assert.ok(draws.size > 1, 'a new spin each round');
  // the spin stays off the board on the record
  const rec = E.matchRecord(st);
  assert.equal(rec.state.squares[0].mini.spin, undefined);
  assert.equal(E.fullState(rec).squares[0].mini.spin, st.squares[0].mini.spin);
  // one player alone in the square: their own spin, as usual; a second hit takes the square once the round settles
  const s3 = round([rl({ X: 1, O: 0 })], { square: 1, moves: [3] });
  spinIs(s3, 0, 20);
  human(s3, 0, ['g3']);
  assert.equal(s3.sc.me.win, true, 'won on the spin, there and then');
  const r3 = E.chaosResolve(s3, E.makeRng('r3'));
  assert.deepEqual(r3.claims.map(c => [c.square, c.by]), [[0, 'X']]);
  // outside Super Chaos: no round spin, the wheel spins on the move
  const n = E.newMini('rl', E.makeRng('x'));
  assert.equal(n.spin, undefined);
});

test('Super Chaos Mini Golf: each shot is locked in, then both play out together: the balls roll at once and can collide; both sinking resets', () => {
  const H = PHYS.HOLES[0], tee = H.tee, cup = H.cup;
  const st = round([golf(0, [tee[0] - 3, tee[1]], [tee[0] + 3, tee[1]])], { square: 0, moves: [{ aim: -Math.PI / 2, power: 0.3 }] });
  human(st, 0, [{ aim: Math.PI / 2, power: 0.3 }]);
  assert.deepEqual(st.squares[0].mini.balls.X, [tee[0] - 3, tee[1]], 'nothing rolls until the round ends');
  assert.deepEqual(st.squares[0].mini.aim, { X: { aim: 1.571, power: 0.3 } });
  assert.equal(st.sc.cpu.mini.balls.O[0], tee[0] + 3, 'the computer\'s ball waits too');
  const rc = resolve(st);
  assert.ok(rc.replay && rc.replay.square === 0, 'a replay of both shots for the recap');
  const last = st.squares[0].mini.last, rec = last.rec, ix = rec.ids.indexOf('X'), io = rec.ids.indexOf('O');
  const moved = (f, i) => rec.frames[f][2 * i] !== rec.frames[0][2 * i];
  assert.ok(moved(3, ix) && moved(3, io), 'both balls roll from the start');
  assert.ok(last.events.some(e => e.k === 'balls'), 'they collide');
  assert.deepEqual(st.squares[0].mini.shots, { X: 1, O: 1 });
  assert.equal(st.squares[0].mini.aim, undefined);
  // the same two shots one after the other would have ended elsewhere
  const one = PHYS.run('golf', golf(0, [tee[0] - 3, tee[1]], [tee[0] + 3, tee[1]]), 'X', { aim: Math.PI / 2, power: 0.3 });
  assert.notDeepEqual(one.final.X, st.squares[0].mini.balls.X);
  // both into the cup in the same round: a reset; one in: claimed
  const s2 = round([golf(0, [cup[0] - 7, cup[1]], [cup[0] + 7, cup[1] + 0.5])], { square: 0, moves: [{ aim: -Math.PI / 2, power: 0.16 }] });
  human(s2, 0, [{ aim: Math.PI / 2, power: 0.16 }]);
  const rc2 = resolve(s2);
  assert.deepEqual(rc2.replay.win.sort(), ['O', 'X']);
  assert.deepEqual(rc2.resets.map(x => [x.from, x.why]), [['golf', 'both']]);
  const s3 = round([golf(0, [cup[0] - 7, cup[1]], [tee[0], tee[1]])], { square: 1, moves: [3] });
  human(s3, 0, [{ aim: Math.PI / 2, power: 0.16 }]);
  resolve(s3);
  assert.equal(s3.squares[0].owner, 'X');
});

test('Super Chaos: the shared histories and per-player rules of the other games', () => {
  // Battleship: a Patrol Boat on 5x5; one shot a move; both shots join the sea
  const bs = E.scSquareMini({ squares: [] }, {}, 'bs', E.makeRng('b'));
  assert.equal(bs.n, 5); assert.equal(bs.len, 1); assert.equal(bs.revealed.length, 25);
  const ship = bs.ship[0], miss = (ship + 1) % 25, miss2 = (ship + 2) % 25;
  const st = round([bs], { square: 0, moves: [miss2] });
  human(st, 0, [miss]);
  resolve(st);
  assert.equal(st.squares[0].mini.revealed.filter(Boolean).length, 2);
  E.chaosNext(st, E.makeRng('n'));
  st.sc.cpu = E.scCpu(st, E.makeRng('c'), { square: 1, moves: [3] });
  human(st, 0, [ship]);
  resolve(st);
  assert.equal(st.squares[0].owner, 'X', 'a hit sinks it');
  // Higher/Lower: both guesses and both answers narrow the range
  const h = round([hilo(10)], { square: 0, moves: [14] });
  human(h, 0, [4]);
  resolve(h);
  assert.deepEqual([h.squares[0].mini.lo, h.squares[0].mini.hi, h.squares[0].mini.guesses.length], [5, 13, 2]);
  // Plinko: the same slot, locked once; both on the bonus peg: +2 each and one new peg
  const pl = { type: 'plinko', vals: [5, 3, 3, 2, 2, 1, 1], pts: { X: 0, O: 0 }, used: new Array(7).fill(false), bonus: { x: 6, r: 2 }, target: 12, last: null };
  // from slot 3 the chip is at half-slot 6 at row 1, then 5 or 7 at row 2: with the bonus at 6 on row 3, a left-then-right path touches it
  const pl3 = Object.assign({}, pl, { bonus: { x: 6, r: 3 } });
  const p = round([pl3], { square: 0, moves: [3], rng: E.makeRng('pa') });
  human(p, 0, [3], E.makeRng('pb'));
  const hx = p.squares[0].mini.last, ho = p.sc.cpu.mini.last;
  resolve(p);
  const pm = p.squares[0].mini;
  assert.equal(pm.used.filter(Boolean).length, 1, 'slot 3 locked once');
  assert.deepEqual(pm.pts, { X: hx.pts, O: ho.pts }, 'each drop scores its own points');
  if (hx.hit || ho.hit) assert.notDeepEqual(pm.bonus, { x: 6, r: 3 }, 'a new bonus peg'); else assert.deepEqual(pm.bonus, { x: 6, r: 3 });
  // Craps: each player's round is rolled out within their own move; only the wins are kept, per player
  const cr = E.scSquareMini({ squares: [] }, {}, 'craps', E.makeRng('k'));
  const c = round([cr], { square: 1, moves: [3] });
  const seq = vals => { let k = 0; return () => vals[k++ % vals.length]; };
  human(c, 0, ['roll'], seq([0.5, 0.0, 0.5, 0.0]));          // 4 + 1 = 5: the point; 5 again: the round won, all in the one move
  assert.ok(c.sc.me, 'the move is in after one Roll');
  c.sc.cpu = E.scCpu(c, seq([0.5, 0.5, 0.0, 0.0]), { square: 0, moves: ['roll'] });   // the computer: 4 + 4 = 8, then 1 + 1, ... its own round to the end
  assert.equal(c.sc.cpu.steps.length, 1, 'one step: the whole round');
  assert.equal(c.sc.cpu.steps[0].craps.was, null, 'the computer started its own round');
  c.flash = null;
  resolve(c);
  const cm = c.squares[0].mini;
  assert.equal(cm.wins.X, 1, 'X won the round'); assert.equal(cm.point, null, 'no point carried over');
  assert.ok(!('scp' in cm), 'no own-point rule any more');
});

test('Super Chaos: the round\'s time out plays the game\'s timeout rule for the human, never a loss', () => {
  const st = round([wordle('CRANE'), { type: 'pig', bank: { X: 0, O: 0 }, turn: null, last: null }]);
  const r = E.chaosTimeout(st, E.makeRng('t'));
  assert.ok(r.ok);
  assert.ok(st.flash.timeout, 'a random move, marked as one');
  st.flash = null;
  while (!st.sc.me) { assert.ok(E.chaosTimeout(st, E.makeRng('t2')).ok); st.flash = null; }   // (a Risky Rolls roll goes on: banked next)
  assert.equal(st.winner, null);
  assert.equal(st.timer.streak.X, 0, 'no timeout count towards a loss');
});

test('Super Chaos: a whole match, the computer on both sides, every Super Chaos game', () => {
  for (const seed of ['a']) {
    const rng = E.makeRng('whole' + seed);
    const st = E.newState(rng);
    st.setup.local = { pick: 'X', p2: 'cpu', n1: '', n2: '' };
    E.seatLocal(st.setup, rng);
    assert.ok(E.startChaos(st, rng));
    assert.ok(st.squares.every(s => E.scTypes().includes(s.mini.type)));
    for (let guard = 0; !st.winner && guard < 300; guard++) {
      for (let k = 0; !st.sc.me && k < 60; k++) {
        const plan = E.cpuMove(st, rng, { mistake: 0.25 });
        const r = E.playMove(st, plan.square, plan.move, rng);
        if (!r.ok) assert.ok(E.chaosTimeout(st, rng).ok, r.reason);
        st.flash = null;
      }
      E.leaveSquare(st);
      E.chaosResolve(st, rng);
      E.chaosNext(st, rng);
    }
    assert.ok(st.winner, 'the match ends');
    assert.ok(['line', 'blocked', 'both'].includes(st.winReason));
    const m = E.matchStats(st);
    assert.ok(m.squares.every(e => ['won', 'draw', 'open'].includes(e.end)));
  }
});

test('Super Chaos stats: its own mode, reported by the phone; a line each in one round counts as a draw', () => {
  const S = require('../../functions/statsRules.js');
  assert.ok(S.MODES.includes('chaos') && S.CLIENT_MODES.includes('chaos') && S.DEV_MODES.includes('chaos'));
  const sum = S.checkEnd({ squares: [{ t: 'wordle', end: 'won', w: 'X', X: 3, O: 2 }, { t: 'hilo', end: 'draw', X: 1, O: 1 }], winner: 'draw', reason: 'both' }, E.TYPES);
  assert.equal(sum.reason, 'both');
  const up = S.endUpdates('chaos', sum, 60000, Date.UTC(2026, 9, 17), true, []);
  assert.equal(up['modes/chaos/draws'], 1);
  assert.equal(up['modes/chaos/finished'], 1);
  assert.equal(up['mini/chaos/wordle/won'], 1);
  assert.equal(up['mini/chaos/hilo/draw'], 1);
});

test('Super Chaos Higher/Lower: the same 5 guesses each; a 5th that misses hands the square over, for either player', () => {
  const h5 = (target, xUsed, oUsed) => ({ type: 'hilo', target, lo: 1, hi: 30, top: 30, limit: 5, guesses: [].concat(Array.from({ length: xUsed }, (_, k) => ({ by: 'X', n: 30 - k, res: 'lower' })), Array.from({ length: oUsed }, (_, k) => ({ by: 'O', n: 26 - k, res: 'lower' }))) });
  // the human's 5th misses: the computer (playing elsewhere) claims it
  const st = round([h5(10, 4, 0)], { square: 1, moves: [20] });
  st.squares[0].mini.hi = 25;
  human(st, 0, [3]);
  assert.equal(st.flash, null);
  assert.equal(st.sc.me.gives, 'O');
  assert.equal(st.squares[0].owner, null, 'nothing claimed before the round ends');
  resolve(st);
  assert.equal(st.squares[0].owner, 'O');
  // the computer's 5th misses: the human claims it
  const s2 = round([h5(10, 0, 4)], { square: 0, moves: [3] });
  s2.squares[0].mini.hi = 22;
  assert.equal(s2.sc.cpu.gives, 'X');
  human(s2, 1, [20]);
  resolve(s2);
  assert.equal(s2.squares[0].owner, 'X');
  // both players' 5th guesses miss in the same round: each hands it to the other, so both "win" it: a reset
  const s3 = round([h5(10, 4, 4)], { square: 0, moves: [3] });
  s3.squares[0].mini.hi = 22;
  human(s3, 0, [15]);
  assert.deepEqual(resolve(s3).resets.map(x => [x.square, x.why]), [[0, 'both']]);
  // one finds it as the other runs out: the finder's
  const s4 = round([h5(10, 4, 4)], { square: 0, moves: [10] });
  s4.squares[0].mini.hi = 22;
  human(s4, 0, [15]);
  resolve(s4);
  assert.equal(s4.squares[0].owner, 'O');
});
