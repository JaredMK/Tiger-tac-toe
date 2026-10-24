'use strict';
// The stats rules (functions/statsRules.js): what one match, login or new account adds to the totals.
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
  assert.deepEqual(ok, { winner: 'X', reason: 'line', sc: false, squares: [{ t: 'ttt', end: 'won', w: 'X', X: 3, O: 2 }, { t: 'pig', end: 'open', w: null, X: 1, O: 0 }] });
  for (const bad of [null, {}, { squares: 'x' }, { squares: [{ t: 'chess', end: 'won', w: 'X', X: 1, O: 1 }] }, { squares: [{ t: 'ttt', end: 'won', w: null, X: 1, O: 1 }] },
    { squares: [{ t: 'ttt', end: 'gone', X: 1, O: 1 }] }, { squares: [{ t: 'ttt', end: 'open', X: -1, O: 1 }] }, { squares: [{ t: 'ttt', end: 'open', X: 1.5, O: 1 }] },
    { squares: Array(81).fill({ t: 'ttt', end: 'open', X: 1, O: 1 }) }]) assert.equal(S.checkEnd(bad, E.TYPES), null, JSON.stringify(bad).slice(0, 60));
  assert.equal(S.checkEnd({ winner: 'Z', reason: 'magic', squares: [] }, E.TYPES).winner, null);
  assert.ok(S.idOk('abc123') && !S.idOk('a/b') && !S.idOk('x') && !S.idOk(5));
});

test('stats: a finished match adds its mode\'s totals and every mini-game played in it', () => {
  const t = Date.parse('2026-10-13T12:00:00Z');
  const sum = { winner: 'O', reason: 'line', squares: [
    { t: 'ttt', end: 'won', w: 'O', X: 2, O: 3 }, { t: 'ttt', end: 'draw', w: null, X: 2, O: 2 }, { t: 'bs', end: 'open', w: null, X: 1, O: 0 }] };
  const all = S.endUpdates('cpu', sum, 90000, t, false);
  const up = Object.fromEntries(Object.entries(all).filter(([k]) => !/^(days|weeks|months)\/[^/]+\/modes\//.test(k)));
  for (const [k, n] of Object.entries(all)) if (k.startsWith('modes/')) for (const p of ['days/2026-10-13', 'weeks/2026-W42', 'months/2026-10']) assert.equal(all[`${p}/${k}`], n, `${p}/${k}`);
  assert.equal(Object.keys(all).length, Object.keys(up).length + 3 * Object.keys(up).filter(k => k.startsWith('modes/')).length, 'only the mode totals are kept per period');
  assert.deepEqual(up, {
    'modes/cpu/finished': 1, 'days/2026-10-13/finished/cpu': 1, 'modes/cpu/turns': 10, 'modes/cpu/oWins': 1, 'modes/cpu/ms': 90000, 'modes/cpu/timed': 1,
    'modes/cpu/done': 1, 'modes/cpu/doneTurns': 10, 'modes/cpu/doneMs': 90000, 'modes/cpu/doneTimed': 1,
    'mini/cpu/ttt/played': 2, 'mini/cpu/ttt/won': 1, 'mini/cpu/ttt/allMoves': 9, 'mini/cpu/ttt/winMoves': 3, 'mini/cpu/ttt/loseMoves': 2, 'mini/cpu/ttt/oWins': 1, 'mini/cpu/ttt/draw': 1,
    'mini/cpu/bs/played': 1, 'mini/cpu/bs/open': 1, 'mini/cpu/bs/allMoves': 1,
  });
  const gaveUp = S.endUpdates('cpu', Object.assign({}, sum, { reason: 'resign' }), 90000, t, false);   // abandoned: the mode's totals, none of its squares, no finished-only counters
  assert.equal(gaveUp['modes/cpu/resigned'], 1); assert.equal(gaveUp['modes/cpu/done'], undefined);
  assert.equal(Object.keys(gaveUp).filter(k => k.startsWith('mini/')).length, 0);
  const chaos = S.endUpdates('friend', Object.assign({}, sum, { sc: true }), 90000, t, false, ['bs']);   // Super Chaos squares apart, a friend room's too
  assert.equal(chaos['mini/chaos/ttt/won'], 1); assert.equal(chaos['mini/testingSc/bs/open'], 1); assert.equal(chaos['mini/friend/ttt/won'], undefined);
  assert.equal(S.endUpdates('chaos', sum, 1, t, false)['mini/chaos/ttt/won'], 1);
  assert.equal(S.checkEnd({ sc: true, squares: [] }, E.TYPES).sc, true);
  const drawn = S.endUpdates('cpu', S.checkEnd({ winner: 'draw', reason: 'blocked', squares: [] }, E.TYPES), 60000, t, false);   // no line left for either side
  assert.equal(drawn['modes/cpu/draws'], 1); assert.equal(drawn['modes/cpu/xWins'], undefined); assert.equal(drawn['modes/cpu/oWins'], undefined);
  const late = S.endUpdates('local', { winner: 'X', reason: 'timeout', squares: [] }, S.MAX_MS + 1, t, true);
  assert.equal(late['modes/local/started'], 1, 'a start never reported is counted with the end');
  assert.equal(late['modes/local/timeouts'], 1);
  assert.equal(late['modes/local/ms'], undefined, 'a match left for hours and picked up again has no time');
  assert.deepEqual(S.startUpdates('ranked', t), { 'modes/ranked/started': 1, 'days/2026-10-13/started/ranked': 1,
    'days/2026-10-13/modes/ranked/started': 1, 'weeks/2026-W42/modes/ranked/started': 1, 'months/2026-10/modes/ranked/started': 1 });
  assert.deepEqual(S.periodUpdates('logins', t), { 'days/2026-10-13/logins': 1, 'weeks/2026-W42/logins': 1, 'months/2026-10/logins': 1, 'alltime/logins': 1 });
  assert.notEqual(S.hashId('u:abc'), 'u:abc'); assert.equal(S.hashId('u:abc'), S.hashId('u:abc')); assert.equal(S.hashId('u:abc').length, 20);
});

test('stats: the engine\'s match summary feeds the stats directly', () => {
  const st = E.newMatch(E.makeRng('stats'));
  st.squares[0].mini = E.newMini('ttt', E.makeRng('a'));
  for (const [i, m] of [[0, 0], [0, 3], [0, 1], [0, 4], [0, 2]]) { E.playMove(st, i, m, E.makeRng('m')); E.endFlash(st); }
  const sum = S.checkEnd(E.matchStats(st), E.TYPES);
  assert.deepEqual(sum.squares, [{ t: 'ttt', end: 'won', w: 'X', X: 3, O: 2 }]);
  const up = S.endUpdates('local', sum, 1000, Date.now(), false);
  assert.equal(up['mini/local/ttt/winMoves'], 3); assert.equal(up['mini/local/ttt/loseMoves'], 2); assert.equal(up['modes/local/turns'], 5);
});

test('stats: Snakes and Ladders and Bump are counted; a Dice race from an older match still is, under its own name', () => {
  const types = E.TYPES.concat(E.OLD_TYPES);
  const sum = S.checkEnd({ winner: 'X', reason: 'line', squares: [{ t: 'snakes', end: 'won', w: 'X', X: 5, O: 4 }, { t: 'bump', end: 'won', w: 'O', X: 3, O: 4 }, { t: 'dice', end: 'open', X: 1, O: 1 }] }, types);
  assert.deepEqual(sum.squares.map(e => e.t), ['snakes', 'bump', 'dice']);
  const up = S.endUpdates('local', sum, 60000, Date.parse('2026-10-13T12:00:00Z'), false);
  assert.equal(up['mini/local/snakes/played'], 1); assert.equal(up['mini/local/snakes/xWins'], 1);
  assert.equal(up['mini/local/bump/oWins'], 1);
  assert.equal(up['mini/local/dice/open'], 1, 'kept apart as the Dice race');
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

test('stats: a runner square adds its runs, metres and crashes (a finished match), none when the match was abandoned', () => {
  const run = { runs: { X: 2, O: 1 }, dist: { X: 120, O: 60 }, crashes: { X: [55, 120], O: [60] } };
  const sum = S.checkEnd({ winner: 'X', reason: 'line', squares: [{ t: 'dash', end: 'won', w: 'X', X: 2, O: 1, run }] }, E.TYPES);
  const up = S.endUpdates('cpu', sum, 1000, Date.parse('2026-10-13T12:00:00Z'), false);
  assert.equal(up['mini/cpu/dash/runs'], 3); assert.equal(up['mini/cpu/dash/distSum'], 180); assert.equal(up['mini/cpu/dash/crash/50'], 2); assert.equal(up['mini/cpu/dash/finishRuns'], 2);
  const gaveUp = S.endUpdates('cpu', Object.assign({}, sum, { reason: 'resign' }), 1000, Date.parse('2026-10-13T12:00:00Z'), false);
  assert.equal(gaveUp['mini/cpu/dash/runs'], undefined);
});
