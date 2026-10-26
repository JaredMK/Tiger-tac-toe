'use strict';
// Cross-version play (core/client.js lackedTypes, core/board.js resets): a match is dealt for the clients in it, a square
// that resets draws only from the match's own list, and a client older than it was (the app reinstalled older, an old
// page from a cache) can tell which mini-games of a match it lacks, so the page shows the stale screen instead of the
// board (ui/screens/stale.js; tests/ui/stale.test.mjs).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const WEB = { v: E.CLIENT_VERSION, p: 'web' };
const OLD = { v: '0.9.0', p: 'web' };                 // older than every game's minVersion (none is below 1.0.0)

test('lackedTypes: a match dealt for this client lacks nothing; an unknown mini-game, or one newer than the client, is lacked, in a square or in the match\'s list', () => {
  const st = E.newMatch(E.makeRng('cv'), { games: ['ttt', 'c4', 'hilo'] });
  assert.deepEqual(E.lackedTypes(WEB, st), []);
  assert.deepEqual(E.lackedTypes(undefined, st), [], 'a client that says nothing is the first web page, which has every game of the first release');
  const unknown = JSON.parse(JSON.stringify(st));
  unknown.squares[3].mini.type = 'zzz';
  assert.deepEqual(E.lackedTypes(WEB, unknown), ['zzz'], 'a type this code has no game for');
  const listed = JSON.parse(JSON.stringify(st));
  listed.games = ['ttt', 'c4', 'hilo', 'newgame'];
  assert.deepEqual(E.lackedTypes(WEB, listed), ['newgame'], 'in the list a reset deals from, though in no square yet');
  const lacked = E.lackedTypes(OLD, st);
  assert.ok(lacked.length >= 3 && lacked.every(t => E.TYPES.includes(t)), 'every dealt game is newer than a 0.9.0 client: ' + lacked.join(' '));
  for (const t of st.games) assert.ok(lacked.includes(t), t);
  assert.deepEqual(E.lackedTypes(WEB, null), []); assert.deepEqual(E.lackedTypes(WEB, { squares: 'x', games: 3 }), [], 'junk is nothing to lack');
});

// Tic-tac-toe to a draw in one square, X and O taking turns there: cells 0 1 2 4 3 5 7 6 8 leave no line (the game calls
// the draw as soon as no line is left, so the square resets before the last cells are played).
const DRAW = [0, 1, 2, 4, 3, 5, 7, 6, 8];
function drawSquare(st, rng, i) {
  const log = (st.sqlog || []).length;
  for (const cell of DRAW) {
    const r = E.playMove(st, i, cell, rng);
    assert.equal(r.ok, true, `cell ${cell}: ${r.reason}`);
    if (st.flash) E.endFlash(st);
    if ((st.sqlog || []).length > log) { assert.equal(st.sqlog[log].end, 'draw'); return; }
  }
  assert.fail('the square never drew');
}
test('a square that resets takes its new mini-game from the match\'s own list, never from outside it (whatever the deal)', () => {
  const games = ['ttt', 'c4', 'hilo', 'snakes'];
  for (let seed = 0; seed < 30; seed++) {
    const rng = E.makeRng('reset' + seed);
    const st = E.newMatch(rng, { games });
    assert.deepEqual(st.games.slice().sort(), games.slice().sort());
    st.squares[0] = { owner: null, mini: E.newMini('ttt', rng) };    // whatever was dealt there: a Tic-tac-toe to play to a draw
    st.turn = 'X';
    drawSquare(st, rng, 0);
    assert.equal(st.squares[0].owner, null, 'a drawn square resets, unclaimed');
    assert.ok(games.includes(st.squares[0].mini.type), `seed ${seed}: the new game ${st.squares[0].mini.type} is from the match's list`);
  }
});
test('a reset never deals a game the match\'s list names but this code does not have (an older match\'s list, or a newer client\'s game)', () => {
  const rng = E.makeRng('reset-unknown');
  const st = E.newMatch(rng, { games: ['ttt', 'c4'] });
  st.games = ['ttt', 'zzz'];                                        // a list with a game this code has no rules for
  st.squares[0] = { owner: null, mini: E.newMini('ttt', rng) };
  st.turn = 'X';
  drawSquare(st, rng, 0);
  assert.equal(st.squares[0].mini.type, 'ttt', 'the only game of the list this code has');
  assert.deepEqual(st.games, ['ttt', 'zzz'], 'the list itself is left as the record has it');
});
