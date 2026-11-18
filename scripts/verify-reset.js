'use strict';
// After the launch reset (the "Reset production" workflow runs this once the reset is done; December 2026). Production's
// own rows read with production's key, counted by the admin page's own code (src/admin/metrics.js, pages.js):
//   1. every number on every section is zero, with and without my devices, every record is 0-0-0, and every admin
//      section draws in a real browser (admin.html, its page code with these rows: no page error);
//   2. one match against the computer, played to its end on the live site in Chromium by a new device that is not one
//      of mine (a guest), through the page's own flow (Play Computer, tic-tac-toe alone; the page reports the match
//      itself): its row is found, and it shows on the Overview, Players, Matches and Games as one match, one player
//      and its squares, with and without my devices;
//   3. that match deleted (its row, the device and its events, the guest's sign-in) and the numbers back to zero.
// It prints what it found and exits 1 on any failure. Nothing here can touch an account, a setting or a release.
//   node scripts/verify-reset.js      (GOOGLE_APPLICATION_CREDENTIALS, TTC_PROJECT; SITE, default https://tictacchaos.com)
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const ROOT = path.join(__dirname, '..');
const SITE = process.env.SITE || 'https://tictacchaos.com';
const KEY = 'tiger-tac-toe.v4';                                    // (src/ui/config.js KEY)
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) bad++; return ok; };
const devHash = id => crypto.createHash('sha256').update('ttc-dev:' + id).digest('hex').slice(0, 20);   // (functions/statsRules.js devHash)

async function main() {
  const PROJECT = process.env.TTC_PROJECT;
  if (!PROJECT) throw new Error('TTC_PROJECT is not set.');
  const admin = require(path.join(ROOT, 'functions', 'node_modules', 'firebase-admin'));
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database();
  const X = await import(path.join(ROOT, 'src', 'admin', 'metrics.js'));
  const P = await import(path.join(ROOT, 'src', 'admin', 'pages.js'));
  const G = await import(path.join(ROOT, 'src', 'games', 'index.js'));
  const names = Object.fromEntries(G.TYPES.map(t => [t, G.INFO[t].name]));
  const get = async p => (await db.ref(p).get()).val();
  const read = async () => {
    const [matches, finds, devices, logs, users, seen, meta, bots, reports, logIndex, local] = await Promise.all(['mfacts', 'finds', 'devices', 'devlog', 'users', 'lastSeen', 'devmeta', 'bots', 'reports', 'matchLogIndex', 'localStats'].map(get));
    return { matches, finds, devices, logs, users, seen, meta, bots, reports, logIndex, local };
  };
  const ctxOf = (data, filters) => {
    const states = new Map(), M = X.build(data, Date.now());
    return { M, S: X.scope(M, filters), names, released: () => true, versions: {}, ts: (id, def) => { if (!states.has(id)) states.set(id, P.T.newState(def)); return states.get(id); }, drills: new Map(), logs: {}, devEdit: null, PS: null, accounts: null, alertLog: [], alertStats: {} };
  };
  const shown = (html, id) => { const m = html.match(new RegExp(`data-metric="${id}"[\\s\\S]*?<a class="big"[^>]*>([^<]*)<`)); return m ? m[1] : null; };
  const PAGES = { Overview: P.overview, Players: P.players, Matches: P.matches, Growth: P.growth, Health: P.health, Games: c => P.gamesCompare(c) };
  const FILTERS = [{ range: '90' }, { range: '90', mine: true }];

  // ---------- 1. zero ----------
  console.log('\n1. Every number zero after the reset');
  const zero = await read();
  for (const r of ['mfacts', 'finds', 'devices', 'devlog', 'reports', 'stats', 'statsOwn', 'botStats', 'history', 'localHistory', 'localStats', 'oppStats', 'matchLogs', 'matchLogIndex', 'games', 'alertLog']) {
    const n = Object.keys((await db.ref(r).limitToFirst(5).get()).val() || {}).length;
    check(n === 0, `${r}: ${n ? 'still has rows' : 'empty'}`);
  }
  for (const f of FILTERS) {
    const c = ctxOf(zero, f), nonzero = X.METRIC_IDS.filter(id => { const m = X.metric(c.S, id); return m.rows.length > 0 || (typeof m.v === 'number' && m.v !== 0); });
    check(!nonzero.length, `every metric zero or empty, ${f.mine ? 'with' : 'without'} my devices${nonzero.length ? ': ' + nonzero.join(', ') : ` (${X.METRIC_IDS.length} metrics)`}`);
    for (const [name, page] of Object.entries(PAGES)) {
      let html = '';
      try { html = page(c); } catch (e) { check(false, `${name} draws (${e.message})`); continue; }
      const cards = [...html.matchAll(/data-metric="(\w+)"[\s\S]*?<a class="big"[^>]*>([^<]*)</g)].map(m => [m[1], m[2]]).filter(([, v]) => !/^(0|–|0%)$/.test(v.trim()));
      check(!cards.length, `${name} shows zero${f.mine ? ' with my devices' : ''}${cards.length ? ': ' + cards.map(x => x.join(' ')).join(', ') : ''}`);
    }
  }
  const users = zero.users || {}, notZero = Object.entries(users).filter(([, u]) => u && (u.wins || u.losses || u.draws || u.games || u.sides || u.friend || u.minis)).map(([k]) => k);
  check(!notZero.length, `every record 0-0-0 (${Object.keys(users).length} accounts${notZero.length ? '; not: ' + notZero.slice(0, 5).join(', ') : ''})`);
  const kept = ['users', 'usernames', 'config', 'releases', 'devmeta', 'templates'];
  const keptN = await Promise.all(kept.map(async r => [r, Object.keys((await db.ref(r).get()).val() || {}).length]));
  console.log(`     kept: ${keptN.map(([r, n]) => `${r} ${n}`).join(', ')}`);

  // the admin page itself, every section, in Chromium (offline: its own page code given these rows)
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const full = (await db.ref('/').get()).val() || {};
  const ctl = adminCtl(full);
  await adminSections(browser, zero, full, ctl, 'after the reset');

  // ---------- 2. one match against the computer ----------
  console.log('\n2. A match against the computer on the live site, from a new device that is not mine');
  const dev = 'd' + crypto.randomBytes(12).toString('hex'), h = devHash(dev);
  const owned = X.metaFor(zero.meta || {}, h);
  check(!owned, `the test device ${h.slice(0, 8)} is not one of mine`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), perr = [];
  page.on('pageerror', e => perr.push(String(e.message).slice(0, 160)));
  await ctx.addInitScript(([k, d]) => { try { localStorage.setItem(k + '.dev', d); localStorage.setItem(k + '.onboard', JSON.stringify({ done: true, quiet: true, n: 9, speed: true })); localStorage.setItem(k + '.anim', 'speed'); } catch (e) { /* (none) */ } }, [KEY, dev]);
  let uid = null, played = null;
  try {
    await page.goto(SITE + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('[data-act="cpu-go"]', { timeout: 20000 });
    await page.click('[data-act="cpu-go"]');
    await page.waitForSelector('[data-act="start"]', { timeout: 10000 });
    await page.evaluate(() => setGames(g => { for (const k of Object.keys(g)) g[k] = false; g.ttt = true; }));   // tic-tac-toe alone: a short match
    await page.click('[data-act="start"]');
    played = await page.evaluate(async () => {
      const sl = ms => new Promise(ok => setTimeout(ok, ms)), t0 = Date.now();
      let last = -1;
      while (Date.now() - t0 < 360000 && !state.winner) {
        const me = state.cpu === 'X' ? 'O' : 'X', still = state.flash || state.spot || state.done;
        if (state.turn === me && !still) {
          if (state.screen === 'mini' && state.zoom != null && !state.squares[state.zoom].owner) {
            if (state.moves !== last) { const m = randomLegalMove(state.squares[state.zoom].mini, me, RNG); if (m != null) { last = state.moves; attemptMove(m); } }
          } else if (state.screen === 'board') {
            const i = state.lock && state.lock.square != null ? state.lock.square : state.squares.findIndex(q => q && !q.owner);
            if (i >= 0) { state.screen = 'mini'; state.zoom = i; commit(); }
          }
        }
        await sl(250);
      }
      await sl(4000);                                            // (the end's report through the outbox)
      return { winner: state.winner, reason: state.winReason, moves: state.moves, id: state.stats && state.stats.id, uid: (window.fb && fb.uid) || null };
    });
    uid = played.uid;
    check(!!played.winner && !perr.length, `played to its end: ${played.winner} won (${played.reason}), ${played.moves} moves${perr.length ? '; page errors: ' + perr.join(' | ') : ''}`);
  } catch (e) { check(false, `the match: ${String(e.message).split('\n')[0]}`); }
  await ctx.close().catch(() => {});

  let row = null, rowPath = null;
  for (let k = 0; k < 30 && !row; k++) {
    const all = (await get('mfacts')) || {};
    for (const [day, byId] of Object.entries(all)) for (const [id, r] of Object.entries(byId || {})) if (r && r.t1 && (r.who || []).some(w => w.h === h)) { row = Object.assign({ id }, r); rowPath = `mfacts/${day}/${id}`; }
    if (!row) await new Promise(ok => setTimeout(ok, 2000));
  }
  if (check(!!row, `its row: ${rowPath || 'not found'}`)) {
    const sq = JSON.parse(row.sq || '[]'), won = sq.filter(e => e.end === 'won');
    check(row.m === 'cpu' && !row.own && row.end && row.who[0].s, `mode vs Computer, not mine, ended (${row.end}), the player's side ${row.who[0].s}, ${row.n} turns, ${sq.length} squares (${won.length} claimed)`);
    const after = await read();
    for (const f of FILTERS) {
      const c = ctxOf(after, f), S = c.S, v = id => X.metric(S, id).v, who = f.mine ? 'with my devices' : 'without my devices';
      const pid = 'd:' + h, m = c.M.matches.find(x => x.id === row.id);
      check(v('started') === 1 && v('finished') === 1 && v('active') === 1 && v('newPlayers') === 1 && v('squares') === won.length, `${who}: 1 match started and finished, 1 active and new player, ${won.length} completed squares (${['started', 'finished', 'active', 'newPlayers', 'squares'].map(id => `${id} ${v(id)}`).join(', ')})`);
      const ov = P.overview(c), pl = P.players(c), ma = P.matches(c), ga = P.gamesCompare(c);
      check(shown(ov, 'started') === '1' && shown(ov, 'finished') === '1' && shown(ov, 'active') === '1', `${who}: the Overview shows it (started ${shown(ov, 'started')}, finished ${shown(ov, 'finished')}, active ${shown(ov, 'active')})`);
      check(pl.includes(`data-go="#players/${encodeURIComponent(pid)}"`) && shown(pl, 'active') === '1', `${who}: Players lists the guest ${h.slice(0, 8)}`);
      check(ma.includes(`data-go="#matches/${encodeURIComponent(row.id)}"`) && shown(ma, 'finished') === '1', `${who}: Matches lists the match`);
      const ttt = (ga.match(/<tr><td><a href="#games\/ttt">[\s\S]*?<\/tr>/) || [''])[0], n = (ttt.match(/href="#drill\/x:sq%3Attt"[^>]*>(\d+)</) || [])[1];
      check(won.length ? Number(n) === won.length : !n, `${who}: Games shows Tic-tac-toe's ${won.length} completed squares (${n || 0})`);
      const pr = P.profile(c, pid), mp = P.match(c, row.id);
      check(pr.includes(`#matches/${encodeURIComponent(row.id)}`) && mp.includes(`#players/${encodeURIComponent(pid)}`) && !!m, `${who}: the player's page links the match and the match links the player`);
    }
    await adminSections(browser, after, full, ctl, 'with the test match');
  }

  // ---------- 3. the test match deleted ----------
  console.log('\n3. The test match deleted');
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const up = { [`devices/${h}`]: null, [`devlog/${h}`]: null };
  if (rowPath) { up[rowPath] = null; up[`statsSeen/match/${row.id}`] = null; }
  if (played && played.id) up[`statsSeen/match/l_${played.id}`] = null;
  await db.ref().update(up);
  await db.ref(`devicesDay/${day}`).transaction(c => (Number.isFinite(c) && c > 1 ? c - 1 : null)).catch(() => {});
  if (uid) await admin.auth().deleteUser(uid).then(() => console.log(`     the guest's sign-in ${uid.slice(0, 6)}… deleted`), e => console.log(`     the guest's sign-in: ${e.code || e.message}`));
  const end = await read();
  for (const f of FILTERS) {
    const c = ctxOf(end, f), nonzero = X.METRIC_IDS.filter(id => { const m = X.metric(c.S, id); return m.rows.length > 0 || (typeof m.v === 'number' && m.v !== 0); });
    check(!nonzero.length, `every metric back to zero, ${f.mine ? 'with' : 'without'} my devices${nonzero.length ? ': ' + nonzero.join(', ') : ''}`);
  }
  await browser.close();
  await admin.app().delete();
  console.log(bad ? `\n${bad} check(s) failed.` : '\nAll checks passed.');
  process.exit(bad ? 1 : 0);
}

// What the admin page's settings cards read (admin.js loadCtl), from the database as it is.
function adminCtl(d) {
  const c = d.config || {}, a = d.admin || {};
  return { config: a.config || {}, secretsSet: a.secretsSet || {}, bots: d.bots || {}, botStats: {}, alertStats: d.alertStats || {}, features: d.features || {}, releases: d.releases || {},
    runCfg: c.run || {}, bullsCfg: c.bulls || {}, wheelsCfg: c.wheels || {}, plinkoCfg: c.plinko || {}, pigCfg: c.pig || {}, roadsCfg: c.roads || {}, oddCfg: c.oddone || {},
    attCfg: { headcount: c.headcount || {}, flash: c.flash || {}, snapshot: c.snapshot || {} }, fingCfg: { skyhop: c.skyhop || {}, scoop: c.scoop || {}, bowling: c.bowling || {}, pinball: c.pinball || {} },
    alertLog: Object.values(d.alertLog || {}).sort((x, y) => y.at - x.at).slice(0, 8), tune: c.tune || {}, versions: c.versions || {}, versionLog: c.versionLog || {}, ai: c.ai || {}, anim: c.anim || {},
    timer: c.timer || {}, clients: c.clients || {}, allow: {}, stagingMode: 'allowlist' };
}
// Every section of admin.html in Chromium: the page served from this checkout, its own scripts, these rows (its test hook:
// the same code that draws the live page once it has read them).
async function adminSections(browser, rows, full, ctl, when) {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
  const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT)) { r.writeHead(404); r.end(); return; } fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(b); } }); });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.TTT_FIREBASE = { offline: true }; });
  await p.goto(`http://127.0.0.1:${srv.address().port}/admin.html#overview`);
  await p.waitForFunction(() => window.TTC_ADMIN, null, { timeout: 20000 });
  await p.evaluate(async ([w, c, meta, tpl, tok]) => {
    const A = window.TTC_ADMIN; await A.loadMetas(); A.ctl = c;
    A.seed(Object.assign({}, w, { devmeta: meta || {}, token: tok || null, templates: tpl || {} })); A.ready(); A.render();
  }, [rows, ctl, full.devmeta, Object.assign({}, ...Object.values(full.templates || {})), (full.admin || {}).ownerToken]);
  const out = [];
  for (const h of ['overview', 'players', 'matches', 'games', 'games/ttt', 'growth', 'health', 'settings']) {
    await p.evaluate(x => { location.hash = '#' + x; }, h); await p.waitForTimeout(150);
    const ok = await p.evaluate(() => !!document.querySelector('nav.nav') && document.querySelectorAll('.card').length > 0);
    out.push(`${h}${ok ? '' : ' (empty)'}`);
    if (!ok) errs.push(`#${h} drew nothing`);
  }
  check(!errs.length, `the admin page, ${when}: every section draws (${out.join(', ')})${errs.length ? '; ' + errs.slice(0, 3).join(' | ') : ''}`);
  await ctx.close(); srv.close();
}

if (require.main === module) main().catch(e => { console.log('::error::' + (e.stack || e.message)); process.exit(1); });
