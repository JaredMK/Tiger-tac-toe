'use strict';
// Treasure Hunt: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

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

// ================================ Treasure hunt ================================
test('hunt: a 6x6 grid; the treasure comes from the rng; distances are steps up, down, left and right', () => {
  assert.equal(L.newMini('hunt', lcg(1)).dug.length, 36);
  for (let k = 0; k < 36; k++) assert.equal(L.newMini('hunt', seq(pick(k, 36))).treasure, k);
  assert.equal(L.huntDist(14, 14), 0);
  assert.equal(L.huntDist(14, 15), 1);
  assert.equal(L.huntDist(14, 8), 1);
  assert.equal(L.huntDist(14, 0), 4);
  assert.equal(L.huntDist(0, 35), 10);
  assert.equal(L.huntDist(5, 30), 10);
  for (let a = 0; a < 36; a++) for (let b = 0; b < 36; b++) {
    assert.equal(L.huntDist(a, b), L.huntDist(b, a));
    assert.ok(L.huntDist(a, b) >= 0 && L.huntDist(a, b) <= 10);
  }
  assert.equal(L.huntDist(12, 24, 5), 4, 'an older 5x5 square measures on its own grid');
});

test('hunt: a dug cell shows only its band: Hot 1 step, Warm 2-3, Cool 4-5, Cold 6 or more', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 10].map(L.huntBand), [0, 1, 2, 2, 3, 3, 4, 4, 4]);
  assert.deepEqual(L.HUNT.bands, [null, 'hot', 'warm', 'cool', 'cold']);
  const m = L.newMini('hunt', seq(pick(14, 36)));              // the treasure at row 2, column 2
  for (const [cell, band] of [[15, 1], [8, 1], [16, 2], [21, 2], [0, 3], [5, 3], [30, 3], [35, 4]]) assert.equal(L.huntClue(m, cell), band, `cell ${cell}`);
  L.applyMove(m, 'X', 35); L.applyMove(m, 'O', 15);
  const pm = L.publicMini(m);
  assert.deepEqual(pm.clues.filter(c => c != null), [1, 4], 'the public view holds bands, never distances');
  const rec = (() => { const st = matchWith(['hunt']); st.squares[0].mini = m; st.id = 'h'; st.seq = 0; st.recent = []; return L.matchRecord(st); })();
  assert.equal(rec.state.squares[0].mini.clues[35], 4, 'online too: Cold, not 7 steps');
  assert.ok(!('treasure' in rec.state.squares[0].mini));
  const old = Object.assign(L.newMini('hunt', lcg(2)), { treasure: 12, dug: new Array(25).fill(null) });   // an older 5x5 square
  assert.equal(L.huntSize(old), 5); assert.equal(L.huntClue(old, 24), 3, 'measured on its own 5x5 grid: 4 steps, Cool');
});

test('hunt: a dig marks the cell for both players, a treasure dig wins, dug cells cannot be dug again', () => {
  const m = L.newMini('hunt', seq(pick(12, 36)));
  assert.deepEqual(L.applyMove(m, 'X', 0), { ok: true, outcome: 'continue', note: 'dig' });
  assert.equal(m.dug[0], 'X');
  assert.equal(L.applyMove(m, 'O', 0).ok, false);
  assert.equal(L.applyMove(m, 'O', 36).ok, false);
  assert.equal(L.applyMove(m, 'O', 7).outcome, 'continue');
  const r = L.applyMove(m, 'O', 12);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(r.cells, [12]);
  assert.equal(m.dug[12], 'O');
});

test('hunt: digging every other cell never ends the game, the treasure always does (lopsided)', () => {
  for (const t of [0, 7, 14, 35]) {
    const st = matchWith(['hunt']);
    st.squares[0].mini = L.newMini('hunt', seq(pick(t, 36)));
    for (let i = 0; i < 36; i++) {
      if (i === t) continue;
      st.turn = 'X';
      const f = turn(st, 0, i);
      assert.equal(f.kind, 'move');
      assert.equal(f.band, L.huntBand(L.huntDist(t, i)));
      assert.ok(f.band >= 1 && f.band <= 4);
      assert.ok(!('dist' in f), 'no distance on the move either');
    }
    st.turn = 'X';
    const f = turn(st, 0, t);
    assert.equal(f.kind, 'claim');
    assert.equal(f.band, 0);
    assert.equal(st.squares[0].owner, 'X');
  }
});

test('treasure hunt tactics: only cells consistent with every clue, the best splitter first', () => {
  const m = L.newMini('hunt', seq(pick(14, 36)));          // treasure at row 3, column 3 of 6
  L.applyMove(m, 'O', 0);                                  // 4 steps: Cool
  const pm = L.publicMini(m);
  const cand = L.huntCandidates(pm);
  assert.ok(cand.every(c => L.huntBand(L.huntDist(c, 0)) === 3 && c !== 0), 'only cells 4 or 5 steps from the dig');
  assert.ok(cand.includes(14));
  for (let k = 0; k < 20; k++) {
    const st = cpuMatch('X', [m, 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], [null, 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O']);   // the only open square: the dig itself is under test
    const mv = L.cpuMove(st, lcg(k));
    assert.equal(mv.square, 0);
    assert.ok(cand.includes(mv.move), `dig ${mv.move} fits the clue`);
  }
  L.applyMove(m, 'O', 5);                                  // row 1 column 6: 5 steps, Cool as well
  const cand2 = L.huntCandidates(L.publicMini(m));
  assert.ok(cand2.length < cand.length);
  assert.ok(cand2.every(c => L.huntBand(L.huntDist(c, 0)) === 3 && L.huntBand(L.huntDist(c, 5)) === 3));
  // four Hot digs around it leave one cell: dig it and win
  const one = L.newMini('hunt', seq(pick(14, 36)));
  for (const d of [8, 13, 15, 20]) L.applyMove(one, 'O', d);
  const c1 = L.huntCandidates(L.publicMini(one));
  assert.deepEqual(c1, [14]);
  const st = cpuMatch('X', [one, 'ttt']);
  const mv = L.cpuMove(st, cpuRng());
  assert.equal(mv.move, 14);
  assert.equal(L.playMove(st, 0, mv.move).flash.kind, 'claim');
  // left to itself, the computer digs only cells that fit every clue, and finds the treasure
  let total = 0;
  for (let g = 0; g < 60; g++) {
    const h = L.newMini('hunt', L.makeRng('hunt' + g));
    let n = 0;
    for (; n < 36; n++) {
      const c = L.huntCandidates(L.publicMini(h));
      const b = L.localBest(L.publicMini(h), 'X', lcg(g));
      assert.ok(c.includes(b.move), 'a dig consistent with every band');
      if (L.applyMove(h, 'X', b.move).outcome === 'win') break;
    }
    assert.ok(n < 36); total += n + 1;
  }
  assert.ok(total / 60 < 8, `found in ${(total / 60).toFixed(1)} digs on average`);
});

test('hunt: the admin settings deal an 8x8 grid; the clues and the computer work on it', () => {
  E.setTune('hunt', { n: 8, miss: 30 });
  try {
    const m = L.newMini('hunt', lcg(9));
    assert.equal(m.dug.length, 64); assert.equal(L.huntSize(m), 8); assert.deepEqual(m.tune, { n: 8, miss: 30 });
    let out, k = 0;
    do { out = L.applyMove(m, k % 2 ? 'O' : 'X', L.localBest(L.publicMini(m), 'X', lcg(k)).move); assert.ok(out.ok); k++; } while (out.outcome !== 'win' && k < 64);
    assert.equal(out.outcome, 'win');
  } finally { E.setTune('hunt', null); }
  assert.equal(L.newMini('hunt', lcg(9)).dug.length, 36);
});

// ================================ The Hard computer ================================
const HARD = { level: 'hard', until: null };
function raceOf(type, n) {
  const lcg2 = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const out = { hard: 0, normal: 0, ms: 0 };
  for (let k = 0; k < n; k++) {
    const rng = lcg2(500 + k), m = E.newMini(type, rng), hardSide = k % 2 ? 'O' : 'X';
    let p = 'X';
    for (let t = 0; t < 60; t++) {
      const pm = E.publicMini(m), hard = p === hardSide, t0 = performance.now();
      const b = E.localBest(pm, p, rng, {}, hard ? HARD : {});
      if (hard) out.ms = Math.max(out.ms, performance.now() - t0);
      const r = E.applyMove(m, p, b.move, rng);
      assert.equal(r.ok, true, `${type}: a legal move (${JSON.stringify(b.move)})`);
      if (r.outcome === 'win') { out[hard ? 'hard' : 'normal']++; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  return out;
}
test('hunt, Hard: the race for the treasure: a dig that fits the clues, the last cell dug, at least Normal\'s squares, quickly', () => {
  const m = L.newMini('hunt', lcg(3));
  let pm = L.publicMini(m), b = L.localBest(pm, 'X', cpuRng(), {}, HARD);
  assert.ok(Number.isInteger(b.move) && !pm.dug[b.move]); assert.equal(b.shared, true);
  L.applyMove(m, 'X', b.move);
  if (m.dug[m.treasure] == null) {
    pm = L.publicMini(m); b = L.localBest(pm, 'O', cpuRng(), {}, HARD);
    assert.ok(!pm.dug[b.move], 'an open cell');
    if (L.huntCandidates(pm).includes(b.move)) assert.equal(b.q, 1 / L.huntCandidates(pm).length);
  }
  // one cell left: dug
  const one = { type: 'hunt', treasure: 0, dug: new Array(36).fill(null), last: null };
  L.applyMove(one, 'X', 1); L.applyMove(one, 'O', 6); L.applyMove(one, 'X', 8);   // hot, hot, warm: only the corner fits
  pm = L.publicMini(one);
  assert.deepEqual(L.huntCandidates(pm), [0]);
  b = L.localBest(pm, 'X', cpuRng(), {}, HARD);
  assert.equal(b.move, 0); assert.equal(b.q, 1);
  const r = raceOf('hunt', 100);
  assert.ok(r.hard >= r.normal, `Hard at least holds its own: ${r.hard} to ${r.normal}`);
  const ms = [];
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); L.localBest(L.publicMini(L.newMini('hunt', lcg(k + 1))), 'X', cpuRng(), {}, HARD); ms.push(performance.now() - t0); }
  assert.ok(Math.min(...ms) < 60, `under 60 ms: ${ms.map(x => x.toFixed(1))}`);
  assert.ok(r.ms < 200, `never slow in the race (${r.ms.toFixed(1)} ms at worst)`);
  const fresh = L.publicMini(L.newMini('hunt', lcg(5)));
  assert.deepEqual(L.localBest(fresh, 'X', cpuRng(), {}, { level: 'normal', until: null }), L.localBest(fresh, 'X', cpuRng()), 'Normal untouched');
});

// ================================ Race mode (core/race.js) ================================
// The same treasure for both, but each player digs their own grid (mini.side[p]); the other side sees only their digs
// used and the band of their last dig; online the record keeps each side's part apart and a move's entry is redacted.
const RLCG = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const huntRace = on => E.setTune('hunt', on ? { mode: 'race' } : null);
test('hunt, race: dealt by the admin setting; each side its own digs over the same treasure, a cell dug by one still open to the other; Same phone stays Shared', () => {
  huntRace(true);
  try {
    const m = E.newMini('hunt', RLCG(3));
    assert.equal(m.race, true); assert.equal(m.dug, undefined); assert.equal(m.n, 6); assert.equal(E.huntSize(m), 6);
    assert.deepEqual(m.side, { X: { dug: [], last: null }, O: { dug: [], last: null } }); assert.deepEqual(m.tune, { mode: 'race' });
    const t = m.treasure, c = t === 0 ? 1 : 0, band = E.huntBand(E.huntDist(t, c));
    assert.deepEqual(E.applyMove(m, 'X', c, RLCG(1)), { ok: true, outcome: 'continue', note: 'dig' });
    assert.deepEqual(m.side.X.dug, [{ i: c, k: band }]); assert.equal(m.side.X.last, c);
    assert.deepEqual(m.side.O.dug, [], "O's grid is untouched");
    assert.equal(E.applyMove(m, 'X', c, RLCG(1)).reason, 'taken');
    assert.equal(E.applyMove(m, 'O', c, RLCG(1)).ok, true, 'the same cell is open to O');
    assert.deepEqual(E.applyMove(m, 'O', t, RLCG(1)), { ok: true, outcome: 'win', cells: [t] }, 'the same treasure wins for O');
    assert.equal(m.side.X.dug.length, 1);
    const forX = E.publicMini(m, 'X');
    assert.equal(forX.treasure, undefined); assert.deepEqual(Object.keys(forX.side), ['X'], "X's own part alone"); assert.equal(forX.side.O, undefined);
    assert.deepEqual(forX.shape, { X: { n: 1, heat: E.HUNT.bands[band] }, O: { n: 2, heat: 'found' } });
    assert.deepEqual(E.publicMini(m).side, {}); assert.deepEqual(E.raceView(m, null).side, {});
    assert.equal(E.publicMini(m, 'O').side.X, undefined, "X's part is not in O's view"); assert.deepEqual(E.publicMini(m, 'O').side.O.dug.map(d => d.i), [c, t]);
    assert.equal(E.newMini('hunt', RLCG(3), { shared: true }).race, undefined, 'two people on one phone: Shared');
    assert.ok(E.newMatch(RLCG(5), { games: ['hunt'], vs: 'same' }).squares.every(q => !q.mini.race));
    assert.ok(E.newMatch(RLCG(5), { games: ['hunt'], vs: 'cpu' }).squares.every(q => q.mini.race));
  } finally { huntRace(false); }
  assert.equal(E.newMini('hunt', RLCG(3)).race, undefined, 'off: as ever');
});
test('hunt, race: the record keeps each side\'s part for that side and the shapes in the public state; an online dig\'s entry is redacted for the other phone', () => {
  huntRace(true);
  try {
    const st = E.newMatch(RLCG(11), { games: ['hunt'] }); st.id = 'hr1'; st.seq = 0; st.recent = []; st.turn = 'X';
    const m = st.squares[0].mini, t = m.treasure, c = t === 5 ? 6 : 5;
    E.applyMove(m, 'O', c, RLCG(1));
    const rec = E.matchRecord(st), ps = rec.state.squares[0].mini;
    assert.equal(ps.side, undefined); assert.equal(ps.treasure, undefined); assert.equal(ps.dug, undefined); assert.equal(ps.clues, undefined);
    assert.deepEqual(ps.shape, { X: { n: 0, heat: null }, O: { n: 1, heat: E.HUNT.bands[E.huntBand(E.huntDist(t, c))] } });
    assert.deepEqual(rec.sides.O[0].dug, [{ i: c, k: E.huntBand(E.huntDist(t, c)) }]); assert.deepEqual(rec.sides.X[0], { dug: [], last: null });
    assert.ok(!JSON.stringify(rec.state).includes('"treasure"'));
    const full = E.fullState(rec);
    assert.deepEqual(full.squares[0].mini.side, m.side); assert.equal(full.squares[0].mini.treasure, t); assert.equal(full.squares[0].mini.shape, undefined);
    const back = E.parseMatch(E.packMatch(rec));
    assert.deepEqual(E.fullState(back).squares[0].mini.side, m.side);
    const oneSide = E.fullState({ state: rec.state, secrets: rec.secrets, sides: { X: rec.sides.X } });
    assert.equal(oneSide.squares[0].mini.side.O, undefined); assert.deepEqual(oneSide.squares[0].mini.side.X, { dug: [], last: null });
    // X digs online: the entry carries no cell, no band, no inputs; its shape change alone
    const cell = t === 7 ? 8 : 7;
    const r = E.applyOnlineMove(rec, 'X', 0, cell, RLCG(2), { rep: [[0, 'move', 'm=' + cell]] });
    assert.ok(r.ok, r.reason);
    const e = r.entries[0];
    assert.equal(e.m, undefined); assert.equal(e.band, undefined); assert.equal(e.note, undefined); assert.equal(e.rep, undefined);
    assert.deepEqual(Object.keys(e.race).sort(), ['by', 'heat', 'n']); assert.equal(e.race.by, 'X'); assert.equal(e.race.n, 1); assert.equal(e.race.heat, E.HUNT.bands[E.huntBand(E.huntDist(t, cell))]);
    assert.equal(e.after.mini.side, undefined); assert.equal(e.after.mini.shape.X.n, 1);
    assert.ok(!JSON.stringify(r.rec.state).includes('"dug"'), 'no cell is in the public state');
    assert.deepEqual(r.rec.sides.X[0].dug, [{ i: cell, k: E.huntBand(E.huntDist(t, cell)) }], "the mover's own part holds it"); assert.equal(r.rec.sides.O[0].dug.length, 1);
    assert.ok(E.applyOnlineMove(r.rec, 'O', 0, cell, RLCG(3)).ok, 'the same cell is open to O on its own grid');
  } finally { huntRace(false); }
});
test('hunt, race: the computer digs from its own part alone, every dig fitting its own clues, and finds the treasure (Normal and Hard)', () => {
  huntRace(true);
  try {
    for (const hard of [false, true]) {
      let total = 0;
      for (let g = 0; g < 30; g++) {
        const rng = RLCG(700 + g), m = E.newMini('hunt', rng);
        E.applyMove(m, 'X', m.treasure === 0 ? 1 : 0, rng);          // the other side has dug: nothing of it reaches the computer
        let n = 0, r;
        do {
          const pm = E.publicMini(m, 'O');
          assert.equal(pm.side.X, undefined, "never X's part"); assert.ok(pm.shape.X.n >= 1);
          const b = E.localBest(pm, 'O', rng, {}, hard ? { level: 'hard', until: null } : {});
          assert.ok(E.huntCandidates(pm, 'O').includes(b.move), 'a dig that fits its own clues'); assert.equal(b.shared, false);
          r = E.applyMove(m, 'O', b.move, rng); assert.ok(r.ok); n++;
        } while (r.outcome !== 'win' && n < 36);
        assert.equal(r.outcome, 'win'); total += n;
      }
      assert.ok(total / 30 < 8, `${hard ? 'Hard' : 'Normal'}: found in ${(total / 30).toFixed(1)} digs on average`);
    }
    const m = E.newMini('hunt', RLCG(9)), pm = E.publicMini(m, 'O');
    assert.ok(E.aiOf('hunt').needs(pm, 'X') > 2, 'the other side, nothing dug: a fresh estimate');
    E.applyMove(m, 'X', m.treasure === 0 ? 1 : 0, RLCG(1));
    const sh = E.publicMini(m, 'O').shape.X;
    assert.ok(sh.heat); assert.ok(E.aiOf('hunt').needs(E.publicMini(m, 'O'), 'X') <= 3.3, "the other side's needs, from its heat");
  } finally { huntRace(false); }
});
