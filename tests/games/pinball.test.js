'use strict';
// Pinball: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Pinball ===================================== */
const PIN = P.PIN;

test('pinball: the move\'s checks — a real ball passes; a faked one (teleport, too fast, a hit far from its target, a hit already lit, a time that does not match) does not', () => {
  const mini = E.newMini('pinball', E.makeRng('chk')), r = P.pinAi(mini.cfg, mini.lit.X, E.makeRng('real')).result;
  const m = { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end };
  assert.equal(E.pinCheck(mini, 'X', m), null, 'a real ball');
  const fr = P.pinUnpack(r.rec);
  const tweak = f => P.pinPack(f(fr.map(x => x.slice())));
  assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { rec: tweak(a => { a[Math.floor(a.length / 2)][0] = 5; a[Math.floor(a.length / 2)][1] = 20; return a; }) })), 'jump', 'a teleport');
  assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { ms: m.ms * 2 })), 'time', 'more time than the recording');
  if (m.hits.length) {
    const [id, t] = m.hits[0];
    assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { hits: [[id, Math.max(0, t - 3)]].concat(m.hits.slice(1)) })), 'hit', 'a hit at the wrong moment');
    const lit = JSON.parse(JSON.stringify(mini)); lit.lit.X[id] = 1;
    assert.equal(E.pinCheck(lit, 'X', m), 'hit', 'a target already lit');
  }
  const far = PIN.targets.find(t => !m.hits.some(h => h[0] === t.id));
  if (far) assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { hits: m.hits.concat([[far.id, 0.1]]) })), 'hit', 'a hit with the ball nowhere near');
  assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { rec: 'zz!' })), 'bad');
});
test('pinball: lit targets stay lit, for that player only; lighting all seven wins the square', () => {
  const st = E.newMatch(lcg(3), { games: ['pinball'] }), i = 4, mini = st.squares[i].mini;
  let balls = 0;
  while (!st.squares[i].owner && balls < 40) {
    const p = st.turn, before = mini.lit[p].slice(), other = mini.lit[E.other(p)].slice();
    const r = P.pinAi(mini.cfg, mini.lit[p], E.makeRng('lit' + balls)).result;
    const out = E.playMove(st, i, { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end }, E.makeRng('x' + balls));
    assert.equal(out.ok, true, out.reason);
    const now = st.squares[i].mini.lit;
    before.forEach((v, k) => { if (v) assert.equal(now[p][k], 1, 'a lit target stays lit'); });
    assert.deepEqual(now[E.other(p)], other, 'the other player\'s targets are untouched');
    E.endFlash(st); balls++;
  }
  assert.ok(st.squares[i].owner, 'someone lit all seven');
  assert.ok(st.squares[i].mini.lit[st.squares[i].owner].every(Boolean));
});
