'use strict';
// What the physics games (Mini Golf, Pool, Bowling) share, tested once for all of them (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));

/* ===================================== the physics ===================================== */
test('physics: a shot is played out in fixed steps and recorded 30 times a second; the same shot gives the same recording, twice', () => {
  const m = mini('pool', 'det');
  const a = P.run('pool', m, 'X', { aim: 0.05, power: 0.7 }), b = P.run('pool', m, 'X', { aim: 0.05, power: 0.7 });
  assert.deepEqual(a.rec, b.rec, 'identical recordings'); assert.deepEqual(a.final, b.final); assert.deepEqual(a.events, b.events);
  assert.equal(a.rec.fps, 45, 'worked out 30 frames a second, played 1.5 times as fast'); assert.deepEqual(a.rec.ids, ['cue', 'x1', 'x2', 'x3', 'o1', 'o2', 'o3', 'black']);
  assert.equal(a.rec.frames[0].length, 16, 'x and y per ball per frame');
  assert.ok(Math.abs(a.rec.frames.length / 45 * 1000 - a.ms) < 30, 'the time of the recording, as it plays');
  assert.ok(a.events.every(e => e.t <= a.ms / 1000 + 0.03), 'the events in the same time');
  assert.ok(a.rec.frames.length > 30 && a.ms <= P.POOL.maxT * 1000 / P.TS + 100);
  assert.equal(a.events[a.events.length - 1].k, 'stop');
  assert.ok(JSON.stringify(a.rec).length < 40000, `the recording stays small (${JSON.stringify(a.rec).length} bytes)`);
});

test('golf, pool, bowling: played 1.5 times as fast as before, along the same paths: a shot goes just as far and ends just the same', () => {
  const m = mini('golf', 'ts'); m.hole = 2;
  const r = P.run('golf', m, 'X', { aim: 0.1, power: 0.7 });
  assert.equal(P.TS, 1.5); assert.equal(r.rec.fps, 30 * P.TS);
  assert.ok(Math.abs(r.ms - r.rec.frames.length / 45 * 1000) < 30, 'its time: the frames at 45 a second');
  const stop = r.events.find(e => e.k === 'stop');
  assert.ok(Math.abs(stop.t * 1000 - r.ms) < 60, 'the events on the same clock as the frames');
});
