'use strict';
// After a deploy: the live site, functions and rules answer as they should. Run by the deploy workflow.
// It uses a throwaway guest session (deleted at the end) and writes nothing to the game.
//   node scripts/smoke-live.js production|staging      (GITHUB_SHA: the site must be at this commit)
// Staging is gated (only testers on the allowlist): its server calls refuse anyone else, and a guest reads nothing.
const ENVS = require('./env-config.js').CONFIGS;
const ENV = process.argv[2] === 'staging' ? 'staging' : 'production', CFG = ENVS[ENV], STAGING = ENV === 'staging';
const KEY = CFG.apiKey;
const FN = `https://us-central1-${CFG.projectId}.cloudfunctions.net`;
const DB = CFG.databaseURL;
const SITE = `https://${CFG.projectId}.web.app`;
const ID = 'https://identitytoolkit.googleapis.com/v1/accounts';
const json = { 'content-type': 'application/json' };
let failed = false;
const check = (good, what) => { console.log(`${good ? 'ok  ' : 'FAIL'} ${what}`); if (!good) failed = true; };
(async () => {
  const v = await fetch(`${SITE}/version.json`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
  check(!!v && v.env === ENV && (!process.env.GITHUB_SHA || v.sha === process.env.GITHUB_SHA), `the ${ENV} site is live at ${v ? String(v.sha).slice(0, 7) : '(none)'}${process.env.GITHUB_SHA ? `, this commit ${process.env.GITHUB_SHA.slice(0, 7)}` : ''}`);
  const robots = await fetch(`${SITE}/robots.txt`).then(r => r.text()).catch(() => '');
  check(STAGING ? /Disallow: \/\s*$/m.test(robots) : !/Disallow: \/\s*$/m.test(robots), STAGING ? 'staging keeps crawlers out (robots.txt)' : 'production lets crawlers in (robots.txt)');
  for (const f of ['claimUsername', 'findMatch', 'cancelSearch', 'move', 'timeout', 'resign', 'recordLocal', 'tick']) {
    const r = await fetch(`${FN}/${f}`, { method: 'POST', headers: json, body: '{"data":{}}' });
    const j = await r.json().catch(() => ({}));
    if (STAGING) check(r.status === 403 && j.error && j.error.status === 'PERMISSION_DENIED', `${f} is live and refuses anyone not on the staging list (HTTP ${r.status})`);
    else check(r.status === 401 && j.error && j.error.status === 'UNAUTHENTICATED', `${f} is live and asks for a login (HTTP ${r.status})`);
  }
  const ta = await fetch(`${FN}/testAlert`, { method: 'POST', headers: json, body: '{"data":{}}' });
  const tj0 = await ta.json().catch(() => ({}));
  check(ta.status === 403 && tj0.error && tj0.error.status === 'PERMISSION_DENIED', `testAlert is live and for the admin only (HTTP ${ta.status})`);
  const tr = await fetch(`${FN}/track`, { method: 'POST', headers: json, body: '{"data":{}}' });
  const tj = await tr.json().catch(() => ({}));
  if (STAGING) check(tr.status === 403, `track is live and refuses anyone not on the staging list (HTTP ${tr.status})`);
  else check(tr.status === 400 && tj.error && tj.error.status === 'INVALID_ARGUMENT', `track is live and refuses an empty event (HTTP ${tr.status})`);
  if (STAGING) {
    const sa = await fetch(`${FN}/stagingAccess`, { method: 'POST', headers: json, body: '{"data":{}}' });
    const sj = await sa.json().catch(() => ({}));
    check(sa.status === 200 && sj.result && sj.result.ok === false, `stagingAccess is live and lets no one in without a login (HTTP ${sa.status})`);
  }
  const s = await (await fetch(`${ID}:signUp?key=${KEY}`, { method: 'POST', headers: json, body: JSON.stringify({ returnSecureToken: true }) })).json();
  if (!s.idToken) { console.log('::warning::No guest session for the rules check:', JSON.stringify(s.error || s).slice(0, 200)); }
  else {
    const lb = await fetch(`${DB}/leaderboard.json?orderBy=%22rating%22&limitToLast=1&auth=${s.idToken}`);
    if (STAGING) check(lb.status === 401, `a guest reads nothing on staging (HTTP ${lb.status})`);
    else check(lb.status === 200, `the leaderboard can be read, sorted by rating (rules and index are live) (HTTP ${lb.status})`);
    const w = await fetch(`${DB}/users/${s.localId}/rating.json?auth=${s.idToken}`, { method: 'PUT', body: '3000' });
    check(w.status === 401, `a phone cannot write a rating (HTTP ${w.status})`);
    const g = await fetch(`${DB}/games.json?shallow=true&auth=${s.idToken}`);
    check(g.status === 401, `a phone cannot list the games or their hidden values (HTTP ${g.status})`);
    const st = await fetch(`${DB}/stats.json?shallow=true&auth=${s.idToken}`);
    check(st.status === 401, `only the admin can read the stats (HTTP ${st.status})`);
    const sw = await fetch(`${DB}/stats/modes/local/started.json?auth=${s.idToken}`, { method: 'PUT', body: '1' });
    check(sw.status === 401, `a phone cannot write the stats (HTTP ${sw.status})`);
    const rv = await fetch(`${DB}/review.json?shallow=true&auth=${s.idToken}`);
    check(rv.status === 401, `only the admin can read the username review list (HTTP ${rv.status})`);
    const bg = await fetch(`${DB}/botGames.json?shallow=true&auth=${s.idToken}`);
    check(bg.status === 401, `a phone cannot list which games are against a bot (HTTP ${bg.status})`);
    const bo = await fetch(`${DB}/bots.json?shallow=true&auth=${s.idToken}`);
    check(bo.status === 401, `only the admin can read the bot roster (HTTP ${bo.status})`);
    const ks = await fetch(`${DB}/admin/secrets.json?shallow=true&auth=${s.idToken}`);
    check(ks.status === 401, `nobody can read the alert keys (HTTP ${ks.status})`);
    const lw = await fetch(`${DB}/localStats/${s.localId}/wins.json?auth=${s.idToken}`, { method: 'PUT', body: '99' });
    check(lw.status === 401, `a phone cannot write its own local record (HTTP ${lw.status})`);
    const lo = await fetch(`${DB}/localHistory/someone-else.json?shallow=true&auth=${s.idToken}`);
    check(lo.status === 401, `a phone cannot read someone else's local games (HTTP ${lo.status})`);
    const c = await fetch(`${FN}/claimUsername`, { method: 'POST', headers: Object.assign({ authorization: 'Bearer ' + s.idToken }, json), body: JSON.stringify({ data: { username: 'smoke_test' } }) });
    check(c.status === 401, `a guest cannot claim a username (HTTP ${c.status})`);
    await fetch(`${ID}:delete?key=${KEY}`, { method: 'POST', headers: json, body: JSON.stringify({ idToken: s.idToken }) }).catch(() => {});
  }
  if (failed) { console.log('::error::The live check failed.'); process.exit(1); }
})().catch(e => { console.log('::error::The live check could not run: ' + e.message); process.exit(1); });
