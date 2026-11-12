'use strict';
// Mini Golf: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));

test('golf: the ball drops in the cup only when slow enough, else it lips out; the first ball in takes the square, even knocked in by the other', () => {
  const m = mini('golf', 'cup'); m.hole = 2;                     // (the horseshoe: a clear run up to the cup from below)
  const cup = P.HOLES[2].cup;
  m.balls.X = [cup[0], cup[1] + 36]; m.balls.O = [90, 150];
  const soft = E.applyMove(JSON.parse(JSON.stringify(m)), 'X', { aim: 0, power: 0.45 });
  assert.deepEqual([soft.outcome, soft.note, soft.winner], ['win', 'holed', 'X'], 'a soft putt drops');
  const hard = JSON.parse(JSON.stringify(m)), hr = E.applyMove(hard, 'X', { aim: 0, power: 1 });
  assert.equal(hr.outcome, 'continue'); assert.equal(hr.note, 'lip', 'a hard one lips out');
  assert.ok(hard.last.events.some(e => e.k === 'lip') && !hard.holed.X && hard.balls.X[1] !== m.balls.X[1]);
  assert.equal(hard.shots.X, 1);
  // the other ball, sitting by the cup, knocked in: the square goes to its owner
  const knock = mini('golf', 'knock'); knock.hole = 2;
  knock.balls.O = [cup[0], cup[1] + 7]; knock.balls.X = [cup[0], cup[1] + 30];
  const kr = E.applyMove(knock, 'X', { aim: 0, power: 0.35 });
  assert.equal(kr.outcome, 'win'); assert.equal(kr.winner, 'O', `O's ball went in first (${kr.note})`);
  assert.ok(knock.holed.O);
  for (const bad of [null, 'x', { aim: 'a', power: 0.5 }, { aim: 0, power: 1.5 }, { aim: 4, power: 0.5 }]) assert.equal(E.applyMove(mini('golf', 'b'), 'X', bad).ok, false);
});

test('golf: the page may choose a new square\'s hole (a local game: a layout the device has not had lately); without a choice, any of the 42', () => {
  const seen = new Set();
  for (let k = 0; k < 400; k++) seen.add(E.newMini('golf', E.makeRng('pick' + k)).hole);
  assert.equal(seen.size, P.HOLES.length, 'any hole, mirrored ones too');
  E.setGolfPick((rng, holes) => holes.findIndex(h => h.name === 'Moat, mirrored'));
  try { assert.equal(P.HOLES[E.newMini('golf', lcg(1)).hole].name, 'Moat, mirrored', 'the page\'s choice'); E.setGolfPick(() => null); assert.ok(E.newMini('golf', lcg(2)).hole >= 0, 'no choice: any'); E.setGolfPick(() => 99); assert.ok(E.newMini('golf', lcg(3)).hole < P.HOLES.length, 'a choice out of range: any'); }
  finally { E.setGolfPick(null); }
  const m = E.newMini('golf', lcg(4)), tee = P.HOLES[m.hole].tee;
  assert.deepEqual(m.balls, { X: [tee[0] - 3, tee[1]], O: [tee[0] + 3, tee[1]] }, 'both balls on that hole\'s tee');
});

test('golf: a bumper kicks the ball straight off it, faster than it came (a bump event for the flash and the sound), unlike a wall', () => {
  P.HOLES.push({ name: 'test', tee: [50, 150], cup: [90, 10], walls: [[50, 60, 30, 5, 0]], bumpers: [[50, 80, 4]], path: [[90, 10]] });
  try {
    const h = P.HOLES.length - 1, m = Object.assign(mini('golf', 'kick'), { hole: h, balls: { X: [50, 140], O: [8, 152] }, holed: { X: false, O: false } });
    const speedAt = (r, t) => { const i = r.rec.ids.indexOf('X') * 2, f = r.rec.frames, k = Math.max(1, Math.min(f.length - 1, Math.round(t * r.rec.fps))); return Math.hypot(f[k][i] - f[k - 1][i], f[k][i + 1] - f[k - 1][i + 1]) * r.rec.fps; };
    const r = P.run('golf', m, 'X', { aim: 0.02, power: 0.6 }), bump = r.events.find(e => e.k === 'bump');
    assert.ok(bump && bump.b === 0 && bump.id === 'X', 'the ball hits the bumper');
    assert.ok(!r.events.some(e => e.k === 'wall' && Math.abs(e.t - bump.t) < 0.02), 'a bump, not a wall');
    const before = speedAt(r, bump.t - 2 / r.rec.fps), after = speedAt(r, bump.t + 3 / r.rec.fps);
    assert.ok(after > before + 8, `kicked off faster (${before.toFixed(1)} → ${after.toFixed(1)} u/s)`);
    assert.ok(r.final.X[1] > 84, 'and back the way it came');
    // a slow roll into it is kicked off all the same
    const slow = P.run('golf', Object.assign({}, m, { balls: { X: [50, 92], O: [8, 152] } }), 'X', { aim: 0, power: 0.2 });
    assert.ok(slow.events.some(e => e.k === 'bump'), 'a slow ball still pops off');
    assert.ok(P.LAYOUTS.every(hh => hh.bumpers.length >= 3), 'every layout has its bumpers');
  } finally { P.HOLES.pop(); }
});

test('golf: its settings (TUNE) are dealt into the square and played by: a faster ball drops; the computer\'s error', () => {
  E.setTune('golf', { holeSpeed: 60, aiAim: 0, aiPow: 0 });
  const m = mini('golf', 'tune'); m.hole = 2;
  E.setTune('golf', null);
  assert.deepEqual(m.tune, { holeSpeed: 60, aiAim: 0, aiPow: 0 });
  const cup = P.HOLES[2].cup;
  m.balls.X = [cup[0], cup[1] + 36]; m.balls.O = [90, 150];
  const plain = Object.assign(JSON.parse(JSON.stringify(m)), { tune: undefined });
  assert.equal(E.applyMove(plain, 'X', { aim: 0, power: 0.65 }).note, 'lip', 'by default it lips out');
  const r = E.applyMove(JSON.parse(JSON.stringify(m)), 'X', { aim: 0, power: 0.65 });
  assert.equal(r.note, 'holed', 'dealt a faster cup, it drops');
  const ai = E.physAi(E.publicMini(m), 'O', E.makeRng('ai'));
  assert.ok(ai.move && Number.isFinite(ai.move.aim));
});

test('golf: the terrain (December 2026, v 2): every layout has some, placed clear of the tee and the cup, mirrored with its hole; slopes bend a putt, sand slows it, water puts the ball back a stroke more, a windmill turns and blocks; each behind its switch; a square from before has none', () => {
  const on = { slopes: 'on', sand: 'on', water: 'on', mills: 'on', waterPenalty: 1 };
  const deal = (h, t) => { const m = mini('golf', 'ter' + h); m.hole = h; m.tune = Object.assign({}, m.tune, on, t || {}); const tee = P.HOLES[h].tee; m.balls = { X: [tee[0] - 3, tee[1]], O: [tee[0] + 3, tee[1]] }; return m; };
  assert.equal(mini('golf').v, 2);
  for (const h of P.HOLES) {
    const t = h.terrain, n = t.slopes.length + t.sand.length + t.water.length + t.mills.length;
    assert.ok(n >= 1, `${h.name}: some terrain`);
    for (const [x, y, r] of [...t.sand, ...t.water, ...t.slopes]) { assert.ok(Math.hypot(x - h.tee[0], y - h.tee[1]) > r + 6 && Math.hypot(x - h.cup[0], y - h.cup[1]) > r + P.GOLF.cupR, `${h.name}: clear of the tee and the cup`); }
    for (const [, , , gx, gy] of t.slopes) assert.ok(Math.hypot(gx, gy) < P.GOLF.roll, 'a slope pulls less than the turf holds: every ball stops');
    if (h.of !== P.HOLES.indexOf(h)) { const b = P.HOLES[h.of].terrain; assert.deepEqual(t.water.map(w => [Math.round(100 - w[0]), w[1]]), b.water.map(w => [Math.round(w[0]), w[1]]), 'the mirror\'s water mirrored'); assert.equal(t.mills.length, b.mills.length); }
  }
  // water: a putt into a pond comes back to where it began, the stroke and one more counted
  const hw = P.HOLES.findIndex(h => h.terrain.water.length), mw = deal(hw), [wx, wy] = P.HOLES[hw].terrain.water[0];
  mw.balls.X = [wx, wy + 14];
  const was = mw.balls.X.slice(), rw = E.applyMove(mw, 'X', { aim: E.aimTo(mw.balls.X, [wx, wy]), power: 0.3 });
  assert.equal(rw.note, 'water'); assert.equal(mw.shots.X, 2); assert.ok(Math.hypot(mw.balls.X[0] - was[0], mw.balls.X[1] - was[1]) < 0.05);
  const dry = deal(hw, { water: 'off' }); dry.balls.X = was.slice(); E.applyMove(dry, 'X', { aim: E.aimTo(was, [wx, wy]), power: 0.3 });
  assert.equal(dry.shots.X, 1, 'its switch off: no water'); assert.notDeepEqual(dry.balls.X, was);
  const free = deal(hw, { waterPenalty: 0 }); free.balls.X = was.slice(); E.applyMove(free, 'X', { aim: E.aimTo(was, [wx, wy]), power: 0.3 }); assert.equal(free.shots.X, 1, 'no penalty set: the shot alone');
  const old = deal(hw); delete old.v; old.balls.X = was.slice(); E.applyMove(old, 'X', { aim: E.aimTo(was, [wx, wy]), power: 0.3 });
  assert.equal(old.shots.X, 1, 'a square from before: no terrain');
  // sand and slopes: the same putt through them goes less far, or bends
  const through = (kind, t) => { const h = P.HOLES.findIndex(q => q.terrain[kind].length), [x, y] = P.HOLES[h].terrain[kind][0], m = deal(h, t); m.balls.X = [x, y + 12]; m.balls.O = [-40, -40]; m.holed.O = true; return E.physRun(m, 'X', { aim: 0, power: 0.32 }).final.X; };
  const sandOn = through('sand'), sandOff = through('sand', { sand: 'off' });
  assert.ok(sandOn[1] > sandOff[1] + 3, `sand slows a putt (${sandOn} against ${sandOff})`);
  const across = t => { const h = P.HOLES.findIndex(q => q.terrain.slopes.length), [x, y, , gx, gy] = P.HOLES[h].terrain.slopes[0], g = Math.hypot(gx, gy), d = [-gy / g, gx / g], m = deal(h, t); m.balls.X = [x - d[0] * 10, y - d[1] * 10]; m.balls.O = [-40, -40]; m.holed.O = true; const f = E.physRun(m, 'X', { aim: Math.atan2(d[0], -d[1]), power: 0.3 }).final.X; return (f[0] - x) * gx / g + (f[1] - y) * gy / g; };
  const slopeOn = across(), slopeOff = across({ slopes: 'off' });
  assert.ok(slopeOn > slopeOff + 1, `a slope bends a putt down its fall (${slopeOn.toFixed(2)} against ${slopeOff.toFixed(2)})`);
  // the windmill: the same putt at two clocks meets the blades or not; the run is the same every time
  let both = 0;
  for (const hm of P.HOLES.map((_, i) => i).filter(i => P.HOLES[i].terrain.mills.length)) for (const [dx, dy, aim] of [[4.5, 14, 0], [-4.5, 14, 0], [4.5, -14, Math.PI], [-4.5, -14, Math.PI], [14, 4.5, -Math.PI / 2], [14, -4.5, -Math.PI / 2], [-14, 4.5, Math.PI / 2], [-14, -4.5, Math.PI / 2]]) {   // a putt through the blades' circle beside the post, at eight clocks
    const [mx, my] = P.HOLES[hm].terrain.mills[0], seen = new Set();
    for (let k = 0; k < 8; k++) { const m = deal(hm); m.mt = k * 0.21; m.balls.X = [mx + dx, my + dy]; m.balls.O = [-40, -40]; m.holed.O = true; const r = E.physRun(m, 'X', { aim, power: 0.4 }); seen.add(r.events.some(e => e.k === 'mill')); if (k < 2) assert.deepEqual(r, E.physRun(m, 'X', { aim, power: 0.4 }), 'the same every time'); }
    if (seen.size === 2) both++;
  }
  assert.ok(both >= 3, `the blades are in the way at some moments, not at others (${both} putts)`);
});
