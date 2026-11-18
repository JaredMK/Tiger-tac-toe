// The board's square titles in a real browser (Chromium, Playwright), at 360, 390 and 430 px: every mini-game, in each of
// the three columns, its title the one fixed size (14.5px) and at most two lines with nothing cut, and the same with the
// last-played badge on it (once played: the badge once sat inline in the name, took its width and "Rock Paper Scissors"
// went to three and four lines over the drawing) and under the other side's ring (spot: the ring once sat 5% inside the
// square and its corner ran through the name; now round the square's box, outside it). Then a square really played into
// and left (the zoom in and out): its title the same as before. Run by npm run test:flows.
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
async function boardPage(browser, base, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await ctx.route('**/src/env.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.TTC_ENV={};' }));
  await ctx.route(/gstatic|firebase|cdnjs|googleapis|recaptcha/, r => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('tiger-tac-toe.v4.onboard', JSON.stringify({ done: true, quiet: true, n: 9, speed: true, seen: {} })); } catch (e) { /* (none) */ } });
  const p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(String(e.message)));
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.waitForSelector('[data-act="cpu-go"]', { timeout: 20000 });
  await p.tap('[data-act="cpu-go"]'); await p.tap('[data-act="start"]');
  await p.waitForFunction(() => window.state.screen === 'board' && !document.querySelector('.vsintro'), null, { timeout: 15000 });
  await p.evaluate(() => document.fonts.ready);
  return { ctx, p, errors };
}
// Each title on the board as it stands: lines, cut (taller or wider than its box), size.
const MEASURE = `window.__title = i => { const sp = document.querySelectorAll('.board .sq')[i].querySelector('.lab > .lnm'); const cs = getComputedStyle(sp);
  const lh = parseFloat(cs.lineHeight), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  return { lines: Math.round((sp.scrollHeight - pad) / lh), cut: sp.scrollHeight > sp.clientHeight + 1 || sp.scrollWidth > sp.clientWidth + 1, fs: cs.fontSize }; };`;

test('square titles: one fixed size, two lines at most, nothing cut, the same once played and under the ring, every game in every column at 360, 390 and 430', { skip: !chromium && !process.env.CI && 'Playwright is not installed (npm i --no-save playwright && npx playwright install chromium)' }, async () => {
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const [w, h] of [[360, 640], [390, 844], [430, 932]]) {
      const { ctx, p, errors } = await boardPage(browser, base, w, h);
      await p.evaluate(MEASURE);
      const bad = await p.evaluate(async () => {
        const s = window.state, T = window.TYPES, out = [], wait = ms => new Promise(r => setTimeout(r, ms));
        s.squares.forEach(q => { q.owner = null; }); s.cpu = []; /* (nobody's computer: the board stays as this test lays it) */
        for (let rot = 0; rot < 3; rot++) for (let g = 0; g < T.length; g += 9) {
          const batch = T.slice(g, g + 9), pos = i => Math.floor(i / 3) * 3 + (i + rot) % 3;
          batch.forEach((t, i) => { s.squares[pos(i)] = { mini: window.newMini(t, window.makeRng('t' + t)), owner: null }; });
          s.screen = 'board'; s.zoom = null; s.flash = null; s.lastSquare = null; s.spot = null; window.render(); await wait(20);
          const before = batch.map((t, i) => window.__title(pos(i)));
          for (let i = 0; i < batch.length; i++) {
            const k = pos(i), b = before[i];
            s.lastSquare = k; s.lastBy = 'O'; window.render(); await wait(5); const a = window.__title(k);
            s.lastSquare = null; s.spot = { square: k, by: 'O', label: 'Computer plays here' }; window.render(); await wait(5); const sp = window.__title(k);
            const ring = getComputedStyle(document.querySelectorAll('.board .sq')[k], '::before');
            s.spot = null;
            const name = `${batch[i]} col ${k % 3}`;
            if (b.fs !== '14.5px') out.push(`${name}: size ${b.fs}`);
            if (b.lines > 2 || b.cut) out.push(`${name}: ${b.lines} lines${b.cut ? ', cut' : ''}`);
            if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${name}: once played ${JSON.stringify(a)} against ${JSON.stringify(b)}`);
            if (JSON.stringify(sp) !== JSON.stringify(b)) out.push(`${name}: under the ring ${JSON.stringify(sp)} against ${JSON.stringify(b)}`);
            if (ring.top !== '0px' || ring.left !== '0px' || /inset/.test(ring.boxShadow)) out.push(`${name}: the ring is not round the square's box (${ring.top} ${ring.left} ${ring.boxShadow})`);
          }
        }
        return out;
      });
      assert.deepEqual(bad, [], `${w} px`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // A square really played into and left (the zoom in and out, the badge then on it): Rock Paper Scissors' title as before.
    const { ctx, p, errors } = await boardPage(browser, base, 360, 640);
    await p.evaluate(MEASURE);
    await p.evaluate(() => { const s = window.state; s.squares.forEach(q => { q.owner = null; }); s.squares[0] = { mini: window.newMini('rps', window.makeRng('r')), owner: null }; s.cpu = []; /* (nobody's computer: the board stays as this test lays it) */ s.lastSquare = null; window.render(); });
    const before = await p.evaluate(() => window.__title(0));
    await p.tap('.board .sq[data-i="0"]');
    await p.waitForSelector('main.mini', { timeout: 5000 });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const s = window.state; s.lastSquare = 0; s.lastBy = s.turn; });   // (as a move there leaves it: the last-played badge on it)
    await p.tap('[data-act="back"]');
    for (const t of [0, 60, 150, 400]) {                                    // through the zoom out and after it has landed
      await p.waitForTimeout(t ? t : 1);
      const now = await p.evaluate(() => document.querySelector('.board .sq[data-i="0"] .lnm') && window.__title(0));
      if (now) assert.deepEqual(now, before, `Rock Paper Scissors' title ${t} ms into the way back`);
    }
    assert.equal(await p.evaluate(() => !!document.querySelector('.board .sq[data-i="0"] .lastcap')), true, 'the badge is on it');
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { await browser.close(); srv.close(); }
});
