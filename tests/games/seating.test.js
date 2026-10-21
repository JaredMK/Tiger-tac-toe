'use strict';
// Seating: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Seating ===================================== */
test('seating: ten tables for two, seats in four colours; a seat, then the customer sits in a seat of their colour, or leaves when none is free; the next colour is always one with a free seat', () => {
  const m = E.newMini('seating', lcg(1));
  assert.equal(m.color.length, 20); assert.ok(m.color.every(c => c >= 0 && c < 4)); assert.ok(m.color.includes(m.next), 'the next customer\'s colour, shown: one with a seat');
  let left = 0;
  for (let k = 0; k < 400; k++) {
    const s = E.newMini('seating', lcg(k)), want = s.next, rng = lcg(k + 1);
    // play a few seats in, then check one move
    for (let j = 0; j < k % 7 && s.who.includes(null); j++) E.applyMove(s, j % 2 ? 'O' : 'X', s.who.indexOf(null), rng);
    if (!s.who.includes(null)) continue;
    const before = s.next, seat = s.who.indexOf(null), freeOfColour = s.who.filter((w, i) => !w && i !== seat && s.color[i] === before).length;
    E.applyMove(s, 'X', seat, rng);
    assert.equal(s.last.zColor, before);
    if (freeOfColour) { assert.equal(s.who[s.last.z], 'Z'); assert.equal(s.color[s.last.z], before, 'the customer takes a seat of their colour'); assert.equal(s.last.left, false); }
    else { assert.equal(s.last.z, null); assert.equal(s.last.left, true, 'none of their colour: they leave'); left++; }
    if (s.who.includes(null)) assert.ok(s.who.some((w, i) => !w && s.color[i] === s.next), 'the next colour has a free seat');
    void want;
  }
  // the move takes the last seat of the next customer's colour: they walk out, nobody sits
  const deny = E.newMini('seating', lcg(3)); deny.color = new Array(20).fill(0); deny.color[5] = 2; deny.next = 2;
  const empties = deny.who.filter(w => !w).length;
  E.applyMove(deny, 'X', 5, lcg(4));
  assert.deepEqual([deny.last.left, deny.last.z, deny.who.filter(w => !w).length, deny.who.includes('Z')], [true, null, empties - 1, false]);
  assert.equal(deny.next, 0, 'the next customer: a colour with a seat (only 0 is left)');
  for (const bad of [-1, 20, 'a', 0.5]) assert.equal(E.applyMove(E.newMini('seating', lcg(5)), 'X', bad).ok, false);
  const taken = E.newMini('seating', lcg(6)); E.applyMove(taken, 'X', 3, lcg(7));
  assert.equal(E.applyMove(taken, 'O', 3).ok, false, 'a taken seat');
  // the flash carries it and the move's time includes the walk
  const st = E.newMatch(lcg(8), { games: ['seating'] }); const sm = st.squares[0].mini; sm.color = new Array(20).fill(1); sm.color[7] = 3; sm.next = 3;
  E.playMove(st, 0, 7, lcg(9));
  assert.equal(st.flash.seat.left, true); assert.equal(E.playMs(st.flash), E.PLACE_MS.mark + E.PLACE_MS.walk + E.PLACE_MS.hold);
});

test('seating: both seats of a table make it yours; five tables wins at once; a full room goes to most tables, and a tie resets the square', () => {
  const m = E.newMini('seating', lcg(1));
  m.who = ['X', null, 'X', 'X', 'X', 'X', 'X', 'X', 'Z', 'Z', 'O', 'O', null, null, null, null, null, null, null, null];
  assert.equal(E.seatTables(m.who, 'X'), 3); assert.equal(E.seatTables(m.who, 'O'), 1);
  const r = E.applyMove(m, 'X', 1, lcg(2));
  assert.deepEqual([r.outcome, E.seatTables(m.who, 'X'), m.last.table], ['continue', 4, 0]);
  m.who[12] = 'X'; m.who[13] = null; m.next = m.color[14] = 1; m.color.fill(1);
  assert.equal(E.applyMove(m, 'X', 13, lcg(3)).outcome, 'win', 'five tables: the square');
  const full = E.newMini('seating', lcg(4));
  full.who = ['X', 'X', 'O', 'O', 'X', 'X', 'Z', 'O', 'Z', 'X', 'O', 'Z', 'X', 'Z', 'O', 'Z', 'X', 'Z', 'X', null];
  const f = E.applyMove(full, 'O', 19, lcg(5));
  assert.deepEqual([f.outcome, f.winner, f.counts.X, f.counts.O], ['win', 'X', 2, 1], 'the last seat: most tables');
  assert.equal(full.last.z, null, 'no customer when the room is full');
  const tie = E.newMini('seating', lcg(6));
  tie.who = ['X', 'X', 'O', 'O', 'X', 'X', 'Z', 'O', 'Z', 'X', 'O', 'Z', 'X', 'Z', 'O', 'Z', 'X', 'Z', 'O', null];
  assert.deepEqual(E.applyMove(tie, 'O', 19, lcg(7)), { ok: true, outcome: 'draw', note: 'tie' }, 'a tie resets the square');
  const st = E.newMatch(lcg(8), { games: ['seating', 'ttt'] });
  const i = st.squares.findIndex(q => q.mini.type === 'seating');
  st.squares[i].mini = tie; tie.who[19] = null; st.turn = 'O';
  E.playMove(st, i, 19, lcg(9));
  assert.equal(st.flash.kind, 'draw'); assert.equal(st.flash.note, 'tie'); assert.ok(st.squares[i].mini.type, 'a new game in the square');
});

test('seating: the computer completes its own half-table, then blocks the other player\'s, then starts a table whose other seat is not the next customer\'s colour', () => {
  const pm = { type: 'seating', color: new Array(20).fill(0), who: new Array(20).fill(null), next: 0 };
  pm.who[4] = 'O'; pm.who[8] = 'X';
  assert.equal(E.seatPick(pm, 'X', lcg(1)).move, 9, 'its own half-table first');
  pm.who[8] = null;
  assert.equal(E.seatPick(pm, 'X', lcg(1)).move, 5, 'then blocks the other player\'s');
  pm.who[4] = null; pm.color = new Array(20).fill(0); pm.color[15] = 3; pm.next = 0;
  assert.equal(E.seatPick(pm, 'X', lcg(1)).move, 14, 'a fresh table whose other seat the next customer will not take');
});

/* ---------- the admin's Mini-game Settings ---------- */
function tunedPlay(t, seed, guard = 400) {                        // (the computer on both sides of square 4 until it is decided)
  const st = E.newMatch(lcg(seed), { games: Object.fromEntries(E.TYPES.map(g => [g, g === t])) }), rr = lcg(seed + 7);
  let n = 0, kind = null;
  while (n < guard) {
    st.lock = 4;
    const m = E.cpuMove(st, rr), r = E.playMove(st, 4, m.move, rr);
    assert.equal(r.ok, true, `${t}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    n++; kind = st.flash.kind; E.endFlash(st); st.lock = null;
    if (kind !== 'move' && kind !== 'again') break;
  }
  assert.ok(n < guard, `${t}: the square is decided`);
  return st;
}
test('seating: the admin\'s settings: six tables, two colours, three tables to win and mistakes deal a square that plays by them', () => {
  E.setTune('seating', { tables: 6, colors: 2, goal: 3, miss: 20 });
  try {
    const m = E.newMini('seating', lcg(1));
    assert.equal(m.who.length, 12); assert.ok(m.color.every(c => c < 2));
    m.who = ['X', 'X', 'X', 'X', null, null, null, null, null, null, null, null]; m.color = m.color.map(() => 0); m.next = 0;
    m.color[5] = 1;
    const r = E.applyMove(m, 'X', 4, lcg(3));
    assert.ok(r.outcome === 'win' || m.who[5] !== 'X', 'three tables would win at once');
    tunedPlay('seating', 7);
  } finally { E.setTune('seating', null); }
  assert.equal(E.newMini('seating', lcg(1)).who.length, 20);
});

/* ---------- the Hard computer ---------- */
test('seating: Hard counts the customer: it leaves a half-table the customer is sure to spoil and starts its own (Normal blocks it), completes a fifth table, plays a legal seat, under 60 ms', () => {
  const hard = { level: 'hard', until: null };
  // O's half at table 2 (seat 4), its other seat (5) the only one of the next customer's colour: the customer takes it
  const pm = { type: 'seating', color: new Array(20).fill(0), who: new Array(20).fill(null), next: 3 };
  pm.color[5] = 3; pm.who[4] = 'O';
  assert.equal(E.seatPick(pm, 'X', lcg(1)).move, 5, 'Normal blocks');
  const b = E.localBest(pm, 'X', lcg(1), {}, hard);
  assert.notEqual(b.move, 5, 'Hard: ' + b.move);
  assert.ok(!pm.who[b.move] && !pm.who[E.seatMate(b.move)], 'a fresh table');
  // its fifth table at once
  const win = { type: 'seating', color: new Array(20).fill(1), who: ['X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', null, 'O', 'O', 'Z', 'Z', null, null, null, null, null, null], next: 1 };
  const w = E.localBest(win, 'X', lcg(1), {}, hard);
  assert.deepEqual([w.move, w.win], [9, true]);
  const times = [];
  for (let g = 0; g < 10; g++) {
    const q = E.newMini('seating', lcg(30 + g)), rng = lcg(50 + g);
    let p = 'X';
    for (let k = 0; k < g % 8 && q.who.includes(null); k++) { E.applyMove(q, p, q.who.indexOf(null), rng); p = E.other(p); }
    const t0 = performance.now(), r = E.localBest(E.publicMini(q), p, rng, {}, hard);
    times.push(performance.now() - t0);
    assert.equal(q.who[r.move], null, 'a legal seat');
    assert.equal(E.applyMove(q, p, r.move, rng).ok, true);
  }
  assert.ok(Math.max(...times.slice(1)) < 60, 'ms: ' + times.map(t => t.toFixed(1)).join(' '));
});
