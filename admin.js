// The admin dashboard's script (admin.html loads it: a file of its own, so the page's Content-Security-Policy needs no inline script).
'use strict';
const FIREBASE_VERSION = '11.10.0';
const FIREBASE_CONFIG = window.TTC_ENV.config;   // production or staging, by the page's address (src/env.js)
const STAGING = window.TTC_ENV.staging;
const MODES = [['local', 'Two players'], ['cpu', 'vs Computer'], ['chaos', 'Super Chaos'], ['cvc', 'Computer vs Computer (old)'], ['friend', 'Friend code'], ['match', 'Find Match'], ['bot', 'Find Match vs a bot'], ['casual', 'Casual (old)'], ['ranked', 'Ranked (old)']];
const MODE_COLORS = { local: 'var(--o)', cpu: 'var(--sky)', chaos: '#d9622b', cvc: 'var(--stone)', friend: 'var(--plum)', match: 'var(--green)', bot: '#2f7f6f', casual: '#8fbf7a', ranked: 'var(--x)' };
const GAMES = { ttt: 'Tic-tac-toe', c4: 'Four in a Row', bs: 'Sea Battle', wordle: 'Five Letters', hangman: 'Hangman', hex: 'Hex', hilo: 'Higher/Lower', snakes: 'Snakes and Ladders', memory: 'Find the Pair', candy: 'Candy Race', bump: 'Bump', coins: 'Coin Flip', pig: 'Risky Rolls', hunt: 'Treasure Hunt', mastermind: 'Codebreaker', bj: 'Blackjack', bus: 'Ride the Bus', rl: 'Roulette', bullseye: 'Bullseye', echo: 'Echo', plinko: 'Peg Drop', pong: 'Cup Pong', trivia: 'Trivia', oddone: 'Odd One Out', dash: 'Dash', lane: 'Lane Rush', golf: 'Mini Golf', pool: 'Pool', bowling: 'Bowling', craps: 'Craps', takeover: 'Takeover', flood: 'Flood', seating: 'Seating', districts: 'Districts', shelves: 'Shelves', roads: 'Roads', flap: 'Flap', chopper: 'Chopper', patterns: 'Patterns', wheels: 'Risky Spins', sniff: 'Sniff', clash: 'Standoff Grid', headcount: 'Headcount', flash: 'Flash', snapshot: 'Snapshot', skyhop: 'Sky Hop', scoop: 'Scoop Stack', pinball: 'Pinball' };   // the games in the pool (Hexapawn and the Dice race are gone; their numbers stay in the database)
const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let fb = null, user = null, stats = null, flagged = null, view = { status: 'loading', error: '' };
let ctl = { config: {}, secretsSet: {}, bots: {}, botStats: {}, alertLog: [], alertStats: {} }, testResult = null, keyMsg = '';
// The defaults the server uses for anything not set (functions/bots.js).
const DEF = { bots: { enabled: false, waitMin: 40, waitMax: 70, countInRecords: true, level: 'normal' }, alerts: { enabled: false, sms: false, email: true, phone: '', to: '', after: 5, cooldownMin: 30, gapMin: 3, dailyCap: 20 } };
const cfgGet = (sec, k) => { const v = ((ctl.config || {})[sec] || {})[k]; return v === undefined || v === null || v === '' ? DEF[sec][k] : v; };
let sortBy = { k: 'avgWin', dir: 1 }, miniMode = 'all', period = 'd';
let accts = null, acctSort = { k: 'joined', dir: -1 };                       // the Accounts table: newest first
let acctOpen = null, acctView = 'all', PS = null;                             // the player detail: whose, which games; src/ui/pstats.js (the numbers as the profile adds them up)
let play = null, devSort = { k: 'last', dir: -1 }, devOpen = null, tagPick = '', allSessions = false;   // the playtest section
let mlogs = null, mlEvents = {}, mlOpen = null, mlFilt = { who: '', mode: '', from: '', to: '' };       // the match inspector: the logs' index, the logs opened, the filters
const PT = window.Playtest;

// ---------- the numbers ----------
const n = v => (Number.isFinite(v) ? v : 0);
const ratio = (a, b) => (b ? a / b : null);
const pct = v => (v == null ? '–' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '–' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString());
const pad = x => String(x).padStart(2, '0');
const NY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
function periodKeys(t) {               // the same keys as the server (functions/statsRules.js): New York's day, ISO week and month
  const o = {}; for (const x of NY.formatToParts(new Date(t))) if (x.type !== 'literal') o[x.type] = Number(x.value);
  const th = new Date(Date.UTC(o.year, o.month - 1, o.day));
  th.setUTCDate(th.getUTCDate() + 4 - (th.getUTCDay() || 7));
  const week = Math.ceil(((th - new Date(Date.UTC(th.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
  return { d: `${o.year}-${pad(o.month)}-${pad(o.day)}`, w: `${th.getUTCFullYear()}-W${pad(week)}`, m: `${o.year}-${pad(o.month)}` };
}
// The calendar days (YYYY-MM-DD) from one day to another, both included.
function dayRange(from, to) {
  const out = [], d = new Date(from + 'T12:00:00Z'), end = new Date(to + 'T12:00:00Z');
  while (d <= end && out.length < 4000) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}
// The Overview's period (Today / This week / This month / All time), remembered on this device.
const OV_KEY = 'ttc.admin.ovPeriod', OV_PERIODS = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All time']];
let ovPeriod = 'all';
try { const v = localStorage.getItem(OV_KEY); if (OV_PERIODS.some(([k]) => k === v)) ovPeriod = v; } catch (e) { /* no storage: All time */ }
function setOvPeriod(v) { ovPeriod = v; try { localStorage.setItem(OV_KEY, v); } catch (e) { /* not remembered */ } }
// The days a period covers (New York's calendar): today; Monday to today; the 1st to today; every day since the first counted.
function ovDays(p) {
  const today = periodKeys(Date.now()).d;
  if (p === 'today') return [today];
  if (p === 'week') { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return dayRange(d.toISOString().slice(0, 10), today); }
  if (p === 'month') return dayRange(today.slice(0, 8) + '01', today);
  const first = Object.keys(stats.days || {}).sort()[0];
  return first && first < today ? dayRange(first, today) : [today];
}
// The bucket of a period: its players' counters and its mode totals (all time: stats.modes, which go back furthest).
function ovBucket(p) {
  const k = periodKeys(Date.now()), node = { today: ['days', k.d], week: ['weeks', k.w], month: ['months', k.m] }[p];
  if (node) { const b = (stats[node[0]] && stats[node[0]][node[1]]) || {}; return { players: b, modes: b.modes || {} }; }
  const a = stats.alltime || {}, sum = f => Object.values(stats.months || {}).reduce((s, m) => s + n(m[f]), 0);
  return { players: { active: n(a.active), logins: Math.max(n(a.logins), sum('logins')), newAccounts: Math.max(n(a.newAccounts), sum('newAccounts')) }, modes: stats.modes || {} };
}
function modeRow(m) { return (stats.modes && stats.modes[m]) || {}; }
function totals(modes = stats.modes || {}) {
  const t = { started: 0, finished: 0, turns: 0, ms: 0, timed: 0, xWins: 0, oWins: 0, draws: 0, resigned: 0, timeouts: 0, done: 0, doneTurns: 0, doneMs: 0, doneTimed: 0 };
  for (const [m] of MODES) if (m !== 'bot') for (const k of Object.keys(t)) t[k] += n((modes[m] || {})[k]);   // (matches against a bot: their own row, not the people's totals)
  return t;
}
// A mini-game counts only once its square ended claimed by X or O: a square still open when the match
// ended (won, drawn, left or resigned) and a board reset after a draw are left out. The stored counters
// keep those apart (won / draw / open, and the winner's and loser's moves over claimed squares only), so
// the table is worked out from the claimed ones alone, past matches included.
function miniSums(t, pick) {
  const s = { won: 0, draw: 0, open: 0, winMoves: 0, loseMoves: 0, xWins: 0, oWins: 0 };
  for (const m of pick) { const r = (stats.mini && stats.mini[m] && stats.mini[m][t]) || {}; for (const k of Object.keys(s)) s[k] += n(r[k]); }
  return s;
}
// Normal and Super Chaos side by side: every Super Chaos square (vs the computer or in a friend room) is
// kept under 'chaos' ('testingSc' for the admin-only games); the modes picked cover the normal ones.
// Squares of abandoned matches (resigned, timed out, never finished) are not counted (from 21 Oct 2026).
function miniRow(t, name, s, c) {
  return { t, name, played: s.won, avgWin: ratio(s.winMoves, s.won), avgLose: ratio(s.loseMoves, s.won), avgAll: ratio(s.winMoves + s.loseMoves, s.won),
    xRate: ratio(s.xWins, s.won), oRate: ratio(s.oWins, s.won), left: s.draw + s.open,
    scPlayed: c.won, scAvgWin: ratio(c.winMoves, c.won), scAvgAll: ratio(c.winMoves + c.loseMoves, c.won) };
}
function miniPick() { return (miniMode === 'all' ? MODES.map(m => m[0]).filter(m => m !== 'bot') : miniMode === 'people' ? MODES.map(m => m[0]).filter(m => m !== 'cvc' && m !== 'bot') : [miniMode]).filter(m => m !== 'chaos'); }   // (the bot's matches only when chosen)
const scPick = () => [miniMode === 'testing' ? 'testingSc' : 'chaos'];
function miniRows() { const pick = miniPick(), sc = scPick(); return Object.keys(GAMES).map(t => miniRow(t, GAMES[t], miniSums(t, pick), miniSums(t, sc))); }
function miniAll() {                   // every completed square together: the sums of the rows' own counters
  const pick = miniPick(), sc = scPick(), z = () => ({ won: 0, draw: 0, open: 0, winMoves: 0, loseMoves: 0, xWins: 0, oWins: 0 }), s = z(), c = z();
  for (const t of Object.keys(GAMES)) { const r = miniSums(t, pick), q = miniSums(t, sc); for (const k of Object.keys(s)) { s[k] += r[k]; c[k] += q[k]; } }
  return Object.assign(miniRow('all', 'All mini-games', s, c), { draws: s.draw + c.draw, open: s.open + c.open });
}

// ---------- charts: plain SVG ----------
function barChart(days, series, opts = {}) {
  const W = 640, H = 200, L = 34, B = 22, T = 8, R = 4, iw = W - L - R, ih = H - B - T;
  const max = Math.max(1, ...days.map((d, i) => (opts.stack ? series.reduce((s, se) => s + se.values[i], 0) : Math.max(...series.map(se => se.values[i])))));
  const step = iw / days.length, groups = opts.stack ? 1 : series.length, bw = Math.max(2, step * .8 / groups);
  let bars = '';
  days.forEach((d, i) => {
    let y0 = T + ih;
    series.forEach((se, k) => {
      const v = se.values[i], h = v / max * ih;
      if (!v) return;
      if (opts.stack) { y0 -= h; bars += `<rect x="${(L + i * step + step * .1).toFixed(1)}" y="${y0.toFixed(1)}" width="${(step * .8).toFixed(1)}" height="${h.toFixed(1)}" fill="${se.color}"><title>${d} · ${se.name}: ${v}</title></rect>`; }
      else bars += `<rect x="${(L + i * step + step * .1 + k * bw).toFixed(1)}" y="${(T + ih - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${se.color}"><title>${d} · ${se.name}: ${v}</title></rect>`;
    });
  });
  const ticks = [0, .5, 1].map(f => { const v = Math.round(max * f), y = T + ih - v / max * ih; return `<line class="ax" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 5}" y="${y + 4}" text-anchor="end">${v}</text>`; }).join('');
  const labels = days.map((d, i) => (i % Math.ceil(days.length / 6) === 0 || i === days.length - 1 ? `<text x="${(L + i * step + step / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${d.slice(5)}</text>` : '')).join('');
  const legend = `<div class="legend">${series.map(se => `<span><i style="background:${se.color}"></i>${se.name}</span>`).join('')}</div>`;
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || '')}">${ticks}${bars}${labels}</svg>${legend}</div>`;
}
function hbarChart(rows, key, label, fmt) {
  const have = rows.filter(r => r[key] != null).sort((a, b) => a[key] - b[key]);
  if (!have.length) return '<p class="note">No finished mini-games yet.</p>';
  const max = Math.max(...have.map(r => r[key])), W = 640, rowH = 22, L = 120, H = have.length * rowH + 6;
  const bars = have.map((r, i) => {
    const w = Math.max(2, r[key] / max * (W - L - 50)), y = 3 + i * rowH;
    return `<text x="${L - 8}" y="${y + 15}" text-anchor="end" style="fill:var(--ink);font-size:13px">${esc(r.name)}</text><rect x="${L}" y="${y + 3}" width="${w.toFixed(1)}" height="${rowH - 8}" rx="4" fill="var(--sky)" stroke="var(--ink)" stroke-width="1.5"><title>${esc(r.name)}: ${fmt(r[key])}</title></rect><text x="${L + w + 6}" y="${y + 15}" style="fill:var(--ink);font-size:13px">${fmt(r[key])}</text>`;
  }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${bars}</svg></div>`;
}

// ---------- the page ----------
function render() { draw(); showNote(); }
function draw() {
  if (view.status === 'loading') { app.innerHTML = '<div class="card msg"><h1>Tic Tac Chaos Stats</h1><p>Loading…</p></div>'; return; }
  if (view.status === 'signin') {
    app.innerHTML = `<div class="card msg"><h1>Tic Tac Chaos Stats</h1><p>For the game's admin only. Log in with your game account.</p>
      <div class="signin"><button class="btn go" data-act="google">Continue with Google</button>
      <input id="em" type="email" placeholder="Email" autocomplete="email"><input id="pw" type="password" placeholder="Password" autocomplete="current-password">
      <button class="btn" data-act="email">Log in with email</button>${view.error ? `<div class="err" role="alert">${esc(view.error)}</div>` : ''}</div></div>`;
    return;
  }
  if (view.status === 'denied') {
    app.innerHTML = `<div class="card msg"><h1>Not for this account</h1><p>This page is for the game's admin only. ${view.error ? esc(view.error) : ''}</p><button class="btn" data-act="signout">Sign out</button></div>`;
    return;
  }
  const ob = ovBucket(ovPeriod), t = totals(ob.modes), pl = ob.players, P = (node, k) => (stats[node] && stats[node][k]) || {};
  const ovName = { today: 'today', week: 'this week', month: 'this month', all: 'all time' }[ovPeriod];
  const kpi = (label, big, sub) => `<div class="card kpi"><small>${label}</small><b>${big}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
  const days = ovDays(ovPeriod), D = d => P('days', d);
  const players = barChart(days, [
    { name: 'Active players', color: 'var(--green)', values: days.map(d => n(D(d).active)) },
    { name: 'Logins', color: 'var(--sky)', values: days.map(d => n(D(d).logins)) },
    { name: 'New accounts', color: 'var(--o)', values: days.map(d => n(D(d).newAccounts)) },
  ], { label: `Players per day, ${ovName}` });
  const matches = barChart(days, MODES.map(([m, name]) => ({ name, color: MODE_COLORS[m], values: days.map(d => n((D(d).finished || {})[m])) })), { stack: true, label: `Matches finished per day by mode, ${ovName}` });
  const mins = (ms, k) => { const v = ratio(ms, k); return v == null ? null : v / 60000; };
  const modeTable = `<div class="tbl"><table><thead><tr><th>Mode</th><th>Started</th><th>Finished</th><th>Abandoned</th><th>of which resigned</th><th>timed out</th><th>never finished</th><th>Avg turns (finished)</th><th>Avg minutes (finished)</th><th>X (first) wins</th><th>Draws</th></tr></thead><tbody>${MODES.map(([m, name]) => {
    const r = modeRow(m), st = n(r.started), quit = n(r.resigned) + n(r.timeouts), fin = Math.max(0, n(r.finished) - quit), never = Math.max(0, st - n(r.finished)), ab = never + quit, dec = n(r.xWins) + n(r.oWins);
    return `<tr><td>${name}</td><td>${st}</td><td>${fin}</td><td>${ab} <span class="dim">${pct(ratio(ab, st))}</span></td><td>${n(r.resigned)}</td><td>${n(r.timeouts)}</td><td>${never}</td><td>${num(ratio(n(r.doneTurns), n(r.done)))}</td><td>${num(mins(n(r.doneMs), n(r.doneTimed)))}</td><td>${pct(ratio(n(r.xWins), dec))}</td><td>${pct(ratio(n(r.draws), n(r.finished)))}</td></tr>`;
  }).join('')}</tbody></table></div><p class="note">Finished: played to a result (a line, a draw, a majority). Abandoned: resigned, lost on time, or never finished (left, or the app closed). The averages cover finished matches only, counted from 21 Oct 2026. Draws: ended once neither side could still make three in a row. Turns count a bonus move (a Risky Rolls roll, a Hangman letter) as part of its turn.</p>`;
  const rows = miniRows(), dir = sortBy.dir;
  rows.sort((a, b) => { const x = a[sortBy.k], y = b[sortBy.k]; if (x == null && y == null) return a.name.localeCompare(b.name); if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir; });
  const cols = [['name', 'Mini-game'], ['played', 'Completed'], ['avgWin', 'Avg winner moves'], ['avgLose', 'Avg loser moves'], ['avgAll', 'Avg total moves'], ['xRate', 'X wins'], ['oRate', 'O wins'], ['scPlayed', 'SC completed'], ['scAvgWin', 'SC avg winner moves'], ['scAvgAll', 'SC avg total moves']];
  const maxWin = Math.max(1, ...rows.map(r => r.avgWin || 0)), all = miniAll();
  const miniTr = (r, cls) => `<tr${cls ? ` class="${cls}"` : ''}><td>${esc(r.name)}</td><td>${r.played}</td><td>${num(r.avgWin)}${r.avgWin != null && !cls ? `<span class="bar" style="width:${Math.round(r.avgWin / maxWin * 60)}px"></span>` : ''}</td><td>${num(r.avgLose)}</td><td>${num(r.avgAll)}</td><td>${pct(r.xRate)}</td><td>${pct(r.oRate)}</td><td class="sc">${r.scPlayed}</td><td class="sc">${num(r.scAvgWin)}</td><td class="sc">${num(r.scAvgAll)}</td></tr>`;
  const miniTable = `<div class="tbl"><table><thead><tr>${cols.map(([k, l]) => `<th${sortBy.k === k ? ` aria-sort="${dir > 0 ? 'ascending' : 'descending'}"` : ''}><button data-sort="${k}">${l}</button></th>`).join('')}</tr></thead><tbody>${miniTr(all, 'sum')}${rows.map(r => miniTr(r)).join('')}</tbody></table></div>
    <p class="note">${miniMode === 'testing' ? 'Squares of games played while they were admin only, in every mode, kept apart from the released games\' numbers. ' : ''}Only completed squares count: those that ended claimed by X or O. Left out: ${all.open} square${all.open === 1 ? '' : 's'} still open when the match ended (won, drawn, left or resigned) and ${all.draws} board${all.draws === 1 ? '' : 's'} reset after a draw. Moves: the turns each side spent in that square (a bonus roll or letter within a turn counts once); total moves are the winner's and the loser's together. The first columns are normal matches (the modes picked); the SC columns are every Super Chaos match (vs the computer and friend rooms). Squares of abandoned matches (resigned, timed out, never finished) are left out (from 21 Oct 2026; before, Super Chaos friend rooms counted under Friend code). Tap a heading to sort; the All row stays on top.</p>`;
  const pnode = { d: 'days', w: 'weeks', m: 'months' }[period];
  const keys = Object.keys(stats[pnode] || {}).sort().reverse().slice(0, period === 'd' ? 31 : 12);
  const ptable = `<div class="tbl"><table><thead><tr><th>${{ d: 'Day', w: 'Week', m: 'Month' }[period]}</th><th>Active players</th><th>Logins</th><th>New accounts</th>${period === 'd' ? '<th>Matches started</th><th>Finished</th>' : ''}</tr></thead><tbody>${keys.map(k => {
    const r = stats[pnode][k] || {}, sum = o => Object.values(o || {}).reduce((s, v) => s + n(v), 0);
    return `<tr><td>${k}</td><td>${n(r.active)}</td><td>${n(r.logins)}</td><td>${n(r.newAccounts)}</td>${period === 'd' ? `<td>${sum(r.started)}</td><td>${sum(r.finished)}</td>` : ''}</tr>`;
  }).join('') || '<tr><td colspan="6" class="dim">Nothing yet</td></tr>'}</tbody></table></div><p class="note">Days, weeks (ISO, Monday to Sunday) and months in New York time. Active: players (accounts, or guests' browsers) who played or logged in.</p>`;
  const sec = {
    overview: () => `<div class="card"><div class="row"><h2>Overview: ${ovName}</h2><div class="tabs">${OV_PERIODS.map(([k, l]) => `<button data-ovp="${k}" aria-pressed="${ovPeriod === k}">${l}</button>`).join('')}</div></div>
      <p class="note">Every number and chart below covers the period picked, in New York time (weeks run Monday to Sunday). Today, this week and this month count matches from 24 Oct 2026, when they began to be kept per period.</p></div>
    <div class="kpis">
      ${kpi('Active players', n(pl.active), ovName)}
      ${kpi('Logins', n(pl.logins), ovName)}
      ${kpi('New accounts', n(pl.newAccounts), ovName)}
      ${kpi('Matches', `${Math.max(0, t.finished - t.resigned - t.timeouts)} / ${t.started}`, 'finished / started')}
      ${kpi('Abandon rate', pct(ratio(Math.max(0, t.started - t.finished) + t.resigned + t.timeouts, t.started)), 'resigned, timed out or never finished')}
      ${kpi('Avg finished match', `${num(ratio(t.doneTurns, t.done))} turns`, `${num(mins(t.doneMs, t.doneTimed))} minutes`)}
      ${kpi('First player (X) wins', pct(ratio(t.xWins, t.xWins + t.oWins)), `${t.xWins} of ${t.xWins + t.oWins} decided`)}
    </div>
    <div class="grid2"><div class="card"><h2>Players per day, ${ovName}</h2>${players}</div><div class="card"><h2>Matches finished per day, ${ovName}</h2>${matches}</div></div>`,
    players: () => `${accountsCard()}${flaggedCard()}
    <div class="card"><div class="row"><h2>Players over time</h2><div class="tabs">${[['d', 'Days'], ['w', 'Weeks'], ['m', 'Months']].map(([k, l]) => `<button data-period="${k}" aria-pressed="${period === k}">${l}</button>`).join('')}</div></div>${ptable}</div>`,
    playtest: () => playCard(),
    matches: () => matchCard(),
    settings: sub => (sub && GAMES[sub] ? gamePage(sub) : settingsIndex()),
    bots: () => `${findCard()}${botsCard()}${aiCard()}${alertsCard()}`,
    releases: () => releasesCard(),
    access: () => accessCard(),
    stats: () => `<div class="card"><h2>Matches by mode</h2>${modeTable}</div>
    <div class="card"><div class="row"><h2>Mini-games</h2><label>Modes <select id="mm">${[['all', 'All modes'], ['people', 'All but computer vs computer']].concat(MODES.filter(m => m[0] !== 'chaos'), [['testing', 'Admin-only games (testing)']]).map(([v, l]) => `<option value="${v}"${miniMode === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
      ${miniTable}<h2 style="margin-top:14px">Average winner moves</h2>${hbarChart(rows, 'avgWin', 'Average winner moves by mini-game', v => num(v))}</div>`,
  };
  const [where, sub] = route(), info = SECTIONS.find(x => x[0] === where);
  const top = `<div class="top"><h1>Tic Tac Chaos Admin</h1><span class="sp"></span><span class="who">${esc(user.email || 'admin')}</span><button class="btn" data-act="refresh">Refresh</button><button class="btn" data-act="signout">Sign out</button></div>`;
  if (!info) {
    app.innerHTML = `${top}<nav class="tiles" aria-label="Sections">${SECTIONS.map(([k, label, line]) => `<a class="tile" href="#${k}"><b>${label}</b><small>${line()}</small></a>`).join('')}</nav>`;
    return;
  }
  const game = where === 'settings' && sub && GAMES[sub];
  const back = game ? ['#settings', 'Mini-game Settings'] : ['#', 'Menu'];
  app.innerHTML = `${top}<div class="sechead"><a class="btn back" href="${back[0]}" aria-label="Back to ${back[1]}">‹ ${back[1]}</a><h2>${game ? esc(GAMES[sub]) : info[1]}</h2></div>${sec[where](sub)}`;
}
// ---------- the sections: a menu of tiles (#), each its own page (#<section>, a game's settings #settings/<type>) ----------
const SECTIONS = [
  ['overview', 'Overview', () => `${n(((stats.days || {})[periodKeys(Date.now()).d] || {}).active)} active today`],
  ['players', 'Players & Accounts', () => (accts ? `${Object.keys(accts.users || {}).length} accounts` : 'Accounts, flagged names, players over time')],
  ['playtest', 'Playtesters & Devices', () => (play ? `${Object.keys(play.devices || {}).length} devices` : 'Devices, sessions, retention')],
  ['matches', 'Matches', () => { const r = Object.values(mlogs || {}).filter(x => x && x.reported).length; return `Match inspector${r ? ` · ${r} reported` : ''}`; }],
  ['settings', 'Mini-game Settings', () => { const k = Object.keys(ctl.tune || {}).length, sp = ctl.anim && ctl.anim.speed; return `Every game's settings${k ? ` · ${k} changed` : ''}${sp && sp !== 1 ? ` · speed ${sp}×` : ''}`; }],
  ['bots', 'Bot Settings', () => 'Find Match, bots, empty-queue alerts'],
  ['releases', 'Releases', () => { const m = ctl.clients || {}, off = Object.values((ctl.releases && ctl.releases.platform && ctl.releases.platform.ios) || {}).filter(v => v === false).length; return `Released or admin only, per game${off ? ` · ${off} off on iOS` : ''}${m.web || m.ios ? ` · minimum ${['web', 'ios'].filter(p => m[p]).map(p => `${p} ${m[p]}`).join(', ')}` : ''}`; }],
  ['stats', 'Stats', () => 'Matches by mode, moves to win'],
].concat(STAGING ? [['access', 'Staging Access', () => `${Object.keys(ctl.allow || {}).length} on the list`]] : []);   // (staging only: who may use it)
const route = () => (location.hash || '').replace(/^#\/?/, '').split('/');
window.addEventListener('hashchange', () => { if (view.status === 'ready') { render(); window.scrollTo(0, 0); } });

// ---------- the match inspector: every logged match (matchLogIndex), reported ones first; a match's
// event timeline (matchLogs/{key}) and its export as JSON. (functions/matchLogRules.js: the events.) ----------
const ML_MODES = { match: 'Find Match', bot: 'Find Match vs a bot', friend: 'Friend code', 'friend-sc': 'Super Chaos (friend)', chaos: 'Super Chaos', local: 'Two players', cpu: 'vs Computer', cvc: 'Computer vs Computer' };
function mlRows() {
  const f = mlFilt, from = f.from ? Date.parse(f.from + 'T00:00:00') : null, to = f.to ? Date.parse(f.to + 'T23:59:59') : null, who = f.who.trim().toLowerCase();
  return Object.entries(mlogs || {}).map(([key, x]) => Object.assign({ key }, x)).filter(r => (!f.mode || r.mode === f.mode) && (!who || (r.who || '').includes(who) || r.key.toLowerCase().includes(who))
    && (from == null || (r.last || 0) >= from) && (to == null || (r.started || 0) <= to))
    .sort((a, b) => (b.reported || 0) - (a.reported || 0) || (b.last || 0) - (a.last || 0));
}
const mlPlayers = r => ['X', 'O'].map(s => (r.players && r.players[s] && r.players[s].name ? `${s} ${esc(r.players[s].name)}` : '')).filter(Boolean).join(' · ') || '<span class="dim">–</span>';
function mlTimeline(key) {
  const ev = mlEvents[key];
  if (!ev) return '<p class="note">Loading…</p>';
  if (ev === 'error') return '<p class="note">Could not load this log.</p>';
  const t0 = ev.length ? ev[0].t : 0, rel = t => { const s = Math.round((t - t0) / 1000); return `+${Math.floor(s / 60)}:${pad(s % 60)}`; };
  const fields = e => Object.entries(e).filter(([k]) => !['t', 'k'].includes(k)).map(([k, v]) => `${esc(k)}=${esc(typeof v === 'object' ? JSON.stringify(v) : v)}`).join(' ');
  return `<ul class="mltl">${ev.map(e => `<li>${esc(PT.nyWhen(e.t))} <span class="dim">${rel(e.t)}</span> <span class="k ${esc(e.k)}">${esc(e.k)}</span> ${fields(e)}</li>`).join('') || '<li>No events.</li>'}</ul>`;
}
function matchCard() {
  if (!mlogs) return '<div class="card"><h2>Match inspector</h2><p class="note">Not loaded.</p></div>';
  const rows = mlRows(), shown = rows.slice(0, 200), nrep = rows.filter(r => r.reported).length;
  const filt = `<div class="mlfilt"><input id="mlWho" type="search" placeholder="Player, uid, device or room" value="${esc(mlFilt.who)}">
    <select id="mlMode"><option value="">All modes</option>${Object.entries(ML_MODES).map(([k, l]) => `<option value="${k}"${mlFilt.mode === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <label>From <input id="mlFrom" type="date" value="${esc(mlFilt.from)}"></label><label>To <input id="mlTo" type="date" value="${esc(mlFilt.to)}"></label></div>`;
  const body = shown.map(r => {
    const open = mlOpen === r.key;
    return `<tr class="mlrow${open ? ' open' : ''}${r.reported ? ' rep' : ''}" data-ml="${esc(r.key)}"><td>${r.reported ? `Reported ${esc(PT.nyWhen(r.reported))}${r.reports > 1 ? ` (${r.reports})` : ''}` : ''}</td><td>${r.started ? esc(PT.nyWhen(r.started)) : '–'}</td><td>${esc(ML_MODES[r.mode] || r.mode || '?')}</td><td>${mlPlayers(r)}</td><td>${n(r.n)}</td><td>${esc(r.vers || '')}</td><td>${esc(r.note || '')}</td></tr>`
;
  }).join('');
  const sel = mlOpen && rows.find(r => r.key === mlOpen);       // the match opened: its timeline under the table (the table scrolls sideways on a phone; this does not)
  const panel = sel ? `<div class="tlpanel" id="mlTimeline" role="region" aria-label="Match ${esc(sel.key)}: its log"><div class="row"><h3>${esc(sel.key)}${sel.room ? ` · room ${esc(sel.room)}` : ''}</h3><button class="btn" data-mlexport="${esc(sel.key)}">Export</button><button class="btn" data-mlclose="1">Close</button></div>${sel.note ? `<p class="note mid-left" style="margin:0">Reported: ${esc(sel.note)}</p>` : ''}${sel.devs ? `<p class="note" style="margin:0">Devices ${esc(sel.devs)}</p>` : ''}${mlTimeline(sel.key)}</div>` : '';
  return `<div class="card" id="mlCard"><div class="row"><h2>Match inspector</h2><span class="note" style="margin:0">${rows.length} match${rows.length === 1 ? '' : 'es'}${nrep ? ` · ${nrep} reported` : ''} · kept 30 days</span></div>${filt}
    <div class="tbl"><table><thead><tr><th>Reported</th><th>Started</th><th>Mode</th><th>Players</th><th>Events</th><th>App</th><th>Note</th></tr></thead><tbody>${body || '<tr><td colspan="7" class="dim">No matches</td></tr>'}</tbody></table></div>
    ${rows.length > shown.length ? `<p class="note">The ${shown.length} most recent shown: narrow the filters for the rest.</p>` : ''}${panel}</div>`;
}
async function mlLoad(key) {
  if (mlEvents[key] && mlEvents[key] !== 'error') return;
  try { const v = (await fb.dbM.get(fb.dbM.ref(fb.db, `matchLogs/${key}`))).val() || {}; mlEvents[key] = Object.entries(v).map(([id, e]) => Object.assign({}, e, { id })).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)).map(e => { delete e.id; return e; }); }
  catch (e) { mlEvents[key] = 'error'; }
  render();
}
async function mlExport(key) {
  await mlLoad(key);
  const blob = new Blob([JSON.stringify({ key, exported: new Date().toISOString(), summary: (mlogs || {})[key] || null, events: Array.isArray(mlEvents[key]) ? mlEvents[key] : [] }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `match-log-${key}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- sorting a table: a heading's button flips its order ----------
function sortRows(rows, by) {
  return rows.sort((a, b) => {
    const x = a[by.k], y = b[by.k];
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * by.dir;
  });
}
const sortHead = (cols, by, attr) => `<thead><tr>${cols.map(([k, l]) => `<th${by.k === k ? ` aria-sort="${by.dir > 0 ? 'ascending' : 'descending'}"` : ''}><button data-${attr}="${k}">${l}</button></th>`).join('')}</tr></thead>`;
const flip = (by, k, down) => ({ k, dir: by.k === k ? -by.dir : down.includes(k) ? -1 : 1 });

// ---------- accounts: every player with a username (not the bots), from users/, localStats/ and lastSeen/ ----------
function accountRows() {
  const a = accts || {}, bots = ctl.bots || {};
  return Object.entries(a.users || {}).filter(([uid, u]) => u && u.username && !bots[uid]).map(([uid, u]) => {
    const parts = [u, u.friend || {}, (a.local || {})[uid] || {}];
    const t = k => parts.reduce((s, r) => s + n(r[k]), 0);
    const wins = t('wins'), losses = t('losses'), draws = t('draws');
    return { uid, name: u.username, joined: n(u.joined) || null, last: n((a.seen || {})[uid]) || null, games: wins + losses + draws, wins, losses, draws,
      rate: ratio(wins, wins + losses + draws), split: `Find Match ${n(u.wins)}-${n(u.losses)}-${n(u.draws)} · Friends ${n(parts[1].wins)}-${n(parts[1].losses)}-${n(parts[1].draws)} · Local ${n(parts[2].wins)}-${n(parts[2].losses)}-${n(parts[2].draws)}` };
  });
}
function accountsCard() {
  if (!accts) return '<div class="card"><h2>Accounts</h2><p class="note">Not loaded.</p></div>';
  const rows = sortRows(accountRows(), acctSort);
  const cols = [['name', 'Username'], ['joined', 'Signed up'], ['last', 'Last active'], ['games', 'Games'], ['wins', 'Record (W-L-D)'], ['rate', 'Win rate']];
  return `<div class="card" id="accountsCard"><div class="row"><h2>Accounts</h2><span class="note" style="margin:0">${rows.length} account${rows.length === 1 ? '' : 's'}</span></div>
    <div class="tbl"><table>${sortHead(cols, acctSort, 'asort')}<tbody>${rows.map(r => `<tr class="acct${acctOpen === r.uid ? ' open' : ''}" data-uid="${esc(r.uid)}"><td>${esc(r.name)}</td><td>${PT.nyDate(r.joined)}</td><td>${r.last ? PT.nyWhen(r.last) : '<span class="dim">–</span>'}</td><td>${r.games}</td><td title="${esc(r.split)}">${r.wins}-${r.losses}-${r.draws}</td><td>${pct(r.rate)}</td></tr>`).join('') || '<tr><td colspan="6" class="dim">No accounts yet</td></tr>'}</tbody></table></div>
${acctPanel()}
    <p class="note">Games and record: every game played with the account, Find Match, friends and local together (hover a record for the split). Last active: the last time the account played, logged in or opened the game. New York time. Bot accounts are left out. Tap an account for its record by side and by mini-game.</p></div>`;
}
// One player's detail (a tap on their row): the record as X and as O, and the squares won and lost per
// mini-game (players no longer see these on their profile). Online (Find Match and friends), Local or All.
function acctPanel() {
  const u = acctOpen && accts && accts.users[acctOpen];
  if (!u) return '';
  if (!PS) return '<div class="tlpanel" id="acctDetail"><p class="note">Could not load the stats helpers.</p></div>';
  const loc = (accts.local || {})[acctOpen] || {}, v = acctView;
  const rec = PS.viewRec(u, loc, v), sides = PS.viewSides(u, loc, v), minis = PS.viewMinis(u, loc, v);
  const sideRow = p => `<tr><td>As ${p}</td><td>${PS.games(sides[p])}</td><td>${PS.recText(sides[p])}</td><td>${PS.winPct(sides[p])}</td></tr>`;
  const rate = (w, l) => `${Math.round(100 * w / (w + l))}%`;
  const won = minis.reduce((t, r) => t + r.won, 0), lost = minis.reduce((t, r) => t + r.lost, 0);
  const mini = minis.length ? `<tr class="sum"><td>All mini-games</td><td>${won}</td><td>${lost}</td><td>${rate(won, lost)}</td></tr>${minis.map(r => `<tr><td>${esc(r.name)}</td><td>${r.won}</td><td>${r.lost}</td><td>${rate(r.won, r.lost)}</td></tr>`).join('')}`
    : '<tr><td colspan="4" class="dim">No squares won or lost yet</td></tr>';
  return `<div class="tlpanel" id="acctDetail"><div class="row"><h3>${esc(u.username)}</h3><div class="tabs">${[['online', 'Online'], ['local', 'Local'], ['all', 'All']].map(([k, l]) => `<button data-aview="${k}" aria-pressed="${v === k}">${l}</button>`).join('')}</div><button class="btn" data-aclose="1">Close</button></div>
    <div class="kpis"><div class="kpi"><small>Record (W-L-D)</small><b>${PS.recText(rec)}</b><span>${PS.games(rec)} game${PS.games(rec) === 1 ? '' : 's'}</span></div><div class="kpi"><small>Win rate</small><b>${PS.winPct(rec)}</b><span>draws count as games</span></div></div>
    <div class="tbl"><table><thead><tr><th>Played as</th><th>Games</th><th>W-L-D</th><th>Win rate</th></tr></thead><tbody>${sideRow('X')}${sideRow('O')}</tbody></table></div>
    <div class="tbl"><table><thead><tr><th>Mini-game</th><th>Won</th><th>Lost</th><th>Win rate</th></tr></thead><tbody>${mini}</tbody></table></div>
    <p class="note">${{ online: 'Online: Find Match and friend games.', local: 'Local: games on this player\'s phone (as player 1).', all: 'All: online and local.' }[v]} Squares count once they ended claimed by X or O; only the games in the pool.</p></div>`;
}

// ---------- playtest activity (no account needed): devices/ and devlog/, worked out by playtest.js ----------
function playRows() {
  const rows = PT.deviceRows((play || {}).devices, (play || {}).logs);
  return tagPick === '' ? rows : tagPick === '-' ? rows.filter(r => !r.tag) : rows.filter(r => r.tag === tagPick);
}
function hourChart(hours) {
  const W = 840, H = 230, L = 30, B = 34, T = 10, R = 6, iw = W - L - R, ih = H - B - T;
  const max = Math.max(1, ...hours.map(h => Math.max(h.started, h.finished, h.devices)));
  const step = iw / hours.length, y = v => T + ih - v / max * ih;
  let bars = '', hits = '', days = '', pts = [];
  hours.forEach((h, i) => {
    const x = L + i * step;
    if (h.started) bars += `<rect x="${(x + step * .08).toFixed(1)}" y="${y(h.started).toFixed(1)}" width="${(step * .84).toFixed(1)}" height="${(h.started / max * ih).toFixed(1)}" fill="var(--sky)"/>`;
    if (h.finished) bars += `<rect x="${(x + step * .3).toFixed(1)}" y="${y(h.finished).toFixed(1)}" width="${(step * .4).toFixed(1)}" height="${(h.finished / max * ih).toFixed(1)}" fill="var(--green)"/>`;
    pts.push(`${(x + step / 2).toFixed(1)},${y(h.devices).toFixed(1)}`);
    hits += `<rect class="hit" x="${x.toFixed(1)}" y="${T}" width="${step.toFixed(2)}" height="${ih}"><title>${esc(PT.nyWhen(h.t))}: ${h.started} started, ${h.finished} finished, ${h.devices} device${h.devices === 1 ? '' : 's'} active</title></rect>`;
    if (h.label.endsWith(' 00:00') || i === 0) {
      const d = h.label.slice(0, 10), [yy, mm, dd] = d.split('-').map(Number), wd = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
      days += `${i ? `<line class="day" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${T}" y2="${T + ih + 4}"/>` : ''}<text x="${(x + 3).toFixed(1)}" y="${H - 18}">${'SunMonTueWedThuFriSat'.slice(wd * 3, wd * 3 + 3)} ${mm}/${dd}</text>`;
    }
  });
  const ticks = [0, .5, 1].map(f => { const v = Math.round(max * f), yy = y(v); return `<line class="ax" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text x="${L - 5}" y="${yy + 4}" text-anchor="end">${v}</text>`; }).join('');
  const hrs = hours.map((h, i) => (i % 6 === 0 ? `<text x="${(L + i * step + step / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" style="font-size:9px">${+h.label.slice(11, 13)}</text>` : '')).join('');
  const line = `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--plum)" stroke-width="1.6" stroke-linejoin="round"/>`;
  const legend = '<div class="legend"><span><i style="background:var(--sky)"></i>Games started</span><span><i style="background:var(--green)"></i>Games finished</span><span><i style="background:var(--plum)"></i>Active devices (line)</span></div>';
  return `<div class="chart wide-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Activity by hour, last 7 days, New York time">${ticks}${days}${bars}${line}${hrs}${hits}</svg></div>${legend}`;
}
const modeList = ms => ms.map(m => PT.MODE_NAMES[m] || m).join(', ') || '–';
const midText = m => (m === 'left' ? '<span class="mid-left">Yes, left</span>' : m === 'open' ? '<span class="mid-open">Yes, unfinished</span>' : 'No');
function timeline(r) {
  const ses = r.sessions.slice().reverse();
  return `<div class="tlist">${ses.map(s => {
    const opens = s.events.filter(e => e.ev === 'open').length, errs = s.events.filter(e => e.ev === 'error');
    const errLine = errs.length ? `<p class="mid-left">${errs.length} error${errs.length === 1 ? '' : 's'} on the phone: ${esc([...new Set(errs.map(e => e.msg || '?'))].slice(0, 3).join(' · '))}</p>` : '';
    const auds = s.events.filter(e => e.ev === 'audio');
    const audLine = auds.length ? `<p class="mid-open">Sound: ${esc(auds.slice(-6).map(e => `${PT.nyWhen(e.t).replace(/^\w+ \d+, /, '')} ${e.msg || '?'}`).join(' · '))}${auds.length > 6 ? ` (${auds.length} events)` : ''}</p>` : '';
    const games = s.games.map(g => `<li>${PT.nyWhen(g.start).replace(/^\w+ \d+, /, '')} · ${esc(PT.MODE_NAMES[g.mode] || g.mode || '?')} · ${g.how === 'finish' ? `finished after ${PT.dur(g.end - g.start)}` : g.how === 'leave' ? `<span class="mid-left">left after ${PT.dur(g.end - g.start)}</span>` : '<span class="mid-open">not finished</span>'}</li>`).join('');
    return `<div class="tses"><h3>${PT.nyWhen(s.start)} · ${PT.dur(s.ms)}</h3><p>${s.played} game${s.played === 1 ? '' : 's'} · ${s.streak} finished in a row · ${modeList(s.modes)} · ended mid-match: ${midText(s.mid)}${opens ? ` · opened the app${opens > 1 ? ` ${opens} times` : ''}` : ''}</p>${errLine}${audLine}${games ? `<ul>${games}</ul>` : ''}</div>`;
  }).join('') || '<p class="note">No events.</p>'}</div>`;
}
// A device's timeline, under the devices table: its sessions, newest first, each with its games.
function tlPanel(r) {
  if (!r) return '';
  return `<div class="tlpanel" id="devTimeline" role="region" aria-label="Device ${esc(r.short)}: sessions and games"><div class="row"><h3>Device ${esc(r.short)}${r.tag ? ` · ${esc(r.tag)}` : ''}</h3><button class="btn" data-dev="${esc(r.h)}">Close</button></div>
    <p class="note" style="margin:0 0 8px">First seen ${PT.nyWhen(r.first)} · last seen ${PT.nyWhen(r.last)} · ${r.nSessions} session${r.nSessions === 1 ? '' : 's'} · ${r.games} game${r.games === 1 ? '' : 's'}</p>${timeline(r)}</div>`;
}
function playCard() {
  if (!play) return '<div class="card"><h2>Playtest activity</h2><p class="note">Not loaded.</p></div>';
  const all = PT.deviceRows(play.devices, play.logs), rows = playRows(), now = Date.now();
  const tags = [...new Set(all.map(r => r.tag).filter(Boolean))].sort();
  const pick = `<label>Devices <select id="tagPick"><option value=""${tagPick === '' ? ' selected' : ''}>All (${all.length})</option>${tags.map(t => `<option value="${esc(t)}"${tagPick === t ? ' selected' : ''}>Tester: ${esc(t)}</option>`).join('')}<option value="-"${tagPick === '-' ? ' selected' : ''}>No tester tag</option></select></label>`;
  const hours = PT.hourly(rows, now), sum = k => hours.reduce((t, h) => t + h[k], 0);
  const week = new Set(rows.filter(r => r.evs.some(e => e.t > now - 7 * 86400000)).map(r => r.h)).size;
  const ret = PT.retention(rows, now), f = PT.funnel(rows);
  const fRow = (label, v) => `<span>${label}</span><div class="fb" style="width:${f.opened ? Math.max(1, Math.round(v / f.opened * 100)) : 0}%"></div><b>${v}${f.opened ? ` · ${pct(v / f.opened)}` : ''}</b>`;
  const kpis = `<div class="kpis">
      <div class="kpi"><small>Devices seen</small><b>${rows.length}</b><span>${week} active in the last 7 days</span></div>
      <div class="kpi"><small>Came back the next day</small><b>${ret.eligible ? pct(ret.nextDay / ret.eligible) : '–'}</b><span>${ret.nextDay} of ${ret.eligible} first seen before today</span></div>
      <div class="kpi"><small>Came back within 7 days</small><b>${ret.eligible ? pct(ret.week / ret.eligible) : '–'}</b><span>${ret.week} of ${ret.eligible} (newer devices still have time)</span></div>
      <div class="kpi"><small>Last 7 days</small><b>${sum('started')} / ${sum('finished')}</b><span>games started / finished</span></div></div>`;
  const funnel = `<h2 style="margin-top:14px">Funnel</h2><div class="funnel">${fRow('Opened the app', f.opened)}${fRow('Started a game', f.started)}${fRow('Finished a game', f.finished)}${fRow('Started another', f.another)}</div>`;
  // devices: newest first by default; a tap opens the device's sessions and games
  const drows = sortRows(rows.slice(), devSort);
  const dcols = [['short', 'Device'], ['tag', 'Tester'], ['first', 'First seen'], ['last', 'Last seen'], ['nSessions', 'Sessions'], ['games', 'Games'], ['perSession', 'Games / session'], ['back', 'Came back']];
  const devTable = `<h2 style="margin-top:14px">Devices</h2><div class="tbl"><table>${sortHead(dcols, devSort, 'dsort')}<tbody>${drows.map(r => `<tr class="dev${devOpen === r.h ? ' open' : ''}" data-dev="${esc(r.h)}"><td><button class="lnk" data-dev="${esc(r.h)}" aria-expanded="${devOpen === r.h}" aria-label="Device ${esc(r.short)}: show its sessions and games">${esc(r.short)}</button></td><td>${r.tag ? `<span class="tag">${esc(r.tag)}</span>` : '<span class="dim">–</span>'}</td><td>${PT.nyWhen(r.first)}</td><td>${PT.nyWhen(r.last)}</td><td>${r.nSessions}</td><td>${r.games}</td><td>${num(r.perSession)}</td><td>${r.back ? 'Yes' : 'No'}</td></tr>`).join('') || '<tr><td colspan="8" class="dim">No devices yet</td></tr>'}</tbody></table></div>${tlPanel(rows.find(r => r.h === devOpen))}`;
  // sessions, newest first
  const ses = rows.flatMap(r => r.sessions.map(s => Object.assign({ dev: r }, s))).sort((a, b) => b.start - a.start);
  const shown = allSessions ? ses : ses.slice(0, 30);
  const sesTable = `<h2 style="margin-top:14px">Sessions</h2><div class="tbl"><table><thead><tr><th>Started</th><th>Device</th><th>Tester</th><th>Length</th><th>Games</th><th>Finished in a row</th><th style="text-align:left">Modes</th><th>Ended mid-match</th></tr></thead><tbody>${shown.map(s => `<tr><td>${PT.nyWhen(s.start)}</td><td><button class="lnk" data-dev="${esc(s.dev.h)}">${esc(s.dev.short)}</button></td><td>${s.dev.tag ? esc(s.dev.tag) : '<span class="dim">–</span>'}</td><td>${PT.dur(s.ms)}</td><td>${s.played}</td><td>${s.streak}</td><td style="text-align:left">${esc(modeList(s.modes))}</td><td>${midText(s.mid)}</td></tr>`).join('') || '<tr><td colspan="8" class="dim">No sessions yet</td></tr>'}</tbody></table></div>${ses.length > 30 ? `<button class="btn" data-act="all-sessions" style="margin-top:8px">${allSessions ? 'Show the latest 30' : `Show all ${ses.length}`}</button>` : ''}`;
  return `<div class="card" id="playCard"><div class="row"><h2>Playtest activity</h2>${pick}</div>${kpis}
    <h2 style="margin-top:14px">Activity by hour</h2><p class="note" style="margin:0 0 6px">Last 7 days, New York time. Hover an hour for its numbers.</p>${hourChart(hours)}
    ${funnel}${devTable}${sesTable}
    <p class="note">Every device gets a random anonymous id, kept in its browser; nothing personal is collected. A tester tag comes from the link (add ?t=name to the game's address, e.g. ?t=sam) and stays with the device from the first time it is seen. A session ends after 30 minutes with nothing. Games: every match started on the device, any mode. Finished: played to a result; left: quit (resigned or left the match); unfinished: still under way when the session ended. Came back: seen again on a later day (New York days).</p></div>`;
}

// ---------- a save's outcome, beside what was saved: "Saved" (green) or why it was not (red). It stays until
// the next save, an edit, or another page; a refused value keeps what was typed (nothing re-drawn). ----------
let note = null;   // { page, sel, ok, msg }
function said(el, ok, msg) {
  const k = Object.keys(el.dataset)[0];
  note = { page: location.hash, sel: k ? `[data-${k}="${CSS.escape(el.dataset[k])}"]` : null, ok, msg };
  if (!ok && el.tagName === 'BUTTON') el.disabled = false;
  showNote();
}
function showNote() {
  for (const x of app.querySelectorAll('.savemsg')) x.remove();
  if (!note || note.page !== location.hash || !note.sel) return;
  const el = app.querySelector(note.sel);
  if (!el) return;
  const m = document.createElement('span');
  m.className = 'savemsg ' + (note.ok ? 'good' : 'bad'); m.setAttribute('role', note.ok ? 'status' : 'alert'); m.textContent = note.msg;
  (el.closest('label') || el).insertAdjacentElement('afterend', m);
}
const failed = e => 'Not saved: ' + ((e && e.message) || 'the database refused it');
// ---------- staging access: the emails allowed into staging (admin/staging/allow/{key}: { email }; staging only) ----------
// An account with an email on the list gets in (functions/index.js stagingAccess, on its first visit); one taken off is
// signed out within the hour. The admin is always in.
const allowKey = email => String(email || '').trim().toLowerCase().replace(/[.#$[\]/]/g, ',');   // (functions/index.js allowKey)
function accessCard() {
  const rows = Object.entries(ctl.allow || {}).map(([k, v]) => [k, (v && v.email) || k]).sort((a, b) => a[1].localeCompare(b[1]));
  return `<div class="card ctl" id="accessCard"><h2>Who can use staging</h2>
    <p class="note">Only these accounts can open staging.tictacchaos.com (and you, the admin). A new tester logs in with Google, or creates an account with this email and verifies it.</p>
    <ul class="rels">${rows.map(([k, e]) => `<li><span class="rn">${esc(e)}</span><button class="btn" data-allowdel="${esc(k)}">Remove</button></li>`).join('') || '<li><span class="rn">Nobody yet</span></li>'}</ul>
    <div class="tbar"><input id="allowAdd" type="email" placeholder="email@example.com" autocomplete="off" style="min-width:min(100%,260px)"><button class="btn" data-act="allowadd">Add</button></div></div>`;
}
async function allowEdit(el, email, on) {
  email = String(email || '').trim().toLowerCase();
  if (on && !/^[^@\s]+@[^@\s]+$/.test(email)) { said(el, false, 'Not an email address'); return; }
  const key = on ? allowKey(email) : email;   // (removing: the key itself)
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `admin/staging/allow/${key}`), on ? { email, by: 'admin', at: Date.now() } : null);
    const a = Object.assign({}, ctl.allow); if (on) a[key] = { email }; else delete a[key]; ctl.allow = a;
  } catch (e) { said(el, false, failed(e)); return; }
  render(); const c = document.getElementById('accessCard'); if (c) said(c.querySelector('[data-act="allowadd"]') || c, true, on ? 'Added' : 'Removed');
}

// ---------- game releases: Released or Admin only, per mini-game (releases/{type}, read by the game and the server) ----------
// A game not in the database is as the code has it (TEST_TYPES in src/games/index.js, from each game's meta.js: admin only until released here).
const TEST_TYPES = ['bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone', 'dash', 'lane', 'golf', 'pool', 'bowling', 'craps', 'takeover', 'flood', 'seating', 'districts', 'shelves', 'roads', 'flap', 'chopper', 'patterns', 'wheels', 'sniff', 'headcount', 'flash', 'snapshot', 'skyhop', 'scoop', 'pinball', 'clash', 'hex'];   // (as engine.js has them; the switches cover every game the stats know)
const isReleased = t => (ctl.releases && typeof ctl.releases[t] === 'boolean' ? ctl.releases[t] : !TEST_TYPES.includes(t));
// Per platform (src/core/client.js): a released game can be switched off on iOS alone (releases/platform/ios/{type} false);
// on means as released. The web has no switch of its own: a game is off there by un-releasing it.
const iosOff = t => !!(ctl.releases && ctl.releases.platform && ctl.releases.platform.ios && ctl.releases.platform.ios[t] === false);
function releasesCard() {
  const sc = !!(ctl.releases && ctl.releases.superchaos === true);   // the Super Chaos mode: admin only until released here (releases/superchaos)
  const ios = t => { const on = !iosOff(t); return `<label class="sw ios"><input type="checkbox" data-relios="${t}"${on ? ' checked' : ''}><span class="${on ? 'good' : ''}">${on ? 'iOS on' : 'iOS off'}</span></label>`; };
  const from = t => (META[t] && META[t].minVersion && META[t].minVersion !== '1.0.0' ? ` <small class="mv">from ${esc(META[t].minVersion)}</small>` : '');
  const row = (t, name, on, game) => `<li><span class="rn">${name}${game ? from(t) : ''}</span><label class="sw"><input type="checkbox" data-rel="${t}"${on ? ' checked' : ''}><span class="${on ? 'good' : ''}">${on ? 'Released' : 'Admin only'}</span></label>${game ? ios(t) : '<span class="sw ios"></span>'}</li>`;
  return clientsCard() + `<div class="card ctl" id="relCard"><h2>Game releases</h2>
    <p class="note">A tap releases or un-releases at once, for new matches; matches under way are not affected. iOS off keeps a released game out of the iOS app (its local matches, and any online match with an iOS player in it) while the web still has it.</p>
    <ul class="rels">${row('superchaos', '<b>Super Chaos mode</b>', sc, false)}${Object.entries(GAMES).map(([t, name]) => row(t, esc(name), isReleased(t), true)).join('')}</ul>
    <p class="note">Super Chaos is switched off in the code for everyone, you included (src/core/config.js SUPER_CHAOS_ENABLED): every match is Classic, Find Match too, and no Mode selector shows, whatever this switch says. Its code and settings are kept; once the code switch is back on, this switch decides again (off: Classic only; on: the Mode selector for everyone).</p>
    <p class="note">Admin only: the game exists for nobody but you (not in the Advanced checklist, How to Play, random draws, Find Match or anyone else's rooms). You play it in local matches and friend games you host; your guest plays it in that match only. Find Match deals released games only, even for you. Squares of admin-only games are counted under "Admin-only games (testing)" in the stats.</p></div>`;
}
async function saveRelIos(el) {
  const t = el.dataset.relios, on = el.checked, lab = el.nextElementSibling;
  if (lab) { lab.textContent = on ? 'iOS on' : 'iOS off'; lab.className = on ? 'good' : ''; }
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `releases/platform/ios/${t}`), on ? null : false);   // (on: nothing stored, as released)
    const pl = Object.assign({}, ctl.releases.platform), io = Object.assign({}, pl.ios);
    if (on) delete io[t]; else io[t] = false;
    pl.ios = io; ctl.releases = Object.assign({}, ctl.releases, { platform: pl });
  } catch (e) { render(); said(el, false, failed(e)); return; }
  render(); said(app.querySelector(`[data-relios="${t}"]`) || el, true, 'Saved');
}
// ---------- clients: the oldest version still allowed to play, per platform (config/clients { web, ios }) ----------
// A client below its platform's minimum shows "Please update" instead of the game, and the server refuses it a new match.
// The web page always runs the code's own version (it is served from the latest deploy), so its minimum can never be
// above that; the app runs the version it was built with until the player updates it.
function clientsCard() {
  const m = ctl.clients || {}, cur = CLIENT ? CLIENT.CLIENT_VERSION : '?';
  const f = (p, label) => `<label class="rf"><span>${label}</span><input type="text" inputmode="decimal" placeholder="none" data-clientmin="${p}" value="${esc(m[p] || '')}"></label>`;
  return `<div class="card ctl" id="clientsCard"><h2>Clients</h2>
    <p class="note">This code is version <b>${esc(cur)}</b> (src/core/client.js CLIENT_VERSION). Every phone reports its version and platform; online matches deal only games both players' clients have (a game's meta.js minVersion) and that are on for both their platforms (the iOS switches below).</p>
    <p class="note">Minimum supported version: below it the game shows "Please update" instead of playing (the app sends the player to the App Store; the web reloads). Empty: no minimum. The web's can be no higher than ${esc(cur)}.</p>
    <div class="rform">${f('web', 'Web: minimum')}${f('ios', 'iOS: minimum')}<button class="btn" data-clientsave="1">Save</button></div></div>`;
}
async function saveClients(btn) {
  const out = {};
  for (const el of app.querySelectorAll('input[data-clientmin]')) {
    const p = el.dataset.clientmin, v = el.value.trim();
    if (!v) continue;
    if (!CLIENT.versionOk(v)) { said(btn, false, `${p}: a version such as 1.2.0`); return; }
    if (p === 'web' && CLIENT.cmpVersion(v, CLIENT.CLIENT_VERSION) > 0) { said(btn, false, `Web: at most ${CLIENT.CLIENT_VERSION}, the version it runs`); return; }
    out[p] = v;
  }
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/clients'), Object.keys(out).length ? out : null); ctl.clients = out; } catch (e) { btn.disabled = false; said(btn, false, failed(e)); return; }
  render(); said(app.querySelector('[data-clientsave]') || btn, true, 'Saved');
}
async function saveRelease(el) {
  const t = el.dataset.rel, on = el.checked, lab = el.nextElementSibling;   // (no confirmation: a tap releases or un-releases at once)
  if (lab) { lab.textContent = on ? 'Released' : 'Admin only'; lab.className = on ? 'good' : ''; }
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `releases/${t}`), on);
    ctl.releases = Object.assign({}, ctl.releases, { [t]: on });
  } catch (e) { render(); said(el, false, failed(e)); return; }
  render(); said(el, true, 'Saved');
}
// ---------- the runners' tuning: Dash and Lane Rush (config/run, read by the game and the server) ----------
// The difficulty of each runner lives here; a change applies to squares dealt from then on (a square
// under way keeps the values it was dealt with). The tracker shows what the squares played so far say:
// how many runs a finish takes, how far a run goes, and where the crashes cluster.
const RUN_TYPES = ['dash', 'lane', 'flap', 'chopper'];
const RUN_DEFAULTS = { dash: { target: 550, v0: 13, ramp: 3, gapMin: 18, gapMax: 32, mix: { rock: 30, crate: 20, spike: 20, flyer: 20, pair: 10 } }, lane: { target: 1000, v0: 27, ramp: 2.7, gapMin: 10, gapMax: 18, mix: { one: 50, two: 50 } }, flap: { target: 450, v0: 6, ramp: 1.5, gapMin: 9, gapMax: 12, mix: { wide: 10, mid: 40, narrow: 50 } }, chopper: { target: 1000, v0: 14.4, ramp: 1.6, gapMin: 22, gapMax: 40, mix: { none: 10, small: 50, big: 40 }, cave0: 5.6, cave1: 3.4 } };   // (as the game's meta.js has them)
const RUN_FIELDS = [['target', 'Target distance (m)', 200, 5000], ['v0', 'Starting speed (m/s)', 3, 30], ['ramp', 'Speed ramp (m/s more per 100 m)', 0, 10], ['gapMin', 'Obstacle spacing, min (m)', 8, 200], ['gapMax', 'Obstacle spacing, max (m)', 10, 400]];
const RUN_MIX = { dash: [['rock', 'Rocks'], ['crate', 'Crates'], ['spike', 'Spikes'], ['flyer', 'Low flyers'], ['pair', 'Pairs']], lane: [['one', 'Rows with one car'], ['two', 'Rows with two cars']], flap: [['wide', 'Wide gaps'], ['mid', 'Middle gaps'], ['narrow', 'Narrow gaps']], chopper: [['none', 'No block'], ['small', 'Small blocks'], ['big', 'Big blocks']] };
const RUN_EXTRA = { chopper: [['cave0', 'Cave height at the start (sky is 10)', 3, 9.5], ['cave1', 'Cave height at the finish (sky is 10)', 2.5, 9.5]] };   // a runner's own settings
const RUN_BIN = 50;
function runCfg(t) {
  const raw = (ctl.runCfg && ctl.runCfg[t]) || {}, d = RUN_DEFAULTS[t], out = { mix: {} };
  for (const [k] of RUN_FIELDS.concat(RUN_EXTRA[t] || [])) out[k] = Number.isFinite(Number(raw[k])) && raw[k] !== null && raw[k] !== '' ? Number(raw[k]) : d[k];
  for (const [k] of RUN_MIX[t]) out.mix[k] = raw.mix && Number.isFinite(Number(raw.mix[k])) ? Number(raw.mix[k]) : d.mix[k];
  return out;
}
function runSums(t) {                                        // every mode together, the admin-only (testing) bucket included
  const s = { runs: 0, distSum: 0, finishes: 0, finishRuns: 0, crash: {} };
  for (const m of Object.keys(stats.mini || {})) {
    const r = (stats.mini[m] && stats.mini[m][t]) || {};
    s.runs += n(r.runs); s.distSum += n(r.distSum); s.finishes += n(r.finishes); s.finishRuns += n(r.finishRuns);
    for (const [b, c] of Object.entries(r.crash || {})) s.crash[b] = (s.crash[b] || 0) + n(c);
  }
  return s;
}
function runnersCard(only) {   // only: one runner's card (its Mini-game Settings page)
  const kpi = (label, big, sub) => `<div class="card kpi"><small>${label}</small><b>${big}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;   // (as the dashboard's own, which lives inside render)
  const one = t => {
    const c = runCfg(t), s = runSums(t), name = GAMES[t];
    const fields = RUN_FIELDS.concat(RUN_EXTRA[t] || []).map(([k, l, lo, hi]) => `<label class="rf"><span>${l}</span><input type="number" step="any" min="${lo}" max="${hi}" data-runcfg="${t}:${k}" value="${c[k]}"></label>`).join('');
    const mix = RUN_MIX[t].map(([k, l]) => `<label class="rf"><span>${l}</span><input type="number" step="1" min="0" max="1000" data-runcfg="${t}:mix.${k}" value="${c.mix[k]}"></label>`).join('');
    const bins = []; for (let b = 0; b < c.target; b += RUN_BIN) bins.push([b, n(s.crash[b])]);
    const max = Math.max(1, ...bins.map(x => x[1])), crashes = bins.reduce((a, x) => a + x[1], 0);
    const chart = crashes ? `<div class="rbins" aria-label="Crashes per ${RUN_BIN} m">${bins.map(([b, k]) => `<div class="rbin" title="${b}-${b + RUN_BIN} m: ${k} crash${k === 1 ? '' : 'es'}"><i style="height:${Math.round(100 * k / max)}%"></i>${b % 200 === 0 ? `<small>${b}</small>` : ''}</div>`).join('')}</div>` : '<p class="dim">No crashes recorded yet.</p>';
    return `<div class="runner"><h3>${esc(name)}</h3>
      <div class="rkpis">${kpi('Runs to finish', num(ratio(s.finishRuns, s.finishes)), `${s.finishes} square${s.finishes === 1 ? '' : 's'} finished`)}${kpi('Avg distance per run', s.runs ? Math.round(s.distSum / s.runs) + ' m' : '—', `${s.runs} run${s.runs === 1 ? '' : 's'}`)}${kpi('Crashes', crashes, 'where they cluster, below')}</div>
      ${chart}
      <div class="rform">${fields}${mix}<button class="btn" data-runsave="${t}">Save ${esc(name)}</button><button class="btn tplay" data-testplay="${t}" title="Opens the game alone in a new tab with these settings, saved or not (the live settings are not touched)">Test play</button></div></div>`;
  };
  if (only) return `<div class="card ctl" id="runCard"><h2>${esc(GAMES[only])} tuning</h2><p class="note">A race to the target distance, one run a move. The mix numbers are weights (any scale). Applies to squares dealt from then on.</p>${one(only)}</div>`;
  return `<div class="card ctl" id="runCard"><h2>Runner tuning</h2>
    <p class="note">Dash, Lane Rush, Flap and Chopper: a race to the target distance, one run a move. Obstacle spacing is the posts' spacing in Flap and the blocks' in Chopper (the mix decides each one's gap, or the block's size, or none). Everything here goes to the game and the server at once and applies to squares dealt from then on (a square under way keeps its values). The mix numbers are weights (any scale). Aim: an average player finishes in 3-6 runs, most runs lasting 10-25 seconds; the crash chart (every ${RUN_BIN} m, every mode together) shows where the course bites.</p>
    <div class="grid2">${one('dash')}${one('lane')}${one('flap')}${one('chopper')}</div></div>`;
}
async function saveRunCfg(t, btn) {
  const out = { mix: {} };
  for (const el of app.querySelectorAll(`input[data-runcfg^="${t}:"]`)) {
    const k = el.dataset.runcfg.split(':')[1], v = Number(el.value);
    if (!Number.isFinite(v) || v < Number(el.min) || v > Number(el.max)) { said(btn, false, `${k}: a number from ${el.min} to ${el.max}`); return; }
    if (k.startsWith('mix.')) out.mix[k.slice(4)] = Math.round(v); else out[k] = v;
  }
  if (out.gapMax < out.gapMin) { said(btn, false, 'The maximum spacing must be at least the minimum.'); return; }
  if (!Object.values(out.mix).some(v => v > 0)) { said(btn, false, 'Give at least one obstacle kind a weight.'); return; }
  btn.disabled = true;
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `config/run/${t}`), out);
    ctl.runCfg = Object.assign({}, ctl.runCfg, { [t]: out });
  } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(btn, true, 'Saved');
}
// ---------- Bullseye's tuning (config/bulls, read by the game and the server) ----------
// The board's size and the bullseye's (in field units: the field is 100 across, 120 down), how long a line
// takes to sweep across at the start, and how much faster a player's lines get with each throw of theirs
// that scores. A change applies to squares dealt from then on.
const BULL_DEFAULTS = { board: 9, bull: 2.5, sweep: 1040, ramp: 1.12 };   // (as the game's meta.js has them)
const BULL_FIELDS = [['board', 'Board radius (field is 100 across)', 4, 30, 'any'], ['bull', 'Bullseye radius', 0.5, 12, 'any'], ['sweep', 'Sweep across at the start (ms)', 400, 5000, '10'], ['ramp', 'Speed-up per scoring throw (x)', 1, 2, 'any']];
function bullsCard() {
  const raw = ctl.bullsCfg || {}, c = {};
  for (const [k] of BULL_FIELDS) c[k] = Number.isFinite(Number(raw[k])) && raw[k] !== null && raw[k] !== '' ? Number(raw[k]) : BULL_DEFAULTS[k];
  const fields = BULL_FIELDS.map(([k, l, lo, hi, st]) => `<label class="rf"><span>${l}</span><input type="number" step="${st}" min="${lo}" max="${hi}" data-bullcfg="${k}" value="${c[k]}"></label>`).join('');
  return `<div class="card ctl" id="bullsCard"><h2>Bullseye tuning</h2>
    <p class="note">Bullseye: a small board moves round a field 100 units across and 120 down; a throw stops a sideways line, then an up-down line, and the dart lands where they cross. Bullseye 3 points, the board 1, first to 5. Everything here goes to the game and the server at once and applies to squares dealt from then on. Aim: about 5-6 throws to win at the start. A bigger board or bullseye, or a slower sweep, makes it easier; the speed-up makes each scoring throw harder than the last.</p>
    <div class="rform">${fields}<button class="btn" data-bullsave="1">Save Bullseye</button><button class="btn tplay" data-testplay="bullseye" title="Opens the game alone in a new tab with these settings, saved or not (the live settings are not touched)">Test play</button></div></div>`;
}
async function saveBullsCfg(btn) {
  const out = {};
  for (const el of app.querySelectorAll('input[data-bullcfg]')) {
    const k = el.dataset.bullcfg, v = Number(el.value);
    if (!Number.isFinite(v) || v < Number(el.min) || v > Number(el.max)) { said(btn, false, `${k}: a number from ${el.min} to ${el.max}`); return; }
    out[k] = v;
  }
  if (out.bull >= out.board) { said(btn, false, 'The bullseye must be smaller than the board.'); return; }
  btn.disabled = true;
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, 'config/bulls'), out);
    ctl.bullsCfg = out;
  } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(btn, true, 'Saved');
}
// ---------- Peg Drop's target (config/plinko, read by the game and the server) ----------
const PLINKO_DEFAULTS = { target: 12 };   // (as the game's meta.js has it)
function plinkoCard() {
  const raw = ctl.plinkoCfg || {}, v = raw.target != null && Number.isFinite(Number(raw.target)) ? Number(raw.target) : PLINKO_DEFAULTS.target;
  return `<div class="card ctl" id="plinkoCard"><h2>Peg Drop tuning</h2>
    <p class="note">Peg Drop: the bins are worth 5, 3, 3, 2, 2, 1 and 1 points (the order drawn per square), the bonus peg 2; each player's points add up and the first to the target wins. Default 12. Applies to squares dealt from then on.</p>
    <div class="rform"><label class="rf"><span>Target (points to win)</span><input type="number" step="1" min="4" max="40" data-plinkocfg="target" value="${v}"></label><button class="btn" data-plinkosave="1">Save Peg Drop</button><button class="btn tplay" data-testplay="plinko" title="Opens the game alone in a new tab with these settings, saved or not (the live settings are not touched)">Test play</button></div></div>`;
}
async function savePlinkoCfg(btn) {
  const el = app.querySelector('input[data-plinkocfg="target"]'), v = Number(el.value);
  if (!Number.isInteger(v) || v < 4 || v > 40) { said(btn, false, 'Target: a whole number from 4 to 40'); return; }
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/plinko'), { target: v }); ctl.plinkoCfg = { target: v }; } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(btn, true, 'Saved');
}
// ---------- Risky Rolls' die and target (config/pig, read by the game and the server) ----------
const PIG_DEFAULTS = { sides: 8, target: 51 };   // (as the game's meta.js has them)
function pigCard() {
  const raw = ctl.pigCfg || {}, sides = raw.sides === 6 || raw.sides === 8 ? raw.sides : PIG_DEFAULTS.sides, t = raw.target != null && Number.isFinite(Number(raw.target)) ? Number(raw.target) : PIG_DEFAULTS.target;
  return `<div class="card ctl" id="pigCard"><h2>Risky Rolls tuning</h2>
    <p class="note">Risky Rolls: roll as often as you dare, then bank; a number already rolled this turn loses the turn's points. The die (6 or 8 sides) and the score to bank to win. Default: 8 sides, 51. Applies to squares dealt from then on.</p>
    <div class="rform"><label class="rf"><span>Die</span><select data-pigcfg="sides">${[6, 8].map(n => `<option value="${n}"${n === sides ? ' selected' : ''}>${n} sides</option>`).join('')}</select></label><label class="rf"><span>Target (points to win)</span><input type="number" step="1" min="10" max="200" data-pigcfg="target" value="${t}"></label><button class="btn" data-pigsave="1">Save Risky Rolls</button><button class="btn tplay" data-testplay="pig" title="Opens the game alone in a new tab with these settings, saved or not (the live settings are not touched)">Test play</button></div></div>`;
}
async function savePigCfg(btn) {
  const sides = Number(app.querySelector('[data-pigcfg="sides"]').value), t = Number(app.querySelector('[data-pigcfg="target"]').value);
  if (sides !== 6 && sides !== 8) { said(btn, false, 'Die: 6 or 8 sides'); return; }
  if (!Number.isInteger(t) || t < 10 || t > 200) { said(btn, false, 'Target: a whole number from 10 to 200'); return; }
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/pig'), { sides, target: t }); ctl.pigCfg = { sides, target: t }; } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(btn, true, 'Saved');
}
// ---------- Roads' honeycomb (config/roads, read by the game and the server) ----------
const ROADS_DEFAULTS = { layout: 'hex7' };   // (as the game's meta.js has it)
function roadsCard() {
  const raw = ctl.roadsCfg || {}, lay = raw.layout === 'hex4' || raw.layout === 'hex7' ? raw.layout : ROADS_DEFAULTS.layout;
  return `<div class="card ctl" id="roadsCard"><h2>Roads tuning</h2>
    <p class="note">Roads: claim an edge, then a random edge is blocked; the longest road wins. Every move uses two edges, so the honeycomb sets the length: 7 hexagons (30 edges) is about 7 to 8 moves each; the smaller 4 (19 edges) about 5 each. Default 7. Applies to squares dealt from then on.</p>
    <div class="rform"><label class="rf"><span>Honeycomb</span><select data-roadscfg="layout">${[['hex7', '7 hexagons (30 edges)'], ['hex4', '4 hexagons (19 edges)']].map(([v, l]) => `<option value="${v}"${v === lay ? ' selected' : ''}>${l}</option>`).join('')}</select></label><button class="btn" data-roadssave="1">Save Roads</button><button class="btn tplay" data-testplay="roads" title="Opens the game alone in a new tab with these settings, saved or not (the live settings are not touched)">Test play</button></div></div>`;
}
async function saveRoadsCfg(btn) {
  const layout = app.querySelector('[data-roadscfg="layout"]').value;
  if (layout !== 'hex7' && layout !== 'hex4') { said(btn, false, 'Honeycomb: 7 or 4 hexagons'); return; }
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/roads'), { layout }); ctl.roadsCfg = { layout }; } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(btn, true, 'Saved');
}
// ---------- the attention games' difficulty (config/headcount, config/flash, config/snapshot, read by the game and the server) ----------
const HEAD_DEFAULTS = { n1lo: 14, n1hi: 20, d1lo: 4, d1hi: 7, cross1: 1800, gap1: 430, n2lo: 18, n2hi: 25, d2lo: 7, d2hi: 11, cross2: 1800, gap2: 330, n3lo: 22, n3hi: 30, d3lo: 8, d3hi: 12, cross3: 2000, gap3: 300 };   // (as the game's meta.js has them)
const FLASH_DEFAULTS = { n1: 6, n2: 7, n3: 8, ms1: 500, ms2: 500, ms3: 500 };
const SNAP_DEFAULTS = { c1: 4, r1: 5, k1: 7, c2: 5, r2: 5, k2: 9, c3: 5, r3: 6, k3: 11, show: 5000, wait: 5000 };
const ATT_CARDS = [
  { id: 'headcount', title: 'Headcount tuning', defaults: HEAD_DEFAULTS, rows: [['n{L}lo', 'Creatures to count: fewest', 1, 30, 1], ['n{L}hi', 'Creatures to count: most', 1, 30, 1], ['d{L}lo', 'Decoys: fewest', 0, 15, 1], ['d{L}hi', 'Decoys: most', 0, 15, 1], ['cross{L}', 'Time to cross the field, moving (ms)', 600, 8000, 10], ['gap{L}', 'Time between starts, about (ms)', 120, 3000, 10]], extra: [],
    note: 'Creatures cross the field and the player counts the ones asked for. Level 1: decoys of another kind, left and right, uneven with bunches. Level 2: more of both, in all four directions at widely varying speeds, crossing paths often. Level 3: decoys that look like them (the same creature in a near colour), four directions, stopping and starting, in bunches. The computer gets 45%, 30% and 20% right.' },
  { id: 'flash', title: 'Flash tuning', defaults: FLASH_DEFAULTS, rows: [['n{L}', 'Cards in a round', 4, 12, 1], ['ms{L}', 'Time per card (ms)', 150, 3000, 10]], extra: [],
    note: 'Cards flash one at a time, then one question with four options: how many of a shape, or how many of a colour. The computer gets 80%, 70% and 60% right.' },
  { id: 'snapshot', title: 'Snapshot tuning', defaults: SNAP_DEFAULTS, rows: [['c{L}', 'Columns', 3, 7, 1], ['r{L}', 'Rows', 3, 7, 1], ['k{L}', 'Filled cells', 2, 30, 1]], extra: [['show', 'Time the pattern shows (ms)', 1000, 15000, 100], ['wait', 'Countdown on the blank grid (ms)', 0, 15000, 100]],
    note: 'A pattern shows, then the grid stays blank for a countdown, then the player taps it back in. The computer gets 65%, 50% and 35% right. Never a full row or column, a straight run of 4, one solid rectangle or a symmetric shape.' },
];
function attCard(c) {
  const raw = (ctl.attCfg || {})[c.id] || {}, num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  const inp = (k, lo, hi, step) => `<input type="number" step="${step}" min="${lo}" max="${hi}" data-attcfg="${c.id}" data-k="${k}" value="${num(raw[k], c.defaults[k])}">`;
  const rows = c.rows.map(([k, label, lo, hi, step]) => `<tr><th>${label}</th>${[1, 2, 3].map(L => `<td>${inp(k.replace('{L}', L), lo, hi, step)}</td>`).join('')}</tr>`).join('');
  return `<div class="card ctl" id="${c.id}Card"><h2>${c.title}</h2>
    <p class="note">${c.note} Aimed at a typical player getting about 85% of rounds right at level 1, 65% at level 2 and 45% at level 3 (the computer gets them right that often). Applies to rounds dealt from then on.</p>
    <div class="tbl"><table class="atttab"><tr><th></th><th>Level 1</th><th>Level 2</th><th>Level 3</th></tr>${rows}</table></div>
    <div class="rform">${c.extra.map(([k, label, lo, hi, step]) => `<label class="rf"><span>${label}</span>${inp(k, lo, hi, step)}</label>`).join('')}<button class="btn" data-attsave="${c.id}">Save ${c.title.replace(' tuning', '')}</button><button class="btn tplay" data-testplay="${c.id}" title="Opens the game alone in a new tab with these settings, saved or not (the live settings are not touched)">Test play</button></div></div>`;
}
async function saveAttCfg(btn) {
  const c = ATT_CARDS.find(x => x.id === btn.dataset.attsave), out = {};
  for (const el of app.querySelectorAll(`input[data-attcfg="${c.id}"]`)) {
    const v = Number(el.value), lo = Number(el.min), hi = Number(el.max);
    if (!Number.isFinite(v) || v < lo || v > hi) { said(btn, false, `${c.title.replace(' tuning', '')}: ${el.dataset.k} must be from ${lo} to ${hi}`); return; }
    out[el.dataset.k] = v;
  }
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/' + c.id), out); ctl.attCfg = Object.assign({}, ctl.attCfg, { [c.id]: out }); } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(btn, true, 'Saved');
}
// ---------- the finger games' difficulty (config/skyhop, config/scoop, config/pinball, read by the game and the server) ----------
const HOP_DEFAULTS = { target: 150, bounce: 22, gap0: 3, gap1: 4.5, wide0: 1.5, wide1: 1.1, moveAt: 10, move: 65, moveV: 2.2, breakAt: 8, brk0: 25, brk: 60, hazAt: 15, hazGap: 25, fill0: 0.4, fill1: 0.2 };   // (as the game's meta.js has them)
const SCOOP_DEFAULTS = { target: 25, v0: 5, v1: 8.5, gap0: 0.9, gap1: 0.6, haz0: 18, haz1: 38, sway: 1, cone: 12 };
const PINB_DEFAULTS = { size: 1.7, save: 3, maxBall: 120, g: 1, bump: 1, spin: 1 };
const BOWL_DEFAULTS = { aimMs: 733, meterMs: 600 };   // (as Bowling's meta.js has them)
const BOWL_CARDS = [
  { id: 'bowling', title: 'Bowling tuning', defaults: BOWL_DEFAULTS, fields: [['aimMs', 'Aim arrow: one side to the other (ms)', 300, 3000, 10], ['meterMs', 'Power meter: empty to full (ms)', 300, 3000, 10]],
    note: 'The two taps: the arrow sweeps across the lane, then the power meter rises and falls. Lower is faster (harder to time).' },
];
const FING_CARDS = [
  { id: 'skyhop', title: 'Sky Hop tuning', defaults: HOP_DEFAULTS, fields: [['target', 'Target height (m)', 50, 3000, 10], ['bounce', 'Bounce speed (m/s; 22 rises 5.5 m)', 12, 30, 0.1], ['gap0', 'Gap between platforms at the bottom (m)', 0.6, 6, 0.05], ['gap1', 'Gap at the top (m)', 0.6, 6, 0.05], ['wide0', 'Platform width at the bottom (m; the sky is 9 wide)', 0.8, 6, 0.05], ['wide1', 'Platform width at the top (m)', 0.8, 6, 0.05], ['fill0', 'Extra platforms per gap at the bottom', 0, 4, 0.05], ['fill1', 'Extra platforms per gap at the top', 0, 4, 0.05], ['moveAt', 'Moving platforms from (m)', 0, 3000, 1], ['move', 'Moving platforms by the top (%)', 0, 90, 1], ['moveV', 'Moving platform speed (m/s)', 0.2, 4, 0.05], ['breakAt', 'Breaking platforms from (m)', 0, 3000, 1], ['brk0', 'Breaking platforms at that height (%)', 0, 90, 1], ['brk', 'Breaking platforms by the top (%)', 0, 90, 1], ['hazAt', 'Burrs from (m)', 0, 3000, 1], ['hazGap', 'About one burr every (m)', 5, 500, 1]],
    note: 'The hopper bounces up off platforms; a drag steers it and the sky wraps at the sides. Falling off the bottom ends the attempt and the highest point is kept. Higher up: wider gaps, narrower platforms, more that move or break after one bounce, and burrs to avoid (never across the way up). Every gap can be made: the course always has a chain of platforms within a bounce. Default 150 m: a strong run reaches the top in about 28 s; tuned so an average player needs about 3 to 6 attempts (the computer: about 4.5).' },
  { id: 'scoop', title: 'Scoop Stack tuning', defaults: SCOOP_DEFAULTS, fields: [['target', 'Target (scoops)', 5, 200, 1], ['v0', 'Falling speed at the start (units/s; the screen is 10 wide)', 1, 15, 0.1], ['v1', 'Falling speed at the target', 1, 15, 0.1], ['gap0', 'Time between items at the start (s)', 0.3, 4, 0.05], ['gap1', 'Time between items at the target (s)', 0.3, 4, 0.05], ['haz0', 'Hazards at the start (% of items)', 0, 70, 1], ['haz1', 'Hazards at the target (%)', 0, 70, 1], ['cone', 'Cone speed (units/s)', 5, 40, 0.5], ['sway', 'Sway of the stack (1 = normal, 0 = none)', 0, 3, 0.05]],
    note: 'Scoops and hazards (pebbles, burnt scoops) fall to the top of the stack; the cone follows the finger. A hazard on the stack, or 3 missed scoops, ends the attempt; the stack is kept. Speed and hazards rise with the stack. Every attempt is checked to be catchable at 72% of the cone speed. Default 25 scoops; tuned so an average player needs about 3 to 6 attempts (the computer: about 4.5).' },
  { id: 'pinball', title: 'Pinball tuning', defaults: PINB_DEFAULTS, fields: [['size', 'Target size (1 = the drawn size; up to 2)', 0.6, 2, 0.05], ['save', 'Ball save after launch (s)', 0, 10, 0.5], ['maxBall', 'Longest ball (s)', 20, 300, 5], ['g', 'Table slope (gravity, 1 = normal)', 0.5, 2, 0.05], ['bump', 'Bumper kick (1 = normal)', 0.5, 2, 0.05], ['spin', 'Spinner speed (1 = normal, 0 = still)', 0, 3, 0.05]],
    note: 'One ball per turn; each player lights their own 7 targets, which stay lit. Bigger targets are easier. Default size 1.7: about 5 balls for the computer (median 4), which plays like an average player.' },
];
function fingCard(c) {
  const raw = (ctl.fingCfg || {})[c.id] || {}, num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  return `<div class="card ctl" id="${c.id}Card"><h2>${c.title}</h2>
    <p class="note">${c.note} Applies to squares dealt from then on.</p>
    <div class="rform">${c.fields.map(([k, label, lo, hi, step]) => `<label class="rf"><span>${label}</span><input type="number" step="${step}" min="${lo}" max="${hi}" data-fingcfg="${c.id}" data-k="${k}" value="${num(raw[k], c.defaults[k])}"></label>`).join('')}</div>
    <div class="rform"><button class="btn" data-fingsave="${c.id}">Save ${c.title.replace(' tuning', '')}</button><button class="btn tplay" data-testplay="${c.id}" title="Opens the game alone in a new tab with these settings, saved or not (the live settings are not touched)">Test play</button></div></div>`;
}
async function saveFingCfg(btn) {
  const c = FING_CARDS.concat(BOWL_CARDS).find(x => x.id === btn.dataset.fingsave), out = {};
  for (const el of app.querySelectorAll(`input[data-fingcfg="${c.id}"]`)) {
    const v = Number(el.value), f = c.fields.find(x => x[0] === el.dataset.k);
    if (!Number.isFinite(v) || v < f[2] || v > f[3]) { said(btn, false, `${f[1]}: a number from ${f[2]} to ${f[3]}`); return; }
    out[el.dataset.k] = v;
  }
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/' + c.id), out); ctl.fingCfg = Object.assign({}, ctl.fingCfg, { [c.id]: out }); } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(btn, true, 'Saved');
}
// ---------- Odd One Out's shade differences (config/oddone, read by the game and the server) ----------
const ODD_DEFAULTS = { d1: 4, d2: 2.8, d3: 2 };   // (as the game's meta.js has it)
const ODD_FIELDS = [['d1', 'Level 1 (3x3)'], ['d2', 'Level 2 (4x4)'], ['d3', 'Level 3 (5x5)']];
function oddCard() {
  const raw = ctl.oddCfg || {}, num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  return `<div class="card ctl" id="oddCard"><h2>Odd One Out tuning</h2>
    <p class="note">How different the odd tile is at each level, in perceptual units (ΔE 2000: about 1 is the smallest difference most people can see side by side; the same on every colour). Smaller is harder. Meant for a typical player to miss about 25% at level 1, 40% at level 2 and 55% at level 3 within the 5 seconds. Defaults: 4, 2.8, 2. Applies to grids dealt from then on.</p>
    <div class="rform">${ODD_FIELDS.map(([k, label]) => `<label class="rf"><span>${label}</span><input type="number" step="0.1" min="0.5" max="25" data-oddcfg="${k}" value="${num(raw[k], ODD_DEFAULTS[k])}"></label>`).join('')}<button class="btn" data-oddsave="1">Save Odd One Out</button><button class="btn tplay" data-testplay="oddone" title="Opens the game alone in a new tab with these settings, saved or not (the live settings are not touched)">Test play</button></div></div>`;
}
async function saveOddCfg(btn) {
  const out = {};
  for (const [k, label] of ODD_FIELDS) { const v = Number(app.querySelector(`input[data-oddcfg="${k}"]`).value); if (!Number.isFinite(v) || v < 0.5 || v > 25) { said(btn, false, `${label}: a number from 0.5 to 25`); return; } out[k] = Math.round(v * 10) / 10; }
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/oddone'), out); ctl.oddCfg = out; } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(btn, true, 'Saved');
}
// ---------- Risky Spins' tuning (config/wheels, read by the game and the server) ----------
// The target, and the ranges each square's three wheels are drawn from (ten equal segments each). A
// change applies to squares dealt from then on.
const WHEEL_DEFAULTS = { target: 18, tensMin: 1, tensMax: 2, smallMax: 2, smallTop: 2, midLo: 0, midHi: 8, lowLo: 1, lowHi: 4, gap: 0.4 };   // (as the game's meta.js has them)
const WHEEL_FIELDS = [['target', 'Target (points to win)', 6, 60, 1], ['tensMin', 'High: fewest 10s', 1, 3, 1], ['tensMax', 'High: most 10s', 1, 3, 1], ['smallMax', 'High: most small values', 0, 4, 1], ['smallTop', 'High: largest small value', 1, 3, 1], ['midLo', 'Medium: lowest value', 0, 3, 1], ['midHi', 'Medium: highest value (no 10s)', 5, 9, 1], ['lowLo', 'Low: lowest value', 1, 3, 1], ['lowHi', 'Low: highest value', 2, 6, 1], ['gap', 'Averages at least this far apart', 0.1, 1.5, 0.1]];
function wheelsCard() {
  const raw = ctl.wheelsCfg || {}, num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  return `<div class="card ctl" id="wheelsCard"><h2>Risky Spins tuning</h2>
    <p class="note">Risky Spins: each square deals three wheels of ten equal segments, drawn again until every rule holds. High risk: 10s (fewest to most) and 0s, with at most a few small values; the lowest average. Medium: no 10s, at least two 5s, a top value above Low's, its average between. Low: every value in its range, at least two different; the highest average. Defaults: first to 18; High one or two 10s and at most two small values of 1-2; Medium two 5s, the rest 0-8; Low 1-4; averages 0.4 apart. Applies to squares dealt from then on.</p>
    <div class="rform">${WHEEL_FIELDS.map(([k, label, lo, hi, step]) => `<label class="rf"><span>${label}</span><input type="number" step="${step}" min="${lo}" max="${hi}" data-wheelcfg="${k}" value="${num(raw[k], WHEEL_DEFAULTS[k])}"></label>`).join('')}</div>
    <div class="rform"><button class="btn" data-wheelsave="1">Save Risky Spins</button><button class="btn tplay" data-testplay="wheels" title="Opens the game alone in a new tab with these settings, saved or not (the live settings are not touched)">Test play</button></div></div>`;
}
async function saveWheelsCfg(btn) {
  const out = {};
  for (const el of app.querySelectorAll('input[data-wheelcfg]')) {
    const k = el.dataset.wheelcfg, v = Number(el.value), f = WHEEL_FIELDS.find(x => x[0] === k);
    if (!Number.isFinite(v) || v < f[2] || v > f[3] || (f[4] === 1 && !Number.isInteger(v))) { said(btn, false, `${f[1]}: ${f[4] === 1 ? 'a whole number' : 'a number'} from ${f[2]} to ${f[3]}`); return; }
    out[k] = v;
  }
  if (out.tensMax < out.tensMin) { said(btn, false, 'High: the most 10s must be at least the fewest.'); return; }
  if (out.lowHi <= out.lowLo) { said(btn, false, 'Low: the highest value must be above the lowest.'); return; }
  if (out.midHi <= out.lowHi) { said(btn, false, 'Medium\'s highest value must be above Low\'s.'); return; }
  btn.disabled = true;
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, 'config/wheels'), out);
    ctl.wheelsCfg = out;
  } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(btn, true, 'Saved');
}
// ---------- Test play: a game alone in a new tab, with its card's settings as the editor has them (saved or
// not; checked by nothing here: the game takes what it can). The live settings are never touched: the
// settings ride in the address (?sandbox=<game>&cfg=<base64url JSON>) and the game, which checks the
// admin's sign-in, keeps them in that tab only (src/ui/sandbox.js). ----------
function editorCfg(t) {
  const tn = Object.fromEntries([...app.querySelectorAll(`[data-tune="${t}"]`)].map(el => [el.dataset.k, el.value]));
  return Object.assign(legacyCfg(t), Object.keys(tn).length ? { tune: tn } : {});
}
function legacyCfg(t) {
  const q = sel => [...app.querySelectorAll(sel)];
  const val = el => (el.tagName === 'SELECT' && !Number.isFinite(Number(el.value)) ? el.value : Number(el.value));
  if (RUN_TYPES.includes(t)) {
    const out = { mix: {} };
    for (const el of q(`input[data-runcfg^="${t}:"]`)) { const k = el.dataset.runcfg.split(':')[1]; if (k.startsWith('mix.')) out.mix[k.slice(4)] = val(el); else out[k] = val(el); }
    return out;
  }
  const one = { bullseye: 'bullcfg', plinko: 'plinkocfg', pig: 'pigcfg', roads: 'roadscfg', oddone: 'oddcfg', wheels: 'wheelcfg' }[t];
  if (one) return Object.fromEntries(q(`[data-${one}]`).map(el => [el.dataset[one], val(el)]));
  return Object.fromEntries(q(`[data-attcfg="${t}"], [data-fingcfg="${t}"]`).map(el => [el.dataset.k, val(el)]));
}
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function testPlay(t) {
  const u = new URL('index.html', location.href);
  u.searchParams.set('sandbox', t);
  u.searchParams.set('cfg', b64url(JSON.stringify(editorCfg(t))));
  window.open(u.href, '_blank', 'noopener');
}
// ---------- Mini-game Settings: every mini-game's own page (#settings/<type>), its settings from its meta.js
// (TUNE: src/core/tune.js) saved to config/tune/<type> (only the values that differ from the defaults), read by
// the game and the server and dealt into each new square. The games with an older tuning card (config/<name>)
// show it on the same page. Test play: the game alone in a new tab with the page's values, saved or not. ----------
const CATS = [['luck', 'Luck'], ['skill', 'Skill'], ['brain', 'Brain']];
const TGROUPS = ['Board', 'Rules', 'Timing', 'Computer'];
let META = {}, TUNE = null, CLIENT = null;      // each game's meta.js; core/tune.js (tuneValue, tuneNorm); core/client.js (versions)
async function loadMetas() {
  if (TUNE) return;
  const reg = await import('./src/games/index.js'), ts = Object.keys(GAMES), ms = ts.map(t => (reg.GAMES[t] && reg.GAMES[t].meta) || {});   // (the registry: each game's meta, in the order the game loads them)
  META = Object.fromEntries(ts.map((t, i) => [t, ms[i]]));
  TUNE = await import('./src/core/tune.js');   // (the registry has registered every game's settings)
  CLIENT = await import('./src/core/client.js');
}
const tuneList = t => (META[t] && Array.isArray(META[t].TUNE) ? META[t].TUNE : []);
function legacyCard(t) {                       // the older tuning card, where the game has one
  if (RUN_TYPES.includes(t)) return runnersCard(t);
  const one = { bullseye: bullsCard, plinko: plinkoCard, pig: pigCard, roads: roadsCard, oddone: oddCard, wheels: wheelsCard }[t];
  if (one) return one();
  const c = ATT_CARDS.find(x => x.id === t) || FING_CARDS.find(x => x.id === t) || BOWL_CARDS.find(x => x.id === t);
  return c ? (ATT_CARDS.includes(c) ? attCard(c) : fingCard(c)) : '';
}
const legacyPath = t => (RUN_TYPES.includes(t) ? `config/run/${t}` : t === 'bullseye' ? 'config/bulls' : ['plinko', 'pig', 'roads', 'oddone', 'wheels', 'headcount', 'flash', 'snapshot', 'skyhop', 'scoop', 'pinball', 'bowling'].includes(t) ? `config/${t}` : null);
const changedOf = t => Object.keys((ctl.tune && ctl.tune[t]) || {}).length;
// ---------- Animation (config/anim): speed, everyone's pace (read by the game and the server); fast and fx, the players'
// Speed setting's multiplier and effects intensity (the game's alone: a player's Animation choice) ----------
const ANIM_FIELDS = [['speed', 'Animation speed, everyone (1.0 = as designed)', 0.5, 2], ['fast', 'Speed mode: speed multiplier (2.0 = default)', 1, 4], ['fx', 'Speed mode: effects intensity (1.0 = default)', 0, 2]];
const ANIM_DEF = { speed: 1, fast: 2, fx: 1 };
function animCard() {
  const num = k => (ctl.anim && Number.isFinite(Number(ctl.anim[k])) ? Number(ctl.anim[k]) : ANIM_DEF[k]);
  const same = ANIM_FIELDS.every(([k]) => num(k) === ANIM_DEF[k]);
  return `<div class="card ctl" id="animCard"><h2>Animation</h2>
    <p class="note"><b>Animation speed, everyone</b>: one multiplier for the whole game's pace, every player's: every move's animation, its result's hold, the board's glow before a zoom and the computer's pauses (0.5 to 2.0; 1.0 as designed). The server's turn clock and the bots pace by it too.</p>
    <p class="note"><b>Speed mode</b> is a player's own Animation setting (Normal or Speed, in the main menu and the in-game menu; on their screen only, never the rules, the timers or what the other player sees). Its <b>speed multiplier</b> runs everything that many times as fast again (1.0 to 4.0; 2.0 halves every animation, hold and transition; replays at least 1.5×; runs, physics shots and the games' own timed waits stay in real time). Its <b>effects intensity</b> scales the punch: the screen shake on claims and big moments, the confetti, the pops under a tap (0 to 2.0; 0 turns them off). Players' phones pick these up when the page loads (or comes back after a minute away).</p>
    <div class="rform">${ANIM_FIELDS.map(([k, label, lo, hi]) => `<label class="rf"><span>${label}</span><input type="number" step="0.1" min="${lo}" max="${hi}" data-animcfg="${k}" value="${num(k)}"></label>`).join('')}<button class="btn" data-animsave="1">Save</button><button class="btn" data-animreset="1"${same ? ' disabled' : ''}>Reset to defaults</button></div></div>`;
}
async function saveAnimCfg(btn, reset) {
  const val = {};
  for (const [k, label, lo, hi] of ANIM_FIELDS) {
    const el = app.querySelector(`input[data-animcfg="${k}"]`), v = reset ? ANIM_DEF[k] : Math.round(Number(el.value) * 100) / 100;
    if (!Number.isFinite(v) || v < lo || v > hi) { said(btn, false, `${label.split(' (')[0]}: from ${lo} to ${hi}`); return; }
    if (v !== ANIM_DEF[k]) val[k] = v;
  }
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/anim'), Object.keys(val).length ? val : null); ctl.anim = val; } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(app.querySelector('[data-animsave]') || btn, true, 'Saved');
}
function settingsIndex() {
  return animCard() + CATS.map(([c, label]) => {
    const ts = Object.keys(GAMES).filter(t => META[t] && META[t].category === c).sort((a, b) => GAMES[a].localeCompare(GAMES[b]));
    return `<div class="card"><h2>${label}</h2><div class="gtiles">${ts.map(t => {
      const k = changedOf(t), old = legacyPath(t) ? ' · tuning card' : '';
      return `<a class="gtile" href="#settings/${t}"><b>${esc(GAMES[t])}</b><small>${tuneList(t).length} setting${tuneList(t).length === 1 ? '' : 's'}${old}${k ? ` · <span class="chg">${k} changed</span>` : ''}</small></a>`;
    }).join('')}</div></div>`;
  }).join('') + '<p class="note">Each page: the game\'s settings, Save, Reset to defaults and Test play. A change applies to squares dealt from then on (a square under way keeps the values it was dealt with).</p>';
}
function gamePage(t) {
  const fields = tuneList(t), saved = (ctl.tune && ctl.tune[t]) || {}, cat = CATS.find(c => META[t] && c[0] === META[t].category);
  const inp = f => {
    const v = saved[f.k] !== undefined ? saved[f.k] : f.def, ch = saved[f.k] !== undefined && saved[f.k] !== f.def;
    const box = f.opts ? `<select data-tune="${t}" data-k="${f.k}">${f.opts.map(o => `<option value="${esc(o)}"${String(o) === String(v) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : `<input type="number" inputmode="decimal" data-tune="${t}" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${esc(v)}">`;
    return `<label class="rf${ch ? ' chg' : ''}"><span>${esc(f.label)}</span>${box}<small>Default ${esc(f.def)}${f.opts ? '' : ` · ${f.min}–${f.max}`}</small></label>`;
  };
  const groups = TGROUPS.concat([...new Set(fields.map(f => f.group).filter(g => !TGROUPS.includes(g)))]).map(g => [g, fields.filter(f => (f.group || 'Rules') === g)]).filter(([, fs]) => fs.length);
  const body = fields.length ? groups.map(([g, fs]) => `<h3>${esc(g)}</h3><div class="rform tform">${fs.map(inp).join('')}</div>`).join('') : '<p class="note">No settings of its own beyond the tuning card above.</p>';
  return `<div class="gpage"><p class="note">${cat ? esc(cat[1]) : ''} · ${esc((META[t] && META[t].info && META[t].info.hint) || '')}</p>
    ${legacyCard(t)}
    <div class="card ctl" id="tuneCard"><h2>Settings</h2>${body}
      <div class="tbar"><button class="btn go" data-tunesave="${t}"${fields.length ? '' : ' disabled'}>Save</button><button class="btn" data-tunereset="${t}">Reset to defaults</button><button class="btn tplay" data-testplay="${t}" title="Opens the game alone in a new tab with this page's values, saved or not (the live settings are not touched)">Test play</button></div>
      <p class="note">Save: to the game and the server at once, for squares dealt from then on. Reset to defaults: every value on this page back to the code's${legacyPath(t) ? ' (the tuning card\'s too)' : ''}. Test play: the game alone in a new tab with the values as they are here, saved or not.</p></div></div>`;
}
async function saveTune(t, btn) {
  const out = {};
  for (const el of app.querySelectorAll(`[data-tune="${t}"]`)) {
    const f = tuneList(t).find(x => x.k === el.dataset.k), v = f && TUNE.tuneValue(f, el.value);
    if (!f) continue;
    if (v === null || (!f.opts && Number(el.value) !== v)) { said(btn, false, `${f.label}: ${f.opts ? 'one of ' + f.opts.join(', ') : `a number from ${f.min} to ${f.max}${f.step && f.step !== 1 ? ` in steps of ${f.step}` : ''}`}`); return; }
    out[f.k] = v;
  }
  const bad = META[t] && typeof META[t].tuneCheck === 'function' && META[t].tuneCheck(Object.assign(TUNE.tuneDefaults(t), out));   // (the game's own check of its values together)
  if (bad) { said(btn, false, bad); return; }
  const norm = TUNE.tuneNorm(t, out);
  btn.disabled = true;
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `config/tune/${t}`), Object.keys(norm).length ? norm : null);
    const back = (await fb.dbM.get(fb.dbM.ref(fb.db, `config/tune/${t}`))).val() || {};   // (read back: what the game and the server will deal with)
    if (JSON.stringify(TUNE.tuneNorm(t, back)) !== JSON.stringify(norm)) throw new Error('the database kept different values; reload and try again');
    ctl.tune = Object.assign({}, ctl.tune, { [t]: norm });
    if (!Object.keys(norm).length) delete ctl.tune[t];
  } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(btn, true, 'Saved');
}
async function resetTune(t, btn) {
  if (!confirm(`Put every ${GAMES[t]} setting back to its default? Squares dealt from then on use the defaults.`)) return;
  btn.disabled = true;
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `config/tune/${t}`), null);
    if (legacyPath(t)) await fb.dbM.set(fb.dbM.ref(fb.db, legacyPath(t)), null);
    await loadCtl();
  } catch (e) { said(btn, false, 'Not reset: ' + ((e && e.message) || 'the database refused it')); return; }
  render(); said(btn, true, 'Back to the defaults');
}
// ---------- matchmaking controls: Find Match on or off (features/findMatch, read by the game and the server) ----------
function findCard() {
  const on = !!(ctl.features && ctl.features.findMatch === true);
  return `<div class="card ctl" id="findCard"><div class="row"><h2>Find Match</h2><label class="sw"><input type="checkbox" data-feat="findMatch"${on ? ' checked' : ''}><span>${on ? 'On' : 'Off'}</span></label></div>
    <p class="note">Off: the Find a Match button in the game is greyed out and says "Not available at this time", nobody new joins the queue, and anyone searching is sent back to Play Online. Matches already under way carry on. Play a Friend is not affected.</p></div>`;
}
async function saveFeat(el) {
  const k = el.dataset.feat;
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `features/${k}`), el.checked);
    ctl.features = Object.assign({}, ctl.features, { [k]: el.checked });
  } catch (e) { render(); said(el, false, failed(e)); return; }
  render(); said(el, true, 'Saved');
}
// ---------- the bots and the empty-queue alert (admin/config, read by the server) ----------
const chk = (sec, k) => `<input type="checkbox" data-cfg="${sec}.${k}"${cfgGet(sec, k) ? ' checked' : ''}>`;
const numIn = (sec, k, min, max) => `<input type="number" inputmode="numeric" data-cfg="${sec}.${k}" min="${min}" max="${max}" value="${esc(cfgGet(sec, k))}">`;
function botsCard() {
  const b = ctl.botStats || {}, list = Object.values(ctl.bots || {}).sort((x, y) => String(x.key).localeCompare(String(y.key)));
  return `<div class="card ctl" id="botsCard"><div class="row"><h2>Bots</h2><label class="sw">${chk('bots', 'enabled')}<span>${cfgGet('bots', 'enabled') ? 'On' : 'Off'}</span></label></div>
    <p class="note">When someone searches Find Match and nobody else is searching, a bot takes them on after a random wait between these two numbers. The player is not told it is a bot. Off: they keep waiting.</p>
    <div class="fields"><label>Wait from ${numIn('bots', 'waitMin', 5, 600)} s</label><label>to ${numIn('bots', 'waitMax', 5, 600)} s</label>
      <label>${chk('bots', 'countInRecords')} Count bot matches in players' records</label>
      <label>Bots play at <select data-cfg="bots.level">${[['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']].map(([v, l]) => `<option value="${v}"${cfgGet('bots', 'level') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <p class="note">The computer's levels, as in Play Local: Easy is Normal with a careless move now and then; Normal the computer as it has always played, each bot with its own style; Hard searches inside the mini-games and plays the rest of the match out (Monte Carlo) before choosing its square, within about 0.3 s a move. The default for new bot matches; a match under way keeps its level.</p>
    <div class="kpis" style="margin-top:12px">
      <div class="kpi"><small>Bot matches run</small><b>${n(b.started)}</b><span>${n(b.finished)} finished</span></div>
      <div class="kpi"><small>Players won</small><b>${n(b.playerWins)}</b><span>bots won ${n(b.botWins)} · draws ${n(b.draws)}</span></div></div>
    ${list.length ? `<div class="tbl" style="margin-top:8px"><table><thead><tr><th>Bot account</th><th style="text-align:left">Plays like</th></tr></thead><tbody>${list.map(x => `<tr><td>${esc(x.username)}</td><td style="text-align:left;white-space:normal">${esc(x.about || '')}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="note">The five bot accounts are made the first time a bot is needed. Their styles and pace are set in functions/bots.js.</p>'}</div>`;
}
// ---------- the Hard computer's weights (config/ai): what npm run tune-ai saved by self-play, read by the game and the server ----------
const AI_W = [['attack', 'Line value (own lines)'], ['defend', 'Defence priority'], ['rollRisk', 'Risk appetite (Risky Rolls, points)'], ['explore', 'Playout exploring'], ['prog', 'Playout progress chance'], ['fresh', 'Moves needed in a reset square'], ['playouts', 'Playouts per candidate']];
function aiCard() {
  const w = ctl.ai || {}, set = Object.keys(w).filter(k => AI_W.some(x => x[0] === k) || k === 'margin').length;
  const row = ([k, label]) => `<tr><td>${label}</td><td>${w[k] != null ? `<b>${esc(w[k])}</b>` : '<span class="dim">default</span>'}</td></tr>`;
  return `<div class="card ctl" id="aiCard"><div class="row"><h2>Hard computer's weights</h2><span class="note" style="margin:0">${set ? `${set} tuned${w.tuned ? ` · ${PT.nyWhen(w.tuned)}` : ''}${w.matches ? ` · ${w.matches} matches` : ''}` : 'the code\'s defaults'}</span></div>
    <div class="tbl"><table><thead><tr><th style="text-align:left">Weight</th><th>Value</th></tr></thead><tbody>${AI_W.map(row).join('')}</tbody></table></div>
    <p class="note">Tuned by self-play with <code>npm run tune-ai</code> (thousands of computer-against-computer matches; a change is kept only when it wins more; never run on its own). Normal and Easy play the code's own numbers whatever is here. Reset puts the defaults back for the Hard computer and the bots at Hard.</p>
    <div class="rform"><button class="btn" data-airesets="1"${set ? '' : ' disabled'}>Reset to defaults</button></div>
    <h3>Tempo play (Hard)</h3><p class="note">A square the Hard computer leads by more than this many moves (the other side's needs beyond its own) can wait while it plays elsewhere; it comes back to finish it once the lead is down to this margin, or sooner when the other side could catch up in one lucky move, threatens the match elsewhere, or the square blocks or completes a line. 1 to 5; 2 by default. Not changed by tuning.</p>
    <div class="rform"><label class="rf"><span>Safe lead (moves)</span><input type="number" step="0.5" min="1" max="5" data-aimargin="1" value="${w.margin != null ? esc(w.margin) : 2}"></label><button class="btn" data-aimarginsave="1">Save</button></div></div>`;
}
async function saveAiMargin(btn) {
  const v = Math.round(Number(app.querySelector('input[data-aimargin]').value) * 2) / 2;
  if (!Number.isFinite(v) || v < 1 || v > 5) { said(btn, false, 'From 1 to 5'); return; }
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/ai/margin'), v === 2 ? null : v); ctl.ai = Object.assign({}, ctl.ai); if (v === 2) delete ctl.ai.margin; else ctl.ai.margin = v; } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(app.querySelector('[data-aimarginsave]') || btn, true, 'Saved');
}
async function resetAi(btn) {
  if (!confirm('Put the Hard computer\'s weights back to the code\'s defaults?')) return;
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/ai'), null); ctl.ai = {}; } catch (e) { said(btn, false, 'Not reset: ' + ((e && e.message) || 'the database refused it')); return; }
  render(); said(btn, true, 'Back to the defaults');
}
function alertsCard() {
  const set = k => (ctl.secretsSet && ctl.secretsSet[k] ? '<span class="set">saved</span>' : '<span class="unset">not set</span>');
  const sec = (k, label, type = 'password') => `<label>${label} <input type="${type}" data-secret="${k}" autocomplete="off" placeholder="${ctl.secretsSet && ctl.secretsSet[k] ? 'saved: type to replace' : ''}"> ${set(k)}</label>`;
  const log = (ctl.alertLog || []).slice(0, 8), st = ctl.alertStats || {};
  const out = v => (!v || v === 'off' ? '<span class="dim">–</span>' : v === 'sent' ? '<span class="good">sent</span>' : `<span class="bad">${esc(v)}</span>`);
  const tr = testResult ? `<p class="res">Test: text ${out(testResult.sms)} · email ${out(testResult.email)}</p>` : '';
  const phoneOk = !cfgGet('alerts', 'phone') || /^\+?[\d\s().-]{10,18}$/.test(cfgGet('alerts', 'phone'));
  return `<div class="card ctl" id="alertsCard"><div class="row"><h2>Empty-queue alerts</h2><label class="sw">${chk('alerts', 'enabled')}<span>${cfgGet('alerts', 'enabled') ? 'On' : 'Off'}</span></label></div>
    <p class="note">When someone has searched for this many seconds and nobody else is searching, you get a text and/or an email with a link straight into Find Match. It comes before any bot (bots wait ${esc(cfgGet('bots', 'waitMin'))}–${esc(cfgGet('bots', 'waitMax'))} s), so you have until then to join. Your own searches never alert you.</p>
    <div class="fields"><label>${chk('alerts', 'sms')} Text (SMS)</label><label>${chk('alerts', 'email')} Email</label>
      <label>Phone <input type="tel" data-cfg="alerts.phone" value="${esc(cfgGet('alerts', 'phone'))}" placeholder="914-555-0100"></label>${phoneOk ? '' : '<span class="bad">not a phone number</span>'}
      <label>Email <input type="email" data-cfg="alerts.to" value="${esc(cfgGet('alerts', 'to'))}" placeholder="you@example.com"></label>
      <h3>When and how often</h3>
      <label>Alert after ${numIn('alerts', 'after', 0, 600)} s alone</label><label>One per player every ${numIn('alerts', 'cooldownMin', 0, 1440)} min</label>
      <label>At least ${numIn('alerts', 'gapMin', 0, 1440)} min apart</label><label>At most ${numIn('alerts', 'dailyCap', 1, 500)} a day</label>
      <h3>Keys (kept where only the server can read them)</h3>
      ${sec('twilioSid', 'Twilio Account SID', 'text')}${sec('twilioToken', 'Twilio Auth Token')}${sec('twilioFrom', 'Twilio number', 'tel')}
      ${sec('resendKey', 'Resend API key')}${sec('emailFrom', 'From (optional)', 'text')}
      <button class="btn" data-act="save-keys">Save keys</button>${keyMsg ? `<span class="res">${esc(keyMsg)}</span>` : ''}
      <button class="btn go" data-act="test-alert">Send a test alert</button></div>${tr}
    <p class="note">Sent ${n(st.sent)} · held back by the limits ${n(st.held)}</p>
    ${log.length ? `<div class="tbl"><table><thead><tr><th>When (UTC)</th><th>Player</th><th>Text</th><th>Email</th></tr></thead><tbody>${log.map(a => `<tr><td>${new Date(a.at).toISOString().slice(0, 16).replace('T', ' ')}</td><td>${a.test ? '<i>test</i>' : esc(a.username || '')}</td><td>${out(a.channels && a.channels.sms)}</td><td>${out(a.channels && a.channels.email)}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
}
async function saveCfg(el) {
  const [sec, k] = el.dataset.cfg.split('.');
  let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value.trim();
  if (el.type === 'number' && (!Number.isFinite(v) || (el.min !== '' && v < Number(el.min)) || (el.max !== '' && v > Number(el.max)))) { said(el, false, `A number from ${el.min} to ${el.max}`); return; }
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `admin/config/${sec}/${k}`), v);
    ctl.config = ctl.config || {}; ctl.config[sec] = Object.assign({}, ctl.config[sec], { [k]: v });
  } catch (e) { said(el, false, failed(e)); return; }
  if (el.type === 'checkbox' || el.tagName === 'SELECT') render();   // (a typed field keeps the page as it is: the focus may have moved on)
  said(el, true, 'Saved');
}
async function saveKeys() {
  const ins = [...app.querySelectorAll('input[data-secret]')].filter(i => i.value.trim());
  if (!ins.length) { keyMsg = 'Nothing to save.'; render(); return; }
  try {
    for (const i of ins) {
      await fb.dbM.set(fb.dbM.ref(fb.db, `admin/secrets/${i.dataset.secret}`), i.value.trim());
      await fb.dbM.set(fb.dbM.ref(fb.db, `admin/secretsSet/${i.dataset.secret}`), true);
      ctl.secretsSet[i.dataset.secret] = true;
    }
    keyMsg = `Saved ${ins.length}.`;
  } catch (e) { keyMsg = 'Could not save: ' + (e && e.message); }
  render();
}
async function testAlert(b) {
  b.disabled = true; testResult = null;
  try { testResult = await fb.fnM.httpsCallable(fb.fns, 'testAlert')({}).then(r => r.data); }
  catch (e) { testResult = { sms: 'error: ' + (e && e.message), email: 'error: ' + (e && e.message) }; }
  await loadCtl(); render();
}

// Existing usernames the username rules (the word list) would refuse today: listed for a look, never changed.
function flaggedCard() {
  const f = flagged;
  if (!f) return '<div class="card"><h2>Usernames to review</h2><p class="note">Not checked yet: the check runs after the next deploy.</p></div>';
  const list = Object.entries(f.names || {}).sort((a, b) => a[1].username.localeCompare(b[1].username));
  const when = new Date(f.at).toISOString().slice(0, 16).replace('T', ' ');
  return `<div class="card"><h2>Usernames to review</h2><p class="note">${n(f.checked)} existing usernames checked against the word list on ${when} UTC: ${list.length ? `${list.length} would be refused today. Nothing was changed.` : 'none would be refused.'}</p>${list.length ? `<div class="tbl"><table><thead><tr><th>Username</th><th>Matched</th><th>Account id</th></tr></thead><tbody>${list.map(([uid, v]) =>
    `<tr><td>${esc(v.username)}</td><td>${esc(v.word || v.why || '')}</td><td class="dim">${esc(uid)}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>`;
}

// ---------- Firebase ----------
async function boot() {
  const hook = window.TTT_FIREBASE || null;                      // the tests: the local emulators
  const base = (hook && hook.cdn) || `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
  const [appM, authM, dbM, fnM] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-database.js'), import(base + 'firebase-functions.js')]);
  const fapp = appM.initializeApp((hook && hook.config) || FIREBASE_CONFIG);
  const auth = authM.getAuth(fapp), db = dbM.getDatabase(fapp), fns = fnM.getFunctions(fapp, 'us-central1');
  if (hook && hook.auth) authM.connectAuthEmulator(auth, hook.auth, { disableWarnings: true });
  if (hook && hook.emulator) dbM.connectDatabaseEmulator(db, hook.emulator.host, hook.emulator.port);
  if (hook && hook.functions) fnM.connectFunctionsEmulator(fns, hook.functions.host, hook.functions.port);
  fb = { authM, dbM, fnM, auth, db, fns, hook };
  let pending = false;
  try { pending = Object.keys(sessionStorage).some(k => k.startsWith('firebase:pendingRedirect')); } catch (e) { /* no storage */ }
  if (pending) { try { await authM.getRedirectResult(auth); } catch (e) { view.error = 'Could not log in. Try again.'; } }   // back from Google's sign-in page
  authM.onAuthStateChanged(auth, u => onUser(u));
}
async function onUser(u) {
  user = u && !u.isAnonymous ? u : null;
  stats = null;
  if (!user) { view.status = 'signin'; render(); return; }
  view = { status: 'loading', error: '' }; render();
  const tok = await fb.authM.getIdTokenResult(user, true).catch(() => null);   // fresh: a flag given a moment ago counts
  if (!tok || tok.claims.admin !== true) { view = { status: 'denied', error: '' }; render(); return; }
  await load();
}
async function load() {
  try {
    const [snap, fl] = await Promise.all([fb.dbM.get(fb.dbM.ref(fb.db, 'stats')), fb.dbM.get(fb.dbM.ref(fb.db, 'review/flaggedNames')).catch(() => null)]);
    stats = snap.val() || {};
    flagged = fl ? fl.val() : null;
    await Promise.all([loadCtl(), loadPeople()]);
    view = { status: 'ready', error: '' };
  } catch (e) {
    view = { status: 'denied', error: /permission/i.test(String(e && (e.code || e.message))) ? 'The database refused: the admin flag is not on this account yet.' : 'Could not load the stats.' };
  }
  render();
}
// The accounts (users/ is readable when logged in; localStats/ and lastSeen/ by the admin only) and the
// playtest logs (devices/, devlog/: the admin only). Each part on its own: one refused leaves the rest.
async function loadPeople() {
  const g = p => fb.dbM.get(fb.dbM.ref(fb.db, p)).then(s => s.val() || {}).catch(() => null);
  const q = (ord, lim) => fb.dbM.get(fb.dbM.query(fb.dbM.ref(fb.db, 'matchLogIndex'), fb.dbM.orderByChild(ord), ...lim)).then(s => s.val() || {}).catch(() => null);
  if (!PS) PS = await import('./src/ui/pstats.js').catch(() => null);
  const [users, local, seen, devices, logs, mlRecent, mlRep] = await Promise.all([g('users'), g('localStats'), g('lastSeen'), g('devices'), g('devlog'),
    q('last', [fb.dbM.limitToLast(500)]), q('reported', [fb.dbM.startAt(1), fb.dbM.limitToLast(200)])]);   // (the match inspector: the latest, and every reported one)
  mlogs = mlRecent || mlRep ? Object.assign({}, mlRecent || {}, mlRep || {}) : null; mlEvents = {};
  accts = users ? { users, local: local || {}, seen: seen || {} } : null;
  play = devices || logs ? { devices: devices || {}, logs: logs || {} } : null;
}
async function loadCtl() {
  const g = p => fb.dbM.get(fb.dbM.ref(fb.db, p)).then(s => s.val()).catch(() => null);
  const [config, secretsSet, bots, botStats, alertStats, features, log, releases, runCfg, bullsCfg, wheelsCfg, plinkoCfg, oddCfg, headCfg, flashCfg, snapCfg, hopCfg, scoopCfg, pinCfg, pigCfg, roadsCfg, bowlCfg] = await Promise.all([g('admin/config'), g('admin/secretsSet'), g('bots'), g('botStats'), g('alertStats'), g('features'),
    fb.dbM.get(fb.dbM.query(fb.dbM.ref(fb.db, 'alertLog'), fb.dbM.orderByChild('at'), fb.dbM.limitToLast(8))).then(s => s.val()).catch(() => null), g('releases'), g('config/run'), g('config/bulls'), g('config/wheels'), g('config/plinko'), g('config/oddone'), g('config/headcount'), g('config/flash'), g('config/snapshot'), g('config/skyhop'), g('config/scoop'), g('config/pinball'), g('config/pig'), g('config/roads'), g('config/bowling'), loadMetas()]);
  ctl = { config: config || {}, secretsSet: secretsSet || {}, bots: bots || {}, botStats: botStats || {}, alertStats: alertStats || {}, features: features || {}, releases: releases || {}, runCfg: runCfg || {}, bullsCfg: bullsCfg || {}, wheelsCfg: wheelsCfg || {}, plinkoCfg: plinkoCfg || {}, pigCfg: pigCfg || {}, roadsCfg: roadsCfg || {}, oddCfg: oddCfg || {}, attCfg: { headcount: headCfg || {}, flash: flashCfg || {}, snapshot: snapCfg || {} }, fingCfg: { skyhop: hopCfg || {}, scoop: scoopCfg || {}, bowling: bowlCfg || {}, pinball: pinCfg || {} },
    alertLog: Object.values(log || {}).sort((a, b) => b.at - a.at), tune: (await g('config/tune')) || {}, ai: (await g('config/ai')) || {}, anim: (await g('config/anim')) || {}, clients: (await g('config/clients')) || {}, allow: STAGING ? ((await g('admin/staging/allow')) || {}) : {} };
}
async function signIn(how) {
  view.error = '';
  try {
    const A = fb.authM;
    if (how === 'google') {
      const popup = (fb.hook && fb.hook.popup) || A.signInWithPopup;
      try { await popup(fb.auth, new A.GoogleAuthProvider()); }
      catch (e) { if (/popup-blocked|operation-not-supported/.test(String(e && e.code))) await A.signInWithRedirect(fb.auth, new A.GoogleAuthProvider()); else throw e; }
    } else await A.signInWithEmailAndPassword(fb.auth, document.getElementById('em').value.trim(), document.getElementById('pw').value);
  } catch (e) {
    if (!/popup-closed|cancelled-popup/.test(String(e && e.code))) { view.error = 'Could not log in. Check the details and try again.'; render(); }
  }
}
app.addEventListener('click', e => {
  let b = e.target.closest('button');
  if (!b) { const tr = e.target.closest('tr.dev'); if (tr) b = tr.querySelector('button[data-dev]'); }   // a tap anywhere on a device's row
  const ar = !b && e.target.closest('tr.acct');
  if (ar && fb) { acctOpen = acctOpen === ar.dataset.uid ? null : ar.dataset.uid; render(); const el = acctOpen && document.getElementById('acctDetail'); if (el) el.scrollIntoView({ block: 'nearest' }); return; }   // an account's row: its detail
  const mr = !b && e.target.closest('tr.mlrow');
  if (mr && fb) { const k = mr.dataset.ml; mlOpen = mlOpen === k ? null : k; render(); if (mlOpen) { mlLoad(mlOpen); const el = document.getElementById('mlTimeline'); if (el) el.scrollIntoView({ block: 'nearest' }); } return; }   // a match's row: its timeline
  if (!b || !fb) return;
  if (b.dataset.allowdel) { allowEdit(b, b.dataset.allowdel, false); return; }
  if (b.dataset.act === 'allowadd') { const i = document.getElementById('allowAdd'); allowEdit(b, i && i.value, true); return; }
  if (b.dataset.mlexport) { mlExport(b.dataset.mlexport); return; }
  if (b.dataset.mlclose) { mlOpen = null; render(); return; }
  if (b.dataset.aclose) { acctOpen = null; render(); return; }
  if (b.dataset.aview) { acctView = b.dataset.aview; render(); return; }
  if (b.dataset.act === 'google') signIn('google');
  else if (b.dataset.act === 'email') signIn('email');
  else if (b.dataset.act === 'signout') fb.authM.signOut(fb.auth);
  else if (b.dataset.act === 'refresh') { b.disabled = true; load(); }
  else if (b.dataset.sort) { const k = b.dataset.sort; sortBy = { k, dir: sortBy.k === k ? -sortBy.dir : ['name', 'avgWin', 'avgLose', 'avgAll', 'scAvgWin', 'scAvgAll'].includes(k) ? 1 : -1 }; render(); }
  else if (b.dataset.period) { period = b.dataset.period; render(); }
  else if (b.dataset.ovp) { setOvPeriod(b.dataset.ovp); render(); }
  else if (b.dataset.asort) { acctSort = flip(acctSort, b.dataset.asort, ['joined', 'last', 'games', 'wins', 'rate']); render(); }
  else if (b.dataset.dsort) { devSort = flip(devSort, b.dataset.dsort, ['first', 'last', 'nSessions', 'games', 'perSession', 'back']); render(); }
  else if (b.dataset.dev) { devOpen = devOpen === b.dataset.dev ? null : b.dataset.dev; render(); const el = devOpen && document.getElementById('devTimeline'); if (el) el.scrollIntoView({ block: 'nearest' }); }
  else if (b.dataset.act === 'all-sessions') { allSessions = !allSessions; render(); }
  else if (b.dataset.act === 'save-keys') saveKeys();
  else if (b.dataset.testplay) testPlay(b.dataset.testplay);
  else if (b.dataset.tunesave) saveTune(b.dataset.tunesave, b);
  else if (b.dataset.tunereset) resetTune(b.dataset.tunereset, b);
  else if (b.dataset.airesets) resetAi(b);
  else if (b.dataset.runsave) saveRunCfg(b.dataset.runsave, b);
  else if (b.dataset.bullsave) saveBullsCfg(b);
  else if (b.dataset.wheelsave) saveWheelsCfg(b);
  else if (b.dataset.plinkosave) savePlinkoCfg(b);
  else if (b.dataset.animsave) saveAnimCfg(b, false);
  else if (b.dataset.aimarginsave) saveAiMargin(b);
  else if (b.dataset.clientsave) saveClients(b);
  else if (b.dataset.animreset) saveAnimCfg(b, true);
  else if (b.dataset.pigsave) savePigCfg(b);
  else if (b.dataset.roadssave) saveRoadsCfg(b);
  else if (b.dataset.oddsave) saveOddCfg(b);
  else if (b.dataset.attsave) saveAttCfg(b);
  else if (b.dataset.fingsave) saveFingCfg(b);
  else if (b.dataset.act === 'test-alert') testAlert(b);
});
app.addEventListener('input', () => { if (note) { note = null; showNote(); } });   // (an edit after a save: its note goes)
app.addEventListener('change', e => {
  if (e.target.id === 'mm') { miniMode = e.target.value; render(); }
  else if (['mlWho', 'mlMode', 'mlFrom', 'mlTo'].includes(e.target.id)) { mlFilt[{ mlWho: 'who', mlMode: 'mode', mlFrom: 'from', mlTo: 'to' }[e.target.id]] = e.target.value; mlOpen = null; render(); }
  else if (e.target.id === 'tagPick') { tagPick = e.target.value; devOpen = null; render(); }
  else if (e.target.dataset && e.target.dataset.cfg) saveCfg(e.target);
  else if (e.target.dataset && e.target.dataset.feat) saveFeat(e.target);
  else if (e.target.dataset && e.target.dataset.rel) saveRelease(e.target);
  else if (e.target.dataset && e.target.dataset.relios) saveRelIos(e.target);
});
boot().catch(() => { app.innerHTML = '<div class="card msg"><h1>Tic Tac Chaos Stats</h1><p>Could not load. Check the connection and reload.</p></div>'; });
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false }); document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });   // (iPhone's pinch)
