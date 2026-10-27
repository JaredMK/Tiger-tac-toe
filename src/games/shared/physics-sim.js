// Tic Tac Chaos: the physics of Mini Golf, Pool and Bowling, on Matter.js (MIT, https://brm.io/matter-js).
// One module for the page (Matter from cdnjs: makePhysics(window.Matter)) and for Node (the Cloud
// Functions and the tests: makePhysics(require('matter-js'))). A shot is an aim (radians, 0 straight up the table) and a power (0..1);
// a run is the whole thing played out in fixed steps until everything has stopped, with a recording
// of every body's place 30 times a second and the events along the way (bounces, the cup, the pockets,
// the pins), so the phones replay exactly what the server (or the shooter's phone) worked out.
// Tables are in units: 100 across; Mini Golf 160 tall, Pool 180, Bowling 240; y grows downward (the
// tee, the cue and the bowling ball are at the bottom, the cup, the rack and the pins at the top).
export function makePhysics(Matter) {
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
  const GOLF = { w: 100, h: 160, ballR: 2.4, cupR: 3.6, holeSpeed: 32, lipKick: 0.5, vMax: 95, reach: 174, maxT: 9, air: 0.004, roll: 12, kick: 18, kickKeep: 0.85, kickMax: 95 };   // full power: a full putt rolls about reach on open ground (more than the course is long); reach is for the computer's aim, not a cap. A bumper kicks a ball straight off it: kickKeep of its speed and kick more (kickMax at most)
  // Pool: a full-power shot runs the table's length 3 times and more (off the far rails twice or more); the
  // power is the meter's level and the speed goes with its square (curve), so a light tap is still light.
  // At that speed each step is cut in four (sub), so no ball passes through a rail or another ball.
  const POOL = { w: 100, h: 180, ballR: 3.9, vMax: 300, curve: 2, sub: 4, maxT: 12, air: 0.004, roll: 9,
    pockets: [[0, 0, 8.4], [100, 0, 8.4], [0, 90, 8.4], [100, 90, 8.4], [0, 180, 8.4], [100, 180, 8.4]],   // x, y, the reach of the pocket (and its size as drawn): about 2.2 times the ball across (balls half as big again as they were, pockets twice the size)
    start: { cue: [50, 140], black: [50, 52], x1: [40, 66], x2: [60, 80], o1: [60, 66], o2: [40, 80] } };
  const BOWL = { w: 100, h: 240, ballR: 3.5, pinR: 2.0, vMax: 150, maxT: 7, air: 0.002, roll: 4, pinAir: 0.004, pinRoll: 6, pinBounce: 0.9, still: 4, gutter: 7, knocked: 2.2, pit: 3,   // pit: past the end of the lane (y 0) the ball and the pins drop into the pit (drawn 6 deep) and are gone: nothing bounces back
    start: [50, 214], pins: [[50, 50], [45, 38], [55, 38], [40, 26], [50, 26], [60, 26], [35, 14], [45, 14], [55, 14], [65, 14]] };
  // Mini Golf's holes: walls as [cx, cy, w, h, angle], bumpers as [cx, cy, r], the tee and the cup, and a
  // path (the way round, for the computer's aim). Both balls start side by side on the tee. A full putt
  // crosses the whole course; the difficulty is the course: every hole has turns, walls and bumpers in the
  // way (each layout's last 2-4 bumpers were added round the way, clear of the walls and the cup: bumpers
  // kick the ball off them), and takes the computer (with its usual error) 3 to 5 putts on average. 22 layouts made by hand,
  // then the mirror image of each that is not its own (20 more); a hole's `of` is its layout. (The first six
  // keep their places: a square dealt one before plays on with it.)
  const wallTo = (x1, y1, x2, y2, t = 5) => [(x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(x2 - x1, y2 - y1), t, +Math.atan2(y2 - y1, x2 - x1).toFixed(3)];   // a wall from one point to another
  const LAYOUTS = [
    { name: 'Zigzag', tee: [50, 148], cup: [30, 18], walls: [[35, 116, 70, 6, 0], [65, 70, 70, 6, 0], [50, 36, 5, 30, 0]], bumpers: [[50, 92, 4.5], [76, 24, 4], [34, 52, 3.5], [90, 88, 4], [10, 100, 3]], path: [[84, 128], [84, 100], [16, 88], [16, 54], [30, 18]] },
    { name: 'Dogleg', tee: [18, 146], cup: [22, 20], walls: [[34, 98, 68, 6, 0], [44, 50, 48, 5, 0.42], [12, 70, 24, 5, 0]], bumpers: [[88, 84, 5], [62, 76, 4], [70, 24, 4.5], [60, 124, 4], [14, 124, 4], [90, 50, 3], [88, 136, 4.5]], path: [[50, 136], [84, 112], [80, 94], [72, 62], [60, 30], [22, 20]] },
    { name: 'The horseshoe', tee: [50, 148], cup: [50, 30], walls: [[50, 12, 60, 6, 0], [23, 35, 6, 52, 0], [77, 35, 6, 52, 0], [10, 58, 20, 6, 0], [90, 58, 20, 6, 0], [50, 102, 50, 6, 0], [50, 76, 24, 5, 0]], bumpers: [[12, 104, 5], [88, 104, 5], [36, 126, 4], [64, 126, 4], [20, 140, 3], [80, 140, 3]], path: [[50, 132], [16, 120], [14, 86], [30, 70], [50, 62], [50, 30]] },
    { name: 'The funnel', tee: [50, 148], cup: [50, 20], walls: [[19, 96, 56, 6, -0.544], [81, 96, 56, 6, 0.544], [50, 56, 34, 5, 0], [86, 34, 28, 5, -0.5]], bumpers: [[50, 126, 4], [30, 72, 3.5], [24, 14, 4.5], [74, 20, 3.5], [12, 138, 4]], path: [[38, 132], [50, 84], [24, 64], [24, 44], [50, 20]] },
    { name: 'Round the bar', tee: [50, 148], cup: [50, 22], walls: [[56, 76, 88, 6, 0], [86, 114, 28, 5, 0.6], [50, 40, 30, 5, 0], [16, 34, 22, 5, 0.6]], bumpers: [[50, 112, 5], [74, 50, 4], [26, 58, 3.5], [12, 134, 3.5], [32, 18, 4], [68, 14, 3]], path: [[30, 130], [6, 96], [6, 62], [30, 46], [50, 22]] },
    { name: 'Pinball', tee: [50, 148], cup: [50, 18], walls: [[18, 66, 30, 5, 0.5], [82, 66, 30, 5, -0.5], [36, 30, 5, 22, 0], [64, 30, 5, 22, 0], [50, 8, 34, 5, 0]], bumpers: [[30, 108, 6], [70, 108, 6], [50, 86, 6], [50, 50, 5], [16, 40, 4], [84, 40, 4], [50, 126, 3.5], [22, 140, 4], [78, 140, 4]], path: [[36, 128], [34, 88], [32, 54], [50, 42], [50, 18]] },
  
  { name: 'Switchback', tee: [40, 148], cup: [30, 18], walls: [[28, 122, 56, 5, 0], [72, 86, 56, 5, 0], [28, 50, 56, 5, 0]], bumpers: [[62, 26, 3], [90, 104, 3], [30, 76, 4.5]],
    path: [[80, 134], [80, 112], [20, 102], [20, 68], [80, 66], [80, 36], [30, 18]] },
  { name: 'Island', tee: [50, 148], cup: [50, 60], walls: [[32, 60, 5, 30, 0], [68, 60, 5, 30, 0], [50, 75, 41, 5, 0], [86, 96, 28, 5, -0.4]], bumpers: [[22, 112, 5], [64, 116, 4], [80, 30, 4], [30, 14, 4.5], [30, 140, 3.5]],
    path: [[40, 126], [18, 90], [16, 40], [30, 30], [50, 36], [50, 60]] },
  { name: 'Gates', tee: [30, 148], cup: [24, 20], walls: [[24, 122, 48, 5, 0], [92, 122, 16, 5, 0], [8, 90, 16, 5, 0], [74, 90, 52, 5, 0], [32, 58, 64, 5, 0]], bumpers: [[86, 36, 3.5], [88, 140, 3.5], [10, 140, 4], [54, 12, 3], [76, 16, 4.5]],
    path: [[64, 134], [64, 110], [32, 100], [32, 78], [80, 68], [80, 46], [24, 20]] },
  { name: 'Spiral', tee: [50, 148], cup: [60, 82], walls: [[39, 112, 78, 5, 0], [78, 79, 5, 66, 0], [67, 46, 22, 5, 0]], bumpers: [[56, 18, 3.5], [14, 26, 4], [18, 72, 3]],
    path: [[90, 128], [90, 30], [32, 32], [36, 66], [60, 82]] },
  { name: 'Hairpin', tee: [24, 148], cup: [76, 136], walls: [[50, 98, 5, 124, 0]], bumpers: [[22, 96, 5], [78, 74, 5], [50, 18, 4.5], [14, 54, 3], [88, 116, 4.5], [90, 12, 3.5]],
    path: [[26, 120], [36, 70], [24, 26], [76, 22], [70, 54], [66, 100], [76, 136]] },
  { name: 'Chicane', tee: [50, 148], cup: [78, 18], walls: [wallTo(0, 100, 50, 113), wallTo(50, 72, 100, 85), wallTo(0, 36, 50, 49)], bumpers: [[92, 142, 3.5], [64, 36, 4.5], [36, 78, 3.5]],
    path: [[80, 128], [80, 98], [20, 92], [20, 62], [80, 58], [80, 18]] },
  { name: 'Corner pocket', tee: [50, 148], cup: [88, 16], walls: [[65, 70, 70, 5, 0], wallTo(78, 37, 100, 30), [12, 104, 24, 5, 0]], bumpers: [[40, 116, 5], [60, 44, 3.5], [10, 16, 4], [74, 140, 3]],
    path: [[28, 124], [18, 84], [20, 46], [36, 22], [66, 18], [88, 16]] },
  { name: 'Bumper alley', tee: [50, 148], cup: [14, 22], walls: [[31, 91, 5, 82, 0], [69, 91, 5, 82, 0]], bumpers: [[42, 112, 5], [58, 92, 5], [42, 72, 5], [58, 58, 4], [50, 34, 5], [10, 40, 4], [84, 122, 3], [30, 12, 4.5]],
    path: [[50, 128], [58, 112], [42, 92], [58, 74], [44, 54], [32, 36], [14, 22]] },
  { name: 'The cross', tee: [50, 148], cup: [50, 34], walls: [[50, 88, 48, 5, 0], [50, 88, 5, 48, 0], wallTo(30, 30, 42, 46), wallTo(70, 30, 58, 46)], bumpers: [[82, 122, 5], [74, 12, 3], [12, 140, 4.5], [72, 56, 3.5], [32, 70, 4]],
    path: [[30, 130], [14, 92], [16, 46], [26, 16], [50, 18], [50, 34]] },
  { name: 'Ladder', tee: [50, 148], cup: [50, 20], walls: [[16, 122, 32, 5, 0], [84, 122, 32, 5, 0], [50, 98, 30, 5, 0], [16, 74, 32, 5, 0], [84, 74, 32, 5, 0], [50, 50, 30, 5, 0]], bumpers: [[74, 50, 3.5], [88, 98, 4.5], [14, 38, 3.5], [30, 140, 4]],
    path: [[50, 132], [50, 110], [74, 98], [50, 86], [50, 62], [22, 50], [50, 20]] },
  { name: 'Moat', tee: [50, 148], cup: [50, 42], walls: [[50, 102, 52, 5, 0]],
    bumpers: [135, 180, 225, 270, 315, 45].map(deg => { const a = deg * Math.PI / 180; return [+(50 + 15 * Math.cos(a)).toFixed(1), +(42 - 15 * Math.sin(a)).toFixed(1), 3.6]; }).concat([[84, 124, 4], [22, 138, 3.5], [24, 86, 4], [10, 14, 3]]),   // a ring round the cup, open at the top and on the right
    path: [[18, 120], [12, 78], [14, 26], [34, 12], [50, 14], [50, 42]] },
  { name: 'Keyhole', tee: [50, 148], cup: [50, 22], walls: [[38, 28, 5, 28, 0], [62, 28, 5, 28, 0], wallTo(20, 66, 40, 84), wallTo(80, 66, 60, 84)], bumpers: [[50, 110, 5], [16, 40, 4], [84, 40, 4], [52, 64, 4], [10, 120, 3], [70, 140, 4.5], [30, 140, 3.5]],
    path: [[30, 124], [14, 92], [24, 56], [42, 50], [50, 48], [50, 22]] },
  { name: 'The lobby', tee: [50, 148], cup: [14, 18], walls: [[20, 80, 40, 5, 0], [80, 80, 40, 5, 0], [30, 36, 5, 40, 0]], bumpers: [[50, 104, 5], [80, 120, 4], [58, 50, 3], [14, 124, 4.5], [10, 66, 3.5]],
    path: [[30, 118], [36, 98], [50, 80], [46, 62], [16, 60], [14, 18]] },
  { name: 'Diamond', tee: [50, 148], cup: [50, 28], walls: [wallTo(30, 86, 50, 66), wallTo(50, 66, 70, 86), wallTo(30, 86, 50, 106), wallTo(50, 106, 70, 86), [8, 52, 16, 5, 0], wallTo(70, 86, 100, 86)], bumpers: [[50, 44, 4], [86, 46, 4], [20, 124, 3.5], [36, 26, 3], [66, 24, 3], [12, 68, 4.5], [56, 128, 3.5], [10, 96, 4]],
    path: [[36, 124], [20, 96], [22, 60], [30, 30], [50, 28]] },
  { name: 'Double dogleg', tee: [84, 148], cup: [16, 20], walls: [wallTo(100, 112, 46, 98), wallTo(0, 70, 54, 56), [74, 32, 5, 28, 0]], bumpers: [[30, 120, 5], [32, 40, 3], [58, 12, 3.5], [90, 128, 4], [90, 88, 3]],
    path: [[60, 128], [24, 112], [20, 92], [70, 88], [86, 60], [56, 40], [16, 20]] },
  { name: 'Pinwheel', tee: [50, 148], cup: [50, 80], walls: [[40, 64, 28, 5, 0], [66, 72, 5, 24, 0], [60, 96, 28, 5, 0], [34, 88, 5, 24, 0]], bumpers: [[50, 128, 3.5], [40, 24, 4], [88, 38, 3], [86, 110, 4.5]],
    path: [[30, 128], [24, 104], [20, 70], [26, 48], [52, 50], [76, 60], [80, 86], [56, 80], [50, 80]] },
  ];
  const r2h = v => Math.round(v * 100) / 100 + 0;
  const mirror = h => ({ name: h.name + ', mirrored', tee: [r2h(100 - h.tee[0]), h.tee[1]], cup: [r2h(100 - h.cup[0]), h.cup[1]], walls: h.walls.map(([x, y, w, hh, a]) => [r2h(100 - x), y, w, hh, r2h(-(a || 0))]), bumpers: h.bumpers.map(([x, y, r]) => [r2h(100 - x), y, r]), path: h.path.map(([x, y]) => [r2h(100 - x), y]) });
  const shape = h => JSON.stringify([h.walls.map(w => w.map(r2h).join()).sort(), h.bumpers.map(b => b.map(r2h).join()).sort(), h.cup.map(r2h)]);
  const HOLES = LAYOUTS.map((h, i) => Object.assign({}, h, { of: i }));
  LAYOUTS.forEach((h, i) => { const m = mirror(h); if (shape(m) !== shape(h)) HOLES.push(Object.assign(m, { of: i })); });
  const SIZES = { golf: GOLF, pool: POOL, bowling: BOWL };
  const RUN_OPT = ['holeSpeed', 'kick', 'vMax'];

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
      hole.bumpers.forEach(([x, y, r], k) => bodies.push(Bodies.circle(x, y, r, { isStatic: true, restitution: 0.9, friction: 0, label: 'bumper:' + k })));
      for (const p of ['X', 'O']) if (!pos.holed[p]) { const b = ball(pos.balls[p][0], pos.balls[p][1], S.ballR, 'ball:' + p, { frictionAir: S.air }); bodies.push(b); tracked.push([p, b]); }
    } else if (type === 'pool') {
      bodies.push(...edges(S.w, S.h, 8));
      const rank = id => (id === 'cue' ? 0 : id === 'black' ? 3 : id[0] === 'x' ? 1 : 2);   // (the order engine.js keeps: poolIds)
      for (const id of Object.keys(pos.balls).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }))) if (!pos.down[id]) { const b = ball(pos.balls[id][0], pos.balls[id][1], S.ballR, 'ball:' + id, { frictionAir: S.air }); bodies.push(b); tracked.push([id, b]); }
    } else {
      // no back wall: the end of the lane is a pit (below), and the sides are gutters (nothing to bounce off)
      const b = ball(S.start[0], S.start[1], S.ballR, 'ball:ball', { frictionAir: S.air, density: 0.03 });
      bodies.push(b); tracked.push(['ball', b]);
      S.pins.forEach(([x, y], k) => { if (pos && pos.standing && !pos.standing[k]) return; const pin = ball(x, y, S.pinR, 'pin:' + k, { frictionAir: S.pinAir, density: 0.02, restitution: S.pinBounce, friction: 0.05 }); bodies.push(pin); tracked.push(['p' + k, pin]); });   // (standing: a second roll at what the first left)
    }
    Composite.add(engine.world, bodies);
    return { engine, tracked, S };
  }

  // A shot, played out: the shooter's ball is sent off at its aim and power; everything runs until it
  // all stops (or the time is up). Returns the final places, what happened, and the recording.
  // (Super Chaos's Mini Golf: shooter is { X: shot, O: shot } and both balls are struck at once.)
  // opt: a square's own settings over the table's (RUN_OPT: Mini Golf's holeSpeed and kick, the others' vMax).
  function run(type, pos, shooter, shot, opt) {
    const { engine, tracked } = build(type, pos), S = opt ? Object.assign({}, SIZES[type]) : SIZES[type];
    if (opt) for (const k of RUN_OPT) if (Number.isFinite(opt[k])) S[k] = opt[k];
    const byId = Object.fromEntries(tracked);
    const shots = shooter && typeof shooter === 'object' ? shooter : { [type === 'golf' ? shooter : type === 'pool' ? 'cue' : 'ball']: shot };
    const movers = Object.keys(shots).filter(id => byId[id] && shots[id]);
    if (!movers.length) return null;
    for (const id of movers) {
      const power = Math.max(0, Math.min(1, Number(shots[id].power) || 0)), aim = Number(shots[id].aim) || 0, v0 = Math.pow(power, S.curve || 1) * S.vMax;
      Body.setVelocity(byId[id], { x: Math.sin(aim) * v0 / 60, y: -Math.cos(aim) * v0 / 60 });   // (Matter's velocity is per step at 60 Hz, whatever the step's length)
    }
    const events = [], gone = {}, flags = {}, kicks = [];
    let t = 0, hitPin = false;
    const ev = (k, extra) => { if (events.length < 60) events.push(Object.assign({ t: r2(t / TS), k }, extra || {})); };   // (the time as it plays: see TS)
    Events.on(engine, 'collisionStart', e => {
      for (const pair of e.pairs) {
        const a = pair.bodyA.label, b = pair.bodyB.label, v = Math.max(speed(pair.bodyA), speed(pair.bodyB)) * 60;
        if (type === 'golf' && (a.startsWith('bumper:') || b.startsWith('bumper:'))) {   // a bumper: it kicks the ball straight off it, faster than it came (a flash and a pop on screen)
          const bump = a.startsWith('bumper:') ? pair.bodyA : pair.bodyB, bl = bump === pair.bodyA ? pair.bodyB : pair.bodyA;
          if (!bl.label.startsWith('ball:')) continue;
          kicks.push({ bl, bump });                                  // (the kick itself once the step is solved: set now, the collision's own response would take most of it back)
          ev('bump', { b: Number(bump.label.slice(7)), id: bl.label.slice(5) });
          continue;
        }
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
      const was = type === 'golf' ? new Map(tracked.map(([, b]) => [b, speed(b) * 60])) : null;   // (each ball's speed as it came: a kick goes by that)
      Engine.update(engine, dt); t = (step + (q + 1) / sub) * STEP / 1000;
      for (const { bl, bump } of kicks.splice(0)) {                  // Mini Golf's bumpers: straight off, kickKeep of the speed it came at and kick more
        const n = { x: bl.position.x - bump.position.x, y: bl.position.y - bump.position.y }, d = Math.hypot(n.x, n.y) || 1, out = Math.min(S.kickMax, (was.get(bl) || 0) * S.kickKeep + S.kick) / 60;
        Body.setVelocity(bl, { x: (n.x / d) * out, y: (n.y / d) * out });
      }
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
          const pit = b.position.y < S.pit, off = b.position.y > S.h + 6 || b.position.x < -6 || b.position.x > S.w + 6;
          if (id === 'ball') { if (pit || off || b.position.x < S.gutter || b.position.x > S.w - S.gutter) remove(id, pit ? 'end' : 'gutter'); }
          else if (pit) remove(id, 'pit');                         // a pin past the end of the lane: into the pit, gone (down)
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
      const was = pos && pos.standing ? pos.standing : null;        // (pins down before this roll stay down and count for nothing)
      const down = BOWL.pins.map(([x, y], k) => (was && !was[k]) || gone['p' + k] || Math.hypot(final['p' + k][0] - x, final['p' + k][1] - y) > S.knocked);
      result = { down, knocked: down.filter((d, k) => d && !(was && !was[k])).length, gutter: !hitPin && events.some(e => e.k === 'gutter') };   // a gutter ball: one that never reached the pins
    }
    ev('stop');
    return { final, events, rec: { fps: FPS * TS, ids, frames }, result, ms: Math.round(frames.length / (FPS * TS) * 1000) };
  }

  // ---------- Pinball: a portrait table, played live on the phone (or by the computer's hand) ----------
  // Units as the other tables: 100 across, 180 tall, y down. The walls, the bumpers, the slingshots and
  // the targets are Matter bodies; the two flippers are swept capsules worked out here each step (a
  // flipper's surface speed goes into the bounce, and at these step lengths nothing moves more than a
  // third of the ball's width in a step: the ball at its fastest 0.9 units, a flipper's tip 1.1, so the
  // ball never passes through a flipper or a wall). The lower table is the same on every table: the two
  // flippers low down with a gap between their tips a ball can drain through, an inlane and an outlane
  // above each (the guide feeds the inlane's ball onto the flipper; the outlane drains beside it), a
  // slingshot above each inlane. The upper playfield is one of PIN_LAYOUTS (bumpers, rails, lanes, each
  // with its spots), and a square's seven targets are seven of its layout's spots (mini.table: { k, t };
  // pinTable builds the table from them, the same on the server and on both phones). The ball starts in
  // the plunger lane on the right; a launch sends it up the lane and round the arch, and a one-way gate
  // closes the lane's top behind it (pinGate). The targets are the same for both players; each player
  // lights their own. A ball that drains in the first save seconds after its launch is served again.
  const PIN = {
    w: 100, h: 180, ballR: 2.6, g: 300, hz: 480, fps: 30, vmax: 420, drain: 177, wall: 0.5,
    flip: { len: 21, thick: 3.8, rest: 0.48, up: -0.48, speed: 26, e: 0.4, L: [21.5, 165], R: [68.5, 165] },   // the pivots low on the table: the tips at rest reach y 174.7, 9.8 apart (7.3 clear: 1.4 balls)
    lane: { x0: 89.7, x1: 98, top: 44, serve: [93.85, 168], gate: [88.5, 44, 99, 36, 2.4] },   // the plunger lane beside the playfield, and the gate across its top (from the lane wall's top up to the outside)
    bump: { r: 5, kick: 165 },
    sling: { kick: 150 },
    spin: { r: 10, w: 1.7 },      // a spinner spot: its target goes round a ring this big at this speed (radians a second, times the spin setting)
    targets: null,                // the classic seven (layout 0's first seven spots): a square from before the layouts plays on them; filled in below
  };
  // A polyline as thick wall segments [x1, y1, x2, y2, thickness], joined end to end.
  const pinPoly = (t, ...pts) => pts.slice(1).map((p, i) => [pts[i][0], pts[i][1], p[0], p[1], t]);
  // The outside: the left side, the arch, the right side (split where the gate meets it, so the gate joins
  // it end to end) and the bottom (below the drain line: the ball is gone before it gets there).
  const PIN_OUTER = [[1, 181.2], [1, 34], [7, 15], [20, 5], [50, 1.5], [80, 5], [93, 11], [99, 25], [99, 36], [99, 181.2], [1, 181.2]];
  // The lower table, on every layout: the outside, the plunger lane's wall, the inlane guides and the
  // slingshots. A guide's outer side is the outlane (7 units wide: a ball falls straight down it to the
  // drain beside the flipper), its inner side the inlane (6 wide, between the guide and the slingshot's
  // outer edge); at the bottom the guide bends in to the flipper's pivot, its end buried in the pivot's
  // disc, so the inlane's ball rolls off the guide onto the flipper and nothing can slip behind the
  // flipper or rest at its base. The slingshots are a triangle each above the inlane; the long face kicks.
  // Nothing here makes a pocket a ball can rest in (pinLayoutCheck's pocket rule), and nothing on a
  // layout may come within a unit of any of it (its rule on clearance), so the lower table plays the
  // same whatever is above it.
  const PIN_LOWER = {
    walls: [
      ...pinPoly(2.4, ...PIN_OUTER),
      [88.5, 181.2, 88.5, PIN.lane.top, 2.4],
      ...pinPoly(2.4, [10.5, 122], [10.5, 150], [20.5, 162.5]), ...pinPoly(2.4, [79.5, 122], [79.5, 150], [69.5, 162.5]),
    ],
    slings: [[[18, 124], [18, 146], [26, 154]], [[72, 124], [72, 146], [64, 154]]],
  };
  // The upper playfields. Each: its walls (rails and lanes, all above y 120), its pop bumpers, and its
  // spots: a spot is a place a target can be dealt at ({ x, y, r, name }, r the target's size before the
  // admin's size setting, up to twice; a spinner spot { spin: [cx, cy] } moves round a ring). A square's
  // seven targets are seven of them. Every spot keeps at least a unit from everything else at any size,
  // leaves room for the ball to reach it, and makes no pocket with anything (a gap narrower than a ball
  // that could hold one: so a spot is never nearer a wall, a slingshot or another spot than a ball's
  // width and a half beyond its own edge); pinLayoutCheck holds every layout to that in the tests. The
  // computer's hand lights every spot in the simulations (tests/sim/pinball.sim.js: pinReach), so any
  // seven can be dealt. (The side posts are 12.5 and 77 across: a ball passes between them and the walls.)
  const PIN_LAYOUTS = [
    { name: 'Classic',                                                   // the first table: three bumpers, the left lane, a rail with a target behind it, the left loop, the spinner
      walls: [[12, 34, 12, 44, 2.4], [21, 34, 21, 44, 2.4], [59, 72, 77, 56, 2.4], ...pinPoly(2.4, [12, 62], [12, 84], [22, 92])],
      bumpers: [[30, 54], [60, 54], [45, 68]],
      spots: [{ x: 12.5, y: 100, r: 2.2, name: 'Left post' }, { x: 77, y: 100, r: 2.2, name: 'Right post' }, { x: 45, y: 32, r: 2.4, name: 'Top centre' }, { x: 20, y: 22, r: 2.2, name: 'Left lane' }, { x: 74, y: 44, r: 2.2, name: 'Behind the rail' }, { spin: [45, 108], r: 2.4, name: 'Spinner' }, { x: 24, y: 74, r: 2.2, name: 'Left loop' },
        { x: 74, y: 22, r: 2.2, name: 'Upper right' }, { x: 45, y: 82, r: 2.4, name: 'Below the bumpers' }, { x: 60, y: 15, r: 2.2, name: 'Top right' }, { x: 34, y: 15, r: 2.2, name: 'Top left' }] },
    { name: 'Bumper nest',                                               // four bumpers in a diamond, three lanes under the arch
      walls: [[25.5, 24, 25.5, 34, 2.4], [38.5, 24, 38.5, 34, 2.4], [51.5, 24, 51.5, 34, 2.4], [64.5, 24, 64.5, 34, 2.4]],
      bumpers: [[31, 52], [59, 52], [45, 70], [45, 40]],
      spots: [{ x: 32, y: 14, r: 1.6, name: 'Left lane' }, { x: 45, y: 12.5, r: 1.6, name: 'Middle lane' }, { x: 58, y: 13, r: 1.6, name: 'Right lane' }, { x: 45, y: 52, r: 2.2, name: 'Nest centre' }, { x: 12.5, y: 50, r: 2.2, name: 'Left orbit' }, { x: 77, y: 50, r: 2.2, name: 'Right orbit' },
        { x: 45, y: 90, r: 2.4, name: 'Below the nest' }, { x: 14, y: 30, r: 2.2, name: 'Upper left' }, { x: 76, y: 30, r: 2.2, name: 'Upper right' }, { x: 12.5, y: 100, r: 2.2, name: 'Left post' }, { x: 77, y: 100, r: 2.2, name: 'Right post' }, { x: 18, y: 72, r: 2.2, name: 'Left of the nest' }, { x: 72, y: 72, r: 2.2, name: 'Right of the nest' }] },
    { name: 'Twin ramps',                                                // two rails sloping in from the sides to a gap in the middle, a bumper at the top
      walls: [[2, 42, 36, 66, 2.4], [87.6, 50, 54, 66, 2.4]],
      bumpers: [[45, 30]],
      spots: [{ x: 14, y: 66, r: 2.2, name: 'Under the left ramp' }, { x: 75, y: 69, r: 2.2, name: 'Under the right ramp' }, { x: 13, y: 34, r: 2.2, name: 'Left ramp top' }, { x: 76, y: 38, r: 2.2, name: 'Right ramp top' }, { x: 45, y: 80, r: 2.4, name: 'The gap' }, { x: 25, y: 16, r: 2.2, name: 'Top left' },
        { x: 65, y: 16, r: 2.2, name: 'Top right' }, { x: 12.5, y: 100, r: 2.2, name: 'Left post' }, { x: 77, y: 100, r: 2.2, name: 'Right post' }, { x: 45, y: 102, r: 2.4, name: 'Centre line' }, { x: 12.5, y: 84, r: 2.2, name: 'Left side' }, { x: 77, y: 84, r: 2.2, name: 'Right side' }] },
    { name: 'The loop',                                                  // an arch over the upper left, open below (a bumper under it), the spinner below that
      walls: pinPoly(2.4, [14, 64], [14, 46], [20, 32], [32, 23], [46, 21], [60, 25], [70, 35]),
      bumpers: [[36, 50]],
      spots: [{ x: 45, y: 9, r: 2, name: 'Orbit top' }, { x: 12.5, y: 100, r: 2.2, name: 'Orbit exit' }, { x: 45, y: 62, r: 2.2, name: 'Under the arch' }, { x: 77, y: 52, r: 2.2, name: 'Right of the loop' }, { x: 24, y: 76, r: 2.2, name: 'Loop mouth' }, { x: 62, y: 74, r: 2.2, name: 'Under the loop' },
        { x: 77, y: 22, r: 2.2, name: 'Top right' }, { x: 77, y: 100, r: 2.2, name: 'Right post' }, { spin: [45, 100], r: 2.4, name: 'Spinner' }, { x: 77, y: 78, r: 2.2, name: 'Lower right' }, { x: 60, y: 46, r: 2.2, name: 'Inside the loop' }] },
    { name: 'The bank',                                                  // a roof across the middle with a bank of three spots under it, two bumpers low at the sides
      walls: pinPoly(2.4, [20, 50], [45, 46], [70, 50]),
      bumpers: [[20, 84], [70, 84]],
      spots: [{ x: 30, y: 60, r: 2.2, name: 'Bank left' }, { x: 45, y: 58, r: 2.2, name: 'Bank middle' }, { x: 60, y: 60, r: 2.2, name: 'Bank right' }, { x: 45, y: 30, r: 2.4, name: 'Over the bank' }, { x: 12.5, y: 36, r: 2.2, name: 'Left side' }, { x: 77, y: 36, r: 2.2, name: 'Right side' },
        { x: 45, y: 86, r: 2.4, name: 'Between the bumpers' }, { x: 12.5, y: 100, r: 2.2, name: 'Left post' }, { x: 77, y: 100, r: 2.2, name: 'Right post' }, { x: 24, y: 18, r: 2.2, name: 'Top left' }, { x: 66, y: 18, r: 2.2, name: 'Top right' }] },
    { name: 'The alley',                                                 // two rails making a central alley, a bumper either side, the spinner at its foot
      walls: [[33, 30, 33, 60, 2.4], [57, 30, 57, 60, 2.4]],
      bumpers: [[18, 50], [72, 50]],
      spots: [{ x: 45, y: 22, r: 2.2, name: 'Alley top' }, { x: 45, y: 45, r: 2.2, name: 'In the alley' }, { x: 13, y: 36, r: 2.2, name: 'Left orbit' }, { x: 77, y: 36, r: 2.2, name: 'Right orbit' }, { x: 12.5, y: 72, r: 2.2, name: 'Left side' }, { x: 77, y: 72, r: 2.2, name: 'Right side' },
        { spin: [45, 92], r: 2.4, name: 'Spinner' }, { x: 12.5, y: 100, r: 2.2, name: 'Left post' }, { x: 77, y: 100, r: 2.2, name: 'Right post' }, { x: 45, y: 66, r: 2.2, name: 'Alley foot' }, { x: 24, y: 18, r: 2.2, name: 'Top left' }, { x: 66, y: 18, r: 2.2, name: 'Top right' }] },
    { name: 'Islands',                                                   // three short rails scattered about, a bumper between them and one low at each side
      walls: [[20, 38, 32, 48, 2.4], [70, 38, 58, 48, 2.4], [38, 76, 52, 72, 2.4]],
      bumpers: [[45, 52], [22, 70], [68, 70]],
      spots: [{ x: 22, y: 26, r: 2.2, name: 'Over the left island' }, { x: 68, y: 26, r: 2.2, name: 'Over the right island' }, { x: 26, y: 60, r: 2.2, name: 'Under the left island' }, { x: 64, y: 60, r: 2.2, name: 'Under the right island' }, { x: 45, y: 90, r: 2.4, name: 'Under the low island' }, { x: 45, y: 30, r: 2.4, name: 'Top centre' },
        { x: 12.5, y: 50, r: 2.2, name: 'Left side' }, { x: 77, y: 50, r: 2.2, name: 'Right side' }, { x: 12.5, y: 100, r: 2.2, name: 'Left post' }, { x: 77, y: 100, r: 2.2, name: 'Right post' }, { x: 12.5, y: 84, r: 2.2, name: 'Lower left' }, { x: 77, y: 84, r: 2.2, name: 'Lower right' }] },
  ];
  const PIN_CLASSIC = [0, 1, 2, 3, 4, 5, 6];   // the classic seven: layout 0's first spots, for a square dealt before the layouts (no mini.table)
  // A target from a spot: its id (its place in the square's seven), its size at the admin's size setting,
  // and for a spinner its ring.
  const pinSpot = (s, id, size) => (s.spin ? { id, x: s.spin[0], y: s.spin[1], r: s.r * size, name: s.name, spin: { cx: s.spin[0], cy: s.spin[1], r: PIN.spin.r, w: PIN.spin.w } } : { id, x: s.x, y: s.y, r: s.r * size, name: s.name, spin: null });
  PIN.targets = PIN_CLASSIC.map((i, id) => pinSpot(PIN_LAYOUTS[0].spots[i], id, 1));
  // The table of a square: its layout's walls after the lower table's, its bumpers, the slingshots, its
  // targets (the square's spots, ids 0..6, at the size the square's settings give), the lane and the
  // flippers. A square without a table (from before the layouts) plays the classic seven on layout 0. The
  // same description builds the Matter world (pinNew), the drawing, the check and the layout check.
  function pinTable(mini) {
    const cfg = (mini && mini.cfg) || {}, size = cfg.size || 1;
    const tb = mini && mini.table && PIN_LAYOUTS[mini.table.k] && Array.isArray(mini.table.t) ? mini.table : { k: 0, t: PIN_CLASSIC };
    const lay = PIN_LAYOUTS[tb.k], spots = tb.t.map(i => lay.spots[i]).filter(Boolean), walls = PIN_LOWER.walls.concat(lay.walls), joints = [], seen = new Set();
    walls.forEach((w, i) => { for (const [x, y] of [[w[0], w[1]], [w[2], w[3]]]) { const key = x + ',' + y + ',' + w[4]; if (seen.has(key)) continue; seen.add(key); joints.push([x, y, w[4] / 2, i < PIN_LOWER.walls.length]); } });   // every wall is a capsule: its rectangle exactly its length, a disc of half its thickness at each end (so a bend is round, flush with both faces, and no ball rests on a corner or a bump at it)
    return { k: tb.k, name: lay.name, cfg, size, outer: PIN_OUTER, walls, joints, lower: PIN_LOWER.walls.length, lane: PIN.lane, gate: PIN.lane.gate, flip: PIN.flip, bumpers: lay.bumpers.map(([x, y]) => [x, y, PIN.bump.r]), slings: PIN_LOWER.slings, targets: spots.map((s, id) => pinSpot(s, id, size)) };
  }
  // A layout with every one of its spots as a target (for the checks and the simulations).
  const pinAllSpots = (k, cfg) => pinTable({ cfg, table: { k, t: PIN_LAYOUTS[k].spots.map((_, i) => i) } });
  // A wall's bodies: the rectangle along the segment (exactly its length) and a disc at each end: a capsule.
  function pinSeg(x1, y1, x2, y2, t, label) {
    const len = Math.hypot(x2 - x1, y2 - y1), o = { isStatic: true, restitution: PIN.wall, friction: 0, label: label || 'wall' };
    return [Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len, t, Object.assign({ angle: Math.atan2(y2 - y1, x2 - x1) }, o)), Bodies.circle(x1, y1, t / 2, o), Bodies.circle(x2, y2, t / 2, o)];
  }
  // A table for one ball: its targets as they stand for the player (lit: an array of 0/1), the ball in the lane.
  function pinNew(table, cfg, lit) {
    cfg = cfg || table.cfg || {};
    const engine = Engine.create({ gravity: { x: 0, y: 0 }, positionIterations: 6, velocityIterations: 6 }), bodies = [];
    for (const w of table.walls) bodies.push(...pinSeg(...w));
    for (const [x, y, r] of table.bumpers) bodies.push(Bodies.circle(x, y, r, { isStatic: true, restitution: 0.6, friction: 0, label: 'bumper' }));
    table.slings.forEach((tri, k) => bodies.push(Bodies.fromVertices((tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3, [tri.map(([x, y]) => ({ x, y }))], { isStatic: true, restitution: 0.6, friction: 0, label: 'sling:' + k })));
    for (const t of table.targets) if (!t.spin) bodies.push(Bodies.circle(t.x, t.y, t.r, { isStatic: true, restitution: 0.55, friction: 0, label: 'target:' + t.id }));
    const ball = Bodies.circle(table.lane.serve[0], table.lane.serve[1], PIN.ballR, { restitution: 0.4, friction: 0, frictionAir: 0, frictionStatic: 0, density: 0.02, label: 'ball' });
    bodies.push(ball);
    Composite.add(engine.world, bodies);
    const gate = pinSeg(table.gate[0], table.gate[1], table.gate[2], table.gate[3], table.gate[4], 'gate');   // (in the world only once the ball has left the lane: pinGate; its bodies, a capsule)
    const w = { table, cfg, engine, ball, gate, gateOn: false, t: 0, acc: 0, inPlay: false, launchedAt: null, lit: (lit || []).slice(), hits: [], events: [], frames: [], flip: { L: { a: PIN.flip.rest, w: 0, on: false }, R: { a: PIN.flip.rest, w: 0, on: false } }, over: false, saves: 0, n: 0, frameAt: 0, still: { x: 0, y: 0, t: 0 }, nudges: 0, log: [], logBits: 0 };   // log: the inputs at their steps (the flippers' state as it changes, each launch and its power): the ball played through again from them is the same ball (pinReplay)
    Events.on(engine, 'collisionStart', e => { for (const pr of e.pairs) pinTouch(w, pr.bodyA === ball ? pr.bodyB : pr.bodyB === ball ? pr.bodyA : null); });
    pinFrame(w);
    return w;
  }
  const pinV = w => ({ x: w.ball.velocity.x * 60, y: w.ball.velocity.y * 60 });          // the ball's speed, units a second
  const pinSetV = (w, vx, vy) => { const s = Math.hypot(vx, vy), k = s > PIN.vmax ? PIN.vmax / s : 1; Body.setVelocity(w.ball, { x: (vx * k) / 60, y: (vy * k) / 60 }); };
  const pinEv = (w, k, extra) => { if (w.events.length < 400) w.events.push(Object.assign({ t: Math.round(w.t * 1000) / 1000, k }, extra || {})); };
  // A spinner target's place, t seconds in (it goes round its ring).
  const pinSpinAt = (tg, t, cfg) => { const s = tg.spin, a = t * s.w * ((cfg && cfg.spin) != null ? cfg.spin : 1); return [s.cx + s.r * Math.cos(a), s.cy + s.r * Math.sin(a)]; };
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
    } else if (L.startsWith('sling:')) {                             // a slingshot: its long face kicks the ball across and up (a touch on its outer side, from the inlane, is a plain bounce)
      const k = Number(L.slice(6)), dir = k === 0 ? 1 : -1, v = pinV(w);
      if ((dir > 0 && b.x > body.position.x) || (dir < 0 && b.x < body.position.x)) { pinSetV(w, dir * PIN.sling.kick * 0.8 + v.x * 0.2, -PIN.sling.kick * 0.6); pinEv(w, 'sling'); }
    }
  }
  // The ball back in the plunger lane, waiting for a launch (the gate open again).
  function pinServe(w) {
    Body.setPosition(w.ball, { x: w.table.lane.serve[0], y: w.table.lane.serve[1] }); Body.setVelocity(w.ball, { x: 0, y: 0 }); w.inPlay = false; w.launchedAt = null;
    if (w.gateOn) { for (const b of w.gate) Composite.remove(w.engine.world, b); w.gateOn = false; }
  }
  // A launch: power 0..1 (a tap: the default).
  function pinLaunch(w, power) {
    if (w.inPlay || w.over) return false;
    const p = Math.round((power == null ? 0.82 : Math.max(0, Math.min(1, power))) * 100) / 100, lo = 240, hi = 400;   // (the power to a hundredth: as the log keeps it, so a replay launches just the same)
    w.inPlay = true; w.launchedAt = w.t; pinSetV(w, 0, -(lo + (hi - lo) * p)); pinEv(w, 'launch', { p });
    if (w.log.length < 20000) w.log.push([w.n, 4 + Math.round(p * 100)]);
    return true;
  }
  // The one-way gate across the lane's top: it goes into the world the moment the ball is clear of it on
  // the playfield side (the ball leaves the lane upwards through where it will be, so a ball that has left
  // the lane is above it within a few steps, and is clear of it by half a unit when it appears: nothing
  // overlaps). From then on the lane is closed: a ball falling on the gate slides off it, down its slope
  // into the playfield. A launch too weak to leave the lane falls back with the gate still open, and
  // the ball is served again (pinStep's lane check).
  function pinGate(w) {
    if (w.gateOn) return;
    const [x1, y1, x2, y2, t] = w.table.gate, b = w.ball.position, len = Math.hypot(x2 - x1, y2 - y1);
    const nx = (y2 - y1) / len, ny = -(x2 - x1) / len;              // the gate's normal towards the playfield (up and to the left)
    if ((b.x - x1) * nx + (b.y - y1) * ny > PIN.ballR + t / 2 + 0.5) { Composite.add(w.engine.world, w.gate); w.gateOn = true; pinEv(w, 'gate'); }
  }
  // A flipper's line (pivot to tip) at its angle.
  function pinFlipLine(table, side, a) { const F = (table && table.flip) || PIN.flip, [px, py] = F[side], s = side === 'L' ? 1 : -1; return [px, py, px + s * F.len * Math.cos(a), py + F.len * Math.sin(a)]; }
  // The flippers' sweep and the ball against them: a capsule each, its surface moving with the flipper.
  function pinFlippers(w, dt) {
    const F = w.table.flip || PIN.flip, ball = w.ball;
    for (const side of ['L', 'R']) { const f = w.flip[side], to = f.on ? F.up : F.rest, max = F.speed * dt, da = Math.max(-max, Math.min(max, to - f.a)); f.a += da; f.w = da / dt; }
    for (let pass = 0; pass < 2; pass++) for (const side of ['L', 'R']) {   // (twice: a ball squeezed between the two tips, both flipping, is pushed clear of both, up out of the pinch)
      const f = w.flip[side];
      const [x1, y1, x2, y2] = pinFlipLine(w.table, side, f.a), bx = ball.position.x, by = ball.position.y;
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
  // A frame's worth of time (ms) with the flippers held as given; returns the events of it. Only whole
  // steps are taken: what is left over is kept for the next frame (never a short step, never a step
  // dropped), so the ball's motion is the same however the frames fall and it never stutters.
  function pinRun(w, ms, input) {
    if (w.over) return [];
    const from = w.events.length, dt = 1 / PIN.hz;
    if (input) { w.flip.L.on = !!input.L; w.flip.R.on = !!input.R; }
    const bits = (w.flip.L.on ? 1 : 0) + (w.flip.R.on ? 2 : 0);
    if (bits !== w.logBits && w.log.length < 20000) { w.log.push([w.n, bits]); w.logBits = bits; }
    w.acc += Math.min(100, Math.max(0, Number(ms) || 0)) / 1000;
    while (w.acc >= dt - 1e-12 && !w.over) { w.acc -= dt; pinStep(w, dt); }
    return w.events.slice(from);
  }
  // One step of h seconds.
  function pinStep(w, h) {
    const T = w.table, g = PIN.g * ((w.cfg && w.cfg.g) || 1);
    if (w.inPlay) { const v = pinV(w); pinSetV(w, v.x, v.y + g * h); }
    Engine.update(w.engine, h * 1000);
    pinFlippers(w, h);
    w.t += h; w.n++;
    const b = w.ball.position;
    if (!w.inPlay) { Body.setPosition(w.ball, { x: T.lane.serve[0], y: T.lane.serve[1] }); Body.setVelocity(w.ball, { x: 0, y: 0 }); }
    else {
      if (b.x < PIN.ballR || b.x > PIN.w - PIN.ballR || b.y < PIN.ballR) {   // (never past the outside, whatever happened)
        const v = pinV(w); Body.setPosition(w.ball, { x: Math.max(PIN.ballR + 2, Math.min(PIN.w - PIN.ballR - 2, b.x)), y: Math.max(PIN.ballR + 2, b.y) }); pinSetV(w, b.x < PIN.ballR || b.x > PIN.w - PIN.ballR ? -v.x * 0.5 : v.x, b.y < PIN.ballR ? Math.abs(v.y) * 0.5 : v.y); pinEv(w, 'guard');
      }
      pinGate(w);
      for (const t of T.targets) {                                   // (and by distance: a touch is never missed; never through a wall, as every spot keeps clear of the walls at any size the settings allow)
        if (w.lit[t.id]) continue;
        const [x, y] = t.spin ? pinSpinAt(t, w.t, w.cfg) : [t.x, t.y];
        if (Math.hypot(b.x - x, b.y - y) < t.r + PIN.ballR) pinLight(w, t.id);
      }
      const since = w.t - w.launchedAt, v = pinV(w);
      const back = b.x > T.lane.x0 + 0.6 && b.y > T.lane.top + 4 && (since > 1.5 || (since > 0.6 && v.y > 0));   // still (or again) in the lane: a launch that fell back, or a ball through the gate somehow
      if (b.y > PIN.drain || back) {
        const saved = back || since < ((w.cfg && w.cfg.save) != null ? w.cfg.save : 3);
        if (saved) { pinEv(w, back ? 'lane' : 'save'); w.saves++; pinServe(w); }
        else { pinEv(w, 'drain', { x: Math.round(b.x * 10) / 10 }); w.over = true; }
      }
      if (w.lit.length && w.lit.every(Boolean)) { w.over = true; pinEv(w, 'all'); }
      if (Math.hypot(b.x - w.still.x, b.y - w.still.y) > 1.5) w.still = { x: b.x, y: b.y, t: w.t };
      else if (w.inPlay && w.t - w.still.t > 2 && b.y < T.flip.L[1] - 6) { const s = w.nudges++ % 2 ? 1 : -1; pinSetV(w, s * 90, -130); w.still.t = w.t; pinEv(w, 'nudge', { at: Math.round(b.x) + ',' + Math.round(b.y) }); }   // a ball resting off the flippers: a nudge sets it going again
      if (w.inPlay && since > ((w.cfg && w.cfg.maxBall) || 120)) { pinEv(w, 'time'); w.over = true; }   // (a ball can't last for ever)
    }
    if (w.t >= w.frames.length / PIN.fps - 1e-9) pinFrame(w);   // (frame k at k/30 s exactly, so the recording keeps time with the ball however the steps fall)
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
  const pinResult = w => ({ hits: w.hits.map(h => [h.id, h.t]), ms: Math.round(w.t * 1000), rec: pinPack(w.frames), events: w.events.filter(e => e.k !== 'guard' && e.k !== 'gate').slice(0, 300), saves: w.saves, end: w.over ? (w.lit.every(Boolean) ? 'all' : w.events.some(e => e.k === 'time') ? 'time' : 'drain') : 'out' });
  // The input log as a string (step gaps and values in base 36: 0-3 the flippers held, 4 + power in hundredths a
  // launch), and back; a ball played through again from one, step for step, on a fresh table (security review F3:
  // the server takes its own ball's result, never the phone's). The steps are fixed (pinRun: whole steps of 1/hz,
  // however the frames fall) and the inputs apply at their step, so the same inputs make the same ball anywhere.
  const pinLogPack = log => { let s = 0; return log.map(([k, v]) => { const d = k - s; s = k; return d.toString(36) + ':' + v.toString(36); }).join(','); };
  function pinLogUnpack(str, maxSteps) {
    if (typeof str !== 'string' || str.length > 200000) return null;
    if (!str) return [];
    const out = [];
    let s = 0;
    for (const part of str.split(',')) {
      const m = /^([0-9a-z]{1,7}):([0-9a-z]{1,3})$/.exec(part);
      if (!m) return null;
      s += parseInt(m[1], 36); const v = parseInt(m[2], 36);
      if (s > maxSteps || v > 104 || (out.length && s < out[out.length - 1][0])) return null;
      out.push([s, v]);
    }
    return out;
  }
  function pinReplay(table, cfg, lit, log, steps) {
    const w = pinNew(table, cfg, lit), dt = 1 / PIN.hz;
    let j = 0;
    while (w.n < steps && !w.over) {
      while (j < log.length && log[j][0] <= w.n) { const v = log[j++][1]; if (v >= 4) pinLaunch(w, (v - 4) / 100); else { w.flip.L.on = !!(v & 1); w.flip.R.on = !!(v & 2); w.logBits = v; } }
      pinStep(w, dt);
    }
    return w;
  }
  // The computer's hand: it sees the ball react seconds late; when the ball comes down over a flipper it
  // flips (a little early or late: jitter) and holds for a moment. A launch: a tap at a random power.
  function pinAi(table, cfg, lit, rng, hand) {
    hand = Object.assign({ react: [0.05, 0.09], jitter: 0.05, hold: [0.12, 0.28], launch: [0.4, 1] }, hand);   // (a square's settings over these: finger.js fingHand)
    const w = pinNew(table, cfg, lit), seen = [], react = hand.react[0] + (hand.react[1] - hand.react[0]) * rng(), plan = { L: null, R: null };
    const F = table.flip || PIN.flip, frame = 1000 / 60;
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
    return { w, result: pinResult(w), log: pinLogPack(w.log), steps: w.n };
  }
  // Reachability: the computer's hand plays balls on the table (every target unlit for each) and the
  // count of hits per target comes back, with the ball each was first hit on and how the balls ended.
  // The simulations run it on every layout with all its spots (every spot must be hit) and on dealt squares.
  function pinReach(table, rng, balls, hand) {
    const n = table.targets.length, hits = new Array(n).fill(0), first = new Array(n).fill(null), ends = {}, zeros = new Array(n).fill(0), drains = [];
    let ms = 0;
    for (let b = 0; b < (balls || 20); b++) {
      const r = pinAi(table, table.cfg, zeros, rng, hand).result, d = r.events.find(e => e.k === 'drain');
      for (const [id] of r.hits) { hits[id]++; if (first[id] == null) first[id] = b; }
      ends[r.end] = (ends[r.end] || 0) + 1; ms += r.ms; if (d) drains.push(d.x);
    }
    return { hits, first, balls: balls || 20, ends, ms, drains };   // (drains: where each drained ball went down, its x)
  }

  // ---- the layout check: pure geometry, for the tests (pinLayoutCheck) ----
  // Every element of a table as a shape: the walls as the rectangles Matter makes of them (the segment
  // plus half the thickness past each end), the bumpers and the targets as circles (a spinner's target
  // at places round its ring), the slingshots as triangles, each flipper's sweep as capsules at angles
  // from rest to up, the lane as the rectangle the ball is served in. Returns the problems found, as
  // words: two elements closer than the clearance (1 unit), unless they are walls joined end to end or
  // at a T (or the lane and the lower table's walls, which bound it); an element outside the table; a
  // target without room for the ball to reach it (the ball touching the target, and half a unit further
  // out, clear of everything else, in some direction). An empty list: the table is sound.
  const PIN_CLEAR = 1.0;
  const segDist2 = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy, u = l2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2)) : 0; return Math.hypot(px - x1 - u * dx, py - y1 - u * dy); };
  const segCross = (a, b, c, d) => {   // do the segments a-b and c-d cross?
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b) && o(a, b, c) !== 0 && o(c, d, a) !== 0;
  };
  const segSeg = (a, b) => (segCross([a[0], a[1]], [a[2], a[3]], [b[0], b[1]], [b[2], b[3]]) ? 0 : Math.min(segDist2(a[0], a[1], ...b), segDist2(a[2], a[3], ...b), segDist2(b[0], b[1], ...a), segDist2(b[2], b[3], ...a)));
  const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const polyEdges = poly => poly.map((p, i) => [p[0], p[1], poly[(i + 1) % poly.length][0], poly[(i + 1) % poly.length][1]]);
  const ptPoly = (p, poly) => (inPoly(p, poly) ? 0 : Math.min(...polyEdges(poly).map(e => segDist2(p[0], p[1], ...e))));
  const rectOf = ([x1, y1, x2, y2, t]) => { const len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / (len || 1), uy = (y2 - y1) / (len || 1), hx = ux * len / 2, hy = uy * len / 2, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, px = -uy * t / 2, py = ux * t / 2; return [[cx - hx - px, cy - hy - py], [cx + hx - px, cy + hy - py], [cx + hx + px, cy + hy + py], [cx - hx + px, cy - hy + py]]; };
  // The distance between two shapes (0 when they overlap).
  function shapeDist(a, b) {
    if (a.kind === 'circle' && b.kind === 'circle') return Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) - a.r - b.r;
    if (a.kind === 'circle' && b.kind === 'poly') return ptPoly(a.c, b.poly) - a.r;
    if (a.kind === 'circle' && b.kind === 'capsule') return segDist2(a.c[0], a.c[1], ...b.seg) - a.r - b.r;
    if (a.kind === 'poly' && b.kind === 'poly') {
      if (a.poly.some(p => inPoly(p, b.poly)) || b.poly.some(p => inPoly(p, a.poly))) return 0;
      let d = Infinity; for (const e of polyEdges(a.poly)) for (const f of polyEdges(b.poly)) d = Math.min(d, segSeg(e, f)); return d;
    }
    if (a.kind === 'poly' && b.kind === 'capsule') {
      if (inPoly([b.seg[0], b.seg[1]], a.poly) || inPoly([b.seg[2], b.seg[3]], a.poly)) return -b.r;
      let d = Infinity; for (const e of polyEdges(a.poly)) d = Math.min(d, segSeg(e, b.seg)); return d - b.r;
    }
    if (a.kind === 'capsule' && b.kind === 'capsule') return segSeg(a.seg, b.seg) - a.r - b.r;
    return shapeDist(b, a);
  }
  // The elements of a table.
  function pinElements(table) {
    const els = [], F = table.flip || PIN.flip, wallSeg = (seg, i, name, lower) => ({ kind: 'poly', poly: rectOf(seg), seg, what: 'wall', name: name || `wall ${i} (${seg[0]},${seg[1]})-(${seg[2]},${seg[3]})`, lower: lower != null ? lower : i < table.lower, group: 'wall:' + i });
    table.walls.forEach((seg, i) => els.push(wallSeg(seg, i)));
    els.push(wallSeg(table.gate, table.walls.length, 'the gate', true));
    table.joints.forEach(([x, y, r, lower], i) => els.push({ kind: 'circle', c: [x, y], r, seg: [x, y, x, y, r * 2], what: 'wall', name: `wall end ${i} (${x},${y})`, lower: !!lower }));   // (a wall's end disc: it joins the walls that end there)
    for (const g of [[table.gate[0], table.gate[1]], [table.gate[2], table.gate[3]]]) els.push({ kind: 'circle', c: g, r: table.gate[4] / 2, seg: [g[0], g[1], g[0], g[1], table.gate[4]], what: 'wall', name: `the gate's end (${g[0]},${g[1]})`, lower: true });
    table.bumpers.forEach(([x, y, r], i) => els.push({ kind: 'circle', c: [x, y], r, what: 'bumper', name: `bumper ${i} (${x},${y})` }));
    table.slings.forEach((tri, i) => els.push({ kind: 'poly', poly: tri, what: 'sling', name: `slingshot ${i}`, lower: true }));
    for (const t of table.targets) {
      if (t.spin) for (let k = 0; k < 24; k++) { const a = (k * Math.PI * 2) / 24; els.push({ kind: 'circle', c: [t.spin.cx + t.spin.r * Math.cos(a), t.spin.cy + t.spin.r * Math.sin(a)], r: t.r, what: 'target', target: t, name: `target ${t.id} "${t.name}" (on its ring)`, group: 'target:' + t.id }); }
      else els.push({ kind: 'circle', c: [t.x, t.y], r: t.r, what: 'target', target: t, name: `target ${t.id} "${t.name}" (${t.x},${t.y})` });
    }
    for (const side of ['L', 'R']) for (let k = 0; k <= 8; k++) { const a = F.rest + (F.up - F.rest) * k / 8; els.push({ kind: 'capsule', seg: pinFlipLine(table, side, a), r: F.thick / 2, what: 'flipper', name: `flipper ${side}`, group: 'flip:' + side, lower: true, rest: k === 0, pivot: F[side] }); }
    const ln = table.lane;
    els.push({ kind: 'poly', poly: [[ln.x0, ln.top], [ln.x1, ln.top], [ln.x1, PIN.h], [ln.x0, PIN.h]], what: 'lane', name: 'the lane', lower: true });
    for (const e of els) if (e.what === 'wall' && !e.lower) e.bounds = els.some(o => o !== e && o.what === 'wall' && o.lower && pinJoined(e, o));   // (a rail joined to the lower table's walls bounds the lane with them)
    return els;
  }
  // Two walls joined: a shared end, or an end of one buried in the other (a T: the end within the other's thickness).
  const pinJoined = (a, b) => { const e = [[a.seg[0], a.seg[1]], [a.seg[2], a.seg[3]]], f = [[b.seg[0], b.seg[1]], [b.seg[2], b.seg[3]]]; return e.some(p => segDist2(p[0], p[1], ...b.seg) <= b.seg[4] / 2 + 1e-6) || f.some(p => segDist2(p[0], p[1], ...a.seg) <= a.seg[4] / 2 + 1e-6); };
  // The places a ball could come to rest: the ball touching two elements at once (or a level top) with
  // gravity balanced by the two contacts (straight up lies between the contacts' normals: a wedge, a
  // cradle, a ball on a target's shoulder against a wall). Sampled along every element's surface at the
  // ball's distance, each sample against every other element it touches. The bumpers kick the ball off
  // and never hold it; the flippers hold it only at rest (a held flipper is the player's choice); the
  // bottom wall and the lane are where the ball waits to be served. Another target never blocks a
  // pocket here (a square deals only some of the spots), so a pocket found with every spot in place is
  // one some square could have, and a table with none has none whichever spots it deals.
  function pinPockets(els, outer) {
    const R = PIN.ballR, up = [0, -1], out = [], seen = new Set();
    const world = els.filter(e => e.what !== 'lane' && !(e.what === 'wall' && e.seg[1] > PIN.h && e.seg[3] > PIN.h) && !(e.what === 'flipper' && !e.rest));   // what is there with the flippers down
    const blockers = world.filter(e => e.what !== 'target');
    const samples = e => {                                           // ball centres touching e, with the contact normal (from e into the ball); flat: on a straight side at least a ball wide (a ball could sit level on it)
      const pts = [], step = 0.3;
      const arc = (c, r, a0, a1) => { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / step)); for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; pts.push([[c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)], [Math.cos(a), Math.sin(a)], false]); } };
      const side = (a, b, nx, ny, off) => { const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, m = Math.ceil(len / step); for (let k = 0; k <= m; k++) pts.push([[a[0] + dx * k / m + nx * off, a[1] + dy * k / m + ny * off], [nx, ny], len >= 2 * R]); };
      if (e.kind === 'circle') arc(e.c, e.r + R, 0, Math.PI * 2);
      else if (e.kind === 'capsule') { const [x1, y1, x2, y2] = e.seg, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, a = Math.atan2(uy, ux); for (const s of [1, -1]) side([x1, y1], [x2, y2], -uy * s, ux * s, e.r + R); arc([x2, y2], e.r + R, a - Math.PI / 2, a + Math.PI / 2); arc([x1, y1], e.r + R, a + Math.PI / 2, a + Math.PI * 3 / 2); }
      else {
        const P = e.poly, n = P.length, area = P.reduce((s, p, i) => s + p[0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * p[1], 0), sg = area > 0 ? 1 : -1;   // the outward normal of each edge, by the polygon's winding
        for (let i = 0; i < n; i++) {
          const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = sg * dy / len, ny = -sg * dx / len;
          side(a, b, nx, ny, R);
          const c = P[(i + 2) % n], ex = c[0] - b[0], ey = c[1] - b[1], el = Math.hypot(ex, ey) || 1, n2x = sg * ey / el, n2y = -sg * ex / el;   // the arc round the corner at b, from this edge's normal to the next's
          let a0 = Math.atan2(ny, nx), a1 = Math.atan2(n2y, n2x); if (sg > 0 ? a1 < a0 : a1 > a0) a1 += sg * Math.PI * 2; arc(b, R, a0, a1);
        }
      }
      return pts;
    };
    const normalFrom = (p, e) => {                                   // the contact normal from e to a ball at p
      if (e.kind === 'circle') { const d = [p[0] - e.c[0], p[1] - e.c[1]], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l]; }
      if (e.kind === 'capsule') { const [x1, y1, x2, y2] = e.seg, dx = x2 - x1, dy = y2 - y1, u = Math.max(0, Math.min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / (dx * dx + dy * dy))), q = [x1 + u * dx, y1 + u * dy], d = [p[0] - q[0], p[1] - q[1]], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l]; }
      let best = null;
      for (const ed of polyEdges(e.poly)) { const dx = ed[2] - ed[0], dy = ed[3] - ed[1], u = Math.max(0, Math.min(1, ((p[0] - ed[0]) * dx + (p[1] - ed[1]) * dy) / (dx * dx + dy * dy))), q = [ed[0] + u * dx, ed[1] + u * dy], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (!best || d < best.d) best = { d, q }; }
      const d = [p[0] - best.q[0], p[1] - best.q[1]], l = Math.hypot(...d) || 1; return [d[0] / l, d[1] / l];
    };
    const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
    for (const A of world) {
      if (A.what === 'bumper') continue;
      for (const [p, nA, flat] of samples(A)) {
        if (p[1] > PIN.drain - R || (p[0] >= PIN.lane.x0 - R && p[1] > PIN.lane.top) || !inPoly(p, outer)) continue;   // (the drain, the lane, outside)
        if (!blockers.every(C => C === A || shapeDist({ kind: 'circle', c: p, r: R }, C) > -0.05)) continue;   // not a place the ball can be
        if (flat && nA[1] < -0.9995) { const key = A.name + '|level'; if (!seen.has(key)) { seen.add(key); out.push(`a ball can rest on ${A.name} (level top) at (${p[0].toFixed(1)},${p[1].toFixed(1)})`); } continue; }
        for (const B of world) {
          if (B === A || B.what === 'bumper' || (A.group && A.group === B.group)) continue;
          const d = shapeDist({ kind: 'circle', c: p, r: R }, B);
          if (d > 0.15 || d < -0.15) continue;
          const nB = normalFrom(p, B), cr = cross(nA, nB);
          if (Math.abs(cr) < 1e-6) continue;
          const l1 = cross(up, nB) / cr, l2 = cross(nA, up) / cr;
          if (l1 < -1e-6 || l2 < -1e-6) continue;
          // balanced, but held? in a cradle the ball cannot move sideways at this height (both sides rise into
          // it); on a hilltop (the top of a bend, the far side of a rail) it can, and rolls off
          // (0.03: more than the brush a convex surface gives a ball moved 0.3 sideways, 0.3 squared over twice the ball's radius)
          const held = [-1, 1].every(dir => [A, B].some(E => shapeDist({ kind: 'circle', c: [p[0] + dir * 0.3, p[1]], r: R }, E) < -0.03));
          if (!held) continue;
          const key = [A.name, B.name].sort().join('|');
          if (!seen.has(key)) { seen.add(key); out.push(`a ball can rest on ${A.name} against ${B.name} at (${p[0].toFixed(1)},${p[1].toFixed(1)})`); }
        }
      }
    }
    return out;
  }
  // A wall ending in a flipper's pivot disc (the inlane guides), and the sweep's reach from the pivot
  // the wall must keep clear of (the disc, the wall's half thickness and the clearance).
  const PIN_PIVOT_JOIN = 4.2;
  const pinAtPivot = (w, f) => [[w.seg[0], w.seg[1]], [w.seg[2], w.seg[3]]].some(p => Math.hypot(p[0] - f.pivot[0], p[1] - f.pivot[1]) <= f.r + w.seg[4] / 2 + 1e-6);
  function pinLayoutCheck(table) {
    const els = pinElements(table), out = [], R = PIN.ballR;
    for (const e of els) {                                           // inside the table (the outside walls are its edges)
      if (e.what === 'wall' && e.lower) continue;
      const pts = e.kind === 'circle' ? [[e.c[0] - e.r, e.c[1] - e.r], [e.c[0] + e.r, e.c[1] + e.r]] : e.kind === 'poly' ? e.poly : [[e.seg[0] - e.r, e.seg[1] - e.r], [e.seg[2] + e.r, e.seg[3] + e.r]];
      if (pts.some(([x, y]) => x < 0 || x > PIN.w || y < 0 || y > PIN.h)) out.push(`${e.name} is outside the table`);
    }
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (a.group && a.group === b.group) continue;
      if (a.what === 'wall' && b.what === 'wall' && pinJoined(a, b)) continue;
      if ((a.what === 'lane' && (b.lower || b.bounds)) || (b.what === 'lane' && (a.lower || a.bounds))) continue;
      let d;
      if ((a.what === 'wall' && b.what === 'flipper' && pinAtPivot(a, b)) || (b.what === 'wall' && a.what === 'flipper' && pinAtPivot(b, a))) {   // a guide ending in the pivot's disc: clear of the flipper from the disc outwards
        const f = a.what === 'flipper' ? a : b, w = f === a ? b : a, [x1, y1, x2, y2] = f.seg, len = Math.hypot(x2 - x1, y2 - y1), k = PIN_PIVOT_JOIN / len;
        d = shapeDist(w, { kind: 'capsule', seg: [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, x2, y2], r: f.r });
      } else d = shapeDist(a, b);
      if (d < PIN_CLEAR - 1e-9) out.push(`${a.name} and ${b.name} are ${d.toFixed(2)} apart (less than ${PIN_CLEAR})`);
    }
    for (const p of pinPockets(els, table.outer)) out.push(p);
    for (const t of els.filter(e => e.what === 'target')) {          // room for the ball: in some direction the ball touches the target, and sits half a unit further out, clear of everything else
      const others = els.filter(e => e !== t && !(e.group && e.group === t.group));
      let ok = false;
      for (let k = 0; k < 24 && !ok; k++) {
        const a = (k * Math.PI * 2) / 24, dx = Math.cos(a), dy = Math.sin(a);
        ok = [0, 0.25, 0.5].every(s => { const c = [t.c[0] + (t.r + R + s) * dx, t.c[1] + (t.r + R + s) * dy]; return c[0] > R && c[0] < PIN.w - R && c[1] > R && others.every(o => shapeDist({ kind: 'circle', c, r: R }, o) >= 0); });
      }
      if (!ok) out.push(`${t.name} has no room for the ball to reach it`);
    }
    return out;
  }

  return { GOLF, POOL, BOWL, HOLES, LAYOUTS, SIZES, FPS, TS, run, PIN, PIN_LAYOUTS, PIN_LOWER, PIN_OUTER, PIN_CLASSIC, pinTable, pinAllSpots, pinNew, pinServe, pinLaunch, pinRun, pinFlipLine, pinSpinAt, pinResult, pinAi, pinReach, pinLayoutCheck, pinV, pinPack, pinUnpack, pinFlipAngles, pinLogPack, pinLogUnpack, pinReplay };
}
