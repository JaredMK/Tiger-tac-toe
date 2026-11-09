'use strict';
// Practice (How to Play's Practice button: core/match.js startPractice): a Play Computer match of one mini-game alone,
// every square that game, the player's side drawn at random, the computer on Easy; state.practice marks it, no stats
// report is begun for it, and the setup's own choices are left as they were. Any other start clears the mark. The
// templates rules (database.rules.json) name every mini-game the registry has, and no other.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const { startPractice } = require('../../src/core/match.js');
const { SC_ONLY, TYPES } = require('../../src/games/index.js');

test('startPractice: that game alone in every square, the side drawn, the computer on Easy, marked, no stats; the setup kept', () => {
  const rng = E.makeRng('practice'), sides = new Set();
  for (let k = 0; k < 12; k++) {
    const st = E.newMatch(E.makeRng('p' + k), { games: ['ttt'] });
    st.setup.games = Object.fromEntries(TYPES.map(t => [t, ['c4', 'hilo'].includes(t)]));
    st.setup.vsCpu = { pick: 'O', level: 'hard' };
    st.stats = { id: 'old', mode: 'cpu', sent: false };
    const me = startPractice(st, rng, 'hangman', 'Ann');
    assert.ok(me === 'X' || me === 'O'); sides.add(me);
    assert.deepEqual(st.practice, { type: 'hangman' });
    assert.ok(st.squares.every(sq => sq.mini.type === 'hangman'), 'every square that game');
    assert.deepEqual(st.games, ['hangman'], 'resets deal it too');
    assert.equal(st.cpu, E.other(me)); assert.equal(st.cpuLevel, 'easy', 'Easy');
    assert.deepEqual([st.setup.names[me], st.setup.names[E.other(me)]], ['Ann', 'Computer']);
    assert.equal(st.screen, 'board'); assert.equal(st.stats, null, 'no stats report for it');
    assert.deepEqual(TYPES.filter(t => st.setup.games[t]), ['c4', 'hilo'], "the setup's checklist as it was");
    assert.deepEqual(st.setup.vsCpu, { pick: 'O', level: 'hard' }, "Play Computer's side and level as they were");
  }
  assert.deepEqual([...sides].sort(), ['O', 'X'], 'either side, drawn');
});
test('startPractice refuses a game that is not one (or a Super Chaos only game), and startMatch clears the mark', () => {
  const st = E.newMatch(E.makeRng('p'), { games: ['ttt'] });
  assert.equal(startPractice(st, E.makeRng('x'), 'nope', 'Ann'), null); assert.equal(st.practice, null);
  for (const t of SC_ONLY) assert.equal(startPractice(st, E.makeRng('x'), t, 'Ann'), null, t);
  assert.ok(startPractice(st, E.makeRng('x'), 'c4', 'Ann'));
  assert.equal(E.startMatch(st, E.makeRng('y')), true);
  assert.equal(st.practice, null, 'another match: not a practice one');
  assert.equal(E.startCpu(st, E.makeRng('z'), 'Ann') != null, true); assert.equal(st.practice, null);
});
test('the templates rules (database.rules.json) take a games map of exactly the registry\'s mini-games', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')).rules.templates.$uid;
  assert.equal(rules['.read'], 'auth != null && auth.uid === $uid'); assert.equal(rules['.write'], 'auth != null && auth.uid === $uid');
  const v = rules.$id.games.$type['.validate'];
  const listed = [...v.matchAll(/\$type === '(\w+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(listed, TYPES.slice().sort(), 'every mini-game, no other');
  assert.match(rules.$id.name['.validate'], /length <= 24/);
  assert.equal(rules.$id.$other['.validate'], false);
});
