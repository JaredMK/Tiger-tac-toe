// Word Tiles: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt, shuffle } from '../../core/random.js';
import { goAgain, tune, tuneLive } from '../../core/tune.js';
import { WT_WORDS } from './words.js';

// ---------- Word Tiles (November 2026; one board and one bag for both from the rework, v 2) ----------
// Both players build on one shared 7x7 board (premium squares: double and triple letter, double and triple word; the
// centre a double word the first word must cover) and draw from one shared bag of letter tiles (hidden: its order the
// server's alone, secret/hide). Each holds a rack of `rack` (7) tiles that is theirs alone: online it rides the per-side
// channel (games/{id}/sides/{side}: sidePart/sideMerge, core/records.js), never the public state, a move's entry or the
// other phone; against the computer the view shows only the player's own rack, and the computer reads only its own
// (publicView with the side). A move places one word: tiles from the rack in one row or one column, with no gap but the
// board's own tiles, the first through the centre and every later one joined to the tiles already there (anyone's);
// every word it makes (the main one along the line and each one across a new tile) must be in the list (words.js:
// ENABLE, public domain, 2 to 7 letters, the offensive words left out) and each scores for the mover: its letters'
// values, a new tile on a double or triple letter square counting two or three times, the word doubled or trebled for
// each new tile on a word square; all seven of the rack's tiles in one word adds `bonus`. The rack then refills from the
// bag; an empty bag is a fresh one (shuffled), so nobody runs out. Swap (the turn) puts the whole rack back, shuffles
// the bag and draws again; `WT.stall` (4) swaps in a row (two each: the board has no room left for either) end the square
// for the higher score, level a draw (the square resets). No blank tiles. The first total at `target` wins the square. Never dealt to two
// people on one phone (meta.js samePhone: false). Each tile laid keeps whose it was (`own`: the board's colours). A
// draft is the phone's own: a timeout plays nothing. A square from before the rework (v 1: a board and a bag each) is
// dealt again as the record is read (`stale`, core/records.js fullState).
// "Go again on success" (core/tune.js AGAIN_TUNE) on: a word played keeps the turn.
export const WT = { n: 7, rack: 7, bonus: 15, stall: 4, drop: 110, dropMs: 360, count: 520, hold: 450 };
// Letter values (the usual ones of word games: 1 for the commonest letters up to 10 for the rarest).
export const WT_VAL = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10 };
// A player's bag (53 tiles: about half a usual set, no Q: no word of 7 letters or fewer takes one but a handful).
export const WT_BAG = 'EEEEEEAAAAAIIIIIOOOONNNRRRTTTSSLLUUDDGGBCFHMPVWYKJXZ';
// The premium squares, row by row: T triple word, D double word (the centre, where the first word goes), t triple
// letter, d double letter.
export const WT_PREM = 'T..d..T.D...D...t.t..d..D..d..t.t...D...D.T..d..T';
export const WT_CENTRE = 24;
export const wtCfg = mini => { const t = tune(mini); return { target: t.target, rack: Math.max(4, Math.min(7, Math.round(t.rack || WT.rack))), bonus: t.bonus != null ? t.bonus : WT.bonus }; };

// ---- the word list ----
let DICT = null;
// Decoded on first use: every word (upper case) in a Set, and the lists by length (the computer's search).
export function wtDict() {
  if (DICT) return DICT;
  const set = new Set(), byLen = [[], [], [], [], [], [], [], []];
  let prev = '', i = 0;
  const s = WT_WORDS;
  while (i < s.length) {
    const k = s.charCodeAt(i) - 48; i++;
    let j = i; while (j < s.length && (s.charCodeAt(j) < 48 || s.charCodeAt(j) > 57)) j++;
    const w = prev.slice(0, k) + s.slice(i, j);
    i = j; prev = w;
    const W = w.toUpperCase();
    set.add(W); if (W.length <= 7) byLen[W.length].push(W);
  }
  DICT = { set, byLen };
  return DICT;
}
export const wtIsWord = w => typeof w === 'string' && wtDict().set.has(w.toUpperCase());

// ---- a placement checked and scored ----
const rowOf = i => Math.floor(i / WT.n), colOf = i => i % WT.n;
const step = (i, d, s) => { const j = i + d * s; if (j < 0 || j >= WT.n * WT.n) return -1; if (d === 1 && rowOf(j) !== rowOf(i)) return -1; return j; };
// The word through cell i along d (1 across, 7 down) on board b: its cells, first to last.
function wordAt(b, i, d) {
  let a = i; for (let j = step(a, d, -1); j >= 0 && b[j]; j = step(a, d, -1)) a = j;
  const cells = []; for (let j = a; j >= 0 && b[j]; j = step(j, d, 1)) cells.push(j);
  return cells;
}
function scoreWord(b, cells, fresh) {
  let sum = 0, mult = 1;
  for (const c of cells) {
    let v = WT_VAL[b[c]] || 0;
    if (fresh.has(c)) { const p = WT_PREM[c]; if (p === 'd') v *= 2; else if (p === 't') v *= 3; else if (p === 'D') mult *= 2; else if (p === 'T') mult *= 3; }
    sum += v;
  }
  return sum * mult;
}
// t: [[cell, letter], ...] on `board` from `rack`. { ok, score, words: [{ w, cells, s }] } or { ok: false, reason, w }.
export function wtCheck(board, rack, t, cfg) {
  cfg = cfg || { bonus: WT.bonus };
  if (!Array.isArray(t) || !t.length || t.length > rack.length) return { ok: false, reason: 'bad' };
  const left = rack.slice(), seen = new Set();
  for (const pl of t) {
    if (!Array.isArray(pl) || pl.length !== 2) return { ok: false, reason: 'bad' };
    const [c, l] = pl;
    if (!Number.isInteger(c) || c < 0 || c >= WT.n * WT.n || board[c] || seen.has(c) || typeof l !== 'string' || !/^[A-Z]$/.test(l)) return { ok: false, reason: 'bad' };
    const k = left.indexOf(l); if (k < 0) return { ok: false, reason: 'bad' };
    left.splice(k, 1); seen.add(c);
  }
  const first = board.every(x => !x), b = board.slice();
  for (const [c, l] of t) b[c] = l;
  const rows = new Set(t.map(([c]) => rowOf(c))), cols = new Set(t.map(([c]) => colOf(c)));
  let d;
  if (t.length === 1) { const c = t[0][0]; d = (step(c, 1, -1) >= 0 && b[step(c, 1, -1)]) || (step(c, 1, 1) >= 0 && b[step(c, 1, 1)]) ? 1 : 7; }
  else if (rows.size === 1) d = 1; else if (cols.size === 1) d = 7; else return { ok: false, reason: 'line' };
  const main = wordAt(b, t[0][0], d);
  if (t.some(([c]) => !main.includes(c))) return { ok: false, reason: 'gap' };
  if (first && !seen.has(WT_CENTRE)) return { ok: false, reason: 'centre' };
  const words = [];
  if (main.length >= 2) words.push(main);
  for (const [c] of t) { const x = wordAt(b, c, d === 1 ? 7 : 1); if (x.length >= 2) words.push(x); }
  if (!words.length) return { ok: false, reason: first ? 'short' : 'connect' };
  if (!first && !words.some(w => w.some(c => board[c]))) return { ok: false, reason: 'connect' };
  const out = [];
  for (const cells of words) { const w = cells.map(c => b[c]).join(''); if (!wtIsWord(w)) return { ok: false, reason: 'word', w }; out.push({ w, cells, s: scoreWord(b, cells, seen) }); }
  const all = t.length === rack.length && rack.length >= 7 ? cfg.bonus : 0;
  return { ok: true, score: out.reduce((a, x) => a + x.s, 0) + all, words: out, all: all > 0 };
}

// ---- every legal word (the computer's search, the tests' stand-in) ----
// Every placement on `board` from `rack`, each { t, score, w } (w the main word). The lines of the board (7 across,
// 7 down), every stretch of 2 to 7 cells in each that the word would fill exactly (the cells either side empty or the
// edge), with at least one empty cell, the centre for the first word, else touching a tile; the words of that length
// that fit the stretch's own letters and the rack, every new tile's word across checked (cached), each scored.
export function wtMoves(board, rack, cfg) {
  const { set, byLen } = wtDict(), n = WT.n, first = board.every(x => !x);
  const have = new Array(26).fill(0); for (const l of rack) have[l.charCodeAt(0) - 65]++;
  const onBoard = new Set(board.filter(Boolean));
  const ok = l => have[l.charCodeAt(0) - 65] > 0 || onBoard.has(l);
  const lists = byLen.map(ws => ws.filter(w => { for (let i = 0; i < w.length; i++) if (!ok(w[i])) return false; return true; }));
  const crossMemo = new Map();
  const crossOk = (c, l, d) => {                                  // the word across a new tile at c (perpendicular to d) is a word, or there is none
    const key = c * 64 + (l.charCodeAt(0) - 65) * 2 + (d === 1 ? 0 : 1);
    if (crossMemo.has(key)) return crossMemo.get(key);
    const e = d === 1 ? 7 : 1;
    let a = c; for (let j = step(a, e, -1); j >= 0 && board[j]; j = step(a, e, -1)) a = j;
    let w = '', touched = false;
    for (let j = a; j >= 0 && (board[j] || j === c); j = step(j, e, 1)) { if (j === c) w += l; else { w += board[j]; touched = true; } }
    const r = !touched || set.has(w);
    crossMemo.set(key, r);
    return r;
  };
  const nbr = c => [step(c, 1, -1), step(c, 1, 1), step(c, 7, -1), step(c, 7, 1)].some(j => j >= 0 && board[j]);
  const out = [];
  for (const d of [1, 7]) for (let line = 0; line < n; line++) {
    const cellAt = k => (d === 1 ? line * n + k : k * n + line);
    for (let a = 0; a < n; a++) for (let z = a + 1; z < n; z++) {
      const L = z - a + 1, cells = Array.from({ length: L }, (_, k) => cellAt(a + k));
      if (a > 0 && board[cellAt(a - 1)]) continue;                 // (the word would run on: not this stretch)
      if (z < n - 1 && board[cellAt(z + 1)]) continue;
      const empties = cells.filter(c => !board[c]);
      if (!empties.length || empties.length > rack.length) continue;
      if (first ? !cells.includes(WT_CENTRE) : !(empties.length < L || empties.some(nbr))) continue;
      for (const w of lists[L]) {
        let fit = true; const need = have.slice();
        for (let k = 0; k < L && fit; k++) {
          const c = cells[k], f = board[c];
          if (f) { if (f !== w[k]) fit = false; continue; }
          const x = w.charCodeAt(k) - 65;
          if (need[x] <= 0 || !crossOk(c, w[k], d)) fit = false; else need[x]--;
        }
        if (!fit) continue;
        const t = []; for (let k = 0; k < L; k++) if (!board[cells[k]]) t.push([cells[k], w[k]]);
        if (t.length === 1 && d === 7 && ((step(t[0][0], 1, -1) >= 0 && board[step(t[0][0], 1, -1)]) || (step(t[0][0], 1, 1) >= 0 && board[step(t[0][0], 1, 1)]))) continue;   // (one tile with a word across too: found as the across one)
        const ch = wtCheck(board, rack, t, cfg);
        if (ch.ok) out.push({ t, score: ch.score, w });
      }
    }
  }
  return out;
}

// ---- the square ----
function draw(mini, p, rng) {
  const cfg = wtCfg(mini), rack = mini.rack[p];
  while (rack.length < cfg.rack) {
    if (!mini.bag.length) mini.bag = shuffle(WT_BAG.split(''), needRng(rng));   // an empty bag: a fresh one
    rack.push(mini.bag.pop());
  }
  mini.bagN = mini.bag.length;
}
export function create(type, rng) {
  const r = needRng(rng), c = wtCfg({ type, tune: tuneLive(type) });
  const mini = { type, v: 2, board: new Array(49).fill(null), own: new Array(49).fill(null), rack: { X: [], O: [] }, bag: shuffle(WT_BAG.split(''), r), bagN: 0, score: { X: 0, O: 0 }, plays: { X: 0, O: 0 }, swaps: 0, last: null };
  for (const p of ['X', 'O']) while (mini.rack[p].length < c.rack) mini.rack[p].push(mini.bag.pop());
  mini.bagN = mini.bag.length;
  return mini;
}
export const stale = mini => (mini.v || 1) < 2;                    // (a square from before the rework: dealt again, core/records.js)
// m: [[cell, letter], ...] (one word), or 'swap'.
export function apply(mini, p, m, rng, idx) {
  const cfg = wtCfg(mini), board = mini.board, from = mini.score[p];
  if (!Array.isArray(mini.bag) || !mini.rack || !Array.isArray(mini.rack[p])) return { ok: false, reason: 'secret' };
  const rack = mini.rack[p];
  if (m === 'swap') {
    mini.bag = shuffle(mini.bag.concat(rack.splice(0)), needRng(rng));
    draw(mini, p, rng);
    mini.plays[p] += 1;
    mini.swaps = (mini.swaps || 0) + 1;
    mini.last = { by: p, kind: 'swap', from, to: from, swaps: mini.swaps };
    if (mini.swaps >= WT.stall) {                                 // the board stuck (two swaps each in a row): the higher score takes it, level a draw
      const q = p === 'X' ? 'O' : 'X', a = mini.score[p], b = mini.score[q];
      mini.last.stuck = true;
      if (a === b) return { ok: true, outcome: 'draw', note: 'tie' };
      return { ok: true, outcome: 'win', winner: a > b ? p : q, note: 'stuck' };
    }
    return { ok: true, outcome: 'continue', note: 'swap' };
  }
  const ch = wtCheck(board, rack, m, cfg);
  if (!ch.ok) return { ok: false, reason: ch.reason === 'word' ? 'word' : 'bad' };
  for (const [c, l] of m) { board[c] = l; mini.own[c] = p; rack.splice(rack.indexOf(l), 1); }
  draw(mini, p, rng);
  mini.score[p] = from + ch.score; mini.plays[p] += 1; mini.swaps = 0;
  mini.last = { by: p, kind: 'word', t: m.map(([c, l]) => [c, l]), words: ch.words.map(x => ({ w: x.w, s: x.s })), all: ch.all, pts: ch.score, from, to: mini.score[p] };
  if (mini.score[p] >= cfg.target) return { ok: true, outcome: 'win', note: 'word' };
  if (goAgain(mini)) return { ok: true, outcome: 'continue', note: 'word', again: true };   // ("Go again on success" on: another word)
  return { ok: true, outcome: 'continue', note: 'word' };
}
// The server's alone: the bag's order and both racks.
export function secret(mini) { return Array.isArray(mini.bag) && mini.rack ? { bag: mini.bag.slice(), rack: { X: (mini.rack.X || []).slice(), O: (mini.rack.O || []).slice() } } : null; }
export function hide(m, k, st) { delete m.bag; if (m.rack) m.rack = {}; }
// Each side's own part (games/{id}/sides/{side}: that side alone reads it): its rack.
export function sidePart(mini, p) { return mini.rack && Array.isArray(mini.rack[p]) ? { rack: mini.rack[p].slice() } : null; }
export function sideMerge(mini, p, part) { if (part && Array.isArray(part.rack)) mini.rack = Object.assign({}, mini.rack, { [p]: part.rack.slice() }); }
// What the board may show (and the computer for `forSide` may know): the board, whose tiles, the scores, the bag's
// count, and forSide's own rack alone.
export function publicView(mini, forSide) {
  const v = { type: 'wtiles', v: mini.v, board: mini.board.slice(), own: (mini.own || []).slice(), rack: {}, bagN: mini.bagN, swaps: mini.swaps || 0, score: { X: mini.score.X, O: mini.score.O }, plays: { X: mini.plays.X, O: mini.plays.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
  if (forSide && mini.rack && Array.isArray(mini.rack[forSide])) v.rack[forSide] = mini.rack[forSide].slice();
  return v;
}
export function canMove(mini) { return true; }
export function randomMove(mini, p, rng, from, empties) {        // (the tests' stand-in for a player: any word, else a swap)
  const ms = wtMoves(mini.board, mini.rack[p], wtCfg(mini));
  return ms.length ? ms[randInt(needRng(rng), ms.length)].t : 'swap';
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last;
  flash.wt = Object.assign(JSON.parse(JSON.stringify(l)), { board: mini.board.slice(), own: (mini.own || []).slice() });   // (public alone: the entry goes to both phones; the racks are each side's own)
}
// The move's moments (ms from it): the new tiles drop onto the board one after the other, then the score counts on.
export function wtTimes(s) {
  if (!s || s.kind !== 'word') return { end: WT.hold + 300, count: 0 };
  const n = s.t ? s.t.length : 0, count = (n - 1) * WT.drop + WT.dropMs;
  return { dropAt: k => k * WT.drop, count, end: count + WT.count + WT.hold };
}
export function flashMs(f, winLen, won) { return wtTimes(f.wt).end + (won ? 600 : 0); }
