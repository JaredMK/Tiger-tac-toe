'use strict';
/* The playtest numbers on the admin page, worked out from the devices' logs (devices/ and devlog/, written
 * by the server's devlog function): sessions, activity by hour, the devices table, retention and the
 * funnel. Pure (no page, no database), so the tests run it as it is: admin.html loads it as a script,
 * Node requires it.
 *
 * A device's events: { t, ev: 'open' | 'live' | 'start' | 'finish' | 'leave', m: mode, g: match }. A session starts
 * after 30 minutes with nothing from the device. Days and hours are New York time (America/New_York),
 * summer time included.
 */
(function (root) {
  const TZ = 'America/New_York';
  const GAP = 30 * 60000;                       // a session ends after this long with nothing
  const HOUR = 3600000, DAY = 86400000;
  const MODE_NAMES = { local: 'Two players', cpu: 'vs Computer', cvc: 'Computer vs Computer', friend: 'Friend code', match: 'Find Match' };

  // ---------- New York time ----------
  let fmt = null;
  function parts(t) {
    fmt = fmt || new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const o = {};
    for (const p of fmt.formatToParts(new Date(t))) o[p.type] = p.value;
    return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute };
  }
  const pad = n => String(n).padStart(2, '0');
  function nyDay(t) { const p = parts(t); return `${p.y}-${pad(p.mo)}-${pad(p.d)}`; }
  function nyHour(t) { const p = parts(t); return `${p.y}-${pad(p.mo)}-${pad(p.d)} ${pad(p.h)}:00`; }
  function dayNum(day) { const [y, m, d] = day.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); }   // days apart, whatever the clocks did
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function nyWhen(t) {                         // "Oct 15, 3:07 pm"
    if (!t) return '–';
    const p = parts(t), h = p.h % 12 || 12;
    return `${MON[p.mo - 1]} ${p.d}, ${h}:${pad(p.mi)} ${p.h < 12 ? 'am' : 'pm'}`;
  }
  function nyDate(t) { if (!t) return '–'; const p = parts(t); return `${MON[p.mo - 1]} ${p.d}, ${p.y}`; }
  function dur(ms) {                           // "45 s", "12 min", "1 h 05 min"
    if (ms == null || !Number.isFinite(ms)) return '–';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} s`;
    const m = Math.round(s / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
  }

  // ---------- one device ----------
  const EVS = ['open', 'live', 'start', 'finish', 'leave'];          // ('live': still playing, every 10 minutes of a match)
  function eventsOf(log) {                     // the device's events, oldest first (anything malformed left out)
    return Object.values(log || {}).filter(e => e && Number.isFinite(e.t) && EVS.includes(e.ev)).sort((a, b) => a.t - b.t);
  }
  // The device's matches, each { g, mode, start, end, how: 'finish' | 'leave' | null }, by when they started.
  function gamesOf(evs) {
    const by = new Map();
    for (const e of evs) {
      if (!e.g) continue;
      const x = by.get(e.g) || { g: e.g, mode: e.m || null, start: null, end: null, how: null };
      if (e.ev === 'start') x.start = e.t;
      else if (e.ev === 'finish' || e.ev === 'leave') { x.end = e.t; x.how = e.ev; }
      if (!x.mode && e.m) x.mode = e.m;
      by.set(e.g, x);
    }
    return [...by.values()].filter(x => x.start != null).sort((a, b) => a.start - b.start);
  }
  // Sessions: a new one after 30 minutes without an event. Each: its start and end, the games started in
  // it, how many were finished in a row (the longest run), its length, the modes, and whether it ended
  // mid-match ('left': its last game was left; 'open': its last game had not ended when the session did).
  function sessionsOf(evs) {
    const out = [];
    let cur = null;
    for (const e of evs) {
      if (!cur || e.t - cur.end > GAP) { cur = { start: e.t, end: e.t, events: [] }; out.push(cur); }
      cur.end = e.t; cur.events.push(e);
    }
    const games = gamesOf(evs);
    for (const s of out) {
      s.games = games.filter(x => x.start >= s.start && x.start <= s.end);
      s.played = s.games.length;
      let run = 0;
      s.streak = 0;
      for (const x of s.games) { run = x.how === 'finish' ? run + 1 : 0; s.streak = Math.max(s.streak, run); }
      s.ms = s.end - s.start;
      s.modes = [...new Set(s.games.map(x => x.mode).filter(Boolean))];
      const last = s.games[s.games.length - 1];
      s.mid = !last ? null : last.how === 'leave' && last.end <= s.end ? 'left' : last.how && last.end <= s.end ? null : 'open';
    }
    return out;
  }

  // ---------- every device ----------
  // devices: { h: { first, last, n, tag } }, logs: { h: { k: event } }. One row per device, newest first.
  function deviceRows(devices, logs) {
    const ids = new Set(Object.keys(devices || {}).concat(Object.keys(logs || {})));
    const rows = [];
    for (const h of ids) {
      const d = (devices || {})[h] || {}, evs = eventsOf((logs || {})[h]);
      if (!evs.length && !d.first) continue;
      const first = evs.length ? evs[0].t : d.first, last = evs.length ? evs[evs.length - 1].t : d.last || d.first;
      const sessions = sessionsOf(evs), games = sessions.reduce((n, s) => n + s.played, 0);
      const d0 = dayNum(nyDay(first)), days = new Set(evs.map(e => dayNum(nyDay(e.t))));
      rows.push({ h, short: h.slice(0, 8), tag: d.tag || '', first, last, sessions, nSessions: sessions.length, games,
        perSession: sessions.length ? games / sessions.length : null,
        back: [...days].some(x => x > d0), nextDay: days.has(d0 + 1), week: [...days].some(x => x > d0 && x <= d0 + 7),
        firstDay: d0, evs });
    }
    return rows.sort((a, b) => b.last - a.last);
  }
  // Activity by hour for the last `days` days, up to the hour now: matches started and finished, and the
  // devices active, in each hour. Hours are real hours (so the clocks going back gives two 1 am hours).
  function hourly(rows, now, days = 7) {
    const end = Math.floor(now / HOUR), start = end - days * 24 + 1, n = end - start + 1;
    const hours = Array.from({ length: n }, (_, i) => ({ t: (start + i) * HOUR, label: nyHour((start + i) * HOUR), started: 0, finished: 0, devices: 0 }));
    for (const r of rows) {
      const seen = new Set();
      for (const e of r.evs) {
        const i = Math.floor(e.t / HOUR) - start;
        if (i < 0 || i >= n) continue;
        if (e.ev === 'start') hours[i].started++;
        if (e.ev === 'finish') hours[i].finished++;
        if (!seen.has(i)) { seen.add(i); hours[i].devices++; }
      }
    }
    return hours;
  }
  // Came back: the next day (New York days), and within 7 days, among the devices first seen before today.
  function retention(rows, now) {
    const today = dayNum(nyDay(now)), old = rows.filter(r => r.firstDay < today);
    return { eligible: old.length, nextDay: old.filter(r => r.nextDay).length, week: old.filter(r => r.week).length };
  }
  // Opened the app → started a game → finished a game → started another after it.
  function funnel(rows) {
    const f = { opened: 0, started: 0, finished: 0, another: 0 };
    for (const r of rows) {
      f.opened++;
      const starts = r.evs.filter(e => e.ev === 'start'), fin = r.evs.find(e => e.ev === 'finish');
      if (starts.length) f.started++;
      if (fin) { f.finished++; if (starts.some(e => e.t >= fin.t && e.g !== fin.g)) f.another++; }
    }
    return f;
  }

  const api = { TZ, GAP, MODE_NAMES, parts, nyDay, nyHour, nyWhen, nyDate, dayNum, dur, eventsOf, gamesOf, sessionsOf, deviceRows, hourly, retention, funnel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Playtest = api;
})(typeof window !== 'undefined' ? window : this);
