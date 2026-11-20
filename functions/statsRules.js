'use strict';
/* What the server keeps of play, as rows (December 2026): the admin dashboard works every number out from them with one
 * set of definitions (src/admin/metrics.js). Pure (no database here), so the rules can be tested on their own;
 * functions/index.js writes the results. No counters are kept: a number is always a count over rows.
 *
 * mfacts/{day}/{id}   one row per match (day: New York's, of its start): t0 (start), m (mode: local, cpu, friend, match, bot,
 *                     chaos), tm (timer: core/timer.js timerSpec, 'none' locally), who (its players: [{ s side, u account,
 *                     h device hash, pl platform, cv client version, bot }]), own (an admin account or an owner device
 *                     played in it), sc (Super Chaos), rm (a friend room's code); once ended: t1, end (line, blocked,
 *                     majority, both, clock: finished; resign, timeout: abandoned), w (the winner), n (turns), ms (length)
 *                     and sq, its squares as JSON: [{ t type, v settings version, end (won, draw, open), w, X, O (each
 *                     side's turns in it), f (its first mover), ms (time spent in it), race, run (a runner's runs) }].
 * finds/{day}/{id}    one row per Find Match search that ended: t, k (people: paired with a person; bot: took the
 *                     computer; cancel: gave up), ms (the wait), u (the account), own.
 * devices/{h}, devlog/{h}/{k}   a device and its events (below): opens, matches, errors, first-run steps, shares and invites.
 * Days are New York's (America/New_York, with its daylight saving). "Moves" in a mini-game are the turns a side spent in
 * it: a Risky Rolls roll or a Hangman letter that earns another go is part of the same turn.
 */
const crypto = require('node:crypto');

const MODES = ['local', 'cpu', 'cvc', 'friend', 'match', 'bot', 'casual', 'ranked', 'chaos'];   // two people on one phone, vs the computer, computer vs computer, friend code, Find Match, Find Match against a bot (casual and ranked: before it was one queue), Super Chaos (simultaneous rounds, vs the computer)
const CLIENT_MODES = ['local', 'cpu', 'cvc', 'chaos'];                 // the ones a phone reports; the server records the online ones itself
const MAX_MS = 3 * 3600 * 1000;                                        // a match "lasting" longer was left and picked up again: no time for it
const ENDS = ['won', 'draw', 'open'];
const REASONS = ['line', 'blocked', 'majority', 'resign', 'timeout', 'both', 'clock', 'left'];   // left (December 2026): a local match left part way by a guest (no loss to record), abandoned   // clock: a match clock run out (core/board.js timeoutMove), a finish like any other   // both: a line each in the same Super Chaos round (a draw)
const ABANDONED = ['resign', 'timeout', 'left'];                                // a match given up (or left to run out its clock): abandoned, not finished

const pad = n => String(n).padStart(2, '0');
// The day, ISO week and month of a time, in New York (and 'all', the all-time bucket).
const TZ = 'America/New_York';
const NY = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
function localDate(t) {                                                   // { y, m, d } of the calendar day in New York
  const o = {}; for (const x of NY.formatToParts(new Date(t))) if (x.type !== 'literal') o[x.type] = Number(x.value);
  return { y: o.year, m: o.month, d: o.day };
}
function periodKeys(t) {
  const { y, m, d: dd } = localDate(t);
  const day = `${y}-${pad(m)}-${pad(dd)}`;
  const th = new Date(Date.UTC(y, m - 1, dd));
  th.setUTCDate(th.getUTCDate() + 4 - (th.getUTCDay() || 7));            // the Thursday of this week decides its year
  const y0 = new Date(Date.UTC(th.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((th - y0) / 86400000 + 1) / 7);
  return { d: day, w: `${th.getUTCFullYear()}-W${pad(week)}`, m: `${y}-${pad(m)}`, a: 'all' };
}
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
    const run = checkRun(e.run);
    if (e.run !== undefined && !run) return null;
    const v = Number.isInteger(e.v) && e.v >= 1 && e.v <= 100000 ? e.v : 1, f = e.f === 'X' || e.f === 'O' ? e.f : null;   // (the settings version, the first mover, the time in it: core/board.js sqEntry)
    const ms = Number.isFinite(e.ms) && e.ms >= 0 && e.ms <= MAX_MS ? Math.round(e.ms) : null;
    squares.push(Object.assign({ t: e.t, end: e.end, w, X, O, v }, f ? { f } : {}, ms !== null ? { ms } : {}, e.race ? { race: 1 } : {}, run ? { run } : {}, playFacts(e)));
  }
  const winner = d.winner === 'X' || d.winner === 'O' ? d.winner : null;
  return Object.assign({ squares, winner, reason: REASONS.includes(d.reason) ? d.reason : null, sc: d.sc === true }, matchFacts(d));
}

// A play's own facts (December 2026, core/board.js sqEntry), each kept only when it holds together: its square i, pick
// number k, oj, start and end s and e (ms after the match's first move), and per side its time (mX, mO), the turns that
// followed the other side in (jX, jO), the turns run out there (toX, toO) and the "?" taps on this phone (hX, hO).
const msOk = v => Number.isFinite(v) && v >= 0 && v <= MAX_MS;
function playFacts(e) {
  const out = {};
  if (Number.isInteger(e.i) && e.i >= 0 && e.i <= 8) out.i = e.i;
  if (count(e.k, 999)) out.k = e.k;
  if (e.oj === 1) out.oj = 1;
  for (const k of ['s', 'e', 'mX', 'mO']) if (msOk(e[k])) out[k] = Math.round(e[k]);
  for (const k of ['jX', 'jO', 'toX', 'toO', 'hX', 'hO']) if (count(e[k], 999)) out[k] = e[k];
  return out;
}
// A match's own facts: mp (the side that reached match point first) and mpn (at which move), tmo (each side's turns missed on
// the board), ab (the square on the leaving phone's screen when the match was left; -1 the board).
function matchFacts(d) {
  const out = {};
  if (d.mp === 'X' || d.mp === 'O') { out.mp = d.mp; if (count(d.mpn, 9999)) out.mpn = d.mpn; }
  if (d.tmo && typeof d.tmo === 'object' && count(d.tmo.X, 999) !== null && count(d.tmo.O, 999) !== null && d.tmo.X + d.tmo.O > 0) out.tmo = { X: d.tmo.X, O: d.tmo.O };
  if (Number.isInteger(d.ab) && d.ab >= -1 && d.ab <= 8) out.ab = d.ab;
  return out;
}
// A runner square's run data as a phone reports it: runs and distances per side, the crash points.
const RUN_BIN = 50, RUN_MAX_M = 5000, RUN_MAX_CRASHES = 40;
function checkRun(r) {
  if (!r || typeof r !== 'object' || !r.runs || !r.dist || !r.crashes) return null;
  const out = { runs: {}, dist: {}, crashes: {} };
  for (const p of ['X', 'O']) {
    const n = count(r.runs[p], 999), d = Number(r.dist[p]);
    if (n === null || !Number.isFinite(d) || d < 0 || d > RUN_MAX_M || !Array.isArray(r.crashes[p]) || r.crashes[p].length > RUN_MAX_CRASHES) return null;
    if (!r.crashes[p].every(c => Number.isFinite(c) && c >= 0 && c <= RUN_MAX_M)) return null;
    out.runs[p] = n; out.dist[p] = Math.round(d); out.crashes[p] = r.crashes[p].map(c => Math.round(c));
  }
  return out;
}
// ---------- match rows ----------
const TIMER_CODE = /^(off|t\d{1,3}|m\d{1,2}\+\d{1,2})$/;
const timerOf = v => (typeof v === 'string' && TIMER_CODE.test(v) ? v : 'none');
const clean = o => { const out = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== false && v !== '') out[k] = v; return out; };
// One player of a match, as its row keeps them: p { s, u, h, pl, cv, bot }.
function factWho(p) {
  p = p || {};
  return clean({ s: p.s === 'X' || p.s === 'O' ? p.s : undefined, u: typeof p.u === 'string' ? p.u.slice(0, 40) : undefined, h: typeof p.h === 'string' && /^[0-9a-f]{20}$/.test(p.h) ? p.h : undefined,
    pl: p.pl === 'ios' || p.pl === 'web' ? p.pl : undefined, cv: typeof p.cv === 'string' && /^\d{1,4}(\.\d{1,4}){0,2}$/.test(p.cv) ? p.cv : undefined, bot: p.bot ? true : undefined });
}
// A match starting: its row. o: { timer, own, sc, room, su (factSetup's string) }.
function factStart(mode, t, who, o) {
  o = o || {};
  return clean({ t0: t, m: MODES.includes(mode) ? mode : 'local', tm: timerOf(o.timer), who: (who || []).map(factWho).filter(w => Object.keys(w).length), own: o.own ? true : undefined, sc: o.sc ? true : undefined, rm: typeof o.room === 'string' ? o.room.slice(0, 8) : undefined,
    su: typeof o.su === 'string' && o.su.length <= 4000 ? o.su : undefined });
}
// A match ending: what its row gains. sum: checkEnd's or the engine's matchStats (squares, winner, reason).
function factEnd(sum, ms, t) {
  const turns = sum.squares.reduce((n, e) => n + e.X + e.O, 0), timed = Number.isFinite(ms) && ms >= 0 && ms <= MAX_MS;
  const sq = sum.squares.slice(0, 80).map(e => clean(Object.assign({ t: e.t, v: Number.isInteger(e.v) && e.v > 1 ? e.v : undefined, end: e.end, w: e.end === 'won' ? e.w : undefined, X: e.X || undefined, O: e.O || undefined,
    f: e.f === 'X' || e.f === 'O' ? e.f : undefined, ms: Number.isFinite(e.ms) ? Math.round(e.ms) : undefined, race: e.race ? 1 : undefined, run: e.run || undefined }, playFacts(e))));
  const mf = matchFacts(sum);
  return clean({ t1: t, end: REASONS.includes(sum.reason) ? sum.reason : 'line', w: sum.winner === 'X' || sum.winner === 'O' ? sum.winner : undefined, n: turns || undefined, ms: timed ? Math.round(ms) : undefined, sq: JSON.stringify(sq), sc: sum.sc ? true : undefined,
    mp: mf.mp, mpn: mf.mpn, tmo: mf.tmo, ab: mf.ab });
}
// A match's setup (December 2026), kept on its row as one JSON string `su` at its start: av the mini-games the players could
// have had (the setup's checklist; online, what both clients have and may play), ex the ones left out of it (av less the
// match's own list), b the nine dealt, by square (0-8: corners 0 2 6 8, sides 1 3 5 7, the centre 4), lv the computer's level
// (vs Computer; a Find Match bot: the bots' level), f1 the side that moved first, rp the match this one is a rematch of (its row
// id). Types are checked against the registry; a field that does not hold together is left out.
const LEVELS = ['easy', 'normal', 'hard'];
function factSetup(o, types) {
  if (!o || typeof o !== 'object') return undefined;
  const list = (v, n) => (Array.isArray(v) && v.length <= n ? [...new Set(v.filter(t => typeof t === 'string' && types.includes(t)))] : null);
  const av = list(o.av, 120), ex = list(o.ex, 120), b = Array.isArray(o.b) && o.b.length === 9 && o.b.every(t => typeof t === 'string' && types.includes(t)) ? o.b : null;
  const su = clean({ av: av && av.length ? av : undefined, ex: ex && ex.length ? ex : undefined, b: b || undefined, lv: LEVELS.includes(o.lv) ? o.lv : undefined, f1: o.f1 === 'X' || o.f1 === 'O' ? o.f1 : undefined,
    rp: typeof o.rp === 'string' && /^[-\w]{4,60}$/.test(o.rp) ? o.rp : undefined });
  return Object.keys(su).length ? JSON.stringify(su) : undefined;
}
// A Find Match search that ended: its row.
const FIND_KINDS = ['people', 'bot', 'cancel'];
function factFind(kind, ms, t, uid, own) { return clean({ t, k: FIND_KINDS.includes(kind) ? kind : 'cancel', ms: Math.max(0, Math.round(ms || 0)), u: uid, own: own ? true : undefined }); }

// ---------- playtest activity (no account needed) ----------
// devices/{h}      first, last (times), n (events), tag (the tester tag of the first link that had one), p and cv (the
//                  client it last opened: platform and version), u/{uid} (the accounts signed in on it, with when)
// devlog/{h}/{k}   t, ev ('open', 'live', 'start', 'finish', 'leave'), m (the mode), g (the match)
// h: a one-way hash of the random id the browser made up (kept in its own storage); nothing about the
// person is sent or kept. k: one per app open and per 'live' (sent every 10 minutes while a match is
// under way on screen, so a long match stays one session), and one start and one end per match, so an
// event sent twice (a retry, a reload) is kept once.
const DEV_EVENTS = ['open', 'live', 'start', 'finish', 'leave', 'error', 'report', 'mlog', 'audio', 'step', 'act'];   // (step: a first-run funnel step, once per device; act: a rematch, share or invite event)   // (error: something went wrong on the phone, a short line, with its match where there was one; audio: the phone's sound went down or came back, or failed, a short line)
const DEV_MODES = ['local', 'cpu', 'cvc', 'friend', 'match', 'chaos'];
const TAG_RE = /^[a-z0-9][a-z0-9_-]{0,23}$/;
const tagOk = v => typeof v === 'string' && TAG_RE.test(v);
function devHash(dev) { return crypto.createHash('sha256').update('ttc-dev:' + dev).digest('hex').slice(0, 20); }
function checkDev(d, t) {
  if (!d || typeof d !== 'object' || !idOk(d.dev) || !DEV_EVENTS.includes(d.ev)) return null;
  const ev = { t, ev: d.ev };
  const match = () => DEV_MODES.includes(d.mode) && typeof d.g === 'string' && /^[-\w]{4,60}$/.test(d.g);
  let k;
  if (d.ev === 'open') {
    if (!idOk(d.o)) return null;
    k = 'o' + d.o;
    const cl = d.client && typeof d.client === 'object' ? d.client : {};          // the client it opened (src/core/client.js): its version and platform
    if (typeof cl.v === 'string' && /^\d{1,4}(\.\d{1,4}){0,2}$/.test(cl.v)) ev.cv = cl.v;
    if (cl.p === 'web' || cl.p === 'ios') ev.p = cl.p;
  } else if (d.ev === 'error' || d.ev === 'audio') {
    if (!idOk(d.o) || typeof d.msg !== 'string' || !d.msg.trim()) return null;
    ev.msg = d.msg.replace(/[^\x20-\x7e]/g, '?').slice(0, 160);
    if (match()) { ev.m = d.mode; ev.g = d.g; }
    k = (d.ev === 'audio' ? 'a' : 'x') + d.o;
  } else if (d.ev === 'step') {                                   // a first-run step (tap, move, claim): once per device (its key)
    if (!STEPS.includes(d.step)) return null;
    ev.step = d.step; k = 'f' + d.step;
  } else if (d.ev === 'act') {                                    // a rematch, share or invite event (counted per day: actUpdates)
    if (!idOk(d.o) || !ACTS.includes(d.act)) return null;
    ev.act = d.act; if (CHANNELS.includes(d.ch)) ev.ch = d.ch;
    k = 'q' + d.o;
  } else if (d.ev === 'report' || d.ev === 'mlog') {               // a "Report a problem" (its note), or an event for the match's log only: always with its match
    if (!idOk(d.o) || !match()) return null;
    ev.m = d.mode; ev.g = d.g;
    if (d.ev === 'mlog' && (!d.e || typeof d.e !== 'object')) return null;
    k = (d.ev === 'report' ? 'r' : 'l') + d.o;
  } else {
    if (!match()) return null;
    ev.m = d.mode; ev.g = d.g;
    if (d.ev === 'live') { if (!idOk(d.o)) return null; k = 'p' + d.o; }
    else k = (d.ev === 'start' ? 's' : 'e') + d.g;                        // one start and one end (finished or left) per match
    if (d.ev === 'finish' || d.ev === 'leave') {                  // (December 2026, an online match: this phone's side, its "?" taps by play, k:n, and the square it left on)
      if (d.s === 'X' || d.s === 'O') ev.s = d.s;
      if (typeof d.hp === 'string' && /^\d{1,3}:\d{1,3}(,\d{1,3}:\d{1,3}){0,39}$/.test(d.hp)) ev.hp = d.hp;
      if (d.ev === 'leave' && Number.isInteger(d.ab) && d.ab >= -1 && d.ab <= 8) ev.ab = d.ab;
    }
  }
  const out = { h: devHash(d.dev), k, ev, tag: tagOk(d.tag) ? d.tag : null };
  if (typeof d.v === 'string' && /^[-\w.]{1,20}$/.test(d.v)) { out.v = d.v; if (d.ev === 'open' || d.ev === 'error') ev.b = d.v; }   // the app's build on the phone (kept on its opens and errors: the error rate by build)
  if (d.s === 'X' || d.s === 'O') out.s = d.s;                                           // the phone's side in the match
  if (d.ev === 'report') { out.note = typeof d.note === 'string' ? d.note.trim().replace(/[^\x20-\x7e -￿]/g, ' ').slice(0, 140) : ''; if (out.note) ev.note = out.note; }
  if (d.ev === 'mlog') out.e = d.e;
  return out;
}

// ---------- owner devices (December 2026): the admin's own devices and accounts, kept out of every stat by default ----------
// devmeta/{key} (admin read and write; kept by the launch reset): { nick, ex, why, at } for a device's hash h (the 20 hex of
// devHash, the admin's device ID; its first 8 the short ID Settings shows) or a prefix of one (6 to 19 hex: a device not seen
// yet, or one the admin pasted short). ex true: an owner device, everything it does filed under statsOwn/ instead of stats/
// (the admin's "Include my devices" adds them back); nick: its name on the Devices page (any device, excluded or not). why:
// 'set' (a deploy's set), 'admin' (it signed in to an admin account: marked at once, for good), 'self' (Settings' Mark this
// device as mine), 'link' (the owner link, ?owner=<token>), 'manual' (the Devices page).
const META_KEY = /^[0-9a-f]{6,20}$/;
// A pasted device ID: hex, 6 to 20 of it (the short ID or the whole), lower case; anything else null.
function metaKey(v) { const k = String(v == null ? '' : v).trim().toLowerCase().replace(/[^0-9a-f]/g, ''); return META_KEY.test(k) ? k : null; }
// The entry that names device h: its own (the whole hash), else the longest prefix of it; null for none.
function metaFor(meta, h) {
  if (!meta || typeof h !== 'string' || !h) return null;
  if (meta[h]) return Object.assign({ key: h }, meta[h]);
  let best = null;
  for (const [k, v] of Object.entries(meta)) if (v && META_KEY.test(k) && h.startsWith(k) && (!best || k.length > best.key.length)) best = Object.assign({ key: k }, v);
  return best;
}
const ownerOf = (meta, h) => { const m = metaFor(meta, h); return !!(m && m.ex === true); };

// ---------- "Report a problem" (December 2026): from anywhere in the page, a match or not ----------
// What the phone sends (ui/report.js, net/tracking.js sendReport), checked: a note (up to 140 characters, may be empty),
// the screen it was sent from (where), the match it was in (g and mode, if any), its side, the app's build and the client.
const REPORT_WHERE = ['menu', 'board', 'mini', 'win', 'review', 'settings', 'howto', 'profile', 'setup', 'join', 'host', 'find', 'account', 'other'];
function checkReport(d, t) {
  if (!d || typeof d !== 'object' || !idOk(d.dev) || !idOk(d.o)) return null;
  const note = typeof d.note === 'string' ? d.note.trim().replace(/[^\x20-\x7e\u00a0-\uffff]/g, ' ').slice(0, 140) : '';
  const out = { t, h: devHash(d.dev), o: d.o, note, where: REPORT_WHERE.includes(d.where) ? d.where : 'other' };
  if (DEV_MODES.includes(d.mode) && typeof d.g === 'string' && /^[-\w]{4,60}$/.test(d.g)) { out.g = d.g; out.mode = d.mode; }
  if (d.s === 'X' || d.s === 'O') out.s = d.s;
  if (typeof d.v === 'string' && /^[-\w.]{1,20}$/.test(d.v)) out.v = d.v;
  const cl = d.client && typeof d.client === 'object' ? d.client : {};
  if (typeof cl.v === 'string' && /^\d{1,4}(\.\d{1,4}){0,2}$/.test(cl.v)) out.cv = cl.v;
  if (cl.p === 'web' || cl.p === 'ios') out.p = cl.p;
  return out;
}
// The alert's text: one line the admin can act on (who, where, the note, the match, the build).
function reportText(r, who, env) {
  const at = r.g ? `in a ${r.mode} match (${r.g}${r.s ? ', as ' + r.s : ''})` : `on the ${r.where} screen`;
  const cl = [r.p, r.cv, r.v && 'build ' + r.v].filter(Boolean).join(' ');
  return `Tic Tac Chaos${env ? ' (' + env + ')' : ''}: a problem report from ${who} ${at}${cl ? ', ' + cl : ''}: ${r.note ? '"' + r.note + '"' : '(no note)'}`;
}

// The first-run steps and the events a phone reports (devlog 'step' and 'act'): the funnel, retention, invites and shares
// are worked out from the devices' events by the dashboard (src/admin/metrics.js).
const STEPS = ['tap', 'move', 'claim'];
const ACTS = ['rematch', 'share', 'invite', 'invite-open', 'invite-join', 'invite-done', 'acct-shown', 'acct-no', 'acct-tap', 'acct-made'];   // (acct-*: a guest's "Create an account" prompt on the results, shown, Not now, tapped; and an account made, ch 'prompt' after a tap on it, else 'other')
const CHANNELS = ['share', 'copy', 'prompt', 'other'];
const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;

module.exports = {
  META_KEY, metaKey, metaFor, ownerOf, factWho, factStart, factEnd, factFind, factSetup, playFacts, matchFacts, FIND_KINDS, timerOf,
  checkReport, reportText, REPORT_WHERE, MODES, STEPS, ACTS, CHANNELS, dayNum, CLIENT_MODES, MAX_MS, ABANDONED, TZ, localDate, periodKeys, hashId, idOk, checkEnd, checkRun, RUN_BIN,
  DEV_EVENTS, DEV_MODES, TAG_RE, tagOk, devHash, checkDev };
