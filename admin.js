// The admin dashboard's script (admin.html loads it: a file of its own, so the page's Content-Security-Policy needs no inline script).
'use strict';
const FIREBASE_VERSION = '11.10.0';
const FIREBASE_CONFIG = window.TTC_ENV.config;   // production or staging, by the page's address (src/env.js)
const STAGING = window.TTC_ENV.staging;
const MODES = [['local', 'Two players'], ['cpu', 'vs Computer'], ['chaos', 'Super Chaos'], ['cvc', 'Computer vs Computer (old)'], ['friend', 'Friend code'], ['match', 'Find Match'], ['bot', 'Find Match vs a bot'], ['casual', 'Casual (old)'], ['ranked', 'Ranked (old)']];
const MODE_COLORS = { local: 'var(--o)', cpu: 'var(--sky)', chaos: '#d9622b', cvc: 'var(--stone)', friend: 'var(--plum)', match: 'var(--green)', bot: '#2f7f6f', casual: '#8fbf7a', ranked: 'var(--x)' };
const GAMES = { ttt: 'Tic-tac-toe', c4: 'Four in a Row', bs: 'Sea Battle', wordle: 'Five Letters', hangman: 'Hangman', hex: 'Hex', hilo: 'Higher/Lower', snakes: 'Snakes and Ladders', memory: 'Find the Pair', candy: 'Candy Race', bump: 'Bump', coins: 'Coin Flip', pig: 'Risky Rolls', hunt: 'Treasure Hunt', mastermind: 'Codebreaker', bj: '21', bus: 'Ride the Bus', rl: 'Little Wheel', bullseye: 'Bullseye', echo: 'Echo', plinko: 'Peg Drop', pong: 'Cup Pong', trivia: 'Trivia', oddone: 'Odd One Out', dash: 'Dash', lane: 'Lane Rush', golf: 'Mini Golf', pool: 'Pool', bowling: 'Bowling', craps: 'Krabs', takeover: 'Takeover', flood: 'Flood', seating: 'Seating', districts: 'Districts', shelves: 'Shelves', roads: 'Roads', flap: 'Flap', chopper: 'Chopper', patterns: 'Patterns', wheels: 'Risky Spins', apple: 'Apple Pick', sniff: 'Sniff', clash: 'Standoff Grid', headcount: 'Headcount', flash: 'Flash', snapshot: 'Snapshot', shell: 'Shell Game', skyhop: 'Sky Hop', scoop: 'Scoop Stack', pinball: 'Pinball', muncher: 'Muncher', swarm: 'Star Swarm', bricks: 'Brick Break', snake: 'Snake', dominoes: 'Dominoes', war: 'War', shut: 'Shut the Box', combo: 'Dice Combo', bglite: 'Backgammon Lite', scc: 'Ship, Captain & Crew', rps: 'Rock Paper Scissors', poker: 'Poker Hands', t31: 'Thirty-One', rummy: 'Rummy Lite', claw: 'Claw Machine', duck: 'Hook-a-Duck', pusher: 'Coin Pusher', wtiles: 'Word Tiles', scratch: 'Scratch & Match', bingo: 'Bingo', piggy: 'Pig', bridge: 'Glass Bridge', reels: 'Fruit Reels', homer: 'Home Run Heroes', maze: 'Maze Runner', split: 'Shape Split', faces: 'Mystery Face', mahjong: 'Mahjong', pegs: 'Peg Jump Race', twist: 'Twist Four', mancala: 'Mancala Race', walls: 'Wall Race', target: 'Target Practice', heads: 'Heads or Tails', proll: 'Point Roll', marble: 'Marble Toss', shuffle: 'Shuffleboard', toss: 'Bin Shot', cricket: 'Darts Cricket', slice: 'Fruit Slice', rhythm: 'Rhythm Tap', rally: 'Road Race', blocks: 'Block Drop', numbers: 'Number Shuffle', trail: 'Trail Race', keydrop: 'Key Drop', pint: 'Split It', gems: 'Gem Swap', castle: 'Castle Smash', tanks: 'Tank Duel', jigsaw: 'Puzzle Build', hive: 'Letter Hive', barrel: 'Barrel Launch', doors: 'Door Drop' };   // the games in the pool (Hexapawn and the Dice race are gone; their numbers stay in the database)
const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let BAL = null;                                                            // src/admin/balance.js: a game's version card (its saves)
let P = null, PS = null;                                                   // src/admin/pages.js (the pages, the metrics layer P.X, the table P.T); src/ui/pstats.js (an account's own record)
let fb = null, user = null, flagged = null, view = { status: 'loading', error: '' };
let ctl = { config: {}, secretsSet: {}, bots: {}, botStats: {}, alertLog: [], alertStats: {} }, testResult = null, keyMsg = '';
// The defaults the server uses for anything not set (functions/bots.js).
const DEF = { bots: { enabled: false, waitMin: 40, waitMax: 70, countInRecords: true, level: 'normal' }, alerts: { enabled: false, sms: false, email: true, phone: '', to: '', after: 5, cooldownMin: 30, gapMin: 3, dailyCap: 20 } };
const cfgGet = (sec, k) => { const v = ((ctl.config || {})[sec] || {})[k]; return v === undefined || v === null || v === '' ? DEF[sec][k] : v; };
// ---------- the dashboard's data and its one set of filters (December 2026) ----------
// Everything the pages count is read once as rows (raw: matches mfacts/, Find Match searches finds/, devices/ and devlog/,
// users/, reports/, the match logs' index) and joined into the model (src/admin/metrics.js build); a page asks its numbers
// of the model under the filters (scope). The filters are the same on every page and kept in this browser.
let raw = null, model = null, accts = null, templates = null;
let devmeta = {}, ownerToken = null, devEdit = null, devMsg = '';
let mlEvents = {};                                                          // the match logs read so far (matchLogs/{key})
const FILTER_KEY = 'ttc.admin.filters';
let filters = (() => { try { return JSON.parse(localStorage.getItem(FILTER_KEY) || '{}') || {}; } catch (e) { return {}; } })();
const tstates = new Map(), drills = new Map();                             // each table's state (sort, search, filters); the row sets a number's link opens
let scopeNow = null;                                                        // the model under the filters, kept until either changes
function rebuild() { model = P && raw ? P.X.build(raw, Date.now()) : null; scopeNow = null; }
function scopeOf() { if (!scopeNow && model) { filters = P.X.normFilters(filters); scopeNow = P.X.scope(model, filters); } return scopeNow; }
function setFilter(k, v) {
  filters = P.X.normFilters(Object.assign({}, filters, { [k]: v }));
  try { localStorage.setItem(FILTER_KEY, JSON.stringify(filters)); } catch (e) { /* this visit only */ }
  scopeNow = null; render();
}
const tstate = (id, def) => { if (!tstates.has(id)) tstates.set(id, P.T.newState(def)); return tstates.get(id); };
const ctxOf = () => ({ S: scopeOf(), names: GAMES, released: isReleased, versions: ctl.versions || {}, ts: tstate, drills, logs: mlEvents, devEdit, devMsg, PS, accounts: accts, alertLog: ctl.alertLog || [], alertStats: ctl.alertStats || {} });
const META_KEY = /^[0-9a-f]{6,20}$/;
const metaKey = v => { const k = String(v == null ? '' : v).trim().toLowerCase().replace(/[^0-9a-f]/g, ''); return META_KEY.test(k) ? k : null; };

// ---------- small helpers ----------
const n = v => (Number.isFinite(v) ? v : 0);
const ratio = (a, b) => (b ? a / b : null);
const pct = v => (v == null ? '–' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '–' : (Math.round(v * 10 ** d) / 10 ** d).toLocaleString());
const pad = x => String(x).padStart(2, '0');

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
  if (!P || !model) { app.innerHTML = '<div class="card msg"><h1>Tic Tac Chaos Admin</h1><p>Loading…</p></div>'; if (!P) loadMetas().then(() => { rebuild(); render(); }).catch(() => {}); return; }
  const [where, sub] = route(), ctx = ctxOf();
  const game = where === 'games' && sub && GAMES[sub];
  const pages = {
    overview: () => P.overview(ctx),
    players: () => (sub ? P.profile(ctx, decodeURIComponent(sub)) : P.players(ctx) + flaggedCard()),
    matches: () => (sub ? P.match(ctx, decodeURIComponent(sub)) : P.matches(ctx)),
    games: () => (game ? gamePage(sub) + P.gameStats(ctx, sub) : P.filterBar(ctx, { version: true, quality: true }) + P.gamesQuality(ctx) + P.gamesCompare(ctx) + gamesIndex()),
    growth: () => P.growth(ctx),
    health: () => P.health(ctx),
    settings: () => settingsPage(),
    drill: () => P.drill(ctx, location.hash.replace(/^#\/?drill\//, '')),
  };
  const title = game ? `${gameIcon(sub)}${esc(GAMES[sub])}` : where === 'players' && sub ? 'Player' : where === 'matches' && sub ? 'Match' : where === 'drill' ? 'The rows behind a number' : (NAV.find(x => x[0] === where) || NAV[0])[1];
  const back = game ? ['#games', 'Games'] : where === 'players' && sub ? ['#players', 'Players'] : where === 'matches' && sub ? ['#matches', 'Matches'] : where === 'drill' ? ['back', 'Back'] : null;
  const nav = `<nav class="nav" aria-label="Sections">${NAV.map(([k, l]) => `<a href="#${k}"${k === where ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  app.innerHTML = `<div class="top"><h1>Tic Tac Chaos Admin${STAGING ? ' <span class="badge adm">staging</span>' : ''}</h1><span class="sp"></span><span class="who">${esc(user.email || 'admin')}</span><button class="btn sm" data-act="refresh">Refresh</button><button class="btn sm" data-act="signout">Sign out</button></div>${nav}
    <div class="sechead">${back ? (back[0] === 'back' ? '<button class="btn back" data-act="goback">‹ Back</button>' : `<a class="btn back" href="${back[0]}" aria-label="Back to ${back[1]}">‹ ${back[1]}</a>`) : ''}<h2>${title}</h2></div>${(pages[where] || pages.overview)()}`;
  if (where === 'matches' && sub) { const m = model.matches.find(x => x.id === decodeURIComponent(sub)); if (m && mlEvents[m.logKey] === undefined) mlLoad(m.logKey); }
}
// ---------- the sections (December 2026): one bar on every page; a game's page is #games/<type>, a person #players/<id>,
// a match #matches/<id>, the rows behind a number #drill/<metric> ----------
const NAV = [['overview', 'Overview'], ['players', 'Players'], ['matches', 'Matches'], ['games', 'Games'], ['growth', 'Growth'], ['health', 'Health'], ['settings', 'Settings']];
// The pages from before (bookmarks): each opens where its content went.
const ALIAS = { playtest: 'players', devices: 'settings', stats: 'games', balance: 'games', bots: 'settings', access: 'settings', releases: 'games' };
function route() {
  const parts = (location.hash || '').replace(/^#\/?/, '').split('/');
  let to = null;
  if (!parts[0]) parts[0] = 'overview';
  if (ALIAS[parts[0]]) to = [ALIAS[parts[0]]];
  else if (parts[0] === 'settings' && parts[1] && GAMES[parts[1]]) to = ['games', parts[1]];   // (a game's old settings page)
  if (to) { parts.length = 0; parts.push(...to); const h = '#' + to.join('/'); try { history.replaceState(null, '', h); } catch (e) { /* (drawn as the new page anyway) */ } }
  if (!NAV.some(x => x[0] === parts[0]) && parts[0] !== 'drill') parts[0] = 'overview';
  return parts;
}
// Settings: everything that is not one game's (moved here from the Games list and the old Bot Settings, Staging Access and
// Devices pages): the pace, Super Chaos and the platforms' minimum versions, the timer, Find Match and its bots, the
// computer's levels, the alerts, staging's access, my game templates, my devices.
function settingsPage() {
  const jump = [['animCard', 'Pace'], ['clientsCard', 'Platforms'], ['timerCard', 'Timer'], ['findCard', 'Find Match'], ['botsCard', 'Bots'], ['aiCard', 'Computer difficulty'], ['alertsCard', 'Alerts']].concat(STAGING ? [['accessCard', 'Staging access']] : [], [['templatesCard', 'Templates'], ['ownerCard', 'My devices']]);
  return `<nav class="jump" aria-label="On this page">${jump.map(([id, l]) => `<a href="#settings" data-jump="${id}">${l}</a>`).join('')}</nav>
    ${animCard()}${platformsCard()}${timerCard()}${findCard()}${botsCard()}${aiCard()}${alertsCard()}${STAGING ? accessCard() : ''}${templatesCard()}${ownerCard()}`;
}
// My game templates (templates/{uid}: made and used on the game's own setup screens): listed here, each can be deleted.
function templatesCard() {
  const list = Object.entries(templates || {}).map(([id, t]) => ({ id, name: (t && t.name) || '', games: Object.keys((t && t.games) || {}).filter(g => GAMES[g]) })).sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="card ctl" id="templatesCard"><h2>Game templates</h2>
    <p class="note">Your sets of mini-games. Make, rename and update them in the game itself: the Mini-games sheet on Play Computer, a friend room or Same phone.</p>
    ${list.length ? `<div class="tbl"><table><thead><tr><th>Template</th><th>Games</th><th style="text-align:left">Mini-games</th><th></th></tr></thead><tbody>${list.map(t => `<tr><td>${esc(t.name)}</td><td>${t.games.length}</td><td style="text-align:left;white-space:normal">${esc(t.games.map(g => GAMES[g]).sort().join(', '))}</td><td><button class="btn sm" data-tpldel="${esc(t.id)}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="dim">No templates yet.</p>'}</div>`;
}
async function tplDelete(b) {
  if (!confirm('Delete this template?')) return;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, `templates/${user.uid}/${b.dataset.tpldel}`), null); if (templates) delete templates[b.dataset.tpldel]; } catch (e) { /* (kept) */ }
  render();
}
// The Games list keeps its place (November 2026): leaving it for a game's page remembers the scroll position and the game opened,
// and coming back (the page's Games link or the browser's Back) puts the list back where it was and flashes that game's row.
let gamesMemo = null;       // { y, t }: the list's scroll and the game last opened from it
let lastHash = location.hash;
const onGamesList = h => /^#games\/?$/.test(h);
window.addEventListener('hashchange', e => {
  if (view.status !== 'ready') { lastHash = location.hash; return; }
  const from = lastHash, to = location.hash;
  lastHash = to;
  if (onGamesList(from)) {                                  // leaving the list: its scroll stays, with the game opened (the hash's)
    const m = /^#games\/([\w-]+)/.exec(to);
    if (m) gamesMemo = { y: gamesMemo && gamesMemo.live != null ? gamesMemo.live : window.scrollY, t: m[1] };
  }
  const game = /^#games\/([\w-]+)/.exec(from), back = onGamesList(to);
  render();
  if (back && gamesMemo) {                                  // back at the list: where it was, the edited game lit up
    const { y, t } = gamesMemo, t2 = game ? game[1] : t;
    window.scrollTo(0, y);
    const row = app.querySelector(`.glist a[href="#games/${t2}"]`);
    if (row) { row.classList.add('glit'); setTimeout(() => row.classList.remove('glit'), 2200); }
  } else window.scrollTo(0, 0);
});
// The list's scroll as it is now (a tap on a row changes the hash before the page moves: this has the number from just before).
window.addEventListener('scroll', () => { if (onGamesList(location.hash)) gamesMemo = Object.assign(gamesMemo || {}, { live: window.scrollY }); }, { passive: true });

// ---------- a match's event log (matchLogs/{key}; functions/matchLogRules.js): read when its match is opened, and exported as JSON ----------
async function mlLoad(key) {
  if (mlEvents[key] && mlEvents[key] !== 'error') return;
  try { const v = (await fb.dbM.get(fb.dbM.ref(fb.db, `matchLogs/${key}`))).val() || {}; mlEvents[key] = Object.entries(v).map(([id, e]) => Object.assign({}, e, { id })).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)).map(e => { delete e.id; return e; }); }
  catch (e) { mlEvents[key] = 'error'; }
  render();
}
// "Export for analysis" (Matches, Why matches end early): every match in the filters as one row (src/admin/metrics.js
// abandonRows: its mode, status, how it ended, its quit facts, the games played and dealt; no names, accounts or devices),
// for scripts/abandon-report.js.
function abExport() {
  const rows = P.X.abandonRows(scopeOf()), blob = new Blob([JSON.stringify({ kind: 'ttc-abandon', exported: new Date().toISOString(), env: STAGING ? 'staging' : 'production', filters, rows }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `abandon-${STAGING ? 'staging' : 'production'}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function mlExport(key) {
  await mlLoad(key);
  const blob = new Blob([JSON.stringify({ key, exported: new Date().toISOString(), summary: ((raw || {}).logIndex || {})[key] || null, events: Array.isArray(mlEvents[key]) ? mlEvents[key] : [] }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `match-log-${key}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
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
// Open or Allowlist (config/staging/mode, read by the page as it starts, net/accounts.js, by the server within seconds,
// functions/index.js stagingOpen, and by staging's rules, scripts/staging-rules.js OPEN): Open lets anyone with the link play,
// logged in or not, as on production; Allowlist is the list below. The admin page and the admin's powers stay the admin's
// either way.
function accessCard() {
  const rows = Object.entries(ctl.allow || {}).map(([k, v]) => [k, (v && v.email) || k]).sort((a, b) => a[1].localeCompare(b[1]));
  const open = ctl.stagingMode === 'open';
  return `<div class="card ctl" id="modeCard"><h2>Staging access</h2>
    <div class="tabs seg" role="group" aria-label="Staging access"><button data-stmode="open" aria-pressed="${open}">Open</button><button data-stmode="allowlist" aria-pressed="${!open}">Allowlist</button></div>
    <p class="note">${open ? 'Open: anyone with the link can play staging, locally without logging in, and log in or sign up for online play. The list below is kept for switching back.' : 'Allowlist: only the accounts below (and you) get past the gate.'} New sessions follow a change at once; the admin page and Admin only games stay yours either way.</p></div>
    <div class="card ctl" id="accessCard"><h2>Who can use staging</h2>
    <p class="note">${open ? 'Used while access is Allowlist. ' : ''}Only these accounts can open staging.tictacchaos.com (and you, the admin). A new tester logs in with Google, or creates an account with this email and verifies it.</p>
    <ul class="rels">${rows.map(([k, e]) => `<li><span class="rn">${esc(e)}</span><button class="btn" data-allowdel="${esc(k)}">Remove</button></li>`).join('') || '<li><span class="rn">Nobody yet</span></li>'}</ul>
    <div class="tbar"><input id="allowAdd" type="email" placeholder="email@example.com" autocomplete="off" style="min-width:min(100%,260px)"><button class="btn" data-act="allowadd">Add</button></div></div>`;
}
async function setStagingMode(el, mode) {
  if (!['open', 'allowlist'].includes(mode) || ctl.stagingMode === mode) return;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/staging/mode'), mode); ctl.stagingMode = mode; }
  catch (e) { said(el, false, failed(e)); return; }
  render(); const c = document.getElementById('modeCard'); if (c) said(c.querySelector('.seg') || c, true, mode === 'open' ? 'Staging is open' : 'Staging is allowlist only');
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
const TEST_TYPES = ['barrel', 'doors', 'pint', 'gems', 'castle', 'tanks', 'jigsaw', 'hive', 'keydrop', 'trail', 'numbers', 'blocks', 'rally', 'rhythm', 'slice', 'cricket', 'toss', 'shuffle', 'marble', 'proll', 'heads', 'target', 'walls', 'mancala', 'twist', 'pegs', 'mahjong', 'faces', 'split', 'maze', 'homer', 'reels', 'bridge', 'piggy', 'shell', 'wtiles', 'claw', 'duck', 'pusher', 'poker', 't31', 'rummy', 'rps', 'shut', 'combo', 'bglite', 'scc', 'bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone', 'dash', 'lane', 'golf', 'pool', 'bowling', 'craps', 'takeover', 'flood', 'seating', 'districts', 'shelves', 'roads', 'flap', 'chopper', 'patterns', 'wheels', 'sniff', 'headcount', 'flash', 'snapshot', 'skyhop', 'scoop', 'pinball', 'clash', 'hex', 'apple', 'muncher', 'swarm', 'bricks', 'snake', 'dominoes', 'war', 'scratch', 'bingo'];   // (as engine.js has them; the switches cover every game the stats know)
const isReleased = t => (ctl.releases && typeof ctl.releases[t] === 'boolean' ? ctl.releases[t] : !TEST_TYPES.includes(t));
// Per platform (src/core/client.js): a released game can be switched off on iOS alone (releases/platform/ios/{type} false);
// on means as released. The web has no switch of its own: a game is off there by un-releasing it.
const iosOff = t => !!(ctl.releases && ctl.releases.platform && ctl.releases.platform.ios && ctl.releases.platform.ios[t] === false);
// A game's status (src/core/games.js gameStatus): Released, Testing (admin only) or Deprioritized (releases/depri/{type}
// true on a game not released: kept in the code, its page and stats here, but dealt to nobody, the admin included: off the
// admin's Mini-games checklists, templates, How to Play, Practice and the Game lineup). Releasing a game clears the flag.
const depriOf = t => !isReleased(t) && !!(ctl.releases && ctl.releases.depri && ctl.releases.depri[t] === true);
const statusOf = t => (isReleased(t) ? 'released' : depriOf(t) ? 'depri' : 'testing');
const STATUS = [['released', 'Released'], ['testing', 'Testing'], ['depri', 'Deprioritized']];
const STATUS_BADGE = { released: ['rel', 'Released'], testing: ['adm', 'Testing'], depri: ['dep', 'Deprioritized'] };
const soonRaw = t => (ctl.releases && ctl.releases.soon ? ctl.releases.soon[t] : undefined);
const SOON_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const soonSet = t => soonRaw(t) === true || (typeof soonRaw(t) === 'string' && SOON_RE.test(soonRaw(t)));
const soonDateOf = t => (typeof soonRaw(t) === 'string' && SOON_RE.test(soonRaw(t)) ? soonRaw(t) : '');   // the release date (a plain date, display only)
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const soonLate = t => soonShown(t) && !!soonDateOf(t) && soonDateOf(t) < todayLocal();   // its date has passed and it is still not released: players see "Coming soon"
const soonWhere = t => (depriOf(t) ? '' : !isReleased(t) ? 'web, iOS' : iosOff(t) ? 'iOS' : '');   // the platforms it may be coming soon on (never a deprioritized game)
const soonShown = t => soonSet(t) && !!soonWhere(t);
// Remove from rotation (src/core/games.js inRotation: releases/retire/all/{type} everywhere, releases/retire/ios/{type} on iOS
// alone, as release is): a plain day, New York's as the numbers are; from that day the game is dealt to no new match there
// (as if un-released: off everywhere, or off on iOS), while a match already dealt keeps it. Cleared: as before.
const RET_PLATS = [['all', 'Everywhere'], ['ios', 'iOS']];
const retRaw = (p, t) => { const r = ctl.releases && ctl.releases.retire && ctl.releases.retire[p]; const v = r ? r[t] : undefined; return typeof v === 'string' && SOON_RE.test(v) ? v : ''; };
const nyDayAdmin = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return todayLocal(); } };
const retGone = (p, t) => !!retRaw(p, t) && nyDayAdmin() >= retRaw(p, t);
const shortDay = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
const retBadges = t => RET_PLATS.map(([p, lab]) => retRaw(p, t) ? badge('ret', `${retGone(p, t) ? 'Retired' : 'Leaves ' + esc(shortDay(retRaw(p, t)))}${p === 'ios' ? ' on iOS' : ''}`) : '').join('');
function retireList() {
  const out = [], r = (ctl.releases && ctl.releases.retire) || {};
  for (const [p] of RET_PLATS) for (const t of Object.keys(r[p] || {})) if (retRaw(p, t) && GAMES[t]) out.push({ t, p, date: retRaw(p, t) });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : GAMES[a.t].localeCompare(GAMES[b.t])));
}
function retireCard() {
  const list = retireList();
  if (!list.length) return '';
  const row = x => `<tr><td><a href="#games/${x.t}">${esc(GAMES[x.t])}</a></td><td>${x.p === 'ios' ? 'iOS' : 'Everywhere'}</td><td>${esc(x.date)}</td><td>${retGone(x.p, x.t) ? badge('ret', 'Out of rotation') : badge('soon', 'Scheduled')}</td><td><button class="btn sm" data-retclear="${x.t}" data-p="${x.p}">Clear</button></td></tr>`;
  return `<div class="card" id="retireCard"><div class="row"><h2>Scheduled removals</h2><span class="note" style="margin:0">${list.length}</span></div>
    <div class="tw"><table class="tbl"><thead><tr><th>Game</th><th>Where</th><th>From (New York day)</th><th>Status</th><th></th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>
    <p class="note">From its day a game is dealt to no new match there (the Mini-games checklists, Find Match, friend rooms, the Game lineup); matches already under way keep it. Clear puts it back as its release switches say.</p></div>`;
}
// A game's release switches, at the top of its page (#games/<type>): the web's (Released or Admin only) and iOS's (on, or off for a released game).
function releaseCard(t) {
  const on = isReleased(t), ios = !iosOff(t), m = META[t] || {};
  const from = m.minVersion && m.minVersion !== '1.0.0' ? ` · <span class="mv">from client ${esc(m.minVersion)}</span>` : '';
  return `<div class="card ctl" id="relCard"><div class="row"><h2>Release</h2>
      <span class="relst" role="radiogroup" aria-label="Status">${STATUS.map(([k, lab]) => `<label class="stopt st-${k}"><input type="radio" name="relst" value="${k}" data-rel="${t}"${statusOf(t) === k ? ' checked' : ''}><b>${lab}</b></label>`).join('')}</span>
      <label class="sw ios"><input type="checkbox" data-relios="${t}"${ios ? ' checked' : ''}><span class="${ios ? 'good' : ''}">${ios ? 'iOS on' : 'iOS off'}</span></label>
      <label class="sw soon"><input type="checkbox" data-soon="${t}"${soonShown(t) ? ' checked' : ''}${soonWhere(t) ? '' : ' disabled'}><span class="${soonShown(t) ? 'good' : ''}">${soonShown(t) ? 'Coming soon' + (soonWhere(t) === 'iOS' ? ' on iOS' : '') : soonWhere(t) ? 'Not coming soon' : 'Coming soon: released'}</span></label>
      <label class="rf soondate"><span>Release date</span><input type="date" data-soondate="${t}" value="${esc(soonDateOf(t))}"${soonShown(t) ? '' : ' disabled'}></label></div>
    <div class="row retrow"><h3>Remove from rotation</h3>${RET_PLATS.map(([p, lab]) => `<label class="rf"><span>${lab}${retGone(p, t) ? ' (out)' : ''}</span><input type="date" data-retire="${p}" data-rt="${t}" value="${esc(retRaw(p, t))}"></label>${retRaw(p, t) ? `<button class="btn sm" data-retclear="${t}" data-p="${p}">Clear</button>` : ''}`).join('')}</div>
    ${soonLate(t) ? `<p class="note warn" id="soonLate">The release date (${esc(soonDateOf(t))}) has passed and the game is still not released${soonWhere(t) === 'iOS' ? ' on iOS' : ''}: players see "Coming soon". Release it, or set a new date.</p>` : ''}
    <p class="note">${esc(catName(t))} · ${esc((m.info && m.info.hint) || '')}${from}</p>
    <p class="note">A tap releases or un-releases at once, for new matches; matches under way are not affected. Admin only: the game exists for nobody but you (not in the Advanced checklist, How to Play, random draws, Find Match or anyone else's rooms); you play it in local matches and friend games you host, and your guest plays it in that match only. Find Match deals released games only, even for you; squares of admin-only games are counted under "Admin-only games (testing)" in the stats. iOS off keeps a released game out of the iOS app (its local matches, and any online match with an iOS player in it) while the web still has it: it only ever takes a released game away from iOS, never gives iOS one the web lacks.</p>
    <p class="note">Coming soon lists the game first in the main menu's Game lineup, on each platform where it is not released (never Released and Coming soon on one platform), with a sticker from its release date as each player's own day has it ("Out today!", "Coming tomorrow", "Coming Wednesday", "Coming Dec 3"; no date, or a date passed: "Coming soon"). The date is display only: releasing stays the switch above. Releasing it everywhere takes it off Coming soon.</p>
    <p class="note">Status: Released (everyone), Testing (admin only: you alone see and play it) or Deprioritized (kept in the code, its page and numbers here, but dealt to nobody, you included: off your Mini-games checklists and templates, How to Play, Practice and the Game lineup, Coming soon too). Releasing it clears Deprioritized; deprioritizing takes it off Coming soon.</p>
    <p class="note">Remove from rotation: from that day (New York's) the game is dealt to no new match, everywhere or on iOS alone, as if un-released there; matches already under way keep it. Clear: back to what the switches above say. Scheduled removals are listed at the top of the Games list.</p></div>`;
}
// A game's Game lineup card (the main menu's lineup, src/ui/lineup.js): the back's line (at most 120 characters), where it
// sits from luck (1) to skill (5) and race or head-to-head. Its meta.js gives the defaults (lineupBlurb, luckSkill, format);
// Save keeps only what differs from them at config/lineup/{type} (public read, admin write: database.rules.json), which
// every page reads as it starts; Reset to defaults clears it. Display text, not a rule: no settings version (bumpVersion
// is for what a square is dealt with), and saved on its own, apart from the page's Save.
const LU_MAX = 120;
const luDef = t => { const m = META[t] || {}; return { blurb: m.lineupBlurb || '', luckSkill: m.luckSkill || 3, format: m.format === 'race' ? 'race' : 'shared' }; };
const luSaved = t => ((ctl.lineup || {})[t]) || {};
const luNow = t => Object.assign(luDef(t), luSaved(t));
const LU_LS = [[1, 'Pure luck'], [2, 'Mostly luck'], [3, 'Half and half'], [4, 'Mostly skill'], [5, 'Pure skill']];
function lineupCard(t) {
  const v = luNow(t), d = luDef(t), sv = luSaved(t), ch = Object.keys(sv).length > 0;
  return `<div class="card ctl" id="lineupCard"><div class="row"><h2>Lineup card</h2>${ch ? badge('chg', 'changed') : ''}</div>
    <div class="rform luform">
      <label class="rf lublurb${sv.blurb !== undefined ? ' chg' : ''}"><span>Back of the card <small class="lucount" id="luCount">${v.blurb.length} / ${LU_MAX}</small></span><textarea data-lublurb="${t}" maxlength="${LU_MAX}" rows="3">${esc(v.blurb)}</textarea><small>Default: ${esc(d.blurb)}</small></label>
      <label class="rf${sv.luckSkill !== undefined ? ' chg' : ''}"><span>Luck or skill</span><select data-luls="${t}">${LU_LS.map(([k, lab]) => `<option value="${k}"${k === v.luckSkill ? ' selected' : ''}>${k} · ${lab}</option>`).join('')}</select><small>Default ${d.luckSkill}</small></label>
      <label class="rf${sv.format !== undefined ? ' chg' : ''}"><span>Format</span><select data-lufmt="${t}">${[['race', 'Race (each their own board)'], ['shared', 'Head-to-head (one shared board)']].map(([k, lab]) => `<option value="${k}"${k === v.format ? ' selected' : ''}>${lab}</option>`).join('')}</select><small>Default ${d.format === 'race' ? 'Race' : 'Head-to-head'}</small></label>
    </div>
    <div class="tbar"><button class="btn go" data-lusave="${t}">Save card</button><button class="btn" data-lureset="${t}"${ch ? '' : ' disabled'}>Reset to defaults</button></div>
    <p class="note">What the back of this game's card says in the main menu's Game lineup: what the game is and how you win, a luck-to-skill meter (five pips, this one filled) and a Race or Head-to-head tag. Saved on its own (not with the settings below, and no new settings version); every player's page reads it as it starts. Reset to defaults: back to the game's meta.js.</p></div>`;
}
async function saveLineup(t, btn, reset) {
  const box = app.querySelector(`[data-lublurb="${t}"]`), ls = app.querySelector(`[data-luls="${t}"]`), fm = app.querySelector(`[data-lufmt="${t}"]`), d = luDef(t);
  let out = {};
  if (!reset) {
    const blurb = box ? box.value.replace(/\s+/g, ' ').trim() : d.blurb, k = ls ? Number(ls.value) : d.luckSkill, f = fm ? fm.value : d.format;
    if (!blurb) { said(btn, false, 'Write a line, or Reset to defaults'); return; }
    if (blurb.length > LU_MAX) { said(btn, false, `At most ${LU_MAX} characters`); return; }
    if (blurb !== d.blurb) out.blurb = blurb;
    if (Number.isInteger(k) && k >= 1 && k <= 5 && k !== d.luckSkill) out.luckSkill = k;
    if ((f === 'race' || f === 'shared') && f !== d.format) out.format = f;
  }
  btn.disabled = true;
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `config/lineup/${t}`), Object.keys(out).length ? out : null);
    const all = Object.assign({}, ctl.lineup); if (Object.keys(out).length) all[t] = out; else delete all[t];
    ctl.lineup = all;
  } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(app.querySelector(`[data-lusave="${t}"]`) || btn, true, reset ? 'Back to the defaults' : 'Saved');
}
// ---------- Platforms (the top of the Games page): the clients' minimum versions and the Super Chaos switch, neither a game's own ----------
function platformsCard() {
  const sc = !!(ctl.releases && ctl.releases.superchaos === true);   // the Super Chaos mode: admin only until released here (releases/superchaos)
  return clientsCard() + `<div class="card ctl" id="scCard"><div class="row"><h2>Super Chaos mode</h2><label class="sw"><input type="checkbox" data-rel="superchaos"${sc ? ' checked' : ''}><span class="${sc ? 'good' : ''}">${sc ? 'Released' : 'Admin only'}</span></label></div>
    <p class="note">Super Chaos is switched off in the code for everyone, you included (src/core/config.js SUPER_CHAOS_ENABLED): every match is Classic, Find Match too, and no Mode selector shows, whatever this switch says. Its code and settings are kept; once the code switch is back on, this switch decides again (off: Classic only; on: the Mode selector for everyone).</p></div>`;
}
async function saveRelIos(el) {
  const t = el.dataset.relios, on = el.checked, lab = el.nextElementSibling;
  if (lab) { lab.textContent = on ? 'iOS on' : 'iOS off'; lab.className = on ? 'good' : ''; }
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `releases/platform/ios/${t}`), on ? null : false);   // (on: nothing stored, as released)
    const pl = Object.assign({}, ctl.releases.platform), io = Object.assign({}, pl.ios);
    if (on) delete io[t]; else io[t] = false;
    pl.ios = io; ctl.releases = Object.assign({}, ctl.releases, { platform: pl });
    await clearSoonIfEverywhere(t);
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
  return `<div class="card ctl" id="clientsCard"><h2>Platforms: clients</h2>
    <p class="note">This code is version <b>${esc(cur)}</b> (src/core/client.js CLIENT_VERSION). Every phone reports its version and platform; online matches deal only games both players' clients have (a game's meta.js minVersion) and that are on for both their platforms (each game's iOS switch, on its page below).</p>
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
// Released on every platform now: the Coming soon flag goes (a game is never both on one platform).
async function clearSoonIfEverywhere(t) {
  if (!soonSet(t) || soonWhere(t)) return;
  await fb.dbM.set(fb.dbM.ref(fb.db, `releases/soon/${t}`), null);
  const so = Object.assign({}, ctl.releases.soon); delete so[t];
  ctl.releases = Object.assign({}, ctl.releases, { soon: so });
}
async function saveSoon(el) {
  const t = el.dataset.soon || el.dataset.soondate, dateEl = app.querySelector(`[data-soondate="${t}"]`), date = dateEl && SOON_RE.test(dateEl.value) ? dateEl.value : '';
  const on = (el.dataset.soon ? el.checked : soonSet(t)) && !!soonWhere(t);
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `releases/soon/${t}`), on ? (date || true) : null);   // (true: coming soon with no date; a date: its sticker)
    const so = Object.assign({}, ctl.releases && ctl.releases.soon);
    if (on) so[t] = date || true; else delete so[t];
    ctl.releases = Object.assign({}, ctl.releases, { soon: so });
  } catch (e) { render(); said(el, false, failed(e)); return; }
  render(); said(app.querySelector(`[data-soon="${t}"]`) || el, true, 'Saved');
}
async function saveRetire(el, clear) {
  const t = el.dataset.rt || el.dataset.retclear, p = el.dataset.retire || el.dataset.p, date = clear ? '' : (SOON_RE.test(el.value) ? el.value : '');
  if (!GAMES[t] || !['all', 'ios'].includes(p)) return;
  if (!clear && !date) { said(el, false, 'Pick a day'); return; }
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `releases/retire/${p}/${t}`), date || null);
    const r = JSON.parse(JSON.stringify((ctl.releases && ctl.releases.retire) || {}));
    r[p] = r[p] || {}; if (date) r[p][t] = date; else delete r[p][t];
    ctl.releases = Object.assign({}, ctl.releases, { retire: r });
  } catch (e) { render(); said(el, false, failed(e)); return; }
  render(); said(app.querySelector(`[data-retire="${p}"][data-rt="${t}"]`) || el, true, date ? 'Scheduled' : 'Cleared');
}
async function saveRelease(el) {
  const t = el.dataset.rel, radio = el.type === 'radio', st = radio ? el.value : (el.checked ? 'released' : 'testing'), on = st === 'released', lab = radio ? null : el.nextElementSibling;   // (no confirmation: a tap releases or un-releases at once)
  if (radio && !STATUS.some(([k]) => k === st)) return;
  if (lab) { lab.textContent = on ? 'Released' : 'Admin only'; lab.className = on ? 'good' : ''; }
  const drop = (node, k) => { const o = Object.assign({}, ctl.releases[node]); delete o[k]; ctl.releases = Object.assign({}, ctl.releases, { [node]: o }); };
  try {
    await fb.dbM.set(fb.dbM.ref(fb.db, `releases/${t}`), on);
    ctl.releases = Object.assign({}, ctl.releases, { [t]: on });
    if (radio) {
      const dep = st === 'depri', had = !!(ctl.releases.depri && ctl.releases.depri[t]);
      if (dep !== had) {
        await fb.dbM.set(fb.dbM.ref(fb.db, `releases/depri/${t}`), dep ? true : null);   // (Deprioritized: a flag on a game not released; released or Testing: none)
        if (dep) ctl.releases = Object.assign({}, ctl.releases, { depri: Object.assign({}, ctl.releases.depri, { [t]: true }) }); else drop('depri', t);
      }
      if (dep && soonSet(t)) { await fb.dbM.set(fb.dbM.ref(fb.db, `releases/soon/${t}`), null); drop('soon', t); }   // (never coming soon)
    }
    await clearSoonIfEverywhere(t);
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
const runSums = t => (P && model ? P.X.runStats(scopeOf(), t, RUN_BIN) : { runs: 0, distSum: 0, finishes: 0, finishRuns: 0, crash: {} });   // the squares under the page's filters (src/admin/metrics.js)
function runnerCard(t) {   // one runner's card, on its page (#games/<type>): its numbers so far and its config/run fields (saved by the page's Save)
  const kpi = (label, big, sub) => `<div class="card kpi"><small>${label}</small><b>${big}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;   // (as the dashboard's own, which lives inside render)
  {
    const c = runCfg(t), s = runSums(t), name = GAMES[t];
    const fields = RUN_FIELDS.concat(RUN_EXTRA[t] || []).map(([k, l, lo, hi]) => `<label class="rf"><span>${l}</span><input type="number" step="any" min="${lo}" max="${hi}" data-runcfg="${t}:${k}" value="${c[k]}"></label>`).join('');
    const mix = RUN_MIX[t].map(([k, l]) => `<label class="rf"><span>${l}</span><input type="number" step="1" min="0" max="1000" data-runcfg="${t}:mix.${k}" value="${c.mix[k]}"></label>`).join('');
    const bins = []; for (let b = 0; b < c.target; b += RUN_BIN) bins.push([b, n(s.crash[b])]);
    const max = Math.max(1, ...bins.map(x => x[1])), crashes = bins.reduce((a, x) => a + x[1], 0);
    const chart = crashes ? `<div class="rbins" aria-label="Crashes per ${RUN_BIN} m">${bins.map(([b, k]) => `<div class="rbin" title="${b}-${b + RUN_BIN} m: ${k} crash${k === 1 ? '' : 'es'}"><i style="height:${Math.round(100 * k / max)}%"></i>${b % 200 === 0 ? `<small>${b}</small>` : ''}</div>`).join('')}</div>` : '<p class="dim">No crashes recorded yet.</p>';
    return `<div class="card ctl" id="runCard"><h2>${esc(name)} tuning</h2>
      <p class="note">A race to the target distance, one run a move. Obstacle spacing is the posts' spacing in Flap and the blocks' in Chopper (the mix decides each one's gap, or the block's size, or none). Everything here goes to the game and the server at once and applies to squares dealt from then on (a square under way keeps its values). The mix numbers are weights (any scale). Aim: an average player finishes in 3-6 runs, most runs lasting 10-25 seconds; the crash chart (every ${RUN_BIN} m, every mode together) shows where the course bites.</p>
      <div class="rkpis">${kpi('Runs to finish', num(ratio(s.finishRuns, s.finishes)), `${s.finishes} square${s.finishes === 1 ? '' : 's'} finished`)}${kpi('Avg distance per run', s.runs ? Math.round(s.distSum / s.runs) + ' m' : '—', `${s.runs} run${s.runs === 1 ? '' : 's'}`)}${kpi('Crashes', crashes, 'where they cluster, below')}</div>
      ${chart}
      <div class="rform">${fields}${mix}</div></div>`;
  }
}
// The page's values for config/run/<type>: { value } to save, or { err } (every save and Test play reads the page this way).
function readRunCfg(t) {
  const out = { mix: {} };
  for (const el of app.querySelectorAll(`input[data-runcfg^="${t}:"]`)) {
    const k = el.dataset.runcfg.split(':')[1], v = Number(el.value);
    if (!Number.isFinite(v) || v < Number(el.min) || v > Number(el.max)) return { err: `${k}: a number from ${el.min} to ${el.max}` };
    if (k.startsWith('mix.')) out.mix[k.slice(4)] = Math.round(v); else out[k] = v;
  }
  if (out.gapMax < out.gapMin) return { err: 'The maximum spacing must be at least the minimum.' };
  if (!Object.values(out.mix).some(v => v > 0)) return { err: 'Give at least one obstacle kind a weight.' };
  return { value: out };
}
// ---------- Bullseye's tuning (config/bulls, read by the game and the server) ----------
// The board's three rings, their radii in wall units (the wall is 100 across): the whole board, its inner
// ring and the bullseye; how long a line takes to sweep across the wall at the start, and how much faster a
// player's lines get with each throw of theirs that scores. A change applies to squares dealt from then on.
// (The points and the computer's rates are the game's settings above.)
const BULL_DEFAULTS = { board: 32, mid: 17.5, bull: 6.5, sweep: 700, ramp: 1.15 };   // (as the game's meta.js has them)
const BULL_FIELDS = [['board', 'Board radius (wall is 100 across)', 16, 35, 'any'], ['mid', 'Inner ring radius', 5, 28, 'any'], ['bull', 'Bullseye radius', 1, 14, 'any'], ['sweep', 'Sweep across at the start (ms)', 400, 5000, '10'], ['ramp', 'Speed-up per scoring throw (x)', 1, 2, 'any']];
function bullsCard() {
  const stored = ctl.bullsCfg || {}, c = {};
  for (const [k] of BULL_FIELDS) {
    const raw = stored.mid == null && !['sweep', 'ramp'].includes(k) ? null : stored[k];   // (a stored config without the inner ring is the small moving board's: its radii are not this board's)
    c[k] = raw != null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : BULL_DEFAULTS[k];
  }
  const fields = BULL_FIELDS.map(([k, l, lo, hi, st]) => `<label class="rf"><span>${l}</span><input type="number" step="${st}" min="${lo}" max="${hi}" data-bullcfg="${k}" value="${c[k]}"></label>`).join('');
  return `<div class="card ctl" id="bullsCard"><h2>Bullseye tuning</h2>
    <p class="note">Bullseye: a dartboard on a wall 100 units across; a throw stops a sideways line, then an up-down line, and the dart lands where they cross. The bullseye scores 3, the inner ring 2, the outer ring 1; first to 7. Everything here goes to the game and the server at once and applies to squares dealt from then on. Aim: about 4-6 throws to win. Bigger rings or a slower sweep make it easier; the speed-up makes each scoring throw harder than the last.</p>
    <div class="rform">${fields}</div></div>`;
}
function readBullsCfg() {
  const out = {};
  for (const el of app.querySelectorAll('input[data-bullcfg]')) {
    const k = el.dataset.bullcfg, v = Number(el.value);
    if (!Number.isFinite(v) || v < Number(el.min) || v > Number(el.max)) return { err: `${k}: a number from ${el.min} to ${el.max}` };
    out[k] = v;
  }
  if (out.mid >= out.board) return { err: 'The inner ring must be smaller than the board.' };
  if (out.bull >= out.mid) return { err: 'The bullseye must be smaller than the inner ring.' };
  return { value: out };
}
// ---------- Peg Drop's target (config/plinko, read by the game and the server) ----------
const PLINKO_DEFAULTS = { target: 12 };   // (as the game's meta.js has it)
function plinkoCard() {
  const raw = ctl.plinkoCfg || {}, v = raw.target != null && Number.isFinite(Number(raw.target)) ? Number(raw.target) : PLINKO_DEFAULTS.target;
  return `<div class="card ctl" id="plinkoCard"><h2>Peg Drop tuning</h2>
    <p class="note">Peg Drop: the bins are worth 5, 3, 3, 2, 2, 1 and 1 points (the order drawn per square), the bonus peg 2; each player's points add up and the first to the target wins. Default 12. Applies to squares dealt from then on.</p>
    <div class="rform"><label class="rf"><span>Target (points to win)</span><input type="number" step="1" min="4" max="40" data-plinkocfg="target" value="${v}"></label></div></div>`;
}
function readPlinkoCfg() {
  const el = app.querySelector('input[data-plinkocfg="target"]'), v = Number(el && el.value);
  if (!Number.isInteger(v) || v < 4 || v > 40) return { err: 'Target: a whole number from 4 to 40' };
  return { value: { target: v } };
}
// ---------- Risky Rolls' die and target (config/pig, read by the game and the server) ----------
const PIG_DEFAULTS = { sides: 8, target: 51 };   // (as the game's meta.js has them)
function pigCard() {
  const raw = ctl.pigCfg || {}, sides = raw.sides === 6 || raw.sides === 8 ? raw.sides : PIG_DEFAULTS.sides, t = raw.target != null && Number.isFinite(Number(raw.target)) ? Number(raw.target) : PIG_DEFAULTS.target;
  return `<div class="card ctl" id="pigCard"><h2>Risky Rolls tuning</h2>
    <p class="note">Risky Rolls: roll as often as you dare, then bank; a number already rolled this turn loses the turn's points. The die (6 or 8 sides) and the score to bank to win. Default: 8 sides, 51. Applies to squares dealt from then on.</p>
    <div class="rform"><label class="rf"><span>Die</span><select data-pigcfg="sides">${[6, 8].map(n => `<option value="${n}"${n === sides ? ' selected' : ''}>${n} sides</option>`).join('')}</select></label><label class="rf"><span>Target (points to win)</span><input type="number" step="1" min="10" max="200" data-pigcfg="target" value="${t}"></label></div></div>`;
}
function readPigCfg() {
  const q = sel => { const el = app.querySelector(sel); return Number(el && el.value); }, sides = q('[data-pigcfg="sides"]'), t = q('[data-pigcfg="target"]');
  if (sides !== 6 && sides !== 8) return { err: 'Die: 6 or 8 sides' };
  if (!Number.isInteger(t) || t < 10 || t > 200) return { err: 'Target: a whole number from 10 to 200' };
  return { value: { sides, target: t } };
}
// ---------- Roads' honeycomb (config/roads, read by the game and the server) ----------
const ROADS_DEFAULTS = { layout: 'hex7' };   // (as the game's meta.js has it)
function roadsCard() {
  const raw = ctl.roadsCfg || {}, lay = raw.layout === 'hex4' || raw.layout === 'hex7' ? raw.layout : ROADS_DEFAULTS.layout;
  return `<div class="card ctl" id="roadsCard"><h2>Roads tuning</h2>
    <p class="note">Roads: claim an edge, then a random edge is blocked; the longest road wins. Every move uses two edges, so the honeycomb sets the length: 7 hexagons (30 edges) is about 7 to 8 moves each; the smaller 4 (19 edges) about 5 each. Default 7. Applies to squares dealt from then on.</p>
    <div class="rform"><label class="rf"><span>Honeycomb</span><select data-roadscfg="layout">${[['hex7', '7 hexagons (30 edges)'], ['hex4', '4 hexagons (19 edges)']].map(([v, l]) => `<option value="${v}"${v === lay ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div></div>`;
}
function readRoadsCfg() {
  const el = app.querySelector('[data-roadscfg="layout"]'), layout = el && el.value;
  if (layout !== 'hex7' && layout !== 'hex4') return { err: 'Honeycomb: 7 or 4 hexagons' };
  return { value: { layout } };
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
    ${c.extra.length ? `<div class="rform">${c.extra.map(([k, label, lo, hi, step]) => `<label class="rf"><span>${label}</span>${inp(k, lo, hi, step)}</label>`).join('')}</div>` : ''}</div>`;
}
function readAttCfg(c) {
  const out = {};
  for (const el of app.querySelectorAll(`input[data-attcfg="${c.id}"]`)) {
    const v = Number(el.value), lo = Number(el.min), hi = Number(el.max);
    if (!Number.isFinite(v) || v < lo || v > hi) return { err: `${c.title.replace(' tuning', '')}: ${el.dataset.k} must be from ${lo} to ${hi}` };
    out[el.dataset.k] = v;
  }
  return { value: out };
}
// ---------- the finger games' difficulty (config/skyhop, config/scoop, config/pinball, read by the game and the server) ----------
const HOP_DEFAULTS = { target: 150, bounce: 22, gap0: 3, gap1: 4.5, wide0: 1.5, wide1: 1.1, moveAt: 10, move: 65, moveV: 2.2, breakAt: 8, brk0: 25, brk: 60, hazAt: 15, hazGap: 25, fill0: 0.4, fill1: 0.2 };   // (as the game's meta.js has them)
const SCOOP_DEFAULTS = { target: 25, v0: 5, v1: 8.5, gap0: 0.9, gap1: 0.6, haz0: 18, haz1: 38, sway: 1, cone: 12 };
const PINB_DEFAULTS = { size: 1.3, save: 3, maxBall: 120, g: 1, bump: 1, spin: 1 };
const BOWL_CARDS = [];   // (Bowling had a card of its own, the two taps' speeds, config/bowling: gone with the taps, November 2026; its flick's settings are in its TUNE)
const FING_CARDS = [
  { id: 'skyhop', title: 'Sky Hop tuning', defaults: HOP_DEFAULTS, fields: [['target', 'Target height (m)', 50, 3000, 10], ['bounce', 'Bounce speed (m/s; 22 rises 5.5 m)', 12, 30, 0.1], ['gap0', 'Gap between platforms at the bottom (m)', 0.6, 6, 0.05], ['gap1', 'Gap at the top (m)', 0.6, 6, 0.05], ['wide0', 'Platform width at the bottom (m; the sky is 9 wide)', 0.8, 6, 0.05], ['wide1', 'Platform width at the top (m)', 0.8, 6, 0.05], ['fill0', 'Extra platforms per gap at the bottom', 0, 4, 0.05], ['fill1', 'Extra platforms per gap at the top', 0, 4, 0.05], ['moveAt', 'Moving platforms from (m)', 0, 3000, 1], ['move', 'Moving platforms by the top (%)', 0, 90, 1], ['moveV', 'Moving platform speed (m/s)', 0.2, 4, 0.05], ['breakAt', 'Breaking platforms from (m)', 0, 3000, 1], ['brk0', 'Breaking platforms at that height (%)', 0, 90, 1], ['brk', 'Breaking platforms by the top (%)', 0, 90, 1], ['hazAt', 'Burrs from (m)', 0, 3000, 1], ['hazGap', 'About one burr every (m)', 5, 500, 1]],
    note: 'The hopper bounces up off platforms; a drag steers it and the sky wraps at the sides. Falling off the bottom ends the attempt and the highest point is kept. Higher up: wider gaps, narrower platforms, more that move or break after one bounce, and burrs to avoid (never across the way up). Every gap can be made: the course always has a chain of platforms within a bounce. Default 150 m: a strong run reaches the top in about 28 s; tuned so an average player needs about 3 to 6 attempts (the computer: about 4.5).' },
  { id: 'scoop', title: 'Scoop Stack tuning', defaults: SCOOP_DEFAULTS, fields: [['target', 'Target (scoops)', 5, 200, 1], ['v0', 'Falling speed at the start (units/s; the screen is 10 wide)', 1, 15, 0.1], ['v1', 'Falling speed at the target', 1, 15, 0.1], ['gap0', 'Time between items at the start (s)', 0.3, 4, 0.05], ['gap1', 'Time between items at the target (s)', 0.3, 4, 0.05], ['haz0', 'Hazards at the start (% of items)', 0, 70, 1], ['haz1', 'Hazards at the target (%)', 0, 70, 1], ['cone', 'Cone speed (units/s)', 5, 40, 0.5], ['sway', 'Sway of the stack (1 = normal, 0 = none)', 0, 3, 0.05]],
    note: 'Scoops and hazards (pebbles, burnt scoops) fall to the top of the stack; the cone follows the finger. A hazard on the stack, or 3 missed scoops, ends the attempt; the stack is kept. Speed and hazards rise with the stack. Every attempt is checked to be catchable at 72% of the cone speed. Default 25 scoops; tuned so an average player needs about 3 to 6 attempts (the computer: about 4.5).' },
  { id: 'pinball', title: 'Pinball tuning', defaults: PINB_DEFAULTS, fields: [['size', 'Target size (1 = the drawn size; up to 2)', 0.6, 2, 0.05], ['save', 'Ball save after launch (s)', 0, 10, 0.5], ['maxBall', 'Longest ball (s)', 20, 300, 5], ['g', 'Table slope (gravity, 1 = normal)', 0.5, 2, 0.05], ['bump', 'Bumper kick (1 = normal)', 0.5, 2, 0.05], ['spin', 'Moving target speed (1 = normal, 0 = still)', 0, 3, 0.05]],
    note: 'One ball per turn; each player lights their own 7 targets, which stay lit. Bigger targets are easier. Default size 1.3: about 4 balls for the computer (median 4), which plays like an average player.' },
];
function fingCard(c) {
  const raw = (ctl.fingCfg || {})[c.id] || {}, num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  return `<div class="card ctl" id="${c.id}Card"><h2>${c.title}</h2>
    <p class="note">${c.note} Applies to squares dealt from then on.</p>
    <div class="rform">${c.fields.map(([k, label, lo, hi, step]) => `<label class="rf"><span>${label}</span><input type="number" step="${step}" min="${lo}" max="${hi}" data-fingcfg="${c.id}" data-k="${k}" value="${num(raw[k], c.defaults[k])}"></label>`).join('')}</div></div>`;
}
function readFingCfg(c) {
  const out = {};
  for (const el of app.querySelectorAll(`input[data-fingcfg="${c.id}"]`)) {
    const v = Number(el.value), f = c.fields.find(x => x[0] === el.dataset.k);
    if (!f) continue;
    if (!Number.isFinite(v) || v < f[2] || v > f[3]) return { err: `${f[1]}: a number from ${f[2]} to ${f[3]}` };
    out[el.dataset.k] = v;
  }
  return { value: out };
}
// ---------- Odd One Out's shade differences (config/oddone, read by the game and the server) ----------
const ODD_DEFAULTS = { d1: 4, d2: 2.8, d3: 2 };   // (as the game's meta.js has it)
const ODD_FIELDS = [['d1', 'Level 1 (3x3)'], ['d2', 'Level 2 (4x4)'], ['d3', 'Level 3 (5x5)']];
function oddCard() {
  const raw = ctl.oddCfg || {}, num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  return `<div class="card ctl" id="oddCard"><h2>Odd One Out tuning</h2>
    <p class="note">How different the odd tile is at each level, in perceptual units (ΔE 2000: about 1 is the smallest difference most people can see side by side; the same on every colour). Smaller is harder. Meant for a typical player to miss about 25% at level 1, 40% at level 2 and 55% at level 3 within the 5 seconds. Defaults: 4, 2.8, 2. Applies to grids dealt from then on.</p>
    <div class="rform">${ODD_FIELDS.map(([k, label]) => `<label class="rf"><span>${label}</span><input type="number" step="0.1" min="0.5" max="25" data-oddcfg="${k}" value="${num(raw[k], ODD_DEFAULTS[k])}"></label>`).join('')}</div></div>`;
}
function readOddCfg() {
  const out = {};
  for (const [k, label] of ODD_FIELDS) { const el = app.querySelector(`input[data-oddcfg="${k}"]`), v = Number(el && el.value); if (!Number.isFinite(v) || v < 0.5 || v > 25) return { err: `${label}: a number from 0.5 to 25` }; out[k] = Math.round(v * 10) / 10; }
  return { value: out };
}
// ---------- Risky Spins' tuning (config/wheels, read by the game and the server) ----------
// The target, and the ranges each square's two wheels are drawn from (ten equal segments each). A
// change applies to squares dealt from then on. (Until November 2026 a square had a medium wheel too: its settings midSkulls,
// midLo and midHi are gone; a stored config that still has them is read without them, and saving this card drops them.)
const WHEEL_DEFAULTS = { target: 30, lowSkulls: 2, highSkulls: 5, lowLo: 1, lowHi: 4, highLo: 6, tensMin: 1, tensMax: 1, gap: 0.4, evSpread: 10 };   // (as the game's meta.js has them)
const WHEEL_FIELDS = [['target', 'Target (points to win)', 10, 100, 1], ['lowSkulls', 'Low: skulls (of 10)', 0, 4, 1], ['highSkulls', 'High: skulls (of 10)', 1, 7, 1], ['lowLo', 'Low: lowest value', 1, 3, 1], ['lowHi', 'Low: highest value', 2, 6, 1], ['highLo', 'High: lowest value', 1, 8, 1], ['tensMin', 'High: fewest 10s', 1, 3, 1], ['tensMax', 'High: most 10s', 1, 3, 1], ['gap', 'High\'s average at least this far above Low\'s', 0, 2, 0.1], ['evSpread', 'Turns worth the same: the two within this % of each other', 1, 100, 1]];
function wheelsCard() {
  const raw = ctl.wheelsCfg || {}, num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  return `<div class="card ctl" id="wheelsCard"><h2>Risky Spins tuning</h2>
    <p class="note">Risky Spins (push your luck): each square deals two wheels of ten equal segments, drawn again until every rule holds. A spin's points go into the turn's pot; a skull loses the pot; Bank adds it to the score. Low: the safe wheel, fewer skulls, values in its range, at least two different. High: the risky wheel, more skulls, values from its lowest to 10, the only wheel with 10s; its average is at least the gap above Low's. And the two are worth about the same: each wheel's best turn on it alone (spun until the next spin would risk more than it adds, then banked) banks on average within the given percent of the other, so the choice is the risk, not a better wheel; if the ranges never allow that, the closest set is dealt. Defaults: first to 30; skulls 2 and 5; Low 1-4, High 6-10 with one 10; averages 0.4 apart; turns within 10% (about 4.1 points each). A square already dealt with three wheels plays on with them. Applies to squares dealt from then on.</p>
    <div class="rform">${WHEEL_FIELDS.map(([k, label, lo, hi, step]) => `<label class="rf"><span>${label}</span><input type="number" step="${step}" min="${lo}" max="${hi}" data-wheelcfg="${k}" value="${num(raw[k], WHEEL_DEFAULTS[k])}"></label>`).join('')}</div>
</div>`;
}
function readWheelsCfg() {
  const out = {};
  for (const el of app.querySelectorAll('input[data-wheelcfg]')) {
    const k = el.dataset.wheelcfg, v = Number(el.value), f = WHEEL_FIELDS.find(x => x[0] === k);
    if (!f) continue;
    if (!Number.isFinite(v) || v < f[2] || v > f[3] || (f[4] === 1 && !Number.isInteger(v))) return { err: `${f[1]}: ${f[4] === 1 ? 'a whole number' : 'a number'} from ${f[2]} to ${f[3]}` };
    out[k] = v;
  }
  if (out.tensMax < out.tensMin) return { err: 'High: the most 10s must be at least the fewest.' };
  if (out.lowHi <= out.lowLo) return { err: 'Low: the highest value must be above the lowest.' };
  if (!(out.lowSkulls < out.highSkulls)) return { err: 'Skulls: Low fewer than High.' };
  if (out.highSkulls + out.tensMax > 10) return { err: 'High: its skulls and 10s must fit on 10 segments.' };
  return { value: out };
}
// ---------- Test play: a game alone in a new tab, with its card's settings as the editor has them (saved or
// not; checked by nothing here: the game takes what it can). The live settings are never touched: the
// settings ride in the address (?sandbox=<game>&cfg=<base64url JSON>) and the game, which checks the
// admin's sign-in, keeps them in that tab only (src/ui/sandbox.js). ----------
function editorCfg(t) {
  const tn = Object.fromEntries([...app.querySelectorAll(`[data-tune="${t}"]`)].filter(el => el.type !== 'radio' || el.checked).map(el => [el.dataset.k, el.value]));
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
// ---------- Games (#games): every mini-game in one list, each with its own page (#games/<type>): its release switches
// (releases/{type}, releases/platform/ios/{type}), its Mode where it is a race game (the TUNE 'mode' setting, core/race.js),
// its settings from its meta.js (TUNE: src/core/tune.js) saved to config/tune/<type> (only the values that differ from
// the defaults), read by the game and the server and dealt into each new square, and, where the game has one, its own
// tuning card (config/<name>: the runners, Risky Spins, Risky Rolls, ...; the same paths and shapes as ever, which the
// server and the copy to production read). One Save and one Reset to defaults cover the whole page; Test play opens the
// game alone in a new tab with the page's values, saved or not. (This took over Mini-game Settings and Releases, November 2026.) ----------
const CATS = [['luck', 'Luck'], ['skill', 'Skill'], ['brain', 'Brain']];
const TGROUPS = ['Board', 'Rules', 'Timing', 'Computer'];
let META = {}, TUNE = null, CLIENT = null, RACE = null;      // each game's meta.js; core/tune.js (tuneValue, tuneNorm); core/client.js (versions); core/race.js (RACE_TYPES)
async function loadMetas() {
  if (TUNE) return;
  const reg = await import('./src/games/index.js'), ts = Object.keys(GAMES), ms = ts.map(t => (reg.GAMES[t] && reg.GAMES[t].meta) || {});   // (the registry: each game's meta, in the order the game loads them)
  META = Object.fromEntries(ts.map((t, i) => [t, ms[i]]));
  TUNE = await import('./src/core/tune.js');   // (the registry has registered every game's settings)
  CLIENT = await import('./src/core/client.js');
  RACE = await import('./src/core/race.js');   // (after the registry: the metas import its MODE_TUNE)
  BAL = await import('./src/admin/balance.js');   // a game's version card (its saves)
  P = await import('./src/admin/pages.js');       // the pages, with the metrics layer (P.X) and the table (P.T)
}
const tuneList = t => (META[t] && Array.isArray(META[t].TUNE) ? META[t].TUNE : []);
const catName = t => { const c = CATS.find(x => META[t] && x[0] === META[t].category); return c ? c[1] : ''; };
const gameIcon = t => (META[t] && META[t].icon ? `<span class="gico" aria-hidden="true">${META[t].icon}</span>` : '');
const isRaceGame = t => !!(RACE && RACE.RACE_TYPES.includes(t));
const raceOn = t => isRaceGame(t) && (((ctl.tune || {})[t] || {}).mode === 'race');   // (the saved setting: a race is dealt while it says so)
// The games with a tuning card of their own (config/<name>): its card, its values read from the page, where ctl keeps them, its defaults.
const attOf = t => ATT_CARDS.find(x => x.id === t), fingOf = t => FING_CARDS.find(x => x.id === t) || BOWL_CARDS.find(x => x.id === t);
const ONE_CARD = { bullseye: ['bullsCfg', () => bullsCard(), readBullsCfg, BULL_DEFAULTS], plinko: ['plinkoCfg', () => plinkoCard(), readPlinkoCfg, PLINKO_DEFAULTS], pig: ['pigCfg', () => pigCard(), readPigCfg, PIG_DEFAULTS], roads: ['roadsCfg', () => roadsCard(), readRoadsCfg, ROADS_DEFAULTS], oddone: ['oddCfg', () => oddCard(), readOddCfg, ODD_DEFAULTS], wheels: ['wheelsCfg', () => wheelsCard(), readWheelsCfg, WHEEL_DEFAULTS] };
function legacyCard(t) {
  if (RUN_TYPES.includes(t)) return runnerCard(t);
  if (ONE_CARD[t]) return ONE_CARD[t][1]();
  const a = attOf(t), f = fingOf(t);
  return a ? attCard(a) : f ? fingCard(f) : '';
}
function legacyRead(t) {                       // { value } to save at legacyPath(t), or { err }; null for a game without a card
  if (RUN_TYPES.includes(t)) return readRunCfg(t);
  if (ONE_CARD[t]) return ONE_CARD[t][2]();
  const a = attOf(t), f = fingOf(t);
  return a ? readAttCfg(a) : f ? readFingCfg(f) : null;
}
const legacyPath = t => (RUN_TYPES.includes(t) ? `config/run/${t}` : t === 'bullseye' ? 'config/bulls' : ['plinko', 'pig', 'roads', 'oddone', 'wheels', 'headcount', 'flash', 'snapshot', 'skyhop', 'scoop', 'pinball'].includes(t) ? `config/${t}` : null);
const legacyStored = t => (RUN_TYPES.includes(t) ? (ctl.runCfg || {})[t] : ONE_CARD[t] ? ctl[ONE_CARD[t][0]] : attOf(t) ? (ctl.attCfg || {})[t] : fingOf(t) ? (ctl.fingCfg || {})[t] : null) || null;
const legacyDefaults = t => (RUN_TYPES.includes(t) ? RUN_DEFAULTS[t] : ONE_CARD[t] ? ONE_CARD[t][3] : (attOf(t) || fingOf(t) || {}).defaults || null);
function legacyKeep(t, v) {                    // what was saved, kept here as loadCtl would read it back
  if (RUN_TYPES.includes(t)) ctl.runCfg = Object.assign({}, ctl.runCfg, { [t]: v });
  else if (ONE_CARD[t]) ctl[ONE_CARD[t][0]] = v;
  else if (attOf(t)) ctl.attCfg = Object.assign({}, ctl.attCfg, { [t]: v });
  else if (fingOf(t)) ctl.fingCfg = Object.assign({}, ctl.fingCfg, { [t]: v });
}
const legacyCount = t => (RUN_TYPES.includes(t) ? RUN_FIELDS.length + (RUN_EXTRA[t] || []).length + RUN_MIX[t].length : Object.keys(legacyDefaults(t) || {}).length);
// Saved with a value other than the code's default (the list's "changed" marker, the tile's count): the TUNE settings kept
// in config/tune/<type> are only such values; a tuning card's stored config counts where any value differs from its default.
const changedOf = t => Object.keys((ctl.tune && ctl.tune[t]) || {}).length;
function legacyChanged(t) {
  const d = legacyDefaults(t), st = legacyStored(t);
  if (!d || !st || typeof st !== 'object') return false;
  const diff = (a, b) => Object.keys(a).some(k => (a[k] && typeof a[k] === 'object' ? diff(a[k], (b && b[k]) || {}) : String(a[k]) !== String(b ? b[k] : undefined)));
  return diff(st, d);
}
const gameChanged = t => changedOf(t) > 0 || legacyChanged(t);
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(y => [y, x[y]])) : x));   // (the same values in any key order)
// ---------- Animation (config/anim): speed, everyone's pace (read by the game and the server); fast and fx, the players'
// Speed setting's multiplier and effects intensity (the game's alone: a player's Animation choice) ----------
const ANIM_FIELDS = [['speed', 'Animation speed, everyone (1.0 = as designed)', 0.5, 2], ['fast', 'Speed mode: speed multiplier (2.0 = default)', 1, 4], ['fx', 'Speed mode: effects intensity (1.0 = default)', 0, 2]];
const ANIM_DEF = { speed: 1, fast: 2, fx: 1 };
function animCard() {
  const num = k => (ctl.anim && Number.isFinite(Number(ctl.anim[k])) ? Number(ctl.anim[k]) : ANIM_DEF[k]);
  const same = ANIM_FIELDS.every(([k]) => num(k) === ANIM_DEF[k]);
  return `<div class="card ctl" id="animCard"><h2>Pace</h2>
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
const badge = (cls, text) => `<span class="badge ${cls}">${text}</span>`;
function gamesIndex() {
  const ts = Object.keys(GAMES).sort((a, b) => GAMES[a].localeCompare(GAMES[b]));   // alphabetical by the shown name
  const row = t => {
    const k = tuneList(t).length + legacyCount(t);
    return `<li><a class="grow" href="#games/${t}">${gameIcon(t)}<span class="gnm"><b>${esc(GAMES[t])}</b><small>${esc(catName(t))} · ${k} setting${k === 1 ? '' : 's'}</small></span><span class="gbadges">${badge(...STATUS_BADGE[statusOf(t)])}${iosOff(t) ? badge('ios', 'iOS off') : ''}${soonShown(t) ? badge('soon', soonLate(t) ? 'Coming soon · date passed' : 'Coming soon') : ''}${retBadges(t)}${raceOn(t) ? badge('race', 'Race') : ''}${gameChanged(t) ? badge('chg', 'changed') : ''}</span></a></li>`;
  };
  // Three groups, each alphabetical: Released, Testing (admin only), Deprioritized (kept, dealt to nobody).
  const rows = STATUS.map(([k, lab]) => { const g = ts.filter(t => statusOf(t) === k); return g.length ? `<h3 class="ggrp" id="ggrp-${k}">${lab} <small>${g.length}</small></h3><ul class="glist">${g.map(row).join('')}</ul>` : ''; }).join('');
  return retireCard() + `<div class="card" id="gamesCard"><div class="row"><h2>Mini-games</h2><span class="note" style="margin:0">${ts.length} games · ${ts.filter(isReleased).length} released</span></div>
    ${rows}
    <p class="note">Each game's page: its release switches (the web's Released or Admin only; iOS on or off), its Mode where it has one (Shared or Race), every setting and, where it has one, its tuning card, then Save, Reset to defaults and Test play. A change applies to squares dealt from then on (a square under way keeps the values it was dealt with). "changed": a setting saved with a value other than the code's default.</p></div>`;
}
// The Mode switch of a race game (core/race.js RACE_TYPES): the TUNE 'mode' setting, shown as a switch of its own at the top
// of the page, saved with the rest by Save (a square under way keeps its mode; two people on one phone always play Shared).
function modeCard(t) {
  const f = tuneList(t).find(x => x.k === 'mode');
  if (!f || !isRaceGame(t)) return '';
  const v = raceOn(t) ? 'race' : 'shared';
  const opt = (o, label, line) => `<label class="modeopt"><input type="radio" name="mode" value="${o}" data-tune="${t}" data-k="mode"${v === o ? ' checked' : ''}><b>${label}</b><small>${line}</small></label>`;
  return `<div class="card ctl" id="modeCard"><div class="row"><h2>Mode</h2>${v === 'race' ? badge('race', 'Race') : badge('shared', 'Shared')}</div>
    <div class="modesw" role="radiogroup" aria-label="Mode">${opt('shared', 'Shared', 'One board: both players see every guess and clue.')}${opt('race', 'Race', 'The same target, private guesses: each sees only a shape of the other\'s progress.')}</div>
    <p class="note">Saved with the settings below (Save); dealt into squares from then on. Default: Shared.</p></div>`;
}
function gamePage(t) {
  const fields = tuneList(t).filter(f => f.k !== 'mode' || !isRaceGame(t)), saved = (ctl.tune && ctl.tune[t]) || {}, own = legacyCard(t);
  const inp = f => {
    const v = saved[f.k] !== undefined ? saved[f.k] : f.def, ch = saved[f.k] !== undefined && saved[f.k] !== f.def;
    const box = f.opts ? `<select data-tune="${t}" data-k="${f.k}">${f.opts.map(o => `<option value="${esc(o)}"${String(o) === String(v) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : `<input type="number" inputmode="decimal" data-tune="${t}" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${esc(v)}">`;
    return `<label class="rf${ch ? ' chg' : ''}"><span>${esc(f.label)}</span>${box}<small>Default ${esc(f.def)}${f.opts ? '' : ` · ${f.min}–${f.max}`}</small></label>`;
  };
  const groups = TGROUPS.concat([...new Set(fields.map(f => f.group).filter(g => !TGROUPS.includes(g)))]).map(g => [g, fields.filter(f => (f.group || 'Rules') === g)]).filter(([, fs]) => fs.length);
  const body = fields.length ? groups.map(([g, fs]) => `<h3>${esc(g)}</h3><div class="rform tform">${fs.map(inp).join('')}</div>`).join('') : `<p class="note">${own ? 'No settings beyond its tuning above.' : 'No settings.'}</p>`;
  const any = fields.length || own || isRaceGame(t);
  const ver = BAL ? BAL.versionCard(t, ctl.versions, ctl.versionLog, k => { const f = tuneList(t).find(x => x.k === k); return f ? f.label : k; }) : '';
  return `<div class="gpage" id="gamePage" data-game="${t}">${releaseCard(t)}${lineupCard(t)}${modeCard(t)}${own}
    <div class="card ctl" id="tuneCard"><h2>Settings</h2>${presetRow(t)}${body}
      <div class="tbar"><button class="btn go" data-gamesave="${t}"${any ? '' : ' disabled'}>Save</button><button class="btn" data-tunereset="${t}">Reset to defaults</button><button class="btn tplay" data-testplay="${t}" title="Opens the game alone in a new tab with this page's values, saved or not (the live settings are not touched)">Test play</button><span class="unsaved" role="status"></span></div>
      <p class="note">Save (a new settings version): every value on this page${own ? ' (the tuning card\'s too)' : ''}${isRaceGame(t) ? ', the Mode included,' : ''} to the game and the server at once, for squares dealt from then on; only what differs from the defaults is kept. Reset to defaults: every value on this page back to the code's${own ? ' (the tuning card\'s too)' : ''}. Test play: a game of it alone against the computer on Hard, in a new tab, with the values as they are here, saved or not; back here when it ends.</p></div>${ver}</div>`;
}
// A game's presets (its meta.js PRESETS: { name: { k: value, ... } }, e.g. Shell Game's Gentle, Normal, Brutal): a button
// each, which fills those settings' fields on the page (marked unsaved, as any edit: nothing is saved until Save, and
// each value can be changed by hand after); the one whose values the page holds now is lit.
function presetRow(t) {
  const ps = META[t] && META[t].PRESETS;
  if (!ps) return '';
  const saved = (ctl.tune && ctl.tune[t]) || {}, now = Object.assign(TUNE.tuneDefaults(t), saved);
  const is = n => Object.keys(ps[n]).every(k => String(now[k]) === String(ps[n][k]));
  return `<div class="presets" role="group" aria-label="Difficulty presets"><span>Difficulty presets</span>${Object.keys(ps).map(n => `<button class="btn${is(n) ? ' on' : ''}" data-preset="${esc(n)}" data-pgame="${t}" aria-pressed="${is(n)}">${esc(n)}</button>`).join('')}<small>${esc((META[t] && META[t].PRESET_NOTE) || 'Fills the fields below; change any by hand, then Save.')}</small></div>`;
}
function applyPreset(t, name, btn) {
  const p = META[t] && META[t].PRESETS && META[t].PRESETS[name];
  if (!p) return;
  for (const el of app.querySelectorAll(`[data-tune="${t}"]`)) {
    const v = p[el.dataset.k];
    if (v === undefined || String(el.value) === String(v)) continue;
    el.value = String(v); dirtyMark(el);
  }
  for (const b of app.querySelectorAll('[data-preset]')) { const on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
}
// ---------- my devices (Settings; December 2026): an owner device (devmeta/{key}: functions/statsRules.js metaFor, a whole
// hash or a prefix of one) and every match with it in are left out of every number until Include my devices. Each device's
// nickname and Excluded switch are on its person's page (Players); here: exclude one by its ID before it is seen, the owner
// link (admin/ownerToken: /?owner=<token> marks whichever device opens it, functions/index.js markDevice), and the list. ----------
const devWhy = { set: 'set by a deploy', admin: 'signed in as admin', self: 'marked in Settings', link: 'opened the owner link', manual: 'added here' };
function ownerCard() {
  const site = location.origin && /^https?:/.test(location.origin) ? location.origin : (STAGING ? 'https://staging.tictacchaos.com' : 'https://tictacchaos.com');
  const link = ownerToken ? `${site}/?owner=${ownerToken}` : '', devs = model ? [...model.devs.values()] : [];
  const rows = Object.entries(devmeta || {}).filter(([, v]) => v && v.ex === true).map(([k, v]) => { const hit = devs.filter(d => d.h.startsWith(k)); return { k, v, hit }; }).sort((a, b) => String(a.v.nick || '').localeCompare(String(b.v.nick || '')));
  return `<div class="card ctl" id="ownerCard"><h2>My devices</h2>
    <p class="note">A device of mine, and any match with it in, is left out of every number until <b>Include my devices</b> is ticked in a page's filters. A device that signs in to an admin account is excluded by itself, for good. Every other device's nickname and switch are on its player's page (Players).</p>
    <h3>Exclude a device</h3><div class="row exrow"><input id="exId" placeholder="Device ID, e.g. 0200d915" maxlength="40" aria-label="Device ID"><input id="exNick" placeholder="Nickname" maxlength="40" aria-label="Nickname"><button class="btn" data-act="exadd">Exclude</button></div>
    ${devMsg ? `<p class="note">${esc(devMsg)}</p>` : ''}<p class="note">The ID is the one the game's Settings shows (or more of it).</p>
    <h3>Owner link</h3><div class="row">${link ? `<code class="olink">${esc(link)}</code><button class="btn sm" data-act="ownercopy">Copy</button>` : '<span class="dim">No link yet.</span>'}<button class="btn sm" data-act="ownertok">${link ? 'Make a new link' : 'Make the link'}</button></div>
    <p class="note">Open it on a device of yours to exclude it without logging in. Anyone with it can exclude their own device, so keep it to yourself; a new link stops the old one.</p>
    <h3>Excluded now</h3><div class="tbl"><table><thead><tr><th style="text-align:left">Nickname</th><th>Device ID</th><th>Why</th><th>Seen as</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td style="text-align:left">${esc(r.v.nick || '')}</td><td><code>${esc(r.k.slice(0, 8))}</code></td><td>${esc(devWhy[r.v.why] || r.v.why || '')}</td>
      <td>${r.hit.length ? r.hit.map(d => `<a href="#players/${encodeURIComponent(d.pid)}">${esc((model.people.get(d.pid) || {}).name || d.short)}</a>`).join(', ') : '<span class="dim">not seen yet</span>'}</td><td><label class="sw"><input type="checkbox" data-devex="${esc(r.k)}" checked aria-label="Excluded"> <span>Excluded</span></label></td></tr>`).join('') || '<tr><td colspan="5" class="dim">None</td></tr>'}</tbody></table></div></div>`;
}
// A device's entry written whole (devmeta/{key}: the rules want ex with it): the nickname and switch kept from the entry that
// named it (a prefix's), written to the device's own hash so a prefix's other devices are untouched.
async function metaPut(key, patch) {
  const cur = devmeta[key] || (P && P.X.metaFor(devmeta, key)) || {}, next = { ex: !!cur.ex, at: cur.at || Date.now() };
  if (cur.nick) next.nick = cur.nick;
  if (cur.why) next.why = cur.why;
  Object.assign(next, patch);
  if (!next.nick) delete next.nick;
  await fb.dbM.set(fb.dbM.ref(fb.db, `devmeta/${key}`), next);
  devmeta = Object.assign({}, devmeta, { [key]: next });
  if (raw) { raw.meta = devmeta; rebuild(); }
}
async function nickSave(b) {
  const key = b.dataset.key, i = document.getElementById('nickIn'), v = i ? i.value.trim().slice(0, 40) : '';
  b.disabled = true;
  try { await metaPut(key, { nick: v }); devEdit = null; devMsg = ''; } catch (e) { devMsg = 'Could not save the nickname.'; }
  render();
}
async function devExclude(key, on, el) {
  el.disabled = true;
  try { await metaPut(key, Object.assign({ ex: !!on }, on && !(devmeta[key] && devmeta[key].why) ? { why: 'manual' } : {})); devMsg = ''; } catch (e) { devMsg = 'Could not change it.'; }
  render();
}
async function exAdd(b) {
  const idIn = document.getElementById('exId'), nkIn = document.getElementById('exNick');
  let key = metaKey(idIn && idIn.value);
  if (!key) { devMsg = 'A device ID is 6 to 20 letters and numbers (0-9, a-f), as Settings shows it.'; render(); return; }
  const hits = Object.keys((raw || {}).devices || {}).filter(h => h.startsWith(key));
  if (hits.length === 1) key = hits[0];                          // (one device answers to it: its own hash)
  b.disabled = true;
  try {
    await metaPut(key, { ex: true, why: 'manual', at: Date.now(), nick: (nkIn && nkIn.value.trim().slice(0, 40)) || (devmeta[key] && devmeta[key].nick) || '' });
    devMsg = `${key.slice(0, 8)} excluded${hits.length > 1 ? ` (${hits.length} devices start with it)` : hits.length ? '' : ' (no device seen with it yet: it is excluded once it shows up)'}.`;
  } catch (e) { devMsg = 'Could not save it.'; }
  render();
}
async function ownerTok(b) {
  if (ownerToken && !confirm('Make a new link? The old one stops working.')) return;
  const tok = Array.from(crypto.getRandomValues(new Uint8Array(18)), x => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[x & 63]).join('');
  b.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'admin/ownerToken'), tok); ownerToken = tok; devMsg = ''; } catch (e) { devMsg = 'Could not make the link.'; }
  render();
}
async function ownerCopy(b) {
  const el = app.querySelector('.olink');
  try { await navigator.clipboard.writeText(el ? el.textContent : ''); b.textContent = 'Copied'; } catch (e) { b.textContent = 'Copy failed'; }
}
// Settings versions (December 2026): every Save or Reset of a game's settings makes a new version (config/versions/<type>,
// its number; config/versionLog/<type>/v<n>: when, by whom, what changed), so the squares dealt from then on are filed under
// it (core/tune.js; the game's numbers are shown by version). The first Save makes version 2: v1 is everything before.
async function bumpVersion(t, ch, note) {
  const ref = fb.dbM.ref(fb.db, `config/versions/${t}`);
  const r = await fb.dbM.runTransaction(ref, cur => (Number.isInteger(cur) && cur >= 1 ? cur : 1) + 1);
  const n = r.snapshot.val(), clean = {};
  for (const [k, c] of Object.entries(ch || {})) clean[k] = { from: typeof c.from === 'number' ? c.from : String(c.from), to: typeof c.to === 'number' ? c.to : String(c.to) };
  const entry = Object.assign({ at: Date.now(), by: String((user && user.email) || 'admin').slice(0, 80), ch: clean }, note ? { note: String(note).slice(0, 200) } : {});
  await fb.dbM.set(fb.dbM.ref(fb.db, `config/versionLog/${t}/v${n}`), entry);
  ctl.versions = Object.assign({}, ctl.versions, { [t]: n });
  ctl.versionLog = Object.assign({}, ctl.versionLog, { [t]: Object.assign({}, (ctl.versionLog || {})[t], { ['v' + n]: entry }) });
  return n;
}
// A tuning card's change, as the log puts it: each top-level value that differs (an object as its JSON, cut short).
function cardChanges(before, after) {
  const a = before && typeof before === 'object' ? before : {}, b = after && typeof after === 'object' ? after : {}, out = {};
  const show = v => (v === undefined ? 'default' : typeof v === 'number' || typeof v === 'string' ? v : JSON.stringify(v).slice(0, 60));
  for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out['card.' + k] = { from: show(a[k]), to: show(b[k]) };
  return out;
}
// Save: the page's TUNE values (config/tune/<type>, the values that differ from the defaults alone) and its tuning card's
// (config/<name>, the card's own shape), each written only where it changed; the mode rides the TUNE values.
async function saveGame(t, btn) {
  const out = {};
  for (const el of app.querySelectorAll(`[data-tune="${t}"]`)) {
    if (el.type === 'radio' && !el.checked) continue;
    const f = tuneList(t).find(x => x.k === el.dataset.k), v = f && TUNE.tuneValue(f, el.value);
    if (!f) continue;
    if (v === null || (!f.opts && Number(el.value) !== v)) { said(btn, false, `${f.label}: ${f.opts ? 'one of ' + f.opts.join(', ') : `a number from ${f.min} to ${f.max}${f.step && f.step !== 1 ? ` in steps of ${f.step}` : ''}`}`); return; }
    out[f.k] = v;
  }
  const bad = META[t] && typeof META[t].tuneCheck === 'function' && META[t].tuneCheck(Object.assign(TUNE.tuneDefaults(t), out));   // (the game's own check of its values together)
  if (bad) { said(btn, false, bad); return; }
  const norm = TUNE.tuneNorm(t, out), own = legacyRead(t);
  if (own && own.err) { said(btn, false, own.err); return; }
  const tuneDiff = canon(norm) !== canon((ctl.tune && ctl.tune[t]) || {}), ownDiff = !!own && canon(own.value) !== canon(legacyStored(t) || {});
  if (!tuneDiff && !ownDiff) { said(btn, true, 'Nothing to save'); return; }
  btn.disabled = true;
  const changes = Object.assign(tuneDiff ? TUNE.tuneChanges(t, (ctl.tune && ctl.tune[t]) || {}, norm) : {}, ownDiff ? cardChanges(legacyStored(t), own.value) : {});
  try {
    if (tuneDiff) {
      await fb.dbM.set(fb.dbM.ref(fb.db, `config/tune/${t}`), Object.keys(norm).length ? norm : null);
      const back = (await fb.dbM.get(fb.dbM.ref(fb.db, `config/tune/${t}`))).val() || {};   // (read back: what the game and the server will deal with)
      if (canon(TUNE.tuneNorm(t, back)) !== canon(norm)) throw new Error('the database kept different values; reload and try again');
      ctl.tune = Object.assign({}, ctl.tune, { [t]: norm });
      if (!Object.keys(norm).length) delete ctl.tune[t];
    }
    if (ownDiff) { await fb.dbM.set(fb.dbM.ref(fb.db, legacyPath(t)), own.value); legacyKeep(t, own.value); }
    await bumpVersion(t, changes);                                   // (a new settings version: the squares dealt from now on are filed under it)
  } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(app.querySelector(`[data-gamesave="${t}"]`) || btn, true, 'Saved');
}
// Reset to defaults: the game's config/tune/<type> and its tuning card's node go (the code's defaults then apply), after a confirm.
async function resetGame(t, btn) {
  if (!confirm(`Put every ${GAMES[t]} setting back to its default? Squares dealt from then on use the defaults.`)) return;
  btn.disabled = true;
  try {
    const changes = Object.assign(TUNE.tuneChanges(t, (ctl.tune && ctl.tune[t]) || {}, {}), legacyPath(t) ? cardChanges(legacyStored(t), null) : {});
    await fb.dbM.set(fb.dbM.ref(fb.db, `config/tune/${t}`), null);
    if (legacyPath(t)) await fb.dbM.set(fb.dbM.ref(fb.db, legacyPath(t)), null);
    await bumpVersion(t, changes, 'Reset to defaults');
    await loadCtl();
  } catch (e) { said(btn, false, 'Not reset: ' + ((e && e.message) || 'the database refused it')); return; }
  render(); said(app.querySelector(`[data-tunereset="${t}"]`) || btn, true, 'Back to the defaults');
}
// An edit on a game's page: the field and the page are marked until Save or Reset redraws it.
const EDIT_SEL = '[data-tune], [data-runcfg], [data-bullcfg], [data-plinkocfg], [data-pigcfg], [data-roadscfg], [data-oddcfg], [data-wheelcfg], [data-attcfg], [data-fingcfg]';
function dirtyMark(el) {
  if (!el || !el.closest || !el.matches || !el.matches(EDIT_SEL)) return;
  const page = el.closest('#gamePage');
  if (!page) return;
  const lab = el.closest('label'); if (lab) lab.classList.add('dirty');
  page.classList.add('dirty');
  const u = page.querySelector('.unsaved'); if (u) u.textContent = 'Unsaved changes';
}
// ---------- the timer (config/timer/spec, read by the server and the game): Find Match's timer and the friend-game default.
// A code: 't30', 't60' (seconds a turn), 'm5+2' (minutes each, seconds added a move: a match clock); core/timer.js timerSpec ----------
const TIMER_DEF = 'm5+5';   // (core/timer.js TIMER_DEFAULT: none set)
function timerParts(v) {
  const m = /^m(\d+)\+(\d+)$/.exec(String(v || '')), t = /^t(\d+)$/.exec(String(v || ''));
  return m ? { kind: 'match', mins: +m[1], inc: +m[2] } : t ? { kind: 'turn', secs: +t[1] } : { kind: 'off' };
}
function timerName(v) {
  const p = timerParts(v);
  return p.kind === 'match' ? `Match clock ${p.mins} min${p.inc ? ` + ${p.inc}s/move` : ''}` : p.kind === 'turn' ? `${p.secs}s/turn` : 'No limit';
}
function timerCard() {
  const cur = (ctl.timer && /^(t30|t60|m(3|5|10)\+(0|2|5))$/.test(ctl.timer.spec)) ? ctl.timer.spec : TIMER_DEF, p = timerParts(cur);
  const sel = (id, opts, v) => `<select id="${id}">${opts.map(([o, l]) => `<option value="${o}"${String(o) === String(v) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<div class="card ctl" id="timerCard"><h2>Timer</h2>
    <p class="note">Find Match's timer, and the one a friend game starts with. Players choose only a match clock of 3, 5 or 10 minutes (+5 s a move) or No limit: a friend game starts with this one when it is one of those, else 5 minutes. A time per turn and the other increments are for testing (here and in your own lobby). <b>Per turn</b>: each turn has this long (a game that needs longer gets 60 s); two missed turns in a row lose the match. <b>Match clock</b>: chess style, each player has this many minutes for the whole match; only the clock of the player on the move runs, and only once they can act (never during a replay or an animation); the increment is added after every move; a player whose clock reaches zero loses ("[name] ran out of time"). Applies to matches started from now on. As admin you can also pick any timer in your own friend room's lobby.</p>
    <div class="fields"><label>Type ${sel('tmKind', [['turn', 'Per turn'], ['match', 'Match clock']], p.kind)}</label>
      ${p.kind === 'match' ? `<label>Minutes each ${sel('tmMins', [[3, '3'], [5, '5'], [10, '10']], p.mins)}</label><label>Increment ${sel('tmInc', [[0, '+0 s'], [2, '+2 s'], [5, '+5 s']], p.inc)}</label>`
        : `<label>Seconds a turn ${sel('tmSecs', [[30, '30'], [60, '60']], p.secs)}</label>`}</div>
    <p class="note">Now: <b>${esc(timerName(cur))}</b>${cur === TIMER_DEF ? ' (the default)' : ''}.</p></div>`;
}
async function saveTimer() {
  const kind = (document.getElementById('tmKind') || {}).value, val = id => Number((document.getElementById(id) || {}).value);
  const was = timerParts((ctl.timer && ctl.timer.spec) || TIMER_DEF);
  const spec = kind === 'match' ? `m${was.kind === 'match' && document.getElementById('tmMins') ? val('tmMins') : 5}+${was.kind === 'match' && document.getElementById('tmInc') ? val('tmInc') : 5}`
    : `t${was.kind === 'turn' && document.getElementById('tmSecs') ? val('tmSecs') : 30}`;
  const el = document.getElementById('tmKind');
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/timer'), spec === TIMER_DEF ? null : { spec }); ctl.timer = spec === TIMER_DEF ? {} : { spec }; } catch (e) { render(); said(el, false, failed(e)); return; }
  render(); said(document.getElementById('tmKind') || el, true, 'Saved: ' + timerName(spec));
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
  const list = Object.values(ctl.bots || {}).sort((x, y) => String(x.key).localeCompare(String(y.key)));
  return `<div class="card ctl" id="botsCard"><div class="row"><h2>Bots</h2></div>
    <p class="note">When someone has searched Find Match alone for about 20 seconds, the search screen offers them the computer. If they take it, a bot plays them, shown as "Computer", and the results say they played the computer; it never counts on their Find Match record. Nobody is paired with a bot unasked (December 2026: the hidden bots, their waits and the record switch are gone).</p>
    <div class="fields">
      <label>Bots play at <select data-cfg="bots.level">${[['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']].map(([v, l]) => `<option value="${v}"${cfgGet('bots', 'level') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
    <p class="note">The computer's levels, as in Play Local: Easy is Normal with a careless move now and then; Normal the computer as it has always played, each bot with its own style; Hard searches inside the mini-games and plays the rest of the match out (Monte Carlo) before choosing its square, within about 0.3 s a move. The default for new bot matches; a match under way keeps its level.</p>
    <p class="note">How often the computer is taken, and how those matches end: <a href="#health">Health</a>, Find Match.</p>
    ${list.length ? `<div class="tbl" style="margin-top:8px"><table><thead><tr><th>Bot account</th><th style="text-align:left">Plays like</th></tr></thead><tbody>${list.map(x => `<tr><td>${esc(x.username)}</td><td style="text-align:left;white-space:normal">${esc(x.about || '')}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="note">The five bot accounts are made the first time a bot is needed. Their styles and pace are set in functions/bots.js.</p>'}</div>`;
}
// ---------- the computer's difficulty (config/ai): each level's settings and the search's, read by the game and the server (src/core/aiw.js; docs/ai.md) ----------
// (its own copy of the defaults and limits: tests/core/admin-sync.test.js holds it to AI_DEFAULTS and AI_LIMITS)
const AI_LEVELS = [['hard', 'Hard'], ['normal', 'Normal'], ['easy', 'Easy']];
const AI_LV = [['Search', 'Search (playouts a square)', 0, 4000, 10], ['Sharp', 'Sharpness (%)', 0, 100, 1], ['Mistake', 'Mistakes (%)', 0, 80, 1], ['Risk', 'Risk appetite', -6, 8, 1]];
const AI_DEF = { attack: 1, defend: 1, explore: 0.25, prog: 0.8, fresh: 3.5, drop: 2.5, margin: 2, budget: 300, hardSearch: 1200, hardSharp: 100, hardMistake: 0, hardRisk: 0, normalSearch: 300, normalSharp: 85, normalMistake: 0, normalRisk: 0, easySearch: 0, easySharp: 0, easyMistake: 30, easyRisk: 0 };
const AI_W = [['attack', 'Line value (own lines)', 0.2, 3, 0.05], ['defend', 'Defence priority', 0.2, 3, 0.05], ['explore', 'Playout exploring', 0, 0.8, 0.05], ['prog', 'Playout progress chance', 0.3, 1, 0.05], ['fresh', 'Turns needed in a reset square', 1.5, 6, 0.25], ['drop', 'Search: let go of a square (standard errors)', 0, 6, 0.25], ['margin', 'Tempo play: safe lead (turns)', 1, 5, 0.5], ['budget', 'Time a decision (ms)', 50, 1000, 10]];
const aiFields = () => AI_LEVELS.flatMap(([l]) => AI_LV.map(([k, , lo, hi, step]) => [l + k, lo, hi, step])).concat(AI_W.map(([k, , lo, hi, step]) => [k, lo, hi, step]));
function aiCard() {
  const w = ctl.ai || {}, set = Object.keys(w).filter(k => k in AI_DEF).length, val = k => (w[k] != null ? w[k] : AI_DEF[k]);
  const inp = (k, lo, hi, step) => `<input type="number" data-aik="${k}" min="${lo}" max="${hi}" step="${step}" value="${esc(val(k))}" aria-label="${k}"${w[k] != null && w[k] !== AI_DEF[k] ? ' class="chg"' : ''}>`;
  const lvRows = AI_LEVELS.map(([l, name]) => `<tr><td style="text-align:left"><b>${name}</b></td>${AI_LV.map(([k, , lo, hi, step]) => `<td>${inp(l + k, lo, hi, step)}</td>`).join('')}</tr>`).join('');
  return `<div class="card ctl" id="aiCard"><div class="row"><h2>Computer difficulty</h2><span class="note" style="margin:0">${set ? `${set} changed${w.tuned ? ` · tuned ${P.when(w.tuned)}` : ''}` : 'the code\'s defaults'}</span></div>
    <p class="note">One engine plays all three levels (and the bots, at their level). <b>Search</b>: playouts of the rest of the match for each open square when it chooses where to play (0: it weighs the squares one step ahead, no search). <b>Sharpness</b>: how often it plays a square with its strongest tactics (its tables and searches) rather than the plain ones. <b>Mistakes</b>: how often it makes a careless move (any legal move, anywhere). <b>Risk appetite</b>: points added to what it banks at in the push-your-luck games (bolder above zero).</p>
    <div class="tbl"><table><thead><tr><th style="text-align:left">Level</th>${AI_LV.map(x => `<th>${x[1]}</th>`).join('')}</tr></thead><tbody>${lvRows}</tbody></table></div>
    <h3>The search</h3><p class="note">Shared by every level that searches. Time a decision: the most a decision may take on a phone or the server (it stops searching then). Tempo play: a square it leads by more than this many turns can wait while it plays elsewhere; it comes back once the lead is down to the margin.</p>
    <div class="rform">${AI_W.map(([k, label, lo, hi, step]) => `<label class="rf"><span>${label}</span>${inp(k, lo, hi, step)}<small>Default ${AI_DEF[k]} · ${lo}–${hi}</small></label>`).join('')}</div>
    <div class="rform"><button class="btn" data-aisave="1">Save</button><button class="btn" data-airesets="1"${set ? '' : ' disabled'}>Reset to defaults</button></div></div>`;
}
async function saveAi(btn) {
  const next = {};
  for (const [k, lo, hi, step] of aiFields()) {
    const el = app.querySelector(`input[data-aik="${k}"]`); if (!el) continue;
    const v = Number((Math.round(Number(el.value) / step) * step).toFixed(4));
    if (el.value === '' || !Number.isFinite(v) || v < lo || v > hi) { said(btn, false, `${k}: from ${lo} to ${hi}`); return; }
    if (v !== AI_DEF[k]) next[k] = v;
  }
  for (const k of ['tuned', 'matches']) if (ctl.ai && ctl.ai[k] != null) next[k] = ctl.ai[k];
  btn.disabled = true;
  try { await fb.dbM.set(fb.dbM.ref(fb.db, 'config/ai'), Object.keys(next).length ? next : null); ctl.ai = next; } catch (e) { said(btn, false, failed(e)); return; }
  render(); said(app.querySelector('[data-aisave]') || btn, true, 'Saved');
}
async function resetAi(btn) {
  if (!confirm('Put the computer\'s difficulty settings back to the code\'s defaults?')) return;
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
    <p class="note">When someone has searched for this many seconds and nobody else is searching, you get a text and/or an email with a link straight into Find Match. It comes before the computer is offered to them (about 20 s in), so you have until then to join. Your own searches never alert you.</p>
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
  raw = null; model = null;
  if (!user) { view.status = 'signin'; render(); return; }
  view = { status: 'loading', error: '' }; render();
  const tok = await fb.authM.getIdTokenResult(user, true).catch(() => null);   // fresh: a flag given a moment ago counts
  if (!tok || tok.claims.admin !== true) { view = { status: 'denied', error: '' }; render(); return; }
  await load();
}
// Everything the pages count, read once as rows (each part on its own: one refused or missing leaves the rest): the matches
// and Find Match searches of the last 90 days (mfacts/{day}, finds/{day}: the server keeps no more), the devices and their
// events, the accounts, the problem reports, the match logs' index (the latest 500 and every reported one), my devices.
const ROW_DAYS = 92;
async function load() {
  try {
    const M = fb.dbM, g = p => M.get(M.ref(fb.db, p)).then(x => x.val()).catch(() => null);
    const since = new Date(Date.now() - ROW_DAYS * 864e5).toISOString().slice(0, 10);
    const days = p => M.get(M.query(M.ref(fb.db, p), M.orderByKey(), M.startAt(since))).then(x => x.val()).catch(() => null);
    const ix = (ord, lim) => M.get(M.query(M.ref(fb.db, 'matchLogIndex'), M.orderByChild(ord), ...lim)).then(x => x.val()).catch(() => null);
    const probe = await M.get(M.ref(fb.db, 'devmeta'));      // (the admin's alone: refused = not the admin yet)
    await loadMetas();
    if (!PS) PS = await import('./src/ui/pstats.js').catch(() => null);
    const [mf, fi, devices, logs, users, local, seen, reports, mlRecent, mlRep, fl, tok, tpl] = await Promise.all([days('mfacts'), days('finds'), g('devices'), g('devlog'), g('users'), g('localStats'), g('lastSeen'), g('reports'),
      ix('last', [M.limitToLast(500)]), ix('reported', [M.startAt(1), M.limitToLast(200)]), g('review/flaggedNames'), g('admin/ownerToken'), g(`templates/${user.uid}`)]);
    await loadCtl();
    devmeta = probe.val() || {}; ownerToken = typeof tok === 'string' ? tok : null; flagged = fl; templates = tpl || {}; mlEvents = {};
    setRaw({ matches: mf || {}, finds: fi || {}, devices: devices || {}, logs: logs || {}, users: users || {}, local: local || {}, seen: seen || {}, reports: reports || {}, logIndex: Object.assign({}, mlRecent || {}, mlRep || {}) });
    view = { status: 'ready', error: '' };
  } catch (e) {
    view = { status: 'denied', error: /permission/i.test(String(e && (e.code || e.message))) ? 'The database refused: the admin flag is not on this account yet.' : 'Could not load the dashboard.' };
  }
  render();
}
function setRaw(d) {
  raw = Object.assign({ matches: {}, finds: {}, devices: {}, logs: {}, users: {}, local: {}, seen: {}, reports: {}, logIndex: {} }, d, { meta: devmeta, bots: ctl.bots || {} });
  accts = { users: raw.users, local: raw.local, seen: raw.seen };
  rebuild();
}
async function loadCtl() {
  const g = p => fb.dbM.get(fb.dbM.ref(fb.db, p)).then(s => s.val()).catch(() => null);
  const [config, secretsSet, bots, botStats, alertStats, features, log, releases, runCfg, bullsCfg, wheelsCfg, plinkoCfg, oddCfg, headCfg, flashCfg, snapCfg, hopCfg, scoopCfg, pinCfg, pigCfg, roadsCfg, bowlCfg] = await Promise.all([g('admin/config'), g('admin/secretsSet'), g('bots'), g('botStats'), g('alertStats'), g('features'),
    fb.dbM.get(fb.dbM.query(fb.dbM.ref(fb.db, 'alertLog'), fb.dbM.orderByChild('at'), fb.dbM.limitToLast(8))).then(s => s.val()).catch(() => null), g('releases'), g('config/run'), g('config/bulls'), g('config/wheels'), g('config/plinko'), g('config/oddone'), g('config/headcount'), g('config/flash'), g('config/snapshot'), g('config/skyhop'), g('config/scoop'), g('config/pinball'), g('config/pig'), g('config/roads'), g('config/bowling'), loadMetas()]);
  ctl = { config: config || {}, secretsSet: secretsSet || {}, bots: bots || {}, botStats: botStats || {}, alertStats: alertStats || {}, features: features || {}, releases: releases || {}, runCfg: runCfg || {}, bullsCfg: bullsCfg || {}, wheelsCfg: wheelsCfg || {}, plinkoCfg: plinkoCfg || {}, pigCfg: pigCfg || {}, roadsCfg: roadsCfg || {}, oddCfg: oddCfg || {}, attCfg: { headcount: headCfg || {}, flash: flashCfg || {}, snapshot: snapCfg || {} }, fingCfg: { skyhop: hopCfg || {}, scoop: scoopCfg || {}, bowling: bowlCfg || {}, pinball: pinCfg || {} },
    alertLog: Object.values(log || {}).sort((a, b) => b.at - a.at), tune: (await g('config/tune')) || {}, lineup: (await g('config/lineup')) || {}, versions: (await g('config/versions')) || {}, versionLog: (await g('config/versionLog')) || {}, ai: (await g('config/ai')) || {}, anim: (await g('config/anim')) || {}, timer: (await g('config/timer')) || {}, clients: (await g('config/clients')) || {}, allow: STAGING ? ((await g('admin/staging/allow')) || {}) : {}, stagingMode: STAGING ? ((await g('config/staging/mode')) === 'open' ? 'open' : 'allowlist') : 'allowlist' };
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
// A table's controls (src/admin/table.js): its state is the page's (tstates), so a redraw keeps the sort, search and filters.
function tableAct(b) {
  const d = b.dataset, id = d.tsort || d.tfilt || d.tclear || d.tall || d.tcsv;
  if (!id || !P) return false;
  const st = tstate(id);
  if (d.tsort) P.T.sortBy(st, P.T.colsOf(id), d.k);
  else if (d.tfilt) st.open = !st.open;
  else if (d.tclear) { st.q = ''; st.filt = {}; }
  else if (d.tall) st.all = true;
  else if (d.tcsv) { download(`${id.replace(/[^\w-]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`, P.T.csvOf(id), 'text/csv'); return true; }
  render();
  return true;
}
function download(name, text, type) {
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
// A definition's "?" (data-tip): its one line beside it while the pointer or the focus is on it, or after a tap.
let tipEl = null;
function tipShow(i) {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
  tipEl.textContent = i.dataset.tip; tipEl.hidden = false;
  const r = i.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, vw = document.documentElement.clientWidth;
  tipEl.style.left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  tipEl.style.top = (r.top - h - 8 < 4 ? r.bottom + 8 : r.top - h - 8) + 'px';
}
const tipHide = () => { if (tipEl) tipEl.hidden = true; };
const tipOf = e => (e.target.closest ? e.target.closest('[data-tip]') : null);
app.addEventListener('mouseover', e => { const i = tipOf(e); if (i) tipShow(i); });
app.addEventListener('mouseout', e => { if (tipOf(e)) tipHide(); });
app.addEventListener('focusin', e => { const i = tipOf(e); if (i) tipShow(i); });
app.addEventListener('focusout', tipHide);
window.addEventListener('scroll', tipHide, { passive: true });
app.addEventListener('click', e => {
  const tip = tipOf(e);
  if (tip) { tipShow(tip); return; }
  tipHide();
  const b = e.target.closest('button'), jump = !b && e.target.closest('a[data-jump]');
  if (jump) { e.preventDefault(); const el = document.getElementById(jump.dataset.jump); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }   // (Settings: a card on the page)
  if (!b) {                                                  // a row that opens something (a person, a match): anywhere on it but a link or a control
    const tr = e.target.closest('tr[data-go]');
    if (tr && !e.target.closest('a, input, select, label, button')) location.hash = tr.dataset.go;
    return;
  }
  if (!fb) return;
  if (tableAct(b)) return;
  if (b.dataset.nick) { devEdit = b.dataset.nick; devMsg = ''; render(); const i = document.getElementById('nickIn'); if (i) { i.focus(); i.select(); } return; }
  if (b.dataset.act === 'nicksave') { nickSave(b); return; }
  if (b.dataset.act === 'nickcancel') { devEdit = null; render(); return; }
  if (b.dataset.act === 'exadd') { exAdd(b); return; }
  if (b.dataset.act === 'ownertok') { ownerTok(b); return; }
  if (b.dataset.act === 'ownercopy') { ownerCopy(b); return; }
  if (b.dataset.act === 'goback') { history.back(); return; }
  if (b.dataset.tpldel) { tplDelete(b); return; }
  if (b.dataset.allowdel) { allowEdit(b, b.dataset.allowdel, false); return; }
  if (b.dataset.stmode) { setStagingMode(b, b.dataset.stmode); return; }
  if (b.dataset.act === 'allowadd') { const i = document.getElementById('allowAdd'); allowEdit(b, i && i.value, true); return; }
  if (b.dataset.mlexport) { mlExport(b.dataset.mlexport); return; }
  if (b.dataset.retclear) { saveRetire(b, true); return; }
  if (b.dataset.abexport) { abExport(); return; }
  if (b.dataset.act === 'google') signIn('google');
  else if (b.dataset.act === 'email') signIn('email');
  else if (b.dataset.act === 'signout') fb.authM.signOut(fb.auth);
  else if (b.dataset.act === 'refresh') { b.disabled = true; load(); }
  else if (b.dataset.act === 'save-keys') saveKeys();
  else if (b.dataset.testplay) testPlay(b.dataset.testplay);
  else if (b.dataset.gamesave) saveGame(b.dataset.gamesave, b);
  else if (b.dataset.lusave) saveLineup(b.dataset.lusave, b, false);
  else if (b.dataset.lureset) saveLineup(b.dataset.lureset, b, true);
  else if (b.dataset.preset) applyPreset(b.dataset.pgame, b.dataset.preset, b);
  else if (b.dataset.tunereset) resetGame(b.dataset.tunereset, b);
  else if (b.dataset.airesets) resetAi(b);
  else if (b.dataset.animsave) saveAnimCfg(b, false);
  else if (b.dataset.aisave) saveAi(b);
  else if (b.dataset.clientsave) saveClients(b);
  else if (b.dataset.animreset) saveAnimCfg(b, true);
  else if (b.dataset.act === 'test-alert') testAlert(b);
});
app.addEventListener('input', e => {
  const d = e.target.dataset || {}, id = d.tq || d.tf;
  if (id && P) {                                             // a table's search or a column's filter: as it is typed, the caret kept
    const st = tstate(id), at = e.target.selectionStart, sel = d.tq ? `input[data-tq="${CSS.escape(id)}"]` : `input[data-tf="${CSS.escape(id)}"][data-k="${CSS.escape(d.k)}"]`;
    if (d.tq) st.q = e.target.value; else st.filt[d.k] = e.target.value;
    render();
    const i = app.querySelector(sel); if (i) { i.focus(); try { i.setSelectionRange(at, at); } catch (x) { /* (a type without a caret) */ } }
    return;
  }
  if (d.lublurb) { const c = document.getElementById('luCount'); if (c) { c.textContent = `${e.target.value.length} / ${LU_MAX}`; c.classList.toggle('over', e.target.value.length > LU_MAX); } return; }   // the Lineup card's line: its count as it is typed
  if (d.gf) return;                                          // (a filter: on its change)
  if (note) { note = null; showNote(); } dirtyMark(e.target);   // (an edit after a save: its note goes; on a game's page the edit is marked unsaved)
});
app.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'nickIn') { e.preventDefault(); const b = app.querySelector('[data-act="nicksave"]'); if (b) b.click(); } else if (e.key === 'Escape' && e.target.id === 'nickIn') { devEdit = null; render(); } });
app.addEventListener('change', e => {
  const d = e.target.dataset || {};
  if (d.gf) { setFilter(d.gf, e.target.type === 'checkbox' ? e.target.checked : e.target.value); return; }   // the page's filters: every page's, kept in this browser
  if (d.tq || d.tf) return;
  if (d.devex) { devExclude(d.devex, e.target.checked, e.target); return; }
  if (['tmKind', 'tmMins', 'tmInc', 'tmSecs'].includes(e.target.id)) saveTimer();
  else if (d.cfg) saveCfg(e.target);
  else if (d.feat) saveFeat(e.target);
  else if (d.rel) saveRelease(e.target);
  else if (d.relios) saveRelIos(e.target);
  else if (d.soon || d.soondate) saveSoon(e.target);
  else if (d.retire) saveRetire(e.target, false);
  else dirtyMark(e.target);   // (a select or the Mode switch on a game's page)
});
if (window.TTT_FIREBASE && window.TTT_FIREBASE.offline) {   // the tests (tests/ui/admin-games.test.mjs): the page's parts without Firebase, the database stood in for
  window.TTC_ADMIN = { get ctl() { return ctl; }, set ctl(v) { ctl = v; }, set fb(v) { fb = v; }, get devmeta() { return devmeta; }, get model() { return model; }, get filters() { return filters; }, get scope() { return scopeOf(); },
    seed(o) { devmeta = o.devmeta || {}; ownerToken = o.token || null; templates = o.templates || {}; flagged = o.flagged || null; setRaw(o); },   // the rows a page counts (src/admin/metrics.js build's data)
    ready() { user = { email: 'test', uid: 'admin' }; view = { status: 'ready', error: '' }; if (!raw) setRaw({}); },
    setFilter, tstate, metaPut, exAdd, loadMetas, loadCtl, draw, render, route, gamesIndex, gamePage, settingsPage, saveGame, resetGame, legacyPath, isReleased, iosOff, gameChanged, raceOn, TEST_TYPES, saveRetire, retireList, saveLineup, saveRelease, statusOf };
} else boot().catch(() => { app.innerHTML = '<div class="card msg"><h1>Tic Tac Chaos Stats</h1><p>Could not load. Check the connection and reload.</p></div>'; });
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false }); document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });   // (iPhone's pinch)
