'use strict';
// The server's own rules, kept apart from the database so the tests can run them directly: usernames,
// ratings and matchmaking pairs. (The game's rules are in engine.js, shared with the page.)

// ---------- usernames ----------
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
// A basic profanity filter. Words in BANNED are refused anywhere in a name (after undoing common
// letter swaps such as 0 for o and $ for s); words in BANNED_TOKENS only as a whole word between
// underscores or digits, because they also hide inside ordinary words (class, peacock, grape).
const BANNED = ['fuck', 'fuk', 'shit', 'cunt', 'nigg', 'whore', 'slut', 'bitch', 'pussy', 'penis', 'vagina', 'wank', 'twat',
  'bastard', 'asshole', 'retard', 'porn', 'hitler', 'nazi', 'kike', 'faggot', 'dildo', 'jizz', 'boner', 'blowjob', 'handjob'];
const BANNED_TOKENS = ['ass', 'arse', 'cock', 'dick', 'fag', 'sex', 'tit', 'tits', 'cum', 'rape', 'spic', 'chink', 'dyke', 'homo', 'piss', 'crap', 'damn', 'hoe', 'nude', 'kkk'];
const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'computer', 'system', 'support', 'staff', 'official', 'tictacchaos', 'null', 'undefined', 'anonymous', 'guest'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };
const unleet = s => s.toLowerCase().replace(/[01345789@$!]/g, c => LEET[c] || c);
// Why a username cannot be used, or null when it can.
function usernameProblem(name) {
  if (typeof name !== 'string' || !name) return 'Pick a username';
  if (name.length < 3 || name.length > 16) return 'Use 3 to 16 characters';
  if (!USERNAME_RE.test(name)) return 'Use only letters, numbers and underscores';
  const low = name.toLowerCase(), flat = unleet(name).replace(/_/g, '');
  if (RESERVED.includes(low) || RESERVED.includes(flat)) return 'That username is reserved';
  if (BANNED.some(w => flat.includes(w) || low.replace(/_/g, '').includes(w))) return 'Please pick another username';
  const tokens = low.split(/[_0-9]+/).filter(Boolean).concat(low.split('_').map(unleet));
  if (tokens.some(t => BANNED_TOKENS.includes(t))) return 'Please pick another username';
  return null;
}

// ---------- ratings: standard Elo ----------
// Ratings and the leaderboard are switched off for now: no rating is calculated, changed or sent, and
// matchmaking pairs by wait time alone. The Elo and leaderboard code stays, behind this flag (the page
// has the same flag).
const RATINGS_ENABLED = false;
const ELO_K = 32;
const START_RATING = 1200;
const LEADERBOARD_MIN_GAMES = 5;
function expected(ra, rb) { return 1 / (1 + Math.pow(10, (rb - ra) / 400)); }
// New ratings after a game. scoreX: 1 when X won, 0 when O won, 0.5 for a draw.
function elo(rx, ro, scoreX, k = ELO_K) {
  return {
    X: Math.round(rx + k * (scoreX - expected(rx, ro))),
    O: Math.round(ro + k * ((1 - scoreX) - expected(ro, rx))),
  };
}

// ---------- matchmaking ----------
// Find Match is one queue, with 1 minute a turn. Its games are 'match' games (rated 'ranked' ones if
// ratings come back). Older games were 'ranked' or 'casual': all of them count as Find Match games.
const FIND_MATCH_TIMER = 60;
const QUEUES = { match: { key: 'match', mode: RATINGS_ENABLED ? 'ranked' : 'match', timer: FIND_MATCH_TIMER } };
const FIND_MATCH_MODES = ['match', 'ranked', 'casual'];
function queueKey() { return 'match'; }                        // whatever an older page asks for: the one queue
// How far apart two ratings may be, given how long the longer-waiting of the two has been searching:
// close at first, wider every few seconds, and anyone at all after a minute and a half.
function ratingRange(waitMs) { return waitMs >= 90000 ? Infinity : 100 + 50 * Math.floor(Math.max(0, waitMs) / 5000); }
// Pairs from a queue ({ uid: { rating, since, game? } }), each player in at most one pair. With ratings
// on: every allowed pair, closest in rating first (the longer wait breaking a tie). With ratings off: by
// wait time alone, the longest-waiting two together, then the next two.
function pairQueue(queue, now, byRating = RATINGS_ENABLED) {
  if (!byRating) {
    const waiting = Object.entries(queue || {}).filter(([, e]) => e && !e.game && Number.isFinite(e.since)).sort((a, b) => a[1].since - b[1].since || (a[0] < b[0] ? -1 : 1));
    const pairs = [];
    for (let k = 0; k + 1 < waiting.length; k += 2) pairs.push([waiting[k][0], waiting[k + 1][0]]);
    return pairs;
  }
  const waiting = Object.entries(queue || {}).filter(([, e]) => e && !e.game && Number.isFinite(e.rating));
  const cands = [];
  for (let i = 0; i < waiting.length; i++) {
    for (let j = i + 1; j < waiting.length; j++) {
      const [ua, a] = waiting[i], [ub, b] = waiting[j];
      const gap = Math.abs(a.rating - b.rating), first = Math.min(a.since, b.since);
      if (gap <= ratingRange(now - first)) cands.push({ ua, ub, gap, first });
    }
  }
  cands.sort((x, y) => x.gap - y.gap || x.first - y.first || (x.ua + x.ub < y.ua + y.ub ? -1 : 1));
  const used = new Set(), pairs = [];
  for (const c of cands) {
    if (used.has(c.ua) || used.has(c.ub)) continue;
    used.add(c.ua); used.add(c.ub);
    pairs.push([c.ua, c.ub]);
  }
  return pairs;
}

// ---------- results ----------
const HOW = { line: 'line', majority: 'majority', timeout: 'timeout', resign: 'resign' };
function howEnded(state) { return state.winner ? HOW[state.winReason] || 'line' : 'draw'; }
function resultFor(state, side) { return !state.winner ? 'draw' : state.winner === side ? 'win' : 'loss'; }

// ---------- records and per-mini-game stats ----------
// A finished match from one side: its result for the record ({ wins, losses, draws, games }, one of the
// first three set) and the squares it won and lost, by mini-game ({ type: { won, lost } }).
function recordDelta(result) { return { wins: result === 'win' ? 1 : 0, losses: result === 'loss' ? 1 : 0, draws: result === 'draw' ? 1 : 0, games: 1 }; }
function squaresFor(squares, side) {
  const out = {};
  for (const sq of squares || []) {
    if (!sq || !sq.owner || !sq.mini || typeof sq.mini.type !== 'string') continue;
    const k = sq.owner === side ? 'won' : 'lost';
    (out[sq.mini.type] = out[sq.mini.type] || { won: 0, lost: 0 })[k]++;
  }
  return out;
}
// Records and per-mini-game stats recounted from a player's game history (the back-fill): the main
// record from Find Match games, the friends record from friend-code games, the squares from both.
function recountHistory(entries) {
  const main = { wins: 0, losses: 0, draws: 0, games: 0 }, friend = { wins: 0, losses: 0, draws: 0, games: 0 }, minis = {};
  for (const h of entries) {
    if (!h || !['win', 'loss', 'draw'].includes(h.result)) continue;
    const rec = h.mode === 'friend' ? friend : FIND_MATCH_MODES.includes(h.mode) ? main : null;
    if (!rec) continue;
    const d = recordDelta(h.result);
    for (const k of Object.keys(rec)) rec[k] += d[k];
    let final = null;
    try { final = typeof h.final === 'string' ? JSON.parse(h.final) : h.final; } catch (e) { final = null; }
    if (final && (h.side === 'X' || h.side === 'O')) {
      for (const [t, v] of Object.entries(squaresFor(final.squares, h.side))) {
        const m = (minis[t] = minis[t] || { won: 0, lost: 0 });
        m.won += v.won; m.lost += v.lost;
      }
    }
  }
  return { main, friend, minis };
}

module.exports = {
  USERNAME_RE, usernameProblem, unleet, RATINGS_ENABLED, ELO_K, START_RATING, LEADERBOARD_MIN_GAMES, expected, elo,
  FIND_MATCH_TIMER, FIND_MATCH_MODES, QUEUES, queueKey, ratingRange, pairQueue, howEnded, resultFor,
  recordDelta, squaresFor, recountHistory,
};
