'use strict';
// Castle Smash (December 2026): its rules, its shot's simulation and its computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const PHYS = require('../physics.js');
E.setPhysics(PHYS);
const R = require('../../src/games/castle/rules.js');
const A = require('../../src/games/castle/ai.js');
const M = require('../../src/games/castle/meta.js');
const { CS, K, KINDS } = R;

const Mt = () => R.castleLib();
const fresh = (seed, tune) => { E.setTune('castle', tune || null); try { return E.newMini('castle', E.makeRng(seed)); } finally { E.setTune('castle', null); } };
const at = (m, x, h, aim) => R.castleAimAt(x, h, aim, R.castleCfg(m).vMax);
// a castle made by hand: a list of [kind, x, h] (units), each standing upright
const made = list => list.map(([k, x, h, d]) => [k, Math.round(x * 10), Math.round(h * 10), 0].concat(d ? [d] : []));
const withCastle = (list, tune) => { const m = fresh('made', tune); m.c.O = made(list); m.c.X = made(list); return m; };
const F = CS.foot[0];

test('castle: Admin only, skill, its settings in their groups; the deal: one castle for both, its crystal on a perch, the same from the same rng', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.realTime, M.info.name], ['admin', 'skill', '1.31.0', false, true, 'Castle Smash']);
  assert.deepEqual(E.tuneFields('castle').map(f => f.k), ['again', 'layers', 'stone', 'power', 'weight', 'woodTough', 'stoneTough', 'stoneHits', 'coreTough', 'aiAim', 'aiPow', 'aiAimHard', 'aiPowHard', 'aiTries', 'aiAimEasy', 'aiPowEasy']);
  assert.ok(E.tuneFields('castle').every(f => ['Board', 'Rules', 'Timing', 'Computer'].includes(f.group)));
  const plans = new Set();
  for (let g = 0; g < 60; g++) for (const layers of [3, 4, 5]) {
    const m = fresh('d' + g, { layers });
    assert.deepEqual(m.c.X, m.c.O, 'the two castles are one and the same'); assert.notEqual(m.c.X, m.c.O); assert.deepEqual(m.n, { X: 0, O: 0 }); assert.equal(m.last, null);
    assert.deepEqual(m.c.O, fresh('d' + g, { layers }).c.O, 'the same deal from the same rng');
    const core = R.castleCore(m.c.O), cores = m.c.O.filter(b => b[0] === K.core);
    assert.equal(cores.length, 1); assert.equal(m.c.O[m.c.O.length - 1], core, 'the crystal last');
    assert.ok(m.c.O.length >= 12 && m.c.O.length <= 30, `${m.c.O.length} blocks`);
    for (const b of m.c.O) { const Kd = KINDS[b[0]], x = b[1] / 10, h = b[2] / 10; assert.ok(b.length === 4 && b.every(Number.isInteger) && b[3] === 0); assert.ok(x - Kd.w / 2 >= F - 1e-9 && x + Kd.w / 2 <= CS.foot[1] + 1e-9 && h - Kd.h / 2 >= -1e-9, `inside the footprint: ${b}`); }
    // nothing overlaps anything, and something stands over the crystal: stone, on the timber
    for (let i = 0; i < m.c.O.length; i++) for (let j = i + 1; j < m.c.O.length; j++) { const a = m.c.O[i], b = m.c.O[j], Ka = KINDS[a[0]], Kb = KINDS[b[0]]; assert.ok(Math.abs(a[1] - b[1]) / 10 >= (Ka.w + Kb.w) / 2 - 1e-6 || Math.abs(a[2] - b[2]) / 10 >= (Ka.h + Kb.h) / 2 - 1e-6, `overlap: ${a} ${b}`); }
    const over = m.c.O.filter(b => b !== core && b[2] > core[2] && Math.abs(b[1] - core[1]) / 10 < KINDS[b[0]].w / 2 + 2);
    assert.ok(over.some(b => KINDS[b[0]].m === 'w') && over.some(b => KINDS[b[0]].m === 's'), 'a timber roof with stone on it over the crystal');
    plans.add(m.c.O.length + ':' + m.c.O[0].join());
    assert.equal(E.secretOf(m), null); assert.deepEqual(E.publicMini(m, 'X'), JSON.parse(JSON.stringify(m)), 'nothing is hidden');
  }
  assert.ok(plans.size > 20, 'the castles differ from square to square');
  assert.ok(JSON.stringify(fresh('size')).length < 1500, 'a small state');
});

test('castle: a shot is { aim, power }, held to its ranges; anything else is no move', () => {
  const m = fresh('v');
  for (const bad of [null, undefined, 'x', 7, [], {}, { aim: 0.5 }, { power: 0.5 }, { aim: '0.5', power: 0.5 }, { aim: 0.5, power: '1' }, { aim: NaN, power: 0.5 }, { aim: 0.5, power: Infinity }, { aim: CS.aimLo - 0.01, power: 0.5 }, { aim: CS.aimHi + 0.01, power: 0.5 }, { aim: -1, power: 0.5 }, { aim: 0.5, power: -0.01 }, { aim: 0.5, power: 1.01 }, [0.5, 0.5]]) {
    assert.equal(R.castleMove(bad), null, JSON.stringify(bad)); assert.deepEqual(E.applyMove(m, 'X', bad, E.makeRng('r')).ok, false);
  }
  assert.deepEqual(m.n, { X: 0, O: 0 }, 'a refused move changes nothing');
  assert.deepEqual(R.castleMove({ aim: 0.123456, power: 0.98765, extra: 1 }), { aim: 0.123, power: 0.988 });
  assert.deepEqual(R.castleMove({ aim: CS.aimLo, power: 0 }), { aim: CS.aimLo, power: 0 }); assert.deepEqual(R.castleMove({ aim: CS.aimHi, power: 1 }), { aim: CS.aimHi, power: 1 });
  assert.equal(R.timeoutClose(m, 'X'), null, 'nothing is ever under way');
});

test('castle: without the physics library no castle is dealt and no shot is played', () => {
  const m = fresh('np');
  E.setPhysics(null);
  try { assert.equal(E.dealable('castle'), false); assert.deepEqual(E.applyMove(m, 'X', { aim: 0.6, power: 0.7 }, E.makeRng('r')), { ok: false, reason: 'nophys' }); const b = A.best(E.publicMini(m, 'X'), 'X', E.makeRng('b'), {}, { level: 'hard' }); assert.ok(R.castleMove(b.move), 'the computer still names a legal throw'); } finally { E.setPhysics(PHYS); }
  assert.equal(E.dealable('castle'), true);
});

test('castle: the flight is plain arithmetic: a throw aimed at a point passes through it; a dud moves nothing', () => {
  const m = fresh('fl'), c = R.castleCfg(m);
  for (const [x, h, aim] of [[430, 60, 0.4], [470, 20, 0.9], [400, 90, 1.3], [500, 40, 0.4]]) {
    const s = at(m, x, h, aim); assert.ok(s, `a throw to ${x},${h}`);
    const arc = R.castleArc(s, c.vMax, 600), near = arc.reduce((d, q) => Math.min(d, Math.hypot(q[0] - x, q[1] - h)), Infinity);
    assert.ok(near < 9, `within a boulder of ${x},${h}: ${near.toFixed(1)}`);
  }
  assert.equal(at(m, 100, 50, 0.5), null, 'nothing behind the catapult'); assert.equal(at(m, 500, 300, 0.3), null, 'nor above its line');
  const before = JSON.stringify(m.c);
  let r = E.applyMove(m, 'X', { aim: 1.3, power: 0 }, E.makeRng('r'));
  assert.deepEqual([r.ok, r.outcome, r.note, !!r.again, m.last.kind, m.last.moved, m.n.X], [true, 'continue', 'miss', false, 'short', 0, 1]); assert.equal(JSON.stringify(m.c), before);
  r = E.applyMove(m, 'O', { aim: 1.0, power: 1 }, E.makeRng('r'));
  assert.deepEqual([r.note, m.last.kind, m.last.by, m.n.O], ['miss', 'long', 'O', 1]); assert.equal(JSON.stringify(m.c), before);
  const lib = Mt(), d = R.castleShot(lib, m.c.O, { aim: 1.3, power: 0 }, c);
  assert.equal(d.blocks, m.c.O, 'the very castle, untouched'); assert.deepEqual(d.events.map(e => e.k), ['thud']); assert.ok(d.rec.n > 5 && R.unpack(d.rec.b, 2).length === d.rec.n * 2 && d.rec.t.length === 0);
  assert.ok(Math.abs(d.ms - d.rec.n * 1000 * CS.sub / CS.hz) < 2000 / 30 + 1, 'its length is its recording\'s');
});

test('castle: a fresh castle stands: a boulder that only rolls up to it moves nothing (every plan, every height)', () => {
  const lib = Mt();
  for (let g = 0; g < 24; g++) for (const layers of [3, 4, 5]) {
    const m = fresh('st' + g, { layers }), c = R.castleCfg(m), r = R.castleShot(lib, m.c.O, at(m, CS.zone[0] + 6, CS.r, 1.0), c);
    assert.equal(r.kind, 'hit'); assert.ok(r.events.some(e => e.k === 'hit' && e.m === 'g'), 'it landed in the yard');
    if (r.moved <= 1 && !r.core && !r.broke) { const far = r.blocks.filter((b, i) => b !== m.c.O[i]); assert.ok(far.length <= 1, 'at most the one block it rolled into'); }
    else assert.fail(`layers ${layers}, deal ${g}: ${r.moved} blocks moved, ${r.broke} broke, core ${r.core}`);
  }
});

test('castle: the same shot at the same castle is the same shot; the castle saved is where the simulation ended, and the recording ends there', () => {
  const lib = Mt();
  for (let g = 0; g < 10; g++) {
    const m = fresh('det' + g), c = R.castleCfg(m), core = R.castleCore(m.c.O), was = JSON.parse(JSON.stringify(m.c.O));
    const shot = at(m, core[1] / 10 + (g % 3 - 1) * 20, 40 + g * 5, 0.3 + g * 0.1);
    const a = R.castleShot(lib, m.c.O, shot, c), b = R.castleShot(lib, JSON.parse(JSON.stringify(m.c.O)), shot, c);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)), 'twice the same');
    assert.deepEqual(m.c.O, was, 'the castle given is not written on');
    const r = E.applyMove(m, 'X', shot, E.makeRng('r'));
    assert.ok(r.ok); assert.deepEqual(m.c.O, a.blocks, 'the square keeps the simulation\'s end'); assert.deepEqual(m.c.X, was, 'the shooter\'s own castle is scenery');
    assert.deepEqual([m.last.kind, m.last.core, m.last.broke, m.last.off, m.last.cracked, m.last.moved, m.last.ms], [a.kind, a.core, a.broke, a.off, a.cracked, a.moved, a.ms]);
    assert.ok(m.c.O.every(q => q.every(Number.isInteger)), 'whole numbers');
    // the recording: each knocked block's track ends where the block was saved (to the recording's own grain), a gone block's at its going
    const alive = was.map(() => true); for (const e of a.events) if (e.k === 'break' || e.k === 'off' || e.k === 'core') alive[e.i] = false;
    const after = new Map(); { let k = 0; was.forEach((w, i) => { if (alive[i]) after.set(i, a.blocks[k++]); }); }
    for (const [i, f0, str, gone] of a.rec.t) {
      const v = R.unpack(str, 3); assert.ok(v.length >= 3 && v.length % 3 === 0 && f0 >= 0 && f0 + v.length / 3 <= a.rec.n + 1);
      assert.deepEqual(v.slice(0, 3), [Math.round(was[i][1] / 5), Math.round(was[i][2] / 5), Math.round(was[i][3] / 20)], 'it starts where the block lay');
      if (!alive[i]) { assert.ok(Number.isInteger(gone) && gone <= a.rec.n); continue; }
      assert.equal(gone, undefined);
      const end = after.get(i), z = v.slice(-3);
      assert.ok(Math.abs(z[0] / 2 - end[1] / 10) <= 1.2 && Math.abs(z[1] / 2 - end[2] / 10) <= 1.2 && Math.abs(z[2] / 50 - end[3] / 1000) <= 0.05, `block ${i}: the track ends at ${z}, the block lies at ${end}`);
    }
    was.forEach((w, i) => { if (alive[i] && !a.rec.t.some(t => t[0] === i)) assert.deepEqual(after.get(i).slice(0, 4), w.slice(0, 4), 'a block with no track has not moved'); });
    const ball = R.unpack(a.rec.b, 2); assert.deepEqual(ball.slice(0, 2), [CS.rel[0] * 2, CS.rel[1] * 2], 'the boulder starts at the catapult');
    assert.ok(JSON.stringify(a.rec).length + JSON.stringify(a.events).length < 9000, 'a compact recording');
  }
});

test('castle: the recording\'s packing goes there and back', () => {
  const rng = E.makeRng('pk');
  for (const cols of [2, 3]) { const v = Array.from({ length: cols * 40 }, (_, k) => Math.round((rng() - 0.5) * (k % 7 ? 60 : 90000)) || 0); const s = R.pack(v, cols); assert.deepEqual(R.unpack(s, cols), v); assert.ok(!/["\\]/.test(s) && JSON.parse(JSON.stringify({ s })).s === s); }
  assert.deepEqual(R.unpack('', 3), []); assert.deepEqual(R.unpack(null, 3), []);
});

test('castle: the crystal ends when struck hard, when it drops off its perch, when a block crushes it; a soft touch leaves it', () => {
  const lib = Mt();
  // alone on its perch: a boulder straight at it
  let m = withCastle([[K.cube, F + 60, 8], [K.core, F + 60, 25]]), c = R.castleCfg(m);
  let r = E.applyMove(m, 'X', at(m, F + 60, 25, 0.5), E.makeRng('r'));
  assert.deepEqual([r.ok, r.outcome, r.note, r.winner, m.last.core], [true, 'win', 'smashed', undefined, 'hit']); assert.equal(R.castleCore(m.c.O), null); assert.ok(R.castleCore(m.c.X), 'the shooter\'s own stands');
  assert.equal(E.applyMove(m, 'X', { aim: 0.5, power: 0.5 }, E.makeRng('r')).reason, 'over');
  // the perch knocked from under it: it drops
  m = withCastle([[K.cube, F + 60, 8], [K.cube, F + 60, 24], [K.core, F + 60, 41]]);
  let s = R.castleShot(lib, m.c.O, at(m, F + 52, 14, 0.2), R.castleCfg(m));
  assert.equal(s.core, 'fell', JSON.stringify(s.events.map(e => e.k)));
  // a stone dropped on it from high up crushes it; set down gently it does not
  const drop = h => R.castleShot(lib, made([[K.cube, F + 60, 8], [K.core, F + 60, 25], [K.brick, F + 60, h]]), at(m, CS.zone[0] + 4, CS.r, 1.0), c);
  assert.equal(drop(140).core, 'crush'); assert.equal(drop(42.5).core, null);
  // behind a wall the boulder cannot pass, it stands
  m = withCastle([[K.brick, F + 16, 8], [K.brick, F + 16, 24], [K.brick, F + 16, 40], [K.cube, F + 90, 8], [K.core, F + 90, 25]]);
  s = R.castleShot(lib, m.c.O, at(m, F + 2, 22, 0.2), R.castleCfg(m));
  assert.equal(s.core, null); assert.ok(R.castleCore(s.blocks));
});

test('castle: timber breaks at a hard knock; stone cracks, then crumbles at its last hard hit; a block knocked out of the yard is gone', () => {
  const lib = Mt();
  let m = withCastle([[K.post, F + 20, 16], [K.cube, F + 100, 8], [K.core, F + 100, 25]]), c = R.castleCfg(m);
  let r = R.castleShot(lib, m.c.O, at(m, F + 16, 20, 0.2), c);
  assert.deepEqual([r.broke, r.core, r.blocks.length], [1, null, 2]); assert.deepEqual(r.events.filter(e => e.k === 'break').map(e => [e.i, e.m]), [[0, 'w']]);
  assert.equal(R.castleShot(lib, m.c.O, at(m, F + 16, 20, 0.2), Object.assign({}, c, { woodTough: 99 })).broke, 0, 'tougher timber only moves');
  // a wall of three bricks, hit square on: the struck brick cracks (its fifth number), the next hard hit on it crumbles it
  m = withCastle([[K.brick, F + 16, 8], [K.brick, F + 16, 24], [K.brick, F + 16, 40], [K.cube, F + 100, 8], [K.core, F + 100, 25]]);
  const shot = at(m, F + 2, 24, 0.2);
  r = R.castleShot(lib, m.c.O, shot, c);
  assert.equal(r.cracked, 1); assert.equal(r.broke, 0); assert.deepEqual(r.events.filter(e => e.k === 'crack').length, 1);
  const hit = r.events.find(e => e.k === 'crack').i, cracked = r.blocks.filter(b => b[4]);
  assert.deepEqual(cracked.map(b => [b[0], b[4]]), [[K.brick, 1]]); assert.equal(r.blocks.length, 5);
  const again = made([[K.brick, F + 16, 8], [K.brick, F + 16, 24, 1], [K.brick, F + 16, 40], [K.cube, F + 100, 8], [K.core, F + 100, 25]]);
  r = R.castleShot(lib, again, shot, c);
  assert.equal(hit, 1); assert.deepEqual([r.broke, r.blocks.length], [1, 4]); assert.deepEqual(r.events.filter(e => e.k === 'break').map(e => [e.i, e.m]), [[1, 's']]);
  assert.equal(R.castleShot(lib, again, shot, Object.assign({}, c, { stoneHits: 3 })).broke, 0, 'three hits to crumble: only a second crack');
  assert.equal(R.castleShot(lib, again, { aim: shot.aim, power: 0 }, c).cracked, 0, 'a boulder that falls short cracks nothing');
  // a lone cube at the yard's edge, struck from the front: out of the yard and gone
  m = withCastle([[K.cube, CS.yard[1] - 20, 8], [K.cube, F + 40, 8], [K.core, F + 40, 25]]);
  r = R.castleShot(lib, m.c.O, at(m, CS.yard[1] - 28, 12, 0.6), Object.assign({}, c, { stoneTough: 99 }));
  assert.deepEqual([r.off, r.blocks.length], [1, 2], JSON.stringify(r.events.map(e => e.k))); assert.ok(r.events.some(e => e.k === 'off' && e.i === 0));
});

test('castle: Go again on success: a shot that breaks a block or knocks one out shoots again, only with the switch on', () => {
  const wall = [[K.post, F + 20, 16], [K.cube, F + 100, 8], [K.core, F + 100, 25]];
  let m = withCastle(wall), r = E.applyMove(m, 'X', at(m, F + 16, 20, 0.2), E.makeRng('r'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.last.broke], ['continue', 'broke', false, 1]);
  m = withCastle(wall, { again: 'on' }); r = E.applyMove(m, 'X', at(m, F + 16, 20, 0.2), E.makeRng('r'));
  assert.deepEqual([r.outcome, r.note, r.again], ['continue', 'again', true]);
  r = E.applyMove(m, 'X', { aim: 1.3, power: 0 }, E.makeRng('r')); assert.deepEqual([r.note, !!r.again], ['miss', false], 'a miss ends the turn');
  assert.ok(/shoot again/.test(M.goAgainText.on) && M.goAgainText.off === '' && /\{goAgain\}/.test(M.explainer.play));
});

test('castle: the move on the match: its flash carries the recording, the square never does; an online record keeps only the latest move\'s', () => {
  const st = E.newMatch(E.makeRng('i'), { games: ['castle'] }), p = st.turn, m = st.squares[4].mini;
  assert.ok(E.playMove(st, 4, at(m, R.castleCore(m.c.O)[1] / 10, 60, 0.7), E.makeRng('s')).ok);
  const f = st.flash, ph = f.phys;
  assert.deepEqual(Object.keys(ph).sort(), ['aim', 'broke', 'by', 'core', 'cracked', 'ev', 'kind', 'moved', 'ms', 'n', 'off', 'power', 'rec', 'was']);
  assert.ok(ph.rec && typeof ph.rec.b === 'string' && Array.isArray(ph.rec.t) && Array.isArray(ph.was) && ph.was.length >= 12); assert.equal(ph.by, p);
  assert.ok(!('rec' in st.squares[4].mini.last) && !/"rec"/.test(JSON.stringify(st.squares)), 'no recording on the square');
  assert.ok(E.playMs(f) >= R.CST.wide + R.CST.zoom + R.CST.pull + R.CST.swing + ph.ms, 'the move\'s length: the camera\'s intro (someone else\'s shot opens on it), the pull, the swing, the recording');
  // online: two shots in a row; the entry before has let its recording go
  let rec = E.newOnlineMatch({ games: { castle: true } }, E.makeRng('on'), 'g1', 0);
  for (const t of E.TYPES) rec.state.games = ['castle'];
  let full = E.fullState(rec); full.squares.forEach((sq, i) => { sq.mini = E.newMini('castle', E.makeRng('q' + i)); sq.owner = null; }); rec = E.matchRecord(full);
  const sides = [rec.state.turn, E.other(rec.state.turn)];
  let r1 = E.applyOnlineMove(rec, sides[0], 0, { aim: 0.6, power: 0.8 }, E.makeRng('a'), {}); assert.ok(r1.ok, r1.reason);
  assert.ok(r1.entries[0].phys.rec, 'the recording rides the entry'); assert.ok(!/"rec"/.test(JSON.stringify(r1.rec.state.squares)));
  let r2 = E.applyOnlineMove(r1.rec, sides[1], 1, { aim: 0.6, power: 0.8 }, E.makeRng('b'), {}); assert.ok(r2.ok, r2.reason);
  const recent = r2.rec.state.recent; assert.equal(recent.length, 2); assert.equal(recent[0].phys.rec, null); assert.ok(recent[1].phys.rec);
  assert.ok(JSON.stringify(E.packMatch(r2.rec)).length < 30000, 'the record stays small');
});

test('castle: the computer: a legal throw at every level, the same from the same rng; Hard does more with a throw than Easy', () => {
  const dmg = level => { let s = 0; for (let g = 0; g < 8; g++) { const rng = E.makeRng(level + g), m = fresh('ai' + g), b = E.localBest(E.publicMini(m, 'X'), 'X', rng, {}, { level, until: null }); assert.ok(R.castleMove(b.move), `${level}: ${JSON.stringify(b.move)}`); assert.ok(b.q >= 0 && b.q <= 1); const before = m.c.O; const r = E.applyMove(m, 'X', b.move, rng); assert.ok(r.ok); s += r.outcome === 'win' ? 12 : R.castleShield(before) - R.castleShield(m.c.O) + m.last.broke + m.last.cracked; } return s; };
  const e = dmg('easy'), h = dmg('hard');
  assert.ok(h > e, `Hard ${h.toFixed(1)} against Easy ${e.toFixed(1)}`);
  const m = fresh('same'), one = A.best(E.publicMini(m, 'O'), 'O', E.makeRng('z'), {}, { level: 'normal', until: null }), two = A.best(E.publicMini(m, 'O'), 'O', E.makeRng('z'), {}, { level: 'normal', until: null });
  assert.deepEqual(one, two);
  assert.ok(A.needs(E.publicMini(m, 'X'), 'X') >= 3 && A.needs(E.publicMini(m, 'X'), 'X') <= 9, 'a fresh castle: a few throws');
  const done = fresh('done'); done.c.O = done.c.O.filter(b => b[0] !== K.core); assert.equal(A.needs(E.publicMini(done, 'X'), 'X'), 0);
  assert.ok(A.castleCands(m.c.X, R.castleCfg(m)).length >= 6); assert.ok(A.castleCands(m.c.X, R.castleCfg(m)).every(s => R.castleMove(s)));
  // Hard keeps to its time: with none left it still answers
  const b = A.best(E.publicMini(m, 'X'), 'X', E.makeRng('t'), {}, { level: 'hard', until: () => 0 }); assert.ok(R.castleMove(b.move));
});

test('castle: winnable alone: one side never shoots, the other (the computer\'s hand, every level) always smashes the crystal in a bounded number of throws', () => {
  let most = 0;
  for (let g = 0; g < 18; g++) {
    const level = ['easy', 'normal', 'hard'][g % 3], rng = E.makeRng('alone' + g), m = fresh('al' + g, g % 6 === 5 ? { layers: 5 } : null), was = JSON.stringify(m.c.X);
    let won = 0;
    for (let k = 1; k <= 60 && !won; k++) { const r = E.applyMove(m, 'X', E.localBest(E.publicMini(m, 'X'), 'X', rng, {}, { level, until: null }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') won = k; else assert.equal(r.outcome, 'continue'); }
    assert.ok(won, `deal ${g} (${level}): never won`); most = Math.max(most, won);
    assert.equal(JSON.stringify(m.c.X), was, 'the idle side\'s shots never came: its attacker\'s castle... is its own, untouched');
  }
  assert.ok(most <= 45, `the longest took ${most} throws`);
});

test('castle: whole squares end with a winner (random throws against the computer\'s), a castle only ever loses blocks', () => {
  for (let g = 0; g < 6; g++) {
    const rng = E.makeRng('sq' + g), m = fresh('sq' + g); let p = 'X', done = false, n = { X: m.c.X.length, O: m.c.O.length };
    for (let k = 0; k < 160 && !done; k++) {
      const mv = p === 'X' ? E.randomLegalMove(m, p, rng) : E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'easy', until: null }).move;
      assert.ok(R.castleMove(mv), JSON.stringify(mv));
      const r = E.applyMove(m, p, mv, rng); assert.ok(r.ok, r.reason);
      for (const q of ['X', 'O']) { assert.ok(m.c[q].length <= n[q]); n[q] = m.c[q].length; }
      if (r.outcome === 'win') { done = true; assert.equal(r.winner || p, p); assert.equal(R.castleCore(m.c[E.other(p)]), null); }
      p = E.other(p);
    }
    assert.ok(done, `square ${g} never ended`);
  }
});
