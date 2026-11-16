// Rematch as a best-of-3 (December 2026, CL-23): every rematch carries the series score; the first to 2 match wins
// takes it (a drawn match counts as played, nobody's win), and the Rematch after a series is over starts a new one.
// Local matches (against the computer, on one phone) keep it in the state: `a` is player one (the person against the
// computer; player 1 on a shared phone: setup.human, whatever side they draw), `b` the other. A friend room's is the
// server's (functions/index.js finishGame: rooms/{code}/series/{uid}, reset by the next startRoom once decided): both
// phones read the room, by account, so the sides drawn at random each match never mix it up.
import { other } from '../core/util.js';

export const SERIES_TO = 2;
export const freshSeries = () => ({ a: 0, b: 0, n: 0, last: null });
export const seriesOver = s => !!s && (s.a >= SERIES_TO || s.b >= SERIES_TO);
// The next match's series: a rematch carries one still running; one decided (or none) starts afresh.
export const nextSeries = s => (s && !seriesOver(s) ? Object.assign({}, s, { last: null }) : freshSeries());
// A finished local match counted once (key: the match's moves and result).
export function seriesRecord(state) {
  const s = state.series, w = state.winner;
  if (!s || state.online || state.practice || !w) return s;
  const key = `${state.moves}:${w}:${state.winReason || ''}`;
  if (s.last === key) return s;
  s.last = key; s.n += 1;
  const one = state.setup && state.setup.human;
  if (w === one) s.a += 1; else if (w === other(one)) s.b += 1;
  return s;
}
// The series as this phone shows it: { me, them, n, over, won } (me: this phone's player, or player one on a shared phone).
export function seriesView(state, lobby, myUid, theirUid) {
  if (state.online) {
    const sr = lobby && lobby.series;
    if (!sr || !myUid || !theirUid) return null;
    const me = sr[myUid] || 0, them = sr[theirUid] || 0, n = sr.n || 0;
    return n ? { me, them, n, over: me >= SERIES_TO || them >= SERIES_TO } : null;
  }
  const s = state.series;
  if (!s || !s.n) return null;
  return { me: s.a, them: s.b, n: s.n, over: seriesOver(s) };
}
// The head-to-head line ("You lead Sam 7–4"), from the opponents' tally (wins, losses for this player).
export function h2hLine(name, r) {
  if (!r) return '';
  const w = r.wins || 0, l = r.losses || 0;
  if (!w && !l) return '';
  return w > l ? `You lead ${name} ${w}–${l}` : l > w ? `${name} leads ${l}–${w}` : `You and ${name}: ${w}–${l}`;
}
