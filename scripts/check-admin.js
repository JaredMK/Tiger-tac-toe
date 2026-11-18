'use strict';
// The admin dashboard for real, on the emulators (npm run check:admin; December 2026): about 60 made-up devices and 350
// matches over 45 days are written to the database as the server writes them (functions/statsRules.js factStart, factEnd,
// factFind), an account gets the admin claim, and the page is opened in Chromium: signed in through its own form, its own
// load() reading the rows under the real rules. Checked: the headline numbers against a count made straight from the rows,
// with and without my devices; the same number on the Overview and on its detail page; the filter remembered; a number's
// link opening its rows; a table's sort, search, column filter and CSV; a person's page, a nickname saved, a match linked
// to its players; Games and Settings; no sideways scroll at 390 px; no page error. Needs Java and Playwright's Chromium.
//   firebase emulators:exec --only auth,database --project demo-tic-tac-chaos "node scripts/check-admin.js"
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const S0 = require('../functions/statsRules.js');
const ROOT = path.join(__dirname, '..'), PROJECT = 'demo-tic-tac-chaos', NS = PROJECT + '-default-rtdb', DBH = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000', AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

// The made-up world (seeded, so every run is the same play; the times count back from now).
function makeWorld() {
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = a => a[Math.floor(rnd() * a.length)];
  const NOW = Date.now(), DAY = 864e5;
  const hex = n => Array.from({ length: n }, () => '0123456789abcdef'[ri(0, 15)]).join('');
  const TYPES = ['ttt', 'c4', 'pig', 'coins', 'hilo', 'rps', 'hangman', 'snakes', 'bs', 'wordle', 'war', 'claw', 'mastermind', 'bullseye', 'bump', 'candy', 'rl', 'plinko'];
  const devices = {}, logs = {}, users = {}, matches = {}, finds = {}, reports = {}, logIndex = {}, seen = {};
  const names = ['sam', 'ava', 'liam', 'noah', 'mia', 'zoe', 'eli', 'kai', 'ivy', 'max', 'leo', 'ada', 'ben', 'cy', 'dot', 'eve', 'fay', 'gus'];
  const devs = [];
  for (let i = 0; i < 60; i++) {
    const h = i === 0 ? '0200d915' + hex(12) : hex(20), first = NOW - ri(0, 44) * DAY - ri(0, 20) * 36e5, pl = rnd() < .3 ? 'ios' : 'web', acct = i < names.length ? 'u' + i : null;
    const d = { h, first, pl, acct, tag: rnd() < .4 ? pick(['reddit', 'tiktok', 'friends']) : null, days: [] };
    devs.push(d); devices[h] = { first, last: first, p: pl, cv: '1.22.0', n: 0 }; if (d.tag) devices[h].tag = d.tag; logs[h] = {};
    if (acct) { users[acct] = { username: names[i], joined: first + 600000, wins: 0, losses: 0, draws: 0 }; if (d.tag) users[acct].src = d.tag; devices[h].u = { [acct]: first + 600000 }; }
  }
  users.u0.username = 'jarhad'; 
  let k = 0; const ev = (d, t, e, o) => { if (t > NOW) return; logs[d.h]['e' + (k++).toString(36).padStart(5, '0')] = Object.assign({ t, ev: e }, o || {}); devices[d.h].last = Math.max(devices[d.h].last, t); devices[d.h].n++; if (d.acct) seen[d.acct] = Math.max(seen[d.acct] || 0, t); };
  const put = (id, r) => { const dd = S0.periodKeys(r.t0).d; (matches[dd] = matches[dd] || {})[id] = r; };
  const sqs = () => Array.from({ length: ri(3, 9) }, () => { const t = pick(TYPES), w = rnd() < .08 ? null : pick(['X', 'O']), wm = ri(2, 8), f = pick(['X', 'O']); return { t, end: w ? 'won' : 'draw', w, X: w === 'X' ? wm : Math.max(0, wm - ri(0, 2)), O: w === 'O' ? wm : Math.max(0, wm - ri(0, 2)), f, ms: ri(8, 140) * 1000, v: t === 'pig' && rnd() < .5 ? 2 : 1 }; });
  let mid = 0;
  for (const d of devs) {
    const life = Math.floor((NOW - d.first) / DAY), own = d === devs[0];
    for (let day = 0; day <= life; day++) {
      if (day > 0 && rnd() > (day === 1 ? .4 : day <= 7 ? .22 : .1)) continue;
      let t = d.first + day * DAY + ri(0, 3) * 36e5; if (t > NOW) continue;
      ev(d, t, 'open', { p: d.pl, cv: '1.22.0', b: day > 20 ? 'b0c1d2e' : 'a1b2c3d' });
      if (day === 0) { if (rnd() < .85) ev(d, t + 5000, 'step', { step: 'tap' }); if (rnd() < .75) ev(d, t + 9000, 'step', { step: 'move' }); if (rnd() < .6) ev(d, t + 40000, 'step', { step: 'claim' }); }
      if (rnd() < .04) ev(d, t + 20000, 'error', { msg: pick(['js: Cannot read properties of undefined (reading "last") @ b/main-AB12.js:1:2203', 'promise: network', 'stuck']), b: 'a1b2c3d' });
      if (rnd() < .1) ev(d, t + 30000, 'act', { act: 'invite', ch: pick(['share', 'copy']) });
      if (rnd() < .05) ev(d, t + 31000, 'act', { act: 'invite-open' });
      if (rnd() < .04) ev(d, t + 32000, 'act', { act: 'invite-join' });
      if (rnd() < .03) ev(d, t + 33000, 'act', { act: 'invite-done' });
      const nm = rnd() < .2 ? 0 : ri(1, 3);
      for (let j = 0; j < nm; j++) {
        t += ri(1, 4) * 60000; if (t > NOW - 60000) break;
        const r = rnd(), mode = r < .55 ? 'cpu' : r < .65 ? 'local' : r < .8 ? 'friend' : r < .92 ? 'match' : 'bot', online = ['friend', 'match', 'bot'].includes(mode);
        if (online && !d.acct && mode !== 'friend') continue;
        const id = (online ? 'g' : 'l_') + (mid++).toString(36).padStart(4, '0'), ms = ri(3, 14) * 60000;
        const me = { s: pick(['X', 'O']), u: d.acct || undefined, h: d.h, pl: d.pl, cv: '1.22.0' };
        let who = [me], other = null;
        if (mode === 'bot') who.push({ s: me.s === 'X' ? 'O' : 'X', u: 'bot1', bot: true });
        else if (online) { other = pick(devs.filter(x => x !== d && (mode === 'friend' || x.acct))); who.push({ s: me.s === 'X' ? 'O' : 'X', u: other.acct || undefined, h: other.h, pl: other.pl, cv: '1.22.0' }); }
        else if (mode === 'local') delete me.s;
        const isOwn = own || other === devs[0];
        const row = S0.factStart(mode, t, who, { timer: online ? pick(['m5+5', 'm5+5', 'm3+5', 'off']) : 'none', own: isOwn, room: mode === 'friend' ? 'ABCDE' : undefined });
        ev(d, t, 'start', { m: mode, g: id.replace('_', '') });
        const fate = rnd();
        if (fate < .78) { const list = sqs(), reason = fate < .62 ? 'line' : fate < .68 ? 'clock' : fate < .74 ? 'resign' : 'timeout', sum = S0.checkEnd({ squares: list, winner: rnd() < .05 && reason === 'line' ? null : pick(['X', 'O']), reason }, TYPES); Object.assign(row, S0.factEnd(sum, ms, t + ms)); ev(d, t + ms, 'finish', { m: mode, g: id.replace('_', '') }); if (rnd() < .2) ev(d, t + ms + 4000, 'act', { act: 'rematch' }); if (rnd() < .08) ev(d, t + ms + 6000, 'act', { act: 'share' }); }
        put(id, row);
        if (online) { logIndex['m' + id] = { n: ri(20, 90), first: t, last: t + ms, mode }; if (rnd() < .04) { logIndex['m' + id].reported = t + ms; logIndex['m' + id].note = 'It froze on my turn'; reports['r' + id] = { at: t + ms, uid: d.acct, h: d.h, g: 'm' + id, mode, note: 'It froze on my turn', p: d.pl, cv: '1.22.0' }; } }
        if (mode === 'match' || mode === 'bot') { const fd = S0.periodKeys(t).d; (finds[fd] = finds[fd] || {})['f' + id] = S0.factFind(mode === 'bot' ? 'bot' : 'people', mode === 'bot' ? ri(20, 30) * 1000 : ri(2, 18) * 1000, t, d.acct, isOwn); }
        t += ms;
      }
      if (d.acct && rnd() < .05) { const fd = S0.periodKeys(t).d; (finds[fd] = finds[fd] || {})['c' + (mid++)] = S0.factFind('cancel', ri(5, 25) * 1000, t, d.acct, own); }
    }
  }
  reports.rmenu = { at: NOW - 2 * DAY, h: devs[5].h, where: 'menu', note: 'The sound stops after I lock my phone', p: devs[5].pl, cv: '1.22.0' };
  const meta = { '0200d915': { ex: true, nick: "Jared's computer", why: 'set', at: NOW - 30 * DAY } };
  return { matches, finds, devices, logs, users, seen, reports, logIndex, devmeta: meta, bots: { bot1: { key: 'bot1', username: 'Robo', about: 'Careful' } } };
}
const world = makeWorld();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const put = async (p, v) => { const r = await fetch(`http://${DBH}/${p}.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(v) }); if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + await r.text()); };
const get = async p => (await fetch(`http://${DBH}/${p}.json?ns=${NS}`, { headers: { Authorization: 'Bearer owner' } })).json();
let bad = 0; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) bad++; };
(async () => {
  for (const k of ['mfacts:matches', 'finds:finds', 'devices:devices', 'devlog:logs', 'users:users', 'lastSeen:seen', 'reports:reports', 'matchLogIndex:logIndex', 'devmeta:devmeta', 'bots:bots']) { const [node, key] = k.split(':'); await put(node, world[key] || null); }
  await put('admin/ownerToken', 'tok_e2e_abcdefghijkl');
  const A = `http://${AUTH}/identitytoolkit.googleapis.com/v1`;
  const su = await (await fetch(`${A}/accounts:signUp?key=demo-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'boss@example.com', password: 'secret123', returnSecureToken: true }) })).json();
  await fetch(`${A}/projects/${PROJECT}/accounts:update`, { method: 'POST', headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ localId: su.localId, customAttributes: JSON.stringify({ admin: true }), emailVerified: true }) });
  await put(`templates/${su.localId}/t1`, { name: 'Quick games', games: { ttt: true, c4: true }, at: Date.now() });
  const sdk = {};
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u.startsWith('/vendor/firebase/')) { const f = u.slice(17); if (!sdk[f]) sdk[f] = fs.readFileSync(path.join(ROOT, 'node_modules', 'firebase', f), 'utf8').replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\//g, `http://127.0.0.1:${srv.address().port}/vendor/firebase/`); r.writeHead(200, { 'content-type': 'text/javascript' }); r.end(sdk[f]); return; }
    fs.readFile(path.join(ROOT, u), (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(u)] || 'application/octet-stream' }); r.end(b); } });
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const port = srv.address().port;
  const HOOK = { config: { apiKey: 'demo-key', authDomain: 'localhost', projectId: PROJECT, databaseURL: `https://${NS}.firebaseio.com`, appId: '1:1:web:demo' }, emulator: { host: DBH.split(':')[0], port: Number(DBH.split(':')[1]) }, auth: `http://${AUTH}`, cdn: `http://127.0.0.1:${port}/vendor/firebase/` };
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|WebSocket/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.addInitScript(h => { window.TTT_FIREBASE = h; }, HOOK);
  await p.goto(`http://127.0.0.1:${port}/admin.html`);
  await p.waitForSelector('#em', { timeout: 20000 });
  await p.fill('#em', 'boss@example.com'); await p.fill('#pw', 'secret123'); await p.click('[data-act="email"]');
  await p.waitForSelector('nav.nav', { timeout: 30000 });
  check(true, 'signed in through the page; its own load() read the rows under the rules');
  const kpi = async id => p.evaluate(i => { const a = document.querySelector(`[data-metric="${i}"] a.big`); return a ? a.textContent : null; }, id);
  const direct = Object.values(world.matches).flatMap(d => Object.values(d));
  const day = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t)), from = day(Date.now() - 29 * 864e5), inR = t => day(t) >= from;
  const started = mine => direct.filter(r => inR(r.t0) && (mine || !r.own)).length, finished = mine => direct.filter(r => inR(r.t0) && (mine || !r.own) && r.t1 && !['resign', 'timeout'].includes(r.end)).length;
  check(await kpi('started') === String(started(false)), `Overview: matches started ${await kpi('started')} = ${started(false)} counted straight from the rows (my devices out)`);
  check(await kpi('finished') === String(finished(false)), `Overview: matches finished ${await kpi('finished')} = ${finished(false)}`);
  const ov = { active: await kpi('active'), started: await kpi('started'), finished: await kpi('finished'), completion: await kpi('completion'), d1: await kpi('d1'), errorRate: await kpi('errorRate'), reports: await kpi('reports'), newPlayers: await kpi('newPlayers') };
  const go = async h => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(200); };
  await go('#players'); check(await kpi('active') === ov.active, `Players: active players ${await kpi('active')} = the Overview's ${ov.active}`);
  await go('#matches'); check(await kpi('started') === ov.started && await kpi('finished') === ov.finished && await kpi('completion') === ov.completion, `Matches: started, finished, completion = the Overview's (${ov.started}, ${ov.finished}, ${ov.completion})`);
  await go('#growth'); check(await kpi('d1') === ov.d1 && await kpi('newPlayers') === ov.newPlayers, `Growth: D1 and new players = the Overview's (${ov.d1}, ${ov.newPlayers})`);
  await go('#health'); check(await kpi('errorRate') === ov.errorRate && await kpi('reports') === ov.reports, `Health: errors per 100 opens and reports = the Overview's (${ov.errorRate}, ${ov.reports})`);
  // Include my devices: every page moves together, and it is remembered
  await go('#overview'); await p.check('[data-gf="mine"]'); await p.waitForTimeout(150);
  check(await kpi('started') === String(started(true)), `with my devices: matches started ${await kpi('started')} = ${started(true)} straight from the rows`);
  const ov2 = await kpi('active'); await go('#players'); check(await kpi('active') === ov2 && Number(ov2) === Number(ov.active) + 1, `with my devices: active ${ov2} on both pages, one more than without (${ov.active})`);
  await p.reload(); await p.waitForSelector('nav.nav', { timeout: 30000 });
  check(await p.isChecked('[data-gf="mine"]'), 'the filter is remembered after a reload');
  await p.uncheck('[data-gf="mine"]');
  // a drill-down: the number's rows
  await go('#overview'); const fin = await kpi('finished'); await p.click('[data-metric="finished"] a.big'); await p.waitForTimeout(200);
  const txt = await p.evaluate(() => document.querySelector('.tb .tbn').textContent);
  check(txt.startsWith(fin + ' row'), `tapping "Matches finished" (${fin}) opens its rows: "${txt}"`);
  // the table: sort, search, a column filter, CSV
  await go('#players');
  const firstCell = () => p.evaluate(() => document.querySelector('[data-tb="people"] tbody tr td:nth-child(11)').textContent);
  await p.click('[data-tsort="people"][data-k="sessions"]'); const top = Number(await firstCell());
  await p.click('[data-tsort="people"][data-k="sessions"]'); const low = Number(await firstCell());
  check(top >= low && top > 1, `Players sorts by Sessions both ways (${top} … ${low})`);
  await p.fill('[data-tq="people"]', 'reddit'); await p.waitForTimeout(100);
  const nRed = await p.evaluate(() => document.querySelectorAll('[data-tb="people"] tbody tr').length), focused = await p.evaluate(() => document.activeElement && document.activeElement.dataset.tq);
  check(nRed > 0 && nRed < 20 && focused === 'people', `the search narrows the table as it is typed, the caret kept (${nRed} rows for "reddit")`);
  await p.fill('[data-tq="people"]', ''); await p.click('[data-tfilt="people"]'); await p.fill('[data-tf="people"][data-k="sessions"]', '>4'); await p.waitForTimeout(100);
  const ses = await p.evaluate(() => [...document.querySelectorAll('[data-tb="people"] tbody tr td:nth-child(11)')].map(td => Number(td.textContent)));
  check(ses.length > 0 && ses.every(n => n > 4), `a column filter: Sessions > 4 (${ses.length} rows)`);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-tcsv="people"]')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8').trim().split('\r\n');
  check(csv.length === ses.length + 1 && csv[0].startsWith('Player,Type,Username'), `CSV: the ${ses.length} rows shown, with their headings (${dl.suggestedFilename()})`);
  // a person, a nickname, a match with its players linked
  await p.click('[data-tclear="people"]'); await p.fill('[data-tq="people"]', 'fay'); await p.waitForTimeout(100);
  await p.click('[data-tb="people"] tbody tr td:nth-child(2)'); await p.waitForTimeout(250);
  check(/#players\/u/.test(await p.evaluate(() => location.hash)) && await p.locator('h2', { hasText: 'Devices' }).count() === 1, 'a row opens the person: account, devices, matches, sessions, games');
  await p.click('button.nick'); await p.fill('#nickIn', "Fay's laptop"); await p.click('[data-act="nicksave"]'); await p.waitForTimeout(400);
  const hash = await p.evaluate(() => document.querySelector('[data-devex]').dataset.devex);
  check(((await get(`devmeta/${hash}`)) || {}).nick === "Fay's laptop", 'a nickname typed on their page is saved (devmeta, by the admin under the rules)');
  await p.click('[data-tb="pMatches"] tbody tr td:nth-child(1)'); await p.waitForTimeout(300);
  check(/#matches\//.test(await p.evaluate(() => location.hash)) && await p.locator('.facts a[href^="#players/"]').count() >= 1, 'their match opens, its players links back to their pages');
  await go('#games'); check(await p.locator('#compareCard [data-tb="compare"] tbody tr').count() > 5 && await p.locator('#gamesCard .grow').count() > 50, 'Games: the comparison table and the list');
  await go('#games/pig'); check(await p.locator('#relCard').count() === 1 && await p.locator('[data-gamesave="pig"]').count() === 1 && await p.locator('#gameStats').count() === 1, 'a game\'s page: its settings as ever, its numbers under them');
  await go('#settings'); check(await p.locator('#animCard, #clientsCard, #timerCard, #botsCard, #aiCard, #alertsCard, #templatesCard, #ownerCard').count() === 8 && (await p.textContent('#templatesCard')).includes('Quick games') && (await p.textContent('#ownerCard')).includes('tok_e2e_abcdefghijkl'), 'Settings: every global card, my templates, the owner link');
  check((await p.textContent('#ownerCard')).includes("Jared's computer"), 'Settings: my excluded device listed');
  // a phone
  await p.setViewportSize({ width: 390, height: 844 });
  for (const h of ['#overview', '#players', '#matches', '#games', '#growth', '#health', '#settings']) { await go(h); const o = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); check(o[0] <= o[1] + 1, `at 390 px ${h} does not scroll sideways (${o[0]} / ${o[1]})`); }
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  await b.close(); srv.close();
  console.log(bad ? `\n${bad} check(s) failed` : '\nAll checks passed.'); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
