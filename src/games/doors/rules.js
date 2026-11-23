// Door Drop: the rules (pure: no page, no clock; the server runs the same code).
// A tower of `mini.f` floors with doors (`mini.d[r]`: how many on floor r, the top floor 0; the same on every floor of
// a square dealt now, the `doors` setting), the ground below the last. On each floor exactly one door leads down a
// floor (`mini.good[r]`) and never anywhere else; every other door is a dead end, and the dead ends of a floor are
// linked to each other for the whole game (`mini.link[r][i]`: the door a runner who goes in at dead end i comes out
// of: always another dead end of the same floor, never i itself, never the way down; -1 at the way down). Both are
// dealt with the square and hidden (the server's alone online, `secret`/`hide`); a link is public only once it has
// been used (`mini.seen[r][i]`: the door that dead end is known to come out of, else -1; the move's `last.out`).
// A move is one door of the floor the player stands on (`at[p]`, 0 the top; `pos[p]` where they stand across it, in
// hundredths of the tower's width). A dead end is marked (1), the runner comes out of the door it is linked to and the
// turn ends; the way down is marked (2), the player drops to the floor below and the turn ends too (with "Go again on
// success" on, the player picks again). The first to drop out of the last floor onto the ground wins. A door already
// marked a dead end cannot be tried again (the door a runner came out of can: nobody has gone in at it).
// Separate towers (the default, the race): a tower each, both built the same (the same way down and the same links on
// every floor), each with its own marks. Every move is public (the record, the replays), so the other tower's marks
// are on show: a player can follow the other's way down. Shared: one tower with both runners, every door either has
// tried marked for both.
// A square dealt before the links (v 1: no `link`, its doors as it was dealt them) plays on under its old rule: a dead
// end's way out is drawn with the move's rng among the floor's other doors.
import { needRng, randInt } from '../../core/random.js';
import { goAgain, tuneLive } from '../../core/tune.js';

// A move's moments (ms). Someone else's move, the first of their turn, opens on the camera's intro: the whole tower(s)
// held (`wide`), then the zoom into the mover's floor (`zoom`). Then: the walk to the door (`walk`), the door swinging
// open (`open`), the step into the dark (`step`), the dark (`dark`: the runner inside); then either a dead end: the
// linked door bursting open (`out`), the runner tumbling out of it (`pop`) and the door tried boarded up (`board`); or
// the way down: a beat with its flash (`beat`), the trapdoor giving way and the fall to the floor below (`drop`), the
// landing (`land`); on the ground, the winner's dance (`win`).
export const DOORS = { wide: 520, zoom: 700, walk: 400, open: 240, step: 200, dark: 340, out: 220, pop: 460, board: 240, beat: 300, drop: 560, land: 300, win: 1100 };
export const doorsPre = () => DOORS.wide + DOORS.zoom;                 // the camera's intro
export const doorsIn = () => DOORS.walk + DOORS.open + DOORS.step;     // the runner is through the door
export const doorsDeadMs = () => doorsIn() + DOORS.dark + DOORS.out + DOORS.pop + DOORS.board;
export const doorsDownMs = () => doorsIn() + DOORS.dark + DOORS.beat + DOORS.drop + DOORS.land;
// A pick by p now would go straight on from their way down a floor above (Go again on: the same turn going on).
export const doorsCont = (mini, p) => { const l = mini.last; return !!(l && l.by === p && l.down && l.r === mini.at[p] - 1 && goAgain(mini)); };
// When a move's words are said (ms from its walk's start): as the runner lands, out of the linked door or a floor down.
export const doorsSayAt = dd => doorsIn() + DOORS.dark + (dd.down ? DOORS.beat + DOORS.drop : DOORS.out + DOORS.pop * 0.74);
// A floor's links: its dead ends (every door but the way down) each sent to another of them, a different one for each
// (a permutation with no door left in place: shuffled until none is).
export function doorsLinks(k, good, rng) {
  const dead = Array.from({ length: k }, (_, i) => i).filter(i => i !== good), to = dead.slice();
  if (dead.length < 2) return new Array(k).fill(-1);                // (a floor of one dead end: none to link it to; never dealt)
  do { for (let i = to.length - 1; i > 0; i--) { const j = randInt(rng, i + 1), t = to[i]; to[i] = to[j]; to[j] = t; } } while (to.some((v, i) => v === dead[i]));
  const link = new Array(k).fill(-1);
  dead.forEach((i, n) => { link[i] = to[n]; });
  return link;
}
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), k = Math.max(3, Math.min(6, Math.round(Number(t.doors)) || 4));
  const d = new Array(t.floors).fill(k), good = d.map(n => randInt(r, n)), link = d.map((n, i) => doorsLinks(n, good[i], r));
  const sep = t.towers !== 'shared', blank = () => d.map(n => new Array(n).fill(0));
  // (`look`: what the picture is drawn from, the doors' designs and the rooms': drawn apart from the ways down)
  return { type, v: 2, sep, f: t.floors, d, good, link, seen: d.map(n => new Array(n).fill(-1)), look: randInt(r, 100000), tried: sep ? { X: blank(), O: blank() } : blank(), at: { X: 0, O: 0 }, pos: { X: 50, O: 50 }, last: null };
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
  const c = doorsCont(mini, p);
  if (m === mini.good[r]) {
    tr[r][m] = 2; mini.at[p] = r + 1; mini.pos[p] = doorX(mini.d[r], m);
    mini.last = c ? { by: p, r, i: m, down: true, from, c: 1 } : { by: p, r, i: m, down: true, from };
    if (r + 1 >= mini.f) return { ok: true, outcome: 'win', note: 'ground' };
    return goAgain(mini) ? { ok: true, outcome: 'continue', note: 'down', again: true } : { ok: true, outcome: 'continue', note: 'down' };
  }
  let out;
  if (mini.link) {                                               // the door it is linked to, the same every time
    out = mini.link[r][m];
    if (!(out >= 0) || out === m || out === mini.good[r]) return { ok: false, reason: 'secret' };
    if (mini.seen) mini.seen[r][m] = out;
  } else {                                                       // (a square from before the links: drawn with the move)
    const others = Array.from({ length: mini.d[r] }, (_, k) => k).filter(k => k !== m); out = others[randInt(needRng(rng), others.length)];
  }
  tr[r][m] = 1;
  mini.pos[p] = doorX(mini.d[r], out);
  mini.last = c ? { by: p, r, i: m, down: false, out, from, c: 1 } : { by: p, r, i: m, down: false, out, from };
  return { ok: true, outcome: 'continue', note: 'dead' };
}
export function timeoutClose(mini, p) { return null; }             // (a door owed after a way down is simply not taken)
const copy = t => (Array.isArray(t) ? t.map(r => r.slice()) : { X: t.X.map(r => r.slice()), O: t.O.map(r => r.slice()) });
export function publicView(mini) {                                // never the ways down not yet found, nor a link nobody has used
  const pub = { type: 'doors', v: mini.v, sep: !!mini.sep, f: mini.f, d: mini.d.slice(), tried: copy(mini.tried), at: { X: mini.at.X, O: mini.at.O }, pos: { X: mini.pos.X, O: mini.pos.O }, last: mini.last ? Object.assign({}, mini.last) : null };
  if (mini.seen) pub.seen = mini.seen.map(r => r.slice());
  if (mini.look != null) pub.look = mini.look;
  return pub;
}
export function secret(mini) { return mini.good ? (mini.link ? { good: mini.good.slice(), link: mini.link.map(r => r.slice()) } : { good: mini.good.slice() }) : null; }
export function hide(m, k, st) { delete m.good; delete m.link; }
// The doors p may try: those of their floor not marked a dead end.
export function doorsMoves(mini, p) { const r = mini.at[p], t = doorsTried(mini, p)[r]; return t ? t.map((v, i) => (v === 1 ? -1 : i)).filter(i => i >= 0) : []; }
// What a player can see of floor r: their own marks, and (separate towers, built the same) the other tower's.
export function doorsKnown(mini, p, r) {
  const own = (doorsTried(mini, p)[r] || []).slice();
  if (!mini.sep) return own;
  const o = mini.tried[p === 'X' ? 'O' : 'X'][r] || [];
  return own.map((v, i) => (v === 2 || o[i] === 2 ? 2 : v || o[i] || 0));
}
// The doors of floor r a runner is known to have come out of: dead ends too, to anyone who thinks about it (a dead
// end only ever leads to another), though nobody has gone in at them.
export function doorsExits(mini, r) { const out = new Array(mini.d[r]).fill(false); if (mini.seen) for (const j of mini.seen[r] || []) if (j >= 0) out[j] = true; return out; }
export function randomMove(mini, p, rng, from, empties) { return from(doorsMoves(mini, p)); }
export function moveFlash(m, p, range, bjFrom, mini, flash) { const l = mini.last; flash.dd = Object.assign({ r: l.r, i: l.i, down: !!l.down, out: l.down ? -1 : l.out, from: l.from }, l.c ? { c: 1 } : {}); }
export function flashMs(f, winLen, won) { return !f.dd ? 300 : (f.dd.c ? 0 : doorsPre()) + (f.dd.down ? doorsDownMs() + (won ? DOORS.win : 0) : doorsDeadMs()); }
