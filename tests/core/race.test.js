// Race mode (core/race.js), with Higher/Lower as the reference game: the same target for both, each side's guesses and
// range their own (`mini.side[p]`), the other side's progress a shape alone; online the record keeps each side's part
// apart (sides), the public state carries the shapes, and a move's entry is redacted for the other phone; two people on
// one phone always play Shared; the computer reads only its own part.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const raceOn = on => E.setTune('hilo', on ? { mode: 'race' } : null);
const clone = v => JSON.parse(JSON.stringify(v));
function match(rng) { return E.newMatch(rng, { games: ['hilo', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'] }); }
const hiloAt = st => st.squares.findIndex(q => q.mini.type === 'hilo');

test('race: dealt by the admin setting; each side its own range and guesses, the same target; two people on one phone play Shared', () => {
  raceOn(true);
  try {
    const m = E.newMini('hilo', lcg(3));
    assert.equal(m.race, true); assert.equal(m.lo, undefined); assert.deepEqual(m.side.X, { lo: 1, hi: 30, guesses: [] }); assert.deepEqual(m.side.O, { lo: 1, hi: 30, guesses: [] });
    assert.deepEqual(m.tune, { mode: 'race' }, 'the square keeps the mode it was dealt with');
    const t = m.target;
    assert.deepEqual(E.applyMove(m, 'X', t > 15 ? 5 : 25, lcg(1)), { ok: true, outcome: 'continue', note: t > 15 ? 'higher' : 'lower' });
    assert.equal(m.side.X.guesses.length, 1); assert.equal(m.side.O.guesses.length, 0, "O's range is untouched");
    assert.deepEqual([m.side.O.lo, m.side.O.hi], [1, 30]);
    assert.ok(t > 15 ? m.side.X.lo === 6 : m.side.X.hi === 24, "X's own range narrowed");
    assert.deepEqual(E.applyMove(m, 'O', t, lcg(1)), { ok: true, outcome: 'win' }, 'the same number wins for O');
    assert.equal(E.hiloUsed(m, 'X'), 1); assert.equal(E.hiloLeft(m, 'O'), 4);
    const shared = E.newMini('hilo', lcg(3), { shared: true });
    assert.equal(shared.race, undefined); assert.equal(shared.lo, 1);
    const same = E.newMatch(lcg(5), { games: ['hilo'], vs: 'same' });
    assert.ok(same.squares.every(q => !q.mini.race), 'Same phone: every square Shared');
    const cpu = E.newMatch(lcg(5), { games: ['hilo'], vs: 'cpu' });
    assert.ok(cpu.squares.every(q => q.mini.race), 'against the computer: Race');
  } finally { raceOn(false); }
  assert.equal(E.newMini('hilo', lcg(3)).race, undefined, 'off: as ever');
});

test('race: the public view shows the shapes and one side\'s own part alone; the record keeps each side\'s part for that side', () => {
  raceOn(true);
  try {
    const m = E.newMini('hilo', lcg(7)), t = m.target;
    E.applyMove(m, 'X', t === 1 ? 2 : 1, lcg(1)); E.applyMove(m, 'X', t === 30 ? 29 : 30, lcg(1));
    const pub = E.publicMini(m);
    assert.equal(pub.target, undefined); assert.deepEqual(pub.side, {}); assert.equal(pub.shape.X.n, 2); assert.equal(pub.shape.O.n, 0);
    assert.ok(['cold', 'warm', 'hot'].includes(pub.shape.X.heat)); assert.equal(pub.shape.O.heat, null);
    const forO = E.publicMini(m, 'O');
    assert.deepEqual(Object.keys(forO.side), ['O'], "O's own part alone"); assert.equal(forO.shape.X.n, 2);
    const forX = E.publicMini(m, 'X');
    assert.equal(forX.side.X.guesses.length, 2); assert.equal(forX.side.O, undefined);
    // the record
    const st = match(lcg(11)); const k = hiloAt(st);
    st.squares[k].mini = m; st.id = 'r1'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st);
    const ps = rec.state.squares[k].mini;
    assert.equal(ps.side, undefined, 'no side in the public state'); assert.equal(ps.target, undefined);
    assert.deepEqual(ps.shape.O, { n: 0, left: 5, heat: null }); assert.equal(ps.shape.X.n, 2);
    assert.equal(rec.sides.X[k].guesses.length, 2); assert.deepEqual(rec.sides.O[k], { lo: 1, hi: 30, guesses: [] });
    assert.equal(JSON.stringify(rec.state).includes('"target"'), false);
    const full = E.fullState(rec);
    assert.deepEqual(full.squares[k].mini.side, m.side); assert.equal(full.squares[k].mini.target, t); assert.equal(full.squares[k].mini.shape, undefined);
    const packed = E.packMatch(rec), back = E.parseMatch(packed);
    assert.deepEqual(back.sides.X, rec.sides.X); assert.deepEqual(E.fullState(back).squares[k].mini.side, m.side);
    const oneSide = E.fullState({ state: rec.state, secrets: rec.secrets, sides: { O: rec.sides.O } });   // a phone: its own side alone
    assert.equal(oneSide.squares[k].mini.side.X, undefined); assert.deepEqual(oneSide.squares[k].mini.side.O, m.side.O);
  } finally { raceOn(false); }
});

test('race: an online move\'s entry is redacted for the other phone (no number, no higher/lower, no inputs), its shape change alone; the mover\'s own part reaches their side', () => {
  raceOn(true);
  try {
    const st = match(lcg(21)); const k = hiloAt(st); st.id = 'r2'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), t = rec.secrets[k].target, guess = t === 15 ? 16 : 15;
    const r = E.applyOnlineMove(rec, 'X', k, guess, lcg(2), { rep: [[0, 'move', 'm=' + guess]] });
    assert.ok(r.ok);
    const e = r.entries[0];
    assert.equal(e.m, undefined, 'the number is not on the entry'); assert.equal(e.n, undefined); assert.equal(e.res, undefined); assert.equal(e.note, undefined); assert.equal(e.rep, undefined, 'the inputs are not on the entry'); assert.equal(e.range, undefined);
    assert.deepEqual(Object.keys(e.race).sort(), ['by', 'heat', 'left', 'n']); assert.equal(e.race.n, 1); assert.equal(e.race.left, 4);
    assert.equal(e.after.mini.side, undefined); assert.equal(e.after.mini.shape.X.n, 1);
    assert.ok(!JSON.stringify(r.rec.state).includes(`"n":${guess}`), 'the number is nowhere in the public state');
    assert.equal(r.rec.sides.X[k].guesses[0].n, guess, "the mover's own part holds it"); assert.deepEqual(r.rec.sides.O[k].guesses, []);
    // the other side moves on its own copy: its range starts whole
    const r2 = E.applyOnlineMove(r.rec, 'O', k, guess, lcg(3));
    assert.ok(r2.ok, 'the same number is open to O (their range was not narrowed)');
    assert.equal(r2.rec.sides.O[k].guesses.length, 1);
    // a shared square's entry is as ever
    raceOn(false);
    const st2 = match(lcg(21)); const k2 = hiloAt(st2); st2.id = 'r3'; st2.seq = 0; st2.recent = [];
    const rec2 = E.matchRecord(st2), e2 = E.applyOnlineMove(rec2, 'X', k2, 15, lcg(2), { rep: [[0, 'move', 'm=15']] }).entries[0];
    assert.equal(e2.m, 15); assert.ok(e2.rep); assert.equal(e2.race, undefined);
  } finally { raceOn(false); }
});

test('race: the computer plays from its own part alone and still finds the number; the flash as the other side sees it; the square counts as a race in the stats', () => {
  raceOn(true);
  try {
    const st = E.newMatch(lcg(31), { games: ['hilo'], vs: 'cpu' });
    const k = 0, m = st.squares[k].mini, rng = lcg(4);
    let found = false;
    for (let i = 0; i < 5 && !found; i++) {
      const pm = E.publicMini(m, 'O');
      assert.equal(pm.side.X, undefined, "the computer never sees X's part");
      const mv = E.aiOf('hilo').best(pm, 'O', rng, 'steady', { level: 'hard' }).move;
      const r = E.applyMove(m, 'O', mv, rng);
      found = r.outcome === 'win';
    }
    assert.ok(found, 'halving finds it within 5');
    const f = { kind: 'move', by: 'O', next: 'X', square: k, type: 'hilo', note: 'higher', n: 12, res: 'higher', range: [1, 30], m: 12, rep: [[0, 'move', 'm=12']] };
    const h = E.raceFlashHide(f, m);
    assert.deepEqual(Object.keys(h).sort(), ['by', 'kind', 'next', 'race', 'square', 'type']);
    assert.equal(h.race.heat, 'hit');
    const st2 = match(lcg(41)); const k2 = hiloAt(st2);
    const r = E.playMove(st2, k2, st2.squares[k2].mini.target, lcg(1));
    assert.ok(r.ok); assert.equal(st2.sqlog[0].race, 1); assert.equal(E.matchStats(st2).squares[0].race, 1);
  } finally { raceOn(false); }
});
