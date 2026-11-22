// Glass Bridge: the rules (pure: no page, no clock; the server runs the same code).
// A bridge of rows of glass platforms (`mini.n`: how many in each row), some weak (`mini.bad`: hidden, the server's
// alone online, `secret`/`hide`). A move is one hop onto a platform of the row after the one the player stands on
// (`at[p]`, -1 the near bank): safe glass holds (`seen` 1), the player is on that row and hops again (`again`); weak
// glass breaks for good (`seen` 2), the turn ends and the player goes back to the near bank (v 2, December 2026: they
// start their next turn from the beginning; a square from before, v 1, leaves them where they were). Every row keeps at least one
// safe platform, so a player can always get across alone. The first to land on the last row is across and wins.
// Shared (the default): one bridge, what either player finds out shows for both. Separate (`sep`): a bridge each with
// the same rows (as many platforms and as many weak ones in each), the weak ones placed apart for each player: the
// same layout would hand the second player everything the first found out.
import { needRng, randInt, shuffle } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';

export const BRIDGE = { hop: 520, crouch: 0.22, crack: 240, drop: 420, back: 320, land: 140 };   // a move's moments (ms): the jump (a crouch, the leap, the landing: `crouch` its share of `hop`); a break: the crack, the fall, back to the start
const lay = (n, b, r) => n.map((k, i) => shuffle(Array.from({ length: k }, (_, j) => j), r).slice(0, b[i]).sort());
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), lo = Math.min(t.pmin, t.pmax), hi = Math.max(t.pmin, t.pmax), blo = Math.min(t.bmin, t.bmax), bhi = Math.max(t.bmin, t.bmax);
  const n = Array.from({ length: t.rows }, () => lo + randInt(r, hi - lo + 1)), b = n.map(k => Math.min(k - 1, blo + randInt(r, bhi - blo + 1)));
  const sep = t.boards === 'separate', blank = () => n.map(k => new Array(k).fill(0));
  return { type, v: 2, sep, n, bad: sep ? { X: lay(n, b, r), O: lay(n, b, r) } : lay(n, b, r), seen: sep ? { X: blank(), O: blank() } : blank(), at: { X: -1, O: -1 }, pos: { X: -1, O: -1 }, falls: { X: 0, O: 0 }, last: null };
}
export const bridgeSeen = (mini, p) => (mini.sep ? mini.seen[p] : mini.seen);
export function apply(mini, p, m, rng, idx) {
  const r = mini.at[p] + 1, seen = bridgeSeen(mini, p);
  if (r >= mini.n.length || !idx(mini.n[r])) return { ok: false, reason: 'bad' };
  if (seen[r][m] === 2) return { ok: false, reason: 'gone' };
  const bad = mini.sep ? mini.bad && mini.bad[p] : mini.bad;
  if (!bad || !bad[r]) return { ok: false, reason: 'secret' };
  const from = mini.pos[p];
  if (bad[r].includes(m)) {
    seen[r][m] = 2; mini.falls[p]++;
    mini.last = { by: p, r, i: m, fall: true, from };
    if (mini.v >= 2) { mini.at[p] = -1; mini.pos[p] = -1; mini.last.home = true; }   // back to the start: the next turn begins at the near bank
    return { ok: true, outcome: 'continue', note: 'fall' };
  }
  seen[r][m] = 1; mini.at[p] = r; mini.pos[p] = m;
  mini.last = { by: p, r, i: m, fall: false, from };
  if (r === mini.n.length - 1) return { ok: true, outcome: 'win', note: 'across' };
  return { ok: true, outcome: 'continue', note: 'hop', again: true };
}
export function timeoutClose(mini, p) { return null; }             // (a hop owed is simply not taken: the player stays on their row)
const copySeen = s => (Array.isArray(s) ? s.map(r => r.slice()) : { X: s.X.map(r => r.slice()), O: s.O.map(r => r.slice()) });
export function publicView(mini) {                                // never where the weak glass is
  return { type: 'bridge', v: mini.v, sep: !!mini.sep, n: mini.n.slice(), seen: copySeen(mini.seen), at: { X: mini.at.X, O: mini.at.O }, pos: { X: mini.pos.X, O: mini.pos.O }, falls: { X: mini.falls.X, O: mini.falls.O }, last: mini.last ? Object.assign({}, mini.last) : null };
}
export function secret(mini) { return mini.bad ? { bad: JSON.parse(JSON.stringify(mini.bad)) } : null; }
export function hide(m, k, st) { delete m.bad; }
// The platforms p may hop to: those of the next row still there.
export function bridgeMoves(mini, p) { const r = mini.at[p] + 1, s = bridgeSeen(mini, p)[r]; return s ? s.map((v, i) => (v === 2 ? -1 : i)).filter(i => i >= 0) : []; }
export function randomMove(mini, p, rng, from, empties) { return from(bridgeMoves(mini, p)); }
export function moveFlash(m, p, range, bjFrom, mini, flash) { const l = mini.last; flash.gb = { r: l.r, i: l.i, fall: !!l.fall, from: l.from }; }
export const bridgeMs = fall => (fall ? BRIDGE.hop + BRIDGE.crack + BRIDGE.drop + BRIDGE.back : BRIDGE.hop + BRIDGE.land);
export function flashMs(f, winLen, won) { return bridgeMs(f.gb && f.gb.fall) + (won ? 500 : 0); }
