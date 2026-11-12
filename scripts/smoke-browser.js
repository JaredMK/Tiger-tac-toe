'use strict';
// The live site in a real browser (Chromium, Playwright): what the plain checks (smoke-live.js) cannot see.
//   - no Content Security Policy violation on the game, the sign-in screen, Google's sign-in hand-off or the admin page;
//   - the sign-in screen's Continue with Google opens the sign-in window, which reaches Google's own sign-in page
//     (Firebase's auth handler on the site's domain loaded, Google's scripts with it);
//   - production: a match against the computer plays (our move, the computer's reply, the turn back with us);
//   - the admin page gets past "Loading…" to its sign-in;
//   - the room invite: /join/CODE redirects and opens the join flow, Share invite and Copy invite carry the code and the link.
// Run after every deploy (the Deploy workflow) and after a release (scripts/release.js, once production is live).
//   node scripts/smoke-browser.js production|staging      (SMOKE_URL to point it elsewhere)
// Needs Playwright with Chromium: npm i --no-save playwright && npx playwright install --with-deps chromium.
const TARGET = process.argv[2] === 'production' ? 'production' : 'staging';
const SITE = (process.env.SMOKE_URL || (TARGET === 'production' ? 'https://tictacchaos.com' : 'https://staging.tictacchaos.com')).replace(/\/$/, '');
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) bad++; };

// A match against the computer (production: staging lets only its testers past the gate): Play Computer, Start, a move of
// ours in an open square, then the computer's reply played out and the turn back with us, no page error.
async function cpuMatch(ctx) {
  const cpu = await ctx.newPage(), perr = [];
  cpu.on('pageerror', e => perr.push(String(e.message).slice(0, 160)));
  await cpu.goto(SITE + '/', { waitUntil: 'load', timeout: 30000 });
  await cpu.waitForSelector('[data-act="cpu-go"]', { timeout: 20000 });
  await cpu.click('[data-act="cpu-go"]');
  await cpu.waitForSelector('[data-act="start"]', { timeout: 10000 });
  await cpu.click('[data-act="start"]');
  const r = await cpu.evaluate(async () => {
    const sl = ms => new Promise(ok => setTimeout(ok, ms)), t0 = Date.now();
    let at = null;
    while (Date.now() - t0 < 60000 && !state.winner) {
      const me = state.cpu === 'X' ? 'O' : 'X', still = state.flash || state.spot || state.done;
      if (at != null && state.moves > at && state.turn === me && !still && state.screen === 'board') return { ok: true, moves: state.moves };
      if (at == null && state.turn === me && !still && (state.screen === 'board' || state.screen === 'mini')) {
        const i = state.squares.findIndex(q => q && !q.owner);
        if (i >= 0) {
          state.screen = 'mini'; state.zoom = i; commit(); await sl(300);
          const m = randomLegalMove(state.squares[i].mini, me, RNG);
          if (m != null) { at = state.moves; attemptMove(m); }
        }
      }
      await sl(250);
    }
    return { ok: false, moves: state.moves, turn: state.turn, screen: state.screen, at };
  }).catch(e => ({ ok: false, err: e.message }));
  check(r.ok && !perr.length, `a match against the computer: our move, then the computer's, and the turn back with us (${JSON.stringify(r).slice(0, 120)}${perr.length ? '; page errors: ' + perr.join(' | ') : ''})`);
  await cpu.close().catch(() => {});
}
// The room invite (net/invite.js buildInvite): /join/CODE sends the site to /?room=CODE (firebase.json), the page opens the
// join flow for that code, and the host room's Share invite and Copy invite, tapped, hand over the one text with the code and
// the site's /join/CODE link (the share sheet and the clipboard caught; nothing is sent anywhere, no room is opened).
async function inviteCheck(ctx) {
  const code = 'BCDFG';
  const r = await fetch(`${SITE}/join/${code}`, { redirect: 'manual' });
  const loc = r.headers.get('location') || '';
  check(r.status >= 301 && r.status <= 308 && /\/\?room=BCDFG$/.test(loc), `/join/${code} sends the site to /?room=${code} (HTTP ${r.status} ${loc})`);
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.__got = []; Object.defineProperty(navigator, 'share', { value: async d => { window.__got.push(['share', d]); }, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__got.push(['copy', t]); } }, configurable: true }); });
  await p.goto(`${SITE}/join/${code}`, { waitUntil: 'load', timeout: 30000 });
  await p.waitForFunction(() => typeof state !== 'undefined' && state.screen === 'join', null, { timeout: 20000 }).catch(() => {});
  const j = await p.evaluate(async () => ({ screen: state.screen, code: (await import('/src/net/room.js')).joinCode }));
  check(j.screen === 'join' && j.code === code, `a /join/${code} link opens the join flow for its code (${JSON.stringify(j)})`);
  await p.evaluate(c => { state.online = { role: 'host', code: c, me: 'X', joined: false }; state.screen = 'setup'; state.setup.vs = null; render(); }, code);
  // (staging's gate stands over every screen for anyone not on its list: there, the buttons' own handlers are called, the
  // very code a tap runs; on production the buttons are tapped)
  if (await p.isVisible('[data-act="share"]').catch(() => false)) {
    await p.click('[data-act="share"]'); await p.waitForTimeout(300);
    await p.click('[data-act="copy-invite"]'); await p.waitForTimeout(300);
  } else await p.evaluate(async () => { const R = await import('/src/net/room.js'); await R.shareRoom(); await R.copyInvite(); });
  const got = await p.evaluate(() => window.__got);
  const want = `Join my Tic Tac Chaos game! Code: ${code} ${SITE}/join/${code}`;
  check(JSON.stringify(got) === JSON.stringify([['share', { text: want }], ['copy', want]]), `Share invite and Copy invite hand over the one text with the code and the /join link (${JSON.stringify(got).slice(0, 200)})`);
  await p.evaluate(() => { state.online = null; state.screen = 'menu'; render(); }).catch(() => {});
  await p.close();
}
async function main() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.log('FAIL Playwright is not installed (npm i --no-save playwright && npx playwright install --with-deps chromium)'); process.exit(1); }
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const csp = [], loaded = [];
  // every page and frame reports its own violations (and the console says so too): all of them counted
  await ctx.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`[csp] ${e.violatedDirective} blocked ${e.blockedURI || '(inline)'}`)));
  const watch = p => {
    p.on('console', m => { const t = m.text(); if (/^\[csp\]|Content Security Policy|Refused to (load|frame|connect|execute|apply)/i.test(t)) csp.push(`${new URL(p.url() || SITE).pathname}: ${t.slice(0, 220)}`); });
    p.on('response', r => loaded.push({ url: r.url(), status: r.status() }));
  };
  ctx.on('page', watch);
  const page = await ctx.newPage();
  try {
    const r = await page.goto(SITE + '/', { waitUntil: 'load', timeout: 30000 });
    check(r && r.ok(), `the site loads (HTTP ${r && r.status()})`);
    const policy = r ? r.headers()['content-security-policy'] || '' : '';
    check(/script-src/.test(policy) && /apis\.google\.com/.test(policy), `the site sends its Content-Security-Policy, Google's sign-in scripts allowed${policy ? '' : ' (none sent)'}`);   // (the checks below are only worth something with the policy in force)
    // Link previews: the tags a chat app reads, the image they name (1200x630 PNG) and the home-screen icon, on this site's own address.
    const tag = await page.evaluate(() => { const g = k => { const e = document.querySelector(`meta[property="${k}"], meta[name="${k}"]`); return e && e.content; }; return { title: g('og:title'), desc: g('og:description'), image: g('og:image'), url: g('og:url'), w: g('og:image:width'), h: g('og:image:height'), card: g('twitter:card'), tw: g('twitter:image'), noindex: !!document.querySelector('meta[name="robots"][content*="noindex"]'), touch: (document.querySelector('link[rel="apple-touch-icon"]') || {}).href }; });
    check(tag.title === 'Tic Tac Chaos' && /every square is a mini-game/.test(tag.desc || '') && tag.card === 'summary_large_image' && tag.w === '1200' && tag.h === '630', `the page has its link-preview tags (og:title, og:description, size, twitter:card)`);
    check(tag.image === SITE + '/assets/share/og-image.png' && tag.tw === tag.image && tag.url === SITE + '/', `the preview image and url are absolute, on ${SITE} (${tag.image})`);
    for (const [what, u] of [['the preview image', tag.image], ['the home-screen icon', tag.touch], ['the favicon', SITE + '/favicon.ico']]) { const f = u ? await ctx.request.get(u) : null; check(f && f.ok() && /image\//.test(f.headers()['content-type'] || ''), `${what} is served as an image (${u}: HTTP ${f && f.status()})`); }
    check(tag.noindex === (TARGET === 'staging'), TARGET === 'staging' ? 'staging stays noindex' : 'production is indexable (no noindex)');
    await page.waitForSelector('[data-act="login"], [data-act="login-google"]', { timeout: 20000 });
    if (!(await page.$('[data-act="login-google"]'))) await page.click('[data-act="login"]');
    await page.waitForSelector('[data-act="login-google"]:not([disabled])', { timeout: 20000 });
    check(true, 'the sign-in screen shows Continue with Google');
    const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 20000 }), page.click('[data-act="login-google"]')]);
    let google = false;
    try { await popup.waitForURL(/accounts\.google\.com/, { timeout: 30000 }); google = true; } catch (e) { /* (below) */ }
    check(google, `Continue with Google reaches Google's sign-in page (${google ? 'accounts.google.com' : 'stopped at ' + popup.url().slice(0, 120)})`);
    const handler = loaded.find(x => /\/__\/auth\/handler/.test(x.url));
    check(!!handler && handler.status < 400, `Firebase's sign-in handler loaded (${handler ? `HTTP ${handler.status}` : 'never requested'})`);
    const gapi = loaded.find(x => /apis\.google\.com\/js\/api\.js/.test(x.url));
    check(!!gapi && gapi.status < 400, `Google's sign-in scripts loaded (apis.google.com: ${gapi ? `HTTP ${gapi.status}` : 'never requested'})`);
    const err = await page.$eval('body', b => /Couldn.t log in/i.test(b.innerText)).catch(() => false);
    check(!err, 'no "Couldn\'t log in" on the sign-in screen');
    await popup.close().catch(() => {});
    const admin = await ctx.newPage();
    await admin.goto(SITE + '/admin.html', { waitUntil: 'load', timeout: 30000 });
    let past = false;
    try { await admin.waitForSelector('[data-act="google"]', { state: 'visible', timeout: 20000 }); past = true; } catch (e) { /* (below) */ }
    check(past, 'the admin page gets past "Loading…" to its sign-in');
  } catch (e) {
    check(false, `the browser check stopped: ${String(e && e.message || e).split('\n')[0]}`);
  }
  try { await inviteCheck(ctx); } catch (e) { check(false, `the invite check stopped: ${String(e && e.message || e).split('\n')[0]}`); }
  if (TARGET === 'production') { try { await cpuMatch(ctx); } catch (e) { check(false, `the match against the computer stopped: ${String(e && e.message || e).split('\n')[0]}`); } }
  check(csp.length === 0, `no Content Security Policy violations${csp.length ? ':\n       ' + [...new Set(csp)].slice(0, 12).join('\n       ') : ''}`);
  await browser.close();
  if (bad) { console.log(`\n${bad} browser check${bad === 1 ? '' : 's'} failed on ${SITE}.`); process.exit(1); }
  console.log(`\nThe browser checks passed on ${SITE}.`);
}
main().catch(e => { console.log(`FAIL ${e.message}`); process.exit(1); });
