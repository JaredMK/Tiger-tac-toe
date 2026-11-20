// The admin dashboard's pages (December 2026): Overview, Players (and a person's profile), Matches (and a match), the
// games' comparison and a game's numbers, Growth, Health, and the rows behind any number. Every number comes from the one
// metrics layer (metrics.js: a metric asked of a scope, the model under the page's filters); every table is the one table
// (table.js); every chart the one bar chart below. Pure: each page is a string of HTML from its context
//   ctx: { S (the scope), names (type → the game's name), released(type), versions, ts(id) (a table's state), drills (a Map:
//          the row sets a link can open), logs (match logs read so far), devEdit, devMsg, PS (pstats.js), accounts, alertLog, alertStats }
// admin.js reads the data, keeps the filters and the tables' states, and handles the taps.
import * as X from './metrics.js';
import * as T from './table.js';

export { X, T };
const esc = T.esc;
const whenFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
export const when = t => (t ? whenFmt.format(new Date(t)) : '');
export const date = t => (t ? dateFmt.format(new Date(t)) : '');
export function dur(ms) { if (ms == null || !Number.isFinite(ms)) return ''; const s = Math.round(ms / 1000); if (s < 60) return `${s} s`; const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; }
const pct = v => (v == null ? '–' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '–' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('en-US'));
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const pid = id => encodeURIComponent(id);
const personLink = (ctx, id, fallback) => { const p = id && ctx.S.M.people.get(id); return p ? `<a href="#players/${pid(id)}">${esc(p.name)}</a>${p.owner ? ' <span class="badge own">mine</span>' : ''}` : `<span class="dim">${esc(fallback || '–')}</span>`; };
const tipIcon = k => `<i class="tipi" tabindex="0" role="note" data-tip="${esc(X.tip(k))}" aria-label="${esc(X.tip(k))}">?</i>`;   // (admin.js shows data-tip beside it: hover, focus or a tap)

// ---------- the filters, on every stats page ----------
export function filterBar(ctx, o) {
  const f = ctx.S.f, sel = (k, opts) => `<select data-gf="${k}" aria-label="${k}">${opts.map(([v, l]) => `<option value="${v}"${String(f[k]) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<div class="fbar" role="group" aria-label="Filters for every number on this page">
    <label class="sw"><input type="checkbox" data-gf="mine"${f.mine ? ' checked' : ''}> Include my devices</label>
    <label>Dates ${sel('range', X.RANGES)}</label>${f.range === 'custom' ? `<label>From <input type="date" data-gf="from" value="${esc(ctx.S.from)}"></label><label>To <input type="date" data-gf="to" value="${esc(ctx.S.to)}"></label>` : ''}
    <label>Platform ${sel('platform', [['all', 'Web and iOS'], ['web', 'Web'], ['ios', 'iOS']])}</label>
    <label>Mode ${sel('mode', [['all', 'All modes'], ['cpu', 'vs Computer'], ['friend', 'Friend'], ['find', 'Find Match']])}</label>
    ${o && o.version ? `<label>Settings ${sel('version', [['current', 'Current version'], ['previous', 'Previous version'], ['all', 'All versions']])}</label>` : ''}
    ${o && o.quality ? `<label>Opponent ${sel('opp', [['all', 'Anyone'], ['ai', 'The computer'], ['human', 'A person']])}</label><label>Board position ${sel('pos', [['all', 'Every square'], ['corner', 'Corners'], ['side', 'Sides'], ['center', 'Centre']])}</label>` : ''}
    <span class="frange">${esc(ctx.S.from === ctx.S.to ? ctx.S.from : `${ctx.S.from} to ${ctx.S.to}`)} · New York time${f.mine ? '' : ' · my devices left out'}${f.mode !== 'all' ? ' · the mode applies to matches and what is counted from them' : ''}</span></div>`;
}

// ---------- a number: its label and one-line definition, its value (a link to the rows behind it), where its detail is ----------
function show(m) {
  if (m.of != null) return m.id === 'errorRate' ? num(m.v) : pct(m.v);
  if (['turns'].includes(m.id)) return num(m.v, 0);
  if (['minutes', 'findWait'].includes(m.id)) return m.v == null ? '–' : num(m.v) + (m.id === 'findWait' ? ' s' : '');
  if (m.id === 'sessionLen') return m.v == null ? '–' : dur(m.v);
  if (m.id === 'firstPlayer') return pct(m.v);
  return (m.v || 0).toLocaleString('en-US');
}
export function kpi(ctx, id, href) {
  const m = X.metric(ctx.S, id), sub = m.of != null ? `${m.n} of ${m.of}` : '';
  return `<div class="card kpi" data-metric="${id}"><small>${esc(X.label(id))} ${tipIcon(id)}</small><a class="big" href="#drill/${id}" title="Show the rows behind this number">${show(m)}</a>${sub ? `<span>${sub}</span>` : ''}${href ? `<a class="more" href="${href}">Details ›</a>` : ''}</div>`;
}
const kpis = (ctx, ids, href) => `<div class="kpis">${ids.map(id => kpi(ctx, id, href)).join('')}</div>`;

// ---------- the one chart: bars by day (stacked where there are several series) ----------
const COLORS = ['var(--sky)', 'var(--green)', 'var(--plum)', 'var(--o)', 'var(--x)'];
export function chart(days, series, label) {
  const W = 640, H = 190, L = 34, B = 22, Tp = 8, R = 4, iw = W - L - R, ih = H - B - Tp;
  const max = Math.max(1, ...days.map((d, i) => series.reduce((s, se) => s + se.values[i], 0))), step = iw / Math.max(1, days.length);
  let bars = '';
  days.forEach((d, i) => { let y0 = Tp + ih; series.forEach((se, k) => { const v = se.values[i], h = v / max * ih; if (!v) return; y0 -= h; bars += `<rect x="${(L + i * step + step * .1).toFixed(1)}" y="${y0.toFixed(1)}" width="${(step * .8).toFixed(1)}" height="${h.toFixed(1)}" fill="${se.color || COLORS[k % COLORS.length]}"><title>${d} · ${esc(se.name)}: ${v}</title></rect>`; }); });
  const ticks = [0, .5, 1].map(fr => { const v = Math.round(max * fr), y = Tp + ih - v / max * ih; return `<line class="ax" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 5}" y="${y + 4}" text-anchor="end">${v}</text>`; }).join('');
  const labels = days.map((d, i) => (i % Math.ceil(days.length / 6) === 0 || i === days.length - 1 ? `<text x="${(L + i * step + step / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${d.slice(5)}</text>` : '')).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${ticks}${bars}${labels}</svg>${series.length > 1 ? `<div class="legend">${series.map((se, k) => `<span><i style="background:${se.color || COLORS[k % COLORS.length]}"></i>${esc(se.name)}</span>`).join('')}</div>` : ''}</div>`;
}
const activeChart = ctx => chart(ctx.S.days, [{ name: 'Active players', values: X.activeByDay(ctx.S), color: 'var(--green)' }], 'Active players per day');
const matchChart = ctx => chart(ctx.S.days, X.matchesByDay(ctx.S).filter(s => s.group !== 'other' || s.values.some(Boolean)), 'Matches started per day, by mode');
// A funnel: each step's people as a bar of the first step's.
function funnel(ctx, ids) {
  const top = X.metric(ctx.S, ids[0]).v || 0;
  return `<div class="funnel">${ids.map(id => { const m = X.metric(ctx.S, id), v = m.v || 0; return `<span>${esc(X.label(id))} ${tipIcon(id)}</span><div class="fb" style="width:${top ? Math.max(1, Math.round(v / top * 100)) : 0}%"></div><b><a href="#drill/${id}">${v}</a>${top ? ` · ${pct(v / top)}` : ''}</b>`; }).join('')}</div>`;
}
// A set of rows a link can open (#drill/x:key): kept by key so the link still works after the page is drawn again.
function drillLink(ctx, key, title, kind, rows, text) {
  if (!rows.length) return String(text == null ? 0 : text);
  ctx.drills.set(key, { title, kind, rows });
  return `<a href="#drill/x:${encodeURIComponent(key)}" title="Show these rows">${text == null ? rows.length : text}</a>`;
}

// ---------- the row tables, one per kind of row ----------
const C = (k, label, get, o) => Object.assign({ k, label, get }, o || {});
const tm = (k, label, get) => C(k, label, r => get(r) || 0, { html: r => esc(when(get(r))), csv: r => (get(r) ? new Date(get(r)).toISOString() : '') });
function peopleCols(ctx) {
  return [C('name', 'Player', r => r.name, { html: r => personLink(ctx, r.id) }), C('kind', 'Type', r => (r.kind === 'account' ? 'Account' : 'Guest')), C('username', 'Username', r => r.username), C('nick', 'Nickname', r => r.nick),
    C('devices', 'Devices', r => r.devices, { num: true, tip: 'Devices this person has used. A guest is one device.' }), C('shorts', 'Device IDs', r => r.shorts), C('platform', 'Platform', r => r.platform), C('tag', 'Source', r => r.tag, { tip: 'The ?t= tag of the link they first came by.' }),
    tm('first', 'First seen', r => r.first), tm('last', 'Last seen', r => r.last), C('sessions', 'Sessions', r => r.sessions, { num: true, tip: X.tip('sessions') }), C('matches', 'Matches', r => r.matches, { num: true, tip: X.tip('started') }),
    C('record', 'Record', r => r.record, { tip: 'Wins-losses-draws on the account, every mode together. Guests have none.' }), C('excluded', 'Excluded', r => (r.excluded ? 'Yes' : 'No'), { tip: 'One of my devices: left out of every number unless Include my devices is on.' })];
}
const peopleTable = (ctx, id, people, opts) => T.html(id, peopleCols(ctx), people.map(p => X.personRow(ctx.S, p)), ctx.ts(id, { sort: { k: 'last', dir: -1 } }), Object.assign({ row: r => `data-go="#players/${pid(r.id)}"` }, opts));
const statusText = m => ({ finished: 'Finished', abandoned: 'Abandoned', unfinished: 'Never finished', playing: 'Being played' }[m.status]);
const playersText = (ctx, m) => m.who.map(w => (w.bot ? 'Computer' : (ctx.S.M.people.get(w.pid) || {}).name || (w.h ? 'Guest ' + w.h.slice(0, 8) : 'Guest'))).join(' vs ');
function matchCols(ctx, forPid) {
  return [tm('t0', 'Started', m => m.t0), C('mode', 'Mode', m => X.MODE_LABEL[m.mode] || m.mode), C('timer', 'Timer', m => (m.timer === 'none' ? '' : m.timer)),
    C('players', 'Players', m => playersText(ctx, m), { html: m => m.who.map(w => (w.bot ? 'Computer' : personLink(ctx, w.pid, w.h ? 'Guest ' + w.h.slice(0, 8) : 'Guest'))).join(' vs ') }),
    C('status', 'Status', statusText), C('end', 'Ended by', m => X.END_LABEL[m.end] || ''), forPid ? C('result', 'Result', m => X.resultFor(m, forPid)) : C('w', 'Winner', m => m.w || (m.status === 'finished' ? 'Draw' : '')),
    C('turns', 'Turns', m => (m.t1 ? m.turns : null), { num: true }), C('mins', 'Minutes', m => (m.ms == null ? null : Math.round(m.ms / 6000) / 10), { num: true }), C('sq', 'Squares', m => (m.t1 ? m.sq.filter(e => e.end === 'won').length : null), { num: true, tip: 'Squares claimed in it.' }),
    C('pl', 'Platform', m => [...m.pls].sort().join(', ')), C('rep', 'Reported', m => (m.log && m.log.reported ? 'Reported' + (m.log.note ? ': ' + m.log.note : '') : '')), C('own', 'Mine', m => (m.own ? 'Yes' : ''))];
}
const matchTable = (ctx, id, rows, forPid, opts) => T.html(id, matchCols(ctx, forPid), rows, ctx.ts(id, { sort: { k: 't0', dir: -1 } }), Object.assign({ row: m => `data-go="#matches/${encodeURIComponent(m.id)}"` }, opts));
const sessionCols = ctx => [tm('start', 'Started', s => s.start), C('who', 'Player', s => (ctx.S.M.people.get(s.pid) || {}).name || '', { html: s => personLink(ctx, s.pid) }), C('dev', 'Device', s => s.h.slice(0, 8)),
  C('len', 'Length (min)', s => Math.round(s.ms / 6000) / 10, { num: true }), C('opens', 'Opens', s => s.opens, { num: true }), C('starts', 'Matches started', s => s.starts, { num: true }), C('fin', 'Finished', s => s.finishes, { num: true }), C('err', 'Errors', s => s.errors, { num: true })];
const eventCols = ctx => [tm('t', 'When', e => e.t), C('who', 'Player', e => (ctx.S.M.people.get(e.dev.pid) || {}).name || '', { html: e => personLink(ctx, e.dev.pid) }), C('dev', 'Device', e => e.dev.short), C('pl', 'Platform', e => e.p || e.dev.pl),
  C('what', 'Event', e => (e.ev === 'act' ? e.act + (e.ch ? ' (' + e.ch + ')' : '') : e.ev === 'step' ? 'first ' + e.step : e.ev)), C('msg', 'Message', e => e.msg || ''), C('b', 'Build', e => e.b || ''), C('g', 'Match', e => e.g || '')];
const squareCols = ctx => [C('game', 'Game', e => ctx.names[e.t] || e.t, { html: e => `<a href="#games/${esc(e.t)}">${esc(ctx.names[e.t] || e.t)}</a>` }), C('v', 'Version', e => e.v || 1, { num: true }), C('end', 'Ended', e => ({ won: 'Claimed', draw: 'Reset', open: 'Left open' }[e.end])),
  C('w', 'Winner', e => e.w || ''), C('moves', 'Winner\'s moves', e => (e.end === 'won' ? e[e.w] : null), { num: true }), C('all', 'Moves, both', e => e.X + e.O, { num: true }), C('secs', 'Seconds', e => (Number.isFinite(e.ms) ? Math.round(e.ms / 1000) : null), { num: true }),
  C('f', 'First mover', e => e.f || ''), C('fw', 'First mover won', e => (e.end === 'won' && e.f ? (e.f === e.w ? 'Yes' : 'No') : '')), C('mode', 'Mode', e => X.MODE_LABEL[e.m.mode] || e.m.mode), tm('t0', 'Match started', e => e.m.t0)];
const findCols = ctx => [tm('t', 'When', r => r.t), C('who', 'Player', r => (ctx.S.M.people.get(r.pid) || {}).name || '', { html: r => personLink(ctx, r.pid, 'Account') }), C('k', 'Ended', r => ({ people: 'Paired with a person', bot: 'Took the computer', cancel: 'Gave up' }[r.k] || r.k)), C('s', 'Wait (s)', r => Math.round(r.ms / 100) / 10, { num: true })];
const reportCols = ctx => [tm('at', 'When', r => r.at), C('who', 'Player', r => (ctx.S.M.people.get(r.pid) || {}).name || '', { html: r => personLink(ctx, r.pid, 'Guest') }), C('where', 'Where', r => (r.g ? (r.mode || '') + ' match' : r.where || ''), { html: r => (r.g ? `<a href="#matches/${encodeURIComponent(r.g.startsWith('l') ? 'l_' + r.g.slice(1) : r.g.slice(1))}">${esc(r.mode || '')} match</a>` : esc(r.where || '')) }),
  C('note', 'Note', r => r.note || ''), C('client', 'Client', r => [r.p, r.cv, r.v].filter(Boolean).join(' '))];
function rowsTable(ctx, id, kind, rows, opts) {
  if (kind === 'people') return peopleTable(ctx, id, rows, opts);
  if (kind === 'matches') return matchTable(ctx, id, rows, null, opts);
  const cols = { sessions: sessionCols, events: eventCols, squares: squareCols, finds: findCols, reports: reportCols }[kind](ctx);
  const first = { sessions: 'start', events: 't', squares: 't0', finds: 't', reports: 'at' }[kind];
  return T.html(id, cols, rows, ctx.ts(id, { sort: { k: first, dir: -1 } }), Object.assign(kind === 'squares' ? { row: e => `data-go="#matches/${encodeURIComponent(e.m.id)}"` } : {}, opts));
}

// ---------- Overview: the numbers checked daily, each linking to its detail; nothing lives only here ----------
export function overview(ctx) {
  const k = (id, href) => kpi(ctx, id, href);
  return `${filterBar(ctx)}<div class="kpis">${k('active', '#players')}${k('newPlayers', '#growth')}${k('started', '#matches')}${k('finished', '#matches')}${k('completion', '#matches')}${k('d1', '#growth')}${k('d7', '#growth')}${k('errorRate', '#health')}${k('reports', '#health')}</div>
    <div class="grid2"><div class="card"><h2>Active players per day</h2>${activeChart(ctx)}<a class="more" href="#players">Players ›</a></div><div class="card"><h2>Matches started per day</h2>${matchChart(ctx)}<a class="more" href="#matches">Matches ›</a></div></div>
    <p class="note">Every number is counted from the same rows by the same definition on every page (hover a "?" for it). A number is a link to the rows behind it. Rows are kept 90 days.</p>`;
}

// ---------- Players: people and their devices together; a row opens the person ----------
export function players(ctx) {
  const d0 = X.dayNum(ctx.S.from), d1 = X.dayNum(ctx.S.to);
  const seen = ctx.S.people().filter(p => [...p.days].some(n => n >= d0 && n <= d1) || (p.joined && ctx.S.inT(p.joined)) || (p.kind === 'account' && p.last && ctx.S.inT(p.last)));
  return `${filterBar(ctx)}${kpis(ctx, ['active', 'played', 'newPlayers', 'newAccounts', 'sessions', 'sessionLen'])}
    <div class="card"><h2>Active players per day</h2>${activeChart(ctx)}</div>
    <div class="card"><h2>Players</h2>${peopleTable(ctx, 'people', seen, { note: 'Everyone seen in the range: an account with every device it has signed in on, or a guest by their device. Sessions and matches are counted in the range. Tap a row for the person.' })}</div>`;
}
export function profile(ctx, id) {
  const p = ctx.S.M.people.get(id);
  if (!p) return `<div class="card"><h2>No such player</h2><p class="note">They may have been deleted, or their rows are older than 90 days.</p><a class="btn" href="#players">‹ Players</a></div>`;
  const nickCell = d => (ctx.devEdit === d.h ? `<span class="nickedit"><input id="nickIn" maxlength="40" value="${esc(d.nick)}" aria-label="Nickname"><button class="btn sm" data-act="nicksave" data-key="${d.h}">Save</button><button class="btn sm" data-act="nickcancel">Cancel</button></span>`
    : `<button class="nick" data-nick="${d.h}" title="Edit the nickname">${d.nick ? esc(d.nick) : '<span class="dim">add a name</span>'}</button>`);
  const devCols = [C('nick', 'Nickname', d => d.nick, { html: nickCell }), C('short', 'Device ID', d => d.short, { html: d => `<code>${d.short}</code>` }), C('pl', 'Platform', d => d.pl + (d.cv ? ' ' + d.cv : '')), tm('first', 'First seen', d => d.first), tm('last', 'Last seen', d => d.last),
    C('names', 'Accounts on it', d => d.uids.map(u => (ctx.S.M.people.get('u:' + u) || {}).username || '').filter(Boolean).join(', ')), C('ses', 'Sessions', d => d.sessions.length, { num: true }), C('tag', 'Source', d => d.tag),
    C('ex', 'Excluded', d => (d.owner ? 'Yes' : 'No'), { html: d => `<label class="sw"><input type="checkbox" data-devex="${d.h}"${d.owner ? ' checked' : ''} aria-label="Excluded"> <span>${d.owner ? 'Excluded' : 'Counted'}</span></label>` })];
  const games = X.personGames(p).map(r => Object.assign(r, { name: ctx.names[r.t] || r.t }));
  const gameCols = [C('name', 'Mini-game', r => r.name, { html: r => `<a href="#games/${esc(r.t)}">${esc(r.name)}</a>` }), C('played', 'Squares played', r => r.played, { num: true }), C('won', 'Won', r => r.won, { num: true }), C('lost', 'Lost', r => r.lost, { num: true })];
  const errs = p.own.flatMap(d => d.evs.filter(e => e.ev === 'error').map(e => Object.assign({ dev: d }, e)));
  let life = '';
  if (p.kind === 'account' && ctx.PS && ctx.accounts && ctx.accounts.users[p.uid]) {
    const u = ctx.accounts.users[p.uid], loc = (ctx.accounts.local || {})[p.uid] || {}, PS = ctx.PS, sides = PS.viewSides(u, loc, 'all'), minis = PS.viewMinis(u, loc, 'all');
    life = `<div class="card"><h2>Account record, all time</h2><div class="kpis"><div class="card kpi"><small>Find Match and friends</small><b class="big">${PS.recText(PS.viewRec(u, loc, 'online'))}</b></div><div class="card kpi"><small>vs Computer, logged in</small><b class="big">${PS.recText(PS.viewRec(u, loc, 'local'))}</b></div>
      <div class="card kpi"><small>As X</small><b class="big">${PS.recText(sides.X)}</b></div><div class="card kpi"><small>As O</small><b class="big">${PS.recText(sides.O)}</b></div></div>
      ${T.html('lifeMinis', [C('name', 'Mini-game', r => r.name), C('won', 'Squares won', r => r.won, { num: true }), C('lost', 'Lost', r => r.lost, { num: true })], minis, ctx.ts('lifeMinis'), { note: 'The record kept on the account itself (wins-losses-draws), which is not limited to 90 days and does not follow the filters.' })}</div>`;
  }
  return `<div class="card"><div class="row"><h2>${esc(p.name)}</h2>${p.owner ? '<span class="badge own">One of my devices: excluded</span>' : ''}</div>
      <dl class="facts"><dt>Type</dt><dd>${p.kind === 'account' ? 'Account' : 'Guest (no account)'}</dd>${p.username ? `<dt>Username</dt><dd>${esc(p.username)}</dd>` : ''}${p.uid ? `<dt>Account ID</dt><dd><code>${esc(p.uid)}</code></dd>` : ''}${p.nick ? `<dt>Nickname</dt><dd>${esc(p.nick)}</dd>` : ''}
      ${p.joined ? `<dt>Signed up</dt><dd>${esc(date(p.joined))}</dd>` : ''}<dt>First seen</dt><dd>${esc(when(p.first)) || '–'}</dd><dt>Last seen</dt><dd>${esc(when(p.last)) || '–'}</dd><dt>Source</dt><dd>${esc(p.tag) || '–'}</dd>
      <dt>Sessions</dt><dd>${p.sessions.length}</dd><dt>Matches</dt><dd>${p.matches.length}</dd>${p.rec ? `<dt>Record</dt><dd>${p.rec.wins}-${p.rec.losses}-${p.rec.draws}</dd>` : ''}</dl>
      <p class="note">Everything kept for this person (rows are kept 90 days). This page does not follow the filters.</p></div>
    <div class="card"><h2>Devices</h2>${ctx.devMsg ? `<p class="note err" role="alert">${esc(ctx.devMsg)}</p>` : ''}${T.html('pDevs', devCols, p.devices, ctx.ts('pDevs'), { bare: p.devices.length < 6, empty: 'No device seen for this account yet', note: 'Tap a nickname to change it. Excluded: the device is one of mine, and it and every match with it in are left out of the numbers.' })}</div>
    <div class="card"><h2>Matches</h2>${matchTable(ctx, 'pMatches', p.matches, p.id)}</div>
    <div class="card"><h2>Sessions</h2>${T.html('pSes', sessionCols(ctx).filter(c => c.k !== 'who'), p.sessions.slice().reverse(), ctx.ts('pSes'))}</div>
    <div class="card"><h2>Mini-games played</h2>${T.html('pGames', gameCols, games, ctx.ts('pGames', { sort: { k: 'played', dir: -1 } }), { note: 'Squares in their finished matches. Won and lost where their side is known (not on a shared phone).' })}</div>${life}
    ${errs.length ? `<div class="card"><h2>Errors on their devices</h2>${T.html('pErrs', eventCols(ctx).filter(c => c.k !== 'who'), errs, ctx.ts('pErrs', { sort: { k: 't', dir: -1 } }))}</div>` : ''}`;
}

// ---------- Matches: the inspector; a row opens the match ----------
export function matches(ctx) {
  const lenCols = [C('mode', 'Mode', r => X.MODE_LABEL[r.mode] || r.mode), C('timer', 'Timer', r => (r.timer === 'none' ? '' : r.timer)), C('started', 'Started', r => r.started, { num: true, html: r => drillLink(ctx, `len:${r.mode}:${r.timer}`, `${X.MODE_LABEL[r.mode] || r.mode} ${r.timer === 'none' ? '' : r.timer}: matches`, 'matches', r.rows) }),
    C('finished', 'Finished', r => r.finished, { num: true, html: r => drillLink(ctx, `lenF:${r.mode}:${r.timer}`, `${X.MODE_LABEL[r.mode] || r.mode} ${r.timer === 'none' ? '' : r.timer}: finished`, 'matches', r.fin) }), C('abandoned', 'Abandoned', r => r.abandoned, { num: true, html: r => drillLink(ctx, `lenA:${r.mode}:${r.timer}`, `${X.MODE_LABEL[r.mode] || r.mode} ${r.timer === 'none' ? '' : r.timer}: abandoned`, 'matches', r.rows.filter(m => m.status === 'abandoned')) }), C('unfinished', 'Never finished', r => r.unfinished, { num: true, html: r => drillLink(ctx, `lenU:${r.mode}:${r.timer}`, `${X.MODE_LABEL[r.mode] || r.mode} ${r.timer === 'none' ? '' : r.timer}: never finished`, 'matches', r.rows.filter(m => m.status === 'unfinished')) }), C('completion', 'Completion', r => (r.completion == null ? null : Math.round(r.completion * 100)), { num: true, html: r => pct(r.completion), tip: X.tip('completion') }),
    C('t25', 'Turns 25%', r => r.turns.p25, { num: true }), C('t50', 'Turns median', r => r.turns.med, { num: true, tip: X.tip('turns') }), C('t75', 'Turns 75%', r => r.turns.p75, { num: true }),
    C('m50', 'Minutes median', r => (r.mins.med == null ? null : Math.round(r.mins.med * 10) / 10), { num: true, tip: X.tip('minutes') }), C('m75', 'Minutes 75%', r => (r.mins.p75 == null ? null : Math.round(r.mins.p75 * 10) / 10), { num: true })];
  return `${filterBar(ctx)}${kpis(ctx, ['started', 'finished', 'abandoned', 'unfinished', 'completion', 'turns', 'minutes', 'firstPlayer'])}
    <div class="card"><h2>Matches started per day</h2>${matchChart(ctx)}</div>
    <div class="card"><h2>Length and completion, by mode and timer</h2>${T.html('len', lenCols, X.lengthRows(ctx.S), ctx.ts('len', { sort: { k: 'started', dir: -1 } }))}</div>
    <div class="card"><h2>Every match</h2>${matchTable(ctx, 'matches', ctx.S.matches(), null, { note: 'Tap a row for the match: its players, its squares and its event log (online matches, and any match a player reported; logs are kept 30 days).' })}</div>`;
}
export function match(ctx, id) {
  const m = ctx.S.M.matches.find(x => x.id === id);
  if (!m) return `<div class="card"><h2>No such match</h2><p class="note">It may be older than 90 days.</p><a class="btn" href="#matches">‹ Matches</a></div>`;
  const sqCols = squareCols(ctx).filter(c => !['mode', 't0'].includes(c.k)), log = ctx.logs[m.logKey];
  const fields = e => Object.entries(e).filter(([k]) => !['t', 'k'].includes(k)).map(([k, v]) => `${esc(k)}=${esc(typeof v === 'object' ? JSON.stringify(v) : v)}`).join(' ');
  const t0 = Array.isArray(log) && log.length ? log[0].t : 0, rel = t => { const s = Math.round((t - t0) / 1000); return `+${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const tl = log === undefined ? '<p class="note">Loading its log…</p>' : log === 'error' ? '<p class="note">Could not load its log.</p>' : !log.length ? '<p class="note">No event log for this match (logs are kept for online matches and for matches a player reported, 30 days).</p>'
    : `<ul class="mltl">${log.map(e => `<li>${esc(when(e.t))} <span class="dim">${rel(e.t)}</span> <span class="k ${esc(e.k)}">${esc(e.k)}</span> ${fields(e)}</li>`).join('')}</ul>`;
  return `<div class="card"><div class="row"><h2>${esc(X.MODE_LABEL[m.mode] || m.mode)} · ${esc(when(m.t0))}</h2>${m.own ? '<span class="badge own">mine</span>' : ''}</div>
      <dl class="facts"><dt>Players</dt><dd>${m.who.map(w => `${w.s ? w.s + ' ' : ''}${w.bot ? 'Computer' : personLink(ctx, w.pid, w.h ? 'Guest ' + w.h.slice(0, 8) : 'Guest')}${w.pl ? ` <span class="dim">${esc(w.pl)}${w.cv ? ' ' + esc(w.cv) : ''}</span>` : ''}`).join(' · ')}</dd>
      <dt>Status</dt><dd>${statusText(m)}${m.end ? ` · ${esc(X.END_LABEL[m.end] || m.end)}` : ''}${m.w ? ` · ${m.w} won` : m.status === 'finished' ? ' · draw' : ''}</dd><dt>Timer</dt><dd>${m.timer === 'none' ? 'None' : esc(m.timer)}</dd>
      <dt>Length</dt><dd>${m.t1 ? `${m.turns} turns${m.ms != null ? ' · ' + dur(m.ms) : ''}` : '–'}</dd>${m.room ? `<dt>Room</dt><dd>${esc(m.room)}</dd>` : ''}<dt>Match ID</dt><dd><code>${esc(m.id)}</code></dd>
      ${m.log && m.log.reported ? `<dt>Reported</dt><dd class="mid-left">${esc(when(m.log.reported))}${m.log.note ? ': ' + esc(m.log.note) : ''}</dd>` : ''}</dl></div>
    <div class="card"><h2>Squares</h2>${T.html('mSq', sqCols, m.sq.map(e => Object.assign({ m }, e)), ctx.ts('mSq'), { bare: true, empty: m.t1 ? 'No square was played' : 'Known once the match ends' })}</div>
    <div class="card" id="mlTimeline"><div class="row"><h2>Event log</h2>${Array.isArray(log) && log.length ? `<button class="btn sm" data-mlexport="${esc(m.logKey)}">Export JSON</button>` : ''}</div>${tl}</div>`;
}

// ---------- Games: every game side by side; a game's own numbers by settings version ----------
const q3 = q => (q.med == null ? '–' : `${num(q.p25, 0)} / <b>${num(q.med, 0)}</b> / ${num(q.p75, 0)}`);
const flagsHtml = s => s.flags.map(f => `<span class="bflag ${f}" title="${f === 'slow' ? `Median winner's moves above ${X.FLAG_MOVES}` : `Fewer than ${X.FLAG_SAMPLE} completed squares: too few to judge`}">${f === 'slow' ? 'slow' : 'small sample'}</span>`).join(' ');
// The games' quality (December 2026, for the rotation): every number counted from the match rows (metrics.js gameQuality), under
// every filter, the opponent type and the board position included; sortable, filterable, CSV like every table.
const pctC = v => (v == null ? null : Math.round(v * 100));
export function gamesQuality(ctx) {
  const rows = X.gameQuality(ctx.S).filter(r => ctx.names[r.t]).map(r => Object.assign(r, { name: ctx.names[r.t], rel: ctx.released(r.t) }));
  const P = (k, label, get, tip, of) => C(k, label, r => pctC(get(r)), { num: true, tip, html: of ? r => (get(r) == null ? '–' : `${pctC(get(r))}% <span class="dim">of ${of(r)}</span>`) : undefined });
  const cols = [C('name', 'Mini-game', r => r.name, { html: r => `<a href="#games/${esc(r.t)}">${esc(r.name)}</a>` }), C('rel', 'Status', r => (r.rel ? 'Released' : 'Admin only')),
    C('plays', 'Plays', r => r.plays, { num: true, tip: 'Every play of it: each time it was dealt into a square and played, finished or not', html: r => drillLink(ctx, 'q:' + r.t, `${r.name}: plays`, 'squares', r.rows, r.plays) }),
    P('ex', 'Excluded %', r => r.exclusion, 'Of the setups that offered it (its checklist), the ones that left it out. The board position does not apply.', r => r.exOf),
    P('pr', 'Played %', r => r.playRate, 'Of the matches it was dealt into (at the start or after a draw), the ones where someone played it', r => r.boardOf),
    P('nv', 'Never played %', r => r.neverRate, 'Of the matches it was dealt into, the ones where nobody ever played it'),
    P('un', 'Not finished %', r => r.unfinished, 'Of its plays, the ones begun and still open when the match ended (left, resigned, or the match won elsewhere)'),
    C('secs', 'Seconds (median)', r => (r.secs == null ? null : Math.round(r.secs)), { num: true, tip: 'A finished play\'s length, its first move to its end' }),
    C('turns', 'Turns (median)', r => r.turns, { num: true, tip: 'Both sides\' turns in a finished play' }),
    P('dr', 'Draw %', r => r.drawRate, 'Of its finished plays, the ones drawn (the square dealt again)'),
    P('fm', 'First mover wins %', r => r.firstMover, 'Of its won plays, the ones won by the side that moved first in it', r => r.fmOf),
    P('hw', 'Human beats AI %', r => r.humanWin, 'Of its won plays against the computer (vs Computer, Find Match\'s bot), the ones the person won', r => r.humanOf),
    C('pick', 'Avg pick order', r => (r.pick == null ? null : Math.round(r.pick * 10) / 10), { num: true, tip: 'When its plays began: 1 is the match\'s first square played' }),
    C('help', 'Help taps / play', r => (r.help == null ? null : Math.round(r.help * 100) / 100), { num: true, tip: 'The "?" tapped inside the square, a play' }),
    P('re', 'Rematch %', r => r.rematch, 'Of the finished matches it was played in, the ones followed by a rematch', r => r.remOf)];
  return `<div class="card" id="qualityCard"><h2>Game quality</h2>${T.html('quality', cols, rows, ctx.ts('quality', { sort: { k: 'plays', dir: -1 }, open: true }), { note: 'Each game across every match in the filters, finished or not; the Opponent and Board position filters apply here. Counted from the match rows from December 2026 on: older matches carry no setup or square positions.' })}</div>`;
}
export function gamesCompare(ctx) {
  const rows = Object.keys(ctx.names).map(t => Object.assign({ t, name: ctx.names[t], rel: ctx.released(t) }, X.gameStats(ctx.S, t, ctx.versions)));
  const cols = [C('name', 'Mini-game', r => r.name, { html: r => `<a href="#games/${esc(r.t)}">${esc(r.name)}</a>` }), C('rel', 'Status', r => (r.rel ? 'Released' : 'Admin only')), C('ver', 'Version', r => r.current, { num: true, html: r => `v${r.current}${r.version != null && r.version !== r.current ? ` <span class="dim">(showing v${r.version})</span>` : ''}` }),
    C('n', 'Completed squares', r => r.n, { num: true, tip: X.tip('squares'), html: r => drillLink(ctx, 'sq:' + r.t, `${r.name}: squares`, 'squares', r.rows, r.n) }),
    C('p25', 'Moves 25%', r => r.moves.p25, { num: true }), C('med', 'Moves median', r => r.moves.med, { num: true, tip: X.tip('moves') }), C('p75', 'Moves 75%', r => r.moves.p75, { num: true }),
    C('secs', 'Seconds median', r => (r.secs.med == null ? null : Math.round(r.secs.med)), { num: true, tip: X.tip('secs') }), C('reset', 'Reset %', r => (r.resetRate == null ? null : Math.round(r.resetRate * 100)), { num: true, tip: X.tip('resets') }),
    C('open', 'Left open %', r => (r.openRate == null ? null : Math.round(r.openRate * 100)), { num: true, tip: X.tip('open') }), C('fm', 'First mover wins %', r => (r.firstMover == null ? null : Math.round(r.firstMover * 100)), { num: true, tip: X.tip('firstMover') }),
    C('flags', 'Flags', r => (r.n ? r.flags.join(' ') : ''), { html: r => (r.n ? flagsHtml(r) : '') })];
  return `<div class="card" id="compareCard"><h2>Compare the games</h2>${T.html('compare', cols, rows, ctx.ts('compare', { sort: { k: 'n', dir: -1 }, filt: { rel: 'Released' }, open: true }), { note: 'Each game\'s squares in finished matches, for the settings version picked in the filters. The Status filter starts on Released: clear it for every game. Tap a game for its settings and its numbers by version.' })}</div>`;
}
export function gameStats(ctx, t) {
  const g = X.gameStats(ctx.S, t, ctx.versions), name = ctx.names[t] || t;
  const big = (lab, tipKey, v, sub) => `<div class="card kpi"><small>${lab} ${tipKey ? tipIcon(tipKey) : ''}</small><b class="big">${v}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
  const vCols = [C('v', 'Version', r => r.v, { num: true, html: r => `v${r.v}${r.current ? ' <span class="badge rel">current</span>' : ''}` }), C('n', 'Completed squares', r => r.n, { num: true, html: r => drillLink(ctx, `sq:${t}:v${r.v}`, `${name} v${r.v}: squares`, 'squares', r.rows, r.n) }),
    C('p25', 'Moves 25%', r => r.moves.p25, { num: true }), C('med', 'Moves median', r => r.moves.med, { num: true }), C('p75', 'Moves 75%', r => r.moves.p75, { num: true }), C('s25', 'Seconds 25%', r => (r.secs.p25 == null ? null : Math.round(r.secs.p25)), { num: true }),
    C('s50', 'Seconds median', r => (r.secs.med == null ? null : Math.round(r.secs.med)), { num: true }), C('s75', 'Seconds 75%', r => (r.secs.p75 == null ? null : Math.round(r.secs.p75)), { num: true }), C('reset', 'Reset %', r => (r.resetRate == null ? null : Math.round(r.resetRate * 100)), { num: true }),
    C('open', 'Left open %', r => (r.openRate == null ? null : Math.round(r.openRate * 100)), { num: true }), C('fm', 'First mover wins %', r => (r.firstMover == null ? null : Math.round(r.firstMover * 100)), { num: true }), C('flags', 'Flags', r => r.flags.join(' '), { html: flagsHtml })];
  return `<div class="card" id="gameStats"><h2>${esc(name)}: how it plays</h2>${filterBar(ctx, { version: true })}
    <div class="kpis">${big('Completed squares', 'squares', drillLink(ctx, 'sq:' + t, `${name}: squares`, 'squares', g.rows, g.n), g.version == null ? 'all versions' : 'version ' + g.version)}${big('Winner\'s moves', 'moves', q3(g.moves), '25% / median / 75%')}${big('Seconds in the square', 'secs', q3(g.secs), '25% / median / 75%')}
      ${big('Reset', 'resets', pct(g.resetRate), `${g.draw} of ${g.played}`)}${big('Left open', 'open', pct(g.openRate), `${g.open} of ${g.played}`)}${big('First mover wins', 'firstMover', pct(g.firstMover), `of ${g.firstMoverOf}`)}</div>
    ${g.n ? `<p class="note">${flagsHtml(g)}</p>` : ''}
    <h3>By settings version</h3>${T.html('gver', vCols, g.byVersion, ctx.ts('gver'), { bare: true, note: 'Every Save of this page\'s settings starts a new version; squares are filed under the version they were dealt with. The same numbers as the comparison table on Games.' })}</div>`;
}

// ---------- Growth: where players come from, the first run, coming back, inviting ----------
export function growth(ctx) {
  const S = ctx.S, cell = (n, of) => (n == null ? '<span class="dim">not yet</span>' : `${n}${of ? ` <small class="dim">${pct(n / of)}</small>` : ''}`);
  const coCols = [C('day', 'First seen', r => r.day), C('n', 'New players', r => r.n, { num: true, html: r => drillLink(ctx, 'co:' + r.day, `First seen ${r.day}`, 'people', r.people) })]
    .concat([['tap', 'First tap', 'fTap'], ['move', 'First move', 'fMove'], ['claim', 'First claim', 'fClaim'], ['finished', 'Finished a match', 'fFinished'], ['second', 'Second match', 'fSecond']].map(([k, l, d]) => C(k, l, r => r[k], { num: true, html: r => cell(r[k], r.n), tip: X.tip(d) })))
    .concat(X.RETAIN.map(k => C('d' + k, 'D' + k, r => r['d' + k], { num: true, html: r => cell(r['d' + k], r.n), tip: X.tip('d' + k) })));
  const srcCols = [C('tag', 'Source', r => r.tag), C('people', 'New players', r => r.people.length, { num: true, html: r => drillLink(ctx, 'src:' + r.tag, `Source ${r.tag}: new players`, 'people', r.people) }),
    C('signups', 'New accounts', r => r.signups.length, { num: true, html: r => drillLink(ctx, 'srcA:' + r.tag, `Source ${r.tag}: new accounts`, 'people', r.signups) })];
  return `${filterBar(ctx)}${kpis(ctx, ['newPlayers', 'newAccounts', 'd1', 'd7', 'd30', 'w1'])}
    <div class="grid2"><div class="card"><h2>First run</h2>${funnel(ctx, ['fOpened', 'fTap', 'fMove', 'fClaim', 'fFinished', 'fSecond'])}<p class="note">The people first seen in the range, and how many of them reached each step at least once.</p></div>
      <div class="card"><h2>Invites</h2>${funnel(ctx, ['invitesSent', 'inviteOpens', 'inviteJoins', 'inviteDone'])}${kpis(ctx, ['rematches', 'shares'])}</div>
      <div class="card" id="askCard"><h2>Create an account</h2>${funnel(ctx, ['askShown', 'askTap', 'askMade'])}${kpis(ctx, ['askConv', 'askNo', 'madeOther'])}<p class="note">The prompt guests see on a result screen, and the accounts made after a tap on it.</p></div></div>
    <div class="card"><h2>Sources</h2>${T.html('sources', srcCols, X.sourceRows(S), ctx.ts('sources', { sort: { k: 'people', dir: -1 } }), { note: 'A link with ?t=name (tictacchaos.com/?t=reddit) tags whoever first opens the game with it. (none): no tag.' })}</div>
    <div class="card"><h2>By the day they were first seen</h2>${T.html('cohorts', coCols, X.cohortRows(S), ctx.ts('cohorts', { sort: { k: 'day', dir: -1 } }), { note: 'First-run steps and retention for each day\'s new players. D1, D7, D30: used the game again exactly that many days later; "not yet" until the day has come.' })}</div>`;
}

// ---------- Health: errors, players' reports, alerts, Find Match waits ----------
export function health(ctx) {
  const S = ctx.S, bCols = [C('build', 'Build', r => r.build), C('opens', 'Opens', r => r.opens, { num: true, html: r => drillLink(ctx, 'bo:' + r.build, `Build ${r.build}: opens`, 'events', r.openRows) }), C('errors', 'Errors', r => r.errors, { num: true, html: r => drillLink(ctx, 'be:' + r.build, `Build ${r.build}: errors`, 'events', r.errorRows) }), C('rate', 'Errors per 100 opens', r => (r.rate == null ? null : Math.round(r.rate * 10) / 10), { num: true, tip: X.tip('errorRate') })];
  const cCols = [C('platform', 'Platform', r => (r.platform === 'ios' ? 'iOS app' : 'Web')), C('version', 'Client version', r => r.version), C('opens', 'Opens', r => r.opens, { num: true, html: r => drillLink(ctx, `cl:${r.platform}:${r.version}`, `${r.platform === 'ios' ? 'iOS app' : 'Web'} ${r.version}: opens`, 'events', r.rows) })];
  const bots = S.matches().filter(m => m.mode === 'bot' && m.status === 'finished'), botSide = m => (m.who.find(w => w.bot) || {}).s, pw = bots.filter(m => m.w && m.w !== botSide(m)), bw = bots.filter(m => m.w && m.w === botSide(m));
  const out = v => (!v || v === 'off' ? '' : v);
  const aCols = [tm('at', 'When', a => a.at), C('what', 'Alert', a => (a.test ? 'Test' : a.ops ? String(a.ops).replace(/-.*/, '') : 'Searching alone')), C('who', 'Player', a => a.username || ''), C('sms', 'Text', a => out(a.channels && a.channels.sms)), C('email', 'Email', a => out(a.channels && a.channels.email))];
  return `${filterBar(ctx)}${kpis(ctx, ['opens', 'errors', 'errorRate', 'reports'])}
    <div class="grid2"><div class="card"><h2>Errors per day</h2>${chart(S.days, [{ name: 'Errors', values: X.eventsByDay(S, 'error'), color: 'var(--x)' }], 'Errors per day')}</div>
      <div class="card"><h2>By build</h2>${T.html('builds', bCols, X.buildRows(S), ctx.ts('builds'), { bare: true })}<h3>Platforms and client versions</h3>${T.html('clients', cCols, X.clientRows(S), ctx.ts('clients'), { bare: true })}</div></div>
    <div class="card"><h2>Errors</h2>${rowsTable(ctx, 'errors', 'events', S.events('error'), { note: 'Every uncaught error and rejected promise on a phone (each distinct one once a visit), and the game\'s own error logs.' })}</div>
    <div class="card"><h2>Problem reports</h2>${rowsTable(ctx, 'reports', 'reports', S.reports(), { note: '"Report a problem" from the in-game menu or Settings. Each is also emailed (Settings: Alerts). Kept 90 days.' })}</div>
    <div class="card"><h2>Find Match</h2>${kpis(ctx, ['findPeople', 'findBot', 'findCancel', 'findFill', 'findWait'])}
      <div class="kpis"><div class="card kpi"><small>Matches against the computer, finished</small><b class="big">${drillLink(ctx, 'bots', 'Find Match against the computer: finished', 'matches', bots)}</b><span>players won ${pw.length} · computer won ${bw.length} · draws ${bots.length - pw.length - bw.length}</span></div></div>
      ${rowsTable(ctx, 'finds', 'finds', S.finds(), { title: 'Searches' })}</div>
    <div class="card"><h2>Alerts sent</h2>${T.html('alerts', aCols, ctx.alertLog || [], ctx.ts('alerts', { sort: { k: 'at', dir: -1 } }), { note: `Texts and emails to me: someone searching alone, a problem report, the new-device cap. Sent ${(ctx.alertStats || {}).sent || 0} · held back by the limits ${(ctx.alertStats || {}).held || 0}. This table does not follow the filters.` })}</div>`;
}

// ---------- the rows behind a number ----------
export function drill(ctx, key) {
  let title, tipText = '', kind, rows, value = '';
  if (key.startsWith('x:')) { const d = ctx.drills.get(decodeURIComponent(key.slice(2))); if (!d) return `<div class="card"><h2>These rows are gone</h2><p class="note">Go back and tap the number again.</p><a class="btn" href="#overview">‹ Overview</a></div>`; ({ title, kind, rows } = d); }
  else if (X.METRIC_IDS.includes(key)) { const m = X.metric(ctx.S, key); title = X.label(key); tipText = X.tip(key); kind = m.kind; rows = m.rows; value = show(m) + (m.of != null ? ` (${m.n} of ${m.of})` : ''); }
  else return `<div class="card"><h2>No such number</h2><a class="btn" href="#overview">‹ Overview</a></div>`;
  return `${key.startsWith('x:') ? '' : filterBar(ctx)}<div class="card"><div class="row"><h2>${esc(title)}${value ? `: ${value}` : ''}</h2></div>${tipText ? `<p class="note">${esc(tipText)}</p>` : ''}
    ${rowsTable(ctx, 'drill:' + key, kind, rows, { note: `The ${plural(rows.length, 'row')} this number counts.` })}</div>`;
}
