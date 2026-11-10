'use strict';
// Scratch & Match: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../engine.js');
const R = require('../../src/games/scratch/rules.js');
const A = require('../../src/games/scratch/ai.js');
const { timeoutClose } = require('../../src/core/board.js');
E.setPhysics(require('../physics.js'));
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const clone = v => JSON.parse(JSON.stringify(v));
const NORMAL = { level: 'normal', until: null }, HARD = { level: 'hard', until: null };
// A square with cards laid out by hand (pictures 0..5; the first row of X's card three stars-to-be: 0 0 0).
function mini(cards) {
  const m = E.newMini('scratch', lcg(1));
  m.cards = { X: cards.X ? cards.X.slice() : m.cards.X, O: cards.O ? cards.O.slice() : m.cards.O };
  return m;
}
const CARD_X = [0, 0, 0, 1, 2, 1, 3, 2, 4], CARD_O = [1, 2, 3, 4, 4, 2, 3, 3, 3];   // X: the top row; O: the bottom row

test('scratch: the layout from the settings: 6 pictures, one line, two pairs and two singles by default; held to what nine panels hold', () => {
  assert.deepEqual(R.scrLayout({ kinds: 6, lines: 1, pairs: 2 }), { kinds: 6, lines: 1, pairs: 2, singles: 2, decoys: 6 });
  assert.deepEqual(R.scrLayout(null), { kinds: 6, lines: 1, pairs: 2, singles: 2, decoys: 6 }, 'the defaults');
  assert.deepEqual(R.scrLayout({ kinds: 4, lines: 2, pairs: 3 }), { kinds: 4, lines: 2, pairs: 1, singles: 1, decoys: 3 }, 'two lines leave three decoy panels: one pair at most');
  assert.deepEqual(R.scrLayout({ kinds: 4, lines: 1, pairs: 0 }), { kinds: 4, lines: 1, pairs: 3, singles: 0, decoys: 6 }, 'three decoy pictures for six panels: all pairs');
  assert.deepEqual(R.scrLayout({ kinds: 8, lines: 1, pairs: 0 }), { kinds: 8, lines: 1, pairs: 0, singles: 6, decoys: 6 });
  assert.deepEqual(R.scrLayout({ kinds: 20, lines: 9, pairs: 9 }), { kinds: 8, lines: 2, pairs: 1, singles: 1, decoys: 3 }, 'clipped');
  assert.equal(R.LINE_SETS[1].length, 8); assert.equal(R.LINE_SETS[2].length, 6);
  for (const set of R.LINE_SETS[2]) assert.equal(new Set(set.flat()).size, 6, 'two lines that never cross');
});

test('scratch: a dealt card holds its lines\' pictures three times each along a line, every other picture at most twice, the pairs as set', () => {
  for (const [t, seeds] of [[{ kinds: 6, lines: 1, pairs: 2 }, 300], [{ kinds: 8, lines: 2, pairs: 1 }, 200], [{ kinds: 5, lines: 1, pairs: 0 }, 200], [{ kinds: 4, lines: 2, pairs: 0 }, 100]]) {
    const lay = R.scrLayout(t);
    const seen = new Set();
    for (let s = 0; s < seeds; s++) {
      const card = R.scrCard(E.makeRng('card' + s), lay);
      assert.equal(card.length, 9); assert.ok(card.every(v => Number.isInteger(v) && v >= 0 && v < lay.kinds));
      const counts = R.scrCounts(card), triples = Object.keys(counts).filter(k => counts[k] === 3), pairs = Object.keys(counts).filter(k => counts[k] === 2);
      assert.equal(triples.length, lay.lines, `${JSON.stringify(t)}: ${lay.lines} picture(s) three times`);
      assert.equal(pairs.length, lay.pairs, 'the pairs');
      assert.ok(Object.values(counts).every(n => n <= 3), 'nothing four times');
      for (const k of triples) { const cells = card.map((v, i) => (v === Number(k) ? i : -1)).filter(i => i >= 0); assert.ok(R.LINES.some(l => l.join() === cells.join()), `three of a kind in a line (${cells})`); seen.add(cells.join()); }
    }
    assert.ok(seen.size >= (lay.lines === 2 ? 6 : 8), 'every line comes up');
  }
});

test('scratch: a fresh square: the pictures dealt, both cards hidden and apart from the public view, the record and the other phone', () => {
  const m = E.newMini('scratch', lcg(2));
  assert.equal(m.type, 'scratch'); assert.equal(m.pics.length, 6); assert.equal(new Set(m.pics).size, 6); assert.ok(m.pics.every(k => k >= 0 && k < R.SCR_PICS));
  assert.deepEqual(m.open, { X: new Array(9).fill(null), O: new Array(9).fill(null) });
  assert.equal(m.cards.X.length, 9); assert.equal(m.cards.O.length, 9); assert.notDeepEqual(m.cards.X, m.cards.O);
  const pm = E.publicMini(m);
  assert.ok(!('cards' in pm)); assert.deepEqual(pm.pics, m.pics); assert.deepEqual(pm.open, m.open);
  assert.deepEqual(R.secret(m), { cards: m.cards });
  const st = E.newMatch(lcg(3), { games: ['scratch'] }); st.id = 's'; st.seq = 0; st.recent = [];
  st.squares[0].mini = m;
  const rec = E.matchRecord(st);
  assert.ok(!('cards' in rec.state.squares[0].mini), 'the record\'s state carries no card');
  assert.deepEqual(rec.secrets[0].cards, m.cards, 'the secrets do');
  assert.deepEqual(E.fullState(rec).squares[0].mini.cards, m.cards, 'and the server has them back');
  const h = clone(m); E.hideMini(h, 0, st); assert.ok(!('cards' in h) && 'open' in h);
});

test('scratch: a scratch shows that panel of the mover\'s own card and nothing of the other\'s; a pair is noted; three of a kind takes the square with its line', () => {
  const m = mini({ X: CARD_X, O: CARD_O });
  assert.equal(E.applyMove(m, 'X', 9, lcg(1)).ok, false); assert.equal(E.applyMove(m, 'X', -1, lcg(1)).ok, false); assert.equal(E.applyMove(m, 'X', 'spin', lcg(1)).ok, false);
  assert.deepEqual(E.applyMove(m, 'X', 4, lcg(1)), { ok: true, outcome: 'continue', note: 'one' });
  assert.deepEqual(m.open.X, [null, null, null, null, 2, null, null, null, null]); assert.deepEqual(m.open.O, new Array(9).fill(null), 'O\'s card untouched');
  assert.deepEqual(m.last, { by: 'X', spot: 4, sym: 2, c: 1, first: 1, auto: [] });
  assert.equal(E.applyMove(m, 'X', 4, lcg(1)).reason, 'taken');
  assert.equal(E.applyMove(m, 'O', 4, lcg(1)).note, 'one', 'the same spot on O\'s own card is free');
  // a pair in a line with its third panel still frosted scratches that third at once, in the same move: 4 and 7 are the middle column's pictures, so panel 1 opens too (a star-to-be 0: no match, the turn ends)
  assert.deepEqual(E.applyMove(m, 'X', 7, lcg(1)), { ok: true, outcome: 'continue', note: 'pair' });
  assert.deepEqual(m.open.X, [null, 0, null, null, 2, null, null, 2, null], 'the third panel of the column opened for X');
  assert.deepEqual(m.last.auto, [{ spot: 1, sym: 0, c: 1, same: [] }]); assert.equal(m.last.first, 2); assert.equal(m.last.c, 1);
  assert.equal(E.applyMove(m, 'X', 1, lcg(1)).reason, 'taken', 'an auto-scratched panel is shown like any other');
  // 0 matches the 0 now on show, in a line (the top row) whose third is frosted: that third opens at once and it is three of a kind
  const r = E.applyMove(m, 'X', 0, lcg(1));
  assert.deepEqual(r, { ok: true, outcome: 'win', cells: [0, 1, 2], note: 'three' });
  assert.deepEqual(m.last.auto.map(a => a.spot), [2], 'the third scratched for X');
  assert.equal(R.scrBest(m.open.X), 3); assert.equal(R.scrBest(m.open.O), 1);
  // through a match: the claim, its cells, the flash's spot and picture, the replay's move riding it
  const st = E.newMatch(lcg(5), { games: ['scratch'] });
  st.squares[0].mini = mini({ X: CARD_X, O: CARD_O }); st.turn = 'O';
  for (const [p, i, kind] of [['O', 6, 'move'], ['X', 4, 'move'], ['O', 7, 'claim']]) {   // (O's 6 and 7 are a pair in its bottom row: 8 opens at once, three of a kind)
    st.turn = p;
    const res = E.playMove(st, 0, i, lcg(i), { rep: [[0, 'move', 'm=' + i]] });
    assert.ok(res.ok, `${p} at ${i}`); assert.equal(st.flash.kind, kind); assert.equal(st.flash.m, i, 'the move rides the flash'); assert.deepEqual(st.flash.rep, [[0, 'move', 'm=' + i]]);
    assert.equal(st.flash.scratch.spot, i); assert.equal(st.flash.scratch.by, p); assert.equal(st.flash.scratch.sym, (p === 'X' ? CARD_X : CARD_O)[i]);
    assert.equal(R.flashMs(st.flash, 0, kind === 'claim'), st.flash.scratch.auto.length * R.SCR.autoAt + R.SCR.rub + R.SCR.pop + (kind === 'claim' ? R.SCR.won : st.flash.scratch.fin === 2 ? R.SCR.pair : 0));
    E.endFlash(st);
  }
  assert.equal(st.squares[0].owner, 'O'); assert.deepEqual(st.squares[0].mini.winCells, [6, 7, 8]);
  assert.deepEqual(st.squares[0].mini.open.X, [null, null, null, null, 2, null, null, null, null], 'X\'s card as X left it');
});

test('scratch: a timeout plays nothing (no scratch for a player out of time): the turn is missed; online too, and no automatic move from a phone', () => {
  const m = mini({ X: CARD_X, O: CARD_O });
  assert.equal(timeoutClose(m, 'X'), null);
  const st = E.newMatch(E.makeRng('sc-to'), { games: ['ttt', 'scratch'] });
  st.squares[0] = { owner: null, mini: m }; st.turn = 'X'; st.timer = E.newTimer(30); st.lock = null;
  const r = E.timeoutMove(st, lcg(1));
  assert.deepEqual([r.ok, r.missed, st.turn], [true, 'X', 'O']); assert.deepEqual(m.open.X, new Array(9).fill(null));
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === 'scratch']));
  let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, lcg(3), 'sc');
  const p = rec.state.turn, t = E.applyOnlineTimeout(rec, lcg(2));
  assert.deepEqual([t.ok, t.entries, t.missed], [true, [], p]);
  rec = t.rec;
  const mv = E.applyOnlineMove(rec, rec.state.turn, 0, 4, lcg(4));
  assert.ok(mv.ok, JSON.stringify(mv)); assert.equal(mv.entries[0].scratch.spot, 4, 'the move\'s entry carries the scratch');
  assert.ok(!('cards' in mv.rec.state.squares[0].mini), 'the record still hides the cards'); assert.ok(mv.rec.secrets[0].cards);
  assert.equal(E.applyOnlineMove(mv.rec, mv.rec.state.turn, 0, 'auto', lcg(5)).ok, false, 'no automatic move from a phone');
  for (let k = 0; k < 20; k++) { const rm = E.randomLegalMove(mini({}), 'O', lcg(k)); assert.ok(Number.isInteger(rm) && rm >= 0 && rm < 9); }
});

test('scratch: the computer: a pair in a line opens its third by itself, so Normal scratches any hidden panel; Hard weighs every card still possible', () => {
  const m = mini({ X: CARD_X, O: CARD_O });
  E.applyMove(m, 'X', 0, lcg(1));                                  // one of the top row: scratching the next opens the third, three of a kind (a pair is never left with its third frosted)
  let pm = E.publicMini(m);
  assert.equal(A.scrObvious(pm.open.X), -1, 'after a move no pair is left pointing at a frosted third');
  assert.equal(A.needs(pm, 'X') < A.needs(E.publicMini(mini({})), 'X'), true, 'closer than a fresh card');
  const o = A.scrOdds(pm, 'X');
  assert.ok(o.W > 0 && o.line[1] > 0 && o.line[2] > 0, 'the rest of the top row, the nearest line');
  E.applyMove(m, 'X', 2, lcg(1));
  assert.equal(A.needs(E.publicMini(m), 'X'), 0, 'none once three show');
  // a picture shown outside a line rules that line out for it: Hard never scratches a shown panel, and favours the panels still on possible lines
  const f = E.publicMini(mini({}));
  const fresh = A.scrOdds(f, 'X');
  assert.ok(fresh.line[4] > fresh.line[0] && fresh.line[0] > fresh.line[1], 'before anything shows: the centre (four lines) over a corner (three) over an edge (two)');
  assert.ok([0, 2, 6, 8].includes(A.best(f, 'X', lcg(2), {}, HARD).move), 'Hard opens on a corner: the table (table.js), the fewest scratches on average over every card possible');
  assert.ok(A.scrLook(f, 'X').e > 3 && A.scrLook(f, 'X').e < 5, `a fresh card: the table says (${A.scrLook(f, 'X').e}) scratches at best, under the old 5.08 now that a pair opens its third`);
  { const t = mini({ X: CARD_X, O: CARD_O }); E.applyMove(t, 'X', 0, lcg(1)); const a = A.scrLook(E.publicMini(t), 'X'); assert.ok(a && t.open.X[a.panel] == null, 'the table turns its panel back to the card as it lies: a hidden one'); }
  const n0 = A.needs(f, 'X');
  assert.ok(n0 > 3 && n0 < 5, `a fresh card needs about four scratches now that a pair opens its third (${n0.toFixed(2)})`);
  // left to itself, each level finishes a card; Hard in fewer scratches than Normal on average, and quickly
  const run = (lv, g) => { const c = E.newMini('scratch', E.makeRng('run' + g)); let k = 0; for (; k < 9; k++) { const pm2 = E.publicMini(c), b = A.best(pm2, 'O', lcg(g + k), {}, lv); assert.equal(pm2.open.O[b.move], null, 'a hidden panel'); if (E.applyMove(c, 'O', b.move, lcg(k)).outcome === 'win') break; } assert.ok(k < 9, 'done within the card'); return k + 1; };
  let nn = 0, hh = 0, worst = 0;
  for (let g = 0; g < 150; g++) { nn += run(NORMAL, g); const t0 = performance.now(); hh += run(HARD, g); worst = Math.max(worst, performance.now() - t0); }
  assert.ok(hh < nn, `Hard quicker: ${(hh / 150).toFixed(2)} against ${(nn / 150).toFixed(2)}`);
  assert.ok(worst < 250, `a whole card of Hard's scratches under 250 ms (${worst.toFixed(0)})`);
  const n = E.localBest(E.publicMini(mini({})), 'X', lcg(9), {}, NORMAL);
  assert.deepEqual(n, E.localBest(E.publicMini(mini({})), 'X', lcg(9)), 'Normal untouched by the level');
  E.setTune('scratch', { kinds: 8, lines: 2, pairs: 1 });
  try { const c = E.newMini('scratch', lcg(7)); assert.deepEqual(c.tune, { kinds: 8, lines: 2, pairs: 1 }); assert.equal(c.pics.length, 8); const b = A.best(E.publicMini(c), 'X', lcg(1), {}, HARD); assert.ok(Number.isInteger(b.move)); } finally { E.setTune('scratch', null); }
});

test('scratch: Super Chaos: dealt there; both scratch their own card in one square in one round, each move in, the square settles to both', () => {
  assert.ok(E.scTypes().includes('scratch'));
  const rng = E.makeRng('sc-sc'), st = E.newState(rng);
  st.setup.local = { pick: 'X', p2: 'cpu', n1: '', n2: '' };
  E.seatLocal(st.setup, rng);
  assert.ok(E.startChaos(st, rng));
  const m = mini({ X: CARD_X, O: CARD_O });
  E.applyMove(m, 'O', 6, lcg(1));                                                                // O (the computer) has one of its bottom row
  st.squares = Array.from({ length: 9 }, () => ({ owner: null, mini: clone(m), mv: { X: 0, O: 0 } }));
  E.scBegin(st, rng);
  st.sc.cpu = E.scCpu(st, lcg(4), { square: 0, moves: [7], rng: lcg(4) });                     // the computer: the next, which opens the third (8) at once
  const r = E.playMove(st, 0, 4, lcg(1));                                                       // the human (X): a panel of its own
  assert.ok(r.ok); assert.equal(st.flash.kind, 'move'); assert.equal(st.squares[0].mini.open.X[4], 2); assert.equal(st.squares[0].mini.open.O[8], null, 'the computer\'s move is kept apart until the recap');
  st.flash = null; E.leaveSquare(st);
  assert.ok(E.chaosResolve(st, E.makeRng('resolve')));
  assert.equal(st.squares[0].owner, 'O', 'three of a kind takes the square');
  assert.deepEqual(st.squares[0].mini.open.X, [null, null, null, null, 2, null, null, null, null], 'X\'s card as X played it');
  assert.deepEqual(st.squares[0].mini.open.O, [null, null, null, null, null, null, 3, 3, 3], 'the third opened for it');
});
