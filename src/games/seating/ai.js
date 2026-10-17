// Seating: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { SEAT, seatMate, seatPick, seatTables } from './rules.js';

export function needs(pm, p) {
  const o = other(p), e = pm.who.filter(w => !w).length, half = q => pm.who.filter((w, i) => w === q && !pm.who[seatMate(i)]).length; return e ? raceNeeds(seatTables(pm.who, p) - seatTables(pm.who, o) + 0.4 * (half(p) - half(o)), e / 4, 1) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const b = seatPick(pm, me, rng), a = Object.assign({}, pm, { who: pm.who.slice() }); a.who[b.move] = me; return { move: b.move, after: a, win: seatTables(a.who, me) >= SEAT.goal };
}
