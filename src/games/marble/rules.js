// Marble Toss: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own score. The table is 100 wide and 120 long, seen from above, with holes in it, each worth
// points (a smaller, further hole more). A turn is `marbles` flicks, one a move (`{ a, p }`: shared/flick.js; the turn
// is held between them, `again`): the marble is aimed `MARB.near` to `MARB.far` up the table by its power, along its
// angle, and lands there give or take the table's spread (the move's rng: the server's online). In a hole: its
// points. Anywhere else, or off the table: nothing. First to the target takes the square. A turn left unfinished
// when its time runs out ends there ('end', timeoutClose).
import { gaussOf, needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';
import { flickOk } from '../shared/flick.js';

export const MARB = { w: 100, h: 120, from: [50, 111], near: 18, far: 108, roll: 620, drop: 240, hold: 380, r: 3.4 };   // (roll: the marble's way up the table, ms; drop: into the hole; r: the marble)
// The layouts: holes as [x, y, class] (class 0 the big near ones, 1 the middle, 2 the small far ones).
export const LAYOUTS = {
  classic: [[50, 80, 0], [27, 59, 1], [73, 59, 1], [50, 40, 2], [22, 24, 2], [78, 24, 2]],
  ladder: [[50, 89, 0], [50, 65, 0], [50, 44, 1], [50, 25, 1], [50, 9, 2]],
  corners: [[50, 62, 0], [23, 78, 1], [77, 78, 1], [22, 26, 2], [78, 26, 2]],
};
const RAD = [11, 8.5, 6.5];
export function marbleCfg(mini) { const t = tune(mini); return { target: t.target, marbles: t.marbles, spread: t.spread, ai: { easy: t.aiErrEasy, normal: t.aiErr, hard: t.aiErrHard }, t }; }
export function create(type, rng) {
  const t = tuneLive(type), lay = LAYOUTS[t.layout] ? t.layout : 'classic', vals = [t.v1, t.v2, t.v3];
  return { type, lay, holes: LAYOUTS[lay].map(([x, y, k]) => ({ x, y, r: Math.round(RAD[k] * t.hole) / 100, v: vals[k] })), score: { X: 0, O: 0 }, run: null, n: { X: 0, O: 0 }, last: null };
}
// Where a flick is aimed, and the flick that is aimed at a point (the computer's, the tests').
export const marbleAim = m => { const d = MARB.near + (MARB.far - MARB.near) * m.p; return [MARB.from[0] + Math.sin(m.a) * d, MARB.from[1] - Math.cos(m.a) * d]; };
export function marbleFlickAt(x, y) {
  const dx = x - MARB.from[0], dy = MARB.from[1] - y, r3 = v => Math.round(v * 1000) / 1000 + 0;
  return { a: r3(Math.max(-0.75, Math.min(0.75, Math.atan2(dx, Math.max(0.001, dy))))), p: r3(Math.max(0, Math.min(1, (Math.hypot(dx, dy) - MARB.near) / (MARB.far - MARB.near)))) };
}
export function apply(mini, p, m, rng, idx) {
  const c = marbleCfg(mini), mine = mini.run && mini.run.by === p;
  if (m === 'end') { if (!mine) return { ok: false, reason: 'norun' }; mini.run = null; return { ok: true, outcome: 'continue', note: 'end' }; }
  if (!flickOk(m)) return { ok: false, reason: 'bad' };
  const r = needRng(rng), [ax, ay] = marbleAim(m), x = Math.round((ax + gaussOf(r) * c.spread) * 10) / 10, y = Math.round((ay + gaussOf(r) * c.spread) * 10) / 10;
  const hole = mini.holes.findIndex(h => Math.hypot(h.x - x, h.y - y) <= h.r), off = hole < 0 && (x < 0 || x > MARB.w || y < 0 || y > MARB.h);
  const left = (mine ? mini.run.left : c.marbles) - 1, k = c.marbles - left, from = mini.score[p], pts = hole >= 0 ? mini.holes[hole].v : 0;
  mini.score[p] = Math.min(c.target, from + pts); mini.n[p]++;
  mini.last = { by: p, a: m.a, p: m.p, x, y, hole, off, pts, from, to: mini.score[p], left, k };
  if (mini.score[p] >= c.target) { mini.run = null; return { ok: true, outcome: 'win', note: 'won' }; }
  mini.run = left > 0 ? { by: p, left } : null;
  return { ok: true, outcome: 'continue', note: hole >= 0 ? 'in' : 'miss', again: left > 0 };
}
export function timeoutClose(mini, p) { return mini.run && mini.run.by === p ? 'end' : null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) { const h = from(mini.holes), r = needRng(rng); return marbleFlickAt(h.x + (r() - 0.5) * 10, h.y + (r() - 0.5) * 10); }
export function moveFlash(m, p, range, bjFrom, mini, flash) { if (m !== 'end') flash.mb = JSON.parse(JSON.stringify(mini.last)); }
export function flashMs(f, winLen, won) { return f.mb ? MARB.roll + MARB.drop + MARB.hold + (won ? 500 : 0) : 0; }
