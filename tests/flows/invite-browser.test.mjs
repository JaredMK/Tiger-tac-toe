// The room invite in a real browser (Chromium, Playwright): the host's room on the page served from this checkout, Share
// invite tapped (the browser's share sheet caught: one call, the text alone, the code and the /join/CODE link in it) and Copy
// invite tapped (the clipboard caught: the same text), then the same in the iOS app's shell (a Capacitor stand-in: the
// native Share plugin and Clipboard), and a /join/CODE address opening the join flow for its code. Run by npm run
// test:flows (the Deploy workflow and npm run release).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
let chromium = null;
try { ({ chromium } = require('playwright')); } catch (e) { /* below */ }
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const j = /^\/join\/([^/]+)\/?$/.exec(p);
    if (j) { res.writeHead(302, { location: '/?room=' + j[1] }); return res.end(); }   // (firebase.json's redirect)
    if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok(srv)));
}
const CODE = 'BCDFG';
async function page(browser, base, init) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.route('**/src/env.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.TTC_ENV={};' }));
  await ctx.route(/gstatic|firebase|cdnjs|googleapis|recaptcha/, r => r.abort());
  await ctx.addInitScript(init);
  const p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(String(e.message)));
  return { ctx, p, errors };
}
// The host's room on show (as a hosted room is drawn: the code, Share invite and Copy invite), then both buttons tapped.
async function tapBoth(p, base) {
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForSelector('[data-act="cpu-go"]', { timeout: 20000 });
  await p.evaluate(code => { state.online = { role: 'host', code, me: 'X', joined: false }; state.screen = 'setup'; state.setup.vs = null; render(); }, CODE);
  await p.waitForSelector('[data-act="share"]');
  await p.tap('[data-act="share"]'); await p.waitForTimeout(200);
  await p.tap('[data-act="copy-invite"]'); await p.waitForTimeout(200);
  return p.evaluate(() => window.__got);
}
const WEB = () => { window.__got = []; Object.defineProperty(navigator, 'share', { value: async d => { window.__got.push(['share', d]); }, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__got.push(['copy', t]); } }, configurable: true }); };
const APP = () => { window.__got = []; window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { Share: { share: async d => { window.__got.push(['share', d]); } }, Clipboard: { write: async o => { window.__got.push(['copy', o.string]); } } } }; };

test('Share invite and Copy invite, tapped: the one text with the code and the /join link (web and iOS shell); /join/CODE opens the join flow', { skip: !chromium && !process.env.CI && 'Playwright is not installed (npm i --no-save playwright && npx playwright install chromium)' }, async () => {
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  try {
    // the web page
    const w = await page(browser, base, WEB);
    const got = await tapBoth(w.p, base);
    const want = `Join my Tic Tac Chaos game! Code: ${CODE} ${base}/join/${CODE}`;
    assert.deepEqual(got, [['share', { text: want }], ['copy', want]], 'the share sheet: the text alone (no url field); Copy: the same text');
    assert.deepEqual(w.errors, []);
    // the link: /join/CODE opens the join flow for that code, and the address is tidied
    await w.p.goto(`${base}/join/${CODE.toLowerCase()}`, { waitUntil: 'load' });
    await w.p.waitForFunction(() => state.screen === 'join', null, { timeout: 15000 });
    const j = await w.p.evaluate(async () => ({ code: (await import('/src/net/room.js')).joinCode, path: location.pathname + location.search }));
    assert.equal(j.code, CODE); assert.equal(j.path, '/', 'tidied: a reload is not a second join');
    await w.ctx.close();
    // the iOS app's shell: the native Share plugin and Clipboard, the production site's address in the link
    const a = await page(browser, base, APP);
    const gotApp = await tapBoth(a.p, base);
    const wantApp = `Join my Tic Tac Chaos game! Code: ${CODE} https://tictacchaos.com/join/${CODE}`;
    assert.deepEqual(gotApp, [['share', { text: wantApp }], ['copy', wantApp]]);
    await a.ctx.close();
  } finally { await browser.close(); srv.close(); }
});
