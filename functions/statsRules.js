'use strict';
/* The anonymous game stats: what one event adds to the totals. Pure (no database here), so the rules
 * can be tested on their own; functions/index.js applies the result as atomic increments.
 *
 * stats/ (readable by the admin only, written only by the server)
 *   mini/{mode}/{type}     played, won, draw (reset), open (match ended first), winMoves, loseMoves,
 *                          allMoves, xWins, oWins: sums, averaged on the dashboard (mode 'testing': the
 *                          squares of games that were admin only when the match ended, kept apart)
 *   modes/{mode}           started, finished, resigned, timeouts, turns, ms, timed (matches with a time),
 *                          xWins, oWins, draws (no line left for either side)
 *   days/{YYYY-MM-DD}      logins, active, newAccounts, started/{mode}, finished/{mode}
 *   weeks/{YYYY-Www}       logins, active, newAccounts
 *   months/{YYYY-MM}       logins, active, newAccounts
 * "Moves" in a mini-game are the turns a side spent in it: a Risky Rolls roll or a Hangman letter that earns
 * another go is part of the same turn. Players are counted as active by a one-way hash of their account
 * or of a random id their browser made up; nothing else about them is stored.
 */
const crypto = require('node:crypto');

const MODES = ['local', 'cpu', 'cvc', 'friend', 'match', 'bot', 'casual', 'ranked'];   // two people on one phone, vs the computer, computer vs computer, friend code, Find Match, Find Match against a bot (casual and ranked: before it was one queue)
const CLIENT_MODES = ['local', 'cpu', 'cvc'];                          // the ones a phone reports; the server records the online ones itself
const MAX_MS = 3 * 3600 * 1000;                                        // a match "lasting" longer was left and picked up again: no time for it
const ENDS = ['won', 'draw', 'open'];
const REASONS = ['line', 'blocked', 'majority', 'resign', 'timeout'];

const pad = n => String(n).padStart(2, '0');
// The day, ISO week and month of a time, in UTC.
function periodKeys(t) {
  const d = new Date(t);
  const day = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const th = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  th.setUTCDate(th.getUTCDate() + 4 - (th.getUTCDay() || 7));            // the Thursday of this week decides its year
  const y0 = new Date(Date.UTC(th.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((th - y0) / 86400000 + 1) / 7);
  return { d: day, w: `${th.getUTCFullYear()}-W${pad(week)}`, m: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}` };
}
const PERIOD_NODE = { d: 'days', w: 'weeks', m: 'months' };

function hashId(id) { return crypto.createHash('sha256').update('ttc-stats:' + id).digest('hex').slice(0, 20); }
const idOk = v => typeof v === 'string' && /^[-\w]{6,48}$/.test(v);
const count = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

// A finished match as a phone reports it, checked and trimmed; null when it does not hold together.
function checkEnd(d, types) {
  if (!d || !Array.isArray(d.squares) || d.squares.length > 80) return null;
  const squares = [];
  for (const e of d.squares) {
    if (!e || !types.includes(e.t) || !ENDS.includes(e.end)) return null;
    const X = count(e.X, 999), O = count(e.O, 999);
    if (X === null || O === null) return null;
    const w = e.end === 'won' ? (e.w === 'X' || e.w === 'O' ? e.w : null) : null;
    if (e.end === 'won' && !w) return null;
    squares.push({ t: e.t, end: e.end, w, X, O });
  }
  const winner = d.winner === 'X' || d.winner === 'O' ? d.winner : null;
  return { squares, winner, reason: REASONS.includes(d.reason) ? d.reason : null };
}

// What a match starting adds.
function startUpdates(mode, t) {
  const k = periodKeys(t);
  return { [`modes/${mode}/started`]: 1, [`days/${k.d}/started/${mode}`]: 1 };
}
// What a finished match adds: the mode's totals and every mini-game played in it. `ms` is null when
// the match has no usable time. testTypes: the mini-games that are admin only at the time (their
// squares count under mini/testing, apart from the released games' numbers).
function endUpdates(mode, sum, ms, t, withStart, testTypes) {
  const k = periodKeys(t), up = withStart ? startUpdates(mode, t) : {};
  const add = (p, n) => { if (n) up[p] = (up[p] || 0) + n; };
  const turns = sum.squares.reduce((n, e) => n + e.X + e.O, 0);
  add(`modes/${mode}/finished`, 1);
  add(`days/${k.d}/finished/${mode}`, 1);
  add(`modes/${mode}/turns`, turns);
  if (sum.reason === 'resign') add(`modes/${mode}/resigned`, 1);
  if (sum.reason === 'timeout') add(`modes/${mode}/timeouts`, 1);
  if (sum.winner) add(`modes/${mode}/${sum.winner === 'X' ? 'xWins' : 'oWins'}`, 1);
  else if (sum.reason === 'blocked') add(`modes/${mode}/draws`, 1);   // a draw: no line left for either side
  if (Number.isFinite(ms) && ms >= 0 && ms <= MAX_MS) { add(`modes/${mode}/ms`, Math.round(ms)); add(`modes/${mode}/timed`, 1); }
  for (const e of sum.squares) {
    const b = `mini/${testTypes && testTypes.includes(e.t) ? 'testing' : mode}/${e.t}/`;
    add(b + 'played', 1);
    add(b + e.end, 1);
    add(b + 'allMoves', e.X + e.O);
    if (e.end === 'won') {
      add(b + 'winMoves', e[e.w]);
      add(b + 'loseMoves', e[e.w === 'X' ? 'O' : 'X']);
      add(b + (e.w === 'X' ? 'xWins' : 'oWins'), 1);
    }
  }
  return up;
}
// A login, or a new account: the counter for the day, the week and the month.
function periodUpdates(what, t) {
  const k = periodKeys(t), up = {};
  for (const p of ['d', 'w', 'm']) up[`${PERIOD_NODE[p]}/${k[p]}/${what}`] = 1;
  return up;
}

// ---------- playtest activity (no account needed) ----------
// devices/{h}      first, last (times), n (events), tag (the tester tag of the first link that had one)
// devlog/{h}/{k}   t, ev ('open', 'live', 'start', 'finish', 'leave'), m (the mode), g (the match)
// h: a one-way hash of the random id the browser made up (kept in its own storage); nothing about the
// person is sent or kept. k: one per app open and per 'live' (sent every 10 minutes while a match is
// under way on screen, so a long match stays one session), and one start and one end per match, so an
// event sent twice (a retry, a reload) is kept once.
const DEV_EVENTS = ['open', 'live', 'start', 'finish', 'leave'];
const DEV_MODES = ['local', 'cpu', 'cvc', 'friend', 'match'];
const TAG_RE = /^[a-z0-9][a-z0-9_-]{0,23}$/;
const tagOk = v => typeof v === 'string' && TAG_RE.test(v);
function devHash(dev) { return crypto.createHash('sha256').update('ttc-dev:' + dev).digest('hex').slice(0, 20); }
function checkDev(d, t) {
  if (!d || typeof d !== 'object' || !idOk(d.dev) || !DEV_EVENTS.includes(d.ev)) return null;
  const ev = { t, ev: d.ev };
  let k;
  if (d.ev === 'open') {
    if (!idOk(d.o)) return null;
    k = 'o' + d.o;
  } else {
    if (!DEV_MODES.includes(d.mode) || typeof d.g !== 'string' || !/^[-\w]{4,60}$/.test(d.g)) return null;
    ev.m = d.mode; ev.g = d.g;
    if (d.ev === 'live') { if (!idOk(d.o)) return null; k = 'p' + d.o; }
    else k = (d.ev === 'start' ? 's' : 'e') + d.g;                        // one start and one end (finished or left) per match
  }
  return { h: devHash(d.dev), k, ev, tag: tagOk(d.tag) ? d.tag : null };
}

module.exports = { MODES, CLIENT_MODES, MAX_MS, periodKeys, PERIOD_NODE, hashId, idOk, checkEnd, startUpdates, endUpdates, periodUpdates,
  DEV_EVENTS, DEV_MODES, TAG_RE, tagOk, devHash, checkDev };
