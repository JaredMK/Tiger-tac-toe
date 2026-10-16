'use strict';
// Run with:  node --test
// Sky Hop, Scoop Stack and Pinball: the finger games. Each attempt played through the same fixed steps
// everywhere (its inputs give back the same result), every course and every fall of scoops possible for
// a perfect hand, an attempt resuming where the player left off, the checks a phone's attempt must pass,
// Pinball's table (nothing passing through a wall or a flipper, every touch of a target counted, no ball
// resting for ever), the computer's attempts (about 3 to 6 to win), timeouts, and whole matches.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const hopMini = (seed, h0) => ({ type: 'skyhop', cfg: E.hopConfig(), seed: { X: seed, O: seed + 1 }, height: { X: h0 || 0, O: 0 }, tries: { X: 0, O: 0 }, last: null });
const scoopMini = (seed, n0, tries) => ({ type: 'scoop', cfg: E.scoopConfig(), seed: { X: seed, O: seed + 1 }, stack: { X: Array.from({ length: n0 || 0 }, (_, k) => k % 5), O: [] }, tries: { X: tries || 0, O: 0 }, last: null });

/* ===================================== Sky Hop ===================================== */
test('sky hop: the same inputs give the same attempt (the phone, the server, a replay), step for step', () => {
  for (let s = 0; s < 12; s++) {
    const mini = hopMini(100 + s, s * 37.5), r = E.hopAi(mini, 'X', E.makeRng('d' + s));
    const log = E.fingUnlog(r.move.log, r.move.steps, Math.ceil(E.HOP.w * E.FING.q));
    assert.ok(log, 'the inputs read back');
    const a = E.fingReplay('skyhop', mini, 'X', log, r.move.steps), b = E.fingReplay('skyhop', JSON.parse(JSON.stringify(mini)), 'X', log, r.move.steps);
    assert.deepEqual([a.n, a.y, a.x, a.top, a.end], [r.sim.n, r.sim.y, r.sim.x, r.sim.top, r.sim.end], 'the replay ends exactly where the attempt did');
    assert.deepEqual([b.n, b.y, b.x, b.top], [a.n, a.y, a.x, a.top]);
    assert.equal(E.fingCheck(mini, 'X', r.move).why, null, 'and it passes the check');
  }
});
test('sky hop: no impossible gaps — a perfect hand climbs every course to the top, from anywhere', () => {
  const perfect = { react: [0, 0], aim: 0, lapse: 0, misjudge: 0 }, fails = [];
  for (let s = 0; s < 14; s++) for (const h0 of [0, 120, 260, 410, 480]) {
    const r = E.hopAi(hopMini(5000 + s, h0), 'X', E.makeRng('p' + s + h0), perfect);
    if (r.move.end !== 'top') fails.push([s, h0, r.move.end, r.move.h]);
  }
  assert.deepEqual(fails, [], 'every start reaches the top');
});
test('sky hop: every course is a chain of platforms each within one bounce of the last (up and across), with hazards never in the way up', () => {
  const cfg = E.hopConfig(), peak = E.hopPeak(cfg);
  for (let s = 0; s < 40; s++) {
    const c = E.hopCourse(cfg, 'chain' + s), chain = c.plats.filter(q => q.c);
    assert.ok(chain[chain.length - 1].y >= cfg.target, 'the chain goes past the top');
    let y = 0, x = E.HOP.w / 2;
    for (const q of chain) {
      const gap = q.y - y;
      assert.ok(gap > 0 && gap <= E.HOP.gapK * peak + 1e-9, `a gap of ${gap.toFixed(2)} m is within a bounce (${peak.toFixed(2)})`);
      const air = (cfg.bounce + Math.sqrt(cfg.bounce * cfg.bounce - 2 * E.HOP.g * gap)) / E.HOP.g;
      assert.ok(Math.abs(E.fdiff(q.x, x, E.HOP.w)) <= E.HOP.vx * air + 1e-6, 'and within reach across, in the time in the air');
      y = q.y; x = q.x;
    }
    for (const h of c.haz) for (const q of chain) assert.ok(!(q.y > h.y - peak - 0.6 && q.y < h.y + 1.2 && Math.abs(E.fdiff(q.x, h.x, E.HOP.w)) < q.w / 2 + q.amp + 1.2), 'no hazard over a platform on the way up');
  }
});
test('sky hop: an attempt resumes at the saved height on a safe start (2 seconds of grace, nothing hazardous in reach), and keeps the best height', () => {
  const cfg = E.hopConfig(), peak = E.hopPeak(cfg);
  for (const h0 of [0, 55.5, 133, 299.9, 471]) {
    const mini = hopMini(77, h0), sim = E.hopStart(mini, 'X');
    assert.equal(sim.y, h0); assert.equal(sim.top, h0);
    assert.ok(sim.haz.every(h => h.y > h0 + peak + 0.5), 'no hazard within the first bounce');
    for (let n = 0; n < E.FING.grace / E.FING.step; n++) E.hopStep(sim, null);   // no finger at all for the grace
    assert.equal(sim.end, null, `from ${h0} m: still going after the grace`);
    assert.ok(sim.y >= h0 - 1e-9 || sim.vy > 0, 'held up by the start ledge');
    // the move keeps the best height, and never takes any off
    const r = E.hopAi(mini, 'X', E.makeRng('k' + h0)), st = { squares: [{ owner: null, mini }] };
    const before = mini.height.X, c = E.fingCheck(mini, 'X', r.move);
    assert.equal(c.why, null);
    assert.ok(r.move.h >= before, 'an attempt\'s height is at least where it started');
    void st;
  }
});
test('sky hop: difficulty rises with height (wider gaps, narrower, moving and breaking platforms, hazards higher up)', () => {
  const cfg = E.hopConfig(), lo = [], hi = [];
  for (let s = 0; s < 20; s++) for (const q of E.hopCourse(cfg, 'd' + s).plats) (q.y < 100 ? lo : q.y > 400 ? hi : []).push(q);
  const share = (a, k) => a.filter(q => q.k === k).length / a.length;
  assert.ok(avg(hi.map(q => q.w)) < avg(lo.map(q => q.w)), 'narrower higher up');
  assert.ok(share(hi, 'm') > share(lo, 'm') && share(hi, 'b') > share(lo, 'b'), 'more moving and breaking platforms higher up');
  assert.equal(lo.filter(q => q.k === 'b' && q.y < cfg.breakAt).length, 0, 'none break below their start height');
  const haz = [].concat(...Array.from({ length: 20 }, (_, s) => E.hopCourse(cfg, 'd' + s).haz));
  assert.ok(haz.length > 20 && haz.every(h => h.y > cfg.hazAt - E.HOP.gapK * E.hopPeak(cfg)), 'hazards, only from about their start height (within the gap below it)');
});
test('sky hop: a breaking platform takes one bounce; a burr ends the attempt; falling off the bottom ends it; the top ends it', () => {
  const ends = {};
  for (let s = 0; s < 40; s++) { const r = E.hopAi(hopMini(300 + s, 150 + (s % 5) * 60), 'X', E.makeRng('e' + s)); ends[r.move.end] = (ends[r.move.end] || 0) + 1; if (r.move.end === 'top') assert.equal(r.move.h, E.hopConfig().target); }
  assert.ok(ends.fall > 0 && ends.hazard > 0, `falls and hazards both happen (${JSON.stringify(ends)})`);
  const sim = E.hopStart(hopMini(9, 200), 'X');
  for (let n = 0; n < 60 / E.FING.step && !sim.end; n++) { E.hopStep(sim, null); if (sim.last === 'break') assert.equal(sim.gone[sim.on], 1, 'a broken platform is gone'); }
});

/* ===================================== Scoop Stack ===================================== */
// A perfect cone (it knows every item and moves at the fair speed) plans its way back from the last item:
// at each item only some places will do (under a scoop; clear of a hazard), and from each it must be able
// to reach the next. Played through the real steps (the sway included), it catches every scoop and is
// never hit: every attempt is fair.
function perfectScoop(mini) {
  const sim = E.scoopStart(mini, 'X'), cfg = sim.cfg, v = cfg.cone * E.SCOOP.fair, lo = E.SCOOP.edge, hi = E.SCOOP.w - E.SCOOP.edge, its = sim.items;
  const allowed = it => (it.k === 'scoop' ? [[it.x - 0.2, it.x + 0.2]] : [[lo, it.x - E.SCOOP.hit - E.SCOOP.pad], [it.x + E.SCOOP.hit + E.SCOOP.pad, hi]].filter(([a, b]) => b >= a));
  const cut = (A, B) => { const out = []; for (const [a, b] of A) for (const [c, d] of B) { const x = Math.max(a, c), y = Math.min(b, d); if (y >= x) out.push([x, y]); } return out; };
  const grow = (A, e) => A.map(([a, b]) => [Math.max(lo, a - e), Math.min(hi, b + e)]);
  const S = new Array(its.length);
  for (let i = its.length - 1; i >= 0; i--) S[i] = i === its.length - 1 ? allowed(its[i]) : cut(allowed(its[i]), grow(S[i + 1], v * (its[i + 1].T - its[i].T)));
  const way = [[0, sim.x]];
  let x = sim.x, t = 0;
  for (let i = 0; i < its.length; i++) {
    const reach = v * (its[i].T - t);
    let best = null;
    for (const [a, b] of S[i]) { const y = Math.max(a, Math.min(b, x)); if (Math.abs(y - x) <= reach + 1e-9 && (best == null || Math.abs(y - x) < Math.abs(best - x))) best = y; }
    if (best == null) return { planned: false, at: i };
    way.push([its[i].T, best]); x = best; t = its[i].T;
  }
  const at = tt => { let k = 0; while (k < way.length - 1 && way[k + 1][0] < tt) k++; if (k === way.length - 1) return way[k][1]; const [t0, x0] = way[k], [t1, x1] = way[k + 1]; const u = Math.min(1, Math.max(0, (tt - t0) / Math.max(1e-9, (t1 - t0) * 0.5))); return x0 + (x1 - x0) * u; };   // (it gets there in the first half of each stretch, then waits)
  let sway = 0;
  while (!sim.end) { E.scoopStep(sim, at(sim.t + E.FING.step)); sway = Math.max(sway, Math.abs(sim.s)); }
  return { planned: true, end: sim.end, got: sim.got.length, miss: sim.miss, sway };
}
test('scoop stack: every attempt is fair — a perfect cone catches every scoop and dodges every hazard, sway and all', () => {
  const bad = [];
  let sway = 0;
  for (let s = 0; s < 120; s++) {
    const r = perfectScoop(scoopMini(900 + s, s % 25, s % 4));
    sway = Math.max(sway, r.sway || 0);
    if (!r.planned || r.end !== 'top' || r.miss) bad.push([s, r]);
  }
  assert.deepEqual(bad, [], 'all reach the target with no miss');
  assert.ok(sway > 0.02, `the stack sways (${sway.toFixed(2)})`);
});
test('scoop stack: the same inputs give the same attempt; the stack carries over, attempt to attempt, with the same falls on a retry only after a new try', () => {
  const mini = scoopMini(42, 0, 0);
  let n = 0;
  for (let k = 0; k < 4; k++) {
    const r = E.scoopAi(mini, 'X', E.makeRng('sc' + k));
    const c = E.fingCheck(mini, 'X', r.move);
    assert.equal(c.why, null);
    assert.equal(c.sim.n0, n, 'it starts with the stack so far');
    assert.deepEqual(E.fingReplay('scoop', mini, 'X', E.fingUnlog(r.move.log, r.move.steps, 500), r.move.steps).got, r.sim.got);
    mini.stack.X = mini.stack.X.concat(c.sim.got); mini.tries.X++; n = mini.stack.X.length;
  }
  assert.ok(n > 0, 'the stack grew');
  const a = E.scoopItems(mini.cfg, 'x', 3, 5), b = E.scoopItems(mini.cfg, 'x', 3, 5), c = E.scoopItems(mini.cfg, 'x', 4, 5);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
});
test('scoop stack: faster and more hazards as the stack grows; nothing lands in the grace; three misses end it; a scoop far off-centre slides off', () => {
  const cfg = E.scoopConfig(), low = E.scoopItems(cfg, 'r', 0, 0), high = E.scoopItems(cfg, 'r', 0, 20);
  assert.ok(low[0].T > E.FING.grace, 'the first item lands after the grace');
  assert.ok(avg(high.slice(0, 20).map(i => i.v)) > avg(low.slice(0, 20).map(i => i.v)), 'faster');
  const hz = n0 => { let bad = 0, all = 0; for (let k = 0; k < 30; k++) { const a = E.scoopItems(cfg, 'h' + k, 0, n0).slice(0, 12); all += a.length; bad += a.filter(i => i.k !== 'scoop').length; } return bad / all; };
  assert.ok(hz(20) > hz(0) + 0.05, `more hazards higher up (${hz(0).toFixed(2)} of the items at the bottom, ${hz(20).toFixed(2)} near the target)`);
  // a cone that stays still: scoops slide off or miss, three of them end it
  const sim = E.scoopStart(scoopMini(5), 'X'), seen = new Set();
  while (!sim.end) { E.scoopStep(sim, 1); if (sim.last) seen.add(sim.last); }
  assert.ok(sim.end === 'miss' || sim.end === 'hazard');
  if (sim.end === 'miss') assert.equal(sim.miss, 3);
  // one scoop, put down just off the top: within slide it stacks, further but touching it slides off
  for (const [off, want] of [[0.3, 'catch'], [0.8, 'slide'], [1.5, 'miss']]) {
    const s = E.scoopStart(scoopMini(6), 'X'); s.items = [{ T: 0.05, x: s.x + off, k: 'scoop', f: 1, v: 5 }];
    while (!s.last && !s.end) E.scoopStep(s, null);
    assert.equal(s.last, want, `${off} off-centre: ${want}`);
  }
});

/* ===================================== Pinball ===================================== */
const PIN = P.PIN;
const segDist = (px, py, [x1, y1, x2, y2]) => { const dx = x2 - x1, dy = y2 - y1, u = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - x1 - u * dx, py - y1 - u * dy); };
test('pinball: no tunnelling — over many balls the ball is never inside a wall or a flipper and never leaves the table, at any step', () => {
  let worst = 0, steps = 0, guards = 0;
  for (let s = 0; s < 30; s++) {
    const rng = E.makeRng('tun' + s), w = P.pinNew(E.pinConfig(), [0, 0, 0, 0, 0, 0, 0]);
    let flip = { L: false, R: false };
    P.pinLaunch(w, rng());
    while (!w.over && w.t < 40) {
      if (rng() < 0.08) flip = { L: rng() < 0.5, R: rng() < 0.5 };
      P.pinRun(w, 1000 / 240, flip); steps++;
      const b = w.ball.position;
      assert.ok(b.x >= 0 && b.x <= PIN.w && b.y >= 0 && b.y <= PIN.h + 5, 'on the table');
      for (const seg of P.PIN_WALLS) worst = Math.max(worst, seg[4] / 2 + PIN.ballR - segDist(b.x, b.y, seg));
      for (const side of ['L', 'R']) worst = Math.max(worst, PIN.ballR + PIN.flip.thick / 2 * 0.65 - segDist(b.x, b.y, P.pinFlipLine(side, w.flip[side].a)) - 0.9);   // (the capsule thins to its tip)
      if (!w.inPlay && !w.over) P.pinLaunch(w, rng());
    }
    guards += w.events.filter(e => e.k === 'guard').length;
  }
  assert.ok(steps > 10000);
  assert.ok(worst < 0.9, `never more than a little into a wall or a flipper (deepest ${worst.toFixed(2)} units; the ball is ${PIN.ballR * 2} across)`);
  assert.equal(guards, 0, 'the table\'s last-resort guard never needed');
});
test('pinball: every touch of a target counts (and only a real touch: never through a wall), at every size the settings allow', () => {
  for (const size of [0.6, 1, E.pinConfig().size, E.PINB_LIMITS.size[1]]) {
    const cfg = Object.assign(E.pinConfig(), { size });
    for (const t of PIN.targets) {
      if (t.spin) continue;
      const r = t.r * size;
      for (const seg of P.PIN_WALLS.slice(8)) {   // a target may sit against a wall, but never pokes out of its far side (the outside's far side is off the table)
        const d = segDist(t.x, t.y, seg);
        if (d < r + seg[4] / 2) assert.ok(d + seg[4] / 2 >= r - 1e-9 || d <= seg[4] / 2, `target ${t.id} at size ${size} pokes through a wall`);
      }
    }
    let missed = 0, touches = 0;
    for (let s = 0; s < 12; s++) {
      const r = P.pinAi(cfg, [0, 0, 0, 0, 0, 0, 0], E.makeRng('reg' + size + s)), lit = {};
      for (const [id, t] of r.result.hits) lit[id] = t;
      void r;
      touches += r.result.hits.length;
    }
    for (let s = 0; s < 6; s++) {   // the ball's every step: a ball overlapping an unlit target lights it in that step
      const w = P.pinNew(cfg, [0, 0, 0, 0, 0, 0, 0]), rng = E.makeRng('step' + size + s);
      P.pinLaunch(w, rng());
      while (!w.over && w.t < 30) {
        const flip = { L: rng() < 0.3, R: rng() < 0.3 };
        P.pinRun(w, 1000 / 480, flip);
        const b = w.ball.position;
        for (const t of PIN.targets) {
          const [x, y] = t.spin ? P.pinSpinAt(w.t, cfg) : [t.x, t.y];
          if (Math.hypot(b.x - x, b.y - y) < t.r * size + PIN.ballR - 0.05 && !w.lit[t.id]) missed++;
        }
        if (!w.inPlay && !w.over) P.pinLaunch(w, rng());
      }
    }
    assert.equal(missed, 0, `size ${size}: no touch missed`);
    assert.ok(touches > 0);
  }
  for (let k = 0; k <= 10; k++) {                                  // a launch never lights anything through the lane's wall
    const w = P.pinNew({ size: E.PINB_LIMITS.size[1] }, [0, 0, 0, 0, 0, 0, 0]);
    P.pinLaunch(w, k / 10);
    while (!w.over && w.t < 3 && w.ball.position.x > 86) { P.pinRun(w, 1000 / 60, {}); if (w.ball.position.x > 88.5) assert.deepEqual(w.hits, [], 'nothing lit from the plunger lane'); }
  }
});
test('pinball: a ball nobody flips always drains (it never rests on the flippers or anywhere); a quick drain is saved', () => {
  const ends = {};
  for (let s = 0; s < 60; s++) {
    const rng = E.makeRng('pass' + s), w = P.pinNew(E.pinConfig(), [0, 0, 0, 0, 0, 0, 0]);
    P.pinLaunch(w, 0.2 + 0.8 * rng());
    while (!w.over) { P.pinRun(w, 1000 / 60, {}); if (!w.inPlay && !w.over) P.pinLaunch(w, 0.5); }
    const r = P.pinResult(w); ends[r.end] = (ends[r.end] || 0) + 1;
    assert.ok(r.ms < 60000, `drained in ${r.ms} ms`);
  }
  assert.ok(!ends.time, `no ball lasts for ever (${JSON.stringify(ends)})`);
  // a drain in the first seconds: served again (the same move goes on)
  const w = P.pinNew(E.pinConfig(), [0, 0, 0, 0, 0, 0, 0]);
  const M = require('matter-js');
  P.pinLaunch(w, 0.5); P.pinRun(w, 100, {});
  M.Body.setPosition(w.ball, { x: 45, y: PIN.drain - 1 }); M.Body.setVelocity(w.ball, { x: 0, y: 3 });
  for (let k = 0; k < 3; k++) P.pinRun(w, 50, {});
  assert.ok(w.events.some(e => e.k === 'save') && !w.over, 'saved');
});
test('pinball: the move\'s checks — a real ball passes; a faked one (teleport, too fast, a hit far from its target, a hit already lit, a time that does not match) does not', () => {
  const mini = E.newMini('pinball', E.makeRng('chk')), r = P.pinAi(mini.cfg, mini.lit.X, E.makeRng('real')).result;
  const m = { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end };
  assert.equal(E.pinCheck(mini, 'X', m), null, 'a real ball');
  const fr = P.pinUnpack(r.rec);
  const tweak = f => P.pinPack(f(fr.map(x => x.slice())));
  assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { rec: tweak(a => { a[Math.floor(a.length / 2)][0] = 5; a[Math.floor(a.length / 2)][1] = 20; return a; }) })), 'jump', 'a teleport');
  assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { ms: m.ms * 2 })), 'time', 'more time than the recording');
  if (m.hits.length) {
    const [id, t] = m.hits[0];
    assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { hits: [[id, Math.max(0, t - 3)]].concat(m.hits.slice(1)) })), 'hit', 'a hit at the wrong moment');
    const lit = JSON.parse(JSON.stringify(mini)); lit.lit.X[id] = 1;
    assert.equal(E.pinCheck(lit, 'X', m), 'hit', 'a target already lit');
  }
  const far = PIN.targets.find(t => !m.hits.some(h => h[0] === t.id));
  if (far) assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { hits: m.hits.concat([[far.id, 0.1]]) })), 'hit', 'a hit with the ball nowhere near');
  assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { rec: 'zz!' })), 'bad');
});
test('pinball: played as a phone plays it (frames of uneven length, a relaunch at once after a save), the recording keeps time with the ball and passes the check', () => {
  let drift = 0;
  for (let s = 0; s < 40; s++) {
    const rng = E.makeRng('phone' + s), mini = E.newMini('pinball', rng), w = P.pinNew(mini.cfg, mini.lit.X);
    P.pinLaunch(w, rng());
    while (!w.over) { P.pinRun(w, 8 + rng() * 40, { L: rng() < 0.2, R: rng() < 0.2 }); if (!w.inPlay && !w.over) P.pinLaunch(w, rng()); }
    const r = P.pinResult(w), frames = r.rec.split(',').length;
    drift = Math.max(drift, Math.abs(frames - (r.ms / 1000) * PIN.fps));
    assert.equal(E.pinCheck(mini, 'X', { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end }), null, `ball ${s} passes`);
  }
  assert.ok(drift <= 1.01, `frame k at k/30 s (at most a frame out: ${drift.toFixed(2)})`);
});
test('pinball: lit targets stay lit, for that player only; lighting all seven wins the square', () => {
  const st = E.newMatch(lcg(3), { games: ['pinball'] }), i = 4, mini = st.squares[i].mini;
  let balls = 0;
  while (!st.squares[i].owner && balls < 40) {
    const p = st.turn, before = mini.lit[p].slice(), other = mini.lit[E.other(p)].slice();
    const r = P.pinAi(mini.cfg, mini.lit[p], E.makeRng('lit' + balls)).result;
    const out = E.playMove(st, i, { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end }, E.makeRng('x' + balls));
    assert.equal(out.ok, true, out.reason);
    const now = st.squares[i].mini.lit;
    before.forEach((v, k) => { if (v) assert.equal(now[p][k], 1, 'a lit target stays lit'); });
    assert.deepEqual(now[E.other(p)], other, 'the other player\'s targets are untouched');
    E.endFlash(st); balls++;
  }
  assert.ok(st.squares[i].owner, 'someone lit all seven');
  assert.ok(st.squares[i].mini.lit[st.squares[i].owner].every(Boolean));
});

/* ===================================== the checks, the computer, timeouts, matches ===================================== */
test('the checks: a phone\'s Sky Hop or Scoop Stack attempt passes only as played (its height, its end, its length), within the longest allowed', () => {
  const mini = hopMini(11, 40), r = E.hopAi(mini, 'X', E.makeRng('c1')).move;
  assert.equal(E.fingCheck(mini, 'X', r).why, null);
  assert.equal(E.fingCheck(mini, 'X', Object.assign({}, r, { h: r.h + 10 })).why, 'replay', 'more height than the inputs give');
  assert.equal(E.fingCheck(mini, 'X', Object.assign({}, r, { end: r.end === 'fall' ? 'hazard' : 'fall' })).why, 'replay');
  assert.equal(E.fingCheck(mini, 'X', Object.assign({}, r, { steps: r.steps + 500 })).why, 'replay', 'it ended sooner than said');
  assert.equal(E.fingCheck(mini, 'X', Object.assign({}, r, { steps: E.FING.maxSecs / E.FING.step + 1 })).why, 'bad', 'longer than any attempt');
  assert.equal(E.fingCheck(mini, 'X', Object.assign({}, r, { log: 'not:a:log' })).why, 'bad');
  const sm = scoopMini(12, 3, 1), s = E.scoopAi(sm, 'X', E.makeRng('c2')).move;
  assert.equal(E.fingCheck(sm, 'X', s).why, null);
  assert.equal(E.fingCheck(sm, 'X', Object.assign({}, s, { n: s.n + 1 })).why, 'replay');
  // an attempt cut short (the time ran out): as it stood, gains kept
  const cut = E.hopStart(hopMini(13, 0), 'X'), rec = E.fingRecorder();
  for (let k = 0; k < 1500 && !cut.end; k++) E.hopStep(cut, rec.at(cut.n, 4.5 + Math.sin(k / 90) * 2));
  const out = Object.assign({ log: E.fingLog(rec.pairs) }, E.hopResult(cut));
  if (!cut.end) assert.equal(out.end, 'out');
  const m2 = hopMini(13, 0), st = { squares: [{ owner: null, mini: m2 }] };
  assert.equal(E.fingCheck(m2, 'X', out).why, null, 'an attempt that ended where it stood passes too');
  void st;
});
test('the computer: an average player\'s hand needs about 3 to 6 attempts to win each', () => {
  const runs = { skyhop: [], scoop: [], pinball: [] };
  for (let s = 0; s < 10; s++) {
    for (const type of ['skyhop', 'scoop', 'pinball']) {
      const mini = E.newMini(type, E.makeRng('avg' + type + s)), rng = E.makeRng('hand' + type + s);
      let k = 0;
      while (E.fingAt(mini, 'X') < E.fingGoal(mini) && k < 30) {
        const m = E.fingAi(mini, 'X', rng), c = E.fingCheck(mini, 'X', m);
        assert.equal(c.why, null, `${type}: the computer's own attempt passes the checks`);
        if (type === 'skyhop') mini.height.X = Math.max(mini.height.X, E.hopResult(c.sim).h);
        else if (type === 'scoop') { mini.stack.X = mini.stack.X.concat(c.sim.got).slice(0, mini.cfg.target); mini.tries.X++; }
        else for (const [id] of m.hits) mini.lit.X[id] = 1;
        k++;
      }
      runs[type].push(k);
    }
  }
  for (const [type, a] of Object.entries(runs)) { const m = avg(a); console.log(`${type}: ${m.toFixed(2)} attempts on average (${a.join(' ')})`); assert.ok(m >= 2.5 && m <= 6.5, `${type}: ${m.toFixed(2)} attempts`); }
});
test('timeouts: a timed-out turn makes no attempt and changes nothing; an attempt cut off by the clock keeps its gains; the replay takes the attempt\'s time (faster past the cap)', () => {
  const st = E.newMatch(lcg(8), { games: ['skyhop'] });
  st.timer = E.newTimer(60); st.timer.deadline = 1;
  const before = JSON.stringify(st.squares.map(q => q.mini.height));
  const r = E.timeoutMove(st, lcg(9));
  assert.equal(r.ok, true);
  assert.equal(r.move, 'auto');
  assert.equal(JSON.stringify(st.squares.map(q => q.mini.height)), before, 'no height gained or lost');
  assert.equal(st.flash.fing.auto, true);
  assert.equal(E.fingMs(st.flash.fing), 0, 'nothing to replay');
  assert.equal(E.fingMs({ type: 'skyhop', steps: 1200 }), 10000); assert.equal(E.fingMs({ type: 'pinball', ms: 95000 }), E.FING.replayMax);
  assert.equal(E.fingRaw({ type: 'pinball', ms: 95000 }), 95000);
});
test('the start: Start holds the player to the square (here and online), and is no bonus move; the computer\'s view of a square leaves out inputs and recordings', () => {
  const st = E.newMatch(lcg(10), { games: ['scoop'] });
  assert.equal(E.attStart(st, 2, 'X').ok, true); assert.equal(st.lock, 2);
  assert.equal(E.attStart(st, 3, 'X').ok, false, 'not another square');
  const r = E.scoopAi(st.squares[2].mini, 'X', E.makeRng('b')).move;
  assert.equal(E.playMove(st, 2, r, lcg(1)).ok, true);
  E.endFlash(st);
  assert.equal(st.turn, 'O', 'the turn passes'); assert.equal(st.lock, null);
  const pub = E.publicMini(st.squares[2].mini);
  assert.equal(pub.last.log, undefined); assert.equal(st.squares[2].mini.last.log, r.log);
});
test('matches: the computer against the computer finishes matches of each finger game, and with the rest', () => {
  for (const [games, seed] of [[['skyhop'], 1], [['scoop'], 2], [['pinball'], 3], [['skyhop', 'scoop', 'pinball', 'ttt', 'dash', 'golf'], 4]]) {
    const rng = lcg(seed), st = E.newMatch(rng, { games });
    let n = 0;
    const t0 = Date.now();
    while (!st.winner && n++ < 900) {
      const m = E.cpuMove(st, rng);
      const r = E.playMove(st, m.square, m.move, rng);
      assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: refused (${r.reason})`);
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
      if (E.FINGER_TYPES.includes(st.flash.type)) assert.ok(st.flash.fing && (st.flash.fing.log != null || st.flash.fing.rec != null), 'the flash carries the attempt, for the replay');
      E.endFlash(st);
    }
    assert.ok(st.winner, `${games.join('+')}: a winner after ${n} moves`);
    console.log(`${games.join('+')}: ${n} moves, ${Date.now() - t0} ms`);
  }
});
