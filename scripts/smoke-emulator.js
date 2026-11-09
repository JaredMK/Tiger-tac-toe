'use strict';
// Two real phones on the emulators: a friend match played through the page itself (Chromium, Playwright), the real
// functions, database and auth running locally. For every released mini-game: the host opens a room, the friend joins
// with the code, the host taps Start game, and the player on the move opens a square and makes one real move in it;
// the move must show on the mover's phone, the server's record must carry it, and the other phone must play it back.
// Tic-tac-toe, Four in a Row and Hex (the instant moves, net/moves.js PREDICT) are played with a real tap on the
// control; the other games through the page's own attemptMove (their controls differ game by game).
//   npm run smoke:emulator            (firebase emulators:exec runs this script with auth, database and functions)
//   node scripts/smoke-emulator.js ttt,c4     (inside emulators:exec, or with the emulators already running: one or more games)
// Options: SMOKE_GAMES=ttt,c4 (the games), SMOKE_PORT (the page's port, 8788), SMOKE_SHOTS=dir (screenshots on a failure),
// SMOKE_HEADFUL=1, SMOKE_MOVES=n (moves a game), SMOKE_LAG=ms (every callable's answer held back that long: a slow server),
// SMOKE_NO_CSP=1 (the page without the live site's Content Security Policy, which is sent by default). Part of the release checks (scripts/release.js) and of the Deploy workflow's tests.
// It also times Start game (the tap to "Starting…", to the server's answer, to both boards) and reports them.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const ROOT = path.join(__dirname, '..');
const PROJECT = 'demo-tic-tac-chaos', NS = `${PROJECT}-default-rtdb`;
const PORT = Number(process.env.SMOKE_PORT || 8788);
const DB = (process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000').split(':');
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FNS = '127.0.0.1:5001';
const ONLY = (process.argv[2] || process.env.SMOKE_GAMES || '').split(',').map(s => s.trim()).filter(Boolean);
const SHOTS = process.env.SMOKE_SHOTS || '';
const LAG = Number(process.env.SMOKE_LAG || 0);              // ms added to every callable's answer (a cold start, a slow network: the record then lands before the answer, as it does live)
const HOOK = { config: { apiKey: 'demo-key', authDomain: 'localhost', projectId: PROJECT, databaseURL: `https://${NS}.firebaseio.com`, appId: '1:1:web:demo' },
  emulator: { host: DB[0], port: Number(DB[1]) }, auth: `http://${AUTH}`, functions: { host: FNS.split(':')[0], port: Number(FNS.split(':')[1]) }, cdn: `http://127.0.0.1:${PORT}/vendor/firebase/` };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain' };
const SDK = ['firebase-app.js', 'firebase-database.js', 'firebase-auth.js', 'firebase-functions.js', 'firebase-app-check.js'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);

// The page, served from this checkout as Firebase Hosting serves it, with the emulators' hook before the page's own scripts,
// and the Firebase SDK from node_modules (the CDN's layout: the bundles import each other by their CDN address, pointed here).
function serveSite() {
  const sdk = {};
  for (const f of SDK) {
    const p = path.join(ROOT, 'node_modules', 'firebase', f);
    if (!fs.existsSync(p)) continue;
    sdk[f] = fs.readFileSync(p, 'utf8').replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\//g, `http://127.0.0.1:${PORT}/vendor/firebase/`);
  }
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (u.startsWith('/vendor/firebase/')) {
      const f = u.slice('/vendor/firebase/'.length);
      if (!sdk[f]) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-cache' }); res.end(sdk[f]); return;
    }
    if (u === '/smoke-hook.js') { res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-cache' }); res.end(`window.TTT_FIREBASE = ${JSON.stringify(HOOK)};`); return; }
    let file = path.join(ROOT, u === '/' ? 'index.html' : u);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    let body = fs.readFileSync(file);
    if (path.basename(file) === 'index.html') body = Buffer.from(body.toString('utf8').replace('<head>', '<head><script src="/smoke-hook.js"></script>'));   // (a script of its own: the live policy allows no inline script)
    const h = { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' };
    if (CSP && /\.html$/.test(file)) h['content-security-policy'] = CSP;                     // the live site's policy, with the emulators allowed (firebase.json)
    res.writeHead(200, h);
    res.end(body);
  });
  return new Promise(ok => srv.listen(PORT, '127.0.0.1', () => ok(srv)));
}
const SITE = `http://127.0.0.1:${PORT}`;
// The live site's Content Security Policy (firebase.json), so a tap that needs something the policy forbids fails here too;
// the emulators' addresses are added to connect-src (the SDK itself comes from this origin: 'self').
const CSP = (() => {
  if (process.env.SMOKE_NO_CSP) return '';
  const fj = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
  const h = (fj.hosting.headers || []).flatMap(x => x.headers || []).find(x => x.key === 'Content-Security-Policy');
  if (!h) return '';
  const emu = `http://${DB[0]}:${DB[1]} ws://${DB[0]}:${DB[1]} http://${AUTH} http://${FNS}`;
  return h.value.replace(/connect-src ([^;]*)/, (m, v) => `connect-src ${v} ${emu}`);
})();

// A phone: a browser context at a phone's size, its page errors and console errors kept.
async function phone(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(), errors = [], calls = [];
  page.on('pageerror', e => errors.push(`${name}: ${String(e.message).slice(0, 200)}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|403|404/.test(m.text())) errors.push(`${name} console: ${m.text().slice(0, 200)}`); });
  const started = new Map();
  page.on('request', req => { const u = req.url(); if (u.includes('/us-central1/')) started.set(req, Date.now()); });   // every callable's round trip, timed from the page
  page.on('requestfinished', req => { const t0 = started.get(req); if (t0 == null) return; started.delete(req); calls.push({ fn: req.url().split('/').pop().split('?')[0], ms: Date.now() - t0, at: t0 }); });
  page.on('requestfailed', req => { const t0 = started.get(req); if (t0 == null) return; started.delete(req); calls.push({ fn: req.url().split('/').pop().split('?')[0] + '!failed', ms: Date.now() - t0, at: t0 }); });
  if (LAG) await page.route('**/us-central1/**', async route => { await sleep(LAG); await route.continue(); });   // (a slow server: every callable's answer held back, the record arriving first as it does live)
  await page.goto(SITE + '/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof window.state === 'object' && document.querySelector('[data-act="cpu-go"]'), null, { timeout: 20000 }).catch(e => { throw new Error(`${name}: the page did not boot (${e.message.split('\n')[0]}); errors: ${errors.join(' | ') || 'none'}`); });
  return { name, ctx, page, errors, calls, ev: (fn, arg) => page.evaluate(fn, arg) };
}
// Wait for a condition on the page (a function of the page's names), a plain string of why not when it does not come.
async function until(p, fn, ms, what) {
  try { await p.page.waitForFunction(fn, null, { timeout: ms, polling: 50 }); return null; } catch (e) { return `${p.name}: ${what} (not within ${ms} ms; ${await where(p)})`; }
}
// Where a phone is, for a failure's line: its screen, its online state and the connection's status (ui/debug.js puts the names on window).
const where = p => p.ev(() => { const s = window.state, o = s.online || {}; return `screen=${s.screen} online=${o.kind || o.role || '-'} code=${o.code || '-'} me=${o.me || '-'} joined=${!!o.joined} turn=${s.turn} moves=${s.moves} zoom=${s.zoom} flash=${!!s.flash} done=${!!s.done} lock=${s.lock} net=${window.net && window.net.status}:${window.net && window.net.msg} conn=${window.connected} notice=${s.notice || ''}`; }).catch(e => 'no page: ' + e.message);
async function shot(p, tag) { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await p.page.screenshot({ path: path.join(SHOTS, `${tag}-${p.name}.png`) }).catch(() => {}); }

// The account: created through the page's own sign-in screen (the auth emulator takes any address), then back on the menu.
async function login(p, email, uname) {
  await p.page.click('[data-act="login"]');
  await p.page.waitForSelector('#lemail', { timeout: 10000 });
  await p.page.fill('#lemail', email); await p.page.fill('#lpass', 'secret-password-1');
  await p.page.click('[data-act="login-create"]');
  const bad = await until(p, () => window.acct && window.acct.user && !window.acct.user.isAnonymous, 20000, 'the account signed in');
  if (bad) return bad;
  // the username (hosting needs an account with one: net/accounts.js loggedIn), then the menu
  await p.page.waitForSelector('#uname', { timeout: 15000 }).catch(() => {});
  if (await p.page.$('#uname')) { await p.page.fill('#uname', uname); await p.page.click('[data-act="uname-save"]'); }
  const named = await until(p, () => window.acct && window.acct.profile && window.acct.profile.username, 20000, 'the username saved');
  if (named) return named;
  for (let k = 0; k < 40 && !(await p.ev(() => document.querySelector('[data-act="friend-go"]'))); k++) {
    const back = await p.page.$('[data-act="menu"], [data-act="back"]');
    if (back) await back.click().catch(() => {});
    await sleep(250);
  }
  return (await p.ev(() => !!document.querySelector('[data-act="friend-go"]'))) ? null : `${p.name}: no main menu after signing in (screen ${await p.ev(() => window.state.screen)})`;
}

// One game: a fresh room, the friend in it, the mini-games set to this one, Start game, the first move.
async function playOne(host, guest, type, out) {
  const fails = [], t = {};
  const fail = s => { if (s) fails.push(s); return !!s; };
  // the host opens a room
  await host.page.click('[data-act="friend-go"]'); await host.page.waitForSelector('[data-act="host"]', { timeout: 10000 });
  await host.page.click('[data-act="host"]');
  if (fail(await until(host, () => window.state.online && window.state.online.code && window.state.online.code.length === 5, 20000, 'the room opened'))) return fails;
  const code = await host.ev(() => window.state.online.code);
  // the mini-games: this one alone (the lobby's own checklist: Deselect all, then its box)
  await host.page.click('[data-act="adv"]').catch(() => {});
  await host.page.waitForSelector('[data-act="games-none"]', { timeout: 5000 }).catch(() => {});
  await host.page.click('[data-act="games-none"]').catch(() => {});
  const box = await host.page.$(`label.chk input[data-t="${type}"]`);
  if (!box) { fails.push(`${type}: not in the host's checklist`); return fails; }
  await box.click();
  await sleep(400);                                                                  // (the setup's write to the room)
  // the friend joins with the code
  await guest.page.click('[data-act="friend-go"]'); await guest.page.waitForSelector('[data-act="join-go"]', { timeout: 10000 });
  await guest.page.click('[data-act="join-go"]'); await guest.page.waitForSelector('#jcode', { timeout: 10000 });
  await guest.page.fill('#jcode', code);
  await guest.page.click('[data-act="join"]');
  if (fail(await until(guest, () => window.state.online && window.state.online.joined && window.state.online.me, 20000, 'joined the room'))) return fails;
  if (fail(await until(host, () => window.state.online && window.state.online.me && !!document.querySelector('[data-act="start"]:not([disabled])'), 20000, 'Start game ready (the friend seated)'))) return fails;
  // Start game: the button answers at once, the server makes the match, both phones reach the board
  const t0 = Date.now();
  const startedAt = host.calls.length;
  await host.page.click('[data-act="start"]');
  t.busy = await host.ev(() => new Promise(ok => { const t0 = performance.now(); const f = () => { const b = document.querySelector('[data-act="start"]'); if (!b || b.disabled || /Starting/.test(b.textContent) || window.state.screen !== 'setup') return ok(Math.round(performance.now() - t0)); if (performance.now() - t0 > 5000) return ok(-1); requestAnimationFrame(f); }; f(); }));
  await host.ev(() => { const b = document.querySelector('[data-act="start"]'); if (b) b.click(); });   // a second tap while it starts (a disabled button takes none): one match, no error
  const onBoard = async p => {                                                        // the match reached (its board, or the side reveal over it)
    for (let k = 0; ; k++) {
      const ok = await p.ev(() => !!(window.state.online && window.state.online.kind === 'mm' && window.state.squares && window.state.squares.length === 9 && (window.state.screen === 'board' || document.querySelector('.vsintro'))));
      if (ok) { t[p.name + 'Board'] = Date.now() - t0; return null; }
      if (Date.now() - t0 > 45000) return `${p.name}: on the board (not within 45 s; ${await where(p)})`;
      if (process.env.SMOKE_TRACE && k % 4 === 0) log(`      +${Date.now() - t0}ms ${await where(p)}`);
      await sleep(250);
    }
  };
  const bothIn = await Promise.all([host, guest].map(onBoard));
  t.boards = Date.now() - t0;
  log(`    ${type}: start tapped; busy after ${t.busy} ms; host on the board after ${t.hostBoard} ms, guest after ${t.guestBoard} ms; calls: ${host.calls.slice(startedAt).map(c => c.fn + ' ' + c.ms + 'ms').join(', ') || 'none seen'}`);
  if (bothIn.some(Boolean)) { bothIn.filter(Boolean).forEach(fail); await shot(host, type + '-start'); await shot(guest, type + '-start'); return fails; }
  const sc = host.calls.slice(startedAt).find(c => c.fn === 'startRoom'); t.server = sc ? sc.ms : null;
  const games = await host.ev(() => window.state.online.game); const gamesG = await guest.ev(() => window.state.online.game);
  if (games !== gamesG) fails.push(`${type}: the two phones are in different matches (${games} / ${gamesG})`);
  for (const p of [host, guest]) { const b = await p.page.$('[data-act="intro-close"]'); if (b) await b.click().catch(() => {}); }   // the side reveal
  await sleep(300);
  const dealt = await host.ev(() => window.state.squares.map(q => q.mini.type));
  if (!dealt.every(x => x === type)) fails.push(`${type}: dealt ${dealt.join(',')}`);
  // the moves: the phone on the move opens a square and plays; the server's record carries it, the other phone plays it
  // back and takes the turn. Several in a row (both phones move, through a replay each), a real tap on the control for
  // the instant-move games (tic-tac-toe, Four in a Row, Hex: the mark must show at once); the others through attemptMove.
  const tap = ['ttt', 'c4', 'hex', 'hexapawn'].includes(type);
  const rounds = Number(process.env.SMOKE_MOVES || (tap ? 5 : 2));
  for (let k = 0; k < rounds; k++) {
    const turn = await host.ev(() => JSON.parse(window.room.match.state).turn);     // (the server's record: a phone's own board may still be playing the last move back)
    const mover = (await host.ev(() => window.state.online.me)) === turn ? host : guest, other = mover === host ? guest : host;
    const ready = await mover.page.waitForFunction(() => window.state.turn === window.state.online.me && !window.state.flash && !window.state.done && !window.moveWait && (window.state.screen === 'board' || window.state.screen === 'mini') && !document.querySelector('.vsintro, .rskip'), null, { timeout: 20000, polling: 100 }).then(() => null, async () => `${mover.name}: never free to move (round ${k + 1}; ${await where(mover)})`);
    if (fail(ready)) { await shot(mover, `${type}-${k}-ready`); break; }
    if (await mover.ev(() => window.state.screen !== 'mini')) {
      const sqi = await mover.ev(() => (window.state.lock != null ? window.state.lock : window.state.squares.findIndex(q => !q.owner)));
      if (sqi < 0) break;
      await mover.page.click(`[data-act="zoom"][data-i="${sqi}"]`);
      if (fail(await until(mover, () => window.state.screen === 'mini', 5000, `the square opened (round ${k + 1})`))) { await shot(mover, `${type}-${k}-zoom`); break; }
      await sleep(400);                                                               // (the zoom)
    }
    const seq0 = await mover.ev(() => JSON.parse(window.room.match.state).seq), moves0 = await mover.ev(() => window.state.moves);
    if (tap) {                                                                        // a real tap on the control: the mark shows at once (net/moves.js PREDICT)
      const btn = await mover.page.$('main.mini [data-act="move"]:not([disabled])');
      if (!btn) { fails.push(`${type}: no control to tap (round ${k + 1}; ${await where(mover)})`); await shot(mover, `${type}-${k}-notap`); break; }
      const tapAt = Date.now();
      await btn.click();
      const shown = await until(mover, () => window.state.moves > 0 && (window.state.flash || window.state.done || window.state.screen === 'board' || window.state.turn !== window.state.online.me), 1500, `the mark showed at once after the tap (round ${k + 1})`);
      if (shown) { fails.push(shown); await shot(mover, `${type}-${k}-tap`); break; }
      t.tapShown = Math.max(t.tapShown || 0, Date.now() - tapAt);
    } else {
      const r = await mover.ev(() => { const i = window.state.zoom, me = window.state.online.me; const m = window.randomLegalMove(window.state.squares[i].mini, me, window.RNG); if (m == null) return 'no move'; return window.attemptMove(m) ? 'sent' : 'not sent'; });
      if (r !== 'sent') { fails.push(`${type}: ${r} (round ${k + 1})`); break; }
    }
    const recorded = await mover.page.waitForFunction(s0 => JSON.parse(window.room.match.state).seq > s0, seq0, { timeout: 15000, polling: 50 }).then(() => null, async () => `${mover.name}: the server's record never carried the move (round ${k + 1}, seq ${seq0}; ${await where(mover)})`);
    if (fail(recorded)) { await shot(mover, `${type}-${k}-rec`); break; }
    const over = await mover.ev(() => !!window.state.winner);
    if (over) break;
    const again = await mover.ev(() => window.state.turn === window.state.online.me);   // (a move that keeps the turn: Sea Battle's hit, a card game's deal)
    if (again) continue;
    const played = await other.page.waitForFunction(m0 => window.state.moves > m0 && window.state.turn === window.state.online.me && !window.state.flash && window.state.screen === 'board' && !document.querySelector('.rskip'), moves0, { timeout: 25000, polling: 100 }).then(() => null, async () => `${other.name}: the other phone never played the move back to its board (${type}, round ${k + 1}; ${await where(other)})`);
    if (fail(played)) { await shot(other, `${type}-${k}-replay`); break; }
    const settled = await mover.page.waitForFunction(() => window.state.turn !== window.state.online.me && !window.state.flash && !window.moveWait, null, { timeout: 15000, polling: 100 }).then(() => null, async () => `${mover.name}: the mover's own move never settled (${type}, round ${k + 1}; ${await where(mover)})`);
    if (fail(settled)) { await shot(mover, `${type}-${k}-settle`); break; }
  }
  out.push(Object.assign({ type }, t));
  // out of the match: one phone leaves through the in-game menu (a loss for it, the room over, "resigned" for the other),
  // both pass the result screen to the main menu, ready for the next room
  for (const p of [host, guest]) await p.ev(() => { if (window.state.screen === 'mini') { window.state.screen = 'board'; window.state.zoom = null; window.commit(); } });
  const leaver = host;
  for (const act of ['pause', 'pause-main', 'pause-leave']) { await leaver.page.click(`[data-act="${act}"]`, { timeout: 5000 }).catch(() => {}); await sleep(200); }
  for (const p of [host, guest]) {
    const back = await p.page.waitForFunction(() => window.state.screen === 'win' || !!document.querySelector('[data-act="friend-go"]'), null, { timeout: 20000 }).then(() => null, async () => `${p.name}: no result screen after leaving (${await where(p)})`);
    if (fail(back)) { await shot(p, `${type}-leave`); continue; }
    await sleep(300);
    const menu = await p.page.$('main.win [data-act="leave"], main.win [data-act="menu"], .win [data-act="leave"], [data-act="leave"]'); if (menu) await menu.click({ timeout: 5000 }).catch(() => {});
    const home = await p.page.waitForFunction(() => !!document.querySelector('[data-act="friend-go"]'), null, { timeout: 15000 }).then(() => null, async () => `${p.name}: not back on the main menu (${await where(p)})`);
    if (fail(home)) await shot(p, `${type}-home`);
  }
  return fails;
}

async function main() {
  const { chromium } = require('playwright');
  const srv = await serveSite();
  const E = require(path.join(ROOT, 'tests', 'engine.js'));
  const G = require(path.join(ROOT, 'src', 'games', 'index.js'));
  const released = E.TYPES.filter(t => G.GAMES[t].meta.release === 'released');
  const types = ONLY.length ? ONLY : released;
  const browser = await chromium.launch({ headless: !process.env.SMOKE_HEADFUL });
  const fails = [], timings = [];
  try {
    const host = await phone(browser, 'host'), guest = await phone(browser, 'guest');
    const stamp = Date.now().toString(36);
    for (const [p, who] of [[host, 'host'], [guest, 'guest']]) { const bad = await login(p, `smoke-${who}-${stamp}@example.com`, `smk${who}${stamp}`.slice(0, 15)); if (bad) { fails.push(bad); await shot(p, 'login'); } }
    if (!fails.length) {
      for (const type of types) {
        const f = await playOne(host, guest, type, timings).catch(e => [`${type}: threw ${e && e.message}`]);
        log(`${f.length ? 'FAIL' : 'ok  '} ${type}${f.length ? ': ' + f.join('; ') : ''}`);
        fails.push(...f);
      }
    }
    for (const p of [host, guest]) fails.push(...p.errors);
  } finally { await browser.close(); srv.close(); }
  if (timings.length) {
    const ms = k => timings.map(x => x[k]).filter(v => typeof v === 'number' && v >= 0);
    const med = a => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null), max = a => (a.length ? Math.max(...a) : null);
    log(`Start game: tap to busy ${med(ms('busy'))} ms median (max ${max(ms('busy'))}); startRoom ${med(ms('server'))} ms median (max ${max(ms('server'))}); to both boards ${med(ms('boards'))} ms median (max ${max(ms('boards'))}); instant tap shown ${med(ms('tapShown'))} ms (${timings.length} rooms)`);
  }
  if (fails.length) { log(`\n${fails.length} problem(s):`); fails.forEach(f => log(' - ' + f)); process.exitCode = 1; }
  else log(`OK: one real move in each of ${types.length} games through the live emulators`);
}
main().catch(e => { console.error(e); process.exit(1); });
