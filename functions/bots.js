'use strict';
/* The matchmaking bots: five accounts that look like any other player and take on someone who has been
 * searching alone for a while, when the admin has bots switched on (admin/config/bots). The match plays
 * as usual; each bot plays with its own tendencies and at its own pace. Tune them here.
 *
 * style (the computer player's knobs, see STYLE0 in engine.js):
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

// Thinking time, in seconds, drawn afresh for every move: a weighted mix of ranges, [weight, from, to].
// turn: the first move of a turn. again: a follow-up in the same turn (Hangman's next letter after a
// right one, Battleship's next shot after a hit, Risky Rolls' next roll).
const PACES = {
  quick:   { turn: [[0.6, 2, 5], [0.3, 6, 15], [0.1, 20, 40]], again: [[0.8, 1.2, 3], [0.2, 3, 6]] },
  steady:  { turn: [[0.35, 2, 5], [0.45, 6, 19], [0.17, 20, 45], [0.03, 46, 52]], again: [[0.6, 1.5, 4], [0.4, 4, 8]] },
  erratic: { turn: [[0.4, 2, 5], [0.2, 6, 19], [0.3, 20, 50], [0.1, 46, 52]], again: [[0.5, 1, 3], [0.5, 3, 12]] },
  slow:    { turn: [[0.15, 2, 5], [0.35, 8, 19], [0.4, 20, 50], [0.1, 46, 52]], again: [[0.4, 2, 5], [0.6, 5, 12]] },
  casual:  { turn: [[0.45, 2, 5], [0.35, 6, 19], [0.15, 20, 50], [0.05, 46, 52]], again: [[0.7, 1.5, 4], [0.3, 4, 9]] },
};
const MEMORY_SECOND = [1, 2.6];   // seconds between Memory's two cards
const MAX_THINK_MS = 52000;       // always well inside the 1-minute turn: a bot never runs out of time

// The admin's settings (admin/config), with the defaults for anything not set. Both start switched off.
const DEFAULTS = {
  bots: { enabled: false, waitMin: 40, waitMax: 70, countInRecords: true },
  alerts: { enabled: false, sms: false, email: true, phone: '', to: '', after: 5, cooldownMin: 30, gapMin: 3, dailyCap: 20,
    site: 'https://jaredmk.github.io/Tiger-tac-toe/' },
};
const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.min(hi, Math.max(lo, Number(v))) : d);
function botConfig(conf) {
  const c = Object.assign({}, DEFAULTS.bots, (conf && conf.bots) || {}), d = DEFAULTS.bots;
  const waitMin = num(c.waitMin, 5, 600, d.waitMin), waitMax = Math.max(waitMin, num(c.waitMax, 5, 600, d.waitMax));
  return { enabled: c.enabled === true, waitMin, waitMax, countInRecords: c.countInRecords !== false };
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

// A number from a weighted mix of ranges, in milliseconds.
function fromMix(mix, rng) {
  const total = mix.reduce((s, m) => s + m[0], 0);
  let r = rng() * total;
  for (const [w, a, b] of mix) { if ((r -= w) <= 0) return Math.round((a + rng() * (b - a)) * 1000); }
  const [, a, b] = mix[mix.length - 1];
  return Math.round((a + rng() * (b - a)) * 1000);
}
// How long a bot thinks before its next move: 'turn' (a new turn), 'again' (a follow-up in the same
// turn) or 'second' (Memory's second card).
function thinkMs(bot, kind, rng) {
  if (kind === 'second') return Math.round((MEMORY_SECOND[0] + rng() * (MEMORY_SECOND[1] - MEMORY_SECOND[0])) * 1000);
  const pace = PACES[bot && bot.pace] || PACES.casual;
  return Math.min(MAX_THINK_MS, fromMix(kind === 'again' ? pace.again : pace.turn, rng));
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

module.exports = { BOTS, NAMES, randomName, PACES, MEMORY_SECOND, MAX_THINK_MS, DEFAULTS, botConfig, alertConfig, fromMix, thinkMs, waitMs, byKey, newUid, e164, alertAllowed };
