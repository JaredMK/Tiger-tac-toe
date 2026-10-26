'use strict';
// App Store screenshots, from the page itself in Playwright's Chromium: the main menu, the board mid-match, two mini-games
// and the match-end screen, at the sizes App Store Connect asks for. The page runs from this folder over a local server
// with src/env.js stubbed (no Firebase project, no network: Play Computer alone), the state set through the page's own
// names (src/ui/debug.js puts state, render, newMini... on window, as the browser tests do). Writes _shots/<device>/*.png
// (gitignored). Needs Playwright with Chromium (npm i --no-save playwright && npx playwright install --with-deps chromium).
//   node scripts/app-screenshots.js            (npm run app-shots; SHOT_DEVICES=iphone69 to pick devices, SHOT_MINIS=hilo,wordle the games)
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '_shots');
// The CSS viewport and the scale: 440x956 @3 = 1320x2868 (iPhone 6.9"), 428x926 @3 = 1284x2778 (iPhone 6.5"), 1032x1376 @2 = 2064x2752 (iPad 13").
const DEVICES = {
  iphone69: { w: 440, h: 956, scale: 3, label: 'iPhone 6.9" 1320x2868' },
  iphone65: { w: 428, h: 926, scale: 3, label: 'iPhone 6.5" 1284x2778' },
  ipad13: { w: 1032, h: 1376, scale: 2, label: 'iPad 13" 2064x2752' },
};
const pick = (process.env.SHOT_DEVICES || Object.keys(DEVICES).join(',')).split(',').filter(d => DEVICES[d]);
const MINIS = (process.env.SHOT_MINIS || 'hilo,wordle').split(',');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
// This folder, served (matter.min.js from node_modules, as the site build stages it).
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      let file = path.join(ROOT, p);
      if (p === '/matter.min.js') file = path.join(ROOT, 'node_modules', 'matter-js', 'build', 'matter.min.js');
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}
async function main() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { console.log('Playwright is not installed (npm i --no-save playwright && npx playwright install --with-deps chromium)'); process.exit(1); }
  const { srv, url } = await serve();
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  for (const d of pick) {
    const dev = DEVICES[d], dir = path.join(OUT, d);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await b.newContext({ viewport: { width: dev.w, height: dev.h }, deviceScaleFactor: dev.scale, hasTouch: true, isMobile: d !== 'ipad13' });
    await ctx.route('**/src/env.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.TTC_ENV={};' }));   // (no Firebase project: nothing online, nothing reported)
    await ctx.route(/gstatic|firebase|cdnjs|googleapis|recaptcha/, r => r.abort());
    const p = await ctx.newPage();
    let n = 0;
    const shot = async name => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400); const f = path.join(dir, `${String(++n).padStart(2, '0')}-${name}.png`); await p.screenshot({ path: f }); console.log(`${dev.label}: ${path.relative(ROOT, f)}`); };
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForSelector('[data-act="cpu-go"]', { timeout: 20000 });
    await shot('menu');
    // A match against the computer, as the player: Sam (X) against the computer, mid-match (three squares claimed, the last by the
    // computer, with its badge), the player on the move.
    await p.click('[data-act="cpu-go"]'); await p.waitForSelector('[data-act="start"]'); await p.click('[data-act="start"]');
    await p.waitForTimeout(200);
    if (await p.$('[data-act="intro-close"]')) await p.click('[data-act="intro-close"]');
    await p.evaluate(() => {
      state.cpu = 'O'; state.setup.names = { X: 'Sam', O: 'Computer' }; state.turn = 'X';   // (a player with a username: the turn line reads naturally)
      const own = { 0: 'X', 4: 'O', 8: 'X', 5: 'O' };
      for (const [i, s] of Object.entries(own)) state.squares[i].owner = s;
      state.lastSquare = 5; state.lastBy = 'O'; state.moves = 9; state.spot = null; state.flash = null; state.done = null; state.stamp = null;
      render();
    });
    await shot('board');
    for (const t of MINIS) {
      const ok = await p.evaluate(async t => {
        if (t === 'trivia') { for (let k = 0; k < 40 && !triviaReady(); k++) await new Promise(r => setTimeout(r, 100)); if (!triviaReady()) return 'no trivia'; }
        if (['golf', 'pool', 'bowling', 'pinball'].includes(t)) { for (let k = 0; k < 60 && !physicsReady(); k++) await new Promise(r => setTimeout(r, 100)); if (!physicsReady()) return 'no physics'; }
        const i = [1, 2, 3, 6, 7].find(k => !state.squares[k].owner), sq = state.squares[i];
        sq.mini = newMini(t, makeRng('shot-' + t));
        if (t === 'trivia') triviaDeal(state, sq, makeRng('tq'));
        state.screen = 'mini'; state.zoom = i; state.draft = ''; state.sel = []; state.notice = null; state.flash = null; state.done = null;
        render();
        return 'ok';
      }, t);
      if (ok !== 'ok') { console.log(`${dev.label}: ${t} skipped (${ok})`); continue; }
      if (t === 'wordle') await p.evaluate(() => { for (const k of 'CHAOS') { const b = document.querySelector(`[data-k="${k}"]`); if (b) b.click(); } });   // a word on the way in
      await shot(t);
      await p.evaluate(() => { state.screen = 'board'; state.zoom = null; render(); });
    }
    // The match's end: the player's win.
    await p.evaluate(() => {
      for (const i of [0, 1, 2]) state.squares[i].owner = 'X';
      state.winner = 'X'; state.winLine = [0, 1, 2]; state.winReason = 'line'; state.counts = { X: 5, O: 2 }; state.endPick = null; state.screen = 'win'; state.zoom = null; state.stamp = null;
      render();
    });
    await shot('win');
    await ctx.close();
  }
  await b.close();
  srv.close();
}
main().catch(e => { console.error(e); process.exit(1); });
