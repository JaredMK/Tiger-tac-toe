// Plinko: the rules (pure: no page, no clock; the server runs the same code).
import { needRng, randInt, shuffle } from '../../core/random.js';
import { PLINKO_DEFAULTS } from './meta.js';

// Plinko: 7 drop slots, 6 rows of pegs, 7 bins worth 5, 3, 3, 2, 2, 1 and 1 points, in an order drawn
// for each square. Each player has their own points; the first to the target (12: the admin's
// config/plinko, copied into each square as dealt) wins. A slot dropped from, by either player, is locked
// until all seven have been used; then they all open again. One peg (drawn at random, never in the top
// row, where a slot would hit it every time) is the bonus peg: +2 when the chip touches it; once hit,
// another peg is drawn, there from the next turn until it is hit in turn. The chip's position runs in
// half-slots (0 to 12, a slot at an even one); at every peg it goes left or right, 50/50, except against
// a wall, where it can only go inward.
export const PLINKO = { slots: 7, rows: 6, step: 230, land: 420, pop: 1020, vals: [5, 3, 3, 2, 2, 1, 1], bonus: 2 };   // pop: the points popping up out of the bin, from the last peg (the move lasts until they have)
export const PLINKO_LIMITS = { target: [4, 40] };
export const PLINKO_CFG = { cfg: null };
export function plinkoNorm(raw) { const x = raw && raw.target != null ? Number(raw.target) : NaN; return { target: Number.isFinite(x) && x >= PLINKO_LIMITS.target[0] && x <= PLINKO_LIMITS.target[1] ? Math.round(x) : PLINKO_DEFAULTS.target }; }
export function setPlinkoConfig(raw) { PLINKO_CFG.cfg = raw && typeof raw === 'object' ? plinkoNorm(raw) : null; }
export const plinkoConfig = () => Object.assign({}, PLINKO_CFG.cfg || PLINKO_DEFAULTS);
// the pegs: row r (1 to 6) has them at the half-slots of r's parity (the top row over the slots)
export function plinkoPegs() { const out = []; for (let r = 1; r <= PLINKO.rows; r++) for (let x = (r - 1) % 2; x <= (PLINKO.slots - 1) * 2; x += 2) out.push({ x, r }); return out; }
export function plinkoBonus(rng, not) { const pegs = plinkoPegs().filter(q => q.r >= 2 && !(not && q.x === not.x && q.r === not.r)); return pegs[randInt(rng, pegs.length)]; }
// where the chip touches a peg in each row on its way down (the half-slot, row 1 first)
export function plinkoTouches(slot, path) { let x = slot * 2; return path.map(right => { const at = x; x += right ? 1 : -1; return at; }); }
// every way down from a slot (the walls included), each with its chance: [{ path, bin, p }]
export function plinkoWays(slot) {
  const out = [];
  for (let k = 0; k < 1 << PLINKO.rows; k++) {
    let x = slot * 2; const path = [];
    for (let r = 0; r < PLINKO.rows; r++) { const right = x <= 0 ? true : x >= (PLINKO.slots - 1) * 2 ? false : !!(k & (1 << r)); x += right ? 1 : -1; path.push(right); }
    out.push({ path, bin: x / 2, p: 1 / (1 << PLINKO.rows) });
  }
  return out;
}
// A drop's points from a slot on this square, as chances: { points: chance } (the bin and the bonus peg)
export function plinkoDist(mini, slot) {
  const out = {}, b = mini.bonus;
  for (const w of plinkoWays(slot)) { const v = mini.vals[w.bin] + (b && plinkoTouches(slot, w.path)[b.r - 1] === b.x ? PLINKO.bonus : 0); out[v] = (out[v] || 0) + w.p; }
  return out;
}
export function plinkoExp(mini, slot) { let e = 0; for (const [v, p] of Object.entries(plinkoDist(mini, slot))) e += Number(v) * p; return e; }
export const plinkoOpen = mini => Array.from({ length: PLINKO.slots }, (_, k) => k).filter(k => !(mini.used && mini.used[k]));
export function plinkoPath(slot, rng) {
  let x = slot * 2;
  const path = [];
  for (let r = 0; r < PLINKO.rows; r++) {
    const right = x <= 0 ? true : x >= (PLINKO.slots - 1) * 2 ? false : rng() < 0.5;
    x += right ? 1 : -1; path.push(right);
  }
  return { path, bin: x / 2 };
}
// The chance of each bin from a slot (every path counted, the walls included): for the tests and the computer.
export function plinkoOdds(slot) {
  const out = new Array(PLINKO.slots).fill(0);
  for (let k = 0; k < 1 << PLINKO.rows; k++) {
    let x = slot * 2;
    for (let r = 0; r < PLINKO.rows; r++) { const right = x <= 0 ? true : x >= (PLINKO.slots - 1) * 2 ? false : !!(k & (1 << r)); x += right ? 1 : -1; }
    out[x / 2] += 1 / (1 << PLINKO.rows);
  }
  return out;
}
export function create(type, rng) {
  const r = needRng(rng); return { type, vals: shuffle(PLINKO.vals.slice(), r), pts: { X: 0, O: 0 }, used: new Array(PLINKO.slots).fill(false), bonus: plinkoBonus(r), target: plinkoConfig().target, last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (!idx(PLINKO.slots)) return { ok: false, reason: 'bad' };
  if (mini.used[m]) return { ok: false, reason: 'used' };
  const { path, bin } = plinkoPath(m, needRng(rng));
  const was = mini.bonus, hit = !!was && plinkoTouches(m, path)[was.r - 1] === was.x, pts = mini.vals[bin] + (hit ? PLINKO.bonus : 0);
  mini.pts[p] += pts;
  mini.used[m] = true;
  const reset = mini.used.every(Boolean);
  if (reset) mini.used = new Array(PLINKO.slots).fill(false);        // all seven used: they all open again
  if (hit) mini.bonus = plinkoBonus(needRng(rng), was);            // a new bonus peg, there from the next turn
  mini.last = { by: p, slot: m, path, bin, pts, hit, bonus: { x: was.x, r: was.r }, reset };
  if (mini.pts[p] >= mini.target) return { ok: true, outcome: 'win', note: hit ? 'bonus' : 'drop' };
  return { ok: true, outcome: 'continue', note: hit ? 'bonus' : 'drop' };
}
export function publicView(mini) {
  return { type: 'plinko', vals: mini.vals.slice(), pts: { X: mini.pts.X, O: mini.pts.O }, used: mini.used.slice(), bonus: mini.bonus ? { x: mini.bonus.x, r: mini.bonus.r } : null, target: mini.target };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(plinkoOpen(mini));                      // a random open slot
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.plinko = { slot: l.slot, path: l.path.slice(), bin: l.bin, pts: l.pts, hit: l.hit, bonus: l.bonus, next: mini.bonus, reset: l.reset, total: mini.pts[l.by] }; return;
}
export function flashMs(f, winLen, won) {
  return PLINKO.rows * PLINKO.step + Math.max(PLINKO.land, PLINKO.pop) + (won ? 600 : 0);
}
// Super Chaos: both may drop from the same slot (it locks once). Each drop scores its own points; both
// touching the bonus peg get +2 each, and one new bonus peg appears for the next round.
export function scMerge(m, c) {
  const b = c.base;
  m.used = b.used.slice(); m.bonus = b.bonus;
  let hit = null;
  for (const p of [c.me].concat(c.played.filter(q => q !== c.me))) {
    if (!c.played.includes(p)) continue;
    const l = c.forks[p].last;
    if (!l) continue;
    m.used[l.slot] = true;
    if (l.hit && !hit) hit = c.forks[p].bonus;                     // (the player's own new peg, if they hit it: what they already see)
  }
  if (m.used.every(Boolean)) m.used = new Array(PLINKO.slots).fill(false);
  if (hit) m.bonus = { x: hit.x, r: hit.r };
}
