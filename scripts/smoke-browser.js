'use strict';
// The live site in a real browser (Chromium, Playwright): what the plain checks (smoke-live.js) cannot see.
//   - no Content Security Policy violation on the game, the sign-in screen, Google's sign-in hand-off or the admin page;
//   - the sign-in screen's Continue with Google opens the sign-in window, which reaches Google's own sign-in page
//     (Firebase's auth handler on the site's domain loaded, Google's scripts with it);
//   - the admin page gets past "Loading…" to its sign-in.
// Run after every deploy (the Deploy workflow) and after a release (scripts/release.js, once production is live).
//   node scripts/smoke-browser.js production|staging      (SMOKE_URL to point it elsewhere)
// Needs Playwright with Chromium: npm i --no-save playwright && npx playwright install --with-deps chromium.
const TARGET = process.argv[2] === 'production' ? 'production' : 'staging';
const SITE = (process.env.SMOKE_URL || (TARGET === 'production' ? 'https://tictacchaos.com' : 'https://staging.tictacchaos.com')).replace(/\/$/, '');
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) bad++; };

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
  check(csp.length === 0, `no Content Security Policy violations${csp.length ? ':\n       ' + [...new Set(csp)].slice(0, 12).join('\n       ') : ''}`);
  await browser.close();
  if (bad) { console.log(`\n${bad} browser check${bad === 1 ? '' : 's'} failed on ${SITE}.`); process.exit(1); }
  console.log(`\nThe browser checks passed on ${SITE}.`);
}
main().catch(e => { console.log(`FAIL ${e.message}`); process.exit(1); });
