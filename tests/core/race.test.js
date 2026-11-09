// Race mode (core/race.js, `rv: 2`): every race game deals each player a target of their own, kept out of the public
// state and the computer's view like a Shared square's target (the game's secret/hide), everything else open; two
// people on one phone always play Shared; a race square from before the rework is dealt again as it is met.
// Each game's own race rules are held in tests/games/<game>.test.js and tests/ui/<game>-race.test.mjs.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

// A question bank in bands (Trivia is dealt only with one loaded).
test.before(() => E.setTriviaBank({ questions: ['easy', 'medium'].flatMap(d => ['Science', 'History', 'Sports'].flatMap(c => Array.from({ length: 12 }, (_, i) => ({ id: `${d[0]}${c[0]}${i}`, diff: d, cat: c, q: `${c} ${d} question ${i}?`, a: `Right ${d}${c}${i}`, wrong: ['Wa' + i, 'Wb' + i, 'Wc' + i] })))) }));

const lcg = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const raceOn = (t, on) => E.setTune(t, on ? { mode: 'race' } : null);
// Every string of 3+ characters in a value (a word, a question's answer), for the leak checks.
const strings = (v, out = []) => { if (typeof v === 'string') { if (v.length >= 3) out.push(v); } else if (v && typeof v === 'object') for (const k of Object.keys(v)) strings(v[k], out); return out; };

for (const t of E.RACE_TYPES) {
  test(`race (${t}): dealt by the setting as rv 2 with a part each; the targets never in the public state or the computer's view`, () => {
    raceOn(t, true);
    try {
      const m = E.newMini(t, lcg(7));
      assert.equal(m.race, true); assert.equal(m.rv, E.RACE_V);
      assert.ok(m.side && m.side.X && m.side.O, 'a part for each player');
      const sec = E.secretOf(m);
      assert.ok(sec && Object.keys(sec).length, 'the targets are the game\'s secret');
      const st = E.newMatch(lcg(5), { games: Array(9).fill(t), vs: 'cpu' });
      assert.ok(st.squares.every(q => q.mini.race && q.mini.rv === E.RACE_V), 'against the computer: Race');
      const rec = E.matchRecord(st);
      rec.state.squares.forEach((q, i) => {
        const s = E.secretOf(st.squares[i].mini) || {};
        for (const k of Object.keys(s)) assert.equal(q.mini[k], undefined, `${t}: the public square carries no ${k}`);
        const pub = JSON.stringify(q.mini);
        for (const w of strings(s)) assert.ok(!pub.includes(JSON.stringify(w)), `${t}: "${w}" not in the public square`);
        for (const p of ['X', 'O']) {
          const pm = E.publicMini(st.squares[i].mini, p);
          for (const k of Object.keys(s)) assert.equal(pm[k], undefined, `${t}: the computer's view carries no ${k}`);
          const pj = JSON.stringify(pm);
          for (const w of strings(s)) assert.ok(!pj.includes(JSON.stringify(w)), `${t}: "${w}" not in ${p}'s view`);
          assert.ok(pm.side && pm.side.X && pm.side.O, 'both parts open to both');
        }
      });
      assert.deepEqual(Object.keys(rec.sides.X), [], 'nothing kept apart per side any more');
      const back = E.fullState(rec);
      back.squares.forEach((q, i) => assert.deepEqual(E.secretOf(q.mini), E.secretOf(st.squares[i].mini), 'the record gives the targets back'));
      const same = E.newMatch(lcg(5), { games: Array(9).fill(t), vs: 'same' });
      assert.ok(same.squares.every(q => !q.mini.race), 'Same phone: every square Shared');
    } finally { raceOn(t, false); }
    assert.equal(E.newMini(t, lcg(3)).race, undefined, 'off: Shared as ever');
  });
}

test('race: a square from before the rework (no rv) is dealt again as the record is read; a claimed one is kept', () => {
  raceOn('hilo', true);
  try {
    const st = E.newMatch(lcg(5), { games: Array(9).fill('hilo'), vs: 'cpu' });
    const rec = E.matchRecord(st);
    rec.state.squares[0].mini = { type: 'hilo', race: true, shape: { X: {}, O: {} }, top: 30, limit: 5 };
    rec.state.squares[1].mini = { type: 'hilo', race: true, shape: { X: {}, O: {} }, top: 30, limit: 5 }; rec.state.squares[1].owner = 'X';
    const a = E.fullState(rec), b = E.fullState(rec);
    assert.equal(a.squares[0].mini.rv, E.RACE_V, 'dealt again as now');
    assert.deepEqual(a.squares[0].mini, b.squares[0].mini, 'deterministically (the server and a phone agree)');
    assert.equal(a.squares[1].mini.rv, undefined, 'a claimed square stays as it was');
  } finally { raceOn('hilo', false); }
});

test('race: the old privacy paths leave a reworked square alone', () => {
  raceOn('hilo', true);
  try {
    const m = E.newMini('hilo', lcg(7));
    const f = { kind: 'move', by: 'X', type: 'hilo', square: 0, n: 12, res: 'higher' };
    assert.equal(E.raceFlashHide(f, m), f, 'a move\'s flash is open');
    assert.equal(E.raceView(m, 'X'), m);
    assert.equal(E.raceSides(m), null);
  } finally { raceOn('hilo', false); }
});
