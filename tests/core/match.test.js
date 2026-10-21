'use strict';
// The engine's core: setup, turns, the main board, the computer, timeouts and online records (npm test).
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
const mini = (type, rng) => L.newMini(type, rng || lcg(11));
// a battleship with its ship on the given cells
const bsAt = (...ship) => Object.assign(mini('bs'), { len: ship.length, ship, revealed: new Array(16).fill(null), hits: [] });
// a one-cell ship (a Patrol Boat) at cell 0: either player claims it with one move
const oneMove = () => L.newMini('bs', seq(pick(0, 4), pick(0, 2), pick(0, 4), pick(0, 4)));

// O O X / X O O / O X X : full, no line, O has 5 and X has 4 (impossible with strict alternation)
const TTT_DRAW = ['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];

// ==================================== Risky Rolls ====================================
const die = (...faces) => seq(...faces.map(n => pick(n - 1, 6)));   // rolls come out in this order

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
const tttOf = (...cells) => Object.assign(mini('ttt'), { cells: cells.map(c => c || null) });

// ---- online match records: the public state and the secrets apart, moves applied to the pair ----
const SECRET_KEYS = { wordle: 'word', hangman: 'word', hilo: 'target', bs: 'ship', hunt: 'treasure', memory: 'cards', mastermind: 'code' , trivia: 'answer', oddone: 'pos', patterns: 'answer', sniff: 'treasure' };

// ================================ Setup / match flow ================================
test('setup: the app opens on the main menu with default names and every game ticked', () => {
  const st = L.newState(lcg(1));
  assert.equal(st.v, 4);
  assert.equal(st.screen, 'menu', 'the main menu comes first');
  assert.deepEqual(st.setup.names, { X: 'X', O: 'O' });
  assert.deepEqual(L.enabledGames(st.setup), L.TYPES);
  assert.equal(L.TYPES.length, 48);
  assert.ok(st.setup.games.coins && st.setup.games.pig && st.setup.games.hunt && st.setup.games.snakes && st.setup.games.bump, 'the newer games are on by default');
  assert.ok(st.setup.games.bj && st.setup.games.bus && st.setup.games.rl, 'and the card games and the wheel too');
  assert.ok(L.TEST_TYPES.every(t => st.setup.games[t] && L.TYPES.includes(t)), 'the games on test are in the pool and on by default (for the admin, who alone sees them)');
  assert.deepEqual(L.releasedTypes({}), L.TYPES.filter(t => !L.TEST_TYPES.includes(t)), 'released: everything but the games on test');
  assert.deepEqual(L.releasedTypes({ trivia: true, ttt: false }), L.TYPES.filter(t => (t === 'trivia' || !L.TEST_TYPES.includes(t)) && t !== 'ttt'), 'the database overrides the code either way');
  assert.deepEqual(L.allowedTypes({}, true), L.TYPES, 'the admin: every game');
  const g = Object.fromEntries(L.TYPES.map(t => [t, true]));
  L.restrictGames(g, L.releasedTypes({}));
  assert.ok(L.TEST_TYPES.every(t => g[t] === false) && g.ttt === true, 'a setup cut down to the released games');
  assert.ok(!L.TYPES.includes('dice'), 'Snakes and Ladders took the Dice race\'s place');
  assert.ok(!L.TYPES.includes('hexapawn') && !('hexapawn' in st.setup.games), 'Hexapawn is out of the pool and the Advanced list');
  assert.deepEqual(L.OLD_TYPES, ['dice', 'hexapawn'], 'no longer dealt, still played in older matches');
  for (const t of L.TYPES) assert.ok(L.INFO[t] && L.INFO[t].name && L.INFO[t].hint, `info for ${t}`);
  assert.equal(L.playerName(st, 'X'), 'X');
});

test('setup: Start needs at least one game, tidies the names and builds nine squares from the ticked games', () => {
  const st = L.newState(lcg(2));
  for (const t of L.TYPES) st.setup.games[t] = false;
  const before = JSON.stringify(st);
  assert.equal(L.startMatch(st, lcg(2)), false);
  assert.equal(JSON.stringify(st), before, 'nothing changes without a game');
  st.setup.games.hex = true;
  st.setup.names = { X: '  Alice  ', O: '' };
  assert.equal(L.startMatch(st, lcg(2)), true);
  assert.equal(st.screen, 'board');
  assert.equal(st.turn, 'X');
  assert.deepEqual(st.setup.names, { X: 'Alice', O: 'O' }, 'trimmed, empty falls back to the mark');
  assert.equal(L.playerName(st, 'X'), 'Alice');
  assert.deepEqual(st.games, ['hex']);
  assert.equal(st.squares.length, 9);
  for (const sq of st.squares) { assert.equal(sq.owner, null); assert.equal(sq.mini.type, 'hex'); }
  st.setup.names.O = 'A very long name indeed';
  L.startMatch(st, lcg(2));
  assert.equal(st.setup.names.O.length, L.NAME_MAX, 'names are capped');
});

test('setup: unticked games never appear, in fresh squares or in draw resets', () => {
  const allowed = ['ttt', 'bs', 'snakes'];
  const rng = lcg(77);
  const seen = new Set();
  for (let k = 0; k < 300; k++) {
    const st = L.newMatch(rng, { games: allowed });
    assert.deepEqual(st.games, allowed);
    st.squares.forEach(s => seen.add(s.mini.type));
    // draw a tic-tac-toe square and watch what it resets to
    st.squares[0].mini = L.newMini('ttt', rng);
    for (let i = 0; i < 8; i++) st.squares[0].mini.cells[i] = TTT_DRAW[i];
    st.turn = TTT_DRAW[8];
    assert.equal(L.playMove(st, 0, 8, rng).ok, true);
    assert.equal(st.flash.kind, 'draw');
    seen.add(st.squares[0].mini.type);
  }
  assert.deepEqual([...seen].sort(), [...allowed].sort());
  const single = L.newMatch(lcg(8), { games: ['memory'] });
  assert.ok(single.squares.every(s => s.mini.type === 'memory'));
  const named = L.newMatch(lcg(8), { names: { X: 'Ann', O: 'Ben' } });
  assert.equal(L.playerName(named, 'O'), 'Ben');
});

test('turns alternate, and a player may keep moving in the same mini-game', () => {
  const st = matchWith(['ttt', 'ttt']);
  assert.equal(turn(st, 0, 0).kind, 'move');
  assert.equal(st.turn, 'O');
  assert.equal(st.screen, 'board');
  assert.equal(st.flash, null);
  assert.equal(st.zoom, null);
  turn(st, 1, 0);                      // O plays elsewhere
  assert.equal(st.turn, 'X');
  turn(st, 0, 1);                      // X back in square 0 although O never moved there
  turn(st, 1, 1);
  const f = turn(st, 0, 2);
  assert.equal(f.kind, 'claim');
  assert.equal(f.by, 'X');
  assert.equal(f.winner, 'X');
  assert.equal(st.squares[0].owner, 'X');
  assert.equal(st.squares[0].mini.cells.filter(c => c === 'X').length, 3);
  assert.equal(st.squares[0].mini.cells.filter(c => c === 'O').length, 0);
  assert.equal(st.moves, 5);
  assert.equal(st.lastSquare, 0);
  assert.equal(st.lastBy, 'X');
  assert.equal(st.winner, null);
});

test('moves are refused while a result is showing, on claimed squares, and after the match ends', () => {
  const st = matchWith(['ttt', 'ttt']);
  assert.equal(L.playMove(st, 0, 0).ok, true);
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'busy' });
  L.endFlash(st, true);                           // the result held a moment longer (Memory's cards turning back)
  assert.equal(L.endFlash(st), false);
  assert.equal(st.screen, 'mini');
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'done' }, 'the move is made: nothing more while its result is on show');
  assert.deepEqual(L.playMove(st, 0, 1), { ok: false, reason: 'done' });
  L.leaveSquare(st);
  assert.equal(st.turn, 'O');
  st.squares[1].owner = 'O';
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'claimed' });
  assert.equal(L.playMove(st, 9, 0).ok, false);
  st.winner = 'O';
  assert.deepEqual(L.playMove(st, 0, 1), { ok: false, reason: 'over' });
});

test('a rejected move changes nothing, including the turn', () => {
  const st = matchWith(['ttt']);
  const before = JSON.stringify(st);
  assert.equal(L.playMove(st, 0, 42).ok, false);
  assert.equal(JSON.stringify(st), before);
});

test('three claimed squares in a row win the match', () => {
  const st = matchWith(['bs', 'bs', 'bs', 'ttt']);
  for (let i = 0; i < 3; i++) st.squares[i].mini = oneMove();
  assert.equal(turn(st, 0, 0).kind, 'claim');
  turn(st, 3, 0);
  assert.equal(turn(st, 1, 0).kind, 'claim');
  turn(st, 3, 1);
  const r = L.playMove(st, 2, 0);
  assert.equal(r.ok, true);
  assert.equal(st.flash.kind, 'match');
  assert.equal(st.winner, 'X');
  assert.deepEqual(st.winLine, [0, 1, 2]);
  assert.equal(st.winReason, 'line');
  L.endFlash(st);
  assert.equal(st.screen, 'win');
  assert.equal(L.playMove(st, 3, 2).ok, false);
});

test('every main-board line is detected', () => {
  for (const line of L.LINES) {
    const st = L.newMatch(lcg(3));
    for (const i of line) st.squares[i].owner = 'O';
    assert.deepEqual(L.mainResult(st.squares), { winner: 'O', line, reason: 'line' });
  }
  const st = L.newMatch(lcg(3));
  assert.equal(L.mainResult(st.squares), null);
  st.squares[0].owner = 'X'; st.squares[1].owner = 'O';
  assert.equal(L.mainResult(st.squares), null);
});

test('once neither player can still make three in a row, the match is a draw there and then', () => {
  // O O X / X O O / O X [ ] : O could still win at 8; X claims it and no line is left for anyone
  let st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'bs']);
  ['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X'].forEach((o, i) => { st.squares[i].owner = o; });
  st.squares[8].mini = oneMove();
  st.turn = 'X';
  assert.equal(L.mainResult(st.squares), null, 'O can still make a line: play on');
  assert.equal(L.playMove(st, 8, 0).ok, true);
  assert.equal(st.flash.kind, 'match');
  assert.equal(st.winner, 'draw'); assert.equal(st.winReason, 'blocked'); assert.equal(st.winLine, null);
  assert.deepEqual(st.counts, { X: 4, O: 5 }, 'no "most squares" any more');
  L.endFlash(st);
  assert.equal(st.screen, 'win');
  assert.equal(L.playMove(st, 8, 0).reason, 'over');
  // X O X / O X _ / O _ O : only O's bottom row is open; X takes square 7 and it is a draw with square 5 never played
  st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'bs', 'ttt']);
  ['X', 'O', 'X', 'O', 'X', null, 'O', null, 'O'].forEach((o, i) => { st.squares[i].owner = o; });
  st.squares[7].mini = oneMove();
  st.turn = 'X';
  assert.equal(L.mainResult(st.squares), null);
  assert.equal(L.lineOpen(st.squares, 'O'), true); assert.equal(L.lineOpen(st.squares, 'X'), false);
  L.playMove(st, 7, 0);
  assert.equal(st.winner, 'draw', 'a draw with a square still open');
  assert.equal(st.squares[5].owner, null);
  // the screenshot's board: four each, the last square cannot give anyone a line
  const sq = owners => owners.map(o => ({ owner: o, mini: L.newMini('ttt', lcg(1)) }));
  assert.equal(L.mainResult(sq([null, 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O'])).winner, 'draw');
  // a line still wins, even on a board where the other side is shut out
  assert.deepEqual(L.mainResult(sq(['X', 'X', 'X', 'O', 'O', null, null, null, null])), { winner: 'X', line: [0, 1, 2], reason: 'line' });
  // the old rule, kept for checking results from before: most squares on a full board
  assert.deepEqual(L.majorityResult(sq(['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'])), { winner: 'O', line: null, reason: 'majority', counts: { X: 4, O: 5 } });
  assert.equal(L.majorityResult(sq(['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null])), null, 'only a full board');
});

test('after a match the setup is kept for the next one', () => {
  const st = L.newMatch(lcg(5), { names: { X: 'Ann', O: 'Ben' }, games: ['ttt', 'hex'] });
  st.squares[0].mini = oneMove(); st.squares[1].mini = oneMove(); st.squares[2].mini = oneMove();
  turn(st, 0, 0); turn(st, 3, 0); turn(st, 1, 0); turn(st, 3, 1); turn(st, 2, 0);
  assert.equal(st.screen, 'win');
  st.screen = 'setup';                       // what "New match" does
  assert.deepEqual(st.setup.names, { X: 'Ann', O: 'Ben' });
  assert.deepEqual(L.enabledGames(st.setup), ['ttt', 'hex']);
  assert.equal(L.startMatch(st, lcg(6)), true);
  assert.equal(st.winner, null);
  assert.equal(st.moves, 0);
  assert.ok(st.squares.every(s => !s.owner && ['ttt', 'hex'].includes(s.mini.type)));
});

// ================================ After a move ================================
test('after a move the result shows, then the board comes back on its own and the turn passes', () => {
  const st = matchWith(['ttt', 'bs', 'ttt']);
  assert.equal(L.playMove(st, 0, 4).ok, true);
  assert.equal(st.turn, 'X', 'still X while the result plays');
  assert.equal(st.done, st.flash, 'the move is on record for the handoff');
  assert.equal(st.done.next, 'O');
  assert.equal(L.leaveSquare(st), false, 'nothing leaves while the result is playing');
  assert.deepEqual(L.playMove(st, 0, 5), { ok: false, reason: 'busy' });
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'busy' });
  assert.equal(L.endFlash(st), true);
  assert.equal(st.screen, 'board', 'the board is back');
  assert.equal(st.zoom, null);
  assert.equal(st.flash, null);
  assert.equal(st.done, null);
  assert.equal(st.turn, 'O', 'and the turn has passed');
  assert.equal(st.stamp, null, 'nothing was claimed');
  assert.equal(st.moves, 1);
  assert.equal(L.playMove(st, 0, 5).ok, true, 'O can move');
  assert.equal(st.flash.by, 'O');
  L.endFlash(st);
  assert.equal(st.turn, 'X');
});

test('the result can be held a moment longer: then the board follows and the turn passes', () => {
  const st = matchWith(['memory', 'ttt']);
  const cards = st.squares[0].mini.cards;
  let a = 0, b = 1;
  if (cards[a].s === cards[b].s && cards[a].c === cards[b].c) b = 2;   // avoid the pair
  assert.equal(L.playMove(st, 0, [a, b]).ok, true);
  L.endFlash(st, true);
  assert.equal(st.screen, 'mini', 'the two cards turn back over first');
  assert.equal(st.turn, 'X');
  assert.ok(st.done);
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'done' });
  assert.equal(L.leaveSquare(st), true);
  assert.equal(st.screen, 'board');
  assert.equal(st.turn, 'O');
  assert.deepEqual(st.squares[0].mini.seen.slice().sort(), [a, b].sort(), 'the cards shown are remembered');
});

test('just looking at a square, or at a claimed one, never passes the turn', () => {
  const st = matchWith(['ttt', 'bs']);
  st.squares[1].owner = 'O';
  st.screen = 'mini'; st.zoom = 1;                  // what tapping a square does
  assert.equal(L.leaveSquare(st), true);
  assert.equal(st.turn, 'X');
  assert.equal(st.screen, 'board');
  assert.equal(st.moves, 0);
  st.screen = 'mini'; st.zoom = 0;
  L.leaveSquare(st);
  assert.equal(st.turn, 'X');
});

test('a claim stamps in on the board as it comes back', () => {
  const st = matchWith(['bs', 'ttt']);
  st.squares[0].mini = oneMove();
  L.playMove(st, 0, 0);
  assert.equal(st.flash.kind, 'claim');
  assert.equal(st.squares[0].owner, 'X');
  L.endFlash(st);
  assert.equal(st.screen, 'board');
  assert.equal(st.stamp, 0, 'the mark stamps onto square 1');
  assert.equal(st.turn, 'O');
  st.screen = 'mini'; st.zoom = 0;                  // O looks at the claimed square
  L.leaveSquare(st);
  assert.equal(st.stamp, null, 'the stamp plays once');
  assert.equal(st.turn, 'O');
});

test('a bonus move keeps the player in the square until the move ends', () => {
  const st = matchWith(['pig', 'ttt']);
  const die = (...faces) => seq(...faces.map(n => pick(n - 1, 6)));
  L.playMove(st, 0, 'roll', die(3));
  assert.equal(st.done, null, 'a roll is not the end of the move');
  L.endFlash(st);
  assert.equal(st.screen, 'mini');
  assert.equal(L.leaveSquare(st), false, 'the turn in progress has to be finished');
  assert.equal(L.playMove(st, 0, 'bank').ok, true);
  assert.equal(st.done.next, 'O');
  assert.equal(st.turn, 'X');
  L.endFlash(st);
  assert.equal(st.lock, null);
  assert.equal(st.screen, 'board');
  assert.equal(st.turn, 'O');
});

test('a match-winning move goes straight to the win screen', () => {
  const st = matchWith(['bs', 'bs', 'bs', 'ttt']);
  for (let i = 0; i < 3; i++) st.squares[i].mini = oneMove();
  turn(st, 0, 0); turn(st, 3, 0); turn(st, 1, 0); turn(st, 3, 1);
  assert.equal(st.turn, 'X');
  L.playMove(st, 2, 0);
  assert.equal(st.winner, 'X');
  assert.equal(st.done, null);
  L.endFlash(st);
  assert.equal(st.screen, 'win');
  assert.equal(L.leaveSquare(st), false);
});

test('a new match clears any result still on show', () => {
  const st = matchWith(['ttt']);
  L.playMove(st, 0, 0); L.endFlash(st, true);
  assert.ok(st.done);
  st.screen = 'setup';
  assert.equal(L.startMatch(st, lcg(4)), true);
  assert.equal(st.done, null);
  assert.equal(st.stamp, null);
  assert.equal(st.turn, 'X');
});

test('setup: each side is a Human or Computer slot; a computer is called Computer; any combination plays', () => {
  const st = L.newState(lcg(1));
  assert.equal(st.setup.mode, 'two');
  assert.deepEqual(st.setup.players, { X: 'human', O: 'human' }, 'two people by default');
  assert.equal(L.cpuSide(st.setup), null);
  st.setup.players.O = 'cpu';
  L.syncNames(st.setup);
  assert.equal(L.cpuSide(st.setup), 'O');
  assert.deepEqual(st.setup.names, { X: 'X', O: L.CPU_NAME }, 'a computer slot is called Computer');
  st.setup.players.X = 'cpu';
  L.syncNames(st.setup);
  assert.equal(L.cpuSide(st.setup), 'XO', 'the computer can play both sides');
  assert.deepEqual(st.setup.names, { X: L.CPU_NAME, O: L.CPU_NAME });
  st.setup.names.X = 'HAL';
  L.syncNames(st.setup);
  assert.equal(st.setup.names.X, 'HAL', 'a typed name stays');
  st.setup.players.X = 'human';
  L.syncNames(st.setup);
  assert.equal(st.setup.names.X, 'HAL');
  st.setup.names.X = L.CPU_NAME;
  L.syncNames(st.setup);
  assert.equal(st.setup.names.X, 'X', 'a human slot drops the default computer name');
  for (const [players, cpu] of [[{ X: 'human', O: 'human' }, null], [{ X: 'human', O: 'cpu' }, 'O'], [{ X: 'cpu', O: 'human' }, 'X'], [{ X: 'cpu', O: 'cpu' }, 'XO']]) {
    const m = L.newMatch(lcg(3), { players });
    assert.equal(m.cpu, cpu, JSON.stringify(players));
    assert.equal(m.turn, 'X', 'X always moves first');
  }
  // setups saved before the slots: "vs Computer, you play O" becomes a Computer X slot
  const old = L.newMatch(lcg(3), { mode: 'cpu', human: 'O' });
  assert.equal(old.cpu, 'X');
  assert.deepEqual(old.setup.players, { X: 'cpu', O: 'human' });
  assert.equal(old.setup.mode, 'two');
  assert.deepEqual(L.normSetup({ mode: 'cpu', human: 'X', names: {} }).players, { X: 'human', O: 'cpu' });
  assert.equal(L.cpuSide({ mode: 'online', players: { X: 'cpu', O: 'cpu' } }), null, 'never in online play');
  assert.equal(L.newMatch(lcg(3)).cpu, null);
});

test('the public view of every mini-game holds nothing hidden', () => {
  const rng = lcg(9);
  for (const t of L.TYPES) {
    const m = L.newMini(t, rng);
    const pm = L.publicMini(m);
    const text = JSON.stringify(pm);
    assert.equal(pm.type, t);
    if (t === 'wordle' || t === 'hangman') assert.ok(!text.includes(m.word), `${t}: the word is hidden`);
    if (t === 'hilo') assert.ok(!('target' in pm));
    if (t === 'bs') assert.ok(!('ship' in pm) && pm.len === m.len, 'the ship\'s size is shown, not its place');
    if (t === 'hunt') assert.ok(!('treasure' in pm));
    if (t === 'memory') assert.ok(pm.cards.every(c => c === null), 'no card is known before any is shown');
    if (t === 'mastermind') assert.ok(!('code' in pm), 'the code is hidden');
    if (t === 'hangman') assert.ok(pm.pattern.every(ch => ch === null));
  }
  // what has been shown is public: a found letter, a dug cell's distance, a card once flipped
  const h = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  L.applyMove(h, 'X', 'P');
  assert.deepEqual(L.publicMini(h).pattern, [null, 'P', 'P', null, null]);
  const u = L.newMini('hunt', seq(pick(14, 36)));
  L.applyMove(u, 'X', 0);
  assert.equal(L.publicMini(u).clues[0], 3, 'four steps away: Cool, the band and not the distance');
  assert.equal(L.publicMini(u).clues[1], null);
  const mem = mini('memory');
  L.applyMove(mem, 'X', [3, 5]);
  const pmem = L.publicMini(mem);
  assert.deepEqual(pmem.seen, [3, 5]);
  assert.deepEqual(pmem.cards[3], mem.cards[3]);
  assert.equal(pmem.cards[0], null);
});

test('square values: a match-winning square first, then one the opponent would win, then open lines', () => {
  const st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].owner = 'X'; st.squares[1].owner = 'X';
  assert.equal(L.squareValue(st.squares, 2, 'X'), L.AI.win);
  assert.ok(L.squareValue(st.squares, 2, 'O') >= L.AI.block && L.squareValue(st.squares, 2, 'O') < L.AI.win);
  st.squares[3].owner = 'O'; st.squares[4].owner = 'O';
  assert.equal(L.squareValue(st.squares, 5, 'O'), L.AI.win);
  assert.ok(L.squareValue(st.squares, 5, 'X') >= L.AI.block);
  assert.ok(L.squareValue(st.squares, 2, 'X') > L.squareValue(st.squares, 5, 'X'), 'winning beats blocking');
  // a square on no open line for either side is worth almost nothing
  const dead = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  ['X', 'O', 'X', 'O', null, 'X', 'O', 'X', 'O'].forEach((o, i) => { dead.squares[i].owner = o; });
  assert.ok(L.squareValue(dead.squares, 4, 'X') < 1.5, `dead centre worth ${L.squareValue(dead.squares, 4, 'X')}`);
  const fresh = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  assert.ok(L.squareValue(fresh.squares, 4, 'X') > L.squareValue(fresh.squares, 1, 'X'), 'the centre sits on more open lines');
});

test('the computer always takes a square that wins the match, in any game that allows it', () => {
  // X owns 0 and 1; square 2 can be claimed at once in several games; square 5 is a tempting ttt threat
  const wins = [
    tttOf('X', 'X', null, 'O', null, null, null, null, null),
    Object.assign(mini('hilo'), { lo: 7, hi: 7, target: 7, guesses: [{ by: 'O', n: 6, res: 'higher' }, { by: 'O', n: 8, res: 'lower' }] }),
    Object.assign(mini('pig'), { bank: { X: 46, O: 0 }, turn: { by: 'X', rolls: [5], pot: 5 } }),   // (51 to win)
    Object.assign(L.newMini('hex', lcg(1)), { cells: ['X', 'X', 'X', null, null, null, null, null, null, null, null, null, null, null, null, null] }),
  ];
  for (const sq2 of wins) {
    const st = cpuMatch('X', ['ttt', 'ttt', sq2, 'ttt', 'ttt', tttOf('O', 'O', null), 'ttt', 'ttt', 'ttt'], ['X', 'X']);
    if (sq2.type === 'pig') st.lock = 2;
    const m = L.cpuMove(st, cpuRng());
    assert.equal(m.square, 2, `${sq2.type}: goes for the match`);
    const r = L.playMove(st, m.square, m.move, cpuRng());
    assert.equal(r.ok, true);
    assert.equal(st.winner, 'X', `${sq2.type}: and wins it`);
  }
  // a known Memory pair and a Wordle with one word left also win on the spot
  const mem = mini('memory');
  const pairIdx = (() => { const seen = new Map(); let p = null; mem.cards.forEach((c, i) => { const k = c.s + c.c; if (seen.has(k)) p = [seen.get(k), i]; else seen.set(k, i); }); return p; })();
  mem.seen = pairIdx.slice();
  const stm = cpuMatch('X', ['ttt', 'ttt', mem, 'ttt', 'ttt', tttOf('O', 'O', null)], ['X', 'X']);
  const mm = L.cpuMove(stm, cpuRng());
  assert.equal(mm.square, 2);
  assert.deepEqual(mm.move.slice().sort(), pairIdx.slice().sort());
  const w = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  for (const g of ['CRANK', 'CRATE']) L.applyMove(w, 'O', g);
  const cands = L.wordleCandidates(L.publicMini(w));
  if (cands.length === 1) {
    const stw = cpuMatch('X', ['ttt', 'ttt', w, 'ttt', 'ttt', tttOf('O', 'O', null)], ['X', 'X']);
    const mw = L.cpuMove(stw, cpuRng());
    assert.equal(mw.square, 2);
    assert.equal(mw.move, 'CRANE');
  }
});

test('the computer always defends a square the opponent is one move from winning the match with', () => {
  // O owns 3 and 4; square 5 holds the opponent's threat in a game that can be blocked
  const threats = [
    [tttOf('O', 'O', null, 'X', null, null, null, null, null), 2],
    [(() => { const c = mini('c4'); for (const [p, col] of [['O', 0], ['O', 1], ['O', 2], ['X', 0], ['X', 1]]) L.applyMove(c, p, col); return c; })(), 3],
    [Object.assign(L.newMini('hex', lcg(1)), { cells: ['O', null, null, null, 'O', null, null, null, 'O', null, null, null, null, null, null, null] }), 12],
  ];
  for (const [sq5, block] of threats) {
    // elsewhere X has its own progress to tempt it away: square 0 is a ttt with two X marks
    const st = cpuMatch('X', [tttOf('X', 'X', null, 'O', 'O', null), 'ttt', 'ttt', 'ttt', 'ttt', sq5, 'ttt', 'ttt', 'ttt'], [null, null, null, 'O', 'O']);
    const m = L.cpuMove(st, cpuRng());
    assert.equal(m.square, 5, `${sq5.type}: defends the threatened square`);
    assert.equal(m.move, block, `${sq5.type}: with the blocking move`);
    assert.equal(L.playMove(st, m.square, m.move, cpuRng()).ok, true);
  }
  // ...unless it can win the match itself right now
  const st = cpuMatch('X', ['ttt', 'ttt', tttOf('X', 'X', null), 'ttt', 'ttt', tttOf('O', 'O', null), 'ttt', 'ttt', 'ttt'], ['X', 'X', null, 'O', 'O']);
  const m = L.cpuMove(st, cpuRng());
  assert.equal(m.square, 2, 'winning comes first');
  assert.equal(m.move, 2);
  L.playMove(st, m.square, m.move);
  assert.equal(st.winner, 'X');
});

test('coin flip, higher/lower and pig tactics', () => {
  const coins = L.localBest({ type: 'coins', coins: ['X', 'O', 'O', '?', 'O'] }, 'X', cpuRng());
  assert.equal(coins.move, 'flip');
  assert.equal(coins.q, 0, 'four to turn: no chance of finishing this move');
  assert.equal(L.localBest({ type: 'coins', coins: ['X', 'X', 'X', 'X', '?'] }, 'X', cpuRng()).q, 0.5);
  assert.equal(L.localBest({ type: 'hilo', lo: 1, hi: 20, guesses: [] }, 'X', cpuRng()).move, 10);
  assert.equal(L.localBest({ type: 'hilo', lo: 11, hi: 20, guesses: [] }, 'X', cpuRng()).move, 15);
  assert.equal(L.localBest({ type: 'hilo', lo: 7, hi: 7, guesses: [] }, 'X', cpuRng()).q, 1);
  const pig = (bank, oppBank, turn) => L.localBest({ type: 'pig', bank: { X: bank, O: oppBank }, turn }, 'X', cpuRng()).move;
  assert.equal(pig(0, 0, null), 'roll', 'a move starts with a roll');
  assert.equal(pig(0, 0, { by: 'X', rolls: [3], pot: 3 }), 'roll', 'keeps rolling with a small pot');
  assert.equal(pig(0, 0, { by: 'X', rolls: [6, 4], pot: 10 }), 'bank', 'banks around 8 to 10');
  assert.equal(pig(0, 10, { by: 'X', rolls: [6, 4], pot: 10 }), 'roll', 'bolder when behind');
  assert.equal(pig(10, 0, { by: 'X', rolls: [4, 3], pot: 7 }), 'bank', 'safer when ahead');
  assert.equal(pig(0, 0, { by: 'X', rolls: [1, 2, 3, 4], pot: 10 }), 'bank', 'too many bust numbers');
  assert.equal(pig(0, 0, { by: 'X', rolls: [1, 2, 3, 4, 5, 6], pot: 21 }), 'bank', 'never a seventh roll');
  assert.equal(pig(16, 0, { by: 'X', rolls: [5], pot: 5 }), 'bank', 'always banks a win');
  assert.equal(pig(19, 0, { by: 'X', rolls: [2], pot: 2 }), 'bank');
  assert.equal(pig(15, 0, { by: 'X', rolls: [5], pot: 5 }), 'roll', '20 is one short of 21');
});

test('the computer prefers finishing a square it is close to over one it is far from, and ignores lost squares', () => {
  const close = tttOf('X', 'X', null, 'O', null, null, null, null, null);      // one move from claiming
  const far = tttOf(null, null, null, null, null, null, null, null, null);
  const lost = tttOf('O', 'O', null, 'X', 'O', 'X', 'X', null, null);         // O finishes at 2 or 8: nothing X does saves it
  const st = cpuMatch('X', [far, close, 'dice', lost, 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  const m = L.cpuMove(st, cpuRng());
  assert.equal(m.square, 1);
  assert.equal(m.move, 2);
  // with the near square gone, disrupting a square O is about to take beats an empty square
  st.squares[1].owner = 'X';
  st.squares[3].mini = tttOf('O', 'O', null, 'X', null, null, null, null, 'X');   // one threat, and the block builds X a line
  const m2 = L.cpuMove(st, cpuRng());
  assert.equal(m2.square, 3, 'disrupts the square O is about to take');
  assert.equal(m2.move, 2);
  // the lost square never draws a move while anything else is open
  st.squares[3].mini = lost;
  for (let k = 0; k < 3; k++) {
    const mk = L.cpuMove(st, lcg(k));
    assert.notEqual(mk.square, 3, 'no move wasted on a lost square');
  }
});

// ---- the online turn clock: a random legal move on a timeout, a loss on the second in a row ----
test('newTimer and the timer options', () => {
  assert.deepEqual(L.TIMER_OPTIONS, [0, 60], 'a friend game: no limit or 1 minute');
  assert.deepEqual([0, 60, 30, 180, 45, null].map(L.normTimer), [0, 60, 60, 60, 0, 0], 'an older 30 s or 3 min room becomes 1 minute');
  const t = L.newTimer(60);
  assert.deepEqual(t, { limit: 60, deadline: null, for: null, pausedAt: null, timeouts: { X: 0, O: 0 }, streak: { X: 0, O: 0 }, bankNext: false });
  assert.equal(L.newTimer(0).limit, 0);
  assert.equal(L.newTimer().limit, 0);
  const st = L.newMatch(lcg(1), { mode: 'online', timer: 60 });
  assert.equal(st.timer.limit, 60, 'an online match keeps the chosen limit');
  assert.equal(L.newMatch(lcg(1), { mode: 'online', timer: 30 }).timer.limit, 60);
  const two = L.newMatch(lcg(1), { mode: 'two', timer: 60 });
  assert.equal(two.timer.limit, 0, 'local matches have no clock');
  const bad = L.newMatch(lcg(1), { mode: 'online', timer: 45 });
  assert.equal(bad.timer.limit, 0, 'an unknown limit means no limit');
});

test('a random wordle move is a dictionary word, a random hangman letter is unguessed, pig banks a pot it holds', () => {
  const rng = lcg(5);
  const w = L.newMini('wordle', rng);
  for (let k = 0; k < 20; k++) assert.ok(L.VALID5.has(L.randomLegalMove(w, 'X', rng)), 'a word from the dictionary');
  const h = L.newMini('hangman', rng);
  h.letters.push({ l: 'A', hit: false }, { l: 'E', hit: true });
  for (let k = 0; k < 30; k++) assert.ok(!['A', 'E'].includes(L.randomLegalMove(h, 'X', rng)), 'never a letter already tried');
  const pg = L.newMini('pig', rng);
  assert.equal(L.randomLegalMove(pg, 'X', rng), 'roll', 'nothing to bank yet');
  pg.turn = { by: 'X', pot: 7, rolls: 2 };
  assert.equal(L.randomLegalMove(pg, 'X', rng), 'bank');
  assert.equal(L.randomLegalMove(pg, 'O', rng), 'roll', 'the other player has no pot');
  const mem = L.newMini('memory', rng);
  for (let k = 0; k < 30; k++) { const [a, b] = L.randomLegalMove(mem, 'X', rng); assert.notEqual(a, b); assert.ok(a >= 0 && a < 9 && b >= 0 && b < 9); }
});

test('a timeout plays a random legal move, marks it, and the turn passes', () => {
  const st = matchWith(['ttt', 'c4', 'hex', 'bs', 'hunt', 'hilo', 'coins', 'dice', 'candy']);
  st.timer = L.newTimer(30);
  const r = L.timeoutMove(st, lcg(3));
  assert.equal(r.ok, true);
  assert.ok(st.flash, 'the move plays out like any other');
  assert.equal(st.flash.timeout, true, 'the result says it was forced');
  assert.equal(st.flash.square, r.square);
  assert.equal(st.timer.timeouts.X, 1);
  assert.equal(st.timer.streak.X, 1);
  assert.equal(st.moves, 1);
  L.endFlash(st); L.leaveSquare(st);
  assert.equal(st.turn, 'O', 'the turn passes');
  // O moves in time: O's streak stays 0; X's timeout streak is untouched by O's move
  const t2 = L.timeoutMove(st, lcg(4));
  assert.equal(t2.ok, true);
  assert.equal(st.timer.streak.O, 1);
  L.endFlash(st); L.leaveSquare(st);
  assert.equal(st.turn, 'X');
  // X plays in time now: the streak resets
  const open = st.squares.findIndex((sq, i) => !sq.owner && sq.mini.type === 'ttt' && st.lock == null);
  if (open >= 0 && st.lock == null) {
    const m = L.randomLegalMove(st.squares[open].mini, 'X', lcg(9));
    const rr = L.playMove(st, open, m, lcg(9));
    assert.equal(rr.ok, true);
    assert.equal(st.flash.timeout, false);
    assert.equal(st.timer.streak.X, 0, 'a move made in time clears the streak');
    assert.equal(st.timer.timeouts.X, 1, 'the count of timeouts stays');
  }
});

test('a second timeout in a row loses the match at once', () => {
  const st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.timer = L.newTimer(30);
  assert.equal(L.timeoutMove(st, lcg(1)).ok, true);          // X times out
  L.endFlash(st); L.leaveSquare(st);
  assert.equal(st.turn, 'O');
  const o = L.randomLegalMove(st.squares[8].mini, 'O', lcg(2));
  assert.equal(L.playMove(st, 8, o, lcg(2)).ok, true);        // O plays in time
  L.endFlash(st); L.leaveSquare(st);
  assert.equal(st.turn, 'X');
  const r = L.timeoutMove(st, lcg(3));                         // X times out again
  assert.deepEqual(r, { ok: true, lost: 'X' });
  assert.equal(st.winner, 'O');
  assert.equal(st.winReason, 'timeout');
  assert.equal(st.winLine, null);
  assert.equal(st.screen, 'win');
  assert.equal(st.flash, null);
  assert.equal(st.timer.timeouts.X, 2);
  assert.equal(L.timeoutMove(st, lcg(4)).ok, false, 'nothing more once the match is over');
  assert.equal(L.playMove(st, 0, 4, lcg(4)).ok, false);
});

test('timeouts by the two players do not add up to a loss; only a player\'s own consecutive ones do', () => {
  const st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.timer = L.newTimer(30);
  for (let k = 0; k < 2; k++) {
    const r = L.timeoutMove(st, lcg(10 + k));
    assert.equal(r.ok, true); assert.equal(r.lost, undefined);
    L.endFlash(st); L.leaveSquare(st);
  }
  assert.equal(st.winner, null);
  assert.deepEqual(st.timer.streak, { X: 1, O: 1 });
  assert.deepEqual(st.timer.timeouts, { X: 1, O: 1 });
});

test('a timeout mid-bonus-move stays in the locked square', () => {
  const st = matchWith(['ttt', 'memory', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.timer = L.newTimer(30);
  st.lock = 1;
  const r = L.timeoutMove(st, lcg(8));
  assert.equal(r.ok, true);
  assert.equal(r.square, 1, 'the only square open to a locked player');
});

test('timeouts over every kind of game keep the state legal and plain', () => {
  const rng = lcg(31337);
  const seen = new Set();
  for (let game = 0; game < 6; game++) {
    const st = L.newMatch(rng, { mode: 'online', timer: 30, games: L.TYPES.filter(t => !['echo', 'trivia', 'oddone', 'patterns', 'skyhop', 'scoop', 'pinball', 'headcount', 'flash', 'snapshot'].includes(t)) });   // (a timed-out attempt at those is always a failed one, or none: a square of theirs never falls to timeouts)
    let guard = 0;
    while (!st.winner && guard++ < 3000) {
      const open = st.squares.map((q, i) => (q.owner ? -1 : i)).filter(i => i >= 0);
      if (guard > 400 && st.lock == null && open.every(i => ['wordle', 'mastermind'].includes(st.squares[i].mini.type))) {
        // only long-shot squares are left (a random word or code rarely cracks them): the forced move finds the secret
        const m = st.squares[open[0]].mini;
        assert.equal(L.playMove(st, open[0], m.type === 'wordle' ? m.word.toLowerCase() : m.code.slice(), rng, { forced: true }).ok, true);
      } else if (st.timer.bankNext) { st.timer.bankNext = false; assert.equal(L.playMove(st, st.lock, st.squares[st.lock].mini.type === 'craps' ? 'stop' : 'bank', rng, { forced: true }).ok, true); }   // (as the server: Risky Rolls banks, Craps stops)
      else {
        const r = L.timeoutMove(st, rng);
        assert.equal(r.ok, true, `timeout move failed: ${r.reason}`);
        if (r.lost) break;
        seen.add(st.flash.type);
        // the clock alternates with a timely move so the match does not end on streaks straight away
        st.timer.streak[st.flash.by] = game % 2 ? st.timer.streak[st.flash.by] : 0;
      }
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
      L.endFlash(st); L.leaveSquare(st);
    }
    assert.ok(st.winner, `match ${game} ends (${guard} moves)`);
  }
  assert.ok(seen.size >= 6, `timeouts were played in ${seen.size} different games`);
});
test('a match record keeps every secret out of the public state and puts it back for a move', () => {
  const rng = lcg(11);
  for (const type of L.TYPES) {
    const st = matchWith([type, 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], rng);
    st.id = 'm1'; st.seq = 0; st.recent = [];
    const rec = L.matchRecord(st);
    const pub = rec.state.squares[0].mini;
    const key = SECRET_KEYS[type];
    if (key) {
      assert.ok(rec.secrets[0], `${type}: a secret is kept`);
      if (type === 'hangman') assert.match(pub.word, /^_+$/, 'hangman shows only the length');
      else if (type === 'memory') assert.ok(pub.cards.every(c => c === null), 'no card is known');
      else assert.ok(!(key in pub), `${type}: ${key} is not public`);
      if (type === 'hunt') assert.equal(pub.clues.length, 36);
    } else assert.equal(rec.secrets[0], undefined, `${type}: nothing to hide`);
    assert.deepEqual(JSON.parse(JSON.stringify(rec)), rec, 'plain JSON');
    const full = L.fullState(rec);
    const mini = full.squares[0].mini;
    if (key) assert.deepEqual(mini[key], st.squares[0].mini[key], `${type}: the secret is back`);
    if (type === 'hunt') assert.equal(mini.clues, undefined);
    assert.equal(full.turn, 'X'); assert.equal(full.flash, null); assert.equal(full.screen, 'board');
  }
});

test('an online move is checked for the turn and the rules, then settled: the turn passes and the move is on record', () => {
  const st = matchWith(['ttt', 'wordle', 'hangman', 'pig', 'memory', 'ttt', 'ttt', 'ttt', 'ttt'], lcg(3));
  st.squares[1].mini.word = 'CRANE'; st.squares[2].mini.word = 'APPLE';
  st.id = 'm'; st.seq = 0; st.recent = [];
  let rec = L.matchRecord(st);
  assert.equal(L.applyOnlineMove(rec, 'O', 0, 4, lcg(1)).reason, 'turn', 'not O\'s turn');
  assert.equal(L.applyOnlineMove(rec, 'X', 1, 'zzzzz', lcg(1)).reason, 'notword');
  let r = L.applyOnlineMove(rec, 'X', 0, 4, lcg(1));
  assert.equal(r.ok, true);
  assert.equal(r.rec.state.turn, 'O', 'the turn passed at once');
  assert.equal(r.rec.state.seq, 1); assert.equal(r.rec.state.moves, 1);
  assert.equal(r.entries.length, 1);
  const e = r.entries[0];
  assert.equal(e.seq, 1); assert.equal(e.by, 'X'); assert.equal(e.square, 0); assert.equal(e.kind, 'move'); assert.equal(e.next, 'O');
  assert.equal(e.after.mini.cells[4], 'X', 'the square as it was after the move');
  assert.deepEqual(r.rec.state.recent, [e]);
  assert.equal(r.rec.state.squares[0].mini.cells[4], 'X');
  rec = r.rec;
  // a wordle guess: the word stays secret, the marks are public
  r = L.applyOnlineMove(rec, 'O', 1, 'crate', lcg(2));
  assert.equal(r.ok, true);
  assert.equal(r.rec.state.squares[1].mini.guesses[0].marks.join(''), 'gggxg');
  assert.ok(!('word' in r.rec.state.squares[1].mini));
  assert.equal(r.rec.secrets[1].word, 'CRANE');
  assert.equal(r.entries[0].word, 'CRATE');
  rec = r.rec;
  // a hangman hit: a bonus move, the lock stays, the turn does not pass
  r = L.applyOnlineMove(rec, 'X', 2, 'P', lcg(2));
  assert.equal(r.ok, true);
  assert.equal(r.entries[0].kind, 'again'); assert.equal(r.rec.state.turn, 'X'); assert.equal(r.rec.state.lock, 2);
  assert.equal(r.rec.state.squares[2].mini.word, '_PP__');
  rec = r.rec;
  assert.equal(L.applyOnlineMove(rec, 'X', 0, 0, lcg(2)).reason, 'locked', 'the bonus move is owed in that square');
  r = L.applyOnlineMove(rec, 'X', 2, 'Z', lcg(2));
  assert.equal(r.ok, true); assert.equal(r.rec.state.turn, 'O'); assert.equal(r.rec.state.lock, null);
  rec = r.rec;
  // memory: the pick shows one card to both, the move shows two
  r = L.applyOnlinePick(rec, 'O', 4, 3);
  assert.equal(r.ok, true); assert.equal(r.rec.state.pick, 3); assert.equal(r.rec.state.pickSq, 4);
  assert.ok(r.rec.state.squares[4].mini.cards[3], 'the picked card is up'); assert.equal(r.rec.state.squares[4].mini.cards[0], null);
  assert.equal(L.applyOnlinePick(rec, 'X', 4, 3).reason, 'turn');
  r = L.applyOnlinePick(r.rec, 'O', 4, 3);
  assert.equal(r.rec.state.pick, null, 'tapped again: turned back');
  r = L.applyOnlineMove(rec, 'O', 4, [3, 5], lcg(4));
  assert.equal(r.ok, true);
  assert.deepEqual(r.rec.state.squares[4].mini.seen.slice().sort(), [3, 5]);
  assert.equal(r.rec.state.squares[4].mini.cards.filter(Boolean).length, 2);
  assert.equal(r.rec.state.pick, null);
  rec = r.rec;
  assert.ok(rec.state.recent.length <= L.RECENT_MAX);
  // pig: a roll keeps the turn, the bank passes it
  r = L.applyOnlineMove(rec, 'X', 3, 'roll', seq(0.2));
  assert.equal(r.ok, true);
  if (r.entries[0].note !== 'bust') { assert.equal(r.rec.state.turn, 'X'); assert.equal(r.rec.state.lock, 3); r = L.applyOnlineMove(r.rec, 'X', 3, 'bank', lcg(1)); assert.equal(r.ok, true); }
  assert.equal(r.rec.state.turn, 'O'); assert.equal(r.rec.state.lock, null);
});

test('the record keeps at most the last few moves, and a claim or a win is settled in the record', () => {
  let st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], lcg(5));
  st.id = 'm'; st.seq = 0; st.recent = [];
  let rec = L.matchRecord(st);
  const moves = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]];   // X claims square 0 on the fifth move
  let r;
  for (const [sq, cell] of moves) { r = L.applyOnlineMove(rec, rec.state.turn, sq, cell, lcg(1)); assert.equal(r.ok, true, r.reason); rec = r.rec; }
  assert.equal(rec.state.squares[0].owner, 'X');
  assert.equal(r.entries[0].kind, 'claim'); assert.equal(r.entries[0].after.owner, 'X');
  assert.equal(rec.state.turn, 'O');
  for (let k = 0; k < 12; k++) { const t = rec.state.turn; const sq = rec.state.squares.findIndex(q => !q.owner && q.mini.cells.some(c => !c)); const cell = rec.state.squares[sq].mini.cells.findIndex(c => !c); r = L.applyOnlineMove(rec, t, sq, cell, lcg(k)); assert.equal(r.ok, true); rec = r.rec; }
  assert.equal(rec.state.recent.length, L.RECENT_MAX);
  assert.equal(rec.state.recent[L.RECENT_MAX - 1].seq, rec.state.seq);
});

test('each move on the record carries its square as it was before (for the playback) and as the move left it', () => {
  let st = matchWith(['ttt', 'pig', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], lcg(8));
  st.id = 'm'; st.seq = 0; st.recent = []; st.timer = L.newTimer(30);
  st.squares[0].mini.cells = ['X', 'X', null, 'O', 'O', null, null, null, null];
  let rec = L.matchRecord(st);
  const was = JSON.parse(JSON.stringify(rec.state.squares[0]));
  let r = L.applyOnlineMove(rec, 'X', 0, 2, lcg(1));
  assert.equal(r.ok, true);
  const e = r.entries[0];
  assert.equal(e.kind, 'claim');
  assert.deepEqual(e.before, was, 'before: the square as the record had it, unclaimed');
  assert.equal(e.before.owner, null); assert.equal(e.after.owner, 'X');
  assert.deepEqual(r.rec.state.recent[0].before, was, 'kept on the record');
  // a timeout: the forced roll's square before, and the bank that follows starts where the roll left it
  rec = r.rec;
  const st2 = L.fullState(rec); st2.lock = 1; st2.turn = 'O'; st2.timer.deadline = 1;   // O's time runs out in Risky Rolls: a roll, then the bank
  rec = L.matchRecord(st2);
  const was1 = JSON.parse(JSON.stringify(rec.state.squares[1]));
  r = L.applyOnlineTimeout(rec, () => 0.9);                      // a 6 (a first roll never busts), then the bank
  assert.equal(r.ok, true); assert.equal(r.entries.length, 2);
  assert.deepEqual(r.entries[0].before, was1);
  assert.deepEqual(r.entries[1].before, r.entries[0].after, 'the bank starts from the roll');
});

test('a new online match comes from the lobby settings and a rematch starts over with the same ones', () => {
  const setup = { names: { X: 'Hosty', O: 'Guesty' }, games: Object.fromEntries(L.TYPES.map(t => [t, t === 'ttt' || t === 'wordle'])), timer: 60 };
  const rec = L.newOnlineMatch(setup, lcg(9), 'abc');
  assert.ok(rec);
  assert.equal(rec.state.id, 'abc'); assert.equal(rec.state.seq, 0); assert.deepEqual(rec.state.recent, []);
  assert.equal(rec.state.timer.limit, 60); assert.equal(rec.state.turn, 'X'); assert.equal(rec.state.moves, 0);
  assert.ok(rec.state.squares.every(sq => ['ttt', 'wordle'].includes(sq.mini.type)));
  assert.deepEqual(rec.state.games, ['ttt', 'wordle']);
  assert.ok(!rec.state.setup, 'the names live in the room, not the record');
  const none = L.newOnlineMatch({ games: Object.fromEntries(L.TYPES.map(t => [t, false])) }, lcg(9), 'x');
  assert.equal(none, null, 'no games: no match');
});

test('games no longer dealt (Hexapawn, the Dice race): never in a new match or Find Match, never dealt by a reset, even for an older match whose list still names them', () => {
  const OLD = L.OLD_TYPES, rng = lcg(77);
  for (let k = 0; k < 300; k++) for (const sq of L.newMatch(rng).squares) assert.ok(!OLD.includes(sq.mini.type), sq.mini.type);
  const all = Object.fromEntries(L.TYPES.concat(OLD).map(t => [t, true]));            // a setup or room saved with them still ticked
  for (let k = 0; k < 100; k++) for (const sq of L.newOnlineMatch({ games: all }, rng, 'm' + k).state.squares) assert.ok(!OLD.includes(sq.mini.type));
  const st0 = L.newState(lcg(5)); Object.assign(st0.setup.games, { hexapawn: true, dice: true });
  assert.ok(L.startMatch(st0, rng) && st0.squares.every(sq => !OLD.includes(sq.mini.type)) && !st0.games.some(t => OLD.includes(t)));
  // resets in an older match: its list names Hexapawn and the Dice race; draws reset to the games still dealt
  for (const list of [L.TYPES.concat(OLD), ['hexapawn', 'ttt'], ['hexapawn'], ['dice', 'hexapawn']]) {
    const seen = new Set();
    for (let k = 0; k < 120; k++) {
      const st = matchWith(['ttt'], rng);
      st.games = list.slice();
      for (let i = 0; i < 8; i++) st.squares[0].mini.cells[i] = TTT_DRAW[i];
      st.turn = TTT_DRAW[8];
      L.playMove(st, 0, 8, rng);
      seen.add(st.squares[0].mini.type);
    }
    assert.ok(![...seen].some(t => OLD.includes(t)), `${list}: reset to ${[...seen]}`);
    if (list.length === 2 && list.includes('ttt')) assert.deepEqual([...seen], ['ttt'], 'the rest of that match\'s list');
    if (!list.some(t => L.TYPES.includes(t))) assert.ok(seen.size > 5, 'nothing left in its list: any game still dealt');
  }
});
test('engine: every module the server runs is pure: no clock, no Math.random, no page', () => {
  for (const f of require('../engine-files.js')) {
    const code = require('node:fs').readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');   // the code, without its comments
    assert.ok(!/Math\.random|Date\.now|performance\.now|\bdocument\.|\bwindow\.|localStorage/.test(code), `${f}: no clock, no Math.random, no page in the engine`);
  }
});
test('engine: the turn clock allows for the playback of the moves just made', () => {
  const st = { turn: 'O', winner: null, timer: E.newTimer(60) };
  E.armClock(st, [], 1000);
  assert.equal(st.timer.deadline, 61000); assert.equal(st.timer.for, 'O');
  const e = { type: 'ttt', kind: 'move', square: 0 };
  E.armClock(st, [e], 1000);
  assert.equal(st.timer.deadline, 61000 + E.PLAY.spot + E.playMs(e) + E.PLAY.flash.move);
  st.winner = 'X'; E.armClock(st, [e], 1000);
  assert.equal(st.timer.deadline, null, 'no clock once the match is over');
});
test('engine: resigning hands the match to the other side', () => {
  const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' } }, E.makeRng(5), 'g1');
  const r = E.applyOnlineResign(rec, 'X');
  assert.ok(r.ok); assert.equal(r.rec.state.winner, 'O'); assert.equal(r.rec.state.winReason, 'resign'); assert.equal(r.rec.state.resigned, 'X');
  assert.equal(E.applyOnlineResign(r.rec, 'O').reason, 'over', 'only once');
});

// ---- stats: turns per mini-game, how each one ended ----
test('stats: each mini-game counts the turns each side spent in it, bonus moves within a turn counting once', () => {
  const st = matchWith(['pig', 'ttt', 'bs', 'hangman']);
  st.squares[2].mini = bsAt(4, 5);
  st.squares[3].mini = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  turn(st, 0, 'roll', die(3)); turn(st, 0, 'roll', die(4)); turn(st, 0, 'bank');   // X: one turn of Risky Rolls, three moves
  turn(st, 2, 4); turn(st, 2, 5);                                                    // O: a hit, then the bonus shot sinks it, one turn
  turn(st, 3, 'P'); turn(st, 3, 'Z');                                                // X: a hit and a bonus miss, one turn
  assert.deepEqual(st.squares[0].mv, { X: 1, O: 0 });
  assert.deepEqual(st.squares[3].mv, { X: 1, O: 0 });
  assert.deepEqual(st.sqlog, [{ t: 'bs', end: 'won', w: 'O', X: 0, O: 1 }]);
  // a drawn square resets: its count goes to the log and the new game starts from zero
  st.squares[1].mini = tttOf('X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null);
  st.turn = 'X';
  turn(st, 1, 8, typeRng('ttt'));
  assert.deepEqual(st.sqlog[1], { t: 'ttt', end: 'draw', w: null, X: 1, O: 0 });
  assert.deepEqual(st.squares[1].mv, { X: 0, O: 0 });
  const s = L.matchStats(st);
  assert.deepEqual(s.squares.map(e => `${e.t}:${e.end}:${e.X}/${e.O}`), ['bs:won:0/1', 'ttt:draw:1/0', 'pig:open:1/0', 'hangman:open:1/0']);
  assert.equal(s.turns, 4);
  assert.equal(s.winner, null);
  // the counts travel with an online record
  st.id = 'm'; st.seq = 0; st.recent = [];
  const back = L.fullState(L.matchRecord(st));
  assert.deepEqual(back.sqlog, st.sqlog);
  assert.deepEqual(back.squares[0].mv, { X: 1, O: 0 });
});

test('timeouts: Coin flip flips, Battleship fires at an open cell, Risky Rolls banks once 51 is reached', () => {
  const st = matchWith(['coins', 'bs', 'pig']);
  st.timer = L.newTimer(30);
  for (let k = 0; k < 40; k++) {
    const m = L.randomLegalMove(st.squares[1].mini, 'X', lcg(k));
    assert.ok(Number.isInteger(m) && m >= 0 && m < 16 && !st.squares[1].mini.revealed[m]);
  }
  assert.equal(L.randomLegalMove(st.squares[0].mini, 'X'), 'flip');
  st.squares[2].mini = Object.assign(mini('pig'), { bank: { X: 48, O: 0 }, turn: { by: 'X', rolls: [4], pot: 4 } });   // (51 to win)
  st.lock = 2;
  const r = L.timeoutMove(st, lcg(5));
  assert.equal(r.ok, true); assert.equal(r.move, 'bank');
  assert.equal(st.squares[2].owner, 'X');
});

// =============================== Local seating ===============================
test('local setup: player 1 picks X, O or Random; player 2 (a person or the computer) gets the other side', () => {
  const seat = (local, rng) => { const s = L.defaultSetup(); s.local = local; L.seatLocal(s, rng || lcg(1)); return s; };
  let s = seat({ pick: 'X', p2: 'human', n1: 'Ann', n2: 'Bob' });
  assert.deepEqual([s.names, s.players, s.human], [{ X: 'Ann', O: 'Bob' }, { X: 'human', O: 'human' }, 'X']);
  s = seat({ pick: 'O', p2: 'cpu', n1: 'Ann', n2: '' });
  assert.deepEqual([s.names, s.players, s.human], [{ X: 'Computer', O: 'Ann' }, { X: 'cpu', O: 'human' }, 'O']);
  assert.equal(L.cpuSide(s), 'X', 'the computer plays X and moves first');
  s = seat({ pick: 'X', p2: 'human', n1: '', n2: '' });
  assert.deepEqual(s.names, { X: 'X', O: 'O' }, 'a blank name is the side\'s letter');
  const sides = new Set(), r = lcg(9);
  for (let k = 0; k < 40; k++) { const t = seat({ pick: 'random', p2: 'cpu', n1: 'Ann', n2: '' }, r); sides.add(t.human); assert.equal(t.names[t.human], 'Ann'); assert.equal(t.players[t.human], 'human'); assert.equal(t.players[t.human === 'X' ? 'O' : 'X'], 'cpu'); }
  assert.deepEqual([...sides].sort(), ['O', 'X'], 'Random draws both sides');
  // a rematch: the same choice, Random drawn again (startMatch keeps the seats it is given)
  const st = L.newState(lcg(3));
  st.setup.local = { pick: 'O', p2: 'human', n1: 'Ann', n2: 'Bob' };
  for (let k = 0; k < 3; k++) { L.seatLocal(st.setup, lcg(k)); L.startMatch(st, lcg(k)); assert.deepEqual(st.setup.names, { X: 'Bob', O: 'Ann' }); assert.equal(st.cpu, null); }
  // older setups: the computer, if any, becomes player 2; two computers can no longer happen
  const old = (players, names) => L.normLocal({ players, names });
  assert.deepEqual(old({ X: 'cpu', O: 'human' }, { X: 'Computer', O: 'Zed' }), { pick: 'O', p2: 'cpu', n1: 'Zed', n2: '', level: 'normal' });
  assert.deepEqual(old({ X: 'human', O: 'human' }, { X: 'Ann', O: 'O' }), { pick: 'X', p2: 'human', n1: 'Ann', n2: '', level: 'normal' });
  assert.deepEqual(old({ X: 'cpu', O: 'cpu' }, { X: 'Computer', O: 'Computer' }), { pick: 'X', p2: 'cpu', n1: '', n2: '', level: 'normal' }, 'computer vs computer: player 1 is a person');
  assert.deepEqual(L.normLocal({ local: { pick: 'Q', p2: 'robot', n1: 5 } }), { pick: 'X', p2: 'human', n1: '5', n2: '', level: 'normal' }, 'junk is tidied');
});
