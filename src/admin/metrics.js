// The admin dashboard's one metrics layer (December 2026). Every number on every page is worked out here, from rows:
//   matches   mfacts/{day}/{id}      one row per match (functions/statsRules.js factStart, factEnd)
//   devices   devices/{h}, devlog/{h}  a device and its events (opens, matches, errors, first-run steps, shares, invites)
//   accounts  users/{uid}            an account (its username, sign-up time and source, its record)
//   finds     finds/{day}/{id}       a Find Match search that ended
// with one set of definitions (DEFS below: each has the one line the page shows as its tooltip) and one set of filters
// (my devices, a date range, the platform, the mode; the settings version on the games' pages), so a metric has the same
// value wherever it is shown, and every count can list the rows behind it. Pure: no page, no database (the tests run it).
// Days are New York's. A person is an account, or a guest's device.

export const GAP = 30 * 60000;                 // a session ends after this long with nothing from the device
export const LIVE_MS = 3 * 3600000;            // a match started this long ago and never ended was left unfinished
export const ABANDONED = ['resign', 'timeout', 'left'];
export const MODE_GROUP = { cpu: 'cpu', local: 'friend', friend: 'friend', match: 'find', bot: 'find', casual: 'find', ranked: 'find', chaos: 'other', cvc: 'other' };
export const GROUP_LABEL = { cpu: 'vs Computer', friend: 'Friend', find: 'Find Match', other: 'Other' };
export const MODE_LABEL = { cpu: 'vs Computer', local: 'Same phone', friend: 'Friend room', match: 'Find Match', bot: 'Find Match (took the computer)', chaos: 'Super Chaos', cvc: 'Computer vs computer' };
export const END_LABEL = { line: 'Three in a row', blocked: 'Draw', majority: 'Majority', both: 'Draw', clock: 'Clock ran out', resign: 'Resigned', timeout: 'Two missed turns', left: 'Left part way' };
export const RETAIN = [1, 7, 30];
export const FLAG_MOVES = 6, FLAG_SAMPLE = 30;

// ---------- the definitions: one per metric, shown as its tooltip wherever the metric appears ----------
export const DEFS = {
  active: ['Active players', 'People (an account, or a guest\'s device) who opened or used the game on at least one day in the range.'],
  newPlayers: ['New players', 'People first seen in the range.'],
  newAccounts: ['New accounts', 'Accounts whose username was made in the range.'],
  played: ['Played a match', 'Active players who started at least one match in the range.'],
  sessions: ['Sessions', 'Visits: a run of activity on one device with no gap longer than 30 minutes, started in the range.'],
  sessionLen: ['Median session', 'The middle session length, first event to last.'],
  started: ['Matches started', 'Matches started in the range. A match on two phones counts once.'],
  finished: ['Matches finished', 'Matches played to a result: three in a row, a draw, a majority, or a clock that ran out.'],
  abandoned: ['Abandoned', 'Matches a player resigned or lost by missing two turns.'],
  unfinished: ['Never finished', 'Matches started more than 3 hours ago that never ended: left, or the game was closed.'],
  completion: ['Completion', 'Matches finished, of the matches started (those still being played left out).'],
  turns: ['Median turns', 'The middle number of turns in a finished match, both sides together. A bonus move within a turn counts once.'],
  minutes: ['Median minutes', 'The middle length of a finished match, start to end.'],
  firstPlayer: ['First player wins', 'X\'s share of the finished matches that had a winner. X always moves first.'],
  squares: ['Completed squares', 'Squares that ended claimed by X or O, in finished matches.'],
  resets: ['Reset', 'Squares that ended level and were dealt a new mini-game, of all squares played in finished matches.'],
  open: ['Left open', 'Squares with moves in them when their match finished, of all squares played in finished matches.'],
  moves: ['Winner\'s moves', 'Turns the winner spent in a completed square: 25th percentile, median, 75th.'],
  secs: ['Time in square', 'Seconds spent in a completed square, both sides together: 25th percentile, median, 75th.'],
  firstMover: ['First mover wins', 'Of completed squares, the share won by whoever moved first in that square.'],
  d1: ['D1 retention', 'Of the people first seen at least 1 day ago (in the range), the share who used the game again exactly 1 day later.'],
  d7: ['D7 retention', 'Of the people first seen at least 7 days ago (in the range), the share who used the game again exactly 7 days later.'],
  d30: ['D30 retention', 'Of the people first seen at least 30 days ago (in the range), the share who used the game again exactly 30 days later.'],
  w1: ['Back within 7 days', 'Of the people first seen at least 7 days ago (in the range), the share who used the game again on any of the next 7 days.'],
  fOpened: ['Opened', 'People first seen in the range.'],
  fTap: ['First tap', 'Of them, those who opened a square on the board.'],
  fMove: ['First move', 'Of them, those who made a move in a mini-game.'],
  fClaim: ['First claim', 'Of them, those who saw a square claimed.'],
  fFinished: ['Finished a match', 'Of them, those who finished at least one match.'],
  fSecond: ['Second match', 'Of them, those who started a second match.'],
  opens: ['Opens', 'Times the game was opened (a page load or an app launch) in the range.'],
  errors: ['Errors', 'Errors a phone reported in the range: uncaught errors, rejected promises and the game\'s own error logs.'],
  errorRate: ['Errors per 100 opens', 'Errors in the range for every 100 opens in the range.'],
  reports: ['Problem reports', '"Report a problem" notes sent by players in the range.'],
  findPeople: ['Paired with a person', 'Find Match searches that ended paired with another player.'],
  findBot: ['Took the computer', 'Find Match searches that ended with the player accepting the computer.'],
  findCancel: ['Gave up', 'Find Match searches the player cancelled.'],
  findFill: ['Computer fill rate', 'Of the searches that ended in a match, the share that took the computer.'],
  findWait: ['Median wait', 'The middle wait of the searches that ended in a match.'],
  invitesSent: ['Invites sent', 'Times a player shared or copied a room invite.'],
  inviteOpens: ['Invite links opened', 'Times a join link was opened.'],
  inviteJoins: ['Rooms joined', 'Times a player joined a friend\'s room.'],
  inviteDone: ['Invite matches finished', 'First matches finished in a room joined as the guest.'],
  rematches: ['Rematches', 'Times a player tapped Rematch.'],
  shares: ['Results shared', 'Times a player shared a result card.'],
};
export const label = k => (DEFS[k] || [k])[0];
export const tip = k => (DEFS[k] || ['', ''])[1];

// ---------- time ----------
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayCache = new Map();
export function nyDay(t) {                     // 'YYYY-MM-DD' in New York (cached by the hour: its offsets are whole hours)
  const h = Math.floor(t / 3600000);
  let d = dayCache.get(h);
  if (!d) { d = dayFmt.format(new Date(t)).slice(0, 10); dayCache.set(h, d); }
  return d;
}
export const dayNum = day => Math.round(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86400000);
export const numDay = n => new Date(n * 86400000).toISOString().slice(0, 10);
export const addDays = (day, k) => numDay(dayNum(day) + k);
export function dayList(from, to) { const out = []; for (let n = dayNum(from), e = dayNum(to); n <= e && out.length < 400; n++) out.push(numDay(n)); return out; }
// The filters' range as days: a preset counts back from today (New York), 'custom' takes from and to.
export const RANGES = [['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['custom', 'Custom']];
export function rangeOf(f, now = Date.now()) {
  const today = nyDay(now), ok = v => /^\d{4}-\d\d-\d\d$/.test(v || '');
  if (f.range === 'custom') { const from = ok(f.from) ? f.from : addDays(today, -29), to = ok(f.to) ? f.to : today; return from <= to ? { from, to } : { from: to, to: from }; }
  const k = f.range === 'today' ? 1 : [7, 30, 90].includes(+f.range) ? +f.range : 30;
  return { from: addDays(today, 1 - k), to: today };
}
export const FILTER_DEFAULTS = { mine: false, range: '30', from: '', to: '', platform: 'all', mode: 'all', version: 'current', opp: 'all', pos: 'all' };   // (opp, pos: the Games page's quality table, December 2026)
export function normFilters(v) {
  const f = Object.assign({}, FILTER_DEFAULTS, v && typeof v === 'object' ? v : {});
  f.mine = f.mine === true;
  if (!RANGES.some(([k]) => k === f.range)) f.range = '30';
  if (!['all', 'web', 'ios'].includes(f.platform)) f.platform = 'all';
  if (!['all', 'cpu', 'friend', 'find'].includes(f.mode)) f.mode = 'all';
  if (!['current', 'previous', 'all'].includes(f.version)) f.version = 'current';
  if (!['all', 'ai', 'human'].includes(f.opp)) f.opp = 'all';
  if (!['all', 'corner', 'side', 'center'].includes(f.pos)) f.pos = 'all';
  return f;
}

// ---------- numbers ----------
export const ratio = (a, b) => (b ? a / b : null);
export function quant(values, q) {             // the q-th quantile of a list (nearest rank); null when empty
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  return a.length ? a[Math.min(a.length - 1, Math.max(0, Math.ceil(q * a.length) - 1))] : null;
}
export const quants = values => ({ n: values.length, p25: quant(values, 0.25), med: quant(values, 0.5), p75: quant(values, 0.75) });

// ---------- owner devices (devmeta: functions/statsRules.js metaFor) ----------
const META_KEY = /^[0-9a-f]{6,20}$/;
export function metaFor(meta, h) {
  if (!meta || !h) return null;
  if (meta[h]) return Object.assign({ key: h }, meta[h]);
  let best = null;
  for (const [k, v] of Object.entries(meta)) if (v && META_KEY.test(k) && h.startsWith(k) && (!best || k.length > best.key.length)) best = Object.assign({ key: k }, v);
  return best;
}

// ---------- the model: everything read, joined once (the filters come after) ----------
const recOf = (...rs) => rs.reduce((t, r) => { r = r || {}; t.wins += r.wins || 0; t.losses += r.losses || 0; t.draws += r.draws || 0; return t; }, { wins: 0, losses: 0, draws: 0 });
function sessionsOf(dev) {
  const out = [];
  let cur = null;
  for (const e of dev.evs) {
    if (!cur || e.t - cur.end > GAP) { cur = { h: dev.h, start: e.t, end: e.t, events: [] }; out.push(cur); }
    cur.end = e.t; cur.events.push(e);
  }
  for (const s of out) {
    s.ms = s.end - s.start; s.day = nyDay(s.start);
    s.opens = s.events.filter(e => e.ev === 'open').length;
    s.errors = s.events.filter(e => e.ev === 'error').length;
    s.starts = s.events.filter(e => e.ev === 'start').length;
    s.finishes = s.events.filter(e => e.ev === 'finish').length;
  }
  return out;
}
// data: { matches, finds, devices, logs, users, local, seen, meta, bots, reports, logIndex }
export function build(data, now = Date.now()) {
  data = data || {};
  const meta = data.meta || {}, users = data.users || {}, bots = data.bots || {}, devices = data.devices || {}, logs = data.logs || {};
  const devs = new Map(), people = new Map();
  for (const [uid, u] of Object.entries(users)) {
    if (!u || typeof u !== 'object' || bots[uid]) continue;
    people.set('u:' + uid, { id: 'u:' + uid, kind: 'account', uid, username: u.username || '', joined: u.joined || null, src: u.src || '', devices: [], own: [], first: u.joined || null, last: (data.seen || {})[uid] || null,
      rec: recOf(u, u.friend, (data.local || {})[uid]), owner: false, pls: new Set(), days: new Set(), sessions: [], matches: [] });
  }
  for (const h of new Set(Object.keys(devices).concat(Object.keys(logs)))) {
    const d = devices[h] || {}, evs = Object.values(logs[h] || {}).filter(e => e && Number.isFinite(e.t) && typeof e.ev === 'string').sort((a, b) => a.t - b.t);
    if (!evs.length && !d.first) continue;
    const m = metaFor(meta, h), uids = Object.entries(d.u || {}).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const lastOpen = evs.filter(e => e.ev === 'open' && e.p).pop();
    const dev = { h, short: h.slice(0, 8), nick: (m && m.nick) || '', owner: !!(m && m.ex === true), why: (m && m.why) || '', metaKey: m ? m.key : null, pl: d.p || (lastOpen && lastOpen.p) || 'web', cv: d.cv || (lastOpen && lastOpen.cv) || '',
      tag: d.tag || '', first: Math.min(d.first || Infinity, evs.length ? evs[0].t : Infinity), last: Math.max(d.last || 0, evs.length ? evs[evs.length - 1].t : 0), evs, uids, n: d.n || evs.length };
    dev.sessions = sessionsOf(dev);
    dev.days = new Set(evs.map(e => dayNum(nyDay(e.t))));
    const accounts = uids.filter(u => people.has('u:' + u));
    dev.pid = accounts.length ? 'u:' + accounts[0] : 'd:' + h;                    // its events count for one person: the account last signed in on it, else the guest it is
    if (!accounts.length) people.set(dev.pid, { id: dev.pid, kind: 'guest', uid: null, username: '', joined: null, src: '', devices: [], own: [], first: null, last: null, rec: null, owner: false, pls: new Set(), days: new Set(), sessions: [], matches: [] });
    for (const u of accounts) people.get('u:' + u).devices.push(dev);          // (a shared device is listed under every account that signed in on it)
    if (!accounts.length) people.get(dev.pid).devices.push(dev);
    const p = people.get(dev.pid);
    p.own.push(dev);
    for (const s of dev.sessions) { s.pid = dev.pid; p.sessions.push(s); }
    for (const n of dev.days) p.days.add(n);
    devs.set(h, dev);
  }
  for (const p of people.values()) {
    for (const d of p.devices) { if (d.owner) p.owner = true; p.pls.add(d.pl); }
    for (const d of p.own) { p.first = Math.min(p.first || Infinity, d.first); p.last = Math.max(p.last || 0, d.last); }
    if (p.first === Infinity) p.first = null;
    p.firstDay = p.first ? nyDay(p.first) : null;
    p.tag = p.src || (p.devices.find(d => d.tag) || {}).tag || '';
    p.nick = [...new Set(p.devices.map(d => d.nick).filter(Boolean))].join(', ');
    p.name = p.username || p.nick || (p.kind === 'guest' ? 'Guest ' + p.id.slice(2, 10) : 'Account ' + String(p.uid).slice(0, 6));
    p.sessions.sort((a, b) => a.start - b.start);
  }
  // matches
  const matches = [], logIndex = data.logIndex || {};
  for (const byId of Object.values(data.matches || {})) {   // (filed by day: the day is worked out from the start, the same way as every other row's)
    for (const [id, r] of Object.entries(byId || {})) {
      if (!r || !Number.isFinite(r.t0)) continue;
      let sq = [];
      try { sq = r.sq ? JSON.parse(r.sq) : []; } catch (e) { sq = []; }
      const who = (Array.isArray(r.who) ? r.who : Object.values(r.who || {})).map(w => {
        const acct = w.u && people.has('u:' + w.u) ? 'u:' + w.u : null, dev = w.h ? devs.get(w.h) : null;
        return Object.assign({}, w, { pid: w.bot ? null : acct || (dev ? dev.pid : w.h ? 'd:' + w.h : null) });
      });
      const humans = who.filter(w => !w.bot);
      const m = { id, day: nyDay(r.t0), t0: r.t0, t1: r.t1 || null, mode: r.m || 'local', group: MODE_GROUP[r.m] || 'other', timer: r.tm || 'none', end: r.end || null, w: r.w || null, turns: r.n || 0, ms: Number.isFinite(r.ms) ? r.ms : null,
        who, sc: !!r.sc, room: r.rm || '', pls: new Set(humans.map(w => w.pl || (w.h && devs.get(w.h) ? devs.get(w.h).pl : 'web'))), sq: sq.map(e => Object.assign({ X: 0, O: 0, v: 1 }, e)),
        own: !!r.own || humans.some(w => (w.h && devs.get(w.h) && devs.get(w.h).owner) || (w.pid && people.get(w.pid) && people.get(w.pid).owner)) };
      m.status = m.t1 ? (ABANDONED.includes(m.end) ? 'abandoned' : 'finished') : now - m.t0 > LIVE_MS ? 'unfinished' : 'playing';
      try { m.su = r.su ? JSON.parse(r.su) : null; } catch (e) { m.su = null; }   // (its setup, December 2026: factSetup)
      m.mp = r.mp || null; m.ab = Number.isInteger(r.ab) ? r.ab : null; m.tmo = r.tmo || null;
      m.logKey = id.startsWith('l_') ? 'l' + id.slice(2) : 'm' + id;
      const ix = logIndex[m.logKey];
      m.log = ix ? { n: ix.n || 0, reported: ix.reported || 0, note: ix.note || '', vers: ix.vers || '' } : null;
      for (const pid of new Set(humans.map(w => w.pid).filter(Boolean))) if (people.has(pid)) people.get(pid).matches.push(m);
      matches.push(m);
    }
  }
  matches.sort((a, b) => b.t0 - a.t0);
  for (const p of people.values()) p.matches.sort((a, b) => b.t0 - a.t0);
  // an online match's "?" taps and the square its leaver had on screen ride each phone's end event (the server keeps the plays):
  // its taps join their play by its pick number (hX, hO), as a local match's report carries them
  const byLog = new Map(matches.map(m => [m.logKey, m]));
  for (const dev of devs.values()) for (const e of dev.evs) {
    if ((e.ev !== 'finish' && e.ev !== 'leave') || !e.g || !byLog.has(e.g)) continue;
    const m = byLog.get(e.g);
    if (e.ev === 'leave' && Number.isInteger(e.ab) && m.ab == null) m.ab = e.ab;
    if (typeof e.hp !== 'string' || (e.s !== 'X' && e.s !== 'O')) continue;
    for (const part of e.hp.split(',')) {
      const [k, n] = part.split(':').map(Number), play = m.sq.find(x => x.k === k);
      if (play && n > 0) play['h' + e.s] = (play['h' + e.s] || 0) + n;
    }
  }
  const finds = [];
  for (const byId of Object.values(data.finds || {})) for (const [id, r] of Object.entries(byId || {})) if (r && Number.isFinite(r.t)) finds.push({ id, day: nyDay(r.t), t: r.t, k: r.k, ms: r.ms || 0, u: r.u || '', pid: r.u && people.has('u:' + r.u) ? 'u:' + r.u : null, own: !!r.own || !!(r.u && people.get('u:' + r.u) && people.get('u:' + r.u).owner) });
  const reports = Object.entries(data.reports || {}).map(([id, r]) => Object.assign({ id }, r, { dev: r.h ? devs.get(r.h) : null })).map(r => Object.assign(r, { pid: r.uid && people.has('u:' + r.uid) ? 'u:' + r.uid : r.dev ? r.dev.pid : null, own: !!(r.dev && r.dev.owner) })).sort((a, b) => b.at - a.at);
  return { now, today: nyDay(now), devs, people, matches, finds, reports, meta };
}

// ---------- a scope: the model under the filters. Every metric is asked of a scope. ----------
export function scope(M, filters) {
  const f = normFilters(filters), R = rangeOf(f, M.now), d0 = dayNum(R.from), d1 = dayNum(R.to);
  const inDay = day => day >= R.from && day <= R.to, inT = t => inDay(nyDay(t));
  const plat = pl => f.platform === 'all' || pl === f.platform;
  const S = { M, f, from: R.from, to: R.to, days: dayList(R.from, R.to), inDay, inT, cache: {} };
  S.devOk = d => (f.mine || !d.owner) && plat(d.pl);
  S.personOk = p => (f.mine || !p.owner) && (f.platform === 'all' || p.pls.has(f.platform) || (!p.pls.size && f.platform === 'web'));
  S.matchOk = m => inDay(m.day) && (f.mine || !m.own) && (f.platform === 'all' || m.pls.has(f.platform)) && (f.mode === 'all' || m.group === f.mode);
  const memo = (k, fn) => (k in S.cache ? S.cache[k] : (S.cache[k] = fn()));
  S.people = () => memo('people', () => [...M.people.values()].filter(S.personOk));
  S.devices = () => memo('devices', () => [...M.devs.values()].filter(S.devOk));
  // a person's days of activity inside the range
  const daysIn = p => { let k = 0; for (const n of p.days) if (n >= d0 && n <= d1) k++; return k; };
  S.active = () => memo('active', () => S.people().filter(p => daysIn(p) > 0));
  S.newPlayers = () => memo('new', () => S.people().filter(p => p.firstDay && inDay(p.firstDay) && p.days.size));
  S.newAccounts = () => memo('newAcc', () => S.people().filter(p => p.kind === 'account' && p.joined && inT(p.joined)));
  S.matches = () => memo('matches', () => M.matches.filter(S.matchOk));
  S.byStatus = st => memo('st:' + st, () => S.matches().filter(m => m.status === st));
  S.played = () => memo('played', () => { const ids = new Set(); for (const m of S.matches()) for (const w of m.who) if (w.pid) ids.add(w.pid); return S.active().filter(p => ids.has(p.id)); });
  S.sessions = () => memo('sessions', () => S.devices().flatMap(d => d.sessions.filter(s => inDay(s.day))).sort((a, b) => b.start - a.start));
  S.events = kind => memo('ev:' + kind, () => { const out = []; for (const d of S.devices()) for (const e of d.evs) if (e.ev === kind && inT(e.t)) out.push(Object.assign({ dev: d }, e)); return out.sort((a, b) => b.t - a.t); });
  S.squares = () => memo('squares', () => S.byStatus('finished').filter(m => !m.sc).flatMap(m => m.sq.map(e => Object.assign({ m }, e))));
  S.finds = () => memo('finds', () => M.finds.filter(r => inDay(r.day) && (f.mine || !r.own)));
  S.reports = () => memo('reports', () => M.reports.filter(r => inT(r.at) && (f.mine || !r.own) && plat(r.p || (r.dev ? r.dev.pl : 'web'))));
  // the cohort: people first seen in the range
  S.cohort = () => S.newPlayers();
  return S;
}

// ---------- the metrics: { v (the value), rows (what it counts), kind (what the rows are), of (its denominator) } ----------
const todayNum = S => dayNum(S.M.today);
function retained(S, k) {
  const elig = S.cohort().filter(p => todayNum(S) - dayNum(p.firstDay) >= k), back = elig.filter(p => p.days.has(dayNum(p.firstDay) + k));
  return { v: ratio(back.length, elig.length), rows: back, kind: 'people', n: back.length, of: elig.length };
}
function within7(S) {
  const elig = S.cohort().filter(p => todayNum(S) - dayNum(p.firstDay) >= 7), back = elig.filter(p => { const d = dayNum(p.firstDay); for (let k = 1; k <= 7; k++) if (p.days.has(d + k)) return true; return false; });
  return { v: ratio(back.length, elig.length), rows: back, kind: 'people', n: back.length, of: elig.length };
}
const hasStep = (p, step) => p.own.some(d => d.evs.some(e => e.ev === 'step' && e.step === step));
const countEv = (p, ev) => p.own.reduce((n, d) => n + d.evs.filter(e => e.ev === ev).length, 0);
const acts = (S, act, ch) => S.events('act').filter(e => e.act === act && (!ch || e.ch === ch));
const people = rows => ({ v: rows.length, rows, kind: 'people' });
const matchesM = rows => ({ v: rows.length, rows, kind: 'matches' });
const eventsM = rows => ({ v: rows.length, rows, kind: 'events' });
const findsM = rows => ({ v: rows.length, rows, kind: 'finds' });
const METRICS = {
  active: S => people(S.active()),
  newPlayers: S => people(S.newPlayers()),
  newAccounts: S => people(S.newAccounts()),
  played: S => people(S.played()),
  sessions: S => ({ v: S.sessions().length, rows: S.sessions(), kind: 'sessions' }),
  sessionLen: S => ({ v: quant(S.sessions().map(s => s.ms), 0.5), rows: S.sessions(), kind: 'sessions' }),
  started: S => matchesM(S.matches()),
  finished: S => matchesM(S.byStatus('finished')),
  abandoned: S => matchesM(S.byStatus('abandoned')),
  unfinished: S => matchesM(S.byStatus('unfinished')),
  completion: S => { const done = S.byStatus('finished'), of = S.matches().length - S.byStatus('playing').length; return { v: ratio(done.length, of), rows: done, kind: 'matches', n: done.length, of }; },
  turns: S => ({ v: quant(S.byStatus('finished').map(m => m.turns), 0.5), rows: S.byStatus('finished'), kind: 'matches' }),
  minutes: S => { const rows = S.byStatus('finished').filter(m => m.ms != null); const q = quant(rows.map(m => m.ms / 60000), 0.5); return { v: q, rows, kind: 'matches' }; },
  firstPlayer: S => { const dec = S.byStatus('finished').filter(m => m.w), x = dec.filter(m => m.w === 'X'); return { v: ratio(x.length, dec.length), rows: x, kind: 'matches', n: x.length, of: dec.length }; },
  squares: S => { const rows = S.squares().filter(e => e.end === 'won'); return { v: rows.length, rows, kind: 'squares' }; },
  resets: S => { const all = S.squares(), rows = all.filter(e => e.end === 'draw'); return { v: ratio(rows.length, all.length), rows, kind: 'squares', n: rows.length, of: all.length }; },
  open: S => { const all = S.squares(), rows = all.filter(e => e.end === 'open'); return { v: ratio(rows.length, all.length), rows, kind: 'squares', n: rows.length, of: all.length }; },
  d1: S => retained(S, 1), d7: S => retained(S, 7), d30: S => retained(S, 30), w1: S => within7(S),
  fOpened: S => people(S.cohort()),
  fTap: S => people(S.cohort().filter(p => hasStep(p, 'tap'))),
  fMove: S => people(S.cohort().filter(p => hasStep(p, 'move'))),
  fClaim: S => people(S.cohort().filter(p => hasStep(p, 'claim'))),
  fFinished: S => people(S.cohort().filter(p => countEv(p, 'finish') >= 1)),
  fSecond: S => people(S.cohort().filter(p => countEv(p, 'start') >= 2)),
  opens: S => eventsM(S.events('open')),
  errors: S => eventsM(S.events('error')),
  errorRate: S => { const e = S.events('error'), o = S.events('open'); return { v: o.length ? 100 * e.length / o.length : null, rows: e, kind: 'events', n: e.length, of: o.length }; },
  reports: S => ({ v: S.reports().length, rows: S.reports(), kind: 'reports' }),
  findPeople: S => findsM(S.finds().filter(r => r.k === 'people')),
  findBot: S => findsM(S.finds().filter(r => r.k === 'bot')),
  findCancel: S => findsM(S.finds().filter(r => r.k === 'cancel')),
  findFill: S => { const b = S.finds().filter(r => r.k === 'bot'), p = S.finds().filter(r => r.k === 'people'); return { v: ratio(b.length, b.length + p.length), rows: b, kind: 'finds', n: b.length, of: b.length + p.length }; },
  findWait: S => { const rows = S.finds().filter(r => r.k !== 'cancel'); return { v: quant(rows.map(r => r.ms / 1000), 0.5), rows, kind: 'finds' }; },
  invitesSent: S => eventsM(acts(S, 'invite')),
  inviteOpens: S => eventsM(acts(S, 'invite-open')),
  inviteJoins: S => eventsM(acts(S, 'invite-join')),
  inviteDone: S => eventsM(acts(S, 'invite-done')),
  rematches: S => eventsM(acts(S, 'rematch')),
  shares: S => eventsM(acts(S, 'share')),
};
export function metric(S, id) {
  if (!METRICS[id]) throw new Error('No such metric: ' + id);
  const k = 'm:' + id;
  return k in S.cache ? S.cache[k] : (S.cache[k] = Object.assign({ id }, METRICS[id](S)));
}
export const METRIC_IDS = Object.keys(METRICS);

// ---------- series (the charts) ----------
export function activeByDay(S) {
  const by = Object.fromEntries(S.days.map(d => [d, 0])), d0 = dayNum(S.from), d1 = dayNum(S.to);
  for (const p of S.people()) for (const n of p.days) if (n >= d0 && n <= d1) by[numDay(n)]++;
  return S.days.map(d => by[d]);
}
export function matchesByDay(S, status) {
  const groups = ['cpu', 'friend', 'find', 'other'], by = Object.fromEntries(groups.map(g => [g, Object.fromEntries(S.days.map(d => [d, 0]))]));
  for (const m of S.matches()) if (!status || m.status === status) by[m.group][m.day]++;
  return groups.map(g => ({ group: g, name: GROUP_LABEL[g], values: S.days.map(d => by[g][d]) }));
}
export function eventsByDay(S, kind) { const by = Object.fromEntries(S.days.map(d => [d, 0])); for (const e of S.events(kind)) by[nyDay(e.t)]++; return S.days.map(d => by[d]); }

// ---------- a mini-game's numbers (the Games pages), by settings version ----------
// versions: { type: current number }. o.version: 'current' | 'previous' | 'all' | a number.
function sqStats(rows) {
  const won = rows.filter(e => e.end === 'won'), timed = won.filter(e => Number.isFinite(e.ms)), fd = won.filter(e => e.f === 'X' || e.f === 'O');
  const s = { played: rows.length, n: won.length, draw: rows.filter(e => e.end === 'draw').length, open: rows.filter(e => e.end === 'open').length,
    moves: quants(won.map(e => e[e.w] || 1)), secs: quants(timed.map(e => e.ms / 1000)), firstMover: ratio(fd.filter(e => e.f === e.w).length, fd.length), firstMoverOf: fd.length, rows };
  s.resetRate = ratio(s.draw, s.played); s.openRate = ratio(s.open, s.played);
  s.flags = (s.moves.med != null && s.moves.med > FLAG_MOVES ? ['slow'] : []).concat(s.n < FLAG_SAMPLE ? ['small'] : []);
  return s;
}
export function gameStats(S, type, versions, pick) {
  const all = S.squares().filter(e => e.t === type), cur = (versions && versions[type]) || 1;
  const want = pick === undefined ? S.f.version : pick;
  const v = want === 'all' ? null : want === 'previous' ? Math.max(1, cur - 1) : want === 'current' ? cur : Number(want);
  const rows = v == null ? all : all.filter(e => (e.v || 1) === v);
  const byVersion = [...new Set(all.map(e => e.v || 1).concat(cur))].sort((a, b) => b - a).map(n => Object.assign({ v: n, current: n === cur }, sqStats(all.filter(e => (e.v || 1) === n))));
  return Object.assign({ type, version: v, current: cur }, sqStats(rows), { byVersion });
}
// ---------- a game's quality (December 2026, the Games page's quality table), every number from the match rows ----------
// A square's place on the board: a corner (0 2 6 8), a side (1 3 5 7), the centre (4).
export const posOf = i => (!Number.isInteger(i) ? null : i === 4 ? 'center' : i % 2 === 0 ? 'corner' : 'side');
export const AI_MODES = ['cpu', 'bot', 'cvc'];
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
// Of the matches in scope (the filters: dates, my devices, platform, mode) and, by the page's own filters, the opponent type (the
// computer: vs Computer and Find Match's bot) and the board position (the plays in squares of that place; the board's games dealt
// there), per game: exclusion (of the setups that offered it, left out), play and never-played (of the matches it was dealt into,
// with a setup on their row: played, or never), started but not finished (plays left open when the match ended), the finished
// plays' median length (its first move to its end) and turns, draws, the first mover's wins, the human's wins against the
// computer, the average pick number, "?" taps a play, and rematches after the finished matches it was played in. Super Chaos apart.
export function gameQuality(S) {
  const f = S.f, posOk = i => f.pos === 'all' || posOf(i) === f.pos;
  const oppOk = m => f.opp === 'all' || (f.opp === 'ai') === AI_MODES.includes(m.mode);
  const ms = S.matches().filter(m => !m.sc && oppOk(m));
  const rematched = new Set(S.M.matches.map(m => m.su && m.su.rp).filter(Boolean));
  const G = new Map(), acc = t => { if (!G.has(t)) G.set(t, { t, av: 0, ex: 0, board: 0, played: 0, plays: [], remOf: 0, rem: 0 }); return G.get(t); };
  for (const m of ms) {
    const su = m.su || {};
    if (Array.isArray(su.av)) for (const t of su.av) { const a = acc(t); a.av++; if (Array.isArray(su.ex) && su.ex.includes(t)) a.ex++; }
    if (Array.isArray(su.b) && su.b.length === 9) {               // (the board's games: dealt at the start, and every game dealt there after a draw)
      const dealt = new Set(su.b.filter((t, i) => posOk(i)));
      for (const e of m.sq) if (Number.isInteger(e.i) && posOk(e.i)) dealt.add(e.t);
      const played = new Set(m.sq.filter(e => posOk(e.i) && e.X + e.O > 0).map(e => e.t));
      for (const t of dealt) { const a = acc(t); a.board++; if (played.has(t)) a.played++; }
    }
    for (const e of m.sq) if (f.pos === 'all' || posOk(e.i)) acc(e.t).plays.push(Object.assign({ m }, e));
    if (m.t1 && !ABANDONED.includes(m.end)) for (const t of new Set(m.sq.filter(e => f.pos === 'all' || posOk(e.i)).map(e => e.t))) { const a = acc(t); a.remOf++; if (rematched.has(m.id)) a.rem++; }
  }
  return [...G.values()].map(a => {
    const p = a.plays, done = p.filter(e => e.end === 'won' || e.end === 'draw'), won = p.filter(e => e.end === 'won');
    const fm = won.filter(e => e.f === 'X' || e.f === 'O'), hum = won.map(e => ({ e, h: humanSide(e.m) })).filter(x => x.h);
    const len = done.map(e => (Number.isFinite(e.e) && Number.isFinite(e.s) ? e.e - e.s : Number.isFinite(e.ms) ? e.ms : null)).filter(v => v != null);
    const ks = p.filter(e => Number.isInteger(e.k)).map(e => e.k), withHelp = p.filter(e => Number.isInteger(e.k));
    return { t: a.t, plays: p.length, rows: p,
      exclusion: ratio(a.ex, a.av), exOf: a.av, playRate: ratio(a.played, a.board), neverRate: ratio(a.board - a.played, a.board), boardOf: a.board,
      unfinished: ratio(p.filter(e => e.end === 'open').length, p.length), secs: quant(len.map(v => v / 1000), 0.5), turns: quant(done.map(e => e.X + e.O), 0.5),
      drawRate: ratio(done.filter(e => e.end === 'draw').length, done.length), firstMover: ratio(fm.filter(e => e.f === e.w).length, fm.length), fmOf: fm.length,
      humanWin: ratio(hum.filter(x => x.e.w === x.h).length, hum.length), humanOf: hum.length, pick: mean(ks),
      help: withHelp.length ? withHelp.reduce((s, e) => s + (e.hX || 0) + (e.hO || 0), 0) / withHelp.length : null, rematch: ratio(a.rem, a.remOf), remOf: a.remOf };
  });
}
// The human's side in a match against the computer (vs Computer: the side the phone reported; Find Match's bot: the seat that is no bot).
function humanSide(m) {
  if (!AI_MODES.includes(m.mode) || m.mode === 'cvc') return null;
  const h = m.who.find(w => !w.bot && (w.s === 'X' || w.s === 'O'));
  return h ? h.s : null;
}
// A runner's runs (Dash, Lane Rush, Flap, Chopper): runs to finish, distance, where the crashes were.
export function runStats(S, type, bin = 50) {
  const s = { runs: 0, distSum: 0, finishes: 0, finishRuns: 0, crash: {} };
  for (const e of S.squares()) {
    if (e.t !== type || !e.run) continue;
    const r = e.run;
    s.runs += ((r.runs || {}).X || 0) + ((r.runs || {}).O || 0); s.distSum += ((r.dist || {}).X || 0) + ((r.dist || {}).O || 0);
    for (const p of ['X', 'O']) for (const c of (r.crashes || {})[p] || []) { const b = Math.floor(c / bin) * bin; s.crash[b] = (s.crash[b] || 0) + 1; }
    if (e.end === 'won') { s.finishes++; s.finishRuns += (r.runs || {})[e.w] || 0; }
  }
  return s;
}
// Match length by mode and timer (the Matches page).
export function lengthRows(S) {
  const by = new Map();
  for (const m of S.matches()) { const k = m.mode + '|' + m.timer; if (!by.has(k)) by.set(k, { mode: m.mode, group: m.group, timer: m.timer, rows: [] }); by.get(k).rows.push(m); }
  return [...by.values()].map(g => {
    const fin = g.rows.filter(m => m.status === 'finished'), live = g.rows.filter(m => m.status === 'playing').length;
    return Object.assign(g, { fin, started: g.rows.length, finished: fin.length, abandoned: g.rows.filter(m => m.status === 'abandoned').length, unfinished: g.rows.filter(m => m.status === 'unfinished').length,
      completion: ratio(fin.length, g.rows.length - live), turns: quants(fin.map(m => m.turns)), mins: quants(fin.filter(m => m.ms != null).map(m => m.ms / 60000)) });
  }).sort((a, b) => b.started - a.started);
}
// Retention and the first-run funnel by install day (the Growth page).
export function cohortRows(S) {
  const by = new Map();
  for (const p of S.cohort()) { if (!by.has(p.firstDay)) by.set(p.firstDay, []); by.get(p.firstDay).push(p); }
  const today = todayNum(S);
  return [...by.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, ps]) => {
    const row = { day, n: ps.length, people: ps, age: today - dayNum(day) };
    for (const k of RETAIN) row['d' + k] = row.age >= k ? ps.filter(p => p.days.has(dayNum(day) + k)).length : null;
    row.tap = ps.filter(p => hasStep(p, 'tap')).length; row.move = ps.filter(p => hasStep(p, 'move')).length; row.claim = ps.filter(p => hasStep(p, 'claim')).length;
    row.finished = ps.filter(p => countEv(p, 'finish') >= 1).length; row.second = ps.filter(p => countEv(p, 'start') >= 2).length;
    return row;
  });
}
// Where players came from: a ?t= tag's people first seen in the range, and the accounts they made.
export function sourceRows(S) {
  const by = new Map(), row = t => { if (!by.has(t)) by.set(t, { tag: t, people: [], signups: [] }); return by.get(t); };
  for (const p of S.cohort()) row(p.tag || '(none)').people.push(p);
  for (const p of S.newAccounts()) row(p.tag || '(none)').signups.push(p);
  return [...by.values()].sort((a, b) => b.people.length - a.people.length);
}
export function buildRows(S) {                  // opens and errors by build (the Health page)
  const by = new Map(), row = b => { if (!by.has(b)) by.set(b, { build: b, openRows: [], errorRows: [] }); return by.get(b); };
  for (const e of S.events('open')) row(e.b || '(unknown)').openRows.push(e);
  for (const e of S.events('error')) row(e.b || '(unknown)').errorRows.push(e);
  return [...by.values()].map(r => Object.assign(r, { opens: r.openRows.length, errors: r.errorRows.length, rate: r.openRows.length ? 100 * r.errorRows.length / r.openRows.length : null })).sort((a, b) => b.opens - a.opens);
}
export function clientRows(S) {                 // opens by platform and client version
  const by = new Map();
  for (const e of S.events('open')) { const k = (e.p || e.dev.pl) + ' ' + (e.cv || ''); if (!by.has(k)) by.set(k, { platform: e.p || e.dev.pl, version: e.cv || '', rows: [] }); by.get(k).rows.push(e); }
  return [...by.values()].map(r => Object.assign(r, { opens: r.rows.length })).sort((a, b) => b.opens - a.opens);
}
// A person in the range: their sessions and matches there (the Players table).
export function personRow(S, p) {
  const ses = p.sessions.filter(s => S.inDay(s.day)), ms = p.matches.filter(S.matchOk);
  return { p, id: p.id, name: p.name, kind: p.kind, username: p.username, nick: p.nick, devices: p.devices.length, shorts: p.devices.map(d => d.short).join(' '), platform: [...p.pls].sort().join(', '), tag: p.tag, first: p.first, last: p.last,
    sessions: ses.length, matches: ms.length, finished: ms.filter(m => m.status === 'finished').length, record: p.rec ? `${p.rec.wins}-${p.rec.losses}-${p.rec.draws}` : '', games: p.rec ? p.rec.wins + p.rec.losses + p.rec.draws : null, excluded: p.owner };
}
// A person's result in a match: 'won' | 'lost' | 'draw' | '' (not over, or not theirs to say).
export function resultFor(m, pid) {
  if (m.status !== 'finished' && m.status !== 'abandoned') return '';
  if (!m.w) return 'draw';
  const mine = m.who.filter(w => w.pid === pid), sides = new Set(mine.map(w => w.s).filter(Boolean));
  if (!sides.size || sides.size > 1) return '';
  return sides.has(m.w) ? 'won' : 'lost';
}
// The mini-games a person played: squares in their finished matches, by game (won and lost where their side is known).
export function personGames(p) {
  const by = new Map();
  for (const m of p.matches) {
    if (m.status !== 'finished') continue;
    const side = (m.who.find(w => w.pid === p.id && w.s) || {}).s || null;
    for (const e of m.sq) { if (!by.has(e.t)) by.set(e.t, { t: e.t, played: 0, won: 0, lost: 0 }); const r = by.get(e.t); r.played++; if (e.end === 'won' && side) { if (e.w === side) r.won++; else r.lost++; } }
  }
  return [...by.values()].sort((a, b) => b.played - a.played);
}
