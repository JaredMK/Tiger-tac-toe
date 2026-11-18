// Codebreaker's slots in a real browser (Chromium, Playwright): a practice match on the page served from this checkout,
// slot 4 tapped first and a colour put in it, then slot 2, then the rest; Submit stays off until all four are filled and
// the guess goes in as placed. Real taps, so what the finger hits is tested too: the guess list once lay over the slots
// (its negative margin and its mask's stacking context) and took every tap, which a render in Node never showed.
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
    if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

test('Codebreaker: tap slot 4 first, then slot 2: each takes the next colour; Submit once all four are filled', { skip: !chromium && !process.env.CI && 'Playwright is not installed (npm i --no-save playwright && npx playwright install chromium)' }, async () => {
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
      const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
      await ctx.route('**/src/env.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.TTC_ENV={};' }));
      await ctx.route(/gstatic|firebase|cdnjs|googleapis|recaptcha/, r => r.abort());
      await ctx.addInitScript(() => { try { localStorage.setItem('tiger-tac-toe.v4.onboard', JSON.stringify({ done: true, quiet: true, n: 9, speed: true })); } catch (e) { /* (none) */ } });
      const p = await ctx.newPage(), errors = [];
      p.on('pageerror', e => errors.push(String(e.message)));
      await p.goto(base + '/', { waitUntil: 'load' });
      await p.waitForSelector('[data-act="howto"]', { timeout: 20000 });
      await p.tap('[data-act="howto"]');
      await p.tap('[data-act="explain"][data-t="mastermind"]');
      await p.tap('[data-act="practice"]');                               // Codebreaker alone, in its square (ui/explainer.js)
      await p.waitForSelector('.mmslot', { timeout: 10000 });
      await p.waitForFunction(() => !window.state.intro && !document.querySelector('.vsintro'), null, { timeout: 10000 }).catch(() => {});
      if (await p.$('.vsintro')) await p.tap('.vsintro');
      await p.waitForTimeout(300);
      const slots = () => p.$$eval('.mmslot', a => a.map(s => ({ at: s.classList.contains('at'), c: (s.querySelector('.peg') || { className: '' }).className.match(/\bc(\d)\b/)?.[1] ?? null })));
      const go = () => p.$eval('.mmgo', b => b.disabled);
      // slot 4 while 1-3 are empty: it is selected, and the colour goes into it
      await p.tap('.mmslot[data-k="3"]');
      assert.deepEqual((await slots()).map(s => s.at), [false, false, false, true], 'slot 4 selected');
      await p.tap('.mmcol[data-c="0"]');
      assert.deepEqual((await slots()).map(s => s.c), [null, null, null, '0'], 'the colour went into slot 4');
      assert.equal(await go(), true, 'Submit off: slots empty');
      // then slot 2
      await p.tap('.mmslot[data-k="1"]');
      assert.deepEqual((await slots()).map(s => s.at), [false, true, false, false], 'slot 2 selected');
      await p.tap('.mmcol[data-c="1"]');
      assert.deepEqual((await slots()).map(s => s.c), [null, '1', null, '0'], 'the colour went into slot 2');
      assert.equal(await go(), true, 'Submit off: two slots empty');
      // the rest, by tapping each
      await p.tap('.mmslot[data-k="0"]'); await p.tap('.mmcol[data-c="2"]');
      assert.equal(await go(), true, 'Submit off: one slot empty');
      await p.tap('.mmslot[data-k="2"]'); await p.tap('.mmcol[data-c="3"]');
      assert.deepEqual((await slots()).map(s => s.c), ['2', '1', '3', '0']);
      assert.equal(await go(), false, 'Submit on: all four filled');
      await p.tap('.mmgo');
      await p.waitForFunction(() => (window.state.squares[4].mini.guesses || []).length >= 1, null, { timeout: 5000 });
      const g = await p.evaluate(() => window.state.squares[4].mini.guesses[0].code);
      assert.deepEqual(g, [2, 1, 3, 0], `the guess went in as placed (${vp.width}x${vp.height})`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
});
