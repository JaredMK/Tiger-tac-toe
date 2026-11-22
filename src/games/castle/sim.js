// Castle Smash: the scene, the castles and a shot's simulation (pure: no page, no clock; the server runs the same code).
// THE SCENE, in one frame for both players (the "target frame"): the shooter throws to the right from the release point
// CS.rel at a castle whose footprint is CS.foot; x runs to the right, h is the height above the ground. The other
// player's shot is the same picture mirrored (the view turns it round: x -> CS.w - x), so a castle is always kept as its
// attacker sees it, and the two castles of a square are dealt as the very same list.
// A BLOCK is [kind, x, h, angle] or [kind, x, h, angle, hits]: its kind (KINDS: stone bricks and cubes, timber posts,
// planks and beams, the core), its centre in tenths of a unit, its angle in thousandths of a radian (clockwise on the
// screen, as Matter.js has it) and, for a stone the boulder has cracked, the hard hits it has taken.
// A SHOT is { aim, power } (castleMove): the boulder leaves the release point at the elevation `aim` (radians) and a
// speed between CS.vMin and the square's top speed by `power` (0..1). Its flight is plain arithmetic, a step at a time
// (the speed takes the gravity, the place takes the speed: exactly what Matter.js does to a body in free flight), until
// it comes within reach of the castle or lands in the castle's yard: only then is a world made (Matter.js: the ground,
// the castle's blocks as they lie, the boulder as it flies) and stepped at 60 Hz until everything has come to rest. A
// boulder that lands short of the yard or flies past it is a dud: nothing is simulated, nothing moves.
// WHAT HAPPENS IN THE WORLD: every block is knocked about as a rigid body. A knock's PUNCH is the speed the two bodies
// close at, along the line they meet on, times the weight of the one that strikes (a block landing on the ground: its
// own). The boulder weighs about 1.5, a brick 1, a cube 0.5. Timber breaks when anything strikes it with a punch
// of `woodTough` or more. Stone is cracked by the boulder alone: a punch of `stoneTough` or more is a hard hit (one a
// shot at most for a block), and at `stoneHits` hard hits it crumbles. A block whose centre leaves the yard is gone
// (CS.yard); the boulder crumbles CS.life steps after its first knock, or as it stops or leaves. THE CORE (a crystal on
// its perch) ends when the boulder ('hit') or a block ('crush') strikes it with a punch of `coreTough` or more, when
// it has dropped CS.drop below where it stood, off its perch ('fell'), or when it leaves the yard ('off').
// A block that ends within CS.eps of where it began keeps its place exactly (a miss leaves a castle as it was, and a
// standing wall never creeps from shot to shot); the others are saved where they came to rest.
// THE RECORDING (for the phones' replay): 30 frames a second from the release; the boulder's place in every frame of its
// life, and for each block that moved or went, its pose from the frame before it first moved to the frame it came to
// rest (or went), each as half units and fiftieths of a radian, packed as differences in a string (pack/unpack).
import { PHYSICS } from '../shared/physics.js';

export const CS = {
  w: 520,                                                       // the scene's width (the other side's things are this one's mirrored)
  cat: 224, rel: [244, 48],                                     // the catapult's axle (x) and the boulder's release point
  foot: [382, 510], yard: [346, 548], zone: [322, 560],         // the castle's footprint; the yard a block must stay in; the ground a boulder may land on and roll
  u: 16, r: 9,                                                  // the grid a castle is built on; the boulder's radius
  hz: 120, sub: 4,                                              // steps a second (a stack of blocks sags four times less than at 60); a recorded frame every `sub` steps
  vMin: 4, aimLo: 0.12, aimHi: 1.45,                          // the slowest throw (units a tick, a tick a sixtieth of a second: Matter's own measure of speed); the elevations a throw may have
  flight: 840, cap: 600, life: 90, after: 90,                  // the longest flight, the longest time in the world, the boulder's life after its first knock, the scene's run-on after the core's end (steps)
  slow: 0.25, still: 0.07, stillA: 0.004, stillN: 20,           // the boulder's stop; the blocks' rest (units and radians a tick, for stillN steps)
  eps: 1, epsA: 0.02, drop: 9,                                // a block has moved beyond this; the core is off its perch this far down
  coarse: 2, rest: 2, evMax: 40, knock: 1.6,                               // the computer's reckoning steps this many steps at a time; Matter's resting threshold for this world; the knocks noted at most; the slowest knock worth a sound
};
// The kinds of block: width, height, what it is made of.
export const KINDS = [
  { id: 'brick', w: 32, h: 16, m: 's' }, { id: 'cube', w: 16, h: 16, m: 's' },
  { id: 'post', w: 10, h: 32, m: 'w' }, { id: 'plank', w: 64, h: 10, m: 'w' }, { id: 'beam', w: 96, h: 10, m: 'w' },
  { id: 'core', w: 14, h: 18, m: 'c' },
];
export const K = { brick: 0, cube: 1, post: 2, plank: 3, beam: 4, core: 5 };
// What they are made of: density (stone's and the boulder's by the square's settings), grip, bounce.
const MAT = { s: { d: 0.002, f: 0.85, fs: 1.6, e: 0.02 }, w: { d: 0.0009, f: 0.7, fs: 1.2, e: 0.04 }, c: { d: 0.001, f: 0.85, fs: 1.6, e: 0 } };
const DT = 1000 / CS.hz, TK = 60 / CS.hz, GS = 0.001 * DT * DT;   // a step (ms); ticks a step; gravity, units a step a step (Matter's own)
const r3 = v => Math.round(v * 1000) / 1000 + 0;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------- a shot as a move ----------
// { aim, power }: both numbers, the elevation within CS.aimLo..CS.aimHi, the power within 0..1, to three decimals (so a
// shot checked twice is the same shot twice). Anything else is no move.
export function castleMove(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const aim = m.aim, power = m.power;
  if (typeof aim !== 'number' || typeof power !== 'number' || !Number.isFinite(aim) || !Number.isFinite(power)) return null;
  if (aim < CS.aimLo - 1e-9 || aim > CS.aimHi + 1e-9 || power < 0 || power > 1) return null;
  return { aim: r3(aim), power: r3(power) };
}
export const castleSpeed = (power, vMax) => CS.vMin + (Math.max(CS.vMin, vMax) - CS.vMin) * power;
// The first `n` steps of a throw's flight (the view's dotted arc, the computer's reckoning): [[x, h], ...].
export function castleArc(shot, vMax, n) {
  const v = castleSpeed(shot.power, vMax) * TK, vx = Math.cos(shot.aim) * v, out = [];
  let x = CS.rel[0], h = CS.rel[1], vh = Math.sin(shot.aim) * v;
  for (let k = 0; k < n; k++) { vh -= GS; x += vx; h += vh; out.push([x, h]); }
  return out;
}
// The throw that passes through a point at an elevation (the computer's, the tests'): its power, or null when no
// speed within the catapult's range does it.
export function castleAimAt(x, h, aim, vMax) {
  const dx = x - CS.rel[0], dh = h - CS.rel[1], c = Math.cos(aim), rise = dx * Math.tan(aim) - dh;
  if (dx <= 0 || rise <= 0) return null;
  const v = Math.sqrt(GS * dx * dx / (2 * c * c * rise)) / TK, p = (v - CS.vMin) / (Math.max(CS.vMin, vMax) - CS.vMin);
  return p >= 0 && p <= 1 ? { aim: r3(aim), power: r3(p) } : null;
}

// ---------- the recording's packing ----------
// Whole numbers as text: each number's distance from the one before it in its own column (cols: 2 for the boulder, 3
// for a block), zigzagged; one character for a small one (under 91), '!' and three for a larger one. Neither '"' nor
// '\' is ever used, so the text rides a JSON record as it is.
const CH = (() => { let s = ''; for (let k = 35; k < 127; k++) if (k !== 92) s += String.fromCharCode(k); return s; })();   // 91 characters
export function pack(vals, cols) {
  let out = '';
  for (let k = 0; k < vals.length; k++) {
    const d = vals[k] - (k >= cols ? vals[k - cols] : 0), z = d >= 0 ? 2 * d : -2 * d - 1;
    out += z < 91 ? CH[z] : '!' + CH[Math.floor(z / 8281) % 91] + CH[Math.floor(z / 91) % 91] + CH[z % 91];
  }
  return out;
}
export function unpack(str, cols) {
  const out = [];
  if (typeof str !== 'string') return out;
  for (let k = 0; k < str.length; k++) {
    let z;
    if (str[k] === '!') { z = CH.indexOf(str[k + 1]) * 8281 + CH.indexOf(str[k + 2]) * 91 + CH.indexOf(str[k + 3]); k += 3; } else z = CH.indexOf(str[k]);
    if (!(z >= 0)) return out;
    const d = z % 2 ? -(z + 1) / 2 : z / 2, n = out.length;
    out.push(d + (n >= cols ? out[n - cols] : 0));
  }
  return out;
}

// ---------- a castle, dealt ----------
// Built on a grid of CS.u from the front (the attacker's side) to the back, eight columns: a front wall and a back
// wall of stone `layers` high, the core on a stone perch in the hall between them, a timber roof on the walls with
// stone on it, and odds and ends before and behind. `rng` picks the plan and its details; `t` the square's settings.
const col = c => CS.foot[0] + CS.u * c;                           // the left edge of a column
export function castleDeal(rng, t) {
  const H = clamp(Math.round(t.layers), 3, 5), U = CS.u, out = [], B = [];
  const put = (k, x, h) => out.push([k, Math.round(x * 10), Math.round(h * 10), 0]);
  const pick = n => Math.floor(rng() * n);
  const plan = pick(3), perch = 1 + (H > 3 ? pick(2) : 0);
  // a wall: bricks, or here and there two cubes side by side
  const wall = (c, n, loose) => { for (let i = 0; i < n; i++) { if (loose && rng() < 0.3) { put(K.cube, col(c) + U / 2, U * i + U / 2); put(K.cube, col(c) + U * 1.5, U * i + U / 2); } else put(K.brick, col(c) + U, U * i + U / 2); } };
  const tower = (c, n) => { for (let i = 0; i < n; i++) put(K.cube, col(c) + U / 2, U * i + U / 2); };
  const core = (x, n) => { for (let i = 0; i < n; i++) put(K.cube, x, U * i + U / 2); B.push([K.core, x, U * n + KINDS[K.core].h / 2]); };
  const top = U * H;
  if (plan === 0) {                                              // the keep: walls two wide, a hall of two columns, one long beam across, odds and ends before and behind
    wall(1, H, true); wall(5, H, true); core(col(4), perch);
    put(K.beam, col(4), top + 5);
    put(K.cube, col(1) + U / 2, top + 10 + U / 2); put(K.cube, col(6) + U / 2, top + 10 + U / 2);
    if (rng() < 0.6) put(K.brick, col(4), top + 10 + U / 2); else { put(K.cube, col(3) + U / 2, top + 10 + U / 2); put(K.cube, col(4) + U / 2, top + 10 + U / 2); }   // (stone over the core, always)
    const f = pick(3); if (f === 1) tower(0, 2); else if (f === 2) put(K.post, col(0) + U / 2, 16);
    if (rng() < 0.5) tower(7, 1 + pick(2));
  } else if (plan === 1) {                                       // the hall: a wider hall with timber posts in it, the beam from the very front
    wall(0, H, false); wall(5, H, true); core(col(3) + U / 2, perch);
    put(K.post, col(2) + 5, 16); put(K.post, col(5) - 5, 16);
    put(K.beam, col(3) + U / 2, top + 5);
    put(K.brick, col(1), top + 10 + U / 2); put(K.brick, col(6), top + 10 + U / 2);
    if (rng() < 0.5) put(K.cube, col(3) + U / 2, top + 10 + U / 2); else put(K.brick, col(3) + U / 2, top + 10 + U / 2);
    if (rng() < 0.5) tower(7, 1 + pick(2));
  } else {                                                       // the bastion: a low wall before the main one, the hall at the back
    wall(0, H - 1, false); wall(2, H, true); wall(6, H, false); core(col(5), perch);
    put(K.cube, col(pick(2)) + U / 2, U * (H - 1) + U / 2);
    put(K.beam, col(5), top + 5);
    put(K.cube, col(2) + U / 2, top + 10 + U / 2); put(K.cube, col(7) + U / 2, top + 10 + U / 2);
    if (rng() < 0.6) put(K.brick, col(5), top + 10 + U / 2); else { put(K.cube, col(4) + U / 2, top + 10 + U / 2); put(K.cube, col(5) + U / 2, top + 10 + U / 2); }
  }
  for (const [k, x, h] of B) put(k, x, h);                       // (the core last)
  return out;
}
export const castleCore = blocks => blocks.find(b => b[0] === K.core) || null;
// How well a castle still shields its core (the computer's measure, and its guess at the shots still needed): the
// blocks near the core count, the nearer the more; none: the core stands in the open.
export function castleShield(blocks) {
  const c = castleCore(blocks);
  if (!c) return 0;
  let s = 0;
  for (const b of blocks) { if (b === c) continue; const d = Math.hypot(b[1] - c[1], b[2] - c[2]) / 10; s += Math.max(0, 1 - d / 70) * (KINDS[b[0]].m === 's' ? 1 : 0.5); }
  return s;
}

// ---------- a shot, played out ----------
// c: the square's own numbers (rules.js castleCfg): vMax (the top speed, units a tick), ball (the boulder's density),
// stone (the stone's), woodTough, stoneTough, stoneHits, coreTough. quick: for the computer's reckoning (no recording,
// coarser steps, and it stops as the core ends). Returns { blocks (the castle after), core (how it ended, or null),
// broke (blocks broken), off (knocked out of the yard), cracked, moved, kind ('short' | 'long' | 'hit'), events, rec, ms }.
const corners = b => {                                            // a block's reach from its centre, each way (its box, turned)
  const Kd = KINDS[b[0]], a = b[3] / 1000, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  return [(Kd.w * cs + Kd.h * sn) / 2, (Kd.w * sn + Kd.h * cs) / 2];
};
export function castleBox(blocks) {
  let x0 = Infinity, x1 = -Infinity, h1 = 0;
  for (const b of blocks) { const [ex, eh] = corners(b), x = b[1] / 10, h = b[2] / 10; x0 = Math.min(x0, x - ex); x1 = Math.max(x1, x + ex); h1 = Math.max(h1, h + eh); }
  return [x0, x1, h1];
}
export function castleShot(M, was, shot, c, quick) {
  const v0 = castleSpeed(shot.power, c.vMax) * TK, vx0 = Math.cos(shot.aim) * v0, events = [], bt = [];
  let x = CS.rel[0], h = CS.rel[1], vx = vx0, vh = Math.sin(shot.aim) * v0, n = 0, kind = null, knocks = 0;
  const [bx0, bx1, bh1] = castleBox(was), reach = CS.r + 3;
  const ev = (k, e) => { if (k === 'knock' || k === 'hit') { if (knocks >= CS.evMax) return; knocks++; } events.push(Object.assign({ t: n, k }, e)); };
  const snap = () => { if (!quick) bt.push(Math.round(x * 2), Math.round(h * 2)); };
  snap();
  for (;;) {                                                      // the flight, until the castle is within reach or the ground is
    const nvh = vh - GS, nx = x + vx, nh = h + nvh;
    if (nx + reach >= bx0 && nx - reach <= bx1 && nh - reach <= bh1) break;
    if (nh - CS.r <= 0) {
      if (nx >= CS.zone[0] && nx <= CS.zone[1]) break;
      const f = clamp((h - CS.r) / Math.max(1e-6, h - nh), 0, 1);  // a dud: it stops where it lands
      x += vx * f; h = CS.r; n++; kind = x < CS.zone[0] ? 'short' : 'long'; ev('thud', { x: Math.round(x), v: Math.round(Math.abs(nvh) / TK * 10) / 10 });
      if (n % CS.sub) n++;
      snap(); break;
    }
    x = nx; h = nh; vh = nvh; n++;
    if (n % CS.sub === 0) snap();
    if (x > CS.w + 90 || n >= CS.flight) { kind = 'long'; break; }
  }
  const frames = () => Math.floor(n / CS.sub) + 1;
  if (kind) return { blocks: was, core: null, broke: 0, off: 0, cracked: 0, moved: 0, kind, events, rec: quick ? null : { n: frames(), b: pack(bt, 2), t: [] }, ms: Math.round(n * 1000 / CS.hz) };

  const { Engine, Bodies, Body, Composite, Events, Resolver } = M, keep = Resolver ? Resolver._restingThresh : null;
  if (Resolver) Resolver._restingThresh = CS.rest;                 // (the other physics games set it for their own small tables: this world wants Matter's own, and puts theirs back)
  try {
    const big = quick ? CS.coarse : 1, engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 }, positionIterations: quick ? 8 : 16, velocityIterations: 6 });   // (the computer's reckoning: coarser steps, a quarter of the work, near enough to choose by)
    const ground = Bodies.rectangle(CS.w / 2, 40, CS.w * 3, 80, { isStatic: true, friction: 0.9, frictionStatic: 1.6, restitution: 0.05, label: 'g' });
    const bodies = was.map((b, i) => {
      const Kd = KINDS[b[0]], mt = MAT[Kd.m];
      return Bodies.rectangle(b[1] / 10, -b[2] / 10, Kd.w, Kd.h, { angle: b[3] / 1000, density: Kd.m === 's' ? c.stone : mt.d, friction: mt.f, frictionStatic: mt.fs, restitution: mt.e, label: String(i) });
    });
    const ball = Bodies.circle(x, -h, CS.r, { density: c.ball, friction: 0.5, frictionAir: 0, restitution: 0.1, label: 'b' });
    Body.setVelocity(ball, { x: vx / TK, y: -vh / TK });
    Composite.add(engine.world, [ground, ...bodies, ball]);
    const alive = was.map(() => true), mat = was.map(b => KINDS[b[0]].m), ci = was.findIndex(b => b[0] === K.core), coreH = ci >= 0 ? was[ci][2] / 10 : 0;
    const doomed = new Set(), struck = new Set(), samples = was.map(() => []), goneAt = was.map(() => -1), f0 = Math.floor(n / CS.sub);
    let core = null, touch = -1, ballOn = true, slow = 0, still = 0, broke = 0, off = 0, deadAt = -1, lastKnock = -9;
    const pt = b => ({ x: Math.round(b.position.x), h: Math.round(-b.position.y) });
    Events.on(engine, 'collisionStart', e => {
      for (const pair of e.pairs) {
        const A = pair.bodyA, B = pair.bodyB, nr = pair.collision.normal;
        const rv = Math.abs((A.velocity.x - B.velocity.x) * nr.x + (A.velocity.y - B.velocity.y) * nr.y) / (TK * big);   // (in ticks: within a step Matter's velocities are the step's own)
        const isBall = A === ball || B === ball;
        if (isBall && touch < 0) touch = n;
        for (const [S, O] of [[A, B], [B, A]]) {
          const i = S.label === 'g' || S.label === 'b' ? -1 : Number(S.label), punch = rv * (O.isStatic ? S.mass : O.mass);
          if (i < 0 || !alive[i]) continue;
          if (i === ci) { if (!core && O !== ground && punch >= c.coreTough) core = O === ball ? 'hit' : 'crush'; }
          else if (mat[i] === 'w') { if (punch >= c.woodTough) doomed.add(i); }
          else if (O === ball && punch >= c.stoneTough && !struck.has(i)) { struck.add(i); if ((was[i][4] || 0) + 1 >= c.stoneHits) doomed.add(i); else ev('crack', Object.assign({ i }, pt(bodies[i]))); }
        }
        if (isBall) { const o = A === ball ? B : A; ev('hit', Object.assign({ v: Math.round(rv * 10) / 10, m: o === ground ? 'g' : mat[Number(o.label)] }, pt(ball))); }
        else if (rv >= CS.knock && n - lastKnock >= 6) { lastKnock = n; ev('knock', { v: Math.round(rv * 10) / 10, m: A === ground || B === ground ? 'g' : mat[Number(A.label)] === 'w' || mat[Number(B.label)] === 'w' ? 'w' : 's' }); }
      }
    });
    const drop = (i, k, e) => { alive[i] = false; goneAt[i] = n; Composite.remove(engine.world, bodies[i]); ev(k, Object.assign({ i }, pt(bodies[i]), e)); };
    const sample = () => {
      if (quick) return;
      if (ballOn) bt.push(Math.round(ball.position.x * 2), Math.round(-ball.position.y * 2));
      for (let i = 0; i < bodies.length; i++) if (alive[i]) samples[i].push(Math.round(bodies[i].position.x * 2), Math.round(-bodies[i].position.y * 2), Math.round(bodies[i].angle * 50));
    };
    if (!quick) for (let i = 0; i < bodies.length; i++) samples[i].push(Math.round(was[i][1] / 5), Math.round(was[i][2] / 5), Math.round(was[i][3] / 20));   // (the frame the world begins at: every block where it lay)
    const m0 = n;
    while (n - m0 < CS.cap) {
      Engine.update(engine, DT * big); n += big;
      for (const i of doomed) if (alive[i]) { broke++; drop(i, 'break', { a: Math.round(bodies[i].angle * 100) / 100, m: mat[i] }); }
      doomed.clear();
      for (let i = 0; i < bodies.length; i++) {
        if (!alive[i] || i === ci) continue;
        const b = bodies[i];
        if (b.position.x < CS.yard[0] || b.position.x > CS.yard[1] || b.position.y > 40) { off++; drop(i, 'off'); }
      }
      if (ci >= 0 && alive[ci]) {
        const b = bodies[ci];
        if (!core && (b.position.x < CS.yard[0] || b.position.x > CS.yard[1])) core = 'off';
        if (!core && -b.position.y < coreH - CS.drop) core = 'fell';
        if (core) { drop(ci, 'core', { how: core }); deadAt = n; }
      }
      if (ballOn) {
        const sp = ball.speed;
        slow = touch >= 0 && sp < CS.slow ? slow + big : 0;
        if ((touch >= 0 && n - touch >= CS.life) || slow >= 12 || ball.position.x < CS.zone[0] - 20 || ball.position.x > CS.zone[1] || ball.position.y > 40) { ballOn = false; ev('end', pt(ball)); Composite.remove(engine.world, ball); }
      }
      if (n % CS.sub === 0) sample();
      if (core && quick) break;
      if (deadAt >= 0 && n - deadAt >= CS.after) break;
      if (!ballOn) {
        let quiet = true;
        for (let i = 0; i < bodies.length && quiet; i++) if (alive[i] && (bodies[i].speed > CS.still || bodies[i].angularSpeed > CS.stillA)) quiet = false;
        still = quiet ? still + 1 : 0;
        if (still * big >= CS.stillN) break;
      }
    }
    if (n % CS.sub) { n += CS.sub - n % CS.sub; sample(); }
    if (ballOn) { ballOn = false; ev('end', pt(ball)); }
    // where everything came to rest: a block within eps of where it began keeps its place exactly
    const blocks = [], tracks = [];
    let moved = 0;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i], w = was[i];
      const far = alive[i] && (Math.abs(b.position.x - w[1] / 10) > CS.eps || Math.abs(-b.position.y - w[2] / 10) > CS.eps || Math.abs(b.angle - w[3] / 1000) > CS.epsA);
      const hit = alive[i] && struck.has(i);
      if (alive[i]) blocks.push(far || hit ? (far ? [w[0], Math.round(b.position.x * 10), Math.round(-b.position.y * 10), Math.round(b.angle * 1000)] : w.slice(0, 4)).concat(hit ? [(w[4] || 0) + 1] : w[4] ? [w[4]] : []) : w);
      if (far || !alive[i]) moved++;
      if (quick || !(far || !alive[i])) continue;
      const s = samples[i], q = [Math.round(w[1] / 5), Math.round(w[2] / 5), Math.round(w[3] / 20)], cnt = s.length / 3;
      let a = 1, z = cnt - 1;                                       // from the frame before it first moved to the frame it last did
      while (a < cnt && Math.abs(s[a * 3] - q[0]) <= 1 && Math.abs(s[a * 3 + 1] - q[1]) <= 1 && Math.abs(s[a * 3 + 2] - q[2]) <= 1) a++;
      while (z > a && s[z * 3] === s[z * 3 - 3] && s[z * 3 + 1] === s[z * 3 - 2] && s[z * 3 + 2] === s[z * 3 - 1]) z--;
      a = Math.min(a, cnt) - 1;
      const cut = s.slice(a * 3, Math.min(cnt, z + 1) * 3);
      cut[0] = q[0]; cut[1] = q[1]; cut[2] = q[2];
      tracks.push([i, f0 + a, pack(cut, 3)].concat(alive[i] ? [] : [Math.ceil(goneAt[i] / CS.sub)]));
    }
    return { blocks, core, broke, off, cracked: struck.size, moved, kind: 'hit', events, rec: quick ? null : { n: frames(), b: pack(bt, 2), t: tracks }, ms: Math.round(n * 1000 / CS.hz) };
  } finally { if (Resolver) Resolver._restingThresh = keep; }
}
export const castleLib = () => (PHYSICS.lib && PHYSICS.lib.Matter) || null;
