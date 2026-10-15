'use strict';
// The server's own rules, kept apart from the database so the tests can run them directly: usernames,
// ratings and matchmaking pairs. (The game's rules are in engine.js, shared with the page.)

// ---------- usernames ----------
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
// The profanity check. The word list is the standard English LDNOOBW list (badwords.js), plus a few
// words the game blocked before that the list lacks. A name and every listed word are normalised the
// same way: lower case, look-alike characters undone (0 o, 1 i, 3 e, 4 a, 5 s, 7 t, 8 b, @ a, $ s, ! i),
// then everything but letters dropped. A word of 4 or more letters is refused anywhere in the name
// ("xXfuckXx", "sh1tlord"), unless that spot is part of a common innocent word that contains it
// (ALLOW: Analyst, Button, Grape, Spoon, Peacock...). A word of 3 letters ("ass", "cum", "tit", "sex")
// hides inside far too many ordinary words (class, document, title, Essex), so it is refused only as a
// word of its own: between underscores or digits, or as one part of a CamelCase name ("Big_Ass", "BigAss").
const LIST = require('./badwords.js');
const EXTRA = ['fuk', 'nigg', 'retard', 'hitler', 'nazi'];                       // refused anywhere, as before
const EXTRA_TOKENS = ['kkk', 'chink', 'dyke', 'arse', 'piss', 'crap', 'damn', 'hoe', 'homo'];   // refused as words of their own, as before
const ALLOW = ['advertisement', 'amusement', 'basement', 'endorsement', 'reimbursement', 'among', 'amongst', 'mongoose', 'mongolia',
  'analog', 'analogue', 'analogy', 'analogous', 'analyse', 'analyze', 'analysis', 'analyst', 'analytic', 'canal', 'banal', 'manuscript', 'uranus', 'janus',
  'butte', 'butter', 'buttercup', 'butterfly', 'butterflies', 'butterscotch', 'button', 'buttress', 'rebuttal',
  'cockpit', 'cocktail', 'cockatoo', 'cockatiel', 'cockroach', 'cockney', 'peacock', 'hancock', 'hitchcock', 'woodcock', 'shuttlecock', 'gamecock',
  'dickens', 'dickinson', 'dickson', 'cummings', 'grape', 'grapefruit', 'grapevine', 'drape', 'draper', 'scrape', 'scraper', 'skyscraper', 'trapeze',
  'therapist', 'therapeutic', 'spice', 'spicy', 'aspic', 'hospice', 'suspicion', 'suspicious', 'auspicious', 'conspicuous',
  'spoon', 'teaspoon', 'tablespoon', 'spoonbill', 'lampoon', 'harpoon', 'raccoon', 'racoon', 'cocoon', 'tycoon', 'spoof', 'swank',
  'scatter', 'scathing', 'honeysuckle', 'milford', 'montenegro', 'pakistan', 'saltwater', 'socialism', 'socialist', 'socialise', 'socialize',
  'specialise', 'specialize', 'specialist', 'scunthorpe', 'pussycat'];
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i' };
const unleet = s => String(s).toLowerCase().replace(/[0134578@$!]/g, c => LEET[c] || c);
const flatten = s => unleet(s).replace(/[^a-z]/g, '');
const BAD = [...new Set(LIST.map(flatten).filter(w => w.length >= 4).concat(EXTRA))];
const BAD_TOKENS = new Set(LIST.map(flatten).filter(w => w.length === 3).concat(EXTRA_TOKENS));
const OK = ALLOW.map(flatten);
const RESERVED = ['admin', 'administrator', 'moderator', 'mod', 'computer', 'system', 'support', 'staff', 'official', 'tictacchaos', 'null', 'undefined', 'anonymous', 'guest'];
// Every place a word appears in s that no innocent word covers.
function badAt(s, w) {
  for (let i = s.indexOf(w); i >= 0; i = s.indexOf(w, i + 1)) {
    const covered = OK.some(a => { for (let j = s.indexOf(a); j >= 0 && j <= i; j = s.indexOf(a, j + 1)) if (j + a.length >= i + w.length) return true; return false; });
    if (!covered) return true;
  }
  return false;
}
// The banned word a name contains, or null.
function badWordIn(name) {
  const flat = flatten(name);
  const sub = BAD.find(w => badAt(flat, w));
  if (sub) return sub;
  const parts = String(name).replace(/([a-z])([A-Z])/g, '$1_$2').split(/[_0-9]+/).concat(String(name).split('_').map(unleet))
    .concat(String(name).replace(/([a-z0-9])([A-Z])/g, '$1_$2').split('_').map(unleet));
  const tok = parts.map(t => t.toLowerCase().replace(/[^a-z]/g, '')).find(t => BAD_TOKENS.has(t));
  return tok || null;
}
// Why a username cannot be used, or null when it can. The server checks every name claimed (the page
// shows the reason it gives back).
function usernameProblem(name) {
  if (typeof name !== 'string' || !name) return 'Pick a username';
  if (name.length < 3 || name.length > 16) return 'Use 3 to 16 characters';
  if (!USERNAME_RE.test(name)) return 'Use only letters, numbers and underscores';
  const low = name.toLowerCase(), flat = flatten(name);
  if (RESERVED.includes(low) || RESERVED.includes(flat)) return 'That username is reserved';
  if (badWordIn(name)) return 'Please pick another username';
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
// A match ends with a winner, X or O, or as a draw (winner 'draw': neither side could still make a line).
const HOW = { line: 'line', majority: 'majority', timeout: 'timeout', resign: 'resign' };
const decided = state => state.winner === 'X' || state.winner === 'O';
function howEnded(state) { return decided(state) ? HOW[state.winReason] || 'line' : 'draw'; }
function resultFor(state, side) { return !decided(state) ? 'draw' : state.winner === side ? 'win' : 'loss'; }

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

// Games played as X and as O, recounted from a player's history (the back-fill): { main, friend, local },
// each { X: record, O: record } as recordDelta adds them up. skip(h): an entry left out (a match against a
// bot, when those are kept out of the records).
function recountSides(entries, skip) {
  const blank = () => ({ X: { wins: 0, losses: 0, draws: 0, games: 0 }, O: { wins: 0, losses: 0, draws: 0, games: 0 } });
  const out = { main: blank(), friend: blank(), local: blank() };
  for (const h of entries) {
    if (!h || !['win', 'loss', 'draw'].includes(h.result) || (h.side !== 'X' && h.side !== 'O')) continue;
    const k = h.mode === 'friend' ? 'friend' : h.mode === 'local' ? 'local' : FIND_MATCH_MODES.includes(h.mode) ? 'main' : null;
    if (!k || (skip && skip(h))) continue;
    const d = recordDelta(h.result), r = out[k][h.side];
    for (const f of Object.keys(r)) r[f] += d[f];
  }
  return out;
}

// ---------- local matches (a logged-in player's own record of games on one phone) ----------
// A local match as the phone reports it once it is over: checked, and trimmed to what the history
// keeps. The player is player 1, on `side`. A match that ended on the board must have the result the
// board shows (a line, or a draw once no line was open to either side; 'majority' from before that rule);
// one that was left ("resign") must have been left by that player. types: the mini-games allowed;
// mainResult: the engine's main-board result (majorityResult: the old rule).
const LOCAL_REASONS = ['line', 'blocked', 'majority', 'resign'];
function checkLocal(d, types, mainResult, majorityResult) {
  if (!d || typeof d !== 'object') return null;
  const id = typeof d.id === 'string' && /^[-\w]{6,48}$/.test(d.id) ? d.id : null;
  const side = d.side === 'X' || d.side === 'O' ? d.side : null, f = d.final;
  if (!id || !side || !f || typeof f !== 'object' || !Array.isArray(f.squares) || f.squares.length !== 9) return null;
  let size = 0;
  try { size = JSON.stringify(f).length; } catch (e) { return null; }
  if (size > 60000) return null;
  for (const sq of f.squares) if (!sq || typeof sq !== 'object' || ![undefined, null, 'X', 'O'].includes(sq.owner) || !sq.mini || !types.includes(sq.mini.type)) return null;
  const winner = ['X', 'O', 'draw'].includes(f.winner) ? f.winner : null, reason = LOCAL_REASONS.includes(f.winReason) ? f.winReason : null;
  if (!winner || !reason) return null;
  if (reason === 'resign') { if (f.resigned !== side || winner !== (side === 'X' ? 'O' : 'X')) return null; }
  else {
    const mr = reason === 'majority' ? majorityResult && majorityResult(f.squares) : mainResult(f.squares);
    if (!mr || mr.winner !== winner || mr.reason !== reason) return null;
  }
  const o = side === 'X' ? 'O' : 'X', opp = d.opponent && typeof d.opponent === 'object' ? d.opponent : {};
  const clean = v => String(v == null ? '' : v).trim().slice(0, 12);
  const names = { [side]: clean(f.names && f.names[side]) || side, [o]: clean(opp.name) || clean(f.names && f.names[o]) || o };
  const final = { squares: f.squares, winner, winLine: Array.isArray(f.winLine) ? f.winLine : null, winReason: reason, resigned: reason === 'resign' ? side : null,
    counts: f.counts || null, moves: Number.isInteger(f.moves) ? f.moves : 0, games: Array.isArray(f.games) ? f.games.filter(t => types.includes(t)) : null, names };
  return { id, side, cpu: opp.cpu === true, opponent: names[o], final };
}

module.exports = {
  LOCAL_REASONS, checkLocal,
  USERNAME_RE, usernameProblem, unleet, flatten, badWordIn, BAD, BAD_TOKENS, ALLOW, RATINGS_ENABLED, ELO_K, START_RATING, LEADERBOARD_MIN_GAMES, expected, elo,
  FIND_MATCH_TIMER, FIND_MATCH_MODES, QUEUES, queueKey, ratingRange, pairQueue, howEnded, resultFor,
  recordDelta, squaresFor, recountHistory, recountSides,
};
