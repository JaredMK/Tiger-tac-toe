// Shell Game: the rules (pure: no page, no clock; the server runs the same code).
// An attention game (games/shared/attention.js: each player's own progress, Start holds the player to the square, a
// round is the server's until Start): a ball goes under one of the cups, the cups shuffle, the player picks a cup.
// Right: a level on. Wrong: the level kept. `levels` right picks (3) win the square; each level has its own cups and
// its own shuffle (meta.js TUNE). The shuffle is the game: every swap is one continuous slide along an arc on the
// table (one cup round the front, the other round the back), cups never change their looks and never jump, so the
// ball's cup can always be followed. What makes it hard is how fast the cups travel, how many swaps there are,
// swaps running at the same time, swaps between cups that are not neighbours, a pair swapping straight back and the
// tempo rising through the shuffle. A round is drawn with its own seed for its player (shellRound) and is its
// values alone: shellPlan(round) gives the same swaps, the same moments and the same end on every phone and the
// server, so a round replays exactly.
import { makeRng, randInt } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';
import { SHELL_MAX } from './meta.js';
export { attentionCreate as create, attentionApply as apply, attentionMoveFlash as moveFlash, attentionFlashMs as flashMs } from '../shared/attention.js';
export { attentionHide as hide, attentionSecret as secret } from '../shared/attention.js';   // online: a round is the server's until its Start

// The round's own moments (ms; a cup's lift and its coming down are inside the level's "ball on show" time):
//   lift, drop: the ball's cup going up at the start and coming down over the ball; beat: the still moment before the
//   first swap; gap: the pause between two steps, as a share of the step before (the motion never stops for long);
//   settle: after the last swap, before a cup can be picked.
// The shuffle's make-up: follow: how much likelier a swap with the ball's cup is than any other (the ball keeps moving,
//   but not every swap is its); back: the chance a step is the last pair swapping straight back; both: the chance an
//   extra swap runs at the same time, where the level allows one and there is room; farSlow: how much longer a swap
//   takes for each place further its cups go; span: the furthest a cup swaps (places).
// The picture's own (the view and the tests read them here): arc: how far a cup swings off the row at the middle of
//   a swap, in cup heights, for neighbours (arcFar: more for each place further), so the cup going round the back shows
//   over the one in front; tense: from a pick to the cup lifting; open: the lift itself.
export const SHELL = { lift: 240, drop: 280, beat: 260, gap: 0.06, settle: 220, follow: 2.6, back: 0.2, both: 0.6, farSlow: 0.25, span: 3, arc: 0.44, arcFar: 0.36, tense: 720, open: 300, answerMs: 10000 };

const clampInt = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
// The levels a square plays (its settings: core/tune.js), and one level's values.
export const shellLevels = t => clampInt(t && t.levels, 1, SHELL_MAX, 3);
export function shellLevel(t, level) {
  const n = Math.min(SHELL_MAX, Math.max(1, level + 1)), d = tuneLive('shell'), g = k => (t && t[k + n] != null ? t[k + n] : d[k + n]);
  return { n: clampInt(g('c'), 2, 7, 3), ms: clampInt(g('ms'), 80, 1200, 300), k: clampInt(g('sw'), 1, 40, 6), pairs: clampInt(g('pr'), 0, 2, 0), far: g('far') === 'yes' ? 1 : 0, ramp: clampInt(g('rp'), 0, 150, 0), show: clampInt(g('sh'), 400, 5000, 1200) };
}
// A round for a player at a level: where the ball starts, the seed of its shuffle, and the level's values (the round
// carries them, so it plays the same whatever the settings become).
export function shellRound(level, rng, t) {
  const L = shellLevel(t, level);
  return { level, n: L.n, ball: randInt(rng, L.n), seed: randInt(rng, 2147483647), ms: L.ms, k: L.k, pairs: L.pairs, far: L.far, ramp: L.ramp, show: L.show };
}
export const shellOk = r => !!r && !r.hidden && Number.isInteger(r.n) && r.n >= 2 && r.n <= 7 && Number.isInteger(r.ball) && r.ball >= 0 && r.ball < r.n && Number.isFinite(r.ms) && Number.isFinite(r.k) && Number.isFinite(r.show);

// The shuffle, worked out from the round alone:
//   steps: [{ t0, d, sw: [[a, b, front], ...] }]: at t0 (ms into the round) the cups at places a < b swap over d ms;
//          front 1: the one from a goes round the front (the other round the back), 0: the other way;
//   t0: when the first swap starts (the ball shown and covered, then a beat); end: when the last has landed;
//   ms: the whole round (with the settle); at[cup]: the place each cup ends at (a cup is named by where it began);
//   ballAt: where the ball's cup ends: the right answer.
// Swaps in one step never share a cup and never reach across each other (each pair's places lie apart), so no two
// moving cups ever meet; a swap between cups that are not neighbours passes the cups between on its arcs, further out.
const PLANS = new Map();
export function shellPlan(r) {
  const key = [r.n, r.ball, r.seed, r.ms, r.k, r.pairs, r.far, r.ramp, r.show].join('|');
  const had = PLANS.get(key);
  if (had) return had;
  const rng = makeRng('shell:' + key), n = r.n, steps = [], order = Array.from({ length: n }, (_, i) => i);   // order[place] = cup
  const span = r.far ? Math.min(SHELL.span, n - 1) : 1;
  const all = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b <= Math.min(n - 1, a + span); b++) all.push([a, b]);
  let ball = r.ball, t = r.show + SHELL.beat, prev = null;
  const pickOf = (cands, weight) => { let sum = 0; const w = cands.map(c => { const x = weight(c); sum += x; return x; }); let x = rng() * sum; for (let i = 0; i < cands.length; i++) { x -= w[i]; if (x < 0) return cands[i]; } return cands[cands.length - 1]; };
  for (let i = 0; i < r.k; i++) {
    const base = r.ms / (1 + (r.ramp / 100) * (r.k > 1 ? i / (r.k - 1) : 0));
    let main;
    if (prev && rng() < SHELL.back) main = prev;                  // the same two places again: straight back
    else {
      const cands = all.filter(c => !prev || c[0] !== prev[0] || c[1] !== prev[1]);
      main = pickOf(cands.length ? cands : all, c => (c[0] === ball || c[1] === ball ? SHELL.follow : 1) / (c[1] - c[0]));   // (a far swap is rarer the further it goes)
    }
    const sw = [[main[0], main[1], rng() < 0.5 ? 1 : 0]];
    for (let e = 0; e < r.pairs; e++) {
      if (rng() >= SHELL.both) continue;
      const free = all.filter(c => sw.every(s => c[1] < s[0] || c[0] > s[1]));   // wholly to one side of every swap of the step
      if (!free.length) break;
      const x = pickOf(free, c => 1 / (c[1] - c[0]));
      sw.push([x[0], x[1], rng() < 0.5 ? 1 : 0]);
    }
    const reach = Math.max(...sw.map(s => s[1] - s[0])), d = Math.round(base * (1 + SHELL.farSlow * (reach - 1)));
    steps.push({ t0: Math.round(t), d, sw });
    for (const [a, b] of sw) { const x = order[a]; order[a] = order[b]; order[b] = x; if (ball === a) ball = b; else if (ball === b) ball = a; }
    t += d + (i < r.k - 1 ? Math.round(d * SHELL.gap) : 0);
    prev = main;
  }
  const at = new Array(n);
  order.forEach((cup, place) => { at[cup] = place; });
  const plan = { steps, t0: r.show + SHELL.beat, end: Math.round(t), ms: Math.round(t) + SHELL.settle, at, ballAt: ball };
  if (PLANS.size > 60) PLANS.delete(PLANS.keys().next().value);
  PLANS.set(key, plan);
  return plan;
}
export const shellMs = r => (shellOk(r) ? shellPlan(r).ms : 0);
export const shellTruth = r => shellPlan(r).ballAt;
// A slide's place along its way (0 to 1): slow out, slow in.
export const shellEase = u => (u <= 0 ? 0 : u >= 1 ? 1 : (1 - Math.cos(Math.PI * u)) / 2);
// How far a swap of that reach swings off the row at its middle, in cup heights.
export const shellArc = reach => SHELL.arc + SHELL.arcFar * (reach - 1);
// Every cup at t ms into the round: [{ x, z, v, u }] by cup: x its place along the row (0 to n - 1, between two while it
// slides), z how far off the row it has swung (cup heights: more than 0 towards the player, in front; less, behind),
// v its speed along the row (places a second, less than 0 going left: the view's lean and streaks), u how far through
// its slide it is (0: standing). Continuous in t: no cup ever jumps.
export function shellAt(r, t) {
  const plan = shellPlan(r), n = r.n, order = Array.from({ length: n }, (_, i) => i), out = new Array(n);
  let moving = null;
  for (const s of plan.steps) {
    if (t < s.t0) break;
    if (t < s.t0 + s.d) { moving = s; break; }
    for (const [a, b] of s.sw) { const x = order[a]; order[a] = order[b]; order[b] = x; }
  }
  order.forEach((cup, place) => { out[cup] = { x: place, z: 0, v: 0, u: 0 }; });
  if (moving) {
    const u = (t - moving.t0) / moving.d, e = shellEase(u), sn = Math.sin(Math.PI * u), sp = (Math.PI / 2) * Math.sin(Math.PI * u) / (moving.d / 1000);
    for (const [a, b, front] of moving.sw) {
      const reach = b - a, amp = shellArc(reach) * sn, ca = order[a], cb = order[b];
      out[ca] = { x: a + reach * e, z: front ? amp : -amp, v: reach * sp, u };
      out[cb] = { x: b - reach * e, z: front ? -amp : amp, v: -reach * sp, u };
    }
  }
  return out;
}
// The ball's cup on show at the start: how high it is lifted (0 down, 1 up) at t.
export function shellLift(r, t) {
  if (t <= 0) return 0;
  if (t < SHELL.lift) return shellEase(t / SHELL.lift);
  const down = r.show - SHELL.drop;
  if (t < down) return 1;
  if (t < r.show) return 1 - shellEase((t - down) / SHELL.drop);
  return 0;
}
// A wrong pick for the computer: the place of the cup the ball's cup last swapped with (the slip a person makes),
// else any other place.
export function shellWrong(r, rng) {
  const plan = shellPlan(r);
  let ball = r.ball, other = null;
  for (const s of plan.steps) for (const [a, b] of s.sw) { if (ball === a) { ball = b; other = a; } else if (ball === b) { ball = a; other = b; } else if (other === a) other = b; else if (other === b) other = a; }
  if (other != null && other !== plan.ballAt && rng() < 0.7) return other;
  let w = randInt(rng, r.n - 1); if (w >= plan.ballAt) w++;
  return w;
}
export function publicView(mini) {
  return { type: mini.type, right: { X: mini.right.X, O: mini.right.O }, round: JSON.parse(JSON.stringify(mini.round)) };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';   // counts as wrong
}
// A round begun when the time runs out: a failed one. Held to the square after a right pick with "Go again" on, the next
// round not begun: nothing more is played (core/board.js timeoutClose).
export function timeoutClose(mini, p) {
  return mini.started && mini.started[p] != null ? 'auto' : null;
}
