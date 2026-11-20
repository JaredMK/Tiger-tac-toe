// Fruit Slice: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own score. A move is one round of `secs` seconds played on the mover's phone: fruit is thrown up
// across the field (100 wide, 120 tall) and falls back, bombs among it, and a swipe through a fruit slices it. The
// round's throws are the same wherever they are worked out (`sliceRound`: from the square's public seed, the player
// and the number of their round). The move is what was sliced, `{ hit: [the throws' numbers] }`: a fruit is a point;
// a bomb ends the round there and costs `bombCost` of its points. The round's points add to the score; first to the
// target takes the square. What was sliced is the phone's word (the server cannot watch a finger), so the game is
// held out of Find Match (core/games.js FIND_MATCH_HOLD).
import { makeRng, needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

export const SLICE = { w: 100, h: 120, fr: 8, br: 7, kinds: 5, air: 1900, lead: 400, tail: 350, boom: 650, show: 110, pre: 350, hold: 650 };   // (fr, br: a fruit's and a bomb's size; air: a throw's time in the air at speed 100, ms; show: each sliced fruit landing on the result's tray)
export function sliceCfg(mini) { const t = tune(mini); return { target: t.target, secs: t.secs, fruits: t.fruits, bombs: Math.round(t.fruits * t.bombRate / 100), speed: t.speed / 100, cost: t.bombCost, ai: { easy: [t.aiHitEasy, t.aiBombEasy], normal: [t.aiHit, t.aiBomb], hard: [t.aiHitHard, t.aiBombHard] } }; }
export function create(type, rng) { return { type, seed: Math.floor(needRng(rng)() * 1e9), score: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }; }
// A round's throws, in the order thrown: { t (ms from the round's start), x0, vx (units a ms), h (how high it rises), d (ms in the air), k (the fruit's kind, -1 a bomb) }.
export function sliceRound(mini, p) {
  const c = sliceCfg(mini), r = makeRng(`slice:${mini.seed}:${p}:${mini.n[p]}`), n = c.fruits + c.bombs, air = SLICE.air / c.speed, T = c.secs * 1000;
  const span = Math.max(500, T - air * 1.1 - SLICE.lead - SLICE.tail), items = [];
  for (let i = 0; i < n; i++) {
    const x0 = 14 + r() * 72, d = Math.round(air * (0.9 + r() * 0.2));
    items.push({ t: Math.round(SLICE.lead + span * (i + r() * 0.8) / n), x0: Math.round(x0 * 10) / 10, vx: Math.round((50 - x0) / d * (0.2 + r()) * 1e5) / 1e5, h: Math.round(60 + r() * 45), d, k: Math.floor(r() * SLICE.kinds) });
  }
  for (let b = 0, tries = 0; b < c.bombs && tries < 200; tries++) { const i = 1 + Math.floor(r() * (n - 1)); if (items[i] && items[i].k >= 0) { items[i].k = -1; b++; } }
  return items;
}
// Where a throw is at `ms` into the round: [x, y] (y down the field from its top), or null when it is not in the air.
export function sliceAt(it, ms) { const u = (ms - it.t) / it.d; return u < 0 || u > 1 ? null : [it.x0 + it.vx * (ms - it.t), SLICE.h + 10 - (it.h + 10) * 4 * u * (1 - u)]; }
// What a set of sliced throws is worth: the fruit sliced before the first bomb (in the order thrown), less the bomb's cost.
export function sliceScore(c, items, hit) {
  const set = new Set(hit); let fr = 0, bomb = -1; const got = [];
  for (let i = 0; i < items.length && bomb < 0; i++) if (set.has(i)) { if (items[i].k < 0) bomb = i; else { fr++; got.push(items[i].k); } }
  return { fr, bomb, got, pts: Math.max(0, fr - (bomb >= 0 ? c.cost : 0)) };
}
export function apply(mini, p, m, rng, idx) {
  const c = sliceCfg(mini), items = sliceRound(mini, p);
  if (!m || typeof m !== 'object' || !Array.isArray(m.hit) || m.hit.length > items.length || m.hit.some(i => !Number.isInteger(i) || i < 0 || i >= items.length) || new Set(m.hit).size !== m.hit.length) return { ok: false, reason: 'bad' };
  const s = sliceScore(c, items, m.hit), from = mini.score[p];
  mini.score[p] = Math.min(c.target, from + s.pts); mini.n[p]++;
  mini.last = { by: p, fr: s.fr, got: s.got, bomb: s.bomb >= 0, pts: s.pts, of: items.filter(it => it.k >= 0).length, from, to: mini.score[p] };
  if (mini.score[p] >= c.target) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: s.bomb >= 0 ? 'bomb' : 'round' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) { const r = needRng(rng); return { hit: sliceRound(mini, p).map((it, i) => (it.k >= 0 && r() < 0.6 ? i : -1)).filter(i => i >= 0) }; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.fs = JSON.parse(JSON.stringify(mini.last)); }
export const sliceShowMs = l => SLICE.pre + l.fr * SLICE.show + (l.bomb ? SLICE.boom : 0) + 250;   // someone else's round, as its result is laid out
export function flashMs(f, winLen, won) { return f.fs ? sliceShowMs(f.fs) + SLICE.hold + (won ? 500 : 0) : 0; }
