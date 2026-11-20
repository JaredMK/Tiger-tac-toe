// Peg Jump Race: the rules (pure: no page, no clock; the server runs the same code).
// A board of `rows` by `cols`. X's pegs start on the bottom row and cross upwards, O's on the top row and cross
// downwards (`pegs[p][k]`: [row, col], or null once home). A move takes one peg forward: one step (straight or
// diagonally forward, onto an empty cell), or a jump over a peg next to it in one of those three ways, either player's,
// onto the empty cell beyond. A peg that reaches the far row, or jumps past it, is home and leaves the board. After a
// jump, if that peg can jump again, the same player goes on with it (`again`, `mini.hop`) or stops ('stop'). The first
// to get every peg home takes the square. Nothing hidden, nothing by chance.
// A forward move always exists: a peg has two or three cells ahead and as many landings beyond them, and the far row
// only ever holds pegs that have not yet moved (a jump over one of those goes home); `pegMoves` is never empty in play
// (the tests play thousands of squares to hold it), and should it ever be, the one move is 'pass'.
import { needRng } from '../../core/random.js';
import { tuneLive } from '../../core/tune.js';

export const PEGS = { step: 240, jump: 340, hold: 260 };          // ms: a step's slide, a jump's hop, the result
export const pegDir = p => (p === 'X' ? -1 : 1);
export function create(type, rng) {
  const t = tuneLive(type), n = Math.min(t.pegs, t.cols), c0 = Math.floor((t.cols - n) / 2), cols = Array.from({ length: n }, (_, k) => c0 + k);
  return { type, v: 1, rows: t.rows, cols: t.cols, pegs: { X: cols.map(c => [t.rows - 1, c]), O: cols.map(c => [0, c]) }, home: { X: 0, O: 0 }, hop: null, last: null };
}
const at = (mini, r, c) => { for (const p of ['X', 'O']) for (const q of mini.pegs[p]) if (q && q[0] === r && q[1] === c) return p; return null; };
// The moves of p's peg k: [{ k, to: [row, col], jump, over, home }] (jumps only, for a peg that has just jumped).
export function pegMovesOf(mini, p, k, jumpsOnly) {
  const q = mini.pegs[p][k], out = [], d = pegDir(p), far = p === 'X' ? 0 : mini.rows - 1;
  if (!q) return out;
  for (const dc of [-1, 0, 1]) {
    const r1 = q[0] + d, c1 = q[1] + dc;
    if (c1 < 0 || c1 >= mini.cols) continue;
    const who = at(mini, r1, c1);
    if (!who) { if (!jumpsOnly) out.push({ k, to: [r1, c1], jump: false, home: r1 === far }); continue; }
    const r2 = r1 + d, c2 = c1 + dc;
    if (r1 === far) { out.push({ k, to: [r2, c2], jump: true, over: [r1, c1], home: true }); continue; }   // over a peg on the far row: off the board, home
    if (c2 < 0 || c2 >= mini.cols || at(mini, r2, c2)) continue;
    out.push({ k, to: [r2, c2], jump: true, over: [r1, c1], home: r2 === far });
  }
  return out;
}
// Every move p may make now: mid-chain, that peg's further jumps and 'stop'; else every peg's steps and jumps.
export function pegMoves(mini, p) {
  if (mini.hop && mini.hop.by === p) return pegMovesOf(mini, p, mini.hop.k, true);
  const out = []; mini.pegs[p].forEach((q, k) => { for (const m of pegMovesOf(mini, p, k, false)) out.push(m); });
  return out;
}
export function apply(mini, p, m, rng, idx) {
  if (mini.hop && mini.hop.by !== p) mini.hop = null;               // (a chain left unfinished by a timeout: over)
  if (m === 'stop') { if (!mini.hop) return { ok: false, reason: 'nohop' }; mini.hop = null; mini.last = { by: p, stop: true }; return { ok: true, outcome: 'continue', note: 'stop' }; }
  const all = pegMoves(mini, p);
  if (m === 'pass') { if (all.length) return { ok: false, reason: 'canmove' }; mini.last = { by: p, stop: true }; return { ok: true, outcome: 'continue', note: 'pass' }; }
  if (!m || typeof m !== 'object' || !Number.isInteger(m.k) || !Array.isArray(m.to)) return { ok: false, reason: 'bad' };
  const mv = all.find(x => x.k === m.k && x.to[0] === m.to[0] && x.to[1] === m.to[1]);
  if (!mv) return { ok: false, reason: 'illegal' };
  const from = mini.pegs[p][mv.k].slice();
  mini.pegs[p][mv.k] = mv.home ? null : mv.to.slice();
  if (mv.home) mini.home[p]++;
  const more = mv.jump && !mv.home && pegMovesOf(mini, p, mv.k, true).length > 0;
  mini.hop = more ? { by: p, k: mv.k } : null;
  mini.last = { by: p, k: mv.k, from, to: mv.to.slice(), jump: mv.jump, over: mv.over ? mv.over.slice() : null, home: mv.home, more };
  if (mini.pegs[p].every(q => !q)) return { ok: true, outcome: 'win', note: 'home' };
  return more ? { ok: true, outcome: 'continue', note: 'jump', again: true } : { ok: true, outcome: 'continue', note: mv.jump ? 'jump' : 'step' };
}
// Out of time mid-chain: the chain stops where the peg stands (no choice made for the player).
export function timeoutClose(mini, p) { return mini.hop && mini.hop.by === p ? 'stop' : null; }
export function publicView(mini) {
  const cp = a => a.map(q => (q ? q.slice() : null));
  return { type: 'pegs', v: mini.v, rows: mini.rows, cols: mini.cols, pegs: { X: cp(mini.pegs.X), O: cp(mini.pegs.O) }, home: { X: mini.home.X, O: mini.home.O }, hop: mini.hop ? { by: mini.hop.by, k: mini.hop.k } : null, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null };
}
export function randomMove(mini, p, rng, from, empties) {
  const all = pegMoves(mini, p);
  if (!all.length) return mini.hop && mini.hop.by === p ? 'stop' : 'pass';
  const m = from(all); return { k: m.k, to: m.to };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.pg = JSON.parse(JSON.stringify(mini.last)); }
export function flashMs(f, winLen, won) { const l = f.pg; return !l || l.stop ? 120 : (l.jump ? PEGS.jump : PEGS.step) + (l.more ? 60 : PEGS.hold) + (won ? 400 : 0); }
void needRng;
