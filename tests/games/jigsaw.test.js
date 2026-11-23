'use strict';
// Puzzle Build: its rules, its picture and cut, and its AI, test by test (npm test). The engine is the one the page
// and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/jigsaw/ai.js');
const R = require('../../src/games/jigsaw/rules.js');
const P = require('../../src/games/jigsaw/picture.js');
const M = require('../../src/games/jigsaw/meta.js');
const { timeoutClose } = require('../../src/core/board.js');
const { FIND_MATCH_HOLD } = require('../../src/core/games.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ON = { centre: 'on' };   // (most tests here deal the 3 by 3 with its centre piece in place, the setting's other value: the default is off)
E.setTune('jigsaw', ON);
const mini = (seed, t) => { E.setTune('jigsaw', Object.assign({}, ON, t || {})); try { return E.newMini('jigsaw', E.makeRng(seed || 'jg')); } finally { E.setTune('jigsaw', ON); } };
const other = p => (p === 'X' ? 'O' : 'X');
const draw = (m, p, rng) => E.applyMove(m, p, 'draw', rng || lcg(7));
// A square set by hand: the board as a string, each side's count from it, the piece on show.
const fixed = (placed, offer, by, t) => { const m = mini('fx', t); m.placed = placed; m.got = { X: [...placed].filter(v => v === 'X').length, O: [...placed].filter(v => v === 'O').length }; m.offer = offer == null ? null : offer; m.by = offer == null ? null : by || 'X'; return m; };

test('jigsaw: the defaults: a 3 by 3 puzzle with nothing in place: nine pieces to lay, five take the square (never a draw)', () => {
  E.setTune('jigsaw', null); const d = E.newMini('jigsaw', E.makeRng('dflt')); E.setTune('jigsaw', ON);
  assert.deepEqual([d.n, d.placed, R.jigTotal(d), R.jigNeed(d)], [3, '.........', 9, 5]); assert.equal(d.tune, undefined, 'nothing kept for the defaults');
  assert.equal(E.tuneFields('jigsaw').find(f => f.k === 'centre').def, 'off');
});
test('jigsaw: with the centre piece in place: a 3 by 3 puzzle, the centre laid by nobody; eight pieces to lay, five take the square; nothing drawn, nothing hidden', () => {
  const m = mini();
  assert.deepEqual([m.n, m.placed, m.got, m.offer, m.by, m.k, m.last], [3, '....C....', { X: 0, O: 0 }, null, null, 0, null]);
  assert.ok(Number.isInteger(m.seed) && m.seed >= 0 && m.seed < 1e9, 'the picture\'s seed');
  assert.deepEqual([R.jigTotal(m), R.jigNeed(m), R.jigLeft(m), R.jigEnd(m)], [8, 5, 8, null]);
  assert.deepEqual(R.jigEdge(m), [1, 3, 5, 7], 'the pieces that touch the centre');
  assert.equal(E.secretOf(m), null, 'no secret: the picture is drawn from the public seed');
  const pv = E.publicMini(m);
  assert.deepEqual(Object.assign({}, pv, { tune: undefined }), { type: 'jigsaw', n: 3, seed: m.seed, placed: '....C....', got: { X: 0, O: 0 }, offer: null, by: null, k: 0, last: null, tune: undefined });
  assert.notEqual(mini('a').seed, mini('b').seed, 'a new picture each game');
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder], ['admin', 'brain', '1.30.0', false]);
  assert.ok(FIND_MATCH_HOLD.includes('jigsaw'), 'held out of Find Match: the piece timer is the phone\'s word');
});

test('jigsaw: a turn is two steps: Draw a piece (one whose own cell touches a piece on the board, by the move\'s rng; the turn goes on), then its placement; nothing is on show before the draw', () => {
  const m = mini();
  for (const bad of [0, 4, -1, null, undefined, 'out', 'auto', 'spin', { c: 1 }, [1], { c: 4 }, 1.5]) assert.equal(E.applyMove(m, 'X', bad, lcg(1)).ok, false, `before the draw: ${JSON.stringify(bad)}`);
  assert.equal(E.randomLegalMove(m, 'X', lcg(2)), 'draw');
  assert.deepEqual(draw(m, 'X'), { ok: true, outcome: 'continue', note: 'draw', again: true });
  assert.ok([1, 3, 5, 7].includes(m.offer), 'a piece beside the centre'); assert.deepEqual([m.by, m.k, m.placed, m.got], ['X', 1, '....C....', { X: 0, O: 0 }]);
  assert.equal(draw(m, 'X').ok, false, 'no second draw over a piece on show');
  assert.equal(E.publicMini(m).offer, m.offer, 'public once drawn');
  // the draw is the rng's: over many seeds every piece beside the centre comes up, and never another
  const seen = new Set();
  for (let k = 0; k < 200; k++) { const x = mini(); draw(x, 'O', E.makeRng('d' + k)); seen.add(x.offer); }
  assert.deepEqual([...seen].sort(), [1, 3, 5, 7]);
  // strict placements: an empty cell of the board, as { c } alone
  for (const bad of ['draw', 1, '1', null, undefined, [], [1], {}, { c: -1 }, { c: 9 }, { c: 4 }, { c: 1.5 }, { c: '1' }, { c: 1, x: 2 }, { d: 1 }, 'auto']) assert.equal(E.applyMove(m, 'X', bad, lcg(1)).ok, false, `a placement: ${JSON.stringify(bad)}`);
  const mv = E.randomLegalMove(m, 'X', lcg(5)); assert.ok(mv && Number.isInteger(mv.c) && m.placed[mv.c] === '.', 'the stand-in places on an empty cell');
});

test('jigsaw: the piece in its own cell locks in and is the mover\'s point; any other cell, or the timer run down, scores nothing and the piece goes back in the pile', () => {
  let m = fixed('....C....', 1, 'X');
  assert.deepEqual(E.applyMove(m, 'X', { c: 1 }, lcg(1)), { ok: true, outcome: 'continue', note: 'fits' });
  assert.deepEqual([m.placed, m.got, m.offer, m.by], ['.X..C....', { X: 1, O: 0 }, null, null]);
  assert.deepEqual(m.last, { by: 'X', c: 1, at: 1, ok: true, was: { X: 0, O: 0 }, end: null });
  // wrong: nothing but the pile changes
  m = fixed('.X..C....', 5, 'O');
  const before = JSON.parse(JSON.stringify(m));
  assert.deepEqual(E.applyMove(m, 'O', { c: 2 }, lcg(1)), { ok: true, outcome: 'continue', note: 'wrong' });
  assert.deepEqual([m.placed, m.got, m.seed, m.n, m.k], [before.placed, before.got, before.seed, before.n, before.k], 'the board and the counts as they were');
  assert.deepEqual([m.offer, m.by], [null, null], 'the piece back in the pile');
  assert.deepEqual(m.last, { by: 'O', c: 5, at: 2, ok: false, was: { X: 1, O: 0 }, end: null });
  assert.ok(R.jigEdge(m).includes(5), 'and it can come up again');
  // out of time
  m = fixed('.X..C....', 5, 'O');
  assert.deepEqual(E.applyMove(m, 'O', 'out', lcg(1)), { ok: true, outcome: 'continue', note: 'out' });
  assert.deepEqual([m.placed, m.got, m.offer, m.last.at, m.last.ok], ['.X..C....', { X: 1, O: 0 }, null, -1, false]);
  assert.equal(E.applyMove(m, 'X', 'out', lcg(1)).ok, false, 'no piece on show: nothing to run out on');
  // a wrong cell must still be an empty one
  m = fixed('.X..C....', 5, 'O');
  assert.equal(E.applyMove(m, 'O', { c: 1 }, lcg(1)).ok, false); assert.equal(E.applyMove(m, 'O', { c: 4 }, lcg(1)).ok, false); assert.equal(m.offer, 5, 'a refused move changes nothing');
});

test('jigsaw: the piece on show always touches a piece on the board, through whole squares of random play; a piece is never drawn twice at once and a laid piece never comes back', () => {
  for (const t of [null, { size: 4 }, { size: 5 }, { centre: 'off' }]) {
    for (let g = 0; g < 60; g++) {
      const rng = E.makeRng(`jg-touch:${g}:${JSON.stringify(t)}`), m = mini('t' + g, t); let p = 'X', done = false;
      for (let k = 0; k < 4000 && !done; k++) {
        const laid = R.jigCells(m), any = laid.some(v => v !== '.');
        assert.ok(draw(m, p, rng).ok);
        assert.equal(laid[m.offer], '.', 'a piece still in the pile');
        if (any) assert.ok(R.jigNear(m.n, m.offer).some(j => laid[j] !== '.'), `the piece of cell ${m.offer} touches a piece on the board (${laid.join('')})`);
        const r = E.applyMove(m, p, E.randomLegalMove(m, p, rng), rng);
        assert.ok(r.ok);
        if (r.outcome !== 'continue') done = true; else if (!r.again) p = other(p);
      }
      assert.ok(done, 'the square ended');
    }
  }
});

test('jigsaw: more than half of the pieces takes the square at once; level with none left is a draw (the square resets); a side that cannot get there plays on while the other still can', () => {
  // 5 of 8: the fifth piece wins with pieces still in the pile
  let m = fixed('XXXXC.O..', 5, 'X');
  assert.deepEqual(E.applyMove(m, 'X', { c: 5 }, lcg(1)), { ok: true, outcome: 'win', note: 'won' });
  assert.deepEqual([m.got, m.last.end, R.jigLeft(m)], [{ X: 5, O: 1 }, 'X', 2]);
  assert.equal(draw(m, 'O').ok, false, 'nothing drawn on a square that is decided');
  // O's fifth
  m = fixed('OOXOCOX.X', 7, 'O');
  assert.deepEqual(E.applyMove(m, 'O', { c: 7 }, lcg(1)), { ok: true, outcome: 'win', note: 'won' }); assert.equal(m.last.end, 'O');
  // 4-4: the last piece levels it
  m = fixed('XXXXCOOO.', 8, 'O');
  assert.deepEqual(E.applyMove(m, 'O', { c: 8 }, lcg(1)), { ok: true, outcome: 'draw', note: 'tie' }); assert.deepEqual([m.got, m.last.end], [{ X: 4, O: 4 }, 'draw']);
  // 4-2 with two left: O cannot reach 5 but X can, so it goes on; O's two pieces level it
  m = fixed('XXXXCOO..', 7, 'O');
  assert.equal(R.jigEnd(m), null);
  assert.deepEqual(E.applyMove(m, 'O', { c: 7 }, lcg(1)), { ok: true, outcome: 'continue', note: 'fits' });
  // a wrong piece never ends a square
  m = fixed('XXXXCOOO.', 8, 'X');
  assert.equal(E.applyMove(m, 'X', 'out', lcg(1)).outcome, 'continue');
  // through the match: a draw resets the square with a new game, a win claims it
  let st = E.newMatch(E.makeRng('jg-end'), { games: ['ttt', 'jigsaw'] });
  st.squares[0] = { owner: null, mini: fixed('XXXXCOOO.', 8, 'O') }; st.turn = 'O'; st.lock = 0;
  let r = E.playMove(st, 0, { c: 8 }, E.makeRng('x'));
  assert.ok(r.ok); assert.deepEqual([st.flash.kind, st.flash.note, st.squares[0].owner], ['draw', 'tie', null]); assert.ok(st.flash.newType, 'a new mini-game dealt');
  assert.deepEqual(st.flash.jig, { by: 'O', c: 8, at: 8, ok: true, was: { X: 4, O: 3 }, got: { X: 4, O: 4 }, end: 'draw', placed: 'XXXXCOOOO', fill: 0 });
  st = E.newMatch(E.makeRng('jg-end2'), { games: ['ttt', 'jigsaw'] });
  st.squares[0] = { owner: null, mini: fixed('XXXXC.O..', 5, 'X') }; st.turn = 'X'; st.lock = 0;
  r = E.playMove(st, 0, { c: 5 }, E.makeRng('x'));
  assert.deepEqual([st.flash.kind, st.squares[0].owner, st.flash.jig.end, st.flash.jig.fill], ['claim', 'X', 'X', 2]);
  assert.equal(R.flashMs(st.flash), R.jigTimes(st.flash.jig).end);
  assert.ok(R.jigTimes(st.flash.jig).whole > R.jigTimes(st.flash.jig).fill && R.jigTimes(st.flash.jig).end > R.jigTimes(st.flash.jig).whole + R.JIG.whole, 'the pile drops in, then the picture comes whole, inside the move\'s time');
});

test('jigsaw: the settings: the grid\'s size and its centre piece (an even grid has none), the piece timer, the computer\'s shares; "Go again on success" is off by default', () => {
  const keys = M.TUNE.map(f => f.k);
  assert.deepEqual(keys, ['again', 'size', 'centre', 'edges', 'rotate', 'secs', 'aiEasy', 'aiNormal', 'aiHard', 'aiTurnEasy', 'aiTurnNormal', 'aiTurnHard']);
  for (const k of ['edges', 'rotate']) { const f = E.tuneFields('jigsaw').find(x => x.k === k); assert.deepEqual([f.def, f.opts], ['off', ['off', 'on']], `${k}: off by default`); }
  assert.deepEqual(['edges', 'rotate'].map(k => E.tuneFields('jigsaw').find(x => x.k === k).label), ['Mark edge pieces', 'Pieces drawn rotated']);
  assert.ok(M.TUNE.every(f => ['Board', 'Rules', 'Timing', 'Computer'].includes(f.group)));
  const again = E.tuneFields('jigsaw').find(f => f.k === 'again'); assert.deepEqual([again.label, again.def, again.opts], ['Go again on success', 'off', ['off', 'on']]);
  let m = mini('s4', { size: 4 });
  assert.deepEqual([m.n, m.placed, R.jigTotal(m), R.jigNeed(m)], [4, '.'.repeat(16), 16, 9]); assert.equal(R.jigEdge(m).length, 16, 'an empty board: any piece may come first');
  m = mini('s5', { size: 5 });
  assert.deepEqual([m.n, m.placed.indexOf('C'), R.jigTotal(m), R.jigNeed(m)], [5, 12, 24, 13]);
  m = mini('s3', { centre: 'off' });
  assert.deepEqual([m.placed, R.jigTotal(m), R.jigNeed(m)], ['.........', 9, 5]);
  // nine pieces: never a draw
  for (let x = 0; x <= 5; x++) for (let o = 0; o <= 5 && x + o <= 9; o++) { const f = fixed('X'.repeat(x) + 'O'.repeat(o) + '.'.repeat(9 - x - o), null, null, { centre: 'off' }); assert.notEqual(R.jigEnd(f), 'draw', `${x}-${o} of nine`); }
  // the size is the square's own once dealt
  m = mini('keep', { size: 5 }); assert.equal(R.jigSize(m), 5); assert.equal(R.jigSize({ n: 9 }), 5); assert.equal(R.jigSize({}), 3);
  assert.match(M.explainer.play, /\{secs\}/); assert.match(M.explainer.play, /\{goAgain\}/); assert.deepEqual(Object.keys(M.goAgainText).sort(), ['off', 'on']);
});

test('jigsaw: "Go again on success" on: a piece that fits keeps the turn (the next piece is theirs to draw); a wrong one or the timer ends it; the winning piece ends the square', () => {
  let m = fixed('....C....', 1, 'X', { again: 'on' });
  assert.deepEqual(E.applyMove(m, 'X', { c: 1 }, lcg(1)), { ok: true, outcome: 'continue', note: 'fits', again: true });
  assert.deepEqual(draw(m, 'X'), { ok: true, outcome: 'continue', note: 'draw', again: true });
  const wrong = [0, 2, 3, 5, 6, 7, 8].find(c => c !== m.offer);
  assert.deepEqual(E.applyMove(m, 'X', { c: wrong }, lcg(1)), { ok: true, outcome: 'continue', note: 'wrong' });
  m = fixed('.X..C....', 5, 'X', { again: 'on' });
  assert.deepEqual(E.applyMove(m, 'X', 'out', lcg(1)), { ok: true, outcome: 'continue', note: 'out' });
  m = fixed('XXXXC.O..', 5, 'X', { again: 'on' });
  assert.deepEqual(E.applyMove(m, 'X', { c: 5 }, lcg(1)), { ok: true, outcome: 'win', note: 'won' });
  // a timed-out player gets no extra go (core/board.js: the move that closes a turn out of time never keeps it)
  const st = E.newMatch(E.makeRng('jg-again'), { games: ['ttt', 'jigsaw'] });
  st.squares[0] = { owner: null, mini: mini('ag', { again: 'on' }) }; st.turn = 'X'; st.timer = E.newTimer(30);
  assert.ok(E.playMove(st, 0, 'draw', E.makeRng('d')).ok); E.endFlash(st);
  const r = E.timeoutMove(st, lcg(1));
  assert.deepEqual([r.ok, r.closed, st.turn, st.lock], [true, true, 'X', null]); assert.equal(st.flash.kind, 'move');
});

test('jigsaw: a turn out of time: nothing drawn, a missed turn; a piece on show goes back in the pile with no point, and that is not a miss; no move is ever made for the player', () => {
  let m = mini();
  assert.equal(timeoutClose(m, 'X'), null);
  let st = E.newMatch(E.makeRng('jg-to'), { games: ['ttt', 'jigsaw'] });
  st.squares[0] = { owner: null, mini: m }; st.turn = 'X'; st.timer = E.newTimer(30); st.lock = 0; st.lockBy = 'open';
  let r = E.timeoutMove(st, lcg(1));
  assert.deepEqual([r.ok, r.missed, st.turn, m.placed, m.offer], [true, 'X', 'O', '....C....', null], 'nothing drawn for them');
  m = mini();
  st = E.newMatch(E.makeRng('jg-to2'), { games: ['ttt', 'jigsaw'] });
  st.squares[0] = { owner: null, mini: m }; st.turn = 'X'; st.timer = E.newTimer(30);
  const d = E.playMove(st, 0, 'draw', E.makeRng('jg-d'));
  assert.ok(d.ok); assert.deepEqual([st.flash.kind, st.flash.note, st.lock, st.flash.m], ['again', 'draw', 0, 'draw']);
  assert.deepEqual(st.flash.jig, { draw: true, by: 'X', c: m.offer, k: 1 }, 'the flash carries the piece that came out');
  assert.equal(R.flashMs(st.flash), R.JIG.out + R.JIG.rest);
  const piece = m.offer;
  E.endFlash(st);
  assert.deepEqual([st.screen, st.zoom, st.lock], ['mini', 0, 0], 'held to the square for the placement');
  assert.equal(E.leaveSquare(st), false, 'no leaving with a piece on show');
  assert.equal(timeoutClose(m, 'X'), 'out'); assert.equal(timeoutClose(m, 'O'), null, 'the mover\'s piece alone');
  r = E.timeoutMove(st, lcg(1));
  assert.deepEqual([r.ok, r.closed, r.missed, st.timer.streak.X, st.timer.timeouts.X], [true, true, undefined, 0, 0], 'the turn over, not missed');
  assert.deepEqual([m.placed, m.got, m.offer], ['....C....', { X: 0, O: 0 }, null], 'no piece laid, the piece back in the pile');
  assert.deepEqual([st.flash.jig.c, st.flash.jig.at, st.flash.jig.ok, st.flash.timeout, st.flash.next], [piece, -1, false, true, 'O']);
  assert.equal(st.squares[0].mv.X, 1, 'one turn spent: the draw (the placement is the same turn\'s)');
});

test('jigsaw: online: the draw is the server\'s (its rng), the placement and the phone\'s own timer go in as they are; the server takes no "auto" from a phone; the record round-trips', () => {
  const T = 1e12;
  const m = fixed('....C....', 3, 'X');
  assert.deepEqual(E.onlineCheck(m, 'X', 'auto', T, T - 5000), { why: 'auto' });
  for (const mv of ['draw', 'out', { c: 3 }]) assert.equal(E.onlineCheck(m, 'X', mv, T, T - 5000), null, JSON.stringify(mv));
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === 'jigsaw']));
  let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, lcg(3), 'jg');
  const p = rec.state.turn;
  assert.ok(rec.state.squares.every(s => s.mini.type === 'jigsaw' && s.mini.offer == null), 'no piece on show anywhere before a draw');
  let r = E.applyOnlineMove(rec, p, 2, 'draw', E.makeRng('srv'), T);
  assert.ok(r.ok, r.reason); rec = r.rec;
  let back = E.parseMatch(JSON.parse(JSON.stringify(E.packMatch(rec))));
  let sq = back.state.squares[2].mini;
  assert.ok(Number.isInteger(sq.offer), 'the piece drawn is in the record, for both phones'); assert.deepEqual([sq.by, sq.k, sq.placed], [p, 1, '....C....']);
  r = E.applyOnlineMove(rec, other(p), 2, { c: sq.offer }, E.makeRng('srv2'), T + 1000);
  assert.equal(r.ok, false, 'the other player cannot place it');
  r = E.applyOnlineMove(rec, p, 2, { c: sq.offer }, E.makeRng('srv2'), T + 2000);
  assert.ok(r.ok, r.reason); rec = r.rec;
  back = E.parseMatch(JSON.parse(JSON.stringify(E.packMatch(rec))));
  sq = back.state.squares[2].mini;
  assert.deepEqual([R.jigOffer(sq), sq.got[p], R.jigCells(sq)[sq.last.c], back.state.turn], [null, 1, p, other(p)], 'laid, and the turn passed (a record keeps no null: the piece on show reads as none)');
  // the placement is the same whatever the server's rng: a phone can show it at once
  const a = fixed('....C....', 3, 'X'), b = fixed('....C....', 3, 'X');
  E.applyMove(a, 'X', { c: 3 }, E.makeRng('one')); E.applyMove(b, 'X', { c: 3 }, E.makeRng('two'));
  assert.deepEqual(a, b);
});

test('jigsaw: winnable alone: one side wrong or out of time every turn, the other still takes the square (every size, with and without the centre piece)', () => {
  for (const t of [null, { size: 4 }, { size: 5 }, { centre: 'off' }]) for (const how of ['wrong', 'out']) for (const first of ['X', 'O']) {
    const rng = E.makeRng(`alone:${how}:${first}:${JSON.stringify(t)}`), m = mini('al', t), good = 'O'; let p = first, end = null;
    for (let k = 0; k < 400 && !end; k++) {
      assert.ok(draw(m, p, rng).ok);
      const mv = p === good ? { c: m.offer } : how === 'out' ? 'out' : { c: R.jigCells(m).findIndex((v, i) => v === '.' && i !== m.offer) };
      const r = E.applyMove(m, p, mv.c === -1 ? 'out' : mv, rng);   // (the last piece has no wrong cell: the timer then)
      assert.ok(r.ok, JSON.stringify(mv));
      if (r.outcome !== 'continue') end = { r, p }; else p = other(p);
    }
    assert.ok(end && end.r.outcome === 'win' && end.p === good, `${how}, ${first} first, ${JSON.stringify(t)}: the side that plays wins`);
    assert.deepEqual([m.got.X, m.got.O], [0, R.jigNeed(m)]);
  }
});

test('jigsaw: the picture: one of eight scenes, drawn from the seed alone (the same seed, the same markup; another seed, another picture), nothing unsafe in it, and nothing of it in the square', () => {
  assert.ok(P.SCENES.length >= 6);
  assert.deepEqual(new Set(Array.from({ length: P.SCENES.length }, (_, k) => P.jigSceneName(k))).size, P.SCENES.length, 'every scene comes up');
  for (let sd = 0; sd < 64; sd++) {
    const a = P.jigPicture(sd);
    assert.equal(a, P.jigPicture(sd), 'pure');
    assert.ok(a.length > 3000 && a.length < 60000, `seed ${sd}: ${a.length} characters`);
    assert.doesNotMatch(a, /NaN|undefined|Infinity|\[object/, `seed ${sd}`);
    assert.doesNotMatch(a, /<script|<foreignObject|<image|<a[\s>]|<use|<style|href|on[a-z]+\s*=|javascript:|url\(|&|<text/i, `seed ${sd}: shapes and numbers alone`);
    assert.match(a, /^<g stroke="#161210"[^>]*>(?:<(?:path|circle|ellipse|rect)\b[^<>]*\/>|<g transform="[^"<>]*">|<\/g>)+<\/g>$/, `seed ${sd}: paths, circles, ellipses and rects in groups, nothing else`);
    for (const v of a.match(/"[^"]*"/g)) assert.match(v, /^"[#A-Za-z0-9 .,()\-]*"$/, `seed ${sd}: an attribute of plain characters (${v.slice(0, 40)})`);
  }
  assert.notEqual(P.jigPicture(8), P.jigPicture(16), 'the same scene, drawn afresh');
  // whatever a record says its seed is, only a whole number reaches the picture
  for (const bad of ['"><script>', null, undefined, NaN, -5.5, {}, '12abc', 1e21]) { const a = P.jigPicture(bad); assert.match(a, /^<g stroke=/); assert.doesNotMatch(a, /script|NaN/); assert.match(P.jigPiecePath(bad, 3, 0), /^M[-0-9. CZ]+$/); }
  assert.equal(P.jigPicture('"><script>'), P.jigPicture(0)); assert.equal(P.jigPicture(-8), P.jigPicture(8)); assert.equal(P.jigPicture(8.7), P.jigPicture(8));
  // every part of the sheet holds something: in each ninth of it something is drawn that is its own (a circle's middle, a
  // group's place, a point of a path; the bands that run right across the sheet are not counted)
  for (let sd = 0; sd < 64; sd++) {
    const a = P.jigPicture(sd), flip = /scale\(-1 1\)/.test(a.slice(0, 160)), hit = new Array(9).fill(0);
    const add = (x, y) => { if (x >= 0 && x < 300 && y >= 0 && y < 300) hit[Math.floor((flip ? 299.9 - x : x) / 100) + 3 * Math.floor(y / 100)]++; };
    for (const el of a.match(/<(?:circle|ellipse)[^>]*>/g) || []) add(Number((el.match(/cx="([-0-9.]+)"/) || [])[1]), Number((el.match(/cy="([-0-9.]+)"/) || [])[1]));
    for (const g of a.match(/<g transform="translate\([-0-9.]+ [-0-9.]+\)/g) || []) { const [x, y] = g.match(/-?[0-9.]+/g).map(Number); add(x, y); }
    for (const d of a.match(/ d="[^"]*"/g) || []) { if (/L340 340L-40 340Z/.test(d)) continue; for (const m of d.matchAll(/[MLQTC]\s*(-?[0-9.]+) (-?[0-9.]+)/g)) add(Number(m[1]), Number(m[2])); }
    assert.ok(Math.min(...hit) >= 2, `seed ${sd} (${P.jigSceneName(sd)}): something in every ninth of the sheet (${hit.join(' ')})`);
  }
});

test('jigsaw: the cut: every side a knob or a socket (the sheet\'s outer sides too: no flat side gives a piece\'s place away), neighbours share their side point for point, and a piece keeps inside its box', () => {
  for (const n of [3, 4, 5]) for (const sd of [0, 5, 123456789]) {
    const cut = P.jigCut(sd, n);
    assert.deepEqual(cut, P.jigCut(sd, n), 'pure');
    assert.deepEqual([cut.H.length, cut.H[0].length, cut.V.length, cut.V[0].length], [n + 1, n, n, n + 1]);
    assert.ok([...cut.H.flat(), ...cut.V.flat()].every(e => e.d === 1 || e.d === -1), 'every side, the outer ones too, has a knob one way or the other');
    const nums = i => P.jigPiecePath(sd, n, i).match(/-?[0-9.]+/g).map(Number), s = 300 / n;
    for (let i = 0; i < n * n; i++) {
      const d = P.jigPiecePath(sd, n, i), [x, y, w, h] = P.jigPieceBox(n, i), v = nums(i);
      assert.match(d, /^M[-0-9. ]+(?:C[-0-9. ]+){12}Z$/, 'a closed path of four sides, three curves each');
      for (let k = 0; k + 7 < v.length; k += 6) for (let u = 0; u <= 1.001; u += 0.125) {   // every curve of the outline, walked: all of it inside the box (a knob's head and all)
        const q = j => (1 - u) ** 3 * v[k + j] + 3 * (1 - u) ** 2 * u * v[k + 2 + j] + 3 * (1 - u) * u * u * v[k + 4 + j] + u ** 3 * v[k + 6 + j], px = q(0), py = q(1);
        assert.ok(px >= x && px <= x + w && py >= y && py <= y + h, `n ${n}, piece ${i}: inside its box (${px.toFixed(1)}, ${py.toFixed(1)})`);
      }
      assert.ok(Math.abs(w - s * 1.52) < 0.01 && w === h);
      // its right side, walked downwards, is its right neighbour's left side walked upwards: the same ten points
      const pts = (a, from) => { const out = []; for (let k = from; k < from + 20; k += 2) out.push([a[k], a[k + 1]]); return out; };
      if (i % n < n - 1) assert.deepEqual(pts(v, 18), pts(nums(i + 1), 54).reverse(), `n ${n}: pieces ${i} and ${i + 1} share their side`);
      if (i + n < n * n) assert.deepEqual(pts(v, 36).reverse(), pts(nums(i + n), 0), `n ${n}: pieces ${i} and ${i + n} share their side`);   // its bottom side (walked right to left) is the top side of the piece below
    }
    assert.notEqual(P.jigPiecePath(sd, n, 0), P.jigPiecePath(sd + 1, n, 0), 'another seed, another cut');
  }
  // a knob stands proud of its side: the piece's outline leaves its own cell on every side
  for (const sd of [1, 42, 77]) {
    const v = P.jigPiecePath(sd, 3, 4).match(/-?[0-9.]+/g).map(Number), far = [0, 0, 0, 0];   // how far the outline's points stand off the cell (100..200) upwards, to the right, downwards, to the left: out for a knob, in for a socket
    for (let k = 0; k < v.length; k += 2) { far[0] = Math.max(far[0], Math.abs(v[k + 1] - 100) < 40 ? Math.abs(v[k + 1] - 100) : 0); far[1] = Math.max(far[1], Math.abs(v[k] - 200) < 40 ? Math.abs(v[k] - 200) : 0); far[2] = Math.max(far[2], Math.abs(v[k + 1] - 200) < 40 ? Math.abs(v[k + 1] - 200) : 0); far[3] = Math.max(far[3], Math.abs(v[k] - 100) < 40 ? Math.abs(v[k] - 100) : 0); }
    assert.ok(far.every(d => d > 15), `seed ${sd}: no side of the middle piece is flat (${far.map(d => d.toFixed(0))})`);
  }
  const edge = P.jigPiecePath(42, 3, 0).match(/-?[0-9.]+/g).map(Number); let top = 0;   // nor is a corner piece's outer side
  for (let k = 1; k < 20; k += 2) top = Math.max(top, Math.abs(edge[k]));
  assert.ok(top > 15, 'the sheet\'s own edge is cut too');
});

test('jigsaw: the computer: it draws, then places on an empty cell that touches the board, right about as often as its level says and surer with fewer places; it never runs the timer down; its moves are always legal', () => {
  assert.deepEqual(A.best(E.publicMini(mini()), 'X', lcg(1), {}, { level: 'normal' }).move, 'draw');
  // with one place the piece can go there is nothing to get wrong
  let m = fixed('XXXOCOOX.', 8, 'X');
  for (const level of ['easy', 'normal', 'hard']) for (let k = 0; k < 20; k++) assert.deepEqual(A.best(E.publicMini(m), 'X', E.makeRng('one' + k), {}, { level }).move, { c: 8 });
  assert.equal(A.jigChance(m, 'easy', 1), 1); assert.ok(A.jigChance(m, 'easy', 2) > A.jigChance(m, 'easy', 4)); assert.equal(A.jigChance(m, 'normal', 4), 0.75); assert.equal(A.jigChance(m, 'hard', 4), 0.92); assert.equal(A.jigChance(m, 'easy', 4), 0.55);
  // its share right at the opening (four places): about the setting
  const share = level => { let ok = 0; const N = 3000; for (let k = 0; k < N; k++) { const x = fixed('....C....', [1, 3, 5, 7][k % 4], 'O'); const mv = A.best(E.publicMini(x), 'O', E.makeRng(level + k), {}, { level }).move; assert.ok(mv && [1, 3, 5, 7].includes(mv.c), 'a cell that touches the board'); if (mv.c === x.offer) ok++; } return ok / N; };
  const e = share('easy'), nm = share('normal'), h = share('hard');
  assert.ok(Math.abs(e - 0.55) < 0.04 && Math.abs(nm - 0.75) < 0.04 && Math.abs(h - 0.92) < 0.03, `easy ${e}, normal ${nm}, hard ${h}`);
  // whole squares at every level and size: every move legal, never 'out', every square ends
  for (const t of [null, { size: 4 }, { size: 5 }, { centre: 'off' }, { again: 'on' }]) for (const level of ['easy', 'normal', 'hard']) for (let g = 0; g < 30; g++) {
    const rng = E.makeRng(`jg-ai:${level}:${g}:${JSON.stringify(t)}`), x = mini('ai' + g, t); let p = 'X', done = false;
    for (let k = 0; k < 3000 && !done; k++) {
      const pm = E.publicMini(x, p), b = A.best(pm, p, rng, {}, { level, until: null });
      assert.notEqual(b.move, 'out'); assert.ok(b.q >= 0 && b.q <= 1);
      assert.ok(A.needs(pm, 'X') >= 1 && A.needs(pm, 'O') >= 1);
      const r = E.applyMove(x, p, b.move, rng);
      assert.ok(r.ok, `${level}: ${JSON.stringify(b.move)} refused (${r.reason})`);
      if (r.outcome !== 'continue') done = true; else if (!r.again) p = other(p);
    }
    assert.ok(done, 'the square ended');
  }
  // needs falls as pieces go in; a side that cannot get there is a long way off
  assert.ok(A.needs(E.publicMini(fixed('XXXXC....')), 'X') < A.needs(E.publicMini(fixed('X...C....')), 'X'));
  assert.equal(A.needs(E.publicMini(fixed('XXXXCOO..')), 'O'), 9);
});

test('jigsaw: random play: a few hundred squares all end, in a win or a draw, with the counts the board shows', () => {
  let wins = 0, draws = 0;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('jg-rand' + g), m = mini('r' + g); let p = 'X', end = null;
    for (let k = 0; k < 2000 && !end; k++) {
      const mv = E.randomLegalMove(m, p, rng); assert.notEqual(mv, null);
      const r = E.applyMove(m, p, mv, rng); assert.ok(r.ok);
      const c = R.jigCells(m); assert.deepEqual(m.got, { X: c.filter(v => v === 'X').length, O: c.filter(v => v === 'O').length });
      if (r.outcome !== 'continue') end = r; else if (!r.again) p = other(p);
    }
    assert.ok(end); if (end.outcome === 'win') { wins++; assert.equal(Math.max(m.got.X, m.got.O), 5); } else { draws++; assert.deepEqual(m.got, { X: 4, O: 4 }); }
  }
  assert.ok(wins > 0 && draws > 0);
});

// ---- the two options (both off by default) ----
const ROT = { rotate: 'on' };
test('jigsaw: both options off (the defaults): the square, its moves and its record are as they were: no turn drawn, { c } alone, nothing new in the state, the flash or the public view', () => {
  E.setTune('jigsaw', null);
  try {
    const m = E.newMini('jigsaw', E.makeRng('off'));
    assert.deepEqual(Object.keys(m).sort(), ['by', 'got', 'k', 'last', 'n', 'offer', 'placed', 'seed', 'type'], 'no tune kept, no new field');
    assert.deepEqual([R.jigEdgesOn(m), R.jigRotOn(m), R.jigRot(m)], [false, false, 0]);
    const a = E.newMini('jigsaw', E.makeRng('off')), rng = lcg(5);
    assert.deepEqual(draw(m, 'X', rng), { ok: true, outcome: 'continue', note: 'draw', again: true });
    assert.equal('rot' in m, false, 'no turn drawn');
    assert.equal('rot' in E.publicMini(m), false);
    for (const bad of [{ c: m.offer, r: 0 }, { c: m.offer, r: 1 }, { r: 0 }]) assert.equal(E.applyMove(m, 'X', bad, lcg(1)).ok, false, `${JSON.stringify(bad)}: a placement is { c } alone`);
    // the same rng's draws as before the options existed: the same piece comes out, and the stand-in and the computer move as before
    draw(a, 'X', lcg(5)); assert.equal(a.offer, m.offer);
    const mv = E.randomLegalMove(m, 'X', lcg(9)); assert.deepEqual(Object.keys(mv), ['c']);
    const b = A.best(E.publicMini(m), 'X', lcg(3), {}, { level: 'normal' }).move; assert.deepEqual(Object.keys(b), ['c']);
    const st = E.newMatch(E.makeRng('off-m'), { games: ['ttt', 'jigsaw'] });
    st.squares[0] = { owner: null, mini: m }; st.turn = 'X'; st.lock = 0;
    assert.ok(E.playMove(st, 0, { c: m.offer }, E.makeRng('x')).ok);
    assert.deepEqual(Object.keys(st.flash.jig).sort(), ['at', 'by', 'c', 'end', 'fill', 'got', 'ok', 'placed', 'was']);
    assert.deepEqual(Object.keys(m.last).sort(), ['at', 'by', 'c', 'end', 'ok', 'was']);
    assert.equal(R.jigTimes(st.flash.jig).pre, 0); assert.equal(R.jigTimes(st.flash.jig).land, R.JIG.fly);
  } finally { E.setTune('jigsaw', ON); }
});

test('jigsaw: the edge cells by grid size: a corner piece has two sides on the picture\'s border, a piece between the corners one, an inner piece none', () => {
  assert.deepEqual(R.jigBorder(3, 0), ['t', 'l']); assert.deepEqual(R.jigBorder(3, 2), ['t', 'r']); assert.deepEqual(R.jigBorder(3, 6), ['b', 'l']); assert.deepEqual(R.jigBorder(3, 8), ['r', 'b']);
  assert.deepEqual([R.jigBorder(3, 1), R.jigBorder(3, 3), R.jigBorder(3, 5), R.jigBorder(3, 7), R.jigBorder(3, 4)], [['t'], ['l'], ['r'], ['b'], []]);
  for (const n of [3, 4, 5]) {
    const k = Array.from({ length: n * n }, (_, i) => R.jigBorder(n, i).length);
    assert.deepEqual([k.filter(v => v === 2).length, k.filter(v => v === 1).length, k.filter(v => v === 0).length], [4, 4 * (n - 2), (n - 2) ** 2], `n ${n}: four corners, the edges between, the inside`);
    for (let i = 0; i < n * n; i++) { const r = Math.floor(i / n), c = i % n; assert.equal(k[i] > 0, r === 0 || c === 0 || r === n - 1 || c === n - 1, `n ${n}, cell ${i}`); }
  }
  // the marks: a stripe for each border side (inside the piece's outline, following its knob or socket) and one flag, never for an inner piece
  for (const n of [3, 4, 5]) for (let i = 0; i < n * n; i++) {
    const sides = R.jigBorder(n, i), art = P.jigEdgeArt(77, n, i, sides);
    if (!sides.length) { assert.equal(art, null); continue; }
    const band = art.band.match(/<path class="jgeg" d="([^"]+)"/)[1];
    assert.equal((band.match(/M/g) || []).length, sides.length, `n ${n}, cell ${i}: a stripe a border side`);
    assert.match(band, /^(?:M[-0-9. ]+(?:C[-0-9. ]+){3})+$/);
    assert.equal((art.flag.match(/class="jgfn"/g) || []).length, 1, 'one flag');
    assert.doesNotMatch(art.band + art.flag, /NaN|undefined/);
    assert.equal(art, P.jigEdgeArt(77, n, i, sides), 'pure');
  }
  // the stripe runs along the side itself: the top side's stripe of the top left piece is the piece's own top side, point for point
  const top = P.jigEdgeArt(42, 3, 0, ['t']).band.match(/class="jgeg" d="M([-0-9. ]+)((?:C[-0-9. ]+){3})"/), outline = P.jigPiecePath(42, 3, 0);
  assert.ok(outline.startsWith(`M${top[1]}${top[2]}`), 'the top stripe follows the outline\'s top side');
  // the flag lies inside its piece, whatever the cut: never over a socket (a neighbour's knob) at any seed or size
  const poly = d => { const v = d.match(/-?[0-9.]+/g).map(Number), out = []; for (let k = 0; k + 7 < v.length; k += 6) for (let u = 0; u < 1; u += 1 / 24) { const q = j => (1 - u) ** 3 * v[k + j] + 3 * (1 - u) ** 2 * u * v[k + 2 + j] + 3 * (1 - u) * u * u * v[k + 4 + j] + u ** 3 * v[k + 6 + j]; out.push([q(0), q(1)]); } return out; };
  const inside = (pg, [x, y]) => { let c = false; for (let a = 0, b = pg.length - 1; a < pg.length; b = a++) if ((pg[a][1] > y) !== (pg[b][1] > y) && x < ((pg[b][0] - pg[a][0]) * (y - pg[a][1])) / (pg[b][1] - pg[a][1]) + pg[a][0]) c = !c; return c; };
  const gap = (pg, [x, y]) => Math.min(...pg.map(([a, b], k) => { const [c, d] = pg[(k + 1) % pg.length], L = (c - a) ** 2 + (d - b) ** 2, t = L ? Math.max(0, Math.min(1, ((x - a) * (c - a) + (y - b) * (d - b)) / L)) : 0; return Math.hypot(x - a - t * (c - a), y - b - t * (d - b)); }));
  for (const n of [3, 4, 5]) for (let sd = 0; sd < 60; sd++) for (let i = 0; i < n * n; i++) {
    const sides = R.jigBorder(n, i); if (!sides.length) continue;
    const pg = poly(P.jigPiecePath(sd * 7919, n, i)), pts = P.jigEdgeArt(sd * 7919, n, i, sides).flag.match(/class="jgfh" d="([^"]+)"/)[1].match(/-?[0-9.]+ -?[0-9.]+/g).map(t => t.split(' ').map(Number));
    for (const pt of pts) assert.ok(inside(pg, pt) && gap(pg, pt) > (300 / n) * 0.02, `n ${n}, seed ${sd * 7919}, piece ${i}: the flag's point ${pt} inside the piece`);
  }
  // the flag's corner: the picture's own corner where it can be, never the top left (a placed piece's mark is there)
  assert.deepEqual([['t', 'l'], ['t', 'r'], ['r', 'b'], ['b', 'l'], ['t'], ['r'], ['b'], ['l']].map(P.jigFlagCorner), ['tr', 'tr', 'br', 'bl', 'tr', 'tr', 'br', 'bl']);
});

test('jigsaw: Pieces drawn rotated: the draw also draws how the piece is turned, by the move\'s rng (a quarter, half or three-quarter turn: never upright), public once drawn; it is the server\'s online', () => {
  const m = mini('rot', ROT);
  assert.equal(R.jigRotOn(m), true); assert.equal(R.jigRot(m), 0, 'nothing on show');
  assert.equal(E.publicMini(m).rot, null);
  draw(m, 'X', lcg(4));
  assert.ok([1, 2, 3].includes(m.rot), `turned: ${m.rot}`); assert.equal(R.jigRot(m), m.rot);
  assert.equal(E.publicMini(m).rot, m.rot, 'public once drawn, like the piece');
  // every turn but upright comes up, as often as the other two, and the piece's cell is drawn as without the option
  const seen = { 1: 0, 2: 0, 3: 0 };
  for (let k = 0; k < 600; k++) {
    const x = mini('r', ROT), y = mini('r');
    draw(x, 'O', E.makeRng('rd' + k)); draw(y, 'O', E.makeRng('rd' + k));
    assert.equal(x.offer, y.offer, 'the same piece by the same rng'); seen[x.rot]++;
  }
  assert.ok(Object.values(seen).every(v => v > 150), JSON.stringify(seen));
  // the same rng, the same turn (the server's draw, made once)
  const a = mini('s', ROT), b = mini('s', ROT); draw(a, 'X', E.makeRng('srv')); draw(b, 'X', E.makeRng('srv')); assert.deepEqual([a.offer, a.rot], [b.offer, b.rot]);
  // the flash of a draw carries it, for the other phone and a replay
  const st = E.newMatch(E.makeRng('rot-f'), { games: ['ttt', 'jigsaw'] });
  st.squares[0] = { owner: null, mini: mini('rf', ROT) }; st.turn = 'X'; st.lock = 0;
  assert.ok(E.playMove(st, 0, 'draw', E.makeRng('d')).ok);
  assert.deepEqual(st.flash.jig, { draw: true, by: 'X', c: st.squares[0].mini.offer, k: 1, rot: st.squares[0].mini.rot });
});

test('jigsaw: Pieces drawn rotated: a placement is { c, r } exactly (r 0 to 3 quarter turns clockwise, as the player left it); it fits only in its own cell the right way up; its own cell turned any other way is a wrong placement', () => {
  const at = (placed, offer, rot, by) => { const m = fixed(placed, offer, by || 'X', ROT); m.rot = rot; return m; };
  let m = at('....C....', 3, 2);
  for (const bad of [{ c: 3 }, { c: 3, r: 4 }, { c: 3, r: -1 }, { c: 3, r: 1.5 }, { c: 3, r: '0' }, { c: 3, r: null }, { c: 3, r: 0, x: 1 }, { r: 0 }, { c: 4, r: 0 }, { c: 9, r: 0 }, [3, 0], 'auto', 'draw']) assert.equal(E.applyMove(m, 'X', bad, lcg(1)).ok, false, `refused: ${JSON.stringify(bad)}`);
  assert.deepEqual([m.offer, m.rot], [3, 2], 'a refused move changes nothing');
  // right cell, upright: it locks in
  assert.deepEqual(E.applyMove(m, 'X', { c: 3, r: 0 }, lcg(1)), { ok: true, outcome: 'continue', note: 'fits' });
  assert.deepEqual([m.placed, m.got, m.offer, m.rot], ['...XC....', { X: 1, O: 0 }, null, null]);
  assert.deepEqual(m.last, { by: 'X', c: 3, at: 3, ok: true, was: { X: 0, O: 0 }, end: null, r: 0, rot: 2 });
  // right cell, turned wrong: no point, the piece back in the pile, as a wrong cell is; the note says why
  for (const r of [1, 2, 3]) {
    m = at('....C....', 5, 3, 'O');
    const before = JSON.parse(JSON.stringify(m));
    assert.deepEqual(E.applyMove(m, 'O', { c: 5, r }, lcg(1)), { ok: true, outcome: 'continue', note: 'turn' });
    assert.deepEqual([m.placed, m.got, m.offer, m.by, m.rot, m.k], [before.placed, before.got, null, null, null, before.k]);
    assert.deepEqual(m.last, { by: 'O', c: 5, at: 5, ok: false, was: { X: 0, O: 0 }, end: null, r, rot: 3 });
    assert.ok(R.jigEdge(m).includes(5), 'and it can come up again');
  }
  // the order of the keys is nobody's business; a -0 never reaches the record
  m = at('....C....', 1, 1); assert.equal(E.applyMove(m, 'X', { r: -0, c: 1 }, lcg(1)).note, 'fits'); assert.ok(Object.is(m.last.r, 0));
  // a wrong cell is wrong whichever way it is turned
  m = at('....C....', 1, 1); assert.equal(E.applyMove(m, 'X', { c: 7, r: 0 }, lcg(1)).note, 'wrong'); assert.deepEqual([m.last.at, m.last.r, m.last.ok], [7, 0, false]);
  // out of time: the piece back, as it was drawn
  m = at('....C....', 1, 2); assert.equal(E.applyMove(m, 'X', 'out', lcg(1)).note, 'out'); assert.deepEqual([m.last.at, m.last.r, m.last.rot, m.rot], [-1, 2, 2, null]);
  // the turn shown before a placement travels (someone else's): from how it was drawn to how it was placed, clockwise
  assert.deepEqual([[1, 0], [2, 0], [3, 0], [3, 1], [2, 2], [1, 3]].map(([rot, r]) => R.jigTurns({ at: 4, rot, r })), [3, 2, 1, 2, 0, 2]);
  assert.equal(R.jigTurns({ at: -1, rot: 2, r: 2 }), 0); assert.equal(R.jigTurns({ at: 3 }), 0, 'none without the option');
  const T = R.jigTimes({ at: 3, c: 3, ok: true, rot: 1, r: 0, was: { X: 0, O: 0 } }), U = R.jigTimes({ at: 3, c: 3, ok: true, rot: 1, r: 0, was: { X: 0, O: 0 } }, true);
  assert.deepEqual([T.pre, T.land, U.pre, U.land], [3 * R.JIG.turn, 3 * R.JIG.turn + R.JIG.fly, 0, R.JIG.fly], 'this phone\'s own goes at once');
  assert.equal(R.flashMs({ jig: { at: 3, c: 3, ok: true, rot: 1, r: 0, was: { X: 0, O: 0 } } }), T.end, 'the move\'s time holds the longer one');
  // a whole square through the match: every flash carries the turns, the state stays plain
  const st = E.newMatch(E.makeRng('rot-m'), { games: ['ttt', 'jigsaw'] });
  st.squares[0] = { owner: null, mini: mini('rm', ROT) }; st.turn = 'X'; st.lock = 0;
  assert.ok(E.playMove(st, 0, 'draw', E.makeRng('d1')).ok); E.endFlash(st);
  const q = st.squares[0].mini, rot = q.rot, c = q.offer;
  assert.ok(E.playMove(st, 0, { c, r: rot }, E.makeRng('p1')).ok);
  assert.deepEqual(st.flash.jig, { by: 'X', c, at: c, ok: false, was: { X: 0, O: 0 }, got: { X: 0, O: 0 }, end: null, placed: '....C....', fill: 0, r: rot, rot });
  assert.equal(st.flash.note, 'turn');
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'plain');
});

test('jigsaw: Pieces drawn rotated online: the draw\'s turn is the server\'s, in the record for both phones; { c, r } goes in as it is and the record round-trips', () => {
  E.setTune('jigsaw', Object.assign({}, ON, ROT));
  try {
    const T = 1e12, games = Object.fromEntries(E.TYPES.map(g => [g, g === 'jigsaw']));
    let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, lcg(3), 'jg-rot');
    const p = rec.state.turn;
    let r = E.applyOnlineMove(rec, p, 2, 'draw', E.makeRng('srv'), T); assert.ok(r.ok, r.reason); rec = r.rec;
    let back = E.parseMatch(JSON.parse(JSON.stringify(E.packMatch(rec)))), sq = back.state.squares[2].mini;
    assert.ok([1, 2, 3].includes(sq.rot), 'the turn drawn is in the record'); assert.equal(E.publicMini(sq).rot, sq.rot);
    assert.equal(E.onlineCheck(sq, p, { c: sq.offer, r: 0 }, T, T - 5000), null);
    assert.equal(E.applyOnlineMove(rec, p, 2, { c: sq.offer }, E.makeRng('srv2'), T + 1000).ok, false, '{ c } alone is refused with the option on');
    r = E.applyOnlineMove(rec, p, 2, { c: sq.offer, r: 0 }, E.makeRng('srv2'), T + 2000); assert.ok(r.ok, r.reason); rec = r.rec;
    back = E.parseMatch(JSON.parse(JSON.stringify(E.packMatch(rec)))); sq = back.state.squares[2].mini;
    assert.deepEqual([R.jigOffer(sq), R.jigRot(sq), sq.got[p], back.state.turn], [null, 0, 1, other(p)]);
    // a placement turned is the same whatever the server's rng: a phone can still show it at once
    const a = fixed('....C....', 3, 'X', ROT), b = fixed('....C....', 3, 'X', ROT); a.rot = b.rot = 2;
    E.applyMove(a, 'X', { c: 3, r: 1 }, E.makeRng('one')); E.applyMove(b, 'X', { c: 3, r: 1 }, E.makeRng('two')); assert.deepEqual(a, b);
  } finally { E.setTune('jigsaw', ON); }
});

test('jigsaw: Pieces drawn rotated: the computer turns the piece too, the right way up about as often as its level says; a wrong turn is a wrong placement; every move legal; every square ends', () => {
  assert.equal(A.jigTurnChance(mini('t0'), 'easy'), 1, 'without the option there is nothing to turn');
  const share = level => {
    let ok = 0; const N = 3000;
    for (let k = 0; k < N; k++) { const x = fixed('XO.XC....', 2, 'O', ROT); x.rot = 1 + (k % 3); const mv = A.best(E.publicMini(x, 'O'), 'O', E.makeRng(level + k), {}, { level }).move; assert.deepEqual(Object.keys(mv).sort(), ['c', 'r']); assert.ok(mv.r >= 0 && mv.r <= 3); if (mv.r === 0) ok++; }
    return ok / N;
  };
  const e = share('easy'), nm = share('normal'), h = share('hard');
  assert.ok(Math.abs(e - 0.75) < 0.04 && Math.abs(nm - 0.9) < 0.03 && Math.abs(h - 0.97) < 0.02, `easy ${e}, normal ${nm}, hard ${h}`);
  // q: a turn that may take the square counts the turn's chance too
  const last = fixed('XXXXC.O..', 5, 'X', ROT); last.rot = 1;
  const qa = A.best(E.publicMini(last), 'X', () => 0, {}, { level: 'normal' }).q, qb = A.best(E.publicMini(fixed('XXXXC.O..', 5, 'X')), 'X', () => 0, {}, { level: 'normal' }).q;
  assert.ok(Math.abs(qa - qb * 0.9) < 1e-9, `${qa} ${qb}`);
  assert.ok(A.needs(E.publicMini(fixed('X...C....', null, null, ROT)), 'X') > A.needs(E.publicMini(fixed('X...C....')), 'X'), 'further off with a piece to turn as well');
  for (const t of [ROT, Object.assign({ size: 4 }, ROT), Object.assign({ again: 'on' }, ROT), Object.assign({ edges: 'on' }, ROT)]) for (const level of ['easy', 'normal', 'hard']) for (let g = 0; g < 20; g++) {
    const rng = E.makeRng(`jg-rai:${level}:${g}:${JSON.stringify(t)}`), x = mini('rai' + g, t); let p = 'X', done = false;
    for (let k = 0; k < 3000 && !done; k++) {
      const b = A.best(E.publicMini(x, p), p, rng, {}, { level, until: null });
      const r = E.applyMove(x, p, b.move, rng);
      assert.ok(r.ok, `${level}: ${JSON.stringify(b.move)} refused (${r.reason})`);
      if (r.outcome !== 'continue') done = true; else if (!r.again) p = other(p);
    }
    assert.ok(done, 'the square ended');
  }
});

test('jigsaw: Mark edge pieces changes nothing in the rules: the same square, the same moves, the same results', () => {
  const a = mini('eg'), b = mini('eg', { edges: 'on' }), ra = lcg(21), rb = lcg(21);
  for (let k = 0; k < 40; k++) {
    const ma = E.randomLegalMove(a, 'X', ra), mb = E.randomLegalMove(b, 'X', rb);
    assert.deepEqual(ma, mb);
    if (ma == null) break;
    const x = E.applyMove(a, 'X', ma, ra), y = E.applyMove(b, 'X', mb, rb);
    assert.deepEqual(x, y);
    if (x.outcome !== 'continue') break;
  }
  assert.deepEqual(Object.assign({}, a, { tune: undefined }), Object.assign({}, b, { tune: undefined }));
});

test('jigsaw: not dealt in Super Chaos', () => {
  assert.equal(M.superChaos, false);
});
