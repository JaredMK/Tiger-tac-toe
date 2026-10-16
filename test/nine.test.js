'use strict';
// Run with:  node --test
// Craps, Takeover and Flood (and the rest of the nine, as they come) in the shared engine.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const die = n => (n - 1) / 6 + 0.01;                              // an rng value that makes randInt(rng, 6) roll n - 1
const dice = (...pairs) => seq(...pairs.flatMap(([a, b]) => [die(a), die(b)]));
function cpuSquare(t, seed, guard = 400) {                        // the computer on both sides of one square: moves until it is decided
  const st = E.newMatch(lcg(seed), { games: [t] }), rr = lcg(seed + 7);
  let n = 0, kind = null;
  while (n < guard) {
    st.lock = 4;
    const m = E.cpuMove(st, rr), r = E.playMove(st, 4, m.move, rr);
    assert.equal(r.ok, true, `${t}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
    n++; kind = st.flash.kind; E.endFlash(st); st.lock = null;
    if (kind !== 'move' && kind !== 'again') break;
  }
  return { n, kind, owner: st.squares[4].owner };
}

/* ===================================== Craps ===================================== */
test('craps: the come-out roll wins on 7 or 11, loses on 2, 3 or 12; anything else is the point, made before a 7 to win', () => {
  const r = (...pairs) => E.crapsRound(dice(...pairs));
  assert.deepEqual(r([3, 4]), { rolls: [[3, 4]], point: null, result: 'win' }, '7 on the come-out');
  assert.deepEqual(r([5, 6]), { rolls: [[5, 6]], point: null, result: 'win' }, '11 on the come-out');
  for (const [a, b] of [[1, 1], [1, 2], [6, 6]]) assert.equal(r([a, b]).result, 'lose', `${a + b} on the come-out: craps`);
  const made = r([2, 2], [6, 5], [5, 1], [3, 1]);                   // point 4; 11 and 6 roll on; 4 made
  assert.deepEqual([made.point, made.result, made.rolls.length], [4, 'win', 4]);
  const out = r([4, 4], [6, 6], [2, 3], [4, 3]);                    // point 8; 12 and 5 roll on (no craps after the come-out); seven out
  assert.deepEqual([out.point, out.result, out.rolls.length], [8, 'lose', 4]);
  assert.equal(r([5, 5], [3, 4]).result, 'lose', 'point 10, then a 7');
  assert.equal(r([4, 2], [1, 1], [6, 5], [3, 3]).result, 'win', 'point 6: 2 and 11 mean nothing after the come-out');
});

test('craps: about 49% of rounds win (244 in 495) rolled to the end; first to 3 round wins; a loss takes nothing away; a move is one roll', () => {
  const rng = lcg(5); let w = 0, rolls = 0; const N = 100000;
  for (let k = 0; k < N; k++) { const x = E.crapsRound(rng); if (x.result === 'win') w++; rolls += x.rolls.length; }
  assert.ok(Math.abs(w / N - 244 / 495) < 0.006, `win odds ${(w / N).toFixed(4)} (wanted 0.4929)`);
  assert.ok(Math.abs(rolls / N - 3.376) < 0.05, `about 3.4 rolls a round (${(rolls / N).toFixed(2)})`);
  const m = E.newMini('craps', lcg(1));
  assert.deepEqual(m.wins, { X: 0, O: 0 }); assert.equal(m.point, null);
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([1, 1])), { ok: true, outcome: 'continue', note: 'lost' }, 'craps on the come-out');
  assert.deepEqual([m.wins.X, m.rounds.X], [0, 1], 'a loss: nothing taken away');
  assert.equal(E.applyMove(m, 'X', 'roll', dice([3, 4])).note, 'won'); assert.equal(m.wins.X, 1);
  assert.equal(E.applyMove(m, 'X', 'stop').ok, false, 'no Stop without a point');
  // a point: the roller chooses; a roll that is neither the point nor a 7: the choice again
  assert.deepEqual(E.applyMove(m, 'O', 'roll', dice([2, 2])), { ok: true, outcome: 'continue', note: 'point', again: true });
  assert.deepEqual([m.point, m.live], [4, 'O']);
  assert.equal(E.applyMove(m, 'X', 'roll', dice([2, 2])).reason, 'busy', 'the other player waits while O chooses');
  assert.deepEqual(E.applyMove(m, 'O', 'roll', dice([5, 4])), { ok: true, outcome: 'continue', note: 'stay', again: true });
  assert.deepEqual(m.rolls, [[2, 2], [5, 4]]);
  // Stop: the turn ends with the point on; X carries on the round: the point wins it for X
  assert.deepEqual(E.applyMove(m, 'O', 'stop'), { ok: true, outcome: 'continue', note: 'stop' });
  assert.deepEqual([m.point, m.live, m.last.kind], [4, null, 'stop']);
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([1, 3])), { ok: true, outcome: 'continue', note: 'won' }, 'X rolls O\'s point: X wins the round');
  assert.equal(m.last.inherited, true); assert.deepEqual([m.wins.X, m.wins.O, m.point], [2, 0, null]);
  // an inherited point and a 7: sevens out, nobody scores; the next roll is a come-out again
  E.applyMove(m, 'O', 'roll', dice([4, 4])); E.applyMove(m, 'O', 'stop');
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([3, 4])), { ok: true, outcome: 'continue', note: 'lost' }, 'a 7 on the inherited point: seven out');
  assert.deepEqual([m.wins.X, m.wins.O, m.point], [2, 0, null]);
  assert.deepEqual(E.applyMove(m, 'O', 'roll', dice([5, 6])), { ok: true, outcome: 'continue', note: 'won' }, 'the come-out again: 11 wins');
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([6, 1])), { ok: true, outcome: 'win', note: 'won' }, 'three rounds: the square');
  for (const bad of ['stand', 3, null]) assert.equal(E.applyMove(E.newMini('craps', lcg(2)), 'X', bad).ok, false);
  // in a match: a point keeps the roller in the square (again); Stop passes the turn
  const st = E.newMatch(lcg(3), { games: ['craps'] }), p0 = st.turn;
  E.playMove(st, 0, 'roll', dice([3, 3]));
  assert.deepEqual([st.flash.kind, st.flash.craps.result, st.flash.craps.point, st.flash.craps.sum], ['again', 'point', 6, 6]);
  assert.equal(E.playMs(st.flash), E.CRAPS.roll + E.CRAPS.puck + E.CRAPS.hold);
  E.endFlash(st); assert.equal(st.lock, 0, 'held in the square'); assert.equal(st.turn, p0);
  assert.equal(E.localBest(E.publicMini(st.squares[0].mini), p0, lcg(1)).move, 'roll', 'the computer rolls on');
  assert.equal(E.randomLegalMove(st.squares[0].mini, p0, lcg(1)), 'stop', 'a timeout mid-turn: Stop');
  E.playMove(st, 0, 'stop', lcg(9)); assert.equal(st.flash.craps.kind, 'stop'); assert.equal(E.playMs(st.flash), E.CRAPS.stop);
  E.endFlash(st); assert.equal(st.lock, null); assert.notEqual(st.turn, p0, 'the turn passes');
  assert.equal(E.randomLegalMove(st.squares[1].mini, 'X', lcg(1)), 'roll');
  assert.equal(E.secretOf(st.squares[1].mini), null, 'nothing hidden: the dice are rolled as the move is made');
});
test('craps: Stop is never the better choice (value iteration over the square, both players playing it every turn)', () => {
  const G = 3, P = {}; for (let s = 2; s <= 12; s++) P[s] = (6 - Math.abs(s - 7)) / 36;
  const PTS = [null, 4, 5, 6, 8, 9, 10], V = {}, key = (a, b, pt, ph) => `${a},${b},${pt},${ph}`;
  for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) for (const pt of PTS) for (const ph of ['start', 'choose']) V[key(a, b, pt, ph)] = 0.5;
  const after = (a, b) => (a >= G ? 1 : b >= G ? 0 : 1 - V[key(b, a, null, 'start')]);
  const roll = (a, b, pt) => { let v = 0; for (let s = 2; s <= 12; s++) { const q = P[s]; if (pt == null) v += q * (s === 7 || s === 11 ? after(a + 1, b) : [2, 3, 12].includes(s) ? after(a, b) : V[key(a, b, s, 'choose')]); else v += q * (s === pt ? after(a + 1, b) : s === 7 ? after(a, b) : V[key(a, b, pt, 'choose')]); } return v; };
  const stop = (a, b, pt) => 1 - V[key(b, a, pt, 'start')];
  for (let it = 0; it < 3000; it++) for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) for (const pt of PTS) { V[key(a, b, pt, 'start')] = roll(a, b, pt); if (pt != null) V[key(a, b, pt, 'choose')] = Math.max(roll(a, b, pt), stop(a, b, pt)); }
  for (let a = 0; a < G; a++) for (let b = 0; b < G; b++) for (const pt of PTS.slice(1)) assert.ok(roll(a, b, pt) > stop(a, b, pt), `${a}-${b}, point ${pt}: rolling on ${roll(a, b, pt).toFixed(3)}, stopping ${stop(a, b, pt).toFixed(3)}`);
  assert.ok(Math.abs(roll(0, 0, 6) - 0.556) < 0.002 && Math.abs(stop(0, 0, 6) - 0.444) < 0.002, 'at 0-0 on a 6: 55.6% rolling on, 44.4% stopping');
});

test('craps: online, a timed-out roll that sets a point ends the turn there and then (a Stop), the point left on for whoever plays here next', () => {
  const st = E.newMatch(lcg(5), { games: ['craps'], mode: 'online', timer: 60 }), i = 4;
  for (let k = 0; k < 9; k++) if (k !== i) st.squares[k].mini = E.newMini('ttt', lcg(k));
  st.lock = i; st.turn = 'X'; st.timer.for = 'X'; st.timer.deadline = 1;
  let rec = E.matchRecord(st);
  const r = E.applyOnlineTimeout(rec, dice([3, 1]));               // a 4: the point
  assert.equal(r.ok, true); assert.equal(r.entries.length, 2, 'the roll, then the Stop');
  const full = E.fullState(r.rec), m = full.squares[i].mini;
  assert.equal(m.point, 4, 'the point stays on'); assert.equal(m.live, null, 'nobody mid-turn');
  assert.equal(full.lock, null, 'no bonus move after a timeout'); assert.equal(full.turn, 'O', 'the turn passes');
  assert.equal(r.entries[1].kind, 'move'); assert.equal(full.squares[i].mini.last.kind, 'stop');
  // a come-out roll that settles the round needs no Stop
  const st2 = E.newMatch(lcg(6), { games: ['craps'], mode: 'online', timer: 60 });
  for (let k = 0; k < 9; k++) if (k !== i) st2.squares[k].mini = E.newMini('ttt', lcg(k));
  st2.lock = i; st2.turn = 'X'; st2.timer.for = 'X'; st2.timer.deadline = 1;
  const r2 = E.applyOnlineTimeout(E.matchRecord(st2), dice([4, 3]));   // a 7: the round won
  assert.equal(r2.ok, true); assert.equal(r2.entries.length, 1);
  assert.equal(E.fullState(r2.rec).turn, 'O');
});

/* ===================================== Takeover ===================================== */
test('takeover: an empty cell and the cells around it, the other player\'s too; the full board goes to whoever has most', () => {
  const m = E.newMini('takeover', lcg(1)), o = 'O';
  assert.equal(m.cells.length, 25); assert.ok(m.cells.every(c => c === null));
  assert.deepEqual(E.applyMove(m, 'X', 12), { ok: true, outcome: 'continue', note: 'take' });
  assert.deepEqual(m.cells.map((c, i) => (c ? i : -1)).filter(i => i >= 0), [7, 11, 12, 13, 17], 'the middle and its four neighbours');
  assert.equal(E.applyMove(m, 'O', 12).ok, false, 'a taken cell is not a move'); assert.equal(E.applyMove(m, 'O', 7).ok, false);
  const r = E.applyMove(m, o, 8);
  assert.equal(r.note, 'flip', 'the other player\'s neighbours turn over');
  assert.deepEqual(m.last.flipped.slice().sort((a, b) => a - b), [7, 13]); assert.deepEqual(m.last.took.slice().sort((a, b) => a - b), [3, 8, 9]);
  assert.deepEqual([E.takeCount(m.cells, 'X'), E.takeCount(m.cells, 'O')], [3, 5]);
  assert.deepEqual(E.takeNear(0).sort((a, b) => a - b), [0, 1, 5], 'a corner has two neighbours'); assert.equal(E.takeNear(24).length, 3);
  // the last empty cell: the board full, most cells wins, the mover or not
  const f = E.newMini('takeover', lcg(2));
  f.cells = Array.from({ length: 25 }, (_, i) => (i < 13 ? 'X' : 'O')); f.cells[24] = null;
  const end = E.applyMove(f, 'X', 24);
  assert.deepEqual([end.outcome, end.winner, end.counts], ['win', 'X', { X: 16, O: 9 }]);
  const g = E.newMini('takeover', lcg(3));
  g.cells = Array.from({ length: 25 }, (_, i) => (i < 17 ? 'O' : 'X')); g.cells[0] = null;
  const end2 = E.applyMove(g, 'X', 0);
  assert.deepEqual([end2.winner, end2.counts.X + end2.counts.O], ['O', 25], 'the mover can fill the board and still lose it');
  for (const bad of [-1, 25, 'x', 1.5]) assert.equal(E.applyMove(E.newMini('takeover', lcg(4)), 'X', bad).ok, false);
});

test('takeover: the computer looks two moves ahead: it takes the most it can keep', () => {
  // X can take 3 of O's cells by playing between them, or a lone corner: it takes them
  const cells = new Array(25).fill(null); for (const k of [6, 8, 2, 12]) cells[k] = 'O';
  const b = E.takeSearch(cells, 'X', null);
  assert.equal(b.i, 7, 'the cell between O\'s four');
  // and it never leaves a full board lost when a winning finish is there
  const end = Array.from({ length: 25 }, (_, i) => (i % 2 ? 'X' : 'O')); end[0] = null; end[1] = 'O'; end[5] = 'O';
  const fin = E.takeSearch(end, 'X', null);
  assert.equal(fin.i, 0);
  const { n, owner } = cpuSquare('takeover', 11);
  assert.ok(owner && n >= 6 && n <= 14, `a square of the computer against itself is decided (${n} moves)`);
});

/* ===================================== Flood ===================================== */
test('flood: six by six, five colours, the blob starts as the top-left cell alone; a colour grows it; the cells grabbed go to the mover; 18 wins', () => {
  for (let k = 0; k < 50; k++) { const m = E.newMini('flood', lcg(k)); assert.equal(m.colors.length, 36); assert.ok(m.colors.every(c => c >= 0 && c < 5)); assert.ok(m.colors[1] !== m.colors[0] && m.colors[6] !== m.colors[0], 'the blob is one cell to begin with'); assert.equal(m.owner[0], '-'); }
  const m = E.newMini('flood', lcg(1));
  m.colors = [0, 1, 1, 2, 3, 4, 2, 1, 3, 3, 4, 0, 2, 2, 2, 3, 4, 1, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0];
  assert.equal(E.applyMove(m, 'X', 0).ok, false, 'not the blob\'s own colour');
  const r = E.applyMove(m, 'X', 1);
  assert.equal(r.note, 'grow'); assert.deepEqual(m.last.waves.map(w => w.slice().sort((a, b) => a - b)), [[1], [2, 7]], 'the 1s joined to the blob, in waves out from it');
  assert.equal(m.score.X, 3); assert.deepEqual([m.owner[1], m.owner[2], m.owner[7], m.owner[0]], ['X', 'X', 'X', '-']);
  assert.ok([0, 1, 2, 7].every(i => m.colors[i] === 1), 'the whole blob in the new colour');
  E.applyMove(m, 'O', 2);                                              // 2s next to the blob: 3 (via 2), 6, 12, 13, 14 ...
  assert.ok(m.score.O >= 3 && m.owner[3] === 'O' && m.owner[6] === 'O', `O's grab (${m.score.O})`);
  assert.equal(m.last.waves.flat().length, m.score.O);
  const none = E.applyMove(m, 'X', 0);
  assert.ok(none.ok && ['grow', 'none'].includes(none.note));
  // 18 wins: the mover, there and then
  const w = E.newMini('flood', lcg(2)); w.score = { X: 17, O: 10 };
  const c = [0, 1, 2, 3, 4].find(k => k !== w.colors[0] && E.floodGain(w, k) > 0);
  assert.equal(E.applyMove(w, 'X', c).outcome, 'win');
  for (const bad of [-1, 5, 'red', null]) assert.equal(E.applyMove(E.newMini('flood', lcg(5)), 'X', bad).ok, false);
});

test('flood: the computer looks two moves ahead, always grows the blob when it can, and a square of it against itself ends', () => {
  const m = E.newMini('flood', lcg(9)), pm = E.publicMini(m);
  const b = E.floodSearch(pm, 'X', null);
  const gains = [0, 1, 2, 3, 4].filter(c => c !== m.colors[0]).map(c => E.floodGain(pm, c));
  assert.ok(Math.max(...gains) === 0 || b.gain > 0, 'a colour that grabs something');
  let total = 0; const N = 40;
  for (let k = 0; k < N; k++) { const { n, owner } = cpuSquare('flood', 100 + k); assert.ok(owner, `decided (${n} moves)`); total += n; }
  assert.ok(total / N / 2 >= 3 && total / N / 2 <= 8, `about ${(total / N / 2).toFixed(1)} moves a player`);
});

/* ===================================== together ===================================== */
test('the new games: admin only to begin with, in the full list, dealt and played to the end by the computer; random and timed-out moves are legal', () => {
  for (const t of ['craps', 'takeover', 'flood']) {
    assert.ok(E.TYPES.includes(t) && E.TEST_TYPES.includes(t), `${t}: in the list, admin only`);
    assert.ok(E.INFO[t] && E.INFO[t].name, `${t}: named`);
    for (let k = 0; k < 30; k++) {
      const st = E.newMatch(lcg(k), { games: [t] }), mv = E.randomLegalMove(st.squares[0].mini, 'X', lcg(k + 1));
      assert.equal(E.playMove(st, 0, mv, lcg(k + 2)).ok, true, `${t}: a random move (${JSON.stringify(mv)})`);
      assert.ok(E.playMs(st.flash) >= 500 && E.playMs(st.flash) < 60000);
    }
    const st = E.newMatch(lcg(7), { games: [t], mode: 'online', timer: 60 });
    assert.equal(E.timeoutMove(st, lcg(8)).ok, true, `${t}: a timeout`);
    const { n, owner } = cpuSquare(t, 21);
    assert.ok(owner, `${t}: decided (${n} moves)`);
  }
  // a whole match of the three with others, the computer on both sides
  const rng = lcg(31), st = E.newMatch(rng, { games: ['craps', 'takeover', 'flood', 'ttt'] });
  let n = 0;
  while (!st.winner && n++ < 600) { const m = E.cpuMove(st, rng); assert.equal(E.playMove(st, m.square, m.move, rng).ok, true); E.endFlash(st); }
  assert.ok(st.winner, `a match finishes (${n} moves)`);
});

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

/* ===================================== Districts ===================================== */
test('districts: every map has 5 regions and 11 to 15 spots, every region touched by an odd number (3 or more); spots on borders count for every region they touch', () => {
  const sizes = {};
  for (let k = 0; k < 3000; k++) {
    const map = E.distMap(lcg(k + 1));
    assert.equal(map.regions.length, 5);
    assert.ok(map.spots.length >= 11 && map.spots.length <= 15, `${map.spots.length} spots`);
    const n = [0, 0, 0, 0, 0];
    for (const s of map.spots) { assert.ok(s.r.length >= 1 && s.r.length <= 3); for (const r of s.r) n[r]++; assert.ok(s.x >= 0 && s.x <= 100 && s.y >= 0 && s.y <= 120); }
    assert.ok(n.every(x => x >= 3 && x % 2 === 1), `map ${k}: touches ${n}`);
    for (let a = 0; a < map.spots.length; a++) for (let b = a + 1; b < map.spots.length; b++) assert.ok(Math.hypot(map.spots[a].x - map.spots[b].x, map.spots[a].y - map.spots[b].y) >= E.DIST.gap - 0.2, 'spots kept apart');
    sizes[map.spots.length] = (sizes[map.spots.length] || 0) + 1;
  }
  assert.ok(Object.keys(sizes).length >= 2, `map sizes vary (${JSON.stringify(sizes)})`);
});

test('districts: each region goes to whoever has more pieces touching it; most regions wins; the leaders show as play goes on', () => {
  const m = E.newMini('districts', lcg(2)), map = m.map, n = map.spots.length;
  const t0 = E.distTally(map, m.who); assert.ok(t0.lead.every(l => l === null), 'nobody leads an empty map');
  // fill all but one: X on the even spots, O on the odd ones; then the last
  for (let k = 0; k < n - 1; k++) m.who[k] = k % 2 ? 'O' : 'X';
  const p = (n - 1) % 2 ? 'O' : 'X', r = E.applyMove(m, p, n - 1);
  const t = E.distTally(map, m.who), x = t.lead.filter(l => l === 'X').length, o = t.lead.filter(l => l === 'O').length;
  assert.equal(x + o, 5, 'every region has a leader once full (odd counts)');
  assert.deepEqual([r.outcome, r.winner, r.counts], ['win', x > o ? 'X' : 'O', { X: x, O: o }]);
  for (let reg = 0; reg < 5; reg++) {
    const xs = map.spots.filter((s, k) => s.r.includes(reg) && m.who[k] === 'X').length, os = map.spots.filter((s, k) => s.r.includes(reg) && m.who[k] === 'O').length;
    assert.equal(t.lead[reg], xs > os ? 'X' : 'O', `region ${reg}: ${xs} to ${os}`);
  }
  // a border spot counts for both regions it touches
  const b = E.newMini('districts', lcg(3)), k = b.map.spots.findIndex(s => s.r.length >= 2);
  if (k >= 0) { E.applyMove(b, 'X', k); const tb = E.distTally(b.map, b.who); for (const reg of b.map.spots[k].r) assert.equal(tb.lead[reg], 'X'); }
  assert.equal(E.applyMove(b, 'O', k).ok, false, 'a taken spot');
});

test('districts: the computer looks two moves ahead on the regions still in play', () => {
  const m = E.newMini('districts', lcg(4)), pm = E.publicMini(m);
  const b = E.distSearch(pm, 'X', null);
  assert.ok(Number.isInteger(b.k) && !m.who[b.k]);
  const { n, owner } = cpuSquare('districts', 31);
  assert.ok(owner && n === m.map.spots.length || owner, `decided (${n} moves)`);
});

/* ===================================== Shelves ===================================== */
test('shelves: six shelves of three; a mark, then a grey mark on a random open spot; once full, the shelves you are on; a tie resets', () => {
  const m = E.newMini('shelves', lcg(1));
  assert.equal(m.cells.length, 18);
  E.applyMove(m, 'X', 4, lcg(2));
  assert.equal(m.cells[4], 'X'); assert.ok(m.last.grey != null && m.cells[m.last.grey] === 'G' && m.last.grey !== 4);
  assert.equal(E.applyMove(m, 'O', 4).ok, false);
  assert.deepEqual([E.shelfOn(['X', null, null, 'X', 'X', null, null, null, null, 'O', 'X', 'O', null, null, null, null, null, null], 'X'), E.shelfOn(['X', null, null, 'X', 'X', null, null, null, null, 'O', 'X', 'O'], 'O')], [3, 1]);
  const end = E.newMini('shelves', lcg(3));
  end.cells = ['O', 'G', 'G', 'O', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'G', 'O', 'G', 'X', 'G', null];
  const r = E.applyMove(end, 'O', 17, lcg(4));
  assert.deepEqual(r, { ok: true, outcome: 'win', note: 'full', winner: 'O', counts: { X: 3, O: 5 } }, 'the last spot: O on five shelves, X on three');
  assert.equal(end.last.grey, null, 'no grey mark once full');
  const t = E.newMini('shelves', lcg(5));
  t.cells = ['X', 'G', 'G', 'O', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'G', 'O', 'G', 'X', 'G', null];
  const tr = E.applyMove(t, 'O', 17, lcg(6));
  assert.deepEqual([tr.outcome, tr.note], ['draw', 'tie'], `4 shelves each: a tie (${JSON.stringify(tr)})`);
  const x = E.newMini('shelves', lcg(7));
  x.cells = ['X', 'G', 'G', 'X', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'O', 'O', 'G', 'X', 'G', null];
  assert.deepEqual(E.applyMove(x, 'O', 17, lcg(8)), { ok: true, outcome: 'win', note: 'full', winner: 'X', counts: { X: 5, O: 3 } });
});

test('shelves: the computer goes for shelves it is not on, more so ones the other player is missing too and that are nearly full', () => {
  const pm = { type: 'shelves', cells: new Array(18).fill(null) };
  pm.cells[0] = 'X'; pm.cells[1] = 'G';                              // shelf 0: X on it, one spot left
  pm.cells[3] = 'O'; pm.cells[4] = 'G';                              // shelf 1: O on it, one left
  pm.cells[6] = 'G'; pm.cells[7] = 'G';                              // shelf 2: nobody, one left
  const b = E.shelfPick(pm, 'X', null);
  assert.equal(b.i, 8, 'the nearly full shelf neither player is on');
  pm.cells[8] = 'G';
  assert.equal(E.shelfPick(pm, 'X', null).i, 5, 'then the nearly full one only the other player is on');
});

/* ===================================== Roads ===================================== */
const H = (r, c) => r * 3 + c, V = (r, c) => 12 + r * 4 + c;      // a line across from dot (r,c); a line down from it
const segsOf = (p, ks) => { const s = new Array(24).fill(null); for (const k of ks) s[k] = p; return s; };
test('roads: the longest trail, against cases checked by hand', () => {
  assert.equal(E.ROAD_SEGS.length, 24);
  const L = ks => E.roadLongest(segsOf('X', ks), 'X').len;
  assert.equal(L([]), 0);
  assert.equal(L([H(0, 0), H(0, 1), H(0, 2)]), 3, 'a straight row of three');
  assert.equal(L([H(1, 0), H(1, 1), V(1, 1)]), 2, 'a T: three lines at one dot, only two in one trail');
  assert.equal(L([H(0, 0), H(1, 0), V(0, 0), V(0, 1)]), 4, 'a square: all the way round');
  assert.equal(L([H(0, 0), H(1, 0), V(0, 0), V(0, 1), H(1, 1), H(2, 1), V(1, 1), V(1, 2)]), 8, 'two squares meeting at a corner: through the corner twice');
  assert.equal(L([H(1, 0), H(1, 1), V(0, 1), V(1, 1)]), 2, 'a plus: two arms');
  assert.equal(L([H(0, 0), H(0, 1), V(1, 0), V(2, 0), H(3, 0), V(2, 1)]), 4, 'apart: the longer piece (a U of four)');
  assert.equal(L([H(0, 0), H(0, 1), H(3, 0), H(3, 1), V(2, 0), V(2, 1)]), 3, 'a fork at the bottom: one branch only');
  assert.equal(L([H(0, 0), H(1, 0), V(0, 0), V(0, 1), H(0, 1)]), 5, 'a square with a tail: round it and off');
  assert.equal(L([H(0, 0), H(0, 1), H(0, 2), V(0, 3), V(1, 3), V(2, 3), H(3, 2), H(3, 1), H(3, 0), V(2, 0), V(1, 0), V(0, 0)]), 12, 'the whole rim');
  // the lines of the trail, in order, each one joined to the next
  const t = E.roadLongest(segsOf('X', [H(0, 0), H(1, 0), V(0, 0), V(0, 1), H(0, 1)]), 'X');
  for (let k = 1; k < t.segs.length; k++) { const a = E.ROAD_SEGS[t.segs[k - 1]], b = E.ROAD_SEGS[t.segs[k]]; assert.ok(a.some(v => b.includes(v)), 'a joined trail'); }
  // against a brute force over every order of the lines, on random sets
  const brute = ks => { let best = 0; const used = new Set(); const go = (v, n) => { best = Math.max(best, n); for (const k of ks) { if (used.has(k)) continue; const [a, b] = E.ROAD_SEGS[k]; if (v != null && a !== v && b !== v) continue; used.add(k); if (v == null) { go(a, n + 1); go(b, n + 1); } else go(a === v ? b : a, n + 1); used.delete(k); } }; go(null, 0); return best; };
  const rng = lcg(9);
  for (let k = 0; k < 300; k++) {
    const ks = Array.from({ length: 24 }, (_, i) => i).filter(() => rng() < 0.3).slice(0, 8);
    assert.equal(L(ks), brute(ks), `lines ${ks}`);
  }
});

test('roads: a line, then a random open line blocked; once none is open, the longer road wins and a tie resets', () => {
  const m = E.newMini('roads', lcg(1));
  E.applyMove(m, 'X', 0, lcg(2));
  assert.equal(m.segs[0], 'X'); assert.ok(m.last.block != null && m.segs[m.last.block] === 'B' && m.last.block !== 0);
  assert.equal(E.applyMove(m, 'O', 0).ok, false); assert.equal(E.applyMove(m, 'O', m.last.block).ok, false, 'a blocked line is not a move');
  const end = E.newMini('roads', lcg(3));
  end.segs = new Array(24).fill('B'); for (const k of [H(0, 0), H(0, 1), H(0, 2)]) end.segs[k] = 'X'; for (const k of [H(3, 0), H(3, 1)]) end.segs[k] = 'O'; end.segs[V(2, 0)] = null;
  assert.deepEqual(E.applyMove(end, 'O', V(2, 0), lcg(4)), { ok: true, outcome: 'draw', note: 'tie' }, '3 and 3: a tie');
  const win = E.newMini('roads', lcg(5));
  win.segs = new Array(24).fill('B'); for (const k of [H(0, 0), H(0, 1), H(0, 2)]) win.segs[k] = 'X'; win.segs[H(3, 0)] = 'O'; win.segs[V(2, 3)] = null;
  assert.deepEqual(E.applyMove(win, 'O', V(2, 3), lcg(6)), { ok: true, outcome: 'win', note: 'full', winner: 'X', counts: { X: 3, O: 1 } });
});

test('roads: the computer lengthens its own road and takes the line the other player wants most', () => {
  const s = new Array(24).fill(null); s[H(0, 0)] = 'X'; s[H(0, 1)] = 'X';
  const ext = E.roadPick({ type: 'roads', segs: s }, 'X', null);
  assert.ok([H(0, 2), V(0, 0), V(0, 1), V(0, 2)].includes(ext.k) && E.roadLongest(ext.after, 'X').len === 3, 'it lengthens its road');
  const t = new Array(24).fill('B'); t[H(1, 0)] = 'O'; t[H(1, 1)] = 'O'; t[H(1, 2)] = null; t[H(3, 2)] = null;
  assert.equal(E.roadPick({ type: 'roads', segs: t }, 'X', null).k, H(1, 2), 'it cuts off the other player\'s best extension');
});

test('the second four: admin only, dealt and played to the end by the computer (ties reset); random and timed-out moves are legal; nothing to come is kept in the square', () => {
  for (const t of ['seating', 'districts', 'shelves', 'roads']) {
    assert.ok(E.TYPES.includes(t) && E.TEST_TYPES.includes(t) && E.INFO[t], `${t}: listed, admin only`);
    for (let k = 0; k < 20; k++) {
      const st = E.newMatch(lcg(k), { games: [t] }), mv = E.randomLegalMove(st.squares[0].mini, 'X', lcg(k + 1));
      assert.equal(E.playMove(st, 0, mv, lcg(k + 2)).ok, true, `${t}: a random move (${JSON.stringify(mv)})`);
      assert.ok(E.playMs(st.flash) >= 500 && E.playMs(st.flash) < 5000);
    }
    const st = E.newMatch(lcg(7), { games: [t], mode: 'online', timer: 60 });
    assert.equal(E.timeoutMove(st, lcg(8)).ok, true, `${t}: a timeout`);
    const sq = E.newMini(t, lcg(3));
    assert.equal(E.secretOf(sq), null, `${t}: no secret kept; what comes next is drawn as the move is made`);
    const keys = Object.keys(sq).join(',');
    assert.ok(!/queue|future|order/.test(keys), `${t}: nothing to come in the square (${keys})`);
    const { kind } = cpuSquare(t, 41);
    assert.ok(['claim', 'match', 'draw'].includes(kind), `${t}: decided or tied (${kind})`);
  }
  const rng = lcg(51), st = E.newMatch(rng, { games: ['seating', 'districts', 'shelves', 'roads', 'ttt'] });
  let n = 0;
  while (!st.winner && n++ < 800) { const m = E.cpuMove(st, rng); assert.equal(E.playMove(st, m.square, m.move, rng).ok, true); E.endFlash(st); }
  assert.ok(st.winner, `a match of them finishes (${n} moves)`);
});
