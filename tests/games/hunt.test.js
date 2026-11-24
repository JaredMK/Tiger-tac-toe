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

// ================================ Race mode (core/race.js, rv 2) ================================
// A treasure each on the same size grid (mini.tg, the square's secret), both on the edge or both inside (equally hard),
// never the same cell; each player digs their own grid (mini.side[p], open to both) against their own treasure; no limit.
const huntRace = on => E.setTune('hunt', on ? { mode: 'race' } : null);
const notMine = (m, p, c) => (c === m.tg[p] ? (c + 1) % 36 : c);
test('hunt, race: a treasure each, apart and equally hard (both on the edge or both inside), dealt by the admin setting; Same phone stays Shared', () => {
  huntRace(true);
  try {
    for (let k = 0; k < 200; k++) {
      const m = E.newMini('hunt', E.makeRng('hr' + k));
      assert.equal(m.race, true); assert.equal(m.rv, 2); assert.equal(m.n, 6); assert.equal(m.dug, undefined); assert.equal(m.treasure, undefined);
      assert.ok(Number.isInteger(m.tg.X) && Number.isInteger(m.tg.O) && m.tg.X !== m.tg.O, 'two different treasures');
      assert.equal(E.rulesOf('hunt').huntEdge(m.tg.X, 6), E.rulesOf('hunt').huntEdge(m.tg.O, 6), 'both on the edge or both inside');
      assert.deepEqual(m.side, { X: { dug: [], last: null }, O: { dug: [], last: null } });
    }
    E.setTune('hunt', { mode: 'race', n: 4 });
    for (let k = 0; k < 50; k++) { const m = E.newMini('hunt', E.makeRng('h4' + k)); assert.ok(m.tg.X !== m.tg.O && E.rulesOf('hunt').huntEdge(m.tg.X, 4) === E.rulesOf('hunt').huntEdge(m.tg.O, 4) && m.tg.O < 16); }
    huntRace(true);
    assert.equal(E.newMini('hunt', E.makeRng('s'), { shared: true }).race, undefined, 'two people on one phone: Shared');
    assert.ok(E.newMatch(E.makeRng('s'), { games: ['hunt'], vs: 'same' }).squares.every(q => !q.mini.race));
    assert.ok(E.newMatch(E.makeRng('s'), { games: ['hunt'], vs: 'cpu' }).squares.every(q => q.mini.race && q.mini.rv === 2));
  } finally { huntRace(false); }
  assert.equal(E.newMini('hunt', E.makeRng('s')).race, undefined, 'off: as ever');
});
test('hunt, race: a dig changes the mover\'s grid alone, banded by their own treasure; the other\'s treasure is nothing to them; no dig limit', () => {
  huntRace(true);
  try {
    const m = E.newMini('hunt', E.makeRng('hr-move')), c = notMine(m, 'X', m.tg.O === m.tg.X ? 0 : m.tg.O);
    assert.deepEqual(E.applyMove(m, 'X', c, anyRng()), { ok: true, outcome: 'continue', note: 'dig' }, "O's treasure is an empty cell on X's grid");
    assert.deepEqual(m.side.X.dug, [{ i: c, k: E.huntBand(E.huntDist(m.tg.X, c)) }]); assert.equal(m.side.X.last, c);
    assert.deepEqual(m.side.O, { dug: [], last: null }, "O's grid is untouched");
    assert.equal(E.applyMove(m, 'X', c, anyRng()).reason, 'taken');
    assert.equal(E.applyMove(m, 'O', c, anyRng()).ok, true, 'the same cell is open to O on its own grid');
    assert.equal(m.side.O.dug[0].k, E.huntBand(E.huntDist(m.tg.O, c)), "O's band: by O's treasure");
    // no limit: X digs every cell but its treasure, then finds it
    const w = E.newMini('hunt', E.makeRng('hr-all'));
    for (let i = 0; i < 36; i++) if (i !== w.tg.X) assert.equal(E.applyMove(w, 'X', i, anyRng()).outcome, 'continue', `dig ${i}`);
    assert.deepEqual(E.applyMove(w, 'X', w.tg.X, anyRng()), { ok: true, outcome: 'win', cells: [w.tg.X] });
    assert.equal(w.side.X.dug.length, 36);
    const noT = JSON.parse(JSON.stringify(m)); delete noT.tg;
    assert.equal(E.applyMove(noT, 'X', 20, anyRng()).reason, 'secret', 'no treasure here: no dig (online it is the server\'s)');
  } finally { huntRace(false); }
});
test('hunt, race: the record and the computer\'s view never carry an open square\'s treasures; both grids are open; a claimed square shows them', () => {
  huntRace(true);
  try {
    const st = E.newMatch(E.makeRng('hr-rec'), { games: ['hunt'] }); st.id = 'hr1'; st.seq = 0; st.recent = []; st.turn = 'X';
    const m = st.squares[0].mini, cx = notMine(m, 'X', 5), co = notMine(m, 'O', 7);
    E.applyMove(m, 'O', co, anyRng());
    const rec = E.matchRecord(st), ps = rec.state.squares[0].mini;
    assert.ok(!/"tg"|"treasure"/.test(JSON.stringify(rec.state)), 'no treasure in the public state');
    assert.deepEqual(rec.secrets[0].tg, m.tg, 'the treasures are the secret');
    assert.deepEqual(ps.side, m.side, "both grids in the public state"); assert.deepEqual(rec.sides, { X: {}, O: {} }, 'nothing kept apart but the treasures');
    for (const p of ['X', 'O']) { const pm = E.publicMini(m, p); assert.ok(!/"tg"|"treasure"/.test(JSON.stringify(pm))); assert.deepEqual(pm.side, m.side); assert.equal(pm.rv, 2); }
    const full = E.fullState(rec);
    assert.deepEqual(full.squares[0].mini.tg, m.tg); assert.deepEqual(full.squares[0].mini.side, m.side);
    const r = E.applyOnlineMove(rec, 'X', 0, cx, E.makeRng('d'), { rep: [[0, 'move', 'm=' + cx]] });
    assert.ok(r.ok, r.reason);
    const e = r.entries[0];
    assert.equal(e.band, E.huntBand(E.huntDist(m.tg.X, cx)), "the dig's band rides the entry: it is open");
    assert.ok(!/"tg"/.test(JSON.stringify(e)) && !/"tg"/.test(JSON.stringify(r.rec.state)));
    assert.deepEqual(e.after.mini.side.X.dug, [{ i: cx, k: e.band }]);
    const win = E.applyOnlineMove(E.applyOnlineMove(r.rec, 'O', 0, notMine(m, 'O', 9), E.makeRng('e')).rec, 'X', 0, m.tg.X, E.makeRng('f'));
    assert.ok(win.ok); assert.equal(win.rec.state.squares[0].owner, 'X');
    assert.deepEqual(win.rec.state.squares[0].mini.tg, m.tg, 'claimed: both treasures shown');
  } finally { huntRace(false); }
});
test('hunt, race: the computer digs its own grid by its own clues alone and finds its treasure at every level; Hard takes no more digs than Normal', () => {
  huntRace(true);
  try {
    for (const level of ['easy', 'normal', 'hard']) {
      for (let g = 0; g < 6; g++) {
        const st = E.newMatch(E.makeRng(`hc-${level}-${g}`), { games: ['hunt'], vs: 'cpu' }); st.only = 0; st.cpuLevel = level;
        const m = st.squares[0].mini; let n = 0;
        while (!st.squares[0].owner && n < 80) {
          st.turn = 'O'; st.flash = null; st.done = null; st.lock = null; st.spot = null;
          const mv = E.cpuMove(st, E.makeRng(`hm-${level}-${g}-${n}`), null, { level, clock: () => 0, budget: 1e9 });
          assert.equal(mv.square, 0);
          assert.ok(E.playMove(st, 0, mv.move, anyRng()).ok); n++;
        }
        assert.equal(st.squares[0].owner, 'O', `${level}: found its own treasure`);
        assert.deepEqual(m.side.X, { dug: [], last: null }, "X's grid untouched");
        assert.ok(m.side.O.dug.some(d => d.i === m.tg.O && d.k === 0));
      }
    }
    const avg = { normal: 0, hard: 0 }, N = 40;
    for (const level of ['normal', 'hard']) for (let g = 0; g < N; g++) {
      const rng = E.makeRng('hs' + g), m = E.newMini('hunt', rng); let n = 0, r;
      do {
        const pm = E.publicMini(m, 'X'), b = E.localBest(pm, 'X', rng, {}, level === 'hard' ? { level: 'hard', until: null } : {});
        if (level === 'hard' && E.huntCandidates(pm, 'X').includes(b.move) === false) assert.ok(!m.side.X.dug.some(d => d.i === b.move), 'an open cell');
        assert.equal(b.shared, false); r = E.applyMove(m, 'X', b.move, rng); n++;
      } while (r.outcome !== 'win' && n < 36);
      avg[level] += n / N;
    }
    assert.ok(avg.hard <= avg.normal + 0.1 && avg.hard < 4.2, `digs on average: Hard ${avg.hard.toFixed(2)}, Normal ${avg.normal.toFixed(2)}`);
    const m = E.newMini('hunt', E.makeRng('hn'));
    assert.ok(E.aiOf('hunt').needs(E.publicMini(m, 'O'), 'X') > 2, 'the other side, nothing dug');
    E.applyMove(m, 'X', notMine(m, 'X', 14), anyRng());
    assert.ok(E.aiOf('hunt').needs(E.publicMini(m, 'O'), 'X') < E.aiOf('hunt').needs(E.publicMini(m, 'O'), 'O'), "the other side's needs, from its own open grid");
    const t0 = performance.now(); E.localBest(E.publicMini(E.newMini('hunt', E.makeRng('ht')), 'X'), 'X', anyRng(), {}, { level: 'hard', until: () => 30 - (performance.now() - t0) });
    assert.ok(performance.now() - t0 < 80, 'Hard keeps to its time');
  } finally { huntRace(false); }
});

// ================================ Hint difficulty (the admin's `hints`) ================================
// rules.js HUNT_HINTS: each band's reach in steps by the setting, kept on the square (tune(mini)). 'normal' is the game as
// it always was; 'hard' and 'harder' widen the bands.
const R = E.rulesOf('hunt'), A = E.aiOf('hunt'), M = require('../../src/games/hunt/meta.js');
const OLD_BAND = d => (d <= 0 ? 0 : d === 1 ? 1 : d <= 3 ? 2 : d <= 5 ? 3 : 4);   // the band before the setting existed
const withHints = (hints, fn, more) => { E.setTune('hunt', Object.assign({ hints }, more)); try { return fn(); } finally { E.setTune('hunt', null); } };
test('hunt, hints: the default is the game as it was: the same bands, the same square, the same clues, the same computer', () => {
  const f = E.gameFields('hunt').find(x => x.k === 'hints');
  assert.deepEqual([f.def, f.opts, f.group], ['normal', ['normal', 'hard', 'harder'], 'Rules']);
  assert.equal(E.tuneLive('hunt').hints, 'normal');
  assert.deepEqual(R.HUNT_HINTS.normal, [1, 3, 5]);
  assert.deepEqual(R.huntRanges('normal'), [{ k: 1, lo: 1, hi: 1 }, { k: 2, lo: 2, hi: 3 }, { k: 3, lo: 4, hi: 5 }, { k: 4, lo: 6, hi: null }]);
  for (let d = 0; d <= 14; d++) { assert.equal(L.huntBand(d), OLD_BAND(d), `d ${d}`); assert.equal(L.huntBand(d, 'normal'), OLD_BAND(d)); assert.equal(L.huntBand(d, 'nonsense'), OLD_BAND(d)); }
  const m = L.newMini('hunt', E.makeRng('hint-default'));
  assert.deepEqual(Object.keys(m).sort(), ['dug', 'last', 'treasure', 'type'], 'the same square: no setting kept on it');
  assert.equal(R.huntHints(m), 'normal');
  for (const n of [4, 5, 6, 7, 8]) {                             // every grid size: each clue as it always was
    const sq = { type: 'hunt', treasure: 0, dug: new Array(n * n).fill(null), last: null };
    for (let t = 0; t < n * n; t++) { sq.treasure = t; for (let c = 0; c < n * n; c++) assert.equal(L.huntClue(sq, c), OLD_BAND(L.huntDist(t, c, n)), `${n}x${n} ${t}-${c}`); }
  }
  const before = { type: 'hunt', treasure: 14, dug: new Array(64).fill(null), last: null, tune: { n: 8, miss: 30 } };   // a square dealt before the setting, with other settings
  assert.equal(R.huntHints(before), 'normal'); assert.equal(L.huntClue(before, 0), OLD_BAND(L.huntDist(14, 0, 8)));
  for (const c of [0, 5, 35]) { const h = L.newMini('hunt', seq(pick(14, 36))); const st = matchWith(['hunt']); st.squares[0].mini = h; st.turn = 'X'; assert.equal(turn(st, 0, c).band, OLD_BAND(L.huntDist(14, c))); }
  for (let k = 0; k < 8; k++) assert.ok([7, 10, 25, 28].includes(L.localBest(L.publicMini(L.newMini('hunt', lcg(k + 40))), 'X', lcg(k), {}, HARD).move), 'Hard opens from its book');
  assert.equal(A.needs(L.publicMini(L.newMini('hunt', lcg(1))), 'X'), 1 + Math.log2(36) / 2.5, 'the same estimate');
  const v = M.explainVars(E.tuneLive('hunt')), fill = s => s.replace(/\{(\w+)\}/g, (x, k) => v[k]);
  assert.equal(fill(M.explainer.play), 'Dig a square. It tells you if the treasure is hot, warm, cool or cold. Steps count up, down, left and right only, not diagonally.');
  assert.equal(fill(M.raceExplainer.play), 'Each of you has your own treasure on your own map. Dig a square: it tells you if your treasure is hot, warm, cool or cold. Steps count up, down, left and right only, not diagonally. You can watch the other player\'s digs.');
  assert.equal(fill(M.scExplainer.play), 'Dig a square. It tells you if the treasure is hot, warm, cool or cold. Steps count up, down, left and right only, not diagonally. Both digs join the map when the round ends.');
});
// A clue at each distance from a corner treasure (cell 0 of 6x6): cells 1 to 5 along the top row, then down the right side.
const AT = [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [11, 6], [17, 7], [23, 8], [29, 9], [35, 10]];
const WIDE = { hard: [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4], harder: [0, 1, 1, 1, 2, 2, 2, 4, 4, 4, 4] };   // the band at 0 to 10 steps
test('hunt, hints: hard and harder widen the bands: a clue at each distance gives its band, on the square, the move, the record and the cells still possible', () => {
  assert.deepEqual(R.huntRanges('hard'), [{ k: 1, lo: 1, hi: 2 }, { k: 2, lo: 3, hi: 5 }, { k: 3, lo: 6, hi: 8 }, { k: 4, lo: 9, hi: null }]);
  assert.deepEqual(R.huntRanges('harder'), [{ k: 1, lo: 1, hi: 3 }, { k: 2, lo: 4, hi: 6 }, { k: 4, lo: 7, hi: null }], 'no Cool');
  for (const hints of ['hard', 'harder']) {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => L.huntBand(d, hints)), WIDE[hints], hints);
    const m = withHints(hints, () => L.newMini('hunt', seq(pick(0, 36))));
    assert.deepEqual(m.tune, { hints }, 'the square keeps its setting'); assert.equal(m.treasure, 0); assert.equal(R.huntHints(m), hints);
    for (const [c, d] of AT) assert.equal(L.huntClue(m, c), WIDE[hints][d], `${hints}: cell ${c}, ${d} steps`);
    const st = matchWith(['hunt']); st.squares[0].mini = m;
    for (const [c, d] of AT) { st.turn = 'X'; assert.equal(turn(st, 0, c).band, WIDE[hints][d], `${hints}: the move's band at ${d} steps`); }
    const pm = L.publicMini(m);
    assert.deepEqual(AT.map(([c]) => pm.clues[c]), AT.map(([, d]) => WIDE[hints][d]), 'the public view: the wide bands');
    assert.deepEqual(pm.tune, { hints }, 'the setting rides the public view');
    st.id = 'hh'; st.seq = 0; st.recent = [];
    const rec = L.matchRecord(st), hid = rec.state.squares[0].mini;
    assert.ok(!('treasure' in hid)); assert.deepEqual(AT.map(([c]) => hid.clues[c]), AT.map(([, d]) => WIDE[hints][d]), 'online too');
    const cand = L.huntCandidates(L.publicMini(m));
    assert.ok(cand.includes(0), 'the treasure is still possible'); assert.ok(cand.every(c => AT.every(([x, d]) => L.huntBand(L.huntDist(c, x), hints) === WIDE[hints][d])), 'every one fits every wide clue');
    assert.equal(withHints('normal', () => L.huntClue(m, 3)), WIDE[hints][3], 'a square plays on by the setting it was dealt with');
  }
  assert.ok(!Array.from({ length: 15 }, (_, d) => L.huntBand(d, 'harder')).includes(3), 'harder has no Cool');
});
test('hunt, hints: Race and Super Chaos read the square\'s bands; the computer digs only cells the wide clues allow and finds the treasure at every level', () => {
  for (const hints of ['hard', 'harder']) {
    const m = withHints(hints, () => E.newMini('hunt', E.makeRng('hint-race-' + hints)), { mode: 'race' });
    assert.equal(m.race, true); assert.deepEqual(m.tune, { hints, mode: 'race' });
    for (let k = 0; k < 36; k++) { if (k === m.tg.X || m.side.X.dug.length > 6) continue; E.applyMove(m, 'X', k, anyRng()); }
    for (const d of m.side.X.dug) assert.equal(d.k, L.huntBand(L.huntDist(m.tg.X, d.i), hints), `race: ${hints} band`);
    const base = withHints(hints, () => L.newMini('hunt', seq(pick(0, 36)))), fx = JSON.parse(JSON.stringify(base)), fo = JSON.parse(JSON.stringify(base));
    L.applyMove(fx, 'X', 2); L.applyMove(fo, 'O', 23);              // 2 steps and 8 steps from the treasure
    assert.deepEqual(R.scJoint(base, { X: fx, O: fo }).scr.bands, { X: WIDE[hints][2], O: WIDE[hints][8] }, 'Super Chaos: both digs by the square\'s bands');
    for (const mode of ['shared', 'race']) for (const level of ['normal', 'hard']) {
      let total = 0;
      for (let g = 0; g < 12; g++) {
        const h = withHints(hints, () => E.newMini('hunt', E.makeRng(`hint-ai-${hints}-${mode}-${level}-${g}`)), { mode });
        let n = 0, r;
        do {
          const pm = E.publicMini(h, 'X'), cand = L.huntCandidates(pm, 'X'), b = L.localBest(pm, 'X', lcg(g * 7 + n), {}, level === 'hard' ? HARD : {});
          if (level === 'normal') assert.ok(cand.includes(b.move), `${hints} ${mode}: Normal digs a cell the wide clues allow`);
          else assert.equal(b.q, cand.includes(b.move) ? 1 / cand.length : 0, `${hints} ${mode}: Hard's odds by the wide clues`);   // (Hard may dig outside them to split them, or wait: an open cell)
          r = E.applyMove(h, 'X', b.move, anyRng()); assert.ok(r.ok, `${hints} ${mode} ${level}: an open cell`); n++;
        } while (r.outcome !== 'win' && n < 36);
        assert.equal(r.outcome, 'win', `${hints} ${mode} ${level}: found`); total += n;
      }
      assert.ok(total / 12 < 9, `${hints} ${mode} ${level}: ${(total / 12).toFixed(1)} digs on average`);
    }
    const book = { hard: [2, 3, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 32, 33], harder: [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 14, 15, 17, 18, 20, 21, 23, 24, 25, 28, 29, 30, 31, 32, 33, 34, 35] }[hints];
    for (let k = 0; k < 6; k++) assert.ok(book.includes(L.localBest(L.publicMini(withHints(hints, () => L.newMini('hunt', lcg(k + 60)))), 'X', lcg(k), {}, HARD).move), `${hints}: Hard opens from its book`);
    const fresh = L.publicMini(withHints(hints, () => L.newMini('hunt', lcg(1))));
    assert.ok(A.needs(fresh, 'X') > A.needs(L.publicMini(L.newMini('hunt', lcg(1))), 'X'), `${hints}: more digs to go than normal`);
  }
  assert.ok(A.needs(L.publicMini(withHints('harder', () => L.newMini('hunt', lcg(1)))), 'X') > A.needs(L.publicMini(withHints('hard', () => L.newMini('hunt', lcg(1)))), 'X'), 'harder: more than hard');
});
test('hunt, hints: the explainer and the setting\'s label say the bands as the table has them', () => {
  const f = E.gameFields('hunt').find(x => x.k === 'hints');
  assert.deepEqual(M.explainVars({ hints: 'normal' }), { bandWords: 'hot, warm, cool or cold', hintText: '' });
  assert.deepEqual(M.explainVars({ hints: 'hard' }), { bandWords: 'hot, warm, cool or cold', hintText: ' Hot is 1 or 2 steps away, warm 3 to 5, cool 6 to 8, cold 9 or more.' });
  assert.deepEqual(M.explainVars({ hints: 'harder' }), { bandWords: 'hot, warm or cold', hintText: ' Hot is 1 to 3 steps away, warm 4 to 6, cold 7 or more.' });
  const NAME = [null, 'Hot', 'Warm', 'Cool', 'Cold'];
  for (const h of f.opts) {
    const said = R.huntRanges(h).map(r => `${NAME[r.k]} ${r.hi == null ? r.lo + '+' : r.hi === r.lo ? r.lo + ' step' : r.lo + '–' + r.hi}`).join(', ');
    assert.ok(f.label.includes(`${h}: ${said}`), `the label says ${h}: ${said}`);
  }
});
