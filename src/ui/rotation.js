// The rotation (November 2026, a tester's four boards against the computer all dealt the same nine of the lineup's 18):
// every local board (Play Computer, the starter board's rematch, Same phone, a rematch) is dealt from all the games
// this player may play, the ones this phone was not dealt lately first (core/match.js dealNine's `recent`), so the
// whole lineup comes round before the same nine do. Kept on the device (KEY + '.recent'): the last BOARDS boards'
// games, most recent first. And never a game twice on a board while nine or more can be dealt (fillNine: the starter
// board's fixed nine, cut by a game not released here or not loaded yet, is topped up from the rest).
import { KEY } from './config.js';
import { randInt } from '../core/random.js';
import { abandonHeld } from '../net/tracking.js';

const RECENT_KEY = KEY + '.recent';
export const BOARDS = 3;                                       // (three boards back: with 18 games, two boards' worth are new before any comes round)
const read = () => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter(b => Array.isArray(b)).slice(0, BOARDS) : []; } catch (e) { return []; } };
// The games of the last boards, most recent first, each once.
export function recentTypes() {
  const out = [];
  for (const b of read()) for (const t of b) if (typeof t === 'string' && !out.includes(t)) out.push(t);
  return out;
}
// A board just dealt here: remembered (its nine games as dealt).
export function noteBoard(state) {
  if (!state || state.online || state.practice || !Array.isArray(state.squares)) return;
  const b = state.squares.map(q => q && q.mini && q.mini.type).filter(Boolean);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([b].concat(read()).slice(0, BOARDS))); } catch (e) { /* no storage: every board at random */ }
}
// Before a local deal: the recent games on the state for core/match.js startMatch.
// (and a local match held from before the page's load, not continued: given up now, net/tracking.js abandonHeld)
export function prepDeal(state) { abandonHeld(); state.recent = recentTypes(); }
// The games ticked (a map), topped up to nine from `allowed` where fewer than nine of them can be dealt: the ones not
// dealt lately first, then at random. Returns the map (changed in place).
export function fillNine(games, allowed, ok, rng) {
  const on = allowed.filter(t => games[t] && ok(t));
  if (on.length >= 9) return games;
  const rec = recentTypes(), rest = allowed.filter(t => !games[t] && ok(t));
  const fresh = rest.filter(t => !rec.includes(t)), old = rest.filter(t => rec.includes(t)).reverse();
  let need = 9 - on.length;
  for (const list of [fresh, old]) while (need > 0 && list.length) { games[list.splice(randInt(rng, list.length), 1)[0]] = true; need--; }
  return games;
}
