// What a finished (or abandoned) match adds to the anonymous game stats.
import { RUN_TYPES, runLog } from '../games/shared/runner.js';

// ---------- stats: what a finished (or abandoned) match adds to the anonymous game stats ----------
// Every mini-game played: how it ended ('won', 'draw' when it reset, or 'open' when the match ended
// first), who won it and the turns each side spent in it. A bonus move within a turn (a Risky Rolls roll,
// a Hangman letter after a hit) is part of the same turn.
export function matchStats(st) {
  const squares = (Array.isArray(st.sqlog) ? st.sqlog : []).map(e => Object.assign({ t: e.t, end: e.end, w: e.w || null, X: e.X || 0, O: e.O || 0 }, e.run ? { run: e.run } : {}));
  for (const sq of st.squares || []) {
    if (sq.owner || !sq.mv || !(sq.mv.X + sq.mv.O)) continue;
    squares.push(Object.assign({ t: sq.mini.type, end: 'open', w: null, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(sq.mini.type) ? runLog(sq.mini) : {}));
  }
  const turns = squares.reduce((n, e) => n + e.X + e.O, 0);
  return { squares, turns, winner: st.winner || null, reason: st.winReason || null, sc: !!st.sc };   // sc: a Super Chaos match (its squares counted apart)
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
