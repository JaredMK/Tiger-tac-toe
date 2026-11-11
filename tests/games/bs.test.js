'use strict';
// Sea Battle: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');

const E = Object.assign({}, require('../engine.js'));
{ const set = E.setTune; E.setTune = (t, c) => set(t, Object.assign({ again: 'on' }, c)); }   // ("Go again on success" on: these tests play the success that keeps the turn; the default, off, has its own test)
E.setTune('bs', null);
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
const mini = (type, rng) => L.newMini(type, rng || lcg(11));
// a battleship with its ship on the given cells
const bsAt = (...ship) => Object.assign(mini('bs'), { len: ship.length, ship, revealed: new Array(16).fill(null), hits: [] });
// a one-cell ship (a Patrol Boat) at cell 0: either player claims it with one move
const oneMove = () => { const E1 = require('../engine.js'); E.setTune('bs', { len: 1 }); try { const m = L.newMini('bs', seq(pick(0, 2), pick(0, 4), pick(0, 4))); delete m.tune; return m; } finally { E.setTune('bs', null); } };   // a one-cell ship at cell 0
// a match where the computer plays `me`, with the given squares (type names or ready-made minis)
function cpuMatch(me, squares, owners = []) {
  const st = matchWith(squares.map(s => (typeof s === 'string' ? s : s.type)));
  for (let i = squares.length; i < 9; i++) st.squares[i].mini = L.newMini('ttt', lcg(900 + i));   // the rest: fresh, plain squares (what the pool happens to deal must not decide a tactics test)
  squares.forEach((s, i) => { if (typeof s !== 'string') st.squares[i].mini = s; });
  owners.forEach((o, i) => { if (o) st.squares[i].owner = o; });
  st.cpu = me; st.turn = me;
  return st;
}

// ================================ Sea Battle ================================
test('bs: one hidden ship of 1 to 4 cells (the length setting on Random), across or down, always inside the 4x4 grid', () => {
  assert.deepEqual(oneMove().ship, [0]);
  E.setTune('bs', { len: 'Random' });
  try {
  assert.deepEqual(L.newMini('bs', seq(pick(3, 4), pick(1, 2), pick(0, 1), pick(2, 4))).ship, [2, 6, 10, 14], 'a Sea Battle down column 3');
  assert.deepEqual(L.newMini('bs', seq(pick(2, 4), pick(0, 2), pick(3, 4), pick(1, 2))).ship, [13, 14, 15], 'a Submarine across the bottom row');
  const lens = new Set(), dirs = new Set(), rng = lcg(31);
  for (let k = 0; k < 400; k++) {
    const m = L.newMini('bs', rng);
    assert.equal(m.ship.length, m.len);
    assert.ok(m.len >= 1 && m.len <= 4);
    assert.ok(m.ship.every(c => Number.isInteger(c) && c >= 0 && c < 16));
    const rows = new Set(m.ship.map(c => Math.floor(c / 4))), cols = new Set(m.ship.map(c => c % 4));
    assert.ok(rows.size === 1 || cols.size === 1, 'in a straight line');
    const span = rows.size === 1 ? m.ship.map(c => c % 4) : m.ship.map(c => Math.floor(c / 4));
    assert.equal(Math.max(...span) - Math.min(...span), m.len - 1, 'no gaps, no wrapping');
    lens.add(m.len); if (m.len > 1) dirs.add(rows.size === 1 ? 'across' : 'down');
    assert.equal(m.revealed.length, 16); assert.deepEqual(m.hits, []);
  }
  assert.deepEqual([...lens].sort(), [1, 2, 3, 4]); assert.equal(dirs.size, 2);
  assert.deepEqual(L.BS.names, { 4: 'Carrier', 3: 'Submarine', 2: 'Destroyer', 1: 'Patrol Boat' });
  assert.equal(L.bsPlacements(1).length, 16); assert.equal(L.bsPlacements(4).length, 8);
  } finally { E.setTune('bs', null); }
});

test('bs: a shot is a hit or a miss; cells cannot be fired at twice; the shot on the last part sinks it', () => {
  const m = bsAt(5, 6, 7);
  assert.deepEqual(L.applyMove(m, 'X', 0), { ok: true, outcome: 'continue', note: 'miss' });
  assert.equal(m.revealed[0], 'X');
  assert.equal(L.applyMove(m, 'O', 0).reason, 'taken');
  for (const bad of [-1, 16, 'a', null, 1.5]) assert.equal(L.applyMove(m, 'O', bad).reason, 'bad');
  assert.deepEqual(L.applyMove(m, 'O', 6), { ok: true, outcome: 'continue', note: 'hit', again: true }, 'a hit fires again');
  assert.deepEqual(L.applyMove(m, 'X', 5), { ok: true, outcome: 'continue', note: 'hit', again: true });
  assert.deepEqual(m.hits, [6, 5]);
  const pm = L.publicMini(m);
  assert.deepEqual(Object.keys(pm).sort(), ['hits', 'len', 'revealed', 'tune', 'type'], 'the ship\'s cells stay hidden');
  const sink = L.applyMove(m, 'O', 7);
  assert.deepEqual(sink, { ok: true, outcome: 'win', cells: [5, 6, 7], note: 'sunk' });
});

test('bs: a hit fires again until a miss or the sinking shot; whoever hits the final segment claims the square', () => {
  const st = matchWith(['bs', 'ttt']);
  st.squares[0].mini = bsAt(1, 5, 9);
  let f = turn(st, 0, 1);
  assert.equal(f.note, 'hit'); assert.equal(f.kind, 'again', 'a hit keeps the turn');
  assert.equal(st.turn, 'X'); assert.equal(st.lock, 0, 'locked into the same square'); assert.equal(st.screen, 'mini');
  assert.equal(L.playMove(st, 1, 0).reason, 'locked', 'no playing elsewhere meanwhile');
  f = turn(st, 0, 2);
  assert.equal(f.note, 'miss'); assert.equal(f.kind, 'move', 'a miss ends it');
  assert.equal(st.turn, 'O'); assert.equal(st.lock, null);
  f = turn(st, 0, 5);
  assert.equal(f.kind, 'again'); assert.equal(st.turn, 'O');
  f = turn(st, 0, 9);
  assert.equal(f.kind, 'claim'); assert.equal(f.by, 'O'); assert.equal(f.hit, true);
  assert.equal(st.squares[0].owner, 'O');
  assert.deepEqual(st.squares[0].mini.winCells, [1, 5, 9], 'the whole ship is revealed');
  // the time running out with a bonus shot owed: no shot fired for the player; the turn passes
  const t = matchWith(['bs', 'ttt']);
  t.squares[0].mini = bsAt(0, 1, 2, 3); t.timer = L.newTimer(60);
  t.turn = 'X';
  assert.equal(L.playMove(t, 0, 0, lcg(1)).flash.kind, 'again'); t.flash = null;
  const hits = t.squares[0].mini.hits.slice();
  const r = L.timeoutMove(t, lcg(2));
  assert.deepEqual([r.ok, r.ended, t.lock, t.turn, t.squares[0].mini.hits], [true, true, null, 'O', hits], 'no bonus shot, the hit kept');
});

test('bs: firing at every cell always sinks the ship (no draw possible)', () => {
  const rng = lcg(41);
  for (let g = 0; g < 50; g++) {
    const m = L.newMini('bs', rng);
    let r;
    for (let c = 0; c < 16; c++) { r = L.applyMove(m, c % 2 ? 'O' : 'X', c); if (r.outcome === 'win') break; }
    assert.equal(r.outcome, 'win');
  }
});

test('bs: the computer fires where the ship can still fit, around a hit once there is one', () => {
  // a Destroyer hit at cell 5: only the four cells next to it can hold the rest
  const m = bsAt(5, 9);
  L.applyMove(m, 'O', 5);
  for (let k = 0; k < 20; k++) {
    const b = L.localBest(L.publicMini(m), 'X', lcg(k));
    assert.ok([1, 4, 6, 9].includes(b.move), `next to the hit (${b.move})`);
    assert.equal(b.q, 1 / 4, 'one of four placements, and that shot sinks it');
  }
  // misses rule cells out: with 1, 4 and 6 missed, 9 is the only place left
  for (const c of [1, 4, 6]) L.applyMove(m, 'O', c);
  assert.deepEqual(L.bsCandidates(L.publicMini(m)), [[5, 9]]);
  assert.deepEqual(L.localBest(L.publicMini(m), 'X', lcg(1)), { move: 9, q: 1, shared: true });
  // a Destroyer (2) with nothing fired yet: a search shot at random (no fixed first cell), on a cell a placement covers
  const firsts = new Set();
  for (let k = 0; k < 20; k++) firsts.add(L.localBest(L.publicMini(bsAt(0, 1)), 'X', lcg(k)).move);
  assert.ok(firsts.size >= 4, `spread (${[...firsts]})`);
  // a Sea Battle (4) whose middle misses leave only the edges
  const edge = bsAt(0, 4, 8, 12);
  for (const c of [5, 6, 9, 10]) L.applyMove(edge, 'O', c);
  const pe = L.publicMini(edge);
  assert.equal(L.bsCandidates(pe).length, 4, 'two rows and two columns along the edges');
  assert.ok(L.bsCandidates(pe).flat().includes(L.localBest(pe, 'X', lcg(2)).move));
  // the computer finishes a ship when it can: a 3-ship with two hits and one end missed
  const sub = bsAt(4, 5, 6);
  L.applyMove(sub, 'O', 4); L.applyMove(sub, 'O', 5); L.applyMove(sub, 'O', 7);
  const st = cpuMatch('X', [sub, 'ttt', 'ttt']);
  const mv = L.cpuMove(st, lcg(4));
  assert.equal(mv.square, 0); assert.equal(mv.move, 6);
});

test('bs: an old 3x3 game is moved into the top-left of the 4x4 grid as a Patrol Boat', () => {
  const old = { type: 'bs', hidden: 4, revealed: ['X', null, null, null, null, 'O', null, null, null], last: 5 };
  L.upgradeMini(old);
  assert.equal(old.revealed.length, 16);
  assert.deepEqual(old.ship, [5]); assert.equal(old.len, 1); assert.equal(old.last, 6);
  assert.equal(old.revealed[0], 'X'); assert.equal(old.revealed[6], 'O'); assert.deepEqual(old.hits, []);
  assert.equal(L.applyMove(old, 'X', 5).outcome, 'win');
  const pub = { type: 'bs', revealed: new Array(9).fill(null), last: null };   // an online square with its ship hidden
  L.upgradeMini(pub);
  assert.equal(pub.len, 1); assert.equal(pub.revealed.length, 16); assert.ok(!('ship' in pub));
});

test('bs: the admin settings deal a 5x5 sea with a long ship (and a 4x4 Super Chaos sea); the computer plays them', () => {
  E.setTune('bs', { n: 5, len: 4, scN: 4, scLen: 2, miss: 50 });
  try {
    const m = L.newMini('bs', lcg(3));
    assert.equal(m.n, 5); assert.equal(m.len, 4); assert.equal(m.revealed.length, 25);
    assert.deepEqual(m.tune, { again: 'on', n: 5, len: 4, scN: 4, scLen: 2, miss: 50 });
    for (let k = 0; k < 6; k++) {
      const pm = L.publicMini(m), mv = L.localBest(pm, 'X', lcg(k)).move;
      assert.ok(mv >= 0 && mv < 25 && !m.revealed[mv]);
      assert.ok(L.applyMove(m, 'X', mv).ok);
    }
    const sc = E.scSquareMini({}, {}, 'bs', lcg(5));
    assert.equal(sc.n, 4); assert.equal(sc.len, 2); assert.equal(sc.revealed.length, 16);
  } finally { E.setTune('bs', null); }
  const d = L.newMini('bs', lcg(3));
  assert.ok(!('n' in d) && !(d.tune && 'n' in d.tune)); assert.equal(d.revealed.length, 16);
  assert.ok(Array.from({ length: 20 }, (_, k) => L.newMini('bs', lcg(k)).len).every(n => n === 3), 'the ship is 3 long by default');
});

test('bs: the ship length setting: 1 to 4, or Random (1 to 4 a square); an old range setting is ignored', () => {
  for (const len of [1, 2, 4]) {
    E.setTune('bs', { len });
    try { assert.ok(Array.from({ length: 10 }, (_, k) => L.newMini('bs', lcg(k)).len).every(n => n === len)); } finally { E.setTune('bs', null); }
  }
  E.setTune('bs', { len: 'Random' });
  try { const r = lcg(77), seen = new Set(Array.from({ length: 80 }, () => L.newMini('bs', r).len)); assert.deepEqual([...seen].sort(), [1, 2, 3, 4]); } finally { E.setTune('bs', null); }
  E.setTune('bs', { lenMin: 1, lenMax: 1 });
  try { assert.equal(L.newMini('bs', lcg(2)).len, 3); } finally { E.setTune('bs', null); }
});

test('bs: the computer searches at random on a checkerboard for a ship of 2 or more, never in order, then targets round a hit', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const firsts = new Set();
    for (let k = 0; k < 40; k++) {
      const m = L.newMini('bs', lcg(k + 7)), pm = L.publicMini(m), mv = L.localBest(pm, 'X', lcg(k * 31 + 1), null, { level, until: null }).move;
      firsts.add(mv);
    }
    assert.ok(firsts.size >= 6, `${level}: first shots spread (${firsts.size} cells)`);
    // a whole search: every miss on one checkerboard colour
    const m = L.newMini('bs', lcg(99)), N = 4, par = k => (Math.floor(k / N) + (k % N)) & 1, misses = [];
    for (let t = 0; t < 30 && !m.hits.length; t++) {
      const mv = L.localBest(L.publicMini(m), 'X', lcg(500 + t), null, { level, until: null }).move;
      L.applyMove(m, 'X', mv); if (!m.hits.includes(mv)) misses.push(mv);
    }
    assert.ok(new Set(misses.map(par)).size <= 1, `${level}: the search keeps to one colour (${misses})`);
    // after a hit: the next shot is beside it (when the first hit is not the whole ship)
    if (m.hits.length && m.len > 1) {
      const h = m.hits[0], mv = L.localBest(L.publicMini(m), 'X', lcg(9), null, { level, until: null }).move;
      const near = [h - N, h + N].concat(h % N ? [h - 1] : [], h % N < N - 1 ? [h + 1] : []);
      assert.ok(near.includes(mv), `${level}: shot ${mv} beside the hit ${h}`);
    }
  }
});

// ================================ The Hard computer ================================
const HARD = { level: 'hard', until: null }, cpuRng = () => lcg(314);
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
test('bs, Hard: the race for the ship: a shot where it still fits, the sinking shot when one placement is left, around a hit, at least Normal\'s squares, quickly', () => {
  const m = { type: 'bs', len: 2, ship: [5, 6], revealed: new Array(16).fill(null), hits: [], last: null };
  let b = L.localBest(L.publicMini(m), 'X', cpuRng(), {}, HARD);
  assert.ok(Number.isInteger(b.move) && b.move >= 0 && b.move < 16); assert.equal(b.shared, true);
  assert.ok(L.bsCandidates(L.publicMini(m)).some(c => c.includes(b.move)), 'a cell the ship may be in');
  L.applyMove(m, 'X', 5);                                      // a hit: it fires again, at a neighbour
  b = L.localBest(L.publicMini(m), 'X', cpuRng(), {}, HARD);
  assert.ok([1, 4, 6, 9].includes(b.move), 'next to the hit');
  L.applyMove(m, 'X', 1); L.applyMove(m, 'O', 4); L.applyMove(m, 'X', 9);   // misses around it: one placement left
  const pm = L.publicMini(m);
  assert.equal(L.bsCandidates(pm).length, 1);
  b = L.localBest(pm, 'O', cpuRng(), {}, HARD);
  assert.equal(b.move, 6); assert.equal(b.q, 1, 'the sinking shot');
  // the 5x5 Super Chaos sea (a Submarine) plays too
  const sea = { type: 'bs', n: 5, len: 3, ship: [7, 12, 17], revealed: new Array(25).fill(null), hits: [], last: null };
  b = L.localBest(L.publicMini(sea), 'X', cpuRng(), {}, HARD);
  assert.ok(Number.isInteger(b.move) && b.move >= 0 && b.move < 25 && L.bsCandidates(L.publicMini(sea)).some(c => c.includes(b.move)));
  const r = raceOf('bs', 100);
  assert.ok(r.hard >= r.normal, `Hard at least holds its own: ${r.hard} to ${r.normal}`);
  const ms = [];
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); L.localBest(L.publicMini(L.newMini('bs', lcg(k + 1))), 'X', cpuRng(), {}, HARD); ms.push(performance.now() - t0); }
  assert.ok(Math.min(...ms) < 60, `under 60 ms: ${ms.map(x => x.toFixed(1))}`);
  assert.ok(r.ms < 200, `never slow in the race (${r.ms.toFixed(1)} ms at worst)`);
  const fresh = L.publicMini(L.newMini('bs', lcg(5)));
  assert.deepEqual(L.localBest(fresh, 'X', cpuRng(), {}, { level: 'normal', until: null }), L.localBest(fresh, 'X', cpuRng()), 'Normal untouched');
});

// ============================== Race mode (core/race.js, rv 2) ==============================
// A ship each, the same length on the same sea, placed apart (mini.tg, secret until the square ends); each player's
// shots on their own sea (mini.side[p], open to both). A hit fires again; no shot limit; the first to sink their own wins.
const raceOn = on => E.setTune('bs', on ? { mode: 'race' } : null);
const raceMini = (rng = lcg(3)) => { raceOn(true); try { return L.newMini('bs', rng); } finally { raceOn(false); } };
const notIn = (ship, k = 0) => { let c = k; while (ship.includes(c)) c++; return c; };
const sameShip = (a, b) => a.slice().sort((x, y) => x - y).join() === b.slice().sort((x, y) => x - y).join();

test('bs race: dealt by the admin setting with a ship each, the same length, placed apart; two people on one phone play Shared', () => {
  const m = raceMini();
  assert.equal(m.race, true); assert.equal(m.rv, 2); assert.equal(m.ship, undefined); assert.equal(m.revealed, undefined);
  assert.deepEqual(m.side.X, { revealed: new Array(16).fill(null), hits: [], last: null }); assert.deepEqual(m.side.O, m.side.X);
  assert.deepEqual(m.tune, { again: 'on', mode: 'race' });
  for (let s = 1; s <= 60; s++) {
    const r = raceMini(lcg(s));
    assert.equal(r.tg.X.length, r.len); assert.equal(r.tg.O.length, r.len, 'the same length: as hard as each other');
    assert.ok(!sameShip(r.tg.X, r.tg.O), `seed ${s}: two different placements`);
    for (const p of ['X', 'O']) assert.ok(L.bsPlacements(r.len).some(c => sameShip(c, r.tg[p])), 'a straight ship on the sea');
  }
  raceOn(true);
  try {
    assert.equal(L.newMini('bs', lcg(3), { shared: true }).race, undefined, 'Same phone: Shared');
    assert.ok(E.newMatch(lcg(5), { games: ['bs'], vs: 'same' }).squares.every(q => !q.mini.race));
    assert.ok(E.newMatch(lcg(5), { games: ['bs'], vs: 'cpu' }).squares.every(q => q.mini.race && q.mini.rv === 2));
  } finally { raceOn(false); }
  assert.equal(L.newMini('bs', lcg(3)).race, undefined, 'off: as ever');
});

test('bs race: each shot lands on the mover\'s own sea, judged by their own ship; a hit fires again; no shot limit; the first to sink their own wins', () => {
  const m = raceMini(lcg(8)), sx = m.tg.X, so = m.tg.O;
  const oOnly = so.find(c => !sx.includes(c));
  if (oOnly !== undefined) {
    assert.deepEqual(L.applyMove(m, 'X', oOnly), { ok: true, outcome: 'continue', note: 'miss' }, "a cell of O's ship is a miss on X's sea");
    assert.equal(m.side.X.revealed[oOnly], 'X'); assert.equal(m.side.O.revealed[oOnly], null, "O's sea untouched");
    const r = L.applyMove(m, 'O', oOnly);
    assert.equal(r.ok, true); assert.equal(r.note === 'hit' || r.note === 'sunk', true, "the same cell hits O's own ship");
  }
  // no limit: X fires at every cell off their ship (all misses, the square open), then sinks theirs
  for (let c = 0; c < 16; c++) if (!sx.includes(c) && !m.side.X.revealed[c]) { const r = L.applyMove(m, 'X', c); assert.equal(r.ok, true); assert.equal(r.outcome, 'continue'); }
  assert.equal(m.side.X.revealed.filter(Boolean).length, 16 - sx.length, 'every miss taken, still open');
  sx.forEach((c, k) => { const r = L.applyMove(m, 'X', c); if (k === sx.length - 1) { assert.equal(r.outcome, 'win'); assert.deepEqual(r.cells, sx); } else assert.equal(r.again, true, 'a hit fires again'); });
  assert.equal(L.applyMove(m, 'X', sx[0]).ok, false, 'fired there already');
  // the public copy (no ships) refuses a shot rather than judging it
  const pub = E.publicMini(raceMini(lcg(9)), 'X');
  assert.equal(L.applyMove(pub, 'X', 0).ok, false);
});

test('bs race: the ships stay out of the public view, the computer\'s view and the record until the square ends; both seas are open', () => {
  const m = raceMini(lcg(13)), miss = notIn(m.tg.X.concat(m.tg.O)), miss2 = notIn(m.tg.X.concat(m.tg.O), miss + 1);
  L.applyMove(m, 'X', miss); L.applyMove(m, 'O', miss2);
  for (const pm of [E.publicMini(m), E.publicMini(m, 'X'), E.publicMini(m, 'O')]) {
    assert.equal(pm.tg, undefined); assert.equal(pm.ship, undefined);
    const js = JSON.stringify(pm);
    assert.ok(!js.includes(JSON.stringify(m.tg.X)) && !js.includes(JSON.stringify(m.tg.O)), 'no ship in it');
    assert.equal(pm.side.X.revealed[miss], 'X'); assert.equal(pm.side.O.revealed[miss2], 'O', 'both seas open');
    assert.equal(pm.rv, 2);
  }
  raceOn(true);
  try {
    const st = E.newMatch(lcg(11), { games: ['bs', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'] }); const k = st.squares.findIndex(q => q.mini.type === 'bs');
    st.squares[k].mini = m; st.id = 'r1'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), ps = rec.state.squares[k].mini, js = JSON.stringify(rec.state);
    assert.equal(ps.tg, undefined); assert.ok(!js.includes(JSON.stringify(m.tg.X)) && !js.includes(JSON.stringify(m.tg.O)), 'no ship in the public state');
    assert.deepEqual(ps.side, m.side, 'both seas on the public state');
    assert.deepEqual(rec.secrets[k], { tg: m.tg });
    assert.deepEqual(rec.sides, { X: {}, O: {} }, 'nothing kept apart but the ships');
    const full = E.fullState(E.parseMatch(E.packMatch(rec)));
    assert.deepEqual(full.squares[k].mini.tg, m.tg); assert.deepEqual(full.squares[k].mini.side, m.side); assert.equal(full.squares[k].mini.rv, 2, 'not dealt again');
    // online: a shot's entry is the shot itself (nothing private), the ships never on it until the sinking
    const sx = rec.secrets[k].tg.X, cell = sx[0];
    const r = E.applyOnlineMove(rec, 'X', k, cell, lcg(2), { rep: [[0, 'move', 'm=' + cell]] });
    assert.ok(r.ok); const e = r.entries[0];
    assert.equal(e.m, cell); assert.equal(e.hit, true); assert.ok(e.rep, 'the inputs ride for the replay');
    let cur = r.rec;
    if (sx.length > 1) {
      assert.equal(e.kind, 'again'); assert.equal(e.after.mini.side.X.revealed[cell], 'X'); assert.equal(e.after.mini.tg, undefined);
      assert.ok(!JSON.stringify(r.rec.state).includes(JSON.stringify(sx)), 'the ship still out of the public state');
      for (const c of sx.slice(1)) { const nx = E.applyOnlineMove(cur, 'X', k, c, lcg(3)); assert.ok(nx.ok, nx.reason); cur = nx.rec; }
    }
    const sq = cur.state.squares[k];
    assert.equal(sq.owner, 'X', 'X sank their own'); assert.deepEqual(sq.mini.tg, m.tg, 'the square ended: both ships open');
  } finally { raceOn(false); }
});

test('bs race: the computer sinks its own ship from the public view at every level; the other side\'s needs come from their own sea', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    let turns = 0, squares = 0;
    for (let s = 1; s <= 12; s++) {
      const m = raceMini(lcg(100 + s)), rng = lcg(7 + s);
      let done = false, shots = 0;
      while (!done && shots < 16) {
        const pm = E.publicMini(m, 'O');
        assert.equal(pm.tg, undefined, 'never the ships');
        const mv = E.aiOf('bs').best(pm, 'O', rng, 'steady', { level, until: level === 'hard' && s % 2 ? (t => () => t - Date.now())(Date.now() + 20) : null }).move;
        const r = L.applyMove(m, 'O', mv, rng);
        assert.ok(r.ok, `${level}: shot ${mv} refused (${r.reason})`);
        shots++; if (!r.again) turns++;
        done = r.outcome === 'win';
      }
      assert.ok(done, `${level}: sunk within 16 shots`); squares++;
      assert.deepEqual(m.side.X.hits, [], "X's sea untouched");
    }
    assert.ok(turns / squares < 7, `${level}: about ${(turns / squares).toFixed(1)} turns a square`);
  }
  const m = raceMini(lcg(44)), ai = E.aiOf('bs');
  const n0 = ai.needs(E.publicMini(m, 'O'), 'X');
  if (m.len > 1) { L.applyMove(m, 'X', m.tg.X[0]); const n1 = ai.needs(E.publicMini(m, 'O'), 'X'); assert.ok(n1 < n0, `a hit brings X closer (${n0} -> ${n1})`); assert.ok(n1 >= m.len - 1, 'at least the parts left'); }
  assert.ok(ai.needs(E.publicMini(m, 'O'), 'O') >= m.len);
});

test('bs race: a Shared square plays on as ever (no side, the one sea, the one ship)', () => {
  const m = L.newMini('bs', lcg(3)), c = m.ship[0];
  assert.equal(m.race, undefined); assert.equal(m.tg, undefined);
  const r = L.applyMove(m, 'X', c); assert.ok(r.ok); assert.equal(m.revealed[c], 'X');
  assert.equal(E.publicMini(m).race, undefined); assert.equal(E.publicMini(m).shape, undefined);
});
