// Snakes and Ladders: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt } from '../../core/random.js';
import { PLAY } from '../../core/timer.js';
import { tune, tuneLive } from '../../core/tune.js';

// Snakes and Ladders: 20 spaces in 4 rows of 5, numbered from the bottom; the pieces start before space 1
// and space 20 is the top. Each board has 2 ladders and 2 snakes, each crossing rows and at least 3 long.
export const SNL = { n: 20, perRow: 5, ladders: 2, snakes: 2, minSpan: 3, die: 6 };   // (ladders, snakes, minSpan, die: the defaults of its settings, TUNE in meta.js)
const snlDie = mini => tune(mini).die || SNL.die;

// Snakes and Ladders: the row (0 at the bottom) of a space from 1 to 20.
export function snlRow(k) { return Math.floor((k - 1) / SNL.perRow); }
// A fresh board: 2 ladders (up) and 2 snakes (down) as [start, end] pairs. Every one crosses rows and
// spans at least 3 spaces; no two share an end (so none starts where another ends, and none chains);
// none starts on space 1 or touches the top space, 20.
// (c: the counts and the shortest span, the admin's settings.)
export function snlBoard(rng, c = SNL) {
  for (let tries = 0; tries < 50; tries++) {
    const used = new Set(), out = { ladders: [], snakes: [] };
    for (let k = 0; k < c.ladders + c.snakes; k++) {
      const up = k < c.ladders, opts = [];
      for (let a = 2; a < SNL.n; a++) for (let b = 1; b < SNL.n; b++) {
        if ((up ? b - a : a - b) < c.minSpan || snlRow(a) === snlRow(b) || used.has(a) || used.has(b)) continue;
        opts.push([a, b]);
      }
      if (!opts.length) break;
      const pair = opts[randInt(rng, opts.length)];
      used.add(pair[0]); used.add(pair[1]);
      (up ? out.ladders : out.snakes).push(pair);
    }
    if (out.ladders.length === c.ladders && out.snakes.length === c.snakes) return out;
  }
  if (c !== SNL) return snlBoard(rng);                                    // (settings with no room: the usual board)
  return { ladders: [[3, 8], [9, 17]], snakes: [[14, 6], [19, 12]] };   // never needed: there is always room
}
// Whether a board keeps every placement rule (the tests check every board the generator makes).
export function snlValid(b, c = SNL) {
  if (!b || !Array.isArray(b.ladders) || !Array.isArray(b.snakes) || b.ladders.length !== c.ladders || b.snakes.length !== c.snakes) return false;
  const ends = [];
  for (const [list, up] of [[b.ladders, true], [b.snakes, false]]) for (const pr of list) {
    if (!Array.isArray(pr) || pr.length !== 2 || !pr.every(Number.isInteger)) return false;
    const [a, e] = pr;
    if (a <= 1 || a >= SNL.n || e < 1 || e >= SNL.n) return false;          // nothing starts on 1, nothing touches the top
    if ((up ? e - a : a - e) < c.minSpan || snlRow(a) === snlRow(e)) return false;
    ends.push(a, e);
  }
  return new Set(ends).size === ends.length;                             // no shared ends
}
export function create(type, rng) {
  const b = snlBoard(rng, tuneLive(type)); return { type, ladders: b.ladders, snakes: b.snakes, pos: { X: 0, O: 0 }, last: null };
}
export function apply(mini, p, m, rng, idx) {
  // One roll: the piece hops that many spaces up, then climbs the ladder or slides down the snake
  // whose start it landed on. Reaching or passing space 20 wins.
  if (m !== 'roll') return { ok: false, reason: 'bad' };
  const roll = 1 + randInt(needRng(rng), snlDie(mini)), from = mini.pos[p], land = Math.min(from + roll, SNL.n);
  const ladder = mini.ladders.find(x => x[0] === land), snake = mini.snakes.find(x => x[0] === land);
  const via = land < SNL.n && ladder ? 'ladder' : land < SNL.n && snake ? 'snake' : null;
  const to = via === 'ladder' ? ladder[1] : via === 'snake' ? snake[1] : land;
  mini.pos[p] = to; mini.last = { by: p, roll, from, land, to, via };
  if (to >= SNL.n) return { ok: true, outcome: 'win' };
  return { ok: true, outcome: 'continue', note: via || 'roll' };
}
export function publicView(mini) {
  return { type: 'snakes', ladders: mini.ladders.map(x => x.slice()), snakes: mini.snakes.map(x => x.slice()), pos: { X: mini.pos.X, O: mini.pos.O } };
}
// Snakes and Ladders: expected rolls to the top from each space (0 = not on the board yet), the
// ladders and snakes included (a snake can send a piece back, so this is solved by iterating).
export function snlExpected(pm) {
  const n = SNL.n, D = snlDie(pm), E = new Array(n + 1).fill(0), jump = {};
  for (const [a, b] of pm.ladders.concat(pm.snakes)) jump[a] = b;
  for (let it = 0; it < 500; it++) {
    let diff = 0;
    for (let k = n - 1; k >= 0; k--) {
      let sum = 0;
      for (let r = 1; r <= D; r++) { const l = Math.min(k + r, n); sum += E[l < n && jump[l] != null ? jump[l] : l]; }
      const v = 1 + sum / D;
      diff = Math.max(diff, Math.abs(v - E[k])); E[k] = v;
    }
    if (diff < 1e-7) break;
  }
  return E;
}
export function randomMove(mini, p, rng, from, empties) {
  return 'roll';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  flash.roll = mini.last.roll; flash.from = mini.last.from; flash.land = mini.last.land; flash.to = mini.last.to; flash.via = mini.last.via; return;
}
export function flashMs(f, winLen, won) {
  return PLAY.die + Math.max(1, f.land - f.from) * PLAY.hop + (f.via ? PLAY.slide : 0) + 250;
}
