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
  const b = cf.miss && rng() < cf.miss / 100 ? { move: e[randInt(rng, e.length)] } : ctx && ctx.level === 'hard' ? seatHard(pm, me, cf, ctx.until) : seatPick(pm, me, rng), a = Object.assign({}, pm, { who: pm.who.slice() }); a.who[b.move] = me; return { move: b.move, after: a, win: seatTables(a.who, me) >= cf.goal };   // (the admin's settings: a mistake now and then, any empty seat)
}

// ---- Hard: the customer counted, the last seats solved ----
// Either side can always hold the other to no table (sit in the other seat of its half-table), so with best play by
// both a square is level; it is won from a side that lets a table through. So the search plays two things at once:
// the value under best play (never a line that loses to the right reply while a safe one is there), and, between
// moves that hold as much, the one that leaves the other side the most to get wrong: the other side's reply can be
// reckoned as its best with SEAT_AI.slip of the weight on the average of its seats (a player who slips now and then).
// Measured against the search as it was (10,000 squares each): no slip won 103 and lost 2, a slip of 0.12 won 104 and
// lost 14, so slip is 0 (best play alone).
// Every seat for the mover, then every seat the customer could take and every colour the next could be, and so on:
// with SEAT_AI.solve seats empty or fewer to the room's end, exactly (a memo of the positions met); above that a few
// moves deep (deeper while the clock allows), the leaves valued by the tables held and the half-tables open: taken
// in turn, the side to move first, each completes its own or sits in the other's (seatTrade), less the customer's
// chance of spoiling each.
export const SEAT_AI = { solve: 8, depth: 2, deep: 12, slip: 0, scale: 0.9 };   // solve: seats empty at most for the exact solve with no clock; depth: the moves searched above that (one more with `deep` seats empty or fewer); slip: the other side's share of careless replies in the reckoning (0: its best always)
// Half-tables taken in turn: what the side to move nets with a of its own open and b of the other side's.
const TRADE = [];
function seatTrade(a, b) {
  if (a > 6) a = 6; if (b > 6) b = 6;
  const k = a * 7 + b; if (TRADE[k] !== undefined) return TRADE[k];
  let v = a || b ? -Infinity : 0;
  if (a) v = Math.max(v, 1 - seatTrade(b, a - 1));
  if (b) v = Math.max(v, -seatTrade(b - 1, a));
  return (TRADE[k] = v);
}
export function seatHard(pm, me, cf, until) {
  const n = pm.who.length, color = pm.color, o = other(me), goal = cf.goal, eps = SEAT_AI.slip;
  const who = new Int8Array(n);                                  // 0 empty, 1 mine, 2 theirs, 3 a customer
  const cnt = []; let open = 0, empty = 0, code = 0, t1 = 0, t2 = 0;
  const P4 = []; for (let i = 0, x = 1; i < n; i++, x *= 4) P4.push(x);
  for (let i = 0; i < n; i++) { const w = pm.who[i]; who[i] = !w ? 0 : w === me ? 1 : w === o ? 2 : 3; code += who[i] * P4[i]; if (!w) { cnt[color[i]] = (cnt[color[i]] || 0) + 1; empty++; } }
  for (let c = 0; c < cnt.length; c++) { if (cnt[c]) open++; else cnt[c] = 0; }
  for (let i = 0; i < n; i += 2) if (who[i] === who[i + 1]) { if (who[i] === 1) t1++; else if (who[i] === 2) t2++; }
  const sit = (i, w) => { who[i] = w; code += w * P4[i]; if (--cnt[color[i]] === 0) open--; if (w !== 3 && who[i ^ 1] === w) { if (w === 1) t1++; else t2++; } };
  const rise = i => { const w = who[i]; if (w !== 3 && who[i ^ 1] === w) { if (w === 1) t1--; else t2--; } who[i] = 0; code -= w * P4[i]; if (cnt[color[i]]++ === 0) open++; };
  const kind = i => color[i] * 8 + (who[i ^ 1] ? 4 + who[i ^ 1] : color[i ^ 1]);   // an empty seat's kind: its colour and its table's other seat (who is there, else its colour)
  let nodes = 0, out = false;
  const tick = () => { if (until && (++nodes & 127) === 0 && until() <= 0) out = true; };
  const full = () => (t1 > t2 ? 1 : t2 > t1 ? -1 : 0);
  // a position's worth for me, `side` to move, the next customer's colour not drawn yet
  const leaf = side => {
    let a = 0, b = 0;                                            // the half-tables open, each less the customer's chance of taking its other seat
    for (let i = 0; i < n; i++) {
      const w = who[i]; if (w !== 1 && w !== 2 || who[i ^ 1]) continue;
      const keep = 1 - 1 / (open * cnt[color[i ^ 1]]);
      if (w === 1) a += keep; else b += keep;
    }
    const ra = Math.round(a), rb = Math.round(b);
    const tr = side === 1 ? seatTrade(ra, rb) : -seatTrade(rb, ra);
    const e = t1 - t2 + 0.8 * tr + 0.1 * (a - b);
    const x = Math.exp(2 * SEAT_AI.scale * e); return 0.9 * (x - 1) / (x + 1);
  };
  const memo = new Map();
  // the value for me with `side` to move, the customer's colour `next`, e seats empty, `depth` moves still searched
  const node = (side, next, depth, e) => {
    const whole = depth >= e, key = ((whole ? 0 : depth) * 8 + next * 2 + side - 1) + code * 512;
    const got = memo.get(key); if (got !== undefined) return got;
    tick(); if (out) return 0;
    let bestV = side === 1 ? -Infinity : Infinity, sum = 0, k = 0;
    const cl = [], cv = [];                                      // seats of one colour whose tables stand alike are alike: one is searched for all
    for (let m = 0; m < n; m++) {
      if (who[m]) continue;
      const c = kind(m), at = cl.indexOf(c), v = at >= 0 ? cv[at] : after(m, side, next, depth, e);
      if (at < 0) { cl.push(c); cv.push(v); if (side === 1 ? v > bestV : v < bestV) bestV = v; }
      sum += v; k++;
    }
    if (side === 2 && eps) bestV = (1 - eps) * bestV + eps * sum / k;   // (the other side: its best, a slip now and then)
    if (!out) memo.set(key, bestV);
    return bestV;
  };
  // the next customer's colour is drawn (each colour with a seat as likely), then `side` moves
  const draw = (side, depth, e) => {
    if (depth <= 0) return leaf(side);
    let v = 0; for (let c = 0; c < cnt.length; c++) if (cnt[c]) v += node(side, c, depth, e);
    return v / open;
  };
  // side sits at m: the square won, or the customer (colour `next`), then on
  const after = (m, side, next, depth, e) => {
    sit(m, side);
    let v;
    if ((side === 1 ? t1 : t2) >= goal) v = side === 1 ? 1 : -1;
    else if (e === 1) v = full();
    else if (!cnt[next]) v = draw(3 - side, depth - 1, e - 1);   // none of their colour: they leave
    else {
      v = 0; const k = cnt[next];
      const cl = [], cv = [];
      for (let z = 0; z < n; z++) {
        if (who[z] || color[z] !== next) continue;
        const c = kind(z), at = cl.indexOf(c);
        if (at >= 0) { v += cv[at]; continue; }
        sit(z, 3); const x = e === 2 ? full() : draw(3 - side, depth - 1, e - 2); rise(z);
        cl.push(c); cv.push(x); v += x;
      }
      v /= k;
    }
    rise(m);
    return v;
  };
  const pick = depth => {
    let top = null;
    for (let m = 0; m < n && !out; m++) {
      if (who[m]) continue;
      const v = after(m, 1, pm.next, depth, empty);
      if (out) break;                                            // (the clock: this seat's value is not whole)
      if (!top || v > top.v + 1e-9) top = { move: m, v };
    }
    return top;
  };
  let got = null;
  if (!until) got = pick(empty <= SEAT_AI.solve ? empty : empty <= SEAT_AI.deep ? SEAT_AI.depth + 1 : SEAT_AI.depth);
  else { for (let d = 1; !out && d < empty && d <= 6; d++) { const r = pick(d); if (!out || !got) got = r; } if (!out) { const ex = pick(empty); if (!out && ex) got = ex; } }
  if (!got) return seatPick(pm, me, null);                       // (no time at all: the ordinary pick)
  return got;
}
