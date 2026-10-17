'use strict';
// What the card games and the wheel (Blackjack, Ride the Bus, Roulette) share, tested once for all of them (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));   // a room's games: just this one
// Play whole turns until the match is over: the computer on both sides.
function cpuMatch(games, seed, guard = 900) {
  const rng = lcg(seed), st = E.newMatch(rng, { games });
  let n = 0;
  while (!st.winner && n++ < guard) {
    const m = E.cpuMove(st, rng);
    const r = E.playMove(st, m.square, m.move, rng);
    assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
    E.endFlash(st);
  }
  return { st, n };
}

/* ===================================== all three ===================================== */
test('the three are dealt, ticked by default, explained and timed like every other game', () => {
  for (const t of ['bj', 'bus', 'rl']) {
    assert.ok(E.TYPES.includes(t)); assert.ok(E.INFO[t] && E.INFO[t].name);
    assert.equal(E.defaultSetup().games[t], true, `${t} ticked by default`);
    assert.ok(E.playMs({ type: t, kind: 'move', bj: { from: 0, cards: ['2S', '3S'], dealer: ['4S'] } }) > 500);
  }
});

test('computer against computer: matches of only the three finish, each game on its own and all together', () => {
  for (const games of [['bj'], ['bus'], ['rl'], ['bj', 'bus', 'rl']]) {
    for (let seed = 1; seed <= 6; seed++) {
      const { st, n } = cpuMatch(games, seed * 31 + games.length);
      assert.ok(st.winner, `${games} match ${seed} finishes (${n} moves)`);
    }
  }
});

test('online: the three play through the match record, and a timeout plays out a hand in one go', () => {
  for (const t of ['bj', 'bus', 'rl']) {
    let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only(t), timer: 60 }, lcg(11), 'm' + t);
    assert.ok(rec.state.squares.every(s => s.mini.type === t));
    for (let k = 0; k < 40 && !rec.state.winner; k++) {
      const full = E.fullState(rec), mv = E.cpuMove(full, lcg(k + 1));
      const r = E.applyOnlineMove(rec, full.turn, mv.square, mv.move, lcg(k + 50));
      assert.equal(r.ok, true, `${t}: ${JSON.stringify(mv.move)} (${r.reason})`);
      rec = r.rec;
    }
    const to = E.applyOnlineTimeout(rec, lcg(77));
    assert.equal(to.ok, true);
    if (!to.lost) assert.equal(E.fullState(to.rec).lock, null, `${t}: after a timeout the turn has passed`);
  }
});
