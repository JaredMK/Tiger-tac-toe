// What a finished (or abandoned) match adds to the anonymous game stats.
import { sqEntry } from './board.js';
import { miniVersion } from './tune.js';

// ---------- stats: what a finished (or abandoned) match adds to the anonymous game stats ----------
// Every mini-game played: how it ended ('won', 'draw' when it reset, or 'open' when the match ended
// first), who won it and the turns each side spent in it. A bonus move within a turn (a Risky Rolls roll,
// a Hangman letter after a hit) is part of the same turn.
// Each play's line is core/board.js sqEntry's (the settings version v, the first mover f, the time ms, the square i, the pick
// number k, oj, s, e, the sides' time, follows and timeouts); a play still open when the match ended ('open': left unfinished)
// is read off its square the same way, in the order the plays began (k). Also the match's own facts (December 2026): mp, the side
// that reached match point first (mpn: at which move), and tmo, each side's turns missed on the board (timer.timeouts).
export function matchStats(st) {
  const squares = (Array.isArray(st.sqlog) ? st.sqlog : []).map(e => Object.assign({}, e, { w: e.w || null, X: e.X || 0, O: e.O || 0, v: Number.isInteger(e.v) && e.v >= 1 ? e.v : 1 }));
  (st.squares || []).forEach((sq, i) => {
    if (!sq || sq.owner || !sq.mv || !(sq.mv.X + sq.mv.O)) return;
    squares.push(sqEntry(sq, sq.mini, 'open', null, i, undefined, st));
  });
  if (squares.every(e => Number.isInteger(e.k))) squares.sort((a, b) => a.k - b.k);   // (in the order the plays began; a match from before has no k: as it was)
  const turns = squares.reduce((n, e) => n + e.X + e.O, 0);
  const tmo = st.timer && st.timer.timeouts ? { X: st.timer.timeouts.X || 0, O: st.timer.timeouts.O || 0 } : null;
  return Object.assign({ squares, turns, winner: st.winner || null, reason: st.winReason || null, sc: !!st.sc, sv: boardVersions(st) },   // sc: a Super Chaos match (its squares counted apart); sv: every game's settings version on its board
    st.mp ? { mp: st.mp, mpn: st.mpn } : {}, tmo && (tmo.X || tmo.O) ? { tmo } : {});
}
// The settings version of every mini-game on a match's board (December 2026): the squares on it now and every one played
// out of it ({ type: version }; a type dealt under two versions keeps the higher).
export function boardVersions(st) {
  const out = {};
  const put = (t, v) => { if (typeof t === 'string') out[t] = Math.max(out[t] || 1, Number.isInteger(v) && v >= 1 ? v : 1); };
  for (const e of Array.isArray(st.sqlog) ? st.sqlog : []) put(e.t, e.v);
  for (const sq of st.squares || []) if (sq && sq.mini) put(sq.mini.type, miniVersion(sq.mini));
  return out;
}

// ---------- Top opponents: a player's record against each person they have played online ----------
// oppStats/{uid}/{opponent's uid}: { name, wins, losses, draws, last }, kept by the server where a result is
// recorded (Find Match and friend rooms); never a bot, the computer or a friend without an account.
// The n most played: most games first, then the latest played, then by name.
export function topOpponents(tally, n = 3) {
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return Object.entries(tally && typeof tally === 'object' ? tally : {}).map(([uid, v]) => {
    v = v || {};
    const r = { uid, name: String(v.name || '?'), wins: num(v.wins), losses: num(v.losses), draws: num(v.draws), last: num(v.last) };
    r.games = r.wins + r.losses + r.draws;
    return r;
  }).filter(r => r.games > 0).sort((a, b) => b.games - a.games || b.last - a.last || a.name.localeCompare(b.name)).slice(0, n);
}
// The same tally counted from a player's game history (scripts/backfill-opponents.js): online games against
// someone with an account only; skip(h) leaves a game out (one against a bot). The latest name is kept.
export function oppTally(entries, skip) {
  const out = {};
  for (const h of entries || []) {
    const o = h && h.opponent, uid = o && o.uid;
    if (!uid || h.mode === 'local' || o.cpu || (skip && skip(h))) continue;
    const k = h.result === 'win' ? 'wins' : h.result === 'loss' ? 'losses' : h.result === 'draw' ? 'draws' : null;
    if (!k) continue;
    const r = (out[uid] = out[uid] || { name: '', wins: 0, losses: 0, draws: 0, last: 0 }), at = Number(h.date) || 0;
    r[k]++;
    if (at >= r.last) { r.last = at; r.name = String(o.name || r.name || '?'); }
  }
  return out;
}
