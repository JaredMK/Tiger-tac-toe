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
  const b = cf.miss && rng() < cf.miss / 100 ? { move: e[randInt(rng, e.length)] } : seatPick(pm, me, rng), a = Object.assign({}, pm, { who: pm.who.slice() }); a.who[b.move] = me; return { move: b.move, after: a, win: seatTables(a.who, me) >= cf.goal };   // (the admin's settings: a mistake now and then, any empty seat)
}
