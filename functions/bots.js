'use strict';
/* The matchmaking bots: five accounts that look like any other player and take on someone who has been
 * searching alone for a while, when the admin has bots switched on (admin/config/bots). The match plays
 * as usual; each bot plays with its own tendencies and at its own pace. Tune them here.
 *
 * style (the computer player's knobs, see STYLE0 in src/core/ai.js):
 *   attack   how much it values lines still open for itself (1 = the standard computer)
 *   defend   how much it values lines still open for the other side, and how hard it blocks
 *   mistake  the chance, each move, of a careless move: anything legal in any open square
 *   rollRisk  points added to the score it banks at in Risky Rolls (bolder above 0, warier below)
 * pace: the name of one of PACES below.
 */
// (No usernames here: this code is public. Each bot's username is made up when its account is made,
// from NAMES below, like any player's, and kept in the database.)
const BOTS = [
  { key: 'b1', about: 'Aggressive: chases its own lines, blocks late, pushes its luck at Risky Rolls, plays fast',
    style: { attack: 1.6, defend: 0.6, mistake: 0.05, rollRisk: 4 }, pace: 'quick' },
  { key: 'b2', about: 'Strategic and defensive: blocks first, banks early at Risky Rolls',
    style: { attack: 0.9, defend: 1.6, mistake: 0.03, rollRisk: -2 }, pace: 'steady' },
  { key: 'b3', about: 'Erratic: sharp one turn, careless the next, timing all over the place',
    style: { attack: 1.1, defend: 0.9, mistake: 0.25, rollRisk: 2 }, pace: 'erratic' },
  { key: 'b4', about: 'Slow and careful: never careless, takes its time, plays safe',
    style: { attack: 1, defend: 1.3, mistake: 0, rollRisk: -3 }, pace: 'slow' },
  { key: 'b5', about: 'Casual: balanced, with the odd slip',
    style: { attack: 1.1, defend: 1, mistake: 0.12, rollRisk: 0 }, pace: 'casual' },
];

// Thinking time, in seconds, drawn afresh for every move (thinkMs). A bot's ordinary moves are drawn from its own
// window inside 1.5 to 5 seconds; Wordle, Hangman and Mastermind take 3 to 8 seconds a guess; a follow-up within
// the same turn (the next Risky Rolls roll, the next Battleship shot) is a short pause of 1 to 2.5 seconds.
const PACES = {
  quick:   { turn: [1.5, 3] },
  steady:  { turn: [2, 4] },
  erratic: { turn: [1.5, 5] },
  slow:    { turn: [3, 5] },
  casual:  { turn: [2, 4.5] },
};
const WORD_TYPES = ['wordle', 'hangman', 'mastermind'];
const WORD_THINK = [3, 8];        // seconds a guess
const AGAIN_THINK = [1, 2.5];     // seconds between two actions in one turn
const MEMORY_SECOND = [1, 2.6];   // seconds between Memory's two cards
const MAX_THINK_MS = 8000;        // the longest any bot waits: the ranges above, always inside the turn clock

// The admin's settings (admin/config), with the defaults for anything not set. Both start switched off.
const DEFAULTS = {
  bots: { enabled: false, waitMin: 40, waitMax: 70, countInRecords: true, level: 'normal' },   // level: how well the bots play (easy, normal or hard: the computer's levels, src/core/aiw.js)
  alerts: { enabled: false, sms: false, email: true, phone: '', to: '', after: 5, cooldownMin: 30, gapMin: 3, dailyCap: 20,
    site: 'https://jaredmk.github.io/Tiger-tac-toe/' },
};
const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.min(hi, Math.max(lo, Number(v))) : d);
function botConfig(conf) {
  const c = Object.assign({}, DEFAULTS.bots, (conf && conf.bots) || {}), d = DEFAULTS.bots;
  const waitMin = num(c.waitMin, 5, 600, d.waitMin), waitMax = Math.max(waitMin, num(c.waitMax, 5, 600, d.waitMax));
  return { enabled: c.enabled === true, waitMin, waitMax, countInRecords: c.countInRecords !== false, level: ['easy', 'normal', 'hard'].includes(c.level) ? c.level : d.level };
}
function alertConfig(conf) {
  const c = Object.assign({}, DEFAULTS.alerts, (conf && conf.alerts) || {}), d = DEFAULTS.alerts;
  return {
    enabled: c.enabled === true, sms: c.sms === true, email: c.email === true,
    phone: typeof c.phone === 'string' ? c.phone.trim() : '', to: typeof c.to === 'string' ? c.to.trim() : '',
    after: num(c.after, 0, 600, d.after), cooldownMin: num(c.cooldownMin, 0, 1440, d.cooldownMin),
    gapMin: num(c.gapMin, 0, 1440, d.gapMin), dailyCap: num(c.dailyCap, 1, 500, d.dailyCap),
    site: typeof c.site === 'string' && /^https:\/\//.test(c.site) ? c.site : d.site,
  };
}

// How long a bot thinks before its next move: 'turn' (the first move of a turn), 'again' (a follow-up in the
// same turn), 'second' (Memory's second card). `type` is the mini-game of the move.
function thinkMs(bot, kind, rng, type) {
  const range = kind === 'second' ? MEMORY_SECOND : WORD_TYPES.includes(type) ? WORD_THINK
    : kind === 'again' ? AGAIN_THINK : (PACES[bot && bot.pace] || PACES.casual).turn;
  return Math.min(MAX_THINK_MS, Math.round((range[0] + rng() * (range[1] - range[0])) * 1000));
}
// The wait before a lone searcher is given a bot, drawn when they join the queue.
function waitMs(cfg, rng) { return Math.round((cfg.waitMin + rng() * (cfg.waitMax - cfg.waitMin)) * 1000); }
const byKey = key => BOTS.find(b => b.key === key) || null;
// An ordinary-looking username: a first name with the kind of ending people add (digits, an initial,
// an underscore), in the casing people use. Checked against the username rules where it is made.
const NAMES = ['alex', 'sam', 'jordan', 'casey', 'riley', 'taylor', 'morgan', 'jamie', 'chris', 'dani', 'maddie', 'liam', 'noah', 'emma', 'olivia',
  'ava', 'mia', 'lucas', 'ethan', 'mason', 'logan', 'ella', 'grace', 'chloe', 'zoe', 'lily', 'nora', 'leo', 'max', 'owen', 'eli', 'finn', 'jack',
  'luke', 'ben', 'tom', 'nick', 'matt', 'kate', 'jess', 'beth', 'amy', 'lucy', 'ruby', 'sophie', 'tess', 'nate', 'ryan', 'kyle', 'drew', 'jake',
  'maya', 'priya', 'aria', 'isla', 'theo', 'milo', 'jonah', 'gabe', 'marcus', 'devon', 'kai', 'sofia', 'elena', 'carmen', 'diego', 'mateo'];
function randomName(randomInt) {
  const pick = a => a[randomInt(a.length)], first = pick(NAMES), L = 'abcdefghjklmnprstw';
  const cap = randomInt(3) === 0 ? first[0].toUpperCase() + first.slice(1) : first;
  const d2 = String(randomInt(100)).padStart(2, '0'), yr = String(randomInt(2)) === '0' ? String(80 + randomInt(20)) : String(randomInt(10)).padStart(2, '0');
  const forms = [`${cap}${d2}`, `${cap}_${yr}`, `${cap}_${pick(L)}`, `${cap}${pick(L)}${randomInt(10)}`, `${cap}${pick(L).toUpperCase()}`, `x${cap}x`, `${cap}_${pick(L)}${d2}`];
  return pick(forms).slice(0, 16);
}
// A user id in the shape Firebase gives accounts.
function newUid(randomInt) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let k = 0; k < 28; k++) s += A[randomInt(A.length)];
  return s;
}
// A phone number as Twilio wants it (E.164): a 10-digit US number gets +1; anything with a + is kept.
function e164(v) {
  const s = String(v || '').trim();
  if (/^\+[1-9]\d{7,14}$/.test(s.replace(/[\s().-]/g, ''))) return s.replace(/[\s().-]/g, '');
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  return null;
}
// The alert's rate limits, as one decision on the stored state { last, by: { uid: t }, day, count }:
// one per player per cooldown, none closer than the gap to the one before, at most dailyCap a day (UTC).
function alertAllowed(state, uid, t, cfg) {
  const s = state || {}, day = new Date(t).toISOString().slice(0, 10);
  const by = s.by || {};
  if (by[uid] && t - by[uid] < cfg.cooldownMin * 60000) return { ok: false, why: 'player cooldown' };
  if (s.last && t - s.last < cfg.gapMin * 60000) return { ok: false, why: 'too soon after the last alert' };
  const count = s.day === day ? s.count || 0 : 0;
  if (count >= cfg.dailyCap) return { ok: false, why: 'daily cap' };
  const keep = {};
  for (const [u, at] of Object.entries(by)) if (t - at < Math.max(cfg.cooldownMin, 1) * 60000) keep[u] = at;   // forget players past their cooldown
  keep[uid] = t;
  return { ok: true, next: { last: t, by: keep, day, count: count + 1 } };
}

module.exports = { BOTS, NAMES, randomName, PACES, MEMORY_SECOND, MAX_THINK_MS, DEFAULTS, botConfig, alertConfig, thinkMs, waitMs, byKey, newUid, e164, alertAllowed };
