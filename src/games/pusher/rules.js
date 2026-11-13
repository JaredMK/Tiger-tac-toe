// Coin Pusher: the rules (pure: no page, no clock; the server runs the same code).
import { makeRng, needRng, randInt } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// ---------- Coin Pusher (November 2026; reworked the same month: a live machine and a dropper to time; one shared machine from v 3) ----------
// ONE MACHINE FOR BOTH (v 3, November 2026): the shelf (`mini.coins`, an array) and the pusher are both players'. Each coin
// knows whose it is (`[x, y, star, owner]`: owner 0 the machine's own neutral coins, 1 X's, 2 O's): a player's dropped
// coins are in their colour and score for them whenever they go over the front edge, on anyone's turn; the machine's own
// coins score for the player whose move pushed them off. Both totals can change on any move (`last.pts` the mover's,
// `last.opp` the other's). The end: the first total to reach `target` wins at once (December 2026). A square dealt before
// (v 2: a machine each) takes the mover's machine as the shared one, every coin on it neutral, at its next move (pushUp).
// What follows describes the machine itself (v 2's words: "each player has a machine" now reads "the machine").
// Each player has a machine of their own, seen from above: a shelf of coins with a pusher bar across its back that
// slides forward and back all the time (a triangle wave: `stroke` of the shelf every `period` seconds), and a dropper
// that slides back and forth across the top (`dropPeriod` seconds there and back). A move drops `perMove` coins (3),
// one at a time: each tap releases a coin at the dropper's place at that moment, landing just in front of the bar
// where it is then; timing is the skill. The first tap starts the move: where the bar and the dropper were in their
// cycles then (`ph`, `dp`, in thousandths) is part of the move, and every coin after it is the step it was released at
// (`k`, steps of 1/`PUSH.hz` s from the first; `k[0]` is 0). The coins left for after the attempt's time limit
// (`maxSecs` from the first) drop where the dropper is then. After the last coin the machine runs on until it has
// settled (pushOver: a full stroke with nothing falling, every coin still), then stops, frozen until the next move
// here (`mini.ph`: where the bar stands); coins pushed over the front edge score, coins that slide off the sides near the front (where the side walls
// stop) are lost; what is left stays for that player's next move (`mini.coins[p]`). Star coins (`starPct`, worth
// `starWorth`) come from the square's own public seed (`mini.seed`, the player and their move's number), so the move is
// worked out from its inputs alone: the same push on the mover's phone (played live as it is made), on the server (the
// result kept) and on the other phone (played again from the move). The first coin to take a total to `target` wins the
// square there and then, mid-move or not (a square from before already in its matching turn, `mini.final`, plays it out).
// The simulation is plain arithmetic (+, -, *, / and sqrt: the same on every phone and the server), a fixed step,
// every coin in a fixed order; the shelf is kept between moves in whole units (`PUSH.Q` to the width).
export const PUSH = { slots: 9, Q: 10000, hz: 60, r: 0.05, back: 0.16, gut: 0.84, iters: 6, hold: 500, still: 2e-5, pace: 1.6 };
// THE MACHINE'S PACE (December 2026): the machine's own clock (`hz` steps a machine second: the bar's stroke, the coins'
// physics) runs `pace` times faster than the real one (TUNE `pace`, 1.6): `pushHz` steps a real second. The dropper keeps
// its real speed (`dropPeriod` real seconds), the attempt's limit is real seconds (`maxSecs`), a move's `ms` and its
// events' `t` are real ms (at Normal; the page takes them through core/timer.js dur like every move).
export const pushPace = c => Math.max(0.5, Math.min(3, c && c.pace > 0 ? c.pace : PUSH.pace));
export const pushHz = c => PUSH.hz * pushPace(c);
// The square's settings, with its coins' radius `r` (shelf widths): the shared machine's (v 3) is its `coin` setting (bigger
// coins than before: the shelf holds fewer, so a coin dropped reaches the front edge within a square, and a player's own
// coins come into play); a square from before keeps PUSH.r.
// The square's opening move (the first of either player on the shared machine) drops `open` coins (2), the rest
// `perMove` (3): with the instant win the first mover's head start is otherwise worth 64% (tests/sim/pusher.sim.js).
export const pushCfg = mini => {
  const t = Object.assign({}, tune(mini)), v3 = mini && (mini.v || 0) >= 3;
  t.r = v3 && t.coin > 0 ? t.coin : PUSH.r;
  if (v3 && mini.moves && !(mini.moves.X + mini.moves.O) && t.open > 0) t.perMove = Math.min(t.perMove, t.open | 0);
  return t;
};
export const pushR = c => (c && c.r > 0 ? c.r : PUSH.r);
export const OWN = { X: 1, O: 2 }, OWNER = [null, 'X', 'O'];
// The shared shelf (v 3), or a square from before: the mover's machine (else X's).
export const pushShelf = (mini, p) => (Array.isArray(mini.coins) ? mini.coins : (mini.coins && (mini.coins[p] || mini.coins.X)) || []);
// A square from before (v 2, a machine each) made the shared machine: a fresh shared shelf of neutral coins (the coins are
// bigger now: the old shelves would not fit), the totals kept.
export function pushUp(mini, p) {
  if (Array.isArray(mini.coins) && (mini.v || 0) >= 3) return mini;
  mini.v = 3;
  mini.coins = pushFresh(pushCfg(mini), makeRng(`push-up:${mini.seed == null ? 0 : mini.seed}`));   // (a fresh shared shelf of the new size: the scores kept)
  return mini;
}
// The bar's front edge at t seconds into a move: from PUSH.back forward by `stroke` and back again every `period` seconds
// (a triangle wave: no trig, the same everywhere), from where it was in its cycle at the first tap (ph, 0..1).
export function pushBar(c, t, ph) {
  const per = Math.max(0.5, c.period), u = ((t / per + (ph || 0)) % 1 + 1) % 1, k = u < 0.5 ? u * 2 : 2 - u * 2;
  return PUSH.back + c.stroke * k;
}
// The dropper's place (0..1 of the width, its centre) at t seconds, from dp (0..1 of its cycle) at the first tap: from
// the left wall to the right and back every `dropPeriod` seconds.
export function pushDropX(c, t, dp) {
  const per = Math.max(0.5, c.dropPeriod) * pushPace(c), u = ((t / per + (dp || 0)) % 1 + 1) % 1, k = u < 0.5 ? u * 2 : 2 - u * 2, r = pushR(c);   // (t machine seconds: the dropper's real period is dropPeriod)
  return r + (1 - 2 * r) * k;
}
// A fresh shelf: `start` coins in loose rows in front of the bar, each nudged a little from the square's rng (both
// players' machines start alike).
export function pushStart(c, rng) {
  const r = pushR(c), n = Math.max(0, c.start | 0), out = [], cols = Math.max(2, Math.floor((1 - 2 * r) / (2 * r) + 1e-9) + 1), gap = (1 - 2 * r) / (cols - 1);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const x = r + col * gap + (row % 2 ? gap / 2 : 0) * (col === cols - 1 ? -1 : 1), y = 1 - r * 1.2 - row * r * 1.75;
    const star = rng() * 100 < c.starPct;
    out.push([Math.round((x + (rng() - 0.5) * 0.02) * PUSH.Q), Math.round((y + (rng() - 0.5) * 0.02) * PUSH.Q)].concat(star ? [1] : []));
  }
  return out;
}
// The shared machine's fresh shelf at rest: laid out, then pushed for `settleStrokes` with nothing dropped (whatever falls
// then is nobody's), so the first move finds the machine as every later one does (a loose front row once gave the first
// mover a free sweep of it).
export function pushFresh(c, rng) {
  const laid = pushStart(c, rng).map(a => [a[0], a[1], a[2] ? 1 : 0, 0]);
  return pushSim(c, pushSim(c, laid, [], false, 0, null).coins, [], false, 0, null).coins;
}
export function create(type, rng) {
  const r = needRng(rng), mini = { type, v: 3, seed: 0, ph: 0, coins: [], score: { X: 0, O: 0 }, moves: { X: 0, O: 0 }, turns: { X: 0, O: 0 }, final: null, last: null };
  const c = pushCfg(Object.assign({ tune: tuneLive(type) }, mini));
  mini.coins = pushFresh(c, r); mini.seed = randInt(r, 1e9);
  return mini;
}
export const pushWorth = (c, star) => (star ? Math.max(1, c.starWorth | 0) : 1);   // a coin's points: a star coin is worth `starWorth`
// Which of a move's coins are star coins: from the square's public seed, the player and their move's number (nothing
// hidden, nothing the mover can steer: the same on every phone and the server).
export function pushStars(mini, p, c, n) {
  const r = makeRng(`push:${mini.seed == null ? 0 : mini.seed}:${p}:${mini.moves[p]}`);
  return Array.from({ length: n }, () => (r() * 100 < c.starPct ? 1 : 0));
}
export const pushMaxSteps = c => Math.round(Math.max(1, c.maxSecs) * pushHz(c));
// THE MOVE'S END (December 2026): after the last coin the machine runs on only until nothing moves or falls: a full stroke
// (`pushStrokeSteps`, one `period`) since the last coin dropped and since the last coin left the shelf, and every coin
// still (no coin moved more than PUSH.still in the step); then it ends at once (pushOver). At most `settleStrokes` strokes
// after the last coin (4: a shelf that keeps spilling). The same here, live and in the replays.
export const pushStrokeSteps = c => Math.round(Math.max(0.5, c.period) * PUSH.hz);
export const pushCapSteps = c => Math.round(Math.max(1, c.settleStrokes == null ? 4 : c.settleStrokes) * Math.max(0.5, c.period) * PUSH.hz);
export const pushOver = (sim, lastK) => sim.win != null || (sim.s > lastK && (sim.s - lastK >= pushCapSteps(sim.c) || (sim.s - Math.max(lastK + 1, sim.fallAt) >= pushStrokeSteps(sim.c) && sim.move < PUSH.still)));
// The bar's place in its cycle (0..1) after `steps` from ph: where the machine stands, frozen, until the next move here.
export const pushPhAfter = (c, ph, steps) => { const u = (ph || 0) + steps / PUSH.hz / Math.max(0.5, c.period); return Math.round((((u % 1) + 1) % 1) * 1e6) / 1e6; };
// ---- the simulation, a step at a time (the phone plays it live; the server and the replays run it through) ----
// `mover`: whose move it is (the machine's own coins pushed off score for them; a player's own coins always for their owner).
// goal ({ X, O, target }: the totals before the move): the first coin that takes a player's total to the target ends the
// move there and then (sim.win: that player), mid-move or not (THE INSTANT WIN, December 2026).
export function pushInit(c, coins, ph, frames, mover, goal) {
  return { c, ph: ph || 0, s: 0, mover: mover || null, goal: goal || null, win: null, fallAt: 0, move: 0, list: coins.map((a, i) => ({ x: a[0] / PUSH.Q, y: a[1] / PUSH.Q, vx: 0, vy: 0, id: i, st: a[2] ? 1 : 0, ow: a[3] | 0 })), nextId: coins.length, scored: 0, lost: 0, pts: 0, opp: 0, by: { X: 0, O: 0 }, ev: [], frames: frames ? [] : null, last: null };
}
// Whose a coin over the edge is: its owner's, or (the machine's own) the mover's.
export const pushTo = (sim, o) => OWNER[o.ow | 0] || sim.mover;
// One step; drop: a coin released now ({ x: 0..1, st }) or null. sim.last: this step's events, for the live sounds.
export function pushStep(sim, drop) {
  const c = sim.c, r = pushR(c), d2 = 4 * r * r, dt = 1 / PUSH.hz, fr = Math.max(0, Math.min(0.99, c.friction / 100));
  const s = sim.s, t = (s + 1) * dt, tr = Math.round((s + 1) * 1000 / pushHz(c)), bar = pushBar(c, t, sim.ph), now = [];   // (t machine seconds; tr the step's real ms, for the events)
  let list = sim.list;
  if (drop) {
    const x = Math.max(r, Math.min(1 - r, drop.x)), st = drop.st ? 1 : 0;
    list.push({ x, y: bar + r + 0.004, vx: 0, vy: 0, id: sim.nextId++, st, ow: drop.ow | 0 });
    const e = { t: tr, kind: 'drop', x: Math.round(x * 1000) / 1000, st };
    sim.ev.push(e); now.push(e);
  }
  const px = list.map(o => o.x), py = list.map(o => o.y);
  for (const o of list) { o.x += o.vx * dt; o.y += o.vy * dt; }
  for (let it = 0; it < PUSH.iters; it++) {
    for (const o of list) {
      if (o.y < bar + r) o.y = bar + r;                                 // the bar: nothing gets behind it
      if (o.y < PUSH.gut) { if (o.x < r) o.x = r; else if (o.x > 1 - r) o.x = 1 - r; }   // the side walls (they stop at the gutters)
    }
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j], dx = b.x - a.x, dy = b.y - a.y, q = dx * dx + dy * dy;
        if (q >= d2 || q === 0) continue;
        const dd = Math.sqrt(q), push = (2 * r - dd) / (2 * dd);
        const ax = dx * push, ay = dy * push;
        // (against the bar a coin cannot give way backwards: the other takes the whole push)
        if (a.y <= bar + r + 1e-9 && ay > 0) { b.x += ax; b.y += 2 * ay; a.x -= ax; continue; }
        if (b.y <= bar + r + 1e-9 && ay < 0) { a.x -= ax; a.y -= 2 * ay; b.x += ax; continue; }
        a.x -= ax; a.y -= ay; b.x += ax; b.y += ay;
      }
    }
  }
  const keep = [];
  let mv = 0;
  list.forEach((o, i) => {
    mv = Math.max(mv, Math.abs(o.x - px[i]), Math.abs(o.y - py[i]));
    o.vx = (o.x - px[i]) / dt * fr; o.vy = (o.y - py[i]) / dt * fr;   // (the shelf's friction: what a push leaves of a coin's speed)
    if (o.y > 1 || (o.y >= PUSH.gut && (o.x < 0 || o.x > 1))) sim.fallAt = s + 1;
    if (o.y > 1) {
      const to = pushTo(sim, o), w = pushWorth(c, o.st);
      sim.scored++; if (to) sim.by[to] += w;
      const gl = sim.goal;
      if (gl && to && sim.win == null && (gl[to] || 0) + sim.by[to] >= gl.target) sim.win = to;   // (the first to the target: the move ends on this step)
      if (!to || to === sim.mover) sim.pts += w; else sim.opp += w;
      const e = { t: tr, kind: 'off', x: Math.round(o.x * 1000) / 1000, st: o.st, ow: o.ow | 0, to };
      sim.ev.push(e); now.push(e);
    }
    else if (o.y >= PUSH.gut && (o.x < 0 || o.x > 1)) { sim.lost++; const e = { t: tr, kind: 'lost', x: Math.round(o.x * 1000) / 1000, st: o.st }; sim.ev.push(e); now.push(e); }
    else keep.push(o);
  });
  sim.list = keep; sim.s = s + 1; sim.last = now; sim.move = drop ? 1 : mv;
  if (sim.frames) sim.frames.push(keep.map(o => [o.x, o.y, o.st, o.ow | 0]));
  return sim;
}
export function pushRest(sim) {   // the shelf at rest, in whole units, back to front (a fixed order for the next move)
  const rest = sim.list.map(o => [Math.round(o.x * PUSH.Q), Math.round(o.y * PUSH.Q)].concat(o.st || o.ow ? [o.st ? 1 : 0] : []).concat(o.ow ? [o.ow] : []));
  rest.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return rest;
}
// The drops of a move: [{ k, x, st }] (x 0..1 at the dropper's place at step k).
export function pushDrops(c, mv, stars, ow) {
  return mv.k.map((k, i) => ({ k, x: pushDropX(c, k / PUSH.hz, mv.dp / 1000), st: stars[i] ? 1 : 0, ow: ow | 0 }));
}
// The whole move run through: from the shelf `coins` (whole units) and its drops, to the last coin's step and the
// settle after it. Returns { coins (at rest), scored, pts, lost, frames (when asked), events, ms, steps }.
// goal: as pushInit's (the move stops at the step a player reaches the target: `win`). endPh: the bar's place at the end.
export function pushSim(c, coins, drops, frames, ph, mover, goal) {
  const sim = pushInit(c, coins, ph, frames, mover, goal), last = drops.length ? Math.max(...drops.map(d => d.k)) : -1;
  let j = 0;
  while (!pushOver(sim, last)) {
    const s = sim.s, d = j < drops.length && drops[j].k === s ? drops[j++] : null;   // (one coin a step at most: a move's steps rise, pushMove)
    pushStep(sim, d);
  }
  const steps = sim.s;
  return { coins: pushRest(sim), scored: sim.scored, pts: sim.pts, opp: sim.opp, by: sim.by, lost: sim.lost, win: sim.win, frames: sim.frames, events: sim.ev, ms: Math.round(steps * 1000 / pushHz(c)), steps, endPh: pushPhAfter(c, ph, steps) };
}
// A move as sent: { ph, dp, k: [0, k2, ...] }: ph and dp whole thousandths (0..999), `perMove` steps each later than the
// one before, the last within the attempt's time limit. null when it is not one.
export function pushMove(c, m) {
  const n = Math.max(1, c.perMove | 0);
  if (!m || typeof m !== 'object' || !Array.isArray(m.k) || m.k.length !== n) return null;
  const ph = m.ph, dp = m.dp, k = m.k;
  if (![ph, dp].every(v => Number.isInteger(v) && v >= 0 && v < 1000)) return null;
  if (k[0] !== 0 || !k.every((v, i) => Number.isInteger(v) && (i === 0 || v > k[i - 1]) && v <= pushMaxSteps(c) + n)) return null;   // (+n: a move won mid-way fills its coins left after the win's step: never dropped)
  return { ph, dp, k: k.slice() };
}
// How long a move lasted, in real ms (core/verify.js: no longer than the turn has lasted): the machine run through as
// apply runs it, to its settle or its win (the phone sends the move once the machine has stopped).
export function pushRunMs(mini, p, m) {
  const c = pushCfg(Object.assign({}, mini, { v: 3 })), mv = pushMove(c, m);
  if (!mv) return 0;
  const shared = Array.isArray(mini.coins) && (mini.v || 0) >= 3;
  if (!shared) return Math.round(mv.k[mv.k.length - 1] * 1000 / pushHz(c));
  return pushSim(c, mini.coins, pushDrops(c, mv, pushStars(mini, p, c, mv.k.length), OWN[p]), false, pushStartPh(mini, mv), p, pushGoal(mini, c)).ms;
}
// Where the bar is as a move starts: where the last move here left it (the machine stands still between turns, mini.ph),
// else (a square from before) where the move says.
export const pushStartPh = (mini, mv) => (mini && typeof mini.ph === 'number' && (mini.v || 0) >= 3 ? mini.ph : mv.ph / 1000);
// The instant win's goal: the totals before the move (none for a square from before still finishing its matching turn).
export const pushGoal = (mini, c) => (mini.final ? null : { X: mini.score.X, O: mini.score.O, target: c.target });
export function randomPushMove(c, rng) {   // (the tests' stand-in, and 'auto': three coins at random moments)
  const r = needRng(rng), n = Math.max(1, c.perMove | 0), k = [0];
  for (let i = 1; i < n; i++) k.push(Math.min(pushMaxSteps(c), k[i - 1] + 1 + randInt(r, Math.max(2, Math.round(PUSH.hz * 1.5)))));
  for (let i = 1; i < n; i++) if (k[i] <= k[i - 1]) k[i] = k[i - 1] + 1;
  return { ph: randInt(r, 1000), dp: randInt(r, 1000), k };
}
export function apply(mini, p, m, rng, idx) {
  const c = pushCfg(Object.assign({}, mini, { v: 3 }));              // (the shared machine's settings: a square from before becomes one below)
  const mv = m === 'auto' ? randomPushMove(c, rng) : pushMove(c, m);
  if (!mv || mv.k[mv.k.length - 1] > pushMaxSteps(c)) return { ok: false, reason: 'bad' };
  const up = !(Array.isArray(mini.coins) && (mini.v || 0) >= 3);
  pushUp(mini, p);
  if (up) mini.ph = mv.ph / 1000;                                    // (a square from before: its bar where the move found it)
  const o = p === 'X' ? 'O' : 'X', from = mini.coins.map(a => a.slice()), stars = pushStars(mini, p, c, mv.k.length), drops = pushDrops(c, mv, stars, OWN[p]);
  const ph0 = pushStartPh(mini, mv), goal = pushGoal(mini, c), res = pushSim(c, from, drops, false, ph0, p, goal);
  mini.ph = res.endPh;                                               // (the machine stops where the move ended: nothing moves until the next move here)
  const before = mini.score[p], ob = mini.score[o];
  if (!mini.turns) mini.turns = { X: mini.moves.X, O: mini.moves.O };
  if (!mini.last || mini.last.by !== p) mini.turns[p] += 1;          // (a turn: the first move of it; "Go again on success" adds moves, not turns)
  mini.coins = res.coins; mini.score[p] = before + res.pts; mini.score[o] = ob + res.opp; mini.moves[p] += 1;
  mini.last = { by: p, ph: ph0 * 1000, dp: mv.dp, k: mv.k, stars, from, scored: res.scored, pts: res.pts, opp: res.opp, lost: res.lost, before, after: mini.score[p], ob, oa: mini.score[o], ms: res.ms, tg: goal ? goal.target : 0, win: res.win || null };
  // The end: the first total to reach the target takes the square at once (res.win: the move stopped there). A square
  // from before that was already finishing its round (`mini.final`: the other player's matching turn) plays it out as it
  // was: then the higher total wins, and level totals are a draw (the square resets).
  if (res.win) return { ok: true, outcome: 'win', winner: res.win, note: 'reached' };
  const settle = () => (mini.score.X === mini.score.O ? { ok: true, outcome: 'draw', note: 'tie' } : { ok: true, outcome: 'win', winner: mini.score.X > mini.score.O ? 'X' : 'O', note: 'most' });
  if (mini.final && mini.final.by !== p) { mini.final = null; return settle(); }   // the other side's matching turn: done
  if (!mini.final && Math.max(mini.score.X, mini.score.O) >= c.target) return settle();   // (a total already past it: a square from before)
  if (!mini.final && res.pts > 0 && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'scored', again: true };   // ("Go again on success" on: a coin of the mover's over the edge keeps the turn)
  return { ok: true, outcome: 'continue', note: res.pts > 0 ? 'scored' : 'none' };
}
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }   // (nothing hidden: both machines and the seed are on show)
export function randomMove(mini, p, rng) { return randomPushMove(pushCfg(mini), rng); }
export function canMove(mini) { return true; }
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.push = { by: p, v: 3, ph: l.ph, tg: l.tg || 0, dp: l.dp, k: l.k.slice(), stars: l.stars.slice(), pts: l.pts, opp: l.opp || 0, from: l.from.map(a => a.slice()), scored: l.scored, lost: l.lost, before: l.before, after: l.after, ob: l.ob, oa: l.oa, ms: l.ms, score: { X: mini.score.X, O: mini.score.O } };
}
// The move's frames and events, worked out again from the flash (the same as the server's).
export function pushReplay(c, g) {
  c = Object.assign({}, c, { r: g.v >= 3 && c.coin > 0 ? c.coin : PUSH.r });
  const ow = g.v >= 3 ? OWN[g.by] : 0, drops = g.k.map((k, i) => ({ k, x: pushDropX(c, k / PUSH.hz, g.dp / 1000), st: g.stars && g.stars[i] ? 1 : 0, ow }));
  const o = g.by === 'X' ? 'O' : 'X', goal = g.tg ? { [g.by]: g.before, [o]: g.ob || 0, target: g.tg } : null;   // (the same goal: the replay stops where the move did)
  return pushSim(c, g.from, drops, true, g.ph / 1000, g.by, goal);
}
export function flashMs(f, winLen, won) { return (f.push ? f.push.ms : 3000) + PUSH.hold + (won ? 600 : 0); }
