// Seating: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { randInt } from '../../core/random.js';
import { seatCfg, seatMate, seatPick, seatTables } from './rules.js';

export function needs(pm, p) {
  const o = other(p), e = pm.who.filter(w => !w).length, half = q => pm.who.filter((w, i) => w === q && !pm.who[seatMate(i)]).length; return e ? raceNeeds(seatTables(pm.who, p) - seatTables(pm.who, o) + 0.4 * (half(p) - half(o)), e / 4, 1) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const cf = seatCfg(pm), e = pm.who.map((w, i) => (w ? -1 : i)).filter(i => i >= 0);
  const b = cf.miss && rng() < cf.miss / 100 ? { move: e[randInt(rng, e.length)] } : ctx && ctx.level === 'hard' ? seatExpecti(pm, me, cf, ctx.until) : seatPick(pm, me, rng), a = Object.assign({}, pm, { who: pm.who.slice() }); a.who[b.move] = me; return { move: b.move, after: a, win: seatTables(a.who, me) >= cf.goal };   // (the admin's settings: a mistake now and then, any empty seat)
}

// ---- Hard: expectimax over the customer ----
// Every seat for the mover, then every seat the customer could take (and, with another move to search, every
// colour the next one could be), the other player's reply, its customer, and so on: two moves deep (deeper
// while the clock allows), the leaves valued by the tables held and the half-tables kept, each less the
// chance the customer spoils it; the rule's own result (five tables, or most once the room is full, a tie
// a reset) where it comes; a memo of the positions met.
export function seatExpecti(pm, me, cf, until) {
  const who = pm.who.slice(), color = pm.color, n = who.length, o = other(me), goal = cf.goal;
  let nodes = 0, out = false;
  const tick = () => { if (until && (++nodes & 255) === 0 && until() <= 0) out = true; };
  const tables = p => { let t = 0; for (let i = 0; i < n; i += 2) if (who[i] === p && who[i + 1] === p) t++; return t; };
  const colours = () => { const c = []; for (let i = 0; i < n; i++) if (!who[i] && !c.includes(color[i])) c.push(color[i]); return c; };
  const leaf = next => {                                         // next: the customer's colour, or null for any with a seat
    const open = next == null ? colours() : null, of = c => { let k = 0; for (let i = 0; i < n; i++) if (!who[i] && color[i] === c) k++; return k; };
    let v = tables(me) - tables(o);
    for (let i = 0; i < n; i++) {
      const w = who[i]; if (w !== me && w !== o) continue;
      const j = seatMate(i); if (who[j]) continue;
      const risk = open ? 1 / (open.length * of(color[j])) : color[j] === next ? 1 / of(next) : 0;   // the customer takes the other seat
      v += (w === me ? 0.5 : -0.5) * (1 - risk);
    }
    return Math.max(-0.9, Math.min(0.9, v / 3));
  };
  const memo = new Map();
  // the value for me with p to move and the customer's colour next (null: to be drawn: the average), e seats empty
  const node = (p, next, depth, e) => {
    if (next == null) { const cs = colours(); let v = 0; for (const c of cs) v += node(p, c, depth, e) / cs.length; return v; }
    if (depth === 0) return leaf(next);
    const key = who.map(w => w || '.').join('') + next + p + depth;
    const got = memo.get(key); if (got !== undefined) return got;
    tick();
    let bestV = p === me ? -Infinity : Infinity;
    for (let m = 0; m < n && !out; m++) {
      if (who[m]) continue;
      const v = after(m, p, next, depth, e);
      if (p === me ? v > bestV : v < bestV) bestV = v;
    }
    if (!out) memo.set(key, bestV);
    return bestV;
  };
  const full = () => { const a = tables(me), b = tables(o); return a > b ? 1 : b > a ? -1 : 0; };
  const after = (m, p, next, depth, e) => {                     // p sits at m: the square won, or the customer, then on
    who[m] = p;
    let v;
    if (tables(p) >= goal) v = p === me ? 1 : -1;
    else if (e === 1) v = full();
    else {
      const seats = []; for (let i = 0; i < n; i++) if (!who[i] && color[i] === next) seats.push(i);
      if (!seats.length) v = depth > 1 ? node(other(p), null, depth - 1, e - 1) : leaf(null);   // none of their colour: they leave
      else {
        v = 0;
        for (const z of seats) { who[z] = 'Z'; v += (e === 2 ? full() : depth > 1 ? node(other(p), null, depth - 1, e - 2) : leaf(null)) / seats.length; who[z] = null; if (out) break; }
      }
    }
    who[m] = null;
    return v;
  };
  const empty = who.filter(w => !w).length;
  const pick = depth => {
    let top = null;
    for (let m = 0; m < n && !out; m++) {
      if (who[m]) continue;
      const v = after(m, me, pm.next, depth, empty);
      if (!top || v > top.v) top = { move: m, v };
    }
    return top;
  };
  let got = null;
  if (!until) got = pick(2);
  else for (let d = 1; !out && d <= empty; d++) { const r = pick(d); if (!out || !got) got = r; }
  if (!got) got = pick(1);
  return got;
}
