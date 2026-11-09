'use strict';
// Codebreaker: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

function matchWith(types, rng = lcg(7)) {
  const st = L.newMatch(rng);
  types.forEach((t, i) => { st.squares[i].mini = L.newMini(t, rng); });
  return st;
}

// ================================ Computer player ================================
const cpuRng = () => lcg(314);

// ================================ Codebreaker ================================
const mmMini = code => ({ type: 'mastermind', code, guesses: [] });

test('mastermind: feedback against known examples, including all the right colours in all the wrong spots', () => {
  const code = [0, 1, 2, 3];
  const cases = [
    [[0, 1, 2, 3], 4, 0, 'exact'],
    [[1, 0, 3, 2], 0, 4, 'all four colours, every one in the wrong spot'],
    [[3, 2, 1, 0], 0, 4, 'reversed: all wrong spots'],
    [[1, 2, 3, 0], 0, 4, 'rotated: all wrong spots'],
    [[0, 1, 3, 2], 2, 2, 'two right, two swapped'],
    [[0, 4, 5, 1], 1, 1, 'one right spot, one wrong spot'],
    [[4, 5, 0, 1], 0, 2, 'two colours, both misplaced'],
    [[4, 5, 2, 3], 2, 0, 'two right in place, two absent'],
    [[0, 5, 4, 3], 2, 0],
    [[5, 4, 1, 0], 0, 2],
  ];
  for (const [g, solid, hollow, why] of cases) assert.deepEqual(L.mmFeedback(g, code), { solid, hollow }, `${JSON.stringify(g)} ${why || ''}`);
  // with only 6 colours and 4 pegs, at least two of any guess's colours are in the code
  for (const g of L.mmAll()) { const f = L.mmFeedback(g, code); assert.ok(f.solid + f.hollow >= 2 && f.solid + f.hollow <= 4); }
  // the markers are symmetric in count: guess vs code and code vs guess give the same result
  const rng = lcg(4);
  for (let k = 0; k < 200; k++) { const a = L.mmAll()[Math.floor(rng() * 360)], b = L.mmAll()[Math.floor(rng() * 360)]; assert.deepEqual(L.mmFeedback(a, b), L.mmFeedback(b, a)); }
});

test('mastermind: a hidden code of 4 different colours from 6; guesses must be 4 different colours too', () => {
  assert.deepEqual(L.MM, { pegs: 4, colors: 6 });
  assert.equal(L.mmAll().length, 360, '6 x 5 x 4 x 3 codes');
  const rng = lcg(9);
  for (let k = 0; k < 50; k++) {
    const m = L.newMini('mastermind', rng);
    assert.equal(m.code.length, 4); assert.equal(new Set(m.code).size, 4, 'no repeated colour');
    assert.ok(m.code.every(c => c >= 0 && c < 6));
  }
  const m = mmMini([0, 1, 2, 3]);
  for (const bad of [[0, 0, 1, 2], [0, 1, 2], [0, 1, 2, 3, 4], [0, 1, 2, 6], [-1, 1, 2, 3], 'RGBY', [0, 1, 2, 3.5]]) {
    assert.deepEqual(L.applyMove(m, 'X', bad), { ok: false, reason: 'bad' }, JSON.stringify(bad));
  }
  assert.equal(m.guesses.length, 0, 'refused guesses leave nothing behind');
  assert.ok(L.defaultSetup().games.mastermind, 'on by default in the Mini-games list');
  assert.ok(L.TYPES.includes('mastermind'));
});

test('mastermind: guesses and feedback stay on record; whoever guesses the exact code wins', () => {
  const st = matchWith(['mastermind', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].mini = mmMini([5, 2, 0, 4]);
  let r = L.playMove(st, 0, [0, 1, 2, 3], lcg(1));
  assert.equal(r.ok, true); assert.equal(st.flash.kind, 'move');
  assert.deepEqual([st.flash.solid, st.flash.hollow], [0, 2]);
  assert.deepEqual(st.flash.code, [0, 1, 2, 3]);
  L.endFlash(st);
  assert.equal(st.turn, 'O');
  r = L.playMove(st, 0, [5, 2, 4, 0], lcg(1));               // O: close, not exact
  assert.equal(st.flash.kind, 'move'); assert.deepEqual([st.flash.solid, st.flash.hollow], [2, 2]);
  L.endFlash(st);
  r = L.playMove(st, 0, [5, 2, 0, 4], lcg(1));               // X cracks it
  assert.equal(r.ok, true); assert.equal(st.flash.kind, 'claim'); assert.equal(st.squares[0].owner, 'X');
  assert.deepEqual(st.squares[0].mini.guesses.map(g => [g.by, g.solid, g.hollow]), [['X', 0, 2], ['O', 2, 2], ['X', 4, 0]]);
});

test('mastermind: the code never leaves the hidden part until it is cracked', () => {
  const st = matchWith(['mastermind', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].mini = mmMini([5, 2, 0, 4]);
  L.playMove(st, 0, [0, 1, 2, 3], lcg(1)); L.endFlash(st);
  const pm = L.publicMini(st.squares[0].mini);
  assert.ok(!('code' in pm)); assert.equal(pm.guesses.length, 1);
  st.id = 'm'; st.seq = 0; st.recent = [];
  const rec = L.matchRecord(st);
  assert.ok(!('code' in rec.state.squares[0].mini), 'not in the shared state online');
  assert.ok(!JSON.stringify(rec.state).includes('[5,2,0,4]'));
  assert.deepEqual(rec.secrets[0], { code: [5, 2, 0, 4] }, 'kept in the separate secrets node');
  // a guess made through the online record is scored against the secret
  let o = L.applyOnlineMove(rec, 'O', 0, [5, 2, 0, 4], lcg(2));
  assert.equal(o.ok, true); assert.equal(o.rec.state.squares[0].owner, 'O');
  assert.deepEqual(o.rec.state.squares[0].mini.code, [5, 2, 0, 4], 'once cracked, the code is on show');
});

test('mastermind tactics: only codes consistent with every feedback, the best minimax split, the last one taken', () => {
  const m = mmMini([3, 1, 4, 0]);
  L.applyMove(m, 'X', [0, 1, 2, 3]);
  L.applyMove(m, 'O', [4, 5, 0, 1]);
  const pm = L.publicMini(m);
  const cand = L.mmCandidates(pm);
  assert.ok(cand.some(c => c.join() === '3,1,4,0'), 'the real code is still possible');
  for (const c of cand) for (const g of pm.guesses) assert.deepEqual(L.mmFeedback(g.code, c), { solid: g.solid, hollow: g.hollow });
  // the minimax guess: no other guess leaves a smaller worst case
  const worst = g => { const groups = new Map(); for (const c of cand) { const f = L.mmFeedback(g, c); const k = f.solid * 10 + f.hollow; groups.set(k, (groups.get(k) || 0) + 1); } return Math.max(...groups.values()); };
  const best = L.mmBestGuess(cand);
  assert.ok(L.mmValid(best));
  const bw = worst(best);
  for (const g of L.mmAll()) assert.ok(worst(g) >= bw, `${g} does not beat ${best}`);
  const lb = L.localBest(pm, 'X', cpuRng());
  assert.ok(L.mmValid(lb.move)); assert.equal(lb.shared, true); assert.equal(lb.q, 1 / cand.length);
  // one code left: guess it
  const one = mmMini([3, 1, 4, 0]);
  for (const g of [[0, 1, 2, 3], [4, 5, 0, 1], [1, 3, 5, 0], [3, 1, 0, 4]]) L.applyMove(one, 'X', g);
  const left = L.mmCandidates(L.publicMini(one));
  if (left.length === 1) { const b = L.localBest(L.publicMini(one), 'O', cpuRng()); assert.deepEqual(b.move, [3, 1, 4, 0]); assert.equal(b.q, 1); }
  // playing alone it always cracks the code, within 5 guesses
  for (const code of L.mmAll().filter((_, k) => k % 7 === 0)) {
    const g = mmMini(code.slice()); let n = 0, r;
    do { n++; r = L.applyMove(g, 'X', L.localBest(L.publicMini(g), 'X', cpuRng()).move); } while (r.outcome !== 'win' && n < 10);
    assert.ok(n <= 5, `${code} took ${n} guesses`);
  }
  // board level: the fewer codes left, the closer both players are (shared information)
  const fresh = L.needsOf(L.publicMini(mmMini([0, 1, 2, 3])), 'X');
  assert.ok(L.needsOf(pm, 'X') < fresh); assert.equal(L.needsOf(pm, 'X'), L.needsOf(pm, 'O'));
});

test('mastermind: a timed-out random move is a valid 4-colour guess', () => {
  const rng = lcg(21);
  for (let k = 0; k < 40; k++) {
    const m = L.newMini('mastermind', rng);
    const g = L.randomLegalMove(m, 'X', rng);
    assert.ok(L.mmValid(g), JSON.stringify(g));
    assert.equal(L.applyMove(m, 'X', g).ok, true);
  }
});

test('mastermind: the admin\'s settings (colours, the computer ignoring the clues) are dealt into the square and played by', () => {
  E.setTune('mastermind', { colors: 4, miss: 60 });
  const m = E.newMini('mastermind', E.makeRng('mm-tune'));
  E.setTune('mastermind', null);
  assert.deepEqual(m.tune, { colors: 4, miss: 60 });
  assert.ok(m.code.every(c => c < 4));
  assert.equal(E.applyMove(m, 'X', [0, 1, 2, 5], anyRng()).ok, false, 'a colour not in play');
  assert.equal(E.applyMove(m, 'X', [3, 2, 1, 0], anyRng()).ok, true);
  assert.equal(E.mmAll().length, 360, 'the default list stays as it was');
  const pm = E.publicMini(m);
  assert.ok(E.mmCandidates(pm).length <= 24);
  for (let k = 0; k < 10; k++) { const g = E.localBest(pm, 'O', E.makeRng('mm-ai' + k)).move; assert.ok(E.mmValid(g, 4), JSON.stringify(g)); }
  for (let k = 0; k < 40 && !E.applyMove(m, 'O', E.localBest(E.publicMini(m), 'O', E.makeRng('mm-p' + k)).move, anyRng()).outcome.startsWith('win'); k++);
  assert.ok(m.guesses.some(g => g.solid === 4), 'cracked');
});

// ================================ The Hard computer ================================
const HARD = { level: 'hard', until: null };
// Hard against Normal over n squares of one game, sides alternating: { hard, normal, ms } (ms: the slowest Hard move).
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
test('mastermind, Hard: the race for the code: legal guesses, the last candidates guessed, the game-theoretic guess with few left, more squares than Normal, quickly', () => {
  const m = mmMini([3, 1, 4, 0]);
  let b = L.localBest(L.publicMini(m), 'X', cpuRng(), {}, HARD);
  assert.ok(L.mmValid(b.move), 'a fresh square: a valid code'); assert.equal(b.shared, true);
  L.applyMove(m, 'X', [0, 1, 2, 3]);
  const pm = L.publicMini(m), cand = L.mmCandidates(pm);
  b = L.localBest(pm, 'O', cpuRng(), {}, HARD);
  assert.ok(L.mmValid(b.move)); assert.ok(cand.some(c => c.join() === b.move.join()), 'a guess that could be the code'); assert.equal(b.q, 1 / cand.length);
  // few left: the guess with the best chance of being first, from a position the test works out itself:
  // the candidates after two guesses, and the values of a one-step look-ahead (a wrong guess hands the
  // rest to the other side, who wins at once from a group of one)
  for (const g of L.mmAll()) { const r = mmMini([3, 1, 4, 0]); L.applyMove(r, 'X', [0, 1, 2, 3]); L.applyMove(r, 'O', g); const c = L.mmCandidates(L.publicMini(r)); if (c.length === 2) { const h = L.localBest(L.publicMini(r), 'X', cpuRng(), {}, HARD); assert.ok(c.some(x => x.join() === h.move.join()), 'two left: one of them'); assert.equal(h.q, 0.5); break; } }
  // against Normal (the best split: it hands the other side a nearly solved code), over 80 squares
  const r = raceOf('mastermind', 80);
  assert.ok(r.hard > r.normal, `Hard wins the race: ${r.hard} to ${r.normal}`);
  // a Hard guess never takes long without a clock (a fixed amount of work)
  const ms = [];
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); L.localBest(pm, 'O', cpuRng(), {}, HARD); ms.push(performance.now() - t0); }
  assert.ok(Math.min(...ms) < 60, `under 60 ms: ${ms.map(x => x.toFixed(1))}`);
  assert.ok(r.ms < 200, `never slow in the race (${r.ms.toFixed(1)} ms at worst)`);
  // Normal is untouched: the same minimax guess, the same rng draws
  const n1 = L.localBest(pm, 'O', cpuRng(), {}, { level: 'normal', until: null }), n2 = L.localBest(pm, 'O', cpuRng());
  assert.deepEqual(n1, n2); assert.deepEqual(n1.move, L.mmBestGuess(cand));
});

// ============================== Race mode (core/race.js) ==============================
// The same code for both, each player's guesses and markers their own (mini.side[p]); the other side sees each
// row's markers alone, never the pegs.
const raceOn = on => E.setTune('mastermind', on ? { mode: 'race' } : null);
const raceMini = (rng = lcg(3)) => { raceOn(true); try { return L.newMini('mastermind', rng); } finally { raceOn(false); } };
const wrongOf = code => { const g = code.slice(); [g[0], g[1]] = [g[1], g[0]]; return g; };   // two pegs swapped: 2 solid, 2 hollow

test('mm race: dealt by the admin setting with guesses each, the same code; two people on one phone play Shared', () => {
  const m = raceMini();
  assert.equal(m.race, true); assert.equal(m.guesses, undefined);
  assert.deepEqual(m.side, { X: { guesses: [] }, O: { guesses: [] } }); assert.ok(E.mmValid(m.code));
  assert.deepEqual(m.tune, { mode: 'race' });
  raceOn(true);
  try {
    assert.equal(L.newMini('mastermind', lcg(3), { shared: true }).race, undefined, 'Same phone: Shared');
    assert.ok(E.newMatch(lcg(5), { games: ['mastermind'], vs: 'same' }).squares.every(q => !q.mini.race));
    assert.ok(E.newMatch(lcg(5), { games: ['mastermind'], vs: 'cpu' }).squares.every(q => q.mini.race));
  } finally { raceOn(false); }
  assert.equal(L.newMini('mastermind', lcg(3)).race, undefined, 'off: as ever');
});

test('mm race: each side\'s guesses are its own, judged against the one code; the exact code wins for its guesser alone', () => {
  const m = raceMini(lcg(8)), w = wrongOf(m.code);
  assert.deepEqual(L.applyMove(m, 'X', w), { ok: true, outcome: 'continue', note: 'guess' });
  assert.deepEqual(m.side.X.guesses, [{ by: 'X', code: w, solid: 2, hollow: 2 }]); assert.deepEqual(m.side.O.guesses, [], "O's part is untouched");
  assert.equal(L.applyMove(m, 'O', w).ok, true, 'the same guess is open to O'); assert.equal(m.side.O.guesses[0].solid, 2);
  assert.equal(m.side.X.guesses.length, 1);
  assert.equal(L.applyMove(m, 'X', [0, 0, 1, 2]).ok, false, 'no colour twice');
  const r = L.applyMove(m, 'O', m.code);
  assert.equal(r.outcome, 'win'); assert.equal(r.winner, undefined, "the cracker's"); assert.deepEqual(r.cells, [0, 1, 2, 3]);
  assert.equal(m.side.X.guesses.length, 1);
  assert.deepEqual(E.mmCandidates(E.publicMini(m, 'O'), 'O'), [m.code], "O's candidates from O's guesses alone");
  assert.ok(E.mmCandidates(E.publicMini(m, 'X'), 'X').length > 1, "X's from X's");
});

test('mm race: the public view shows each row\'s markers and one side\'s own guesses alone; the record keeps each side\'s part for that side', () => {
  const m = raceMini(lcg(13)), w = wrongOf(m.code), w2 = [m.code[1], m.code[2], m.code[3], m.code[0]];
  L.applyMove(m, 'X', w); L.applyMove(m, 'X', w2); L.applyMove(m, 'O', w2);
  const pub = E.publicMini(m);
  assert.equal(pub.code, undefined); assert.equal(pub.guesses, undefined); assert.deepEqual(pub.side, {});
  assert.deepEqual(pub.shape.X, { n: 2, rows: [[2, 2], [0, 4]] }); assert.deepEqual(pub.shape.O, { n: 1, rows: [[0, 4]] });
  const forX = E.publicMini(m, 'X');
  assert.deepEqual(Object.keys(forX.side), ['X']); assert.equal(forX.side.X.guesses.length, 2); assert.equal(forX.side.O, undefined);
  assert.equal(forX.code, undefined, 'the code itself is hidden'); assert.equal(JSON.stringify(forX).includes(JSON.stringify(w2)) && JSON.stringify(forX.side.X).includes(JSON.stringify(w2)), true, 'the guessed pegs are in X\'s own part alone');
  raceOn(true);
  try {
    const st = E.newMatch(lcg(11), { games: ['mastermind', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'] }); const k = st.squares.findIndex(q => q.mini.type === 'mastermind');
    st.squares[k].mini = m; st.id = 'r1'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), ps = rec.state.squares[k].mini;
    assert.equal(ps.side, undefined); assert.equal(ps.code, undefined); assert.equal(ps.guesses, undefined);
    assert.deepEqual(ps.shape.X.rows, [[2, 2], [0, 4]]);
    assert.deepEqual(rec.sides.X[k], m.side.X); assert.deepEqual(rec.sides.O[k], m.side.O); assert.deepEqual(rec.secrets[k], { code: m.code });
    assert.equal(JSON.stringify(rec.state).includes(JSON.stringify(w)), false, 'no guessed pegs in the public state');
    const full = E.fullState(rec);
    assert.deepEqual(full.squares[k].mini.side, m.side); assert.deepEqual(full.squares[k].mini.code, m.code); assert.equal(full.squares[k].mini.shape, undefined);
    const back = E.parseMatch(E.packMatch(rec));
    assert.deepEqual(E.fullState(back).squares[k].mini.side, m.side);
    const oneSide = E.fullState({ state: rec.state, secrets: rec.secrets, sides: { O: rec.sides.O } });
    assert.equal(oneSide.squares[k].mini.side.X, undefined); assert.deepEqual(oneSide.squares[k].mini.side.O, m.side.O);
  } finally { raceOn(false); }
});

test('mm race: an online guess\'s entry is redacted for the other phone (no pegs, no inputs), its markers alone; the mover\'s own part reaches their side', () => {
  raceOn(true);
  try {
    const st = E.newMatch(lcg(21), { games: ['mastermind', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'] }); const k = st.squares.findIndex(q => q.mini.type === 'mastermind'); st.id = 'r2'; st.seq = 0; st.recent = [];
    const rec = E.matchRecord(st), code = rec.secrets[k].code, w = wrongOf(code);
    const r = E.applyOnlineMove(rec, 'X', k, w, lcg(2), { rep: w.map((c, i) => [i * 300, 'mmcol', 'c=' + c]).concat([[1500, 'move', 'm=' + JSON.stringify(w)]]) });
    assert.ok(r.ok);
    const e = r.entries[0];
    assert.equal(e.m, undefined, 'the pegs are not on the entry'); assert.equal(e.code, undefined); assert.equal(e.rep, undefined, 'the inputs are not on the entry'); assert.equal(e.solid, undefined); assert.equal(e.hollow, undefined); assert.equal(e.note, undefined);
    assert.deepEqual(e.race, { by: 'X', solid: 2, hollow: 2, n: 1, rows: [[2, 2]] });
    assert.equal(e.after.mini.side, undefined); assert.deepEqual(e.after.mini.shape.X.rows, [[2, 2]]);
    assert.ok(!JSON.stringify(r.rec.state).includes(JSON.stringify(w)), 'the pegs are nowhere in the public state');
    assert.deepEqual(r.rec.sides.X[k].guesses[0].code, w, "the mover's own part holds them"); assert.deepEqual(r.rec.sides.O[k].guesses, []);
    const r2 = E.applyOnlineMove(r.rec, 'O', k, code, lcg(3));
    assert.ok(r2.ok); assert.equal(r2.entries[0].kind, 'claim'); assert.equal(r2.entries[0].winner, 'O'); assert.deepEqual(r2.entries[0].race, { by: 'O', solid: 4, hollow: 0, n: 1, rows: [[4, 0]] });
    raceOn(false);
    const st2 = E.newMatch(lcg(21), { games: ['mastermind', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'] }); const k2 = st2.squares.findIndex(q => q.mini.type === 'mastermind'); st2.id = 'r3'; st2.seq = 0; st2.recent = [];
    const e2 = E.applyOnlineMove(E.matchRecord(st2), 'X', k2, [0, 1, 2, 3], lcg(2), { rep: [[0, 'move', 'm=[0,1,2,3]']] }).entries[0];
    assert.deepEqual(e2.m, [0, 1, 2, 3]); assert.ok(e2.rep); assert.equal(e2.race, undefined, 'a shared square\'s entry is as ever');
  } finally { raceOn(false); }
});

test('mm race: the computer cracks the code from its own guesses alone at every level, within 6 guesses; the other side\'s needs come from its markers', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    let total = 0;
    for (let s = 1; s <= 8; s++) {
      const m = raceMini(lcg(200 + s)), rng = lcg(7 + s);
      let done = false, n = 0;
      const t0 = Date.now();
      while (!done && n < 10) {
        const pm = E.publicMini(m, 'O');
        assert.equal(pm.side.X, undefined, "the computer never sees X's part");
        const mv = E.aiOf('mastermind').best(pm, 'O', rng, 'steady', { level, until: level === 'hard' && s % 2 ? (() => 60) : null }).move;
        const r = L.applyMove(m, 'O', mv, rng);
        assert.ok(r.ok, `${level}: guess ${JSON.stringify(mv)} refused (${r.reason})`);
        n++; done = r.outcome === 'win';
      }
      assert.ok(done && n <= 6, `${level}: cracked in ${n}`); total += n;
      assert.ok(Date.now() - t0 < 4000, `${level}: in time`);
      assert.deepEqual(m.side.X.guesses, [], "X's part untouched");
    }
    assert.ok(total / 8 <= 5, `${level}: about ${(total / 8).toFixed(1)} guesses`);
  }
  const m = raceMini(lcg(44)), ai = E.aiOf('mastermind');
  const n0 = ai.needs(E.publicMini(m, 'O'), 'X');
  L.applyMove(m, 'X', wrongOf(m.code));
  const n1 = ai.needs(E.publicMini(m, 'O'), 'X');
  assert.ok(n1 < n0 && n1 >= 1, `2 solid 2 hollow brings X closer (${n0.toFixed(2)} -> ${n1.toFixed(2)})`);
  L.applyMove(m, 'O', [0, 1, 2, 3]);
  const pmO = E.publicMini(m, 'O'); assert.deepEqual(Object.keys(pmO.side), ['O']);
  assert.equal(ai.needs(pmO, 'O'), ai.needs({ type: 'mastermind', tune: m.tune, guesses: m.side.O.guesses }), "the computer's own needs from its own guesses, as Shared would count them");
});
