'use strict';
// Door Drop (December 2026): its rules, settings and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/doors/rules.js');
const M = require('../../src/games/doors/meta.js');

const wrong = (m, r) => (m.good[r] + 1) % m.d[r];

test('doors: Admin only, luck, 1.32.0; the deal: floors of doors, one way down each, hidden; plain JSON', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder], ['admin', 'luck', '1.32.0', false]);
  assert.deepEqual(E.tuneFields('doors').map(f => f.k), ['floors', 'dmin', 'dmax', 'towers', 'again']);
  assert.deepEqual(E.tuneFields('doors').map(f => f.group), ['Board', 'Board', 'Board', 'Rules', 'Rules']);
  for (const set of [null, { floors: 8, dmin: 2, dmax: 6 }, { towers: 'shared' }, { floors: 1, dmin: 6, dmax: 2 }]) {
    E.setTune('doors', set);
    try {
      for (let g = 0; g < 40; g++) {
        const m = E.newMini('doors', E.makeRng('d' + g));
        assert.equal(m.d.length, m.f); m.d.forEach((k, r) => { assert.ok(k >= 2 && k <= 6); assert.ok(m.good[r] >= 0 && m.good[r] < k); });
        assert.equal(m.sep, !set || set.towers !== 'shared');
        assert.deepEqual(JSON.parse(JSON.stringify(m)), m);
        const pub = E.publicMini(m); assert.ok(!('good' in pub), 'never public'); assert.ok(!JSON.stringify(pub).includes('good'));
        assert.deepEqual(R.secret(m), { good: m.good }); const c = JSON.parse(JSON.stringify(m)); R.hide(c); assert.ok(!('good' in c));
      }
    } finally { E.setTune('doors', null); }
  }
  const d = E.newMini('doors', E.makeRng('def')); assert.deepEqual([d.f, d.d.join(','), d.sep], [3, '4,4,4', true], 'the defaults: 3 floors of 4 doors, a tower each');
});

test('doors: a dead end is marked, pops the runner out of another door and ends the turn; it cannot be tried again', () => {
  const m = E.newMini('doors', E.makeRng('a')), w = wrong(m, 0);
  for (let k = 0; k < 20; k++) {
    const t = JSON.parse(JSON.stringify(m)), r = E.applyMove(t, 'X', w, E.makeRng('x' + k));
    assert.deepEqual([r.ok, r.outcome, r.note, !!r.again, t.at.X, t.tried.X[0][w], t.tried.O[0][w]], [true, 'continue', 'dead', false, 0, 1, 0]);
    assert.notEqual(t.last.out, w, 'out of another door'); assert.ok(t.last.out >= 0 && t.last.out < t.d[0]);
    assert.equal(t.pos.X, R.doorX(t.d[0], t.last.out)); assert.equal(t.last.from, 50);
    assert.equal(E.applyMove(t, 'X', w, E.makeRng('y')).reason, 'tried');
    assert.ok(!R.doorsMoves(t, 'X').includes(w)); assert.ok(R.doorsMoves(t, 'O').includes(w), 'a tower each: the other\'s own marks');
  }
  assert.equal(E.applyMove(m, 'X', 9, E.makeRng('x')).ok, false);
  const hidden = JSON.parse(JSON.stringify(m)); R.hide(hidden);
  assert.equal(E.applyMove(hidden, 'X', 0, E.makeRng('x')).reason, 'secret', 'a phone without the layout cannot judge a door');
});

test('doors: the way down drops a floor and ends the turn (Go again on success: keeps it); the last floor wins', () => {
  for (const again of ['off', 'on']) {
    E.setTune('doors', { again });
    try {
      const m = E.newMini('doors', E.makeRng('b')); let r;
      for (let k = 0; k < m.f; k++) {
        r = E.applyMove(m, 'O', m.good[k], E.makeRng('x'));
        assert.equal(m.at.O, k + 1); assert.equal(m.tried.O[k][m.good[k]], 2); assert.equal(m.pos.O, R.doorX(m.d[k], m.good[k]));
        if (k < m.f - 1) { assert.equal(r.note, 'down'); assert.equal(!!r.again, again === 'on'); }
      }
      assert.deepEqual([r.outcome, r.note], ['win', 'ground']);
    } finally { E.setTune('doors', null); }
  }
  for (let g = 0; g < 40; g++) {                                 // any play ends: one side picking at random alone
    const rng = E.makeRng('solo' + g), t = E.newMini('doors', rng); let won = false;
    for (let k = 0; k < 100 && !won; k++) won = E.applyMove(t, 'X', E.randomLegalMove(t, 'X', rng), rng).outcome === 'win';
    assert.ok(won);
  }
});

test('doors: identical towers in the race; a shared tower marks every door for both', () => {
  const m = E.newMini('doors', E.makeRng('s'));
  assert.ok(Array.isArray(m.good) && m.good.length === m.f, 'one layout: the same way down in both towers');
  E.setTune('doors', { towers: 'shared' });
  try {
    const t = E.newMini('doors', E.makeRng('s')), w = wrong(t, 0);
    E.applyMove(t, 'X', w, E.makeRng('x'));
    assert.equal(t.tried[0][w], 1); assert.equal(E.applyMove(t, 'O', w, E.makeRng('x')).reason, 'tried', 'marked for both');
    E.applyMove(t, 'O', t.good[0], E.makeRng('x')); assert.deepEqual(R.doorsKnown(t, 'X', 0)[t.good[0]], 2);
  } finally { E.setTune('doors', null); }
});

test('doors: the computer takes a known way down, never a dead end; Normal and Hard read the other tower, Easy its own', () => {
  const m = E.newMini('doors', E.makeRng('c')), g = m.good[0], w = wrong(m, 0);
  m.tried.O[0][g] = 2;                                          // O found the way down on its tower
  for (const level of ['normal', 'hard']) for (let k = 0; k < 10; k++) assert.equal(E.localBest(E.publicMini(m), 'X', E.makeRng(level + k), {}, { level }).move, g);
  let other = 0; for (let k = 0; k < 40; k++) if (E.localBest(E.publicMini(m), 'X', E.makeRng('e' + k), {}, { level: 'easy' }).move !== g) other++;
  assert.ok(other > 0, 'Easy does not look across');
  m.tried.O[0][g] = 0; m.tried.X[0][w] = 1;
  for (const level of ['easy', 'normal', 'hard']) for (let k = 0; k < 20; k++) assert.notEqual(E.localBest(E.publicMini(m), 'X', E.makeRng(level + k), {}, { level }).move, w);
  assert.equal(R.timeoutClose(m, 'X'), null);
});

test('doors: in a match: the flash, a timeout mid-turn plays nothing, the square\'s log entry carries its type', () => {
  E.setTune('doors', { again: 'on', floors: 2 });
  try {
    const st = E.newMatch(E.makeRng('i'), { games: ['doors'] }), p = st.turn, q = st.squares[4].mini;
    assert.ok(E.playMove(st, 4, q.good[0], E.makeRng('e')).ok);
    assert.deepEqual(st.flash.dd, { r: 0, i: q.good[0], down: true, out: -1, from: 50 }); E.endFlash(st);
    assert.equal(st.lock, 4, 'Go again on: held to the square');
    st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
    assert.ok(t.ok); assert.notEqual(st.turn, p); assert.equal(q.at[p], 1, 'the floor reached is kept');
    st.turn = p; st.lock = null;
    const w = E.playMove(st, 4, q.good[1], E.makeRng('z'));
    assert.ok(w.ok); assert.equal(st.flash.kind, 'claim');
    const e = st.sqlog[st.sqlog.length - 1]; assert.deepEqual([e.t, e.end, e.w], ['doors', 'won', p], 'the square\'s log carries its type');
    assert.equal(E.matchStats(st).squares[0].t, 'doors');
  } finally { E.setTune('doors', null); }
});

test('doors: online: the record keeps the ways down off the public state, every entry and the move\'s flash; a move goes through the server\'s rules', () => {
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === 'doors']));
  let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, E.makeRng('on'), 'dd');
  const pub = () => JSON.stringify(rec.state);
  assert.ok(!pub().includes('"good"'), 'never public'); assert.ok(rec.secrets && JSON.stringify(rec.secrets).includes('good'));
  for (let k = 0; k < 8; k++) {
    const p = rec.state.turn, sq = rec.state.squares.findIndex(s => !s.owner), mini = E.fullState(rec).squares[sq].mini;
    const mv = E.applyOnlineMove(rec, p, sq, R.doorsMoves(mini, p)[0], E.makeRng('m' + k));
    assert.ok(mv.ok, JSON.stringify(mv)); rec = mv.rec;
    assert.ok(!JSON.stringify(mv.entries).includes('good') && !pub().includes('"good"'), 'nor in an entry or the record\'s state');
    assert.ok(mv.entries[0].dd && typeof mv.entries[0].dd.down === 'boolean');
  }
  assert.equal(E.applyOnlineMove(rec, rec.state.turn, 0, 'auto', E.makeRng('a')).ok, false, 'no automatic move from a phone');
});
