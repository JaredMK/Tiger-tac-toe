// Darts Cricket: the rules (pure: no page, no clock; the server runs the same code).
// The board hangs on a wall 100 by 100: a bullseye in the middle and a ring of wedges round it, every other wedge a
// number in play (`nums`, drawn per square from 15 to 20), the wedges between them dead. Each player their own marks
// on every number and on the bullseye (`marks[p]`: one count a number, the bullseye last). A move is one dart thrown
// Bullseye's way: the two lines stopped, `{ x, y }` as shares of the wall, and the dart lands where they cross (the
// phone's word, as Bullseye's: the server cannot time a tap, so the game is held out of Find Match, core/games.js
// FIND_MATCH_HOLD, until the owner allows it as they did Bullseye). A number's wedge is one mark, its outer band two (while
// doubles are on); the bullseye one, its heart two. `hits` marks close a number. First to close every number and the
// bullseye takes the square.
// Scoring (`scoring`, off by default): a mark on a number the thrower has closed and the other player has not is a
// point; closing everything wins only with at least as many points as the other player (behind: keep scoring; both
// with everything closed: the more points).
import { needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const CRK = { c: [50, 50], R: 42, lo: 4, hi: 96, fly: 420, stick: 260, hold: 480, ax: 320, ay: 320 };   // (fly: the dart's flight, ms; ax, ay: someone else's two stops shown first)
export function cricketCfg(mini) {
  const t = tune(mini);
  return { hits: t.hits, scoring: t.scoring === 'on', sweep: t.sweepMs, bull: t.bull, heart: Math.min(t.bull, t.heart), band: t.doubles === 'on' ? t.band : 0, ai: { easy: t.aiErrEasy, normal: t.aiErr, hard: t.aiErrHard } };
}
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), pool = [20, 19, 18, 17, 16, 15], nums = [];
  while (nums.length < t.numbers && pool.length) nums.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  nums.sort((a, b) => b - a);
  const zero = () => nums.map(() => 0).concat([0]);
  return { type, nums, marks: { X: zero(), O: zero() }, pts: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null };
}
// The wedge k of the 2n round the board is centred at the top for k 0 and they go clockwise; even wedges are the numbers.
export const cricketWedge = (mini, k) => { const S = mini.nums.length * 2, w = Math.PI * 2 / S; return { mid: -Math.PI / 2 + k * w, half: w / 2, num: k % 2 ? -1 : k / 2 }; };
// What a dart at (x, y) on the wall hits: { t (the number's place in `nums`, the bullseye nums.length, -1 a dead wedge, -2 off the board), n (marks) }.
export function cricketAt(mini, c, x, y) {
  const dx = x - CRK.c[0], dy = y - CRK.c[1], d = Math.hypot(dx, dy), n = mini.nums.length;
  if (c.heart > 0 && d <= c.heart) return { t: n, n: 2 };
  if (d <= c.bull) return { t: n, n: 1 };
  if (d > CRK.R) return { t: -2, n: 0 };
  const S = n * 2, w = Math.PI * 2 / S, k = ((Math.floor((Math.atan2(dy, dx) + Math.PI / 2 + w / 2) / w) % S) + S) % S;
  return k % 2 ? { t: -1, n: 0 } : { t: k / 2, n: c.band > 0 && d >= CRK.R - c.band ? 2 : 1 };
}
// The middle of a number's wedge (its inner part, or its outer band: `dbl`), and the bullseye's.
export function cricketSpot(mini, c, t, dbl) {
  if (t >= mini.nums.length) return [CRK.c[0], CRK.c[1]];
  const a = cricketWedge(mini, t * 2).mid, r = dbl && c.band > 0 ? CRK.R - c.band / 2 : (c.bull + CRK.R - c.band) / 2;
  return [CRK.c[0] + Math.cos(a) * r, CRK.c[1] + Math.sin(a) * r];
}
export const cricketOpen = (mini, c, p) => mini.marks[p].map((v, t) => (v < c.hits ? t : -1)).filter(t => t >= 0);
export function apply(mini, p, m, rng, idx) {
  if (!m || typeof m !== 'object' || typeof m.x !== 'number' || typeof m.y !== 'number' || !(m.x >= 0 && m.x <= 1 && m.y >= 0 && m.y <= 1)) return { ok: false, reason: 'bad' };
  const c = cricketCfg(mini), o = p === 'X' ? 'O' : 'X', x = Math.round(m.x * 1000) / 10, y = Math.round(m.y * 1000) / 10, h = cricketAt(mini, c, x, y);
  let add = 0, sc = 0, closed = false;
  if (h.t >= 0) {
    const was = mini.marks[p][h.t]; add = Math.min(h.n, c.hits - was); mini.marks[p][h.t] = was + add; closed = add > 0 && was + add >= c.hits;
    if (c.scoring && h.n > add && mini.marks[o][h.t] < c.hits) { sc = h.n - add; mini.pts[p] += sc; }
  }
  mini.n[p]++;
  mini.last = { by: p, x, y, t: h.t, n: h.n, add, sc, closed, marks: mini.marks[p].slice() };
  const all = q => mini.marks[q].every(v => v >= c.hits);
  if (all(p)) {
    if (!c.scoring || mini.pts[p] >= mini.pts[o]) return { ok: true, outcome: 'win', note: 'won' };
    if (all(o)) return { ok: true, outcome: 'win', winner: o, note: 'points' };
  }
  return { ok: true, outcome: 'continue', note: add || sc ? 'hit' : 'miss' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) { const r = needRng(rng), c = cricketCfg(mini), open = cricketOpen(mini, c, p), s = cricketSpot(mini, c, open.length ? from(open) : 0, false); return { x: Math.max(0, Math.min(1, (s[0] + (r() - 0.5) * 12) / 100)), y: Math.max(0, Math.min(1, (s[1] + (r() - 0.5) * 12) / 100)) }; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.ck = JSON.parse(JSON.stringify(mini.last)); }
export const cricketMs = () => CRK.ax + CRK.ay + CRK.fly;
export function flashMs(f, winLen, won) { return cricketMs() + CRK.stick + CRK.hold + (won ? 500 : 0); }
