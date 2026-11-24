'use strict';
// Mancala Race (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/mancala/rules.js');
const M = require('../../src/games/mancala/meta.js');

const C = { target: 10, extra: true, capture: true, cross: true, sweep: true };
const board = (X, O, bx = 0, bo = 0, v = 2) => ({ type: 'mancala', v, pits: { X: X.slice(), O: O.slice() }, bank: { X: bx, O: bo }, last: null });   // (v 1: a square dealt before the end by an empty side)
const total = m => m.pits.X.concat(m.pits.O).reduce((s, v) => s + v, 0) + m.bank.X + m.bank.O;
const emptyAll = m => m.pits.X.every(v => v === 0) && m.pits.O.every(v => v === 0);

test('mancala: Admin only, brain; the deal: six pits a side, three seeds a pit on average, the two sides the same pit for pit', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'brain', '1.31.0']);
  assert.deepEqual(E.gameFields('mancala').map(f => f.k), ['target', 'extra', 'capture', 'cross', 'pits', 'seeds', 'mix', 'aiLookEasy', 'aiGuardEasy', 'aiLookNormal', 'aiGuardNormal', 'aiLookHard', 'aiGuardHard']);
  let uneven = 0;
  for (let g = 0; g < 60; g++) {
    const m = E.newMini('mancala', E.makeRng('d' + g));
    assert.equal(m.v, 2, 'dealt under the end by an empty side');
    assert.deepEqual(m.pits.X, m.pits.O, 'the same for both'); assert.equal(m.pits.X.length, 6); assert.equal(total(m), 36);
    assert.ok(m.pits.X.every(v => v >= 2 && v <= 4)); if (m.pits.X.some(v => v !== 3)) uneven++;
  }
  assert.ok(uneven > 40, 'most deals are uneven');
  E.setTune('mancala', { mix: 'off', pits: 4 });
  try { assert.deepEqual(E.newMini('mancala', E.makeRng('e')).pits.X, [3, 3, 3, 3]); } finally { E.setTune('mancala', null); }
  assert.equal(E.secretOf(E.newMini('mancala', E.makeRng('f'))), null);
});

test('mancala: no deal ever leaves a side empty (every pit a seed at least), at any setting', () => {
  for (const pits of [3, 4, 5, 6]) for (const seeds of [2, 3, 4, 5, 6]) for (const mix of ['on', 'off']) {
    E.setTune('mancala', { pits, seeds, mix });
    try {
      for (let g = 0; g < 25; g++) { const m = E.newMini('mancala', E.makeRng(`deal:${pits}:${seeds}:${mix}:${g}`)); assert.ok(m.pits.X.every(v => v >= 1) && m.pits.O.every(v => v >= 1), JSON.stringify(m.pits)); assert.equal(total(m), pits * seeds * 2); }
    } finally { E.setTune('mancala', null); }
  }
});

test('mancala: sowing: one seed a place along your side, into your bank, along the other side from its far end, never into the other bank', () => {
  let r = R.mancSow({ X: [0, 0, 3, 0], O: [1, 1, 1, 1] }, { X: 0, O: 0 }, 'X', 2, C);
  assert.deepEqual([r.pits.X, r.pits.O, r.bank, r.path], [[0, 0, 0, 1], [2, 1, 1, 1], { X: 1, O: 0 }, [['X', 3], ['X', 'bank'], ['O', 0]]]);
  r = R.mancSow({ X: [0, 0, 0, 7], O: [0, 0, 0, 0] }, { X: 0, O: 0 }, 'X', 3, Object.assign({}, C, { capture: false }));   // a full lap: bank, the other side's four, back onto its own (the other bank skipped)
  assert.deepEqual([r.pits.X, r.pits.O, r.bank], [[1, 1, 0, 0], [1, 1, 1, 1], { X: 1, O: 0 }]);
  r = R.mancSow({ X: [0, 0, 5, 0], O: [0, 0, 0, 0] }, { X: 0, O: 0 }, 'X', 2, Object.assign({}, C, { cross: false }));
  assert.deepEqual([r.pits.X, r.pits.O, r.bank.X], [[1, 1, 1, 1], [0, 0, 0, 0], 1], 'crossing off: round its own side again');
  for (let g = 0; g < 200; g++) { const rng = E.makeRng('s' + g), m = E.newMini('mancala', rng); let p = 'X'; for (let k = 0; k < 40; k++) { const r2 = E.applyMove(m, p, E.randomLegalMove(m, p, rng), rng); assert.ok(r2.ok); assert.equal(total(m), 36, 'no seed is ever lost or made'); if (r2.outcome !== 'continue') break; if (!r2.again) p = p === 'X' ? 'O' : 'X'; } }
});

test('mancala: the last seed in your bank goes again; in an empty pit of yours with seeds opposite it captures; the target takes the square', () => {
  const m = board([0, 0, 2, 1], [2, 0, 3, 3]);
  let r = E.applyMove(m, 'X', 3, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.again, r.note, m.bank.X], ['continue', true, 'again', 1]);
  assert.equal(E.applyMove(m, 'X', 3, E.makeRng('x')).reason, 'bad', 'an empty pit');
  const cap = board([1, 0, 0, 2], [0, 0, 4, 2]);                   // X's seed lands in its empty pit 1; opposite it is O's pit 2
  r = E.applyMove(cap, 'X', 0, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, cap.bank.X, cap.pits.X, cap.pits.O, cap.last.cap], ['continue', 'capture', false, 5, [0, 0, 0, 2], [0, 0, 0, 2], { i: 1, n: 5 }]);
  const win = board([0, 0, 0, 1], [3, 3, 3, 3], 9);                // (the winning seed also leaves X's side empty: the target is looked at first)
  r = E.applyMove(win, 'X', 3, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.winner, r.note, win.bank, win.pits.O, win.last.again, 'sw' in win.last], ['win', undefined, 'won', { X: 10, O: 0 }, [3, 3, 3, 3], false, false], 'won by the target, nothing swept, no go-again');
  E.setTune('mancala', { extra: 'off', capture: 'off' });
  try { const t = E.newMini('mancala', E.makeRng('g')); t.pits.X = [1, 0, 0, 0, 0, 1]; const r3 = E.applyMove(t, 'X', 5, E.makeRng('x')); assert.deepEqual([r3.outcome, !!r3.again], ['continue', false]); } finally { E.setTune('mancala', null); }
});

test('mancala: a move that leaves either side with no seeds ends the square at once: the seeds left go to their owners\' banks, the higher bank wins', () => {
  // X sows its last seed into its bank: its side is empty, so O's seeds go to O's bank (4 + 6 against 5)
  let m = board([0, 0, 0, 1], [2, 1, 0, 3], 4, 4), before = total(m);
  let r = E.applyMove(m, 'X', 3, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.winner, r.note, !!r.again], ['win', 'O', 'swept', false], 'the other side wins on the count, the go-again gone with the square');
  assert.deepEqual([m.bank, emptyAll(m), total(m)], [{ X: 5, O: 10 }, true, before], 'every seed in a bank, none lost');
  assert.deepEqual([m.last.sw, m.last.fin, m.last.from, m.last.to], [{ X: [0, 0, 0, 0], O: [2, 1, 0, 3] }, { X: 5, O: 10 }, 4, 5]);
  // a capture takes the other side's last seeds: the mover's own go to its bank
  m = board([1, 0, 2, 0], [0, 0, 4, 0], 2, 3);
  r = E.applyMove(m, 'X', 0, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.winner, r.note, m.bank, m.last.cap, m.last.sw.X], ['win', 'X', 'swept', { X: 9, O: 3 }, { i: 1, n: 5 }, [0, 0, 2, 0]]);
  // level banks: a draw (the square resets)
  m = board([0, 0, 0, 1], [1, 0, 0, 0], 3, 3);
  r = E.applyMove(m, 'X', 3, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, m.bank, m.last.fin], ['draw', 'tie', { X: 4, O: 4 }, { X: 4, O: 4 }]);
  // both sides empty at once: nothing to sweep, the banks as they stand
  m = board([1, 0, 0, 0], [0, 0, 4, 0], 2, 6);
  r = E.applyMove(m, 'X', 0, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.winner, m.bank, m.last.sw], ['win', 'X', { X: 7, O: 6 }, { X: [0, 0, 0, 0], O: [0, 0, 0, 0] }]);
  // the swept banks may pass the target: the higher still wins
  m = board([0, 0, 0, 1], [5, 5, 0, 0], 8, 3);
  r = E.applyMove(m, 'X', 3, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.winner, m.bank], ['win', 'O', { X: 9, O: 13 }]);
  // 'end' is never a move while both sides have seeds
  assert.equal(E.applyMove(board([1, 0, 0, 0], [1, 0, 0, 0]), 'X', 'end', E.makeRng('x')).reason, 'canmove');
});

test('mancala: under the end by an empty side the square always ends, never with a side left empty, and nothing asks for \'end\'', () => {
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('play' + g), m = E.newMini('mancala', rng); let p = 'X', out = null;
    for (let k = 0; k < 400 && !out; k++) {
      const mv = E.randomLegalMove(m, p, rng); assert.notEqual(mv, 'end', 'a side never sits empty on a turn');
      const r = E.applyMove(m, p, mv, rng); assert.ok(r.ok, r.reason); assert.equal(total(m), 36);
      if (r.outcome !== 'continue') out = r;
      else { assert.ok(m.pits.X.some(v => v > 0) && m.pits.O.some(v => v > 0), 'both sides still hold seeds'); if (!r.again) p = p === 'X' ? 'O' : 'X'; }
    }
    assert.ok(out, 'it ends');
    if (out.note === 'swept' || out.note === 'tie') { assert.ok(emptyAll(m)); assert.equal(out.outcome === 'draw', m.bank.X === m.bank.O); if (out.winner) assert.ok(m.bank[out.winner] > m.bank[out.winner === 'X' ? 'O' : 'X']); }
  }
  E.setTune('mancala', { target: 30 });                          // (a target no one reaches: every square ends by the sweep)
  try {
    let swept = 0;
    for (let g = 0; g < 100; g++) { const rng = E.makeRng('long' + g), m = E.newMini('mancala', rng); let p = 'X'; for (let k = 0; k < 600; k++) { const r = E.applyMove(m, p, E.randomLegalMove(m, p, rng), rng); assert.ok(r.ok); if (r.outcome !== 'continue') { if (r.note === 'swept' || r.note === 'tie') swept++; break; } if (!r.again) p = p === 'X' ? 'O' : 'X'; } }
    assert.equal(swept, 100, 'all ended by the sweep');
  } finally { E.setTune('mancala', null); }
  // a square found with a side already empty (no deal makes one): no pit to sow, 'end' sweeps it
  const odd = board([0, 0, 0, 0], [2, 0, 1, 0], 4, 2);
  assert.deepEqual([R.mancMoves(odd, 'X'), R.mancMoves(odd, 'O'), E.randomLegalMove(odd, 'O', E.makeRng('r'))], [[], [], 'end']);
  assert.equal(E.applyMove(odd, 'O', 0, E.makeRng('x')).reason, 'bad');
  const r = E.applyMove(odd, 'O', 'end', E.makeRng('x'));
  assert.deepEqual([r.outcome, r.winner, r.note, odd.bank, odd.last], ['win', 'O', 'swept', { X: 4, O: 5 }, { by: 'O', again: false, sw: { X: [0, 0, 0, 0], O: [2, 0, 1, 0] }, fin: { X: 4, O: 5 } }]);
});

test('mancala: a square dealt before (v 1) plays on as it was: no sweep, and nothing to sow on your turn ends it for whoever banked more (level: a draw)', () => {
  const old = board([0, 0, 0, 1], [2, 1, 0, 3], 4, 3, 1);
  let r = E.applyMove(old, 'X', 3, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, old.pits.O, 'sw' in old.last], ['continue', 'again', true, [2, 1, 0, 3], false], 'its side empty, the square goes on');
  const m = board([0, 0, 0, 0], [2, 2, 2, 2], 4, 2, 1);
  assert.deepEqual(R.mancMoves(m, 'X'), []); assert.equal(E.randomLegalMove(m, 'X', E.makeRng('r')), 'end');
  r = E.applyMove(m, 'X', 'end', E.makeRng('x')); assert.deepEqual([r.outcome, r.winner, r.note, m.last], ['win', 'X', 'out', { by: 'X', end: true }]);
  const lvl = board([0, 0, 0, 0], [1, 0, 0, 0], 3, 3, 1); assert.equal(E.applyMove(lvl, 'X', 'end', E.makeRng('x')).outcome, 'draw');
  assert.equal(E.applyMove(board([1, 0, 0, 0], [1, 0, 0, 0], 0, 0, 1), 'X', 'end', E.makeRng('x')).reason, 'canmove');
  for (let g = 0; g < 60; g++) {                                 // X alone, O never playing: it ends, and X has banked more
    const rng = E.makeRng('solo' + g), t = E.newMini('mancala', rng); t.v = 1; let out = null;
    for (let k = 0; k < 200 && !out; k++) { const r2 = E.applyMove(t, 'X', E.randomLegalMove(t, 'X', rng), rng); if (r2.outcome !== 'continue') out = r2; }
    assert.ok(out && out.outcome === 'win' && (out.winner || 'X') === 'X', 'alone, X takes it');
  }
});

// Each of X's moves from a position: what it comes to at once (win, lose, draw or on).
const outcomes = m => R.mancMoves(m, 'X').map(i => {
  const t = JSON.parse(JSON.stringify(m)), r = E.applyMove(t, 'X', i, E.makeRng('o'));
  return { i, k: r.outcome === 'continue' ? 'on' : r.outcome === 'draw' ? 'draw' : (r.winner || 'X') === 'X' ? 'win' : 'lose' };
});
// A level's whole turn from a position (its go-agains played on): how it ends for X, and its first move.
function turnOf(m, level, seed) {
  const t = JSON.parse(JSON.stringify(m)), rng = E.makeRng(seed);
  let first = null;
  for (let k = 0; k < 40; k++) {
    const mv = E.localBest(E.publicMini(t, 'X'), 'X', rng, {}, { level, until: null }).move, r = E.applyMove(t, 'X', mv, rng);
    if (first == null) first = mv;
    assert.ok(r.ok, r.reason);
    if (r.outcome !== 'continue') return { first, k: r.outcome === 'draw' ? 'draw' : (r.winner || 'X') === 'X' ? 'win' : 'lose' };
    if (!r.again) return { first, k: 'on' };
  }
  return { first, k: 'on' };
}
test('mancala: the computer knows the end by an empty side: it takes a win there and never empties a side into a loss while it can play on', () => {
  const seen = { win: 0, lose: 0 };
  E.setTune('mancala', { target: 30 });                          // (a target out of reach: the squares run on to the sweep)
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('ai' + g), m = E.newMini('mancala', rng); let p = 'X';
    for (let k = 0; k < 120; k++) {
      if (p === 'X') {
        const o = outcomes(m), win = o.filter(x => x.k === 'win').map(x => x.i), lose = o.filter(x => x.k === 'lose').map(x => x.i), on = o.some(x => x.k === 'on');
        if (win.length || (lose.length && on)) {
          if (win.length) seen.win++; else seen.lose++;
          for (const level of ['normal', 'hard']) {
            const t = turnOf(m, level, level + g + ':' + k);
            if (win.length) assert.equal(t.k, 'win', `${level} wins there this turn (it played ${t.first}; ${win} won at once)`);
            else assert.ok(!lose.includes(t.first), `${level} plays on rather than lose by the sweep (${t.first})`);
          }
          assert.ok(!win.length || win.includes(E.localBest(E.publicMini(m, 'X'), 'X', E.makeRng('n' + g + k), {}, { level: 'normal', until: null }).move), 'Normal takes the win at once');
        }
      }
      const r = E.applyMove(m, p, E.randomLegalMove(m, p, rng), rng);
      if (r.outcome !== 'continue') break; if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  E.setTune('mancala', null);
  assert.ok(seen.win > 20 && seen.lose > 5, JSON.stringify(seen));
});

test('mancala: the computer banks what it can (Hard looks ahead and beats Easy); the flash carries the sowing', () => {
  for (let g = 0; g < 40; g++) {                                 // Normal never banks less this turn than the best single sowing would, give or take its care for the reply
    const m = E.newMini('mancala', E.makeRng('n' + g)), c = R.mancCfg(m), gain = i => { const r = R.mancSow(m.pits, m.bank, 'X', i, c); return r.bank.X - m.bank.X + (r.again ? 0.8 : 0); };
    const mv = E.localBest(E.publicMini(m), 'X', E.makeRng('r' + g), {}, { level: 'normal' }).move, top = Math.max(...R.mancMoves(m, 'X').map(gain));
    assert.ok(gain(mv) >= top - 2.01, `a move worth ${gain(mv)} of ${top}`);
  }
  const one = board([0, 0, 0, 0, 0, 1], [3, 3, 3, 3, 3, 3], 9);
  for (const level of ['easy', 'normal', 'hard']) assert.equal(E.localBest(E.publicMini(one), 'X', E.makeRng(level), {}, { level }).move, 5, level + ': the seed that wins');
  let hard = 0;
  for (let g = 0; g < 30; g++) {
    const rng = E.makeRng('h' + g), t = E.newMini('mancala', rng), lv = g % 2 ? { X: 'hard', O: 'easy' } : { X: 'easy', O: 'hard' }; let p = 'X';
    for (let k = 0; k < 300; k++) { const r = E.applyMove(t, p, E.localBest(E.publicMini(t), p, rng, {}, { level: lv[p] }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome !== 'continue') { if (r.outcome === 'win' && lv[r.winner || p] === 'hard') hard++; break; } if (!r.again) p = p === 'X' ? 'O' : 'X'; }
  }
  assert.ok(hard >= 26, `Hard beat Easy in ${hard} of 30`);
  const st = E.newMatch(E.makeRng('i'), { games: ['mancala'] }), p = st.turn, q = st.squares[4].mini;
  assert.ok(E.playMove(st, 4, R.mancMoves(q, p)[0], E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.mc).sort(), ['again', 'by', 'cap', 'from', 'i', 'n', 'path', 'to']); assert.equal(R.timeoutClose(q, p), null);
});

test('mancala: a square ended by the sweep: its flash carries the sweep, its moments come in order inside flashMs, and it is a plain record', () => {
  const st = E.newMatch(E.makeRng('sw'), { games: ['mancala'] }), sq = st.squares[4], p = st.turn, o = p === 'X' ? 'O' : 'X';
  Object.assign(sq.mini, { v: 2, pits: { [p]: [0, 0, 0, 0, 0, 1], [o]: [1, 2, 0, 0, 3, 1] }, bank: { [p]: 3, [o]: 2 }, last: null });   // (its last seed in hand: sown into its bank, its side is empty)
  const r = E.playMove(st, 4, 5, E.makeRng('s'));
  assert.ok(r.ok); const f = st.flash, l = f.mc;
  assert.deepEqual([f.kind, f.winner, l.fin, l.sw[o]], ['claim', o, { [p]: 4, [o]: 9 }, [1, 2, 0, 0, 3, 1]]);
  assert.ok(!/undefined|NaN/.test(JSON.stringify(f)) && JSON.stringify(JSON.parse(JSON.stringify(f.mc))) === JSON.stringify(f.mc));
  const T = R.mancTimes(l);
  assert.deepEqual([T.side, T.ks], [o, [0, 1, 4, 5]]);
  assert.ok(T.sow < T.scoop[0] && T.scoop.every((t, k) => !k || t > T.scoop[k - 1]) && T.scoop[3] < T.drop && T.drop < T.count && T.count + Math.max(T.cms.X, T.cms.O) < T.say, JSON.stringify(T));
  assert.deepEqual(T.cms, { [p]: Math.round(1000 * 4 / 9), [o]: 1000 });
  assert.ok(R.flashMs(f, 4, true) >= T.say + R.MANC.hold, 'the verdict is read before the result goes');
  assert.equal(R.mancMs({ by: 'X', end: true }), 200, 'an old square\'s count-up as it was');
});
