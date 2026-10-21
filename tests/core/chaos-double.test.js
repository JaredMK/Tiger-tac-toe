'use strict';
// Super Chaos: both players win the same square in the same round, in every Super Chaos game: the square
// resets (no claim), the recap still has the move to replay as it was made (in the game it was made in, not
// the square's new one), and play goes on: the next round takes a move in the new game (npm test).
// The rounds come from tests/core/sc-double.js; the seeds found are kept in sc-double.json (a game whose
// play has changed since is searched again: `node tests/core/sc-double.js` refreshes the file).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const E = require('../engine.js');
const PHYS = require('../physics.js');
E.setPhysics(PHYS);
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
const H = require('./sc-double.js');

const CACHE = path.join(__dirname, 'sc-double.json');
const kept = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
// The round before the double win, and its seeds: as kept, else searched for again.
function doubleRound(type) {
  const k = kept[type];
  if (k) {
    const st = H.rebuild(k), c = JSON.parse(JSON.stringify(st));
    if (H.bothWon(H.playRound(c, k.last, k.last.r).rc)) return { st, found: k };
  }
  const found = H.findDouble(type);
  assert.ok(found, `${type}: a round where both win the square`);
  return { st: H.rebuild(found), found, searched: true };
}

for (const type of E.scTypes()) {
  test(`Super Chaos ${type}: both win the same square in the same round: it resets, the recap replays the move, play goes on`, () => {
    const { st, found } = doubleRound(type);
    const sq = H.SQ, before = st.squares[sq].mini.type, logs = st.sqlog.length;
    assert.equal(before, type);
    const { rc } = H.playRound(st, found.last, found.last.r);
    // the square resets: no claim, a new Super Chaos game, fresh, counted as a draw
    assert.ok(H.bothWon(rc), 'both won it');
    assert.equal(st.squares[sq].owner, null, 'not claimed');
    assert.ok(!rc.claims.some(c => c.square === sq), 'no claim');
    assert.ok(E.scTypes().includes(st.squares[sq].mini.type), 'a new Super Chaos game');
    assert.deepEqual(st.squares[sq].mv, { X: 0, O: 0 });
    assert.deepEqual(st.sqlog.slice(logs).map(e => [e.t, e.end]), [[type, 'draw']]);
    assert.equal(st.winner, null);
    // the replay: the computer's move as it was made, in the game it was made in (the square holds a new game now)
    const replayed = (rc.cpu && rc.cpu.square === sq && rc.cpu.steps && rc.cpu.steps.length) || (rc.replay && rc.replay.square === sq) || (rc.resolve || []).some(x => x.square === sq);
    assert.ok(replayed, 'the recap has the computer\'s move in the square');
    if (rc.cpu && rc.cpu.square === sq) {
      assert.equal(rc.cpu.type, type, 'the replay is of the game the move was made in');
      assert.ok(rc.cpu.start && rc.cpu.start.type === type, 'it starts from the square as the computer found it');
      for (const step of rc.cpu.steps) assert.equal(step.after.type, type);
      const sunkTogether = type === 'bs' && rc.view[sq].ship.every(k => rc.view[sq].hits.includes(k));   // (Battleship: the two moves' hits together can sink it)
      assert.equal(rc.cpu.steps[rc.cpu.steps.length - 1].kind === 'claim' || rc.cpu.steps[rc.cpu.steps.length - 1].kind === 'match' || !!rc.resolve.length || !!rc.replay || sunkTogether, true, 'its last step is the winning one (or the round\'s end settles it)');
    }
    assert.ok(rc.view && rc.view[sq] && rc.view[sq].type === type, 'the board shows the square as it was until its result');
    // play goes on: the next round, a move in the new game and the computer's
    E.chaosNext(st, E.makeRng('after'));
    assert.ok(st.sc.cpu, 'the computer moves');
    assert.equal(st.sc.recap, null);
    const moves = H.humanMove(st, 'after:x');
    assert.ok(moves.length && st.sc.me, 'a move in the reset square');
    assert.equal(st.sc.me.square, sq);
    const rc2 = E.chaosResolve(st, E.makeRng('after:r'));
    assert.ok(rc2 && rc2.round === rc.round + 1, 'the next round resolves');
  });
}
// The seeds kept for the double wins (run with `node tests/core/sc-double.js` to refresh them).
test('Super Chaos double wins: a seed kept for every Super Chaos game, and each still plays out as a double win', () => {
  const missing = E.scTypes().filter(t => !kept[t]);
  assert.deepEqual(missing, [], 'run `node tests/core/sc-double.js` to find and keep them');
  const stale = E.scTypes().filter(t => { const st = H.rebuild(kept[t]); return !H.bothWon(H.playRound(st, kept[t].last, kept[t].last.r).rc); });
  assert.deepEqual(stale, [], 'a game\'s play has changed: run `node tests/core/sc-double.js ' + stale.join(' ') + '` to keep new seeds');
});
