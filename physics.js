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
  // The time scale of Mini Golf, Pool and Bowling: a shot plays 1.5 times as fast as the world it is worked
  // out in (the recording at 45 frames a second, the events' times to match), so the balls travel and slow
  // down half as fast again along exactly the same paths: every shot goes just as far, ends just the same.
  const TS = 1.5;
  const r1 = x => Math.round(x * 10) / 10 + 0;
  const r2 = x => Math.round(x * 100) / 100 + 0;

  // ---------- the tables ----------
  const GOLF = { w: 100, h: 160, ballR: 2.4, cupR: 3.6, holeSpeed: 32, lipKick: 0.5, vMax: 95, reach: 174, maxT: 9, air: 0.004, roll: 12 };   // full power: a full putt rolls about reach on open ground (more than the course is long); reach is for the computer's aim, not a cap
  // Pool: a full-power shot runs the table's length 3 times and more (off the far rails twice or more); the
  // power is the meter's level and the speed goes with its square (curve), so a light tap is still light.
  // At that speed each step is cut in four (sub), so no ball passes through a rail or another ball.
  const POOL = { w: 100, h: 180, ballR: 3.9, vMax: 300, curve: 2, sub: 4, maxT: 12, air: 0.004, roll: 9,
    pockets: [[0, 0, 8.4], [100, 0, 8.4], [0, 90, 8.4], [100, 90, 8.4], [0, 180, 8.4], [100, 180, 8.4]],   // x, y, the reach of the pocket (and its size as drawn): about 2.2 times the ball across (balls half as big again as they were, pockets twice the size)
    start: { cue: [50, 140], black: [50, 52], x1: [40, 66], x2: [60, 80], o1: [60, 66], o2: [40, 80] } };
  const BOWL = { w: 100, h: 240, ballR: 3.5, pinR: 2.0, vMax: 150, maxT: 7, air: 0.002, roll: 4, pinAir: 0.004, pinRoll: 6, pinBounce: 0.9, still: 4, gutter: 7, knocked: 2.2,
    start: [50, 214], pins: [[50, 50], [45, 38], [55, 38], [40, 26], [50, 26], [60, 26], [35, 14], [45, 14], [55, 14], [65, 14]] };
  // Mini Golf's holes: walls as [cx, cy, w, h, angle], bumpers as [cx, cy, r], the tee and the cup, and a
  // path (the way round, for the computer's aim). Both balls start side by side on the tee. A full putt
  // crosses the whole course; the difficulty is the course: every hole has turns, walls and bumpers in the
  // way, and takes the computer (with its usual error) 3 to 5 putts on average. 22 layouts made by hand,
  // then the mirror image of each that is not its own (20 more); a hole's `of` is its layout. (The first six
  // keep their places: a square dealt one before plays on with it.)
  const wallTo = (x1, y1, x2, y2, t = 5) => [(x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1), t, +Math.atan2(y2 - y1, x2 - x1).toFixed(3)];   // a wall from one point to another
  const LAYOUTS = [
    { name: 'Zigzag', tee: [50, 148], cup: [30, 18], walls: [[35, 116, 70, 6, 0], [65, 70, 70, 6, 0], [50, 36, 5, 30, 0]], bumpers: [[50, 92, 4.5], [76, 24, 4]], path: [[84, 128], [84, 100], [16, 88], [16, 54], [30, 18]] },
    { name: 'Dogleg', tee: [18, 146], cup: [22, 20], walls: [[34, 98, 68, 6, 0], [44, 50, 48, 5, 0.42], [12, 70, 24, 5, 0]], bumpers: [[88, 84, 5], [62, 76, 4], [70, 24, 4.5], [60, 124, 4]], path: [[50, 136], [84, 112], [80, 94], [72, 62], [60, 30], [22, 20]] },
    { name: 'The horseshoe', tee: [50, 148], cup: [50, 30], walls: [[50, 12, 60, 6, 0], [23, 35, 6, 52, 0], [77, 35, 6, 52, 0], [10, 58, 20, 6, 0], [90, 58, 20, 6, 0], [50, 102, 50, 6, 0], [50, 76, 24, 5, 0]], bumpers: [[12, 104, 5], [88, 104, 5], [36, 126, 4], [64, 126, 4]], path: [[50, 132], [16, 120], [14, 86], [30, 70], [50, 62], [50, 30]] },
    { name: 'The funnel', tee: [50, 148], cup: [50, 20], walls: [[19, 96, 56, 6, -0.544], [81, 96, 56, 6, 0.544], [50, 56, 34, 5, 0], [86, 34, 28, 5, -0.5]], bumpers: [[50, 126, 4], [30, 72, 3.5]], path: [[38, 132], [50, 84], [24, 64], [24, 44], [50, 20]] },
    { name: 'Round the bar', tee: [50, 148], cup: [50, 22], walls: [[56, 76, 88, 6, 0], [86, 114, 28, 5, 0.6], [50, 40, 30, 5, 0], [16, 34, 22, 5, 0.6]], bumpers: [[50, 112, 5], [74, 50, 4], [26, 58, 3.5]], path: [[30, 130], [6, 96], [6, 62], [30, 46], [50, 22]] },
    { name: 'Pinball', tee: [50, 148], cup: [50, 18], walls: [[18, 66, 30, 5, 0.5], [82, 66, 30, 5, -0.5], [36, 30, 5, 22, 0], [64, 30, 5, 22, 0], [50, 8, 34, 5, 0]], bumpers: [[30, 108, 6], [70, 108, 6], [50, 86, 6], [50, 50, 5], [16, 40, 4], [84, 40, 4], [50, 126, 3.5]], path: [[36, 128], [34, 88], [32, 54], [50, 42], [50, 18]] },
  
  { name: 'Switchback', tee: [40, 148], cup: [30, 18], walls: [[28, 122, 56, 5, 0], [72, 86, 56, 5, 0], [28, 50, 56, 5, 0]], bumpers: [[62, 26, 3]],
    path: [[80, 134], [80, 112], [20, 102], [20, 68], [80, 66], [80, 36], [30, 18]] },
  { name: 'Island', tee: [50, 148], cup: [50, 60], walls: [[32, 60, 5, 30, 0], [68, 60, 5, 30, 0], [50, 75, 41, 5, 0], [86, 96, 28, 5, -0.4]], bumpers: [[22, 112, 5], [64, 116, 4], [80, 30, 4]],
    path: [[40, 126], [18, 90], [16, 40], [30, 30], [50, 36], [50, 60]] },
  { name: 'Gates', tee: [30, 148], cup: [24, 20], walls: [[24, 122, 48, 5, 0], [92, 122, 16, 5, 0], [8, 90, 16, 5, 0], [74, 90, 52, 5, 0], [32, 58, 64, 5, 0]], bumpers: [[86, 36, 3.5]],
    path: [[64, 134], [64, 110], [32, 100], [32, 78], [80, 68], [80, 46], [24, 20]] },
  { name: 'Spiral', tee: [50, 148], cup: [60, 82], walls: [[39, 112, 78, 5, 0], [78, 79, 5, 66, 0], [67, 46, 22, 5, 0]], bumpers: [[56, 18, 3.5]],
    path: [[90, 128], [90, 30], [32, 32], [36, 66], [60, 82]] },
  { name: 'Hairpin', tee: [24, 148], cup: [76, 136], walls: [[50, 98, 5, 124, 0]], bumpers: [[22, 96, 5], [78, 74, 5], [50, 18, 4.5]],
    path: [[26, 120], [36, 70], [24, 26], [76, 22], [70, 54], [66, 100], [76, 136]] },
  { name: 'Chicane', tee: [50, 148], cup: [78, 18], walls: [wallTo(0, 100, 50, 113), wallTo(50, 72, 100, 85), wallTo(0, 36, 50, 49)], bumpers: [[92, 142, 3.5]],
    path: [[80, 128], [80, 98], [20, 92], [20, 62], [80, 58], [80, 18]] },
  { name: 'Corner pocket', tee: [50, 148], cup: [88, 16], walls: [[65, 70, 70, 5, 0], wallTo(78, 37, 100, 30), [12, 104, 24, 5, 0]], bumpers: [[40, 116, 5]],
    path: [[28, 124], [18, 84], [20, 46], [36, 22], [66, 18], [88, 16]] },
  { name: 'Bumper alley', tee: [50, 148], cup: [14, 22], walls: [[31, 91, 5, 82, 0], [69, 91, 5, 82, 0]], bumpers: [[42, 112, 5], [58, 92, 5], [42, 72, 5], [58, 58, 4], [50, 34, 5]],
    path: [[50, 128], [58, 112], [42, 92], [58, 74], [44, 54], [32, 36], [14, 22]] },
  { name: 'The cross', tee: [50, 148], cup: [50, 34], walls: [[50, 88, 48, 5, 0], [50, 88, 5, 48, 0], wallTo(30, 30, 42, 46), wallTo(70, 30, 58, 46)], bumpers: [[82, 122, 5]],
    path: [[30, 130], [14, 92], [16, 46], [26, 16], [50, 18], [50, 34]] },
  { name: 'Ladder', tee: [50, 148], cup: [50, 20], walls: [[16, 122, 32, 5, 0], [84, 122, 32, 5, 0], [50, 98, 30, 5, 0], [16, 74, 32, 5, 0], [84, 74, 32, 5, 0], [50, 50, 30, 5, 0]], bumpers: [[74, 50, 3.5]],
    path: [[50, 132], [50, 110], [74, 98], [50, 86], [50, 62], [22, 50], [50, 20]] },
  { name: 'Moat', tee: [50, 148], cup: [50, 42], walls: [[50, 102, 52, 5, 0]],
    bumpers: [135, 180, 225, 270, 315, 45].map(deg => { const a = deg * Math.PI / 180; return [+(50 + 15 * Math.cos(a)).toFixed(1), +(42 - 15 * Math.sin(a)).toFixed(1), 3.6]; }).concat([[84, 124, 4]]),   // a ring round the cup, open at the top and on the right
    path: [[18, 120], [12, 78], [14, 26], [34, 12], [50, 14], [50, 42]] },
  { name: 'Keyhole', tee: [50, 148], cup: [50, 22], walls: [[38, 28, 5, 28, 0], [62, 28, 5, 28, 0], wallTo(20, 66, 40, 84), wallTo(80, 66, 60, 84)], bumpers: [[50, 110, 5], [16, 40, 4], [84, 40, 4]],
    path: [[30, 124], [14, 92], [24, 56], [42, 50], [50, 48], [50, 22]] },
  { name: 'The lobby', tee: [50, 148], cup: [14, 18], walls: [[20, 80, 40, 5, 0], [80, 80, 40, 5, 0], [30, 36, 5, 40, 0]], bumpers: [[50, 104, 5], [80, 120, 4]],
    path: [[30, 118], [36, 98], [50, 80], [46, 62], [16, 60], [14, 18]] },
  { name: 'Diamond', tee: [50, 148], cup: [50, 28], walls: [wallTo(30, 86, 50, 66), wallTo(50, 66, 70, 86), wallTo(30, 86, 50, 106), wallTo(50, 106, 70, 86), [8, 52, 16, 5, 0]], bumpers: [[50, 44, 4], [86, 46, 4], [20, 124, 3.5], [36, 26, 3], [66, 24, 3]],
    path: [[36, 124], [20, 96], [22, 60], [30, 30], [50, 28]] },
  { name: 'Double dogleg', tee: [84, 148], cup: [16, 20], walls: [wallTo(100, 112, 46, 98), wallTo(0, 70, 54, 56), [74, 32, 5, 28, 0]], bumpers: [[30, 120, 5], [32, 40, 3]],
    path: [[60, 128], [24, 112], [20, 92], [70, 88], [86, 60], [56, 40], [16, 20]] },
  { name: 'Pinwheel', tee: [50, 148], cup: [50, 80], walls: [[40, 64, 28, 5, 0], [66, 72, 5, 24, 0], [60, 96, 28, 5, 0], [34, 88, 5, 24, 0]], bumpers: [[50, 128, 3.5]],
    path: [[30, 128], [24, 104], [20, 70], [26, 48], [52, 50], [76, 60], [80, 86], [56, 80], [50, 80]] },
  ];
  const r2h = v => Math.round(v * 100) / 100 + 0;
  const mirror = h => ({ name: h.name + ', mirrored', tee: [r2h(100 - h.tee[0]), h.tee[1]], cup: [r2h(100 - h.cup[0]), h.cup[1]], walls: h.walls.map(([x, y, w, hh, a]) => [r2h(100 - x), y, w, hh, r2h(-(a || 0))]), bumpers: h.bumpers.map(([x, y, r]) => [r2h(100 - x), y, r]), path: h.path.map(([x, y]) => [r2h(100 - x), y]) });
  const shape = h => JSON.stringify([h.walls.map(w => w.map(r2h).join()).sort(), h.bumpers.map(b => b.map(r2h).join()).sort(), h.cup.map(r2h)]);
  const HOLES = LAYOUTS.map((h, i) => Object.assign({}, h, { of: i }));
  LAYOUTS.forEach((h, i) => { const m = mirror(h); if (shape(m) !== shape(h)) HOLES.push(Object.assign(m, { of: i })); });
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
      const rank = id => (id === 'cue' ? 0 : id === 'black' ? 3 : id[0] === 'x' ? 1 : 2);   // (the order engine.js keeps: poolIds)
      for (const id of Object.keys(pos.balls).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }))) if (!pos.down[id]) { const b = ball(pos.balls[id][0], pos.balls[id][1], S.ballR, 'ball:' + id, { frictionAir: S.air }); bodies.push(b); tracked.push([id, b]); }
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
    const power = Math.max(0, Math.min(1, Number(shot.power) || 0)), aim = Number(shot.aim) || 0, v0 = Math.pow(power, S.curve || 1) * S.vMax;
    Body.setVelocity(mover, { x: Math.sin(aim) * v0 / 60, y: -Math.cos(aim) * v0 / 60 });   // (Matter's velocity is per step at 60 Hz, whatever the step's length)
    const events = [], gone = {}, flags = {};
    let t = 0, hitPin = false;
    const ev = (k, extra) => { if (events.length < 60) events.push(Object.assign({ t: r2(t / TS), k }, extra || {})); };   // (the time as it plays: see TS)
    Events.on(engine, 'collisionStart', e => {
      for (const pair of e.pairs) {
        const a = pair.bodyA.label, b = pair.bodyB.label, v = Math.max(speed(pair.bodyA), speed(pair.bodyB)) * 60;
        if (a.startsWith('pin') || b.startsWith('pin')) hitPin = true;
        if (v < 4) continue;
        const kind = a.startsWith('ball') && b.startsWith('ball') ? 'balls' : (a.startsWith('pin') || b.startsWith('pin')) ? 'pin' : 'wall';
        const last = events[events.length - 1];
        if (last && last.k === kind && t / TS - last.t < 0.08) continue;
        ev(kind, { v: Math.round(v) });
      }
    });
    const frames = [], ids = tracked.map(x => x[0]);
    const frame = () => frames.push(tracked.map(([id, b]) => (gone[id] ? [null, null] : [r1(b.position.x), r1(b.position.y)])).flat());
    const remove = (id, k, extra) => { gone[id] = true; Composite.remove(engine.world, byId[id]); ev(k, Object.assign({ id }, extra || {})); };
    frame();
    let still = 0, step = 0;
    const maxSteps = Math.round(S.maxT * 1000 / STEP), sub = S.sub || 1, dt = STEP / sub;   // (sub-steps: Pool's fast balls move less than a sixth of their width each one)
    while (step < maxSteps) {
     for (let q = 0; q < sub; q++) {
      Engine.update(engine, dt); t = (step + (q + 1) / sub) * STEP / 1000;
      for (const [id, b] of tracked) {                            // rolling resistance: a steady slowing, so balls stop instead of trickling on
        if (gone[id]) continue;
        const v = speed(b), dv = (id[0] === 'p' ? S.pinRoll : S.roll) * dt / 1000 / 60;
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
     }
      step++; t = step * STEP / 1000;
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
    return { final, events, rec: { fps: FPS * TS, ids, frames }, result, ms: Math.round(frames.length / (FPS * TS) * 1000) };
  }

  // ---------- Pinball: a portrait table, played live on the phone (or by the computer's hand) ----------
  // Units as the other tables: 100 across, 180 tall, y down. The walls, the bumpers, the slingshots and
  // the targets are Matter bodies; the two flippers are swept capsules worked out here each step (a
  // flipper's surface speed goes into the bounce, and at these step lengths nothing moves more than a
  // third of the ball's width in a step, so the ball never passes through a flipper or a wall). The ball
  // starts in the plunger lane on the right; a launch sends it up the lane and round the top. The targets
  // are the same for both players; each player lights their own. A ball that drains in the first save
  // seconds after its launch is served again (the same move goes on).
  const PIN = {
    w: 100, h: 180, ballR: 2.6, g: 300, hz: 480, fps: 30, vmax: 420, drain: 176, wall: 0.5,
    flip: { len: 21, thick: 3.8, rest: 0.48, up: -0.48, speed: 17, e: 0.4, L: [22, 149], R: [68, 149] },
    lane: { x0: 89.7, x1: 98, top: 44, serve: [93.9, 168] },
    bump: { r: 5, kick: 165, at: [[30, 54], [60, 54], [45, 72]] },
    sling: { kick: 150 },
    spin: { cx: 45, cy: 104, r: 10, w: 1.7 },
    // the targets: id, place, size, and how they are reached (for the drawing and the tuning)
    targets: [
      { id: 0, x: 3.4, y: 98, r: 2.8, name: 'Left post' },
      { id: 1, x: 83.9, y: 98, r: 2.8, name: 'Right post' },
      { id: 2, x: 45, y: 34, r: 2.6, name: 'Top centre' },
      { id: 3, x: 15, y: 23, r: 2.4, name: 'Left lane' },
      { id: 4, x: 74, y: 67, r: 2.4, name: 'Behind the rail' },
      { id: 5, x: 45, y: 104, r: 2.6, name: 'Spinner', spin: true },
      { id: 6, x: 22, y: 72, r: 2.4, name: 'Left loop' },
    ],
  };
  // The walls as thick segments [x1, y1, x2, y2, thickness]: the outside (the top arched), the lane, the
  // inlanes and outlanes, the rails. The playfield is 2 to 88 across, the plunger lane beside it.
  const PIN_WALLS = [
    [1, 180, 1, 34, 2], [1, 34, 7, 15, 2.4], [7, 15, 20, 5, 2.4], [20, 5, 50, 1.5, 2.4], [50, 1.5, 80, 5, 2.4], [80, 5, 93, 11, 2.4], [93, 11, 99, 25, 2.4], [99, 25, 99, 180, 2],   // the outside
    [88.5, 180, 88.5, PIN.lane.top, 2.4],                                                                 // the plunger lane's inner wall
    [10.5, 30, 10.5, 40, 2.4], [19.5, 30, 19.5, 40, 2.4],                                                  // the left lane's posts (the target at its top)
    [9.5, 112, 9.5, 126, 2.4], [9.5, 126, 19, 139, 2.6], [80, 112, 80, 126, 2.4], [80, 126, 71, 139, 2.6],   // the inlane guides (the outlanes outside them)
    [59, 72, 77, 56, 2.6], [77, 56, 77, 48, 2.4],                                                         // the rail with a target behind it
    [16, 62, 16, 80, 2.4], [16, 80, 23, 86, 2.4],                                                         // the left loop's wall (its target inside)
  ];
  // The slingshots: the triangle's corners; the inner face kicks.
  const PIN_SLINGS = [[[14, 114], [14, 130], [24, 137]], [[76, 114], [76, 130], [66, 137]]];
  function pinSeg(x1, y1, x2, y2, t, label) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    return Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len + t, t, { isStatic: true, angle: Math.atan2(y2 - y1, x2 - x1), restitution: PIN.wall, friction: 0, label: label || 'wall' });
  }
  // A table for one ball: its targets as they stand for the player (lit: an array of 0/1), the ball in the lane.
  function pinNew(cfg, lit) {
    cfg = cfg || {};
    const engine = Engine.create({ gravity: { x: 0, y: 0 }, positionIterations: 6, velocityIterations: 6 }), bodies = [];
    for (const w of PIN_WALLS) bodies.push(pinSeg(...w));
    for (const [x, y] of PIN.bump.at) bodies.push(Bodies.circle(x, y, PIN.bump.r, { isStatic: true, restitution: 0.6, friction: 0, label: 'bumper' }));
    PIN_SLINGS.forEach((tri, k) => bodies.push(Bodies.fromVertices((tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3, [tri.map(([x, y]) => ({ x, y }))], { isStatic: true, restitution: 0.6, friction: 0, label: 'sling:' + k })));
    for (const t of PIN.targets) if (!t.spin) bodies.push(Bodies.circle(t.x, t.y, t.r * (cfg.size || 1), { isStatic: true, restitution: 0.55, friction: 0, label: 'target:' + t.id }));
    const ball = Bodies.circle(PIN.lane.serve[0], PIN.lane.serve[1], PIN.ballR, { restitution: 0.4, friction: 0, frictionAir: 0, frictionStatic: 0, density: 0.02, label: 'ball' });
    bodies.push(ball);
    Composite.add(engine.world, bodies);
    const w = { cfg, engine, ball, t: 0, inPlay: false, launchedAt: null, lit: (lit || []).slice(), hits: [], events: [], frames: [], flip: { L: { a: PIN.flip.rest, w: 0, on: false }, R: { a: PIN.flip.rest, w: 0, on: false } }, over: false, saves: 0, n: 0, frameAt: 0, still: { x: 0, y: 0, t: 0 }, nudges: 0 };
    Events.on(engine, 'collisionStart', e => { for (const pr of e.pairs) pinTouch(w, pr.bodyA === ball ? pr.bodyB : pr.bodyB === ball ? pr.bodyA : null); });
    pinFrame(w);
    return w;
  }
  const pinV = w => ({ x: w.ball.velocity.x * 60, y: w.ball.velocity.y * 60 });          // the ball's speed, units a second
  const pinSetV = (w, vx, vy) => { const s = Math.hypot(vx, vy), k = s > PIN.vmax ? PIN.vmax / s : 1; Body.setVelocity(w.ball, { x: (vx * k) / 60, y: (vy * k) / 60 }); };
  const pinEv = (w, k, extra) => { if (w.events.length < 400) w.events.push(Object.assign({ t: Math.round(w.t * 1000) / 1000, k }, extra || {})); };
  // The spinner's target, t seconds in (it goes round its centre).
  const pinSpinAt = (t, cfg) => { const s = PIN.spin, a = t * s.w * ((cfg && cfg.spin) || 1); return [s.cx + s.r * Math.cos(a), s.cy + s.r * Math.sin(a)]; };
  function pinLight(w, id) {
    if (w.lit[id]) return;
    w.lit[id] = 1; w.hits.push({ id, t: Math.round(w.t * 1000) / 1000 }); pinEv(w, 'hit', { id });
  }
  function pinTouch(w, body) {
    if (!body || !w.inPlay) return;
    const L = body.label, b = w.ball.position;
    if (L.startsWith('target:')) pinLight(w, Number(L.slice(7)));
    else if (L === 'bumper') {                                       // a pop bumper: the ball is kicked straight off it
      const n = { x: b.x - body.position.x, y: b.y - body.position.y }, d = Math.hypot(n.x, n.y) || 1, k = PIN.bump.kick * ((w.cfg && w.cfg.bump) || 1);
      pinSetV(w, (n.x / d) * k, (n.y / d) * k); pinEv(w, 'bump');
    } else if (L.startsWith('sling:')) {                             // a slingshot: its inner face kicks the ball across and up
      const k = Number(L.slice(6)), dir = k === 0 ? 1 : -1, v = pinV(w);
      if ((dir > 0 && b.x > body.position.x) || (dir < 0 && b.x < body.position.x)) { pinSetV(w, dir * PIN.sling.kick * 0.8 + v.x * 0.2, -PIN.sling.kick * 0.6); pinEv(w, 'sling'); }
    }
  }
  // The ball back in the plunger lane, waiting for a launch.
  function pinServe(w) { Body.setPosition(w.ball, { x: PIN.lane.serve[0], y: PIN.lane.serve[1] }); Body.setVelocity(w.ball, { x: 0, y: 0 }); w.inPlay = false; w.launchedAt = null; }
  // A launch: power 0..1 (a tap: the default).
  function pinLaunch(w, power) {
    if (w.inPlay || w.over) return false;
    const p = power == null ? 0.82 : Math.max(0, Math.min(1, power)), lo = 240, hi = 400;
    w.inPlay = true; w.launchedAt = w.t; pinSetV(w, 0, -(lo + (hi - lo) * p)); pinEv(w, 'launch', { p: Math.round(p * 100) / 100 });
    return true;
  }
  // A flipper's line (pivot to tip) at its angle.
  function pinFlipLine(side, a) { const [px, py] = PIN.flip[side], s = side === 'L' ? 1 : -1; return [px, py, px + s * PIN.flip.len * Math.cos(a), py + PIN.flip.len * Math.sin(a)]; }
  // The flippers' sweep and the ball against them: a capsule each, its surface moving with the flipper.
  function pinFlippers(w, dt) {
    const F = PIN.flip, ball = w.ball;
    for (const side of ['L', 'R']) {
      const f = w.flip[side], to = f.on ? F.up : F.rest, max = F.speed * dt, da = Math.max(-max, Math.min(max, to - f.a));
      f.a += da; f.w = da / dt;
      const [x1, y1, x2, y2] = pinFlipLine(side, f.a), bx = ball.position.x, by = ball.position.y;
      const dx = x2 - x1, dy = y2 - y1, u = Math.max(0, Math.min(1, ((bx - x1) * dx + (by - y1) * dy) / (dx * dx + dy * dy)));
      const cx = x1 + u * dx, cy = y1 + u * dy, ex = bx - cx, ey = by - cy, d = Math.hypot(ex, ey), rs = PIN.ballR + F.thick / 2 * (1 - 0.35 * u);
      if (d >= rs) continue;
      const nx = d > 1e-6 ? ex / d : 0, ny = d > 1e-6 ? ey / d : -1;
      Body.setPosition(ball, { x: cx + nx * rs, y: cy + ny * rs });
      const om = (side === 'L' ? 1 : -1) * f.w, rx = cx - x1, ry = cy - y1;   // the flipper's surface speed at the touch (it turns about the pivot)
      const sx = side === 'L' ? -om * ry : om * ry, sy = side === 'L' ? om * rx : -om * rx;
      const v = pinV(w), relx = v.x - sx, rely = v.y - sy, vn = relx * nx + rely * ny;
      if (vn < 0) pinSetV(w, v.x - (1 + F.e) * vn * nx, v.y - (1 + F.e) * vn * ny);
    }
  }
  // One frame's worth of steps (ms of time) with the flippers held as given; returns the events of the frame.
  function pinRun(w, ms, input) {
    if (w.over) return [];
    const from = w.events.length, dt = 1 / PIN.hz, g = PIN.g * ((w.cfg && w.cfg.g) || 1);
    if (input) { w.flip.L.on = !!input.L; w.flip.R.on = !!input.R; }
    let left = Math.min(100, ms) / 1000;
    while (left > 1e-9 && !w.over) {
      const h = Math.min(dt, left); left -= h;
      if (w.inPlay) { const v = pinV(w); pinSetV(w, v.x, v.y + g * h); }
      Engine.update(w.engine, h * 1000);
      pinFlippers(w, h);
      w.t += h; w.n++;
      const b = w.ball.position;
      if (!w.inPlay) { Body.setPosition(w.ball, { x: PIN.lane.serve[0], y: PIN.lane.serve[1] }); Body.setVelocity(w.ball, { x: 0, y: 0 }); }
      else {
        if (b.x < PIN.ballR || b.x > PIN.w - PIN.ballR || b.y < PIN.ballR) {   // (never past the outside, whatever happened)
          const v = pinV(w); Body.setPosition(w.ball, { x: Math.max(PIN.ballR + 2, Math.min(PIN.w - PIN.ballR - 2, b.x)), y: Math.max(PIN.ballR + 2, b.y) }); pinSetV(w, b.x < PIN.ballR || b.x > PIN.w - PIN.ballR ? -v.x * 0.5 : v.x, b.y < PIN.ballR ? Math.abs(v.y) * 0.5 : v.y); pinEv(w, 'guard');
        }
        const [sx, sy] = pinSpinAt(w.t, w.cfg), st = PIN.targets[5];
        if (Math.hypot(b.x - sx, b.y - sy) < st.r * ((w.cfg && w.cfg.size) || 1) + PIN.ballR) pinLight(w, 5);
        for (const t of PIN.targets) if (!t.spin && !w.lit[t.id] && Math.hypot(b.x - t.x, b.y - t.y) < t.r * ((w.cfg && w.cfg.size) || 1) + PIN.ballR) pinLight(w, t.id);   // (and by distance: a touch is never missed; never through a wall, as no target reaches past one at any size the settings allow)
        const back = b.x > PIN.lane.x0 + 0.6 && b.y > PIN.lane.top + 4 && w.t - w.launchedAt > 0.6;
        if (b.y > PIN.drain || back) {
          const saved = back || w.t - w.launchedAt < ((w.cfg && w.cfg.save) != null ? w.cfg.save : 3);
          if (saved) { pinEv(w, back ? 'lane' : 'save'); w.saves++; pinServe(w); }
          else { pinEv(w, 'drain'); w.over = true; }
        }
        if (w.lit.length && w.lit.every(Boolean)) { w.over = true; pinEv(w, 'all'); }
        if (Math.hypot(b.x - w.still.x, b.y - w.still.y) > 1.5) w.still = { x: b.x, y: b.y, t: w.t };
        else if (w.inPlay && w.t - w.still.t > 2 && b.y < PIN.flip.L[1] - 6) { const s = w.nudges++ % 2 ? 1 : -1; pinSetV(w, s * 90, -130); w.still.t = w.t; pinEv(w, 'nudge'); }   // a ball resting off the flippers: a nudge sets it going again
        if (w.inPlay && w.t - w.launchedAt > ((w.cfg && w.cfg.maxBall) || 120)) { pinEv(w, 'time'); w.over = true; }   // (a ball can't last for ever)
      }
      if (w.t >= w.frames.length / PIN.fps - 1e-9) pinFrame(w);   // (frame k at k/30 s exactly, so the recording keeps time with the ball however the steps fall)
    }
    return w.events.slice(from);
  }
  // The recording: the ball and the flippers 30 times a second (and the events with their times).
  // (a frame: the ball's place to a tenth, and which flippers were held)
  function pinFrame(w) {
    w.frameAt = w.t;
    const b = w.ball.position;
    if (w.frames.length < PIN.fps * 400) w.frames.push([Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, (w.flip.L.on ? 1 : 0) + (w.flip.R.on ? 2 : 0)]);
  }
  // The recording as a string: per frame the ball's x and y in tenths (base 36) and the flippers held.
  const pinPack = frames => frames.map(([x, y, f]) => Math.round(x * 10).toString(36) + '.' + Math.round(y * 10).toString(36) + (f ? '.' + f : '')).join(',');
  function pinUnpack(str) {
    if (typeof str !== 'string' || str.length > 1e6) return null;
    if (!str) return [];
    const out = [];
    for (const part of str.split(',')) {
      const m = /^([0-9a-z]{1,4})\.([0-9a-z]{1,4})(?:\.([0-3]))?$/.exec(part);
      if (!m) return null;
      out.push([parseInt(m[1], 36) / 10, parseInt(m[2], 36) / 10, m[3] ? Number(m[3]) : 0]);
    }
    return out;
  }
  // A flipper's angle along a recording: it swings towards up or rest at its speed, as in play.
  function pinFlipAngles(frames) {
    const a = { L: PIN.flip.rest, R: PIN.flip.rest }, out = [], max = PIN.flip.speed / PIN.fps;
    for (const f of frames) { for (const [s, bit] of [['L', 1], ['R', 2]]) { const to = f[2] & bit ? PIN.flip.up : PIN.flip.rest; a[s] += Math.max(-max, Math.min(max, to - a[s])); } out.push([a.L, a.R]); }
    return out;
  }
  const pinResult = w => ({ hits: w.hits.map(h => [h.id, h.t]), ms: Math.round(w.t * 1000), rec: pinPack(w.frames), events: w.events.filter(e => e.k !== 'guard').slice(0, 300), saves: w.saves, end: w.over ? (w.lit.every(Boolean) ? 'all' : w.events.some(e => e.k === 'time') ? 'time' : 'drain') : 'out' });
  // The computer's hand: it sees the ball react seconds late; when the ball comes down over a flipper it
  // flips (a little early or late: jitter) and holds for a moment. A launch: a tap at a random power.
  function pinAi(cfg, lit, rng, hand) {
    hand = hand || { react: [0.05, 0.09], jitter: 0.05, hold: [0.12, 0.28], launch: [0.4, 1] };
    const w = pinNew(cfg, lit), seen = [], react = hand.react[0] + (hand.react[1] - hand.react[0]) * rng(), plan = { L: null, R: null };
    const F = PIN.flip, frame = 1000 / 60;
    let wait = 0.6 + rng() * 0.6;
    for (let k = 0; k < 60 * 180 && !w.over; k++) {
      if (!w.inPlay) { wait -= frame / 1000; if (wait <= 0) { pinLaunch(w, hand.launch[0] + (hand.launch[1] - hand.launch[0]) * rng()); wait = 0.5 + rng() * 0.6; } }
      const v = pinV(w);
      seen.push({ t: w.t, x: w.ball.position.x, y: w.ball.position.y, vy: v.y });
      while (seen.length > 1 && seen[1].t <= w.t - react) seen.shift();
      const s = seen[0];
      for (const side of ['L', 'R']) {
        const [px, py] = F[side], near = Math.hypot(s.x - px, s.y - py) < F.len + 4 && s.y < py + 12 && s.y > py - 14 && (side === 'L' ? s.x < 50 : s.x > 50);
        if (!plan[side] && near && s.vy > -30 && w.inPlay) plan[side] = { at: w.t + (rng() * 2 - 1) * hand.jitter, until: null };
        const p = plan[side];
        if (p && p.until == null && w.t >= p.at) p.until = w.t + hand.hold[0] + (hand.hold[1] - hand.hold[0]) * rng();
        if (p && p.until != null && w.t > p.until) plan[side] = near ? { at: w.t + 0.35 + rng() * 0.2, until: null } : null;   // (not again at once)
      }
      pinRun(w, frame, { L: !!(plan.L && plan.L.until != null && w.t <= plan.L.until), R: !!(plan.R && plan.R.until != null && w.t <= plan.R.until) });
    }
    return { w, result: pinResult(w) };
  }

  return { GOLF, POOL, BOWL, HOLES, LAYOUTS, SIZES, FPS, TS, run, PIN, PIN_WALLS, PIN_SLINGS, pinNew, pinServe, pinLaunch, pinRun, pinFlipLine, pinSpinAt, pinResult, pinAi, pinV, pinPack, pinUnpack, pinFlipAngles };
});
