// A player's numbers as the server keeps them (users/{uid}: Find Match at the top, friend games under
// `friend`; localStats/{uid}: the local games), added up for one view: 'online' (Find Match and friends),
// 'local' or 'all'. The profile shows the record; the admin's player detail (admin.html) the record by
// side and the squares per mini-game too. Pure: no page, no database (admin.html imports it as it is).
import { INFO, TYPES } from '../games/index.js';

const KEYS = ['wins', 'losses', 'draws'];
// wins-losses-draws of several records together
export const sumRec = (...rs) => rs.reduce((t, r) => { r = r || {}; for (const k of KEYS) t[k] += r[k] || 0; return t; }, { wins: 0, losses: 0, draws: 0 });
export const games = r => (r ? (r.wins || 0) + (r.losses || 0) + (r.draws || 0) : 0);
export const recText = r => { r = r || {}; return `${r.wins || 0}-${r.losses || 0}-${r.draws || 0}`; };   // wins-losses-draws
export const winPct = r => { const g = games(r); return g ? Math.round(100 * ((r && r.wins) || 0) / g) + '%' : '–'; };   // of all games, draws included

// The record of one view (loc: the player's localStats, null where it is not to be read).
export function viewRec(u, loc, view) {
  u = u || {}; loc = loc || {};
  const online = sumRec(u, u.friend);
  return view === 'local' ? sumRec(loc) : view === 'all' ? sumRec(online, loc) : online;
}
// Games played as X and as O: { X: {wins, losses, draws}, O: … }.
export function viewSides(u, loc, view) {
  u = u || {}; loc = loc || {};
  const add = (...ss) => ({ X: sumRec(...ss.map(x => x && x.X)), O: sumRec(...ss.map(x => x && x.O)) });
  const fs = u.friend && u.friend.sides;
  return view === 'local' ? add(loc.sides) : view === 'all' ? add(u.sides, fs, loc.sides) : add(u.sides, fs);
}
// Squares won and lost per mini-game, most won first: [{ t, name, won, lost }]. A square counts once it
// ended claimed by X or O (the server counts no other); only the games in the pool (not Hexapawn or the
// Dice race, whose numbers stay in the database).
export function viewMinis(u, loc, view) {
  u = u || {}; loc = loc || {};
  const out = {};
  for (const m of view === 'local' ? [loc.minis] : view === 'all' ? [u.minis, loc.minis] : [u.minis])
    for (const [t, v] of Object.entries(m || {})) { const o = (out[t] = out[t] || { won: 0, lost: 0 }); o.won += (v && v.won) || 0; o.lost += (v && v.lost) || 0; }
  return Object.entries(out).filter(([t]) => TYPES.includes(t)).map(([t, v]) => ({ t, name: INFO[t].name, won: v.won, lost: v.lost }))
    .filter(r => r.won + r.lost).sort((a, b) => b.won - a.won || a.lost - b.lost || a.name.localeCompare(b.name));
}
