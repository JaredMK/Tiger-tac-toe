// Gem Swap: the rules (pure: no page, no clock; the server runs the same code).
// One board for both players, `n` by `n` (`b`: a string of n * n digits, a gem's kind 0 to `kinds` - 1, row by row from
// the top). A move swaps two gems that are neighbours up, down, left or right: `{ a, b }`, their cells. It is taken only
// if the swap makes a line of three or more of one kind, across or down. Then the board settles (`gemsResolve`, the one
// function the server, the page and the computer all use): every gem in a line of three or more goes (a gem in two
// lines counts once), the gems above fall, new gems drop in at the top (drawn with the move's rng: the server's online),
// and again while anything lines up: a cascade. A point a gem removed, every cascade of the swap included; the first
// to `target` points takes the square at once. A board left with no swap that makes a line is shuffled (the same gems,
// laid out again with no line ready and a swap to make: `last.sh`, the new board). Nothing is hidden; the new gems are
// chance, so the phone leaves the result to the server.
// "Go again on success" (off by default): a swap that removes `againAt` gems or more in all keeps the turn (`go`: whose turn goes on).
// Equal turns (`even`, off by default: the first to the target takes the square at once, as asked; a race where every
// turn adds about the same gives the first to move about three squares in five): on, a player who reaches the target
// having had a turn more than the other (`turns`) does not take the square yet (`final`: { by, pts }, note `reached`):
// the other player has one turn to answer. Past the leader's total takes it (`passed`), level is a draw and the square
// resets (`tie`), short leaves it to the leader (`held`, with `winner`); an answer never made (a turn missed) is taken
// by the leader's next swap there (`unanswered`). The totals are kept whole (a tally shows them up to the target).
// What a move leaves in `last` is enough to play it again exactly: the board as it was (`was`), the two cells, and for
// each step of the cascade the cells that went (`x`) and the new gems that came in (`g`: column by column from the left,
// each column's from the top); the falls follow from those (`gemsFrames`).
import { needRng, randInt, shuffle } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';

// The move's moments (ms; the stylesheet's block mirrors them): the two gems change places (`swap`), then each step of
// the cascade: its gems burst (`pop`), the rest fall and the new ones drop in (`fall`), a breath (`gap`); a shuffle's
// swirl after the last (`shuffle`); the result held (`hold`). `steps`: no cascade is followed further than this;
// `settle`: the swaps played on a fresh deal, for nobody, before a square opens (gemsOpen).
export const GEMS = { swap: 180, pop: 260, fall: 240, gap: 60, shuffle: 640, hold: 320, steps: 40, settle: 8 };
export const GEMS_DEF = { size: 7, kinds: 6, target: 32, againAt: 6 };   // (the TUNE defaults; tune(mini) holds them too)
export const gemsCfg = mini => { const t = Object.assign({}, GEMS_DEF, tune(mini)); return { target: t.target, againAt: t.againAt, again: goAgain(mini), even: t.even === 'on', aiEasy: t.aiEasy, aiHard: t.aiHard }; };
export const gemsArr = b => Array.from(String(b || ''), ch => ch.charCodeAt(0) - 48);
export const gemsStr = g => g.join('');
// Two cells that touch along a side.
export const gemsNear = (n, a, b) => { const d = Math.abs(a - b); return d === n || (d === 1 && Math.floor(a / n) === Math.floor(b / n)); };
// Is cell i part of a line of three or more (across or down)? A gem not yet known (-1) lines up with nothing.
function inLine(g, n, i) {
  const k = g[i]; if (k < 0) return false;
  const r = Math.floor(i / n), c = i % n;
  let run = 1;
  for (let x = c - 1; x >= 0 && g[r * n + x] === k; x--) run++;
  for (let x = c + 1; x < n && g[r * n + x] === k; x++) run++;
  if (run >= 3) return true;
  run = 1;
  for (let y = r - 1; y >= 0 && g[y * n + c] === k; y--) run++;
  for (let y = r + 1; y < n && g[y * n + c] === k; y++) run++;
  return run >= 3;
}
// Every cell in a line of three or more, in order (a cell in two lines once).
export function gemsLines(g, n) {
  const hit = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n;) {
    const k = g[r * n + c]; let e = c + 1;
    while (e < n && g[r * n + e] === k) e++;
    if (k >= 0 && e - c >= 3) for (let x = c; x < e; x++) hit[r * n + x] = 1;
    c = e;
  }
  for (let c = 0; c < n; c++) for (let r = 0; r < n;) {
    const k = g[r * n + c]; let e = r + 1;
    while (e < n && g[e * n + c] === k) e++;
    if (k >= 0 && e - r >= 3) for (let y = r; y < e; y++) hit[y * n + c] = 1;
    r = e;
  }
  const out = []; for (let i = 0; i < hit.length; i++) if (hit[i]) out.push(i);
  return out;
}
// Would swapping a and b make a line? (Two neighbours of different kinds; the board itself never holds a ready line.)
export function gemsValid(g, n, a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= n * n || b >= n * n || !gemsNear(n, a, b) || g[a] === g[b]) return false;
  const t = g[a]; g[a] = g[b]; g[b] = t;
  const ok = inLine(g, n, a) || inLine(g, n, b);
  g[b] = g[a]; g[a] = t;
  return ok;
}
// Every swap that makes a line: [a, b] with b the cell to the right of a or under it.
export function gemsMoves(g, n) {
  const out = [];
  for (let i = 0; i < n * n; i++) { if (i % n < n - 1 && gemsValid(g, n, i, i + 1)) out.push([i, i + 1]); if (i + n < n * n && gemsValid(g, n, i, i + n)) out.push([i, i + n]); }
  return out;
}
// One step of the cascade, on g itself: the cells in lines go, the gems above fall, the top is filled (`draw()` gives a
// new gem's kind; none: the new gems are unknown, -1). Returns { x: the cells that went, g: the new gems } or null.
function step(g, n, draw) {
  const x = gemsLines(g, n); if (!x.length) return null;
  const gone = new Uint8Array(n * n), fresh = [];
  for (const i of x) gone[i] = 1;
  for (let c = 0; c < n; c++) {
    let w = n - 1;                                                  // (the row the next kept gem of this column comes to rest in)
    for (let r = n - 1; r >= 0; r--) if (!gone[r * n + c]) { g[w * n + c] = g[r * n + c]; w--; }
    const top = w;
    for (let r = 0; r <= top; r++) { const k = draw ? draw() : -1; g[r * n + c] = k; fresh.push(k); }
  }
  return { x, g: fresh };
}
// A swap played out on a copy: null where it makes no line, else { g: the board after, steps: [{ x, g }], pts }.
// With no rng (the computer looking ahead) the new gems are unknown and line up with nothing: `pts` is then what the
// gems already on the board are sure to give.
export function gemsResolve(g0, n, kinds, a, b, rng) {
  if (!gemsValid(g0, n, a, b)) return null;
  const g = g0.slice(), draw = rng ? () => randInt(rng, kinds) : null, steps = [];
  const t = g[a]; g[a] = g[b]; g[b] = t;
  let pts = 0;
  for (let k = 0; k < GEMS.steps; k++) { const s = step(g, n, draw); if (!s) break; steps.push(s); pts += s.x.length; }
  return { g, steps, pts };
}
// The boards a recorded move goes through (arrays): [as it was, after the swap, after step 1, ...]; the last is the
// board the cascade left (before any shuffle). The view plays the move from these; the tests hold them to the record.
export function gemsFrames(l, n) {
  const g = gemsArr(l.was), out = [g.slice()], t = g[l.a]; g[l.a] = g[l.b]; g[l.b] = t; out.push(g.slice());
  for (const s of l.steps || []) {
    const gone = new Uint8Array(n * n), fresh = gemsArr(s.g); let f = 0;
    for (const i of s.x) gone[i] = 1;
    for (let c = 0; c < n; c++) {
      let w = n - 1;
      for (let r = n - 1; r >= 0; r--) if (!gone[r * n + c]) { g[w * n + c] = g[r * n + c]; w--; }
      for (let r = 0; r <= w; r++) g[r * n + c] = fresh[f++];
    }
    out.push(g.slice());
  }
  return out;
}
// A fresh board: no line ready, at least one swap to make. Each cell in turn takes any kind that does not complete a
// line with the two to its left or the two above (every kind as likely: nothing in it knows who moves first).
export function gemsDeal(n, kinds, rng) {
  for (let tries = 0; ; tries++) {
    const g = new Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, ok = [];
      const left = c >= 2 && g[i - 1] === g[i - 2] ? g[i - 1] : -1, up = r >= 2 && g[i - n] === g[i - 2 * n] ? g[i - n] : -1;
      for (let k = 0; k < kinds; k++) if (k !== left && k !== up) ok.push(k);
      g[i] = ok[randInt(rng, ok.length)];
    }
    if (!gemsLines(g, n).length && gemsMoves(g, n).length) return g;
    if (tries > 200) return gemsPlain(n);                           // (an rng that never varies: a set board, so the deal always ends)
  }
}
// A set board with no line and a swap to make (stripes of three kinds down the diagonals, one gem moved to set a swap up).
export function gemsPlain(n) { const g = Array.from({ length: n * n }, (_, i) => (i % n + 2 * Math.floor(i / n)) % 3); g[1] = 0; return g; }
// A board with no swap left, laid out again: the same gems shuffled until no line is ready and a swap can be made (a
// fresh deal if a few dozen shuffles never give one).
export function gemsShuffle(g0, n, kinds, rng) {
  const g = g0.slice();
  for (let k = 0; k < 60; k++) { shuffle(g, rng); if (!gemsLines(g, n).length && gemsMoves(g, n).length) return g; }
  return gemsDeal(n, kinds, rng);
}
// The opening board is a settled one: a fresh deal is richer in ready cascades than a board in play (its best swap is
// worth about three gems more: whoever moved first had them), so the deal plays `GEMS.settle` swaps on it for nobody
// (the swap sure to burst most each time, the cascades drawn with the deal's rng) before the square opens: both players
// then meet boards of the same kind from the first move on.
export function gemsOpen(n, kinds, rng) {
  let g = gemsDeal(n, kinds, rng);
  for (let k = 0; k < GEMS.settle; k++) {
    let best = null;
    for (const m of gemsMoves(g, n)) { const r = gemsResolve(g, n, kinds, m[0], m[1], null); if (!best || r.pts > best.pts) best = { m, pts: r.pts }; }
    if (!best) break;
    g = gemsResolve(g, n, kinds, best.m[0], best.m[1], rng).g;
    if (gemsLines(g, n).length || !gemsMoves(g, n).length) g = gemsShuffle(g, n, kinds, rng);
  }
  return g;
}
export function create(type, rng) {
  const t = Object.assign({}, GEMS_DEF, tuneLive(type)), n = Math.max(5, Math.min(8, t.size | 0)), kinds = Math.max(4, Math.min(6, t.kinds | 0));
  return { type, v: 1, n, kinds, b: gemsStr(gemsOpen(n, kinds, needRng(rng))), pts: { X: 0, O: 0 }, turns: { X: 0, O: 0 }, go: null, final: null, last: null };
}
export function apply(mini, p, m, rng, idx) {
  const n = mini.n, g = gemsArr(mini.b), o = p === 'X' ? 'O' : 'X';
  if (!m || typeof m !== 'object' || !Number.isInteger(m.a) || !Number.isInteger(m.b) || m.a < 0 || m.b < 0 || m.a >= n * n || m.b >= n * n) return { ok: false, reason: 'bad' };
  if (!gemsNear(n, m.a, m.b)) return { ok: false, reason: 'apart' };
  if (!gemsValid(g, n, m.a, m.b)) return { ok: false, reason: 'noline' };
  const r = needRng(rng), c = gemsCfg(mini), res = gemsResolve(g, n, mini.kinds, m.a, m.b, r), from = mini.pts[p], to = from + res.pts;
  let after = res.g, sh = null;
  if (gemsLines(after, n).length || !gemsMoves(after, n).length) { after = gemsShuffle(after, n, mini.kinds, r); sh = gemsStr(after); }   // (no swap left, or a cascade cut off at its limit: laid out again)
  mini.last = { by: p, a: m.a, b: m.b, was: mini.b, steps: res.steps.map(s => ({ x: s.x, g: gemsStr(s.g) })), n: res.pts, from, to };
  if (sh) mini.last.sh = sh;
  if (mini.go !== p) mini.turns[p] = (mini.turns[p] || 0) + 1;    // (a turn begun: one kept by a go-again is the same turn)
  mini.b = gemsStr(after); mini.pts[p] = to; mini.go = null;
  const more = c.again && res.pts >= c.againAt, fin = mini.final;
  if (fin && fin.by === p) return { ok: true, outcome: 'win', note: 'unanswered' };   // (the answer was never made: the square is the leader's)
  if (fin) {                                                        // the answer: past the leader's total takes it, level is a draw, short leaves it
    if (to > fin.pts) return { ok: true, outcome: 'win', note: 'passed' };
    if (more) { mini.go = p; return { ok: true, outcome: 'continue', note: 'combo', again: true }; }
    return to === fin.pts ? { ok: true, outcome: 'draw', note: 'tie' } : { ok: true, outcome: 'win', winner: o, note: 'held' };
  }
  if (to >= c.target) {
    if (c.even && (mini.turns[p] || 0) > (mini.turns[o] || 0)) { mini.final = { by: p, pts: to }; return { ok: true, outcome: 'continue', note: 'reached' }; }
    return { ok: true, outcome: 'win', note: 'won' };
  }
  if (more) { mini.go = p; return { ok: true, outcome: 'continue', note: 'combo', again: true }; }
  return { ok: true, outcome: 'continue', note: res.steps.length > 1 ? 'cascade' : 'swap' };
}
// A timeout: nothing (a move is one swap: a turn not taken is simply missed).
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return { type: 'gems', v: mini.v, n: mini.n, kinds: mini.kinds, b: mini.b, pts: { X: mini.pts.X, O: mini.pts.O }, turns: { X: (mini.turns && mini.turns.X) || 0, O: (mini.turns && mini.turns.O) || 0 }, go: mini.go || null, final: mini.final ? { by: mini.final.by, pts: mini.final.pts } : null, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null }; }
export function randomMove(mini, p, rng, from, empties) { const all = gemsMoves(gemsArr(mini.b), mini.n); if (!all.length) return null; const m = from(all); return { a: m[0], b: m[1] }; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { if (mini.last) flash.gs = JSON.parse(JSON.stringify(mini.last)); }
// The move's moments (ms from the move), for flashMs, the view and the sounds alike: each step's burst (`pop`), its fall
// (`fall`) and landing (`land`); the cascade's end (`casc`); the shuffle's start (`sh`, null without one); the end.
export function gemsTimes(l) {
  const k = l && l.steps ? l.steps.length : 0, per = GEMS.pop + GEMS.fall + GEMS.gap;
  const steps = Array.from({ length: k }, (_, i) => { const pop = GEMS.swap + i * per; return { pop, fall: pop + GEMS.pop, land: pop + GEMS.pop + GEMS.fall }; });
  const casc = GEMS.swap + k * per, sh = l && l.sh ? casc : null;
  return { steps, casc, sh, end: casc + (sh != null ? GEMS.shuffle : 0) };
}
export function flashMs(f, winLen, won) { return f.gs ? gemsTimes(f.gs).end + GEMS.hold + (won ? 500 : 0) : 0; }
