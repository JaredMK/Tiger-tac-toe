// Door Drop: the rules (pure: no page, no clock; the server runs the same code).
// A tower of `mini.f` floors with doors (`mini.d[r]`: how many on floor r, the top floor 0), the ground below the last.
// On each floor one door leads down a floor (`mini.good[r]`: hidden, the server's alone online, `secret`/`hide`); the
// rest are dead ends: the runner goes in and pops out of another door of the same floor (`last.out`, drawn with the
// move's rng: the server's online), no further on. A move is one door of the floor the player stands on (`at[p]`, 0 the
// top; `pos[p]` where they stand across it, in hundredths of the tower's width). A dead end is marked (1) and ends
// the turn; the way down is marked (2), the player drops to the floor below and the turn ends too (with "Go again on
// success" on, the player picks again). The first to drop out of the last floor
// onto the ground wins. A door already marked a dead end cannot be tried again.
// Separate towers (the default, the race): a tower each, both built the same (the same way down on every floor, as the
// owner asked), each with its own marks. Every move is public (the record, the replays), so the other tower's marks
// are on show: a player can follow the other's way down. Shared: one tower with both runners, every door either has
// tried marked for both.
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tuneLive } from '../../core/tune.js';

// A move's moments (ms): the walk to the door, the door swinging open, the dark (the runner inside), then either the
// pop out of another door (a dead end: `out`, the door there opening and the runner tumbling out, `pop`) or the drop
// through the floor (`drop`) and the landing a floor down (`land`); the ground's win pose (`win`).
export const DOORS = { walk: 320, open: 220, dark: 380, out: 220, pop: 300, drop: 520, land: 200, win: 700 };
export const doorsIn = () => DOORS.walk + DOORS.open;                  // the runner is through the door
export const doorsDeadMs = () => doorsIn() + DOORS.dark + DOORS.out + DOORS.pop;
export const doorsDownMs = () => doorsIn() + DOORS.dark + DOORS.drop + DOORS.land;
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), lo = Math.min(t.dmin, t.dmax), hi = Math.max(t.dmin, t.dmax);
  const d = Array.from({ length: t.floors }, () => lo + randInt(r, hi - lo + 1)), good = d.map(k => randInt(r, k));
  const sep = t.towers !== 'shared', blank = () => d.map(k => new Array(k).fill(0));
  return { type, v: 1, sep, f: t.floors, d, good, tried: sep ? { X: blank(), O: blank() } : blank(), at: { X: 0, O: 0 }, pos: { X: 50, O: 50 }, last: null };
}
// Where a door stands across the tower (in hundredths of its width: the runners' places, `pos`, are kept so).
export const doorX = (k, i) => Math.round((100 * (i + 0.5)) / k);
export const doorsTried = (mini, p) => (mini.sep ? mini.tried[p] : mini.tried);
export function apply(mini, p, m, rng, idx) {
  const r = mini.at[p], tr = doorsTried(mini, p);
  if (r >= mini.f || !idx(mini.d[r])) return { ok: false, reason: 'bad' };
  if (tr[r][m] === 1) return { ok: false, reason: 'tried' };
  if (!mini.good || mini.good[r] == null) return { ok: false, reason: 'secret' };
  const from = mini.pos[p];
  if (m === mini.good[r]) {
    tr[r][m] = 2; mini.at[p] = r + 1; mini.pos[p] = doorX(mini.d[r], m);
    mini.last = { by: p, r, i: m, down: true, from };
    if (r + 1 >= mini.f) return { ok: true, outcome: 'win', note: 'ground' };
    return goAgain(mini) ? { ok: true, outcome: 'continue', note: 'down', again: true } : { ok: true, outcome: 'continue', note: 'down' };
  }
  tr[r][m] = 1;
  const others = Array.from({ length: mini.d[r] }, (_, k) => k).filter(k => k !== m), out = others[randInt(needRng(rng), others.length)];
  mini.pos[p] = doorX(mini.d[r], out); mini.last = { by: p, r, i: m, down: false, out, from };
  return { ok: true, outcome: 'continue', note: 'dead' };
}
export function timeoutClose(mini, p) { return null; }             // (a door owed after a way down is simply not taken)
const copy = t => (Array.isArray(t) ? t.map(r => r.slice()) : { X: t.X.map(r => r.slice()), O: t.O.map(r => r.slice()) });
export function publicView(mini) {                                // never the ways down not yet found
  return { type: 'doors', v: mini.v, sep: !!mini.sep, f: mini.f, d: mini.d.slice(), tried: copy(mini.tried), at: { X: mini.at.X, O: mini.at.O }, pos: { X: mini.pos.X, O: mini.pos.O }, last: mini.last ? Object.assign({}, mini.last) : null };
}
export function secret(mini) { return mini.good ? { good: mini.good.slice() } : null; }
export function hide(m, k, st) { delete m.good; }
// The doors p may try: those of their floor not marked a dead end.
export function doorsMoves(mini, p) { const r = mini.at[p], t = doorsTried(mini, p)[r]; return t ? t.map((v, i) => (v === 1 ? -1 : i)).filter(i => i >= 0) : []; }
// What a player can see of floor r: their own marks, and (separate towers, built the same) the other tower's.
export function doorsKnown(mini, p, r) {
  const own = (doorsTried(mini, p)[r] || []).slice();
  if (!mini.sep) return own;
  const o = mini.tried[p === 'X' ? 'O' : 'X'][r] || [];
  return own.map((v, i) => (v === 2 || o[i] === 2 ? 2 : v || o[i] || 0));
}
export function randomMove(mini, p, rng, from, empties) { return from(doorsMoves(mini, p)); }
export function moveFlash(m, p, range, bjFrom, mini, flash) { const l = mini.last; flash.dd = { r: l.r, i: l.i, down: !!l.down, out: l.down ? -1 : l.out, from: l.from }; }
export function flashMs(f, winLen, won) { return !f.dd ? 300 : f.dd.down ? doorsDownMs() + (won ? DOORS.win : 0) : doorsDeadMs(); }
