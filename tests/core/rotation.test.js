'use strict';
// The deal (November 2026, testers' reports): nine different games on every board while nine or more can be dealt;
// the games a player was dealt lately last (core/match.js dealNine `recent`, kept by ui/rotation.js), so four boards
// from the 18 of the launch lineup show all of them; and the Game lineup lists only games a board can deal (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { lineup } = require('../../src/core/games.js');

const LAUNCH = ['bullseye', 'bump', 'candy', 'coins', 'wordle', 'ttt', 'c4', 'bs', 'hangman', 'hilo', 'pig', 'rl', 'plinko', 'snakes', 'rps', 'war', 'claw', 'mastermind'];
const releases = Object.fromEntries(E.TYPES.map(t => [t, LAUNCH.includes(t)]));

test('every board: nine different games when nine or more can be dealt, with or without recent games', () => {
  for (let k = 0; k < 200; k++) {
    const rng = E.makeRng('u' + k), recent = k % 2 ? LAUNCH.slice(0, k % 18) : null;
    const b = E.dealNine(LAUNCH, rng, {}, recent).map(q => q.mini.type);
    assert.equal(new Set(b).size, 9, b.join(' '));
    assert.ok(b.every(t => LAUNCH.includes(t)));
  }
  const few = E.dealNine(['ttt', 'c4', 'coins'], E.makeRng('f'), {}).map(q => q.mini.type);
  assert.equal(few.length, 9, 'fewer than nine to deal from: each square any of them, as ever');
});

test('the rotation: the games dealt lately come last, so the 18 come round in two boards and four boards show them all', () => {
  for (let run = 0; run < 50; run++) {
    const rng = E.makeRng('rot' + run), boards = [];
    for (let k = 0; k < 4; k++) {
      const recent = [];
      for (const b of boards.slice().reverse().slice(0, 3)) for (const t of b) if (!recent.includes(t)) recent.push(t);
      boards.push(E.dealNine(LAUNCH, rng, {}, recent).map(q => q.mini.type));
    }
    assert.equal(boards[1].filter(t => boards[0].includes(t)).length, 0, 'the second board: none of the first');
    assert.equal(new Set(boards[0].concat(boards[1])).size, 18, 'two boards: all 18');
    assert.equal(new Set(boards.flat()).size, 18);
  }
});

test('the deal of a whole match: startMatch takes the state\'s recent games (a local match), never online', () => {
  const st = E.newState(E.makeRng('s'));
  for (const t of E.TYPES) st.setup.games[t] = LAUNCH.includes(t);
  st.recent = LAUNCH.slice(0, 9);
  assert.ok(E.startMatch(st, E.makeRng('s2')));
  assert.deepEqual(st.squares.map(q => q.mini.type).sort(), LAUNCH.slice(9).sort());
});

test('the Game lineup lists only games a board can deal here: "In rotation" is the deal\'s own list', () => {
  const L = lineup(releases, 'web', () => true, '2026-11-25');
  assert.deepEqual(L.now.slice().sort(), E.allowedTypes(releases, false).filter(t => !E.SC_ONLY || !E.SC_ONLY.includes(t)).sort());
  assert.equal(L.now.length, 18);
  const ios = Object.assign({}, releases, { platform: { ios: { war: false } } });
  assert.ok(!lineup(ios, 'ios').now.includes('war'), 'off on iOS: not in iOS\'s rotation');
});
