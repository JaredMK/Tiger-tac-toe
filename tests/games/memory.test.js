'use strict';
// Find the Pair: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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
// make one full turn as the UI does: the move, then the result overlay clearing, which (unless the
// same player goes again or the match is over) brings the board back and passes the turn
function turn(st, i, m, rng) {
  const r = L.playMove(st, i, m, rng || lcg(99));
  assert.equal(r.ok, true, `move ${JSON.stringify(m)} in square ${i} should be accepted (${r.reason})`);
  const flash = st.flash;
  L.endFlash(st);
  return flash;
}
const sorted = a => a.slice().sort((x, y) => x - y);
const mini = (type, rng) => L.newMini(type, rng || lcg(11));

// ================================== Find the Pair ==================================
function pairOf(cards) {
  const seen = new Map();
  let pair = null;
  cards.forEach((c, i) => { const k = c.s + '/' + c.c; if (seen.has(k)) pair = [seen.get(k), i]; else seen.set(k, i); });
  return pair;
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

test('memory: nine cards, exactly one matching pair, every other card different', () => {
  const rng = lcg(5);
  for (let k = 0; k < 200; k++) {
    const cards = L.memoryDeck(rng);
    assert.equal(cards.length, 9);
    const keys = cards.map(c => c.s + '/' + c.c);
    assert.equal(new Set(keys).size, 8, 'eight distinct combinations');
    for (const c of cards) { assert.ok(L.MEMORY.shapes.includes(c.s)); assert.ok(L.MEMORY.colors.includes(c.c)); }
    assert.ok(pairOf(cards), 'a pair exists');
  }
});

test('memory: flipping two different face-down cards is a move; the pair wins', () => {
  const m = mini('memory');
  const [a, b] = pairOf(m.cards);
  for (const bad of [[a, a], [a], [a, b, 0], [a, 9], [-1, b], 'ab', null]) assert.equal(L.applyMove(m, 'X', bad).ok, false, JSON.stringify(bad));
  const others = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => i !== a && i !== b);
  assert.deepEqual(L.applyMove(m, 'X', [others[0], others[1]]), { ok: true, outcome: 'continue', note: 'nomatch' });
  assert.deepEqual(L.applyMove(m, 'X', [others[0], a]), { ok: true, outcome: 'continue', note: 'nomatch' });
  assert.equal(m.flips, 2);
  assert.deepEqual(m.last, { by: 'X', a: others[0], b: a });
  const r = L.applyMove(m, 'X', [b, a]);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), sorted([a, b]));
});

test('memory: the first pick is cleared after a move and a player may keep flipping on later turns', () => {
  const st = matchWith(['memory', 'ttt']);
  const [a, b] = pairOf(st.squares[0].mini.cards);
  const others = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => i !== a && i !== b);
  st.pick = others[0];
  const f = turn(st, 0, [others[0], others[1]]);
  assert.equal(f.kind, 'move');
  assert.deepEqual(f.reveal, [others[0], others[1]]);
  assert.equal(st.pick, null);
  turn(st, 1, 0);
  assert.equal(turn(st, 0, [a, b]).kind, 'claim');
  assert.equal(st.squares[0].owner, 'X');
});

test('memory tactics: a known pair is flipped, otherwise only unseen cards', () => {
  const m = mini('memory');
  const idx = new Map(); let pair = null;
  m.cards.forEach((c, i) => { const k = c.s + c.c; if (idx.has(k)) pair = [idx.get(k), i]; else idx.set(k, i); });
  const others = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !pair.includes(i));
  L.applyMove(m, 'O', [others[0], others[1]]);
  let mv = L.localBest(L.publicMini(m), 'X', cpuRng());
  assert.ok(mv.move.every(k => !m.seen.includes(k)), 'flips unseen cards');
  assert.ok(mv.q < 0.2);
  L.applyMove(m, 'O', [pair[0], others[2]]);
  L.applyMove(m, 'O', [pair[1], others[3]]);
  mv = L.localBest(L.publicMini(m), 'X', cpuRng());
  assert.deepEqual(mv.move.slice().sort(), pair.slice().sort(), 'remembers both cards of the pair');
  assert.equal(mv.q, 1);
  const st = cpuMatch('X', [m, 'ttt']);
  const cm = L.cpuMove(st, cpuRng());
  assert.equal(cm.square, 0, 'a sure claim beats a fresh square');
  assert.equal(L.playMove(st, 0, cm.move).flash.kind, 'claim');
});

test('memory: the admin\'s settings (pairs in the deck, the computer\'s memory) are dealt into the square and played by', () => {
  E.setTune('memory', { pairs: 3, mem: 0 });
  const m = E.newMini('memory', E.makeRng('mem-tune'));
  E.setTune('memory', null);
  assert.deepEqual(m.tune, { pairs: 3, mem: 0 });
  const key = c => c.s + c.c, count = {};
  for (const c of m.cards) count[key(c)] = (count[key(c)] || 0) + 1;
  assert.equal(m.cards.length, 9);
  assert.equal(Object.values(count).filter(n => n === 2).length, 3, 'three pairs');
  const a = m.cards.findIndex(c => count[key(c)] === 2), b = m.cards.findIndex((c, i) => i !== a && key(c) === key(m.cards[a]));
  m.seen = [a, b];
  const pm = E.publicMini(m);
  let other = 0;
  for (let k = 0; k < 20; k++) { const mv = E.localBest(pm, 'X', E.makeRng('mem-ai' + k)).move; if (!(mv.includes(a) && mv.includes(b))) other++; }
  assert.ok(other > 0, 'it forgets the pair it saw');
  delete m.tune;
  assert.deepEqual(E.localBest(E.publicMini(m), 'X', anyRng()).move.slice().sort(), [a, b].sort(), 'the default: it remembers');
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
test('memory, Hard: a known pair taken; else an unseen card beside a seen one (as likely its twin, one card less shown), two unseen with nothing seen; more squares than Normal', () => {
  const m = mini('memory', lcg(3));
  let b = L.localBest(L.publicMini(m), 'X', cpuRng(), {}, HARD);
  assert.equal(b.move.length, 2); assert.ok(!m.seen.includes(b.move[0]) && !m.seen.includes(b.move[1]), 'nothing seen: two unseen'); assert.equal(b.shared, true);
  // three cards seen, all different: one of them with an unseen card (Normal turns two unseen)
  L.applyMove(m, 'X', b.move);
  if (!pairOf([m.cards[b.move[0]], m.cards[b.move[1]]])) {
    const third = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(i => !m.seen.includes(i));
    L.applyMove(m, 'O', [third, m.seen[0]]);
    const pm = L.publicMini(m);
    if (!L.memoryPair(pm, pm.seen)) {
      assert.equal(pm.seen.length, 3);
      const h = L.localBest(pm, 'X', cpuRng(), {}, HARD), n = L.localBest(pm, 'X', cpuRng());
      assert.equal(h.move.filter(i => pm.seen.includes(i)).length, 1, 'one seen card, one unseen');
      assert.equal(n.move.filter(i => pm.seen.includes(i)).length, 0, 'Normal: two unseen');
      assert.ok(h.q > 0 && h.q < 1, 'a chance of the pair');
    }
  }
  // a known pair: taken
  const k = { type: 'memory', cards: L.memoryDeck(lcg(9), 1), flips: 0, seen: [], last: null };
  const pair = pairOf(k.cards);
  k.seen = pair.slice();
  b = L.localBest(L.publicMini(k), 'O', cpuRng(), {}, HARD);
  assert.deepEqual(b.move.slice().sort(), pair.slice().sort()); assert.equal(b.q, 1);
  const r = raceOf('memory', 200);
  assert.ok(r.hard >= r.normal - 10, `Hard holds its own in the race (${r.hard} to ${r.normal}: the choice differs only with no pair known, a small edge in a game of luck)`);
  assert.ok(r.ms < 60, `quick (${r.ms.toFixed(1)} ms at worst)`);
  const fresh = L.publicMini(mini('memory', lcg(5)));
  assert.deepEqual(L.localBest(fresh, 'X', cpuRng(), {}, { level: 'normal', until: null }), L.localBest(fresh, 'X', cpuRng()), 'Normal untouched');
});

// ================================ Race mode (core/race.js) ================================
// The same deck for both, but each player flips their own copy (mini.side[p]: the cards they have turned and their faces);
// the other side sees only their flips; online the record keeps each side's part apart and a move's entry is redacted.
const RLCG = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const memRace = on => E.setTune('memory', on ? { mode: 'race' } : null);
const pairIn = cards => { const seen = new Map(); let pair = null; cards.forEach((c, i) => { const k = c.s + '/' + c.c; if (seen.has(k)) pair = [seen.get(k), i]; else seen.set(k, i); }); return pair; };
const twoOthers = cards => { const pr = pairIn(cards); for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) if (!(pr.includes(a) && pr.includes(b))) return [a, b]; return null; };
test('memory, race: each side flips its own copy of the same deck; what you turn is yours alone; the pair wins for whoever finds it; Same phone stays Shared', () => {
  memRace(true);
  try {
    const m = E.newMini('memory', RLCG(3));
    assert.equal(m.race, true); assert.equal(m.seen, undefined); assert.equal(m.flips, undefined); assert.equal(m.cards.length, 9);
    assert.deepEqual(m.side.X, { flips: 0, seen: [], faces: new Array(9).fill(null), last: null }); assert.deepEqual(m.side.O, m.side.X);
    const [a, b] = twoOthers(m.cards), pr = pairIn(m.cards);
    assert.deepEqual(E.applyMove(m, 'X', [a, b], RLCG(1)), { ok: true, outcome: 'continue', note: 'nomatch' });
    assert.equal(m.side.X.flips, 1); assert.deepEqual(m.side.X.seen, [a, b]); assert.deepEqual(m.side.X.faces[a], m.cards[a]); assert.deepEqual(m.side.X.faces[b], m.cards[b]);
    assert.deepEqual(m.side.O.seen, [], "O has seen nothing of X's flip"); assert.equal(m.side.O.flips, 0);
    assert.equal(E.applyMove(m, 'O', [a, b], RLCG(1)).ok, true, 'the same two cards are O\'s to flip too');
    assert.deepEqual(E.applyMove(m, 'O', pr, RLCG(1)), { ok: true, outcome: 'win', cells: pr }, 'the same pair wins for O');
    assert.equal(m.side.O.flips, 2); assert.equal(m.side.X.flips, 1);
    const forX = E.publicMini(m, 'X');
    assert.equal(forX.cards, undefined, 'no deck in the view'); assert.deepEqual(Object.keys(forX.side), ['X']); assert.equal(forX.side.O, undefined);
    assert.deepEqual(forX.side.X.faces[a], m.cards[a]); assert.deepEqual(forX.shape, { X: { n: 1 }, O: { n: 2 } });
    assert.deepEqual(E.publicMini(m).side, {}); assert.deepEqual(E.raceView(m, null).side, {});
    assert.ok(!JSON.stringify(E.publicMini(m, 'O')).includes(JSON.stringify(m.side.X)), "X's faces are not in O's view");
    assert.equal(E.newMini('memory', RLCG(3), { shared: true }).race, undefined);
    assert.ok(E.newMatch(RLCG(5), { games: ['memory'], vs: 'same' }).squares.every(q => !q.mini.race));
  } finally { memRace(false); }
  assert.equal(E.newMini('memory', RLCG(3)).race, undefined, 'off: as ever');
});
test('memory, race: the record keeps each side\'s cards for that side, no deck and the shapes in the public state; an online flip\'s entry is redacted; the first card picked turns up for the picker alone', () => {
  memRace(true);
  try {
    const st = E.newMatch(RLCG(11), { games: ['memory'] }); st.id = 'mr1'; st.seq = 0; st.recent = []; st.turn = 'X';
    const m = st.squares[0].mini, [a, b] = twoOthers(m.cards);
    E.applyMove(m, 'O', [a, b], RLCG(1));
    const rec = E.matchRecord(st), ps = rec.state.squares[0].mini;
    assert.equal(ps.side, undefined); assert.ok(ps.cards.every(c => c === null), 'no card is known in the public state'); assert.equal(ps.seen, undefined);
    assert.deepEqual(ps.shape, { X: { n: 0 }, O: { n: 1 } });
    assert.deepEqual(rec.sides.O[0].seen, [a, b]); assert.deepEqual(rec.sides.O[0].faces[a], m.cards[a]); assert.deepEqual(rec.sides.X[0].seen, []);
    assert.ok(!JSON.stringify(rec.state).includes('"s":'), 'no face in the public state');
    const full = E.fullState(rec);
    assert.deepEqual(full.squares[0].mini.side, m.side); assert.deepEqual(full.squares[0].mini.cards, m.cards); assert.equal(full.squares[0].mini.shape, undefined);
    assert.deepEqual(E.fullState(E.parseMatch(E.packMatch(rec))).squares[0].mini.side, m.side);
    // X picks a first card (kind pick): it turns up for X alone (its face in X's side), then X's two cards go in as one move
    const p1 = E.applyOnlinePick(rec, 'X', 0, a);
    assert.ok(p1.ok); assert.equal(p1.rec.state.pick, a); assert.equal(p1.rec.state.pickSq, 0);
    assert.equal(p1.rec.state.squares[0].mini.cards[a], null, 'the picked card shows nothing in the public state (a race)');
    assert.deepEqual(p1.rec.sides.X[0].faces[a], m.cards[a], 'its face is in the picker\'s own side'); assert.deepEqual(p1.rec.sides.O[0], rec.sides.O[0], 'the other side\'s part is untouched');
    assert.ok(!JSON.stringify(p1.rec.state).includes('"s":'), 'no face in the public state while picked');
    const r = E.applyOnlineMove(p1.rec, 'X', 0, [a, b], RLCG(2), { rep: [[0, 'pick', 'i=' + a], [600, 'pick', 'i=' + b]] });
    assert.ok(r.ok, r.reason);
    const e = r.entries[0];
    assert.equal(e.m, undefined); assert.equal(e.reveal, undefined, 'no cards on the entry'); assert.equal(e.note, undefined); assert.equal(e.rep, undefined);
    assert.deepEqual(e.race, { by: 'X', n: 1 });
    assert.equal(e.after.mini.side, undefined); assert.deepEqual(e.after.mini.shape, { X: { n: 1 }, O: { n: 1 } });
    assert.equal(r.rec.state.pick, null, 'the pick is cleared by the move'); assert.ok(r.rec.state.squares[0].mini.cards.every(c => c === null), 'nothing shows once the move is in');
    assert.deepEqual(r.rec.sides.X[0].seen, [a, b]); assert.deepEqual(r.rec.sides.X[0].faces[b], m.cards[b], "the mover's own part holds the faces");
    assert.deepEqual(r.rec.sides.O[0].seen, [a, b], "O's part as it was");
    // a shared square's entry is as ever
    memRace(false);
    const st2 = E.newMatch(RLCG(11), { games: ['memory'] }); st2.id = 'mr2'; st2.seq = 0; st2.recent = []; st2.turn = 'X';
    const e2 = E.applyOnlineMove(E.matchRecord(st2), 'X', 0, [a, b], RLCG(2), { rep: [[0, 'pick', 'i=' + a]] }).entries[0];
    assert.deepEqual(e2.m, [a, b]); assert.ok(e2.rep); assert.equal(e2.race, undefined); assert.deepEqual(e2.reveal, [a, b]);
  } finally { memRace(false); }
});
test('memory, race: the computer flips from its own part alone and finds the pair (Normal and Hard); its first flips are two unseen cards', () => {
  memRace(true);
  try {
    for (const hard of [false, true]) {
      let total = 0;
      for (let g = 0; g < 30; g++) {
        const rng = RLCG(800 + g), m = E.newMini('memory', rng);
        E.applyMove(m, 'X', twoOthers(m.cards), rng);                 // the other side has flipped: nothing of it reaches the computer
        let n = 0, r;
        do {
          const pm = E.publicMini(m, 'O');
          assert.equal(pm.side.X, undefined, "never X's part"); assert.equal(pm.shape.X.n, 1);
          const b = E.localBest(pm, 'O', rng, {}, hard ? { level: 'hard', until: null } : {});
          assert.equal(b.shared, false);
          if (n === 0) assert.ok(b.move.every(k => !pm.side.O.seen.includes(k)), 'nothing seen: two unseen cards');
          r = E.applyMove(m, 'O', b.move, rng); assert.ok(r.ok, JSON.stringify(b.move)); n++;
        } while (r.outcome !== 'win' && n < 20);
        assert.equal(r.outcome, 'win'); total += n;
        assert.equal(m.side.X.flips, 1, "X's part as it was");
      }
      assert.ok(total / 30 < 6.5, `${hard ? 'Hard' : 'Normal'}: the pair in ${(total / 30).toFixed(1)} flips on average`);
    }
    const m = E.newMini('memory', RLCG(9)), pm = E.publicMini(m, 'O');
    assert.equal(E.aiOf('memory').needs(pm, 'X'), 5.5, 'the other side, nothing flipped: a fresh estimate');
    E.applyMove(m, 'X', twoOthers(m.cards), RLCG(1)); E.applyMove(m, 'X', twoOthers(m.cards), RLCG(1));
    assert.equal(E.aiOf('memory').needs(E.publicMini(m, 'O'), 'X'), 3.5, "the other side's needs, from its flips");
  } finally { memRace(false); }
});
