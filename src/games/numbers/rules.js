// Number Shuffle: the rules (pure: no page, no clock; the server runs the same code).
// Everyone gets the same `n` different digits (`d`, on show, smallest first). Somewhere is a hidden order of them, read
// as one number (`tg`: the server's alone online, `secret`/`hide`). A move is a guess, `{ o: [the digits in an order] }`:
// the game says whether the hidden number is higher or lower than the guess (`g`: every guess and its answer, in the
// open), and the exact order takes the square. Race (`mode`): each player their own hidden order, the same digits;
// Shared: one hidden order, every guess and answer for both. Every order of the digits is a different number, so the
// orders still possible are always one run of them in size order: `nsRange` gives it from the guesses.
// A square from before (Number Target: no `v`, a sum puzzle) is dealt again as the record is read (`stale`).
import { needRng } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const NS = { slide: 110, say: 240, hold: 700 };           // ms: a digit sliding into its slot, the answer after the last, the result held
export const nsCfg = mini => { const t = tune(mini); return { mode: t.mode === 'shared' ? 'shared' : 'race', n: Math.max(3, Math.min(7, t.n | 0)) }; };
export const nsVal = o => o.reduce((v, x) => v * 10 + x, 0);
// Every order of the digits, smallest number first (n! of them; 7 digits: 5,040).
const PERMS = new Map();
export function nsPerms(d) {
  const key = d.join(''); if (PERMS.has(key)) return PERMS.get(key);
  const out = [], go = (left, acc) => { if (!left.length) { out.push(acc); return; } left.forEach((x, k) => go(left.slice(0, k).concat(left.slice(k + 1)), acc.concat(x))); };
  go(d.slice().sort((a, b) => a - b), []); PERMS.set(key, out); return out;
}
const shuffled = (d, r) => { const a = d.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
export function create(type, rng) {
  const r = needRng(rng), t = tuneLive(type), mode = t.mode === 'shared' ? 'shared' : 'race', n = Math.max(3, Math.min(7, t.n | 0)), pool = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], r);
  const d = pool.slice(0, n).sort((a, b) => a - b), X = shuffled(d, r);
  let O = X; if (mode === 'race') { do O = shuffled(d, r); while (O.join('') === X.join('')); }   // (never the same order: the second would read it off the first)
  return { type, v: 2, mode, d, tg: { X, O }, g: [], last: null };
}
export const stale = mini => mini.v !== 2;
// The guesses that tell player p about their hidden number: their own in a race, everyone's in Shared.
export const nsMine = (mini, p) => mini.g.filter(e => mini.mode === 'shared' || e.by === p);
// The orders still possible for p, as places in nsPerms: [lo, hi] (inclusive), and how many.
export function nsRange(mini, p) {
  const all = nsPerms(mini.d); let lo = 0, hi = all.length - 1;
  for (const e of nsMine(mini, p)) {
    const v = nsVal(e.o), k = all.findIndex(o => nsVal(o) === v); if (k < 0) continue;
    if (e.r === 'hi') lo = Math.max(lo, k + 1); else if (e.r === 'lo') hi = Math.min(hi, k - 1); else { lo = hi = k; }
  }
  return { lo, hi, left: Math.max(0, hi - lo + 1), all };
}
const isOrder = (o, d) => Array.isArray(o) && o.length === d.length && o.every(x => Number.isInteger(x)) && o.slice().sort((a, b) => a - b).join() === d.join();
export function apply(mini, p, m, rng, idx) {
  if (mini.v !== 2) return { ok: false, reason: 'stale' };
  const o = m && typeof m === 'object' ? m.o : null;
  if (!isOrder(o, mini.d)) return { ok: false, reason: 'bad' };
  const tg = mini.tg && mini.tg[p]; if (!tg) return { ok: false, reason: 'secret' };
  const want = nsVal(tg), v = nsVal(o), r = v === want ? 'eq' : want > v ? 'hi' : 'lo';
  const e = { by: p, o: o.slice(), r }; mini.g.push(e);
  mini.last = Object.assign({ k: mini.g.length - 1 }, e);
  if (r === 'eq') { if (mini.mode === 'race') mini.last.other = (mini.tg[p === 'X' ? 'O' : 'X'] || []).slice(); return { ok: true, outcome: 'win', note: 'won' }; }
  return { ok: true, outcome: 'continue', note: r };
}
export function timeoutClose(mini, p) { return null; }
export function secret(mini) { return mini.tg ? { tg: JSON.parse(JSON.stringify(mini.tg)) } : null; }
export function hide(m, k, st) { delete m.tg; }
export function publicView(mini) { const v = JSON.parse(JSON.stringify(mini)); delete v.tg; return v; }   // never the hidden order
export function randomMove(mini, p, rng, from, empties) { return { o: shuffled(mini.d, needRng(rng)) }; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.ns = JSON.parse(JSON.stringify(mini.last)); }
export const nsShowMs = l => NS.slide * ((l && l.o ? l.o.length : 0) + 1) + NS.say;
export function flashMs(f, winLen, won) { return f.ns ? nsShowMs(f.ns) + NS.hold + (won ? 500 : 0) : 0; }
