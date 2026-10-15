// Tic Tac Chaos: the physics of Mini Golf, Pool and Bowling, on Matter.js (MIT, https://brm.io/matter-js).
// One module for the page (window.PHYS, Matter from cdnjs) and for Node (the Cloud Functions and the
// tests: require('matter-js')). A shot is an aim (radians, 0 straight up the table) and a power (0..1);
// a run is the whole thing played out in fixed steps until everything has stopped, with a recording
// of every body's place 30 times a second and the events along the way (bounces, the cup, the pockets,
// the pins), so the phones replay exactly what the server (or the shooter's phone) worked out.
// Tables are in units: 100 across; Mini Golf 160 tall, Pool 180, Bowling 240; y grows downward (the
// tee, the cue and the bowling ball are at the bottom, the cup, the rack and the pins at the top).
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('matter-js'));
  else root.PHYS = factory(root.Matter);
})(typeof self !== 'undefined' ? self : this, function (Matter) {
  'use strict';
  const { Engine, Bodies, Body, Composite, Events, Vector } = Matter;
  // Matter takes a slow contact for a resting one (no bounce) below a threshold meant for pixel-sized
  // worlds; on these small tables every ball would stick to what it hit. Set for these tables, the same
  // everywhere, so the server and the phones work out the same shot.
  if (Matter.Resolver) Matter.Resolver._restingThresh = 0.04;
  const STEP = 1000 / 120, FPS = 30, SUB = 4;                  // 120 Hz physics, a recorded frame every 4 steps
  const r1 = x => Math.round(x * 10) / 10 + 0;
  const r2 = x => Math.round(x * 100) / 100 + 0;

  // ---------- the tables ----------
  const GOLF = { w: 100, h: 160, ballR: 2.4, cupR: 3.6, holeSpeed: 32, lipKick: 0.5, vMax: 95, maxT: 9, air: 0.004, roll: 12 };
  const POOL = { w: 100, h: 180, ballR: 2.6, vMax: 120, maxT: 10, air: 0.004, roll: 9,
    pockets: [[0, 0, 7.5], [100, 0, 7.5], [0, 90, 6.5], [100, 90, 6.5], [0, 180, 7.5], [100, 180, 7.5]],   // x, y, the reach of the pocket
    start: { cue: [50, 140], black: [50, 52], x1: [40, 66], x2: [60, 80], o1: [60, 66], o2: [40, 80] } };
  const BOWL = { w: 100, h: 240, ballR: 3.5, pinR: 2.0, vMax: 150, maxT: 7, air: 0.002, roll: 4, pinAir: 0.004, pinRoll: 6, pinBounce: 0.9, still: 4, gutter: 7, knocked: 2.2,
    start: [50, 214], pins: [[50, 50], [45, 38], [55, 38], [40, 26], [50, 26], [60, 26], [35, 14], [45, 14], [55, 14], [65, 14]] };
  // Mini Golf's holes: walls as [cx, cy, w, h, angle], bumpers as [cx, cy, r], the tee and the cup, and a
  // path (the way round, for the computer's aim). Both balls start side by side on the tee. Each hole
  // takes a good player 2-4 shots.
  const HOLES = [
    { name: 'Straight on', tee: [50, 140], cup: [50, 24], walls: [], bumpers: [[50, 82, 7]], path: [[34, 86], [50, 24]] },
    { name: 'Dogleg', tee: [22, 140], cup: [22, 24], walls: [[32, 82, 64, 6, 0]], bumpers: [], path: [[82, 112], [82, 58], [22, 24]] },
    { name: 'The horseshoe', tee: [50, 140], cup: [50, 30], walls: [[50, 16, 56, 6, 0], [24, 32, 6, 38, 0], [76, 32, 6, 38, 0]], bumpers: [[50, 96, 6]], path: [[36, 102], [50, 66], [50, 30]] },
    { name: 'The funnel', tee: [50, 140], cup: [50, 26], walls: [[19, 92.5, 56, 6, -0.544], [81, 92.5, 56, 6, 0.544]], bumpers: [], path: [[50, 80], [50, 26]] },   // two walls from the sides meeting in a 14-wide neck
    { name: 'Round the bar', tee: [50, 140], cup: [50, 26], walls: [[50, 70, 64, 6, 0]], bumpers: [[50, 112, 5]], path: [[12, 108], [12, 56], [50, 26]] },
    { name: 'Pinball', tee: [50, 140], cup: [50, 22], walls: [], bumpers: [[30, 58, 6], [70, 58, 6], [50, 94, 6]], path: [[34, 112], [50, 74], [50, 22]] },
  ];
  const SIZES = { golf: GOLF, pool: POOL, bowling: BOWL };

  const wall = (x, y, w, h, angle, label) => Bodies.rectangle(x, y, w, h, { isStatic: true, angle: angle || 0, restitution: 0.72, friction: 0, label: label || 'wall' });
  const edges = (w, h, t) => [wall(w / 2, -t / 2, w + 2 * t, t), wall(w / 2, h + t / 2, w + 2 * t, t), wall(-t / 2, h / 2, t, h + 2 * t), wall(w + t / 2, h / 2, t, h + 2 * t)];
  const ball = (x, y, r, label, o) => Bodies.circle(x, y, r, Object.assign({ restitution: 0.88, friction: 0.01, frictionStatic: 0, density: 0.01, label }, o || {}));
  const speed = b => Math.hypot(b.velocity.x, b.velocity.y);

  // The world of a shot: the table's bodies, the balls (or the ball and the pins) at their current places.
  function build(type, pos) {
    const engine = Engine.create({ gravity: { x: 0, y: 0 }, positionIterations: 8, velocityIterations: 8 });
    const S = SIZES[type], bodies = [], tracked = [];
    if (type === 'golf') {
      const hole = HOLES[pos.hole];
      bodies.push(...edges(S.w, S.h, 8));
      for (const [x, y, w, h, a] of hole.walls) bodies.push(wall(x, y, w, h, a));
      for (const [x, y, r] of hole.bumpers) bodies.push(Bodies.circle(x, y, r, { isStatic: true, restitution: 0.9, friction: 0, label: 'bumper' }));
      for (const p of ['X', 'O']) if (!pos.holed[p]) { const b = ball(pos.balls[p][0], pos.balls[p][1], S.ballR, 'ball:' + p, { frictionAir: S.air }); bodies.push(b); tracked.push([p, b]); }
    } else if (type === 'pool') {
      bodies.push(...edges(S.w, S.h, 8));
      for (const id of ['cue', 'x1', 'x2', 'o1', 'o2', 'black']) if (!pos.down[id]) { const b = ball(pos.balls[id][0], pos.balls[id][1], S.ballR, 'ball:' + id, { frictionAir: S.air }); bodies.push(b); tracked.push([id, b]); }
    } else {
      bodies.push(wall(S.w / 2, -4, S.w + 40, 8, 0, 'end'));      // the back of the lane; the sides are gutters (nothing to bounce off)
      const b = ball(S.start[0], S.start[1], S.ballR, 'ball:ball', { frictionAir: S.air, density: 0.03 });
      bodies.push(b); tracked.push(['ball', b]);
      S.pins.forEach(([x, y], k) => { const pin = ball(x, y, S.pinR, 'pin:' + k, { frictionAir: S.pinAir, density: 0.02, restitution: S.pinBounce, friction: 0.05 }); bodies.push(pin); tracked.push(['p' + k, pin]); });
    }
    Composite.add(engine.world, bodies);
    return { engine, tracked, S };
  }

  // A shot, played out: the shooter's ball is sent off at its aim and power; everything runs until it
  // all stops (or the time is up). Returns the final places, what happened, and the recording.
  function run(type, pos, shooter, shot) {
    const { engine, tracked, S } = build(type, pos);
    const byId = Object.fromEntries(tracked);
    const mover = byId[type === 'golf' ? shooter : type === 'pool' ? 'cue' : 'ball'];
    if (!mover) return null;
    const power = Math.max(0, Math.min(1, Number(shot.power) || 0)), aim = Number(shot.aim) || 0;
    Body.setVelocity(mover, { x: Math.sin(aim) * power * S.vMax / 60, y: -Math.cos(aim) * power * S.vMax / 60 });   // (Matter's velocity is per step at 60 Hz)
    const events = [], gone = {}, flags = {};
    let t = 0, hitPin = false;
    const ev = (k, extra) => { if (events.length < 60) events.push(Object.assign({ t: r2(t), k }, extra || {})); };
    Events.on(engine, 'collisionStart', e => {
      for (const pair of e.pairs) {
        const a = pair.bodyA.label, b = pair.bodyB.label, v = Math.max(speed(pair.bodyA), speed(pair.bodyB)) * 60;
        if (a.startsWith('pin') || b.startsWith('pin')) hitPin = true;
        if (v < 4) continue;
        const kind = a.startsWith('ball') && b.startsWith('ball') ? 'balls' : (a.startsWith('pin') || b.startsWith('pin')) ? 'pin' : 'wall';
        const last = events[events.length - 1];
        if (last && last.k === kind && t - last.t < 0.08) continue;
        ev(kind, { v: Math.round(v) });
      }
    });
    const frames = [], ids = tracked.map(x => x[0]);
    const frame = () => frames.push(tracked.map(([id, b]) => (gone[id] ? [null, null] : [r1(b.position.x), r1(b.position.y)])).flat());
    const remove = (id, k, extra) => { gone[id] = true; Composite.remove(engine.world, byId[id]); ev(k, Object.assign({ id }, extra || {})); };
    frame();
    let still = 0, step = 0;
    const maxSteps = Math.round(S.maxT * 1000 / STEP);
    while (step < maxSteps) {
      Engine.update(engine, STEP); step++; t = step * STEP / 1000;
      for (const [id, b] of tracked) {                            // rolling resistance: a steady slowing, so balls stop instead of trickling on
        if (gone[id]) continue;
        const v = speed(b), dv = (id[0] === 'p' ? S.pinRoll : S.roll) * STEP / 1000 / 60;
        if (v > 0) { const f = Math.max(0, v - dv) / v; Body.setVelocity(b, { x: b.velocity.x * f, y: b.velocity.y * f }); }
      }
      // the table's own rules, checked every step
      if (type === 'golf') {
        const cup = HOLES[pos.hole].cup;
        for (const [id, b] of tracked) {
          if (gone[id]) continue;
          const d = Math.hypot(b.position.x - cup[0], b.position.y - cup[1]), v = speed(b) * 60;
          if (d < S.cupR) {
            if (v <= S.holeSpeed && !flags[id]) { remove(id, 'hole'); }
            else if (!flags[id]) {                                 // (after a lip-out the ball must leave the cup before it can drop)                                 // too fast: it lips out, sent off sideways and slowed
              flags[id] = true;
              const n = Vector.normalise({ x: b.position.x - cup[0] || 0.01, y: b.position.y - cup[1] });
              const vel = b.velocity, dot = vel.x * n.x + vel.y * n.y;
              Body.setVelocity(b, { x: (vel.x - 1.6 * dot * n.x) * S.lipKick, y: (vel.y - 1.6 * dot * n.y) * S.lipKick });
              ev('lip', { id });
            }
          } else if (d > S.cupR + 2) flags[id] = false;
        }
      } else if (type === 'pool') {
        for (const [id, b] of tracked) {
          if (gone[id]) continue;
          if (S.pockets.some(([px, py, pr]) => Math.hypot(b.position.x - px, b.position.y - py) < pr)) remove(id, 'pocket');
        }
      } else {
        for (const [id, b] of tracked) {
          if (gone[id]) continue;
          const off = b.position.y < -6 || b.position.y > S.h + 6 || b.position.x < -6 || b.position.x > S.w + 6;
          if (id === 'ball') { if (off || b.position.x < S.gutter || b.position.x > S.w - S.gutter) remove(id, b.position.y < 0 ? 'end' : 'gutter'); }
          else if (off) remove(id, 'off');
        }
      }
      if (step % SUB === 0) frame();
      const moving = tracked.some(([id, b]) => !gone[id] && speed(b) * 60 > (S.still || 0.9));   // (a pin still wobbling along slowly is as good as down)
      still = moving ? 0 : still + 1;
      if (still >= 24 && step > 30) break;
    }
    if (step % SUB !== 0) frame();
    for (const [id, b] of tracked) if (!gone[id]) Body.setVelocity(b, { x: 0, y: 0 });
    const final = {};
    for (const [id, b] of tracked) final[id] = gone[id] ? null : [r2(b.position.x), r2(b.position.y)];
    let result;
    if (type === 'golf') result = { holed: { X: !!gone.X, O: !!gone.O }, first: (events.find(e => e.k === 'hole') || {}).id || null };
    else if (type === 'pool') result = { pocketed: events.filter(e => e.k === 'pocket').map(e => e.id) };
    else {
      const down = BOWL.pins.map(([x, y], k) => gone['p' + k] || Math.hypot(final['p' + k][0] - x, final['p' + k][1] - y) > S.knocked);
      result = { down, knocked: down.filter(Boolean).length, gutter: !hitPin && events.some(e => e.k === 'gutter') };   // a gutter ball: one that never reached the pins
    }
    ev('stop');
    return { final, events, rec: { fps: FPS, ids, frames }, result, ms: Math.round(frames.length / FPS * 1000) };
  }

  return { GOLF, POOL, BOWL, HOLES, SIZES, FPS, run };
});
