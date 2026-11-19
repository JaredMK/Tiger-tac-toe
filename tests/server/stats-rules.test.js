'use strict';
// The stats rules (functions/statsRules.js): a phone's report checked, and the rows the server keeps (December 2026: one
// row a match, mfacts/{day}/{id}: its start, then what its end adds; one a Find Match search; no counters).
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../functions/statsRules.js');
const E = require('../engine.js');

test('stats periods: the New York day, ISO week and month', () => {
  const k = t => S.periodKeys(Date.parse(t));
  assert.deepEqual(k('2026-10-13T12:00:00Z'), { d: '2026-10-13', w: '2026-W42', m: '2026-10', a: 'all' });
  assert.deepEqual(k('2026-10-14T03:30:00Z'), { d: '2026-10-13', w: '2026-W42', m: '2026-10', a: 'all' }, 'still the 13th in New York (EDT)');
  assert.deepEqual(k('2025-12-29T05:30:00Z'), { d: '2025-12-29', w: '2026-W01', m: '2025-12', a: 'all' }, 'a week belongs to the year of its Thursday');
  assert.deepEqual(k('2025-12-29T04:30:00Z').d, '2025-12-28', 'before midnight in New York (EST)');
  assert.deepEqual(k('2027-01-01T04:00:00Z'), { d: '2026-12-31', w: '2026-W53', m: '2026-12', a: 'all' });
  assert.deepEqual(k('2026-03-08T06:59:00Z').d, '2026-03-08', 'daylight saving starts');
  assert.deepEqual(k('2026-03-01T04:59:00Z').d, '2026-02-28');
});

test('stats: a phone\'s report of a match is checked and trimmed; anything that does not hold together is refused', () => {
  const ok = S.checkEnd({ winner: 'X', reason: 'line', squares: [{ t: 'ttt', end: 'won', w: 'X', X: 3, O: 2, extra: 'dropped' }, { t: 'pig', end: 'open', w: 'O', X: 1, O: 0 }] }, E.TYPES);
  assert.deepEqual(ok, { winner: 'X', reason: 'line', sc: false, squares: [{ t: 'ttt', end: 'won', w: 'X', X: 3, O: 2, v: 1 }, { t: 'pig', end: 'open', w: null, X: 1, O: 0, v: 1 }] });
  for (const bad of [null, {}, { squares: 'x' }, { squares: [{ t: 'chess', end: 'won', w: 'X', X: 1, O: 1 }] }, { squares: [{ t: 'ttt', end: 'won', w: null, X: 1, O: 1 }] },
    { squares: [{ t: 'ttt', end: 'gone', X: 1, O: 1 }] }, { squares: [{ t: 'ttt', end: 'open', X: -1, O: 1 }] }, { squares: [{ t: 'ttt', end: 'open', X: 1.5, O: 1 }] },
    { squares: Array(81).fill({ t: 'ttt', end: 'open', X: 1, O: 1 }) }]) assert.equal(S.checkEnd(bad, E.TYPES), null, JSON.stringify(bad).slice(0, 60));
  assert.equal(S.checkEnd({ winner: 'Z', reason: 'magic', squares: [] }, E.TYPES).winner, null);
  assert.ok(S.idOk('abc123') && !S.idOk('a/b') && !S.idOk('x') && !S.idOk(5));
});

test('a match\'s row: its start (mode, timer, players, mine) and what its end adds (result, length, every square); nothing unknown kept', () => {
  const t = Date.parse('2026-10-13T12:00:00Z'), h = 'ab'.repeat(10);
  const start = S.factStart('cpu', t, [{ s: 'O', u: 'uid1', h, pl: 'web', cv: '1.22.0', extra: 1 }], { timer: 'none', own: true });
  assert.deepEqual(start, { t0: t, m: 'cpu', tm: 'none', who: [{ s: 'O', u: 'uid1', h, pl: 'web', cv: '1.22.0' }], own: true });
  assert.deepEqual(S.factStart('friend', t, [{ s: 'X', u: 'a', h: 'nothex', pl: 'android', cv: 'x' }, { s: 'O', u: 'b', bot: true }, {}], { timer: 'm5+5', room: 'ABCDE' }),
    { t0: t, m: 'friend', tm: 'm5+5', who: [{ s: 'X', u: 'a' }, { s: 'O', u: 'b', bot: true }], rm: 'ABCDE' }, 'a device hash, a platform and a version only as they should be; an empty player dropped');
  assert.equal(S.factStart('nope', t, [], { timer: '../x' }).m, 'local'); assert.equal(S.factStart('cpu', t, [], { timer: '../x' }).tm, 'none', 'nothing but a timer code');
  assert.equal(S.factStart('chaos', t, [], { sc: true }).sc, true);
  const sum = { winner: 'O', reason: 'line', squares: [{ t: 'ttt', end: 'won', w: 'O', X: 2, O: 3, v: 2, f: 'X', ms: 20500.4 }, { t: 'ttt', end: 'draw', w: null, X: 2, O: 2, v: 1 }, { t: 'bs', end: 'open', w: null, X: 1, O: 0, race: 1 }] };
  const end = S.factEnd(sum, 90000, t + 90000);
  assert.deepEqual(Object.assign({}, end, { sq: JSON.parse(end.sq) }), { t1: t + 90000, end: 'line', w: 'O', n: 10, ms: 90000,
    sq: [{ t: 'ttt', v: 2, end: 'won', w: 'O', X: 2, O: 3, f: 'X', ms: 20500 }, { t: 'ttt', end: 'draw', X: 2, O: 2 }, { t: 'bs', end: 'open', X: 1, race: 1 }] });
  assert.equal(typeof end.sq, 'string', 'the squares as one string (a list in the database would be an object of numbered keys)');
  assert.equal(S.factEnd(Object.assign({}, sum, { reason: 'resign' }), 1, t).end, 'resign');
  assert.equal(S.factEnd({ winner: 'draw', reason: 'blocked', squares: [] }, 60000, t).w, undefined, 'a drawn match has no winner');
  assert.equal(S.factEnd({ winner: 'X', reason: 'timeout', squares: [] }, S.MAX_MS + 1, t).ms, undefined, 'a match left for hours and picked up again has no time');
  assert.equal(S.factEnd(S.checkEnd({ sc: true, squares: [] }, E.TYPES), 1, t).sc, true);
  assert.notEqual(S.hashId('u:abc'), 'u:abc'); assert.equal(S.hashId('u:abc'), S.hashId('u:abc')); assert.equal(S.hashId('u:abc').length, 20);
});

test('a Find Match search\'s row: how it ended, the wait, whose, mine', () => {
  const t = Date.parse('2026-10-13T12:00:00Z');
  assert.deepEqual(S.factFind('people', 6500.4, t, 'uid1', false), { t, k: 'people', ms: 6500, u: 'uid1' });
  assert.deepEqual(S.factFind('bot', 21000, t, 'uid1', true), { t, k: 'bot', ms: 21000, u: 'uid1', own: true });
  assert.equal(S.factFind('nope', -5, t, 'u').k, 'cancel'); assert.equal(S.factFind('cancel', -5, t, 'u').ms, 0);
});

test('stats: the engine\'s match summary feeds the match\'s row directly', () => {
  const st = E.newMatch(E.makeRng('stats'));
  st.squares[0].mini = E.newMini('ttt', E.makeRng('a'));
  for (const [i, m] of [[0, 0], [0, 3], [0, 1], [0, 4], [0, 2]]) { E.playMove(st, i, m, E.makeRng('m')); E.endFlash(st); }
  const sum = S.checkEnd(E.matchStats(st), E.TYPES);
  assert.deepEqual(sum.squares, [{ t: 'ttt', end: 'won', w: 'X', X: 3, O: 2, v: 1, f: 'X', i: 0, k: 1, jX: 2, jO: 2 }]);
  const row = S.factEnd(sum, 1000, Date.now());
  assert.deepEqual(JSON.parse(row.sq), [{ t: 'ttt', end: 'won', w: 'X', X: 3, O: 2, f: 'X', i: 0, k: 1, jX: 2, jO: 2 }]); assert.equal(row.n, 5);
});

// December 2026, the match data: a match's setup and every play's facts, as the engine makes them, through the server's checks
// (a local match's report: checkEnd) onto the row (factStart's su, factEnd's sq and the match's own facts).
test('stats: the match data: setup, every play (square, pick, follows, times, sides, timeouts, "?" taps) and the match point reach the row', () => {
  const st = E.newMatch(E.makeRng('facts'));
  for (const i of [0, 4]) st.squares[i].mini = E.newMini('ttt', E.makeRng('t' + i));
  let at = 5000;
  const go = (i, m) => { at += 3000; const r = E.playMove(st, i, m, E.makeRng('m'), { at }); assert.ok(r.ok, JSON.stringify(r)); E.endFlash(st); };
  go(4, 0);            // X begins square 4 (the centre): pick 1
  go(4, 4);            // O follows X into it
  go(0, 0);            // X begins the corner: pick 2, not where O just played
  go(0, 4);            // O follows X into the corner
  const m = E.matchStats(st);
  assert.deepEqual(m.squares.map(e => [e.t, e.i, e.k, e.f, e.oj || 0, e.end]), [['ttt', 4, 1, 'X', 0, 'open'], ['ttt', 0, 2, 'X', 0, 'open']]);
  assert.deepEqual([m.squares[0].jO, m.squares[0].jX, m.squares[0].s], [1, undefined, 0], 'O followed X into the centre; the first play begins at the match\'s first move');
  assert.equal(m.squares[1].s, 6000, 'the corner begun two moves (6 s) later');
  assert.deepEqual([m.squares[0].mX, m.squares[0].mO, m.squares[1].mX, m.squares[1].mO], [undefined, 3000, 3000, 3000], 'each side\'s time on its turns there');
  // the report a phone sends (help taps added by the page), checked by the server and written as the row
  m.squares[0].hX = 2;
  const sum = S.checkEnd(Object.assign({}, m, { winner: null, reason: 'left', ab: 0, mp: 'X', mpn: 7, tmo: { X: 1, O: 0 } }), E.TYPES);
  assert.equal(sum.squares[0].hX, 2); assert.deepEqual([sum.mp, sum.mpn, sum.ab, sum.tmo], ['X', 7, 0, { X: 1, O: 0 }]);
  const row = S.factEnd(sum, 20000, Date.now());
  assert.equal(row.end, 'left', 'a guest\'s match left part way: abandoned');
  assert.deepEqual([row.mp, row.mpn, row.ab, row.tmo], ['X', 7, 0, { X: 1, O: 0 }]);
  assert.deepEqual(JSON.parse(row.sq).map(e => [e.i, e.k, e.hX || 0]), [[4, 1, 2], [0, 2, 0]]);
  assert.ok(S.ABANDONED.includes('left'));
  // nonsense is dropped, the rest kept
  const bad = S.checkEnd({ squares: [{ t: 'ttt', end: 'open', X: 1, O: 0, i: 12, k: -1, s: -5, jX: 'a', hO: 3 }], reason: 'left', ab: 40, mp: 'Z' }, E.TYPES);
  assert.deepEqual(bad.squares[0], { t: 'ttt', end: 'open', w: null, X: 1, O: 0, v: 1, hO: 3 });
  assert.deepEqual([bad.ab, bad.mp], [undefined, undefined]);
  // the setup: what the checklist offered and left out, the nine dealt, the level, the first mover, a rematch's match
  const su = S.factSetup({ av: ['ttt', 'c4', 'bs', 'nope'], ex: ['bs'], b: st.squares.map(q => q.mini.type), lv: 'hard', f1: 'X', rp: 'l_abcdef12' }, E.TYPES);
  const start = S.factStart('cpu', 1000, [{ s: 'X', u: 'acct1' }], { su });
  assert.deepEqual(JSON.parse(start.su), { av: ['ttt', 'c4', 'bs'], ex: ['bs'], b: st.squares.map(q => q.mini.type), lv: 'hard', f1: 'X', rp: 'l_abcdef12' });
  assert.equal(S.factSetup({ b: ['ttt'] }, E.TYPES), undefined, 'a board that is not nine games: left out (and nothing else: no setup)');
});

test('stats: Snakes and Ladders and Bump are kept; a Dice race from an older match still is, under its own name', () => {
  const types = E.TYPES.concat(E.OLD_TYPES);
  const sum = S.checkEnd({ winner: 'X', reason: 'line', squares: [{ t: 'snakes', end: 'won', w: 'X', X: 5, O: 4 }, { t: 'bump', end: 'won', w: 'O', X: 3, O: 4 }, { t: 'dice', end: 'open', X: 1, O: 1 }] }, types);
  assert.deepEqual(sum.squares.map(e => e.t), ['snakes', 'bump', 'dice']);
  assert.deepEqual(JSON.parse(S.factEnd(sum, 60000, Date.parse('2026-10-13T12:00:00Z')).sq).map(e => [e.t, e.end, e.w]), [['snakes', 'won', 'X'], ['bump', 'won', 'O'], ['dice', 'open', undefined]], 'kept apart as the Dice race');
  assert.equal(S.checkEnd({ squares: [{ t: 'dice', end: 'open', X: 1, O: 1 }] }, E.TYPES), null, 'only accepted where older games are allowed');
  // a match played with the new games: what the server records from it
  const st = E.newMatch(E.makeRng('sb'), { games: ['snakes', 'bump'] });
  const rng = E.makeRng('sbm');
  for (let k = 0; k < 400 && !st.winner; k++) {
    const i = st.squares.findIndex(q => !q.owner);
    const r = E.playMove(st, i, st.squares[i].mini.type === 'snakes' ? 'roll' : 'spin', rng);
    assert.equal(r.ok, true); E.endFlash(st);
  }
  assert.ok(st.winner, 'the match ends');
  const s2 = S.checkEnd(E.matchStats(st), E.TYPES);
  assert.ok(s2.squares.length >= 3 && s2.squares.every(e => ['snakes', 'bump'].includes(e.t)));
});

test('playtest log: an error event from a phone (a move that would not save) is kept with its line and its match; anything malformed is not', () => {
  const t = 1700000000000, dev = 'd0123456789abcdef0123456';
  const ok = S.checkDev({ dev, ev: 'error', o: 'o12345678', msg: 'scmove: move not saved: PERMISSION_DENIED (round 2, square 4)', mode: 'friend', g: 'fABCDE_m1' }, t);
  assert.ok(ok && ok.k === 'xo12345678');
  assert.deepEqual(ok.ev, { t, ev: 'error', msg: 'scmove: move not saved: PERMISSION_DENIED (round 2, square 4)', m: 'friend', g: 'fABCDE_m1' });
  const bare = S.checkDev({ dev, ev: 'error', o: 'o12345678', msg: 'x'.repeat(400) + '\u0007' }, t);
  assert.deepEqual(bare.ev, { t, ev: 'error', msg: 'x'.repeat(160) }, 'no match named: just the line, cut short, printable only');
  assert.equal(S.checkDev({ dev, ev: 'error', o: 'o12345678', msg: '   ' }, t), null, 'no line: nothing kept');
  assert.equal(S.checkDev({ dev, ev: 'error', o: 'bad', msg: 'hm' }, t), null);
  assert.equal(S.checkDev({ dev, ev: 'error', o: 'o12345678', msg: 'hm', mode: 'nope', g: 'fABCDE_m1' }, t).ev.g, undefined, 'a mode not known: the match left off');
  assert.ok(S.DEV_EVENTS.includes('error'));
});

test('playtest log: an audio event (the phone\'s sound going down, coming back or failing) is kept like an error line, with its match', () => {
  const t = 1700000000000, dev = 'd0123456789abcdef0123456';
  const ok = S.checkDev({ dev, ev: 'audio', o: 'a12345678', msg: 'new context (tap, was running, clock stopped): running', mode: 'cpu', g: 'labcdef12', v: 'a1b2c3d' }, t);
  assert.ok(ok && ok.k === 'aa12345678' && ok.v === 'a1b2c3d');
  assert.deepEqual(ok.ev, { t, ev: 'audio', msg: 'new context (tap, was running, clock stopped): running', m: 'cpu', g: 'labcdef12' });
  assert.deepEqual(S.checkDev({ dev, ev: 'audio', o: 'a12345678', msg: 'state interrupted' }, t).ev, { t, ev: 'audio', msg: 'state interrupted' }, 'outside a match: the device\'s log only');
  assert.equal(S.checkDev({ dev, ev: 'audio', o: 'a12345678', msg: '' }, t), null);
  assert.ok(S.DEV_EVENTS.includes('audio'));
});

test('stats: a runner square keeps its runs, metres and crashes on the match\'s row', () => {
  const run = { runs: { X: 2, O: 1 }, dist: { X: 120, O: 60 }, crashes: { X: [55, 120], O: [60] } };
  const sum = S.checkEnd({ winner: 'X', reason: 'line', squares: [{ t: 'dash', end: 'won', w: 'X', X: 2, O: 1, run }] }, E.TYPES);
  assert.deepEqual(JSON.parse(S.factEnd(sum, 1000, Date.parse('2026-10-13T12:00:00Z')).sq)[0].run, run);
});
