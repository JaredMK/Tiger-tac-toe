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

// ================================ Race mode (core/race.js, rv 2) ================================
// The same deck for both, each player their own shuffle of it (mini.tg, the square's secret, never the same layout), and
// their own flips (mini.side[p]: the cards turned and their faces, open to both); no flip limit; the first card picked
// rides the public state as `up` (the picker's layout's card), as Shared's pick does.
const memRace = on => E.setTune('memory', on ? { mode: 'race' } : null);
const R = s => E.makeRng(s);
const key = c => c.s + '/' + c.c;
const pairIn = cards => { const seen = new Map(); let pair = null; cards.forEach((c, i) => { const k = key(c); if (seen.has(k)) pair = [seen.get(k), i]; else seen.set(k, i); }); return pair; };
const twoOthers = cards => { const pr = pairIn(cards); for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) if (key(cards[a]) !== key(cards[b]) && !(pr.includes(a) && pr.includes(b))) return [a, b]; return null; };
test('memory, race: the same deck in two different layouts, one each; Same phone stays Shared', () => {
  for (const pairs of [1, 2, 3]) {
    E.setTune('memory', { mode: 'race', pairs });
    try {
      for (let k = 0; k < 60; k++) {
        const m = E.newMini('memory', R(`mr${pairs}:${k}`));
        assert.equal(m.race, true); assert.equal(m.rv, 2); assert.equal(m.cards, undefined); assert.equal(m.seen, undefined);
        assert.deepEqual(m.tg.X.map(key).sort(), m.tg.O.map(key).sort(), 'the same deck');
        assert.ok(m.tg.X.some((c, i) => key(c) !== key(m.tg.O[i])), 'two different layouts');
        assert.equal(new Set(m.tg.X.map(key)).size, 9 - pairs, `${pairs} pairs`);
        for (const p of ['X', 'O']) assert.deepEqual(m.side[p], { flips: 0, seen: [], faces: new Array(9).fill(null), last: null });
      }
    } finally { memRace(false); }
  }
  memRace(true);
  try {
    assert.equal(E.newMini('memory', R('s'), { shared: true }).race, undefined);
    assert.ok(E.newMatch(R('s'), { games: ['memory'], vs: 'same' }).squares.every(q => !q.mini.race));
  } finally { memRace(false); }
  assert.equal(E.newMini('memory', R('s')).race, undefined, 'off: as ever');
});
test('memory, race: a flip turns the mover\'s own cards alone, from their own layout; their pair wins; no flip limit', () => {
  memRace(true);
  try {
    const m = E.newMini('memory', R('mr-move')), [a, b] = twoOthers(m.tg.X);
    assert.deepEqual(E.applyMove(m, 'X', [a, b], R('a')), { ok: true, outcome: 'continue', note: 'nomatch' });
    assert.equal(m.side.X.flips, 1); assert.deepEqual(m.side.X.seen, [a, b]); assert.deepEqual(m.side.X.faces[a], m.tg.X[a]); assert.deepEqual(m.side.X.faces[b], m.tg.X[b]);
    assert.deepEqual(m.side.O, { flips: 0, seen: [], faces: new Array(9).fill(null), last: null }, "O's cards untouched");
    const po = pairIn(m.tg.O);
    assert.deepEqual(E.applyMove(m, 'O', po, R('b')), { ok: true, outcome: 'win', cells: po }, "O's pair in O's layout wins");
    assert.deepEqual(m.side.O.faces[po[0]], m.tg.O[po[0]]);
    // no limit: X flips the same two non-matching cards 30 times, then its pair
    const w = E.newMini('memory', R('mr-long')), two = twoOthers(w.tg.X);
    for (let k = 0; k < 30; k++) assert.equal(E.applyMove(w, 'X', two, R('c')).outcome, 'continue');
    assert.equal(E.applyMove(w, 'X', pairIn(w.tg.X), R('d')).outcome, 'win'); assert.equal(w.side.X.flips, 31);
    const noT = JSON.parse(JSON.stringify(m)); delete noT.tg;
    assert.equal(E.applyMove(noT, 'X', [a, b], R('e')).reason, 'secret');
  } finally { memRace(false); }
});
test('memory, race: the record and the computer\'s view never carry a layout; the cards turned are open; the first card picked shows for both as `up`; a claimed square shows both layouts', () => {
  memRace(true);
  try {
    const st = E.newMatch(R('mr-rec'), { games: ['memory'] }); st.id = 'mr1'; st.seq = 0; st.recent = []; st.turn = 'X';
    const m = st.squares[0].mini, [a, b] = twoOthers(m.tg.O);
    E.applyMove(m, 'O', [a, b], R('a'));
    const rec = E.matchRecord(st), ps = rec.state.squares[0].mini;
    assert.ok(!/"tg"|"cards"/.test(JSON.stringify(rec.state)), 'no layout in the public state');
    assert.deepEqual(rec.secrets[0].tg, m.tg); assert.deepEqual(ps.side, m.side, "both players' flips and faces open");
    const faces = JSON.stringify(rec.state).match(/"s":/g) || [];
    assert.equal(faces.length, 2, "only O's two turned faces show");
    for (const p of ['X', 'O']) { const pm = E.publicMini(m, p); assert.ok(!/"tg"|"cards"/.test(JSON.stringify(pm))); assert.deepEqual(pm.side, m.side); }
    assert.deepEqual(E.fullState(rec).squares[0].mini.tg, m.tg);
    // X picks a first card: it turns up for both, X's layout's card, nothing else of either layout
    const [xa, xb] = twoOthers(m.tg.X);
    const p1 = E.applyOnlinePick(rec, 'X', 0, xa);
    assert.ok(p1.ok); assert.equal(p1.rec.state.pick, xa);
    assert.deepEqual(p1.rec.state.squares[0].mini.up, Object.assign({ i: xa }, m.tg.X[xa]), 'the picked card: X\'s own');
    assert.ok(!/"tg"|"cards"/.test(JSON.stringify(p1.rec.state)));
    assert.deepEqual(p1.rec.state.squares[0].mini.side, m.side, 'no part changed by a pick');
    const r = E.applyOnlineMove(p1.rec, 'X', 0, [xa, xb], R('b'), { rep: [[0, 'pick', 'i=' + xa], [600, 'pick', 'i=' + xb]] });
    assert.ok(r.ok, r.reason);
    const e = r.entries[0];
    assert.deepEqual(e.reveal, [xa, xb], 'the two cards ride the entry: they are open'); assert.ok(!/"tg"/.test(JSON.stringify(e)));
    assert.deepEqual(e.after.mini.side.X.faces[xb], m.tg.X[xb]);
    assert.equal(r.rec.state.pick, null); assert.equal(r.rec.state.squares[0].mini.up, undefined, 'the pick gone with the move');
    const win = E.applyOnlineMove(E.applyOnlineMove(r.rec, 'O', 0, [a, b], R('c')).rec, 'X', 0, pairIn(m.tg.X), R('d'));
    assert.ok(win.ok); assert.equal(win.rec.state.squares[0].owner, 'X'); assert.deepEqual(win.rec.state.squares[0].mini.tg, m.tg, 'claimed: both layouts shown');
  } finally { memRace(false); }
});
test('memory, race: the computer flips its own layout from its own cards alone and finds its pair at every level; Hard no slower than Normal', () => {
  memRace(true);
  try {
    for (const level of ['easy', 'normal', 'hard']) {
      for (let g = 0; g < 6; g++) {
        const st = E.newMatch(R(`mc-${level}-${g}`), { games: ['memory'], vs: 'cpu' }); st.only = 0; st.cpuLevel = level;
        const m = st.squares[0].mini; let n = 0;
        while (!st.squares[0].owner && n < 60) {
          st.turn = 'O'; st.flash = null; st.done = null; st.lock = null; st.spot = null;
          const mv = E.cpuMove(st, R(`mm-${level}-${g}-${n}`), null, { level, clock: () => 0, budget: 1e9 });
          assert.ok(E.playMove(st, 0, mv.move, R('p')).ok); n++;
        }
        assert.equal(st.squares[0].owner, 'O', `${level}: found its own pair`); assert.equal(m.side.X.flips, 0);
      }
    }
    const avg = { normal: 0, hard: 0 }, N = 300;
    for (const level of ['normal', 'hard']) for (let g = 0; g < N; g++) {
      const rng = R('ms' + g), m = E.newMini('memory', rng); let n = 0, r;
      do {
        const pm = E.publicMini(m, 'X'), b = E.localBest(pm, 'X', rng, {}, level === 'hard' ? { level: 'hard', until: null } : {});
        assert.equal(b.shared, false); if (n === 0) assert.ok(b.move.every(k => !pm.side.X.seen.includes(k)), 'nothing seen: two unseen cards');
        r = E.applyMove(m, 'X', b.move, rng); n++;
      } while (r.outcome !== 'win' && n < 30);
      avg[level] += n / N;
    }
    assert.ok(avg.hard <= avg.normal + 0.1 && avg.hard < 5, `flips on average: Hard ${avg.hard.toFixed(2)}, Normal ${avg.normal.toFixed(2)}`);
    const m = E.newMini('memory', R('mn'));
    assert.equal(E.aiOf('memory').needs(E.publicMini(m, 'O'), 'X'), 5.5, 'nothing flipped');
    E.applyMove(m, 'X', twoOthers(m.tg.X), R('a'));
    assert.equal(E.aiOf('memory').needs(E.publicMini(m, 'O'), 'X'), 4.5, "the other side's needs, from its own open flips");
  } finally { memRace(false); }
});
