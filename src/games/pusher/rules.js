// Coin Pusher: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// ---------- Coin Pusher (November 2026) ----------
// Each player has a machine of their own, seen from above: a shelf of coins with a pusher bar across its back that
// slides forward and back. A move drops `perMove` coins (3) through slots along the top (`PUSH.slots` of them, the
// mover's choice, the same slot more than once allowed); each lands just in front of the bar, a little to either side
// of its slot (`jitter`), and the bar starts the move somewhere in its cycle (`ph`), both drawn from the move's rng
// (the server's online): the luck of the machine. The bar pushes for `secs` seconds; coins
// pushed over the front edge score, coins that slide off the sides near the front (where the side walls stop) are lost.
// What is left on the shelf stays there for that player's next move (`mini.coins[p]`). Once a player's coins reach
// `target`, the other plays their turn to match (the round finishes, `mini.final`); then the higher total wins, level a draw.
// The simulation is plain arithmetic (+, -, *, / and sqrt: the same on every phone and the server), a fixed step
// (`PUSH.hz`), every coin in a fixed order; the shelf is kept between moves in whole units (`PUSH.Q` to the width), so
// a move played again from the same coins and drops gives the same frames, coin for coin. The server plays the move and
// keeps the result; the phones play it again from the move's flash to draw it (the coins before it and the drops: no
// recording rides the record).
export const PUSH = { slots: 9, Q: 10000, hz: 60, r: 0.05, back: 0.16, gut: 0.84, iters: 6, damp: 0.55, dropGap: 0.45, dropAt: 0.25, hold: 500 };
export const pushCfg = mini => tune(mini);
const SECS = c => Math.max(1, c.secs);
// The bar's front edge at t seconds: from PUSH.back forward by `stroke` and back again every `period` seconds (a
// triangle wave: no trig, the same everywhere), starting forward.
export function pushBar(c, t, ph) {
  const per = Math.max(0.5, c.period), u = ((t + (ph || 0) * per) % per) / per, k = u < 0.5 ? u * 2 : 2 - u * 2;
  return PUSH.back + c.stroke * k;
}
// A fresh shelf: `start` coins in loose rows in front of the bar, each nudged a little from the square's rng (both
// players' machines start alike).
export function pushStart(c, rng) {
  const r = PUSH.r, n = Math.max(0, c.start | 0), out = [], cols = 9, gap = (1 - 2 * r) / (cols - 1);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const x = r + col * gap + (row % 2 ? gap / 2 : 0) * (col === cols - 1 ? -1 : 1), y = 1 - r * 1.2 - row * r * 1.75;
    const star = rng() * 100 < c.starPct;
    out.push([Math.round((x + (rng() - 0.5) * 0.02) * PUSH.Q), Math.round((y + (rng() - 0.5) * 0.02) * PUSH.Q)].concat(star ? [1] : []));
  }
  return out;
}
export function create(type, rng) {
  const r = needRng(rng), c = Object.assign({}, tuneLive(type)), shelf = pushStart(c, r);
  return { type, coins: { X: shelf.map(a => a.slice()), O: shelf.map(a => a.slice()) }, score: { X: 0, O: 0 }, moves: { X: 0, O: 0 }, turns: { X: 0, O: 0 }, final: null, last: null };
}
// The drops of a move: each slot's centre, nudged by the jitter (in whole units, from the move's rng).
export function pushDrops(c, slots, rng) {   // each drop: [x in whole units, star 0 | 1]
  const w = 1 / PUSH.slots;
  return slots.map(s => { const x = Math.round(((s + 0.5) * w + (rng() * 2 - 1) * c.jitter) * PUSH.Q); return [x, rng() * 100 < c.starPct ? 1 : 0]; });
}
export const pushWorth = (c, star) => (star ? Math.max(1, c.starWorth | 0) : 1);   // a coin's points: a star coin is worth `starWorth`
// The move played out: from the shelf `coins` (whole units) and the drops' x (whole units), every step's coins when
// `frames` is asked for. Returns { coins (whole units, at rest), scored, lost, frames: [[x, y, id]...] per step,
// events: [{ t, kind: 'drop' | 'off' | 'lost', x }] }.
export function pushSim(c, coins, drops, frames, ph) {   // ph: where in its cycle the bar starts (0..1, from the move's rng)
  const r = PUSH.r, d2 = 4 * r * r, dt = 1 / PUSH.hz, steps = Math.round(SECS(c) * PUSH.hz), gap = Math.max(0.1, PUSH.dropGap);
  const fr = Math.max(0, Math.min(0.99, c.friction / 100));
  let list = coins.map((a, i) => ({ x: a[0] / PUSH.Q, y: a[1] / PUSH.Q, vx: 0, vy: 0, id: i, st: a[2] ? 1 : 0 }));
  let nextId = list.length, scored = 0, lost = 0, pts = 0;
  const ev = [], out = frames ? [] : null, dropStep = drops.map((x, k) => Math.round((PUSH.dropAt + k * gap) * PUSH.hz));
  for (let s = 0; s < steps; s++) {
    const t = (s + 1) * dt, bar = pushBar(c, t, ph);
    for (let k = 0; k < drops.length; k++) if (dropStep[k] === s) {
      const x = Math.max(r, Math.min(1 - r, drops[k][0] / PUSH.Q)), st = drops[k][1] ? 1 : 0;
      list.push({ x, y: bar + r + 0.004, vx: 0, vy: 0, id: nextId++, st });
      ev.push({ t: Math.round(t * 1000), kind: 'drop', x: Math.round(x * 1000) / 1000, st });
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
          let ax = dx * push, ay = dy * push;
          // (against the bar a coin cannot give way backwards: the other takes the whole push)
          if (a.y <= bar + r + 1e-9 && ay > 0) { b.x += ax; b.y += 2 * ay; a.x -= ax; continue; }
          if (b.y <= bar + r + 1e-9 && ay < 0) { a.x -= ax; a.y -= 2 * ay; b.x += ax; continue; }
          a.x -= ax; a.y -= ay; b.x += ax; b.y += ay;
        }
      }
    }
    const keep = [];
    list.forEach((o, i) => {
      o.vx = (o.x - px[i]) / dt * fr; o.vy = (o.y - py[i]) / dt * fr;   // (the shelf's friction: what a push leaves of a coin's speed)
      if (o.y > 1) { scored++; pts += pushWorth(c, o.st); ev.push({ t: Math.round(t * 1000), kind: 'off', x: Math.round(o.x * 1000) / 1000, st: o.st }); }
      else if (o.y >= PUSH.gut && (o.x < 0 || o.x > 1)) { lost++; ev.push({ t: Math.round(t * 1000), kind: 'lost', x: Math.round(o.x * 1000) / 1000, st: o.st }); }
      else keep.push(o);
    });
    list = keep;
    if (out) out.push(list.map(o => [o.x, o.y, o.st]));
  }
  const rest = list.map(o => [Math.round(o.x * PUSH.Q), Math.round(o.y * PUSH.Q)].concat(o.st ? [1] : []));
  rest.sort((a, b) => a[1] - b[1] || a[0] - b[0]);                       // (a fixed order for the next move: back to front)
  return { coins: rest, scored, pts, lost, frames: out, events: ev, ms: Math.round(SECS(c) * 1000) };
}
// A move: the slots, each a whole number 0..slots-1, `perMove` of them.
export function pushMove(c, m) {
  const s = m && typeof m === 'object' && Array.isArray(m.s) ? m.s : null, n = Math.max(1, c.perMove | 0);
  if (!s || s.length !== n || !s.every(v => Number.isInteger(v) && v >= 0 && v < PUSH.slots)) return null;
  return s.slice();
}
export function apply(mini, p, m, rng, idx) {
  const c = pushCfg(mini), r = needRng(rng);
  let slots = m === 'auto' ? Array.from({ length: Math.max(1, c.perMove | 0) }, () => randInt(r, PUSH.slots)) : pushMove(c, m);
  if (!slots) return { ok: false, reason: 'bad' };
  const from = mini.coins[p].map(a => a.slice()), drops = pushDrops(c, slots, r), ph = Math.floor(r() * 100) / 100, res = pushSim(c, from, drops, false, ph);
  const before = mini.score[p], o = p === 'X' ? 'O' : 'X';
  if (!mini.turns) mini.turns = { X: mini.moves.X, O: mini.moves.O };
  if (!mini.last || mini.last.by !== p) mini.turns[p] += 1;          // (a turn: the first move of it; "Go again on success" adds moves, not turns)
  mini.coins[p] = res.coins; mini.score[p] = before + res.pts; mini.moves[p] += 1;
  mini.last = { by: p, slots, drops, ph, from, scored: res.scored, pts: res.pts, lost: res.lost, before, after: mini.score[p], ms: res.ms };
  // The end: once a player reaches the target, the other plays out the same number of turns (the last turn of the round);
  // then the higher total wins, and level totals are a draw (the square resets).
  const settle = () => (mini.score.X === mini.score.O ? { ok: true, outcome: 'draw', note: 'tie' } : { ok: true, outcome: 'win', winner: mini.score.X > mini.score.O ? 'X' : 'O', note: 'most' });
  if (mini.final && mini.final.by !== p) { mini.final = null; return settle(); }   // the other side's matching turn: done
  if (!mini.final && mini.score[p] >= c.target) {
    if (mini.turns[p] > mini.turns[o]) { mini.final = { by: p }; return { ok: true, outcome: 'continue', note: 'reached' }; }   // the other gets their turn to match
    return settle();
  }
  if (!mini.final && res.scored > 0 && goAgain(mini)) return { ok: true, outcome: 'continue', note: 'scored', again: true };   // ("Go again on success" on: a coin over the edge keeps the turn)
  return { ok: true, outcome: 'continue', note: res.scored > 0 ? 'scored' : 'none' };
}
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }   // (nothing hidden: both machines are on show)
export function randomMove(mini, p, rng) {
  const c = pushCfg(mini), r = needRng(rng);
  return { s: Array.from({ length: Math.max(1, c.perMove | 0) }, () => randInt(r, PUSH.slots)) };
}
export function canMove(mini) { return true; }
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.push = { by: p, slots: l.slots.slice(), drops: l.drops.map(d => d.slice()), ph: l.ph, pts: l.pts, from: l.from.map(a => a.slice()), scored: l.scored, lost: l.lost, before: l.before, after: l.after, ms: l.ms, score: { X: mini.score.X, O: mini.score.O } };
}
export function flashMs(f, winLen, won) { return (f.push ? f.push.ms : 3000) + PUSH.hold + (won ? 600 : 0); }
