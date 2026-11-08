// The main board's miniature text against the board's hint (npm run check:minitext [-- 360x640,430x932 [games] [shots]]):
// every game dealt into the nine spaces, a few random moves played in each, and every visible text in a space (its name,
// its miniature's numbers and words) measured by its capital height (the font's own metrics at its rendered size) against
// the hint's ("Tap any square…", Patrick Hand 16px). Any smaller fails. Also fails a label that spills out of its space,
// or a page that scrolls. Screenshots in _shots/minitext/ with "shots".
const path = require('path'), fs = require('fs'), http = require('http');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, '_shots', 'minitext');
const SIZES = (process.argv[2] || '360x640,430x932').split(',').map(v => v.split('x').map(Number)), ONLY = process.argv[3] && process.argv[3] !== 'shots' ? process.argv[3].split(',') : null, SHOTS = process.argv.includes('shots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html'; let f = path.join(ROOT, p); if (p === '/matter.min.js') f = path.join(ROOT, 'node_modules/matter-js/build/matter.min.js'); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const { chromium } = require('playwright'); const b = await chromium.launch(); let fails = 0;
  for (const [W, H] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.route('**/src/env.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.TTC_ENV={};' }));
  await ctx.route(/gstatic|firebase|cdnjs|googleapis|recaptcha/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.waitForSelector('[data-act="cpu-go"]', { timeout: 20000 });
  await p.click('[data-act="cpu-go"]'); await p.waitForSelector('[data-act="start"]'); await p.click('[data-act="start"]'); await p.waitForTimeout(300);
  if (await p.$('[data-act="intro-close"]')) await p.click('[data-act="intro-close"]');
  await p.evaluate(async () => { await document.fonts.ready; });
  const types = await p.evaluate(async () => { const G = await import('/src/games/index.js'); return G.TYPES.filter(t => !(G.OLD_TYPES || []).includes(t) && !(G.SC_ONLY || []).includes(t)); }).then(t => (ONLY ? t.filter(x => ONLY.includes(x)) : t));
  const all = []; let hint = null;
  for (let k = 0; k < types.length; k += 9) {
    const batch = types.slice(k, k + 9);
    await p.evaluate(async (batch) => {
      const E = await import('/src/core/engine.js');
      state.spot = null; state.flash = null; state.lock = null; state.turn = 'X'; state.winner = null; state.screen = 'board';
      state.squares.forEach((sq, i) => {
        const t = batch[i % batch.length]; const r = E.makeRng('mt-' + t); sq.owner = null; sq.mini = E.newMini(t, r);
        for (let n = 0; n < 4; n++) { try { const p = n % 2 ? 'O' : 'X'; const m = E.randomLegalMove(sq.mini, p, r); if (m == null) break; const res = E.applyMove(sq.mini, p, m, r); if (res && res.outcome && res.outcome !== 'continue' && res.outcome !== 'again') { break; } } catch (e) { break; } }
      });
      render();
    }, batch);
    await p.waitForTimeout(250);
    if (SHOTS) await p.screenshot({ path: path.join(OUT, `board-${W}-${k / 9}.png`) });
    const res = await p.evaluate(() => {
      const c = document.createElement('canvas').getContext('2d');
      const cap = el => { const cs = getComputedStyle(el); let px = parseFloat(cs.fontSize); if (el instanceof SVGElement) { const m = el.getScreenCTM(); if (m) px *= Math.hypot(m.a, m.b); } c.font = `${cs.fontWeight} ${px}px ${cs.fontFamily}`; const t = c.measureText('H'); return { px: +px.toFixed(1), cap: +t.actualBoundingBoxAscent.toFixed(1), fam: cs.fontFamily.split(',')[0] }; };
      const h = document.querySelector('.foot .hint'); const hint = h ? cap(h) : null;
      const out = [];
      document.querySelectorAll('.board .sq').forEach((sq, i) => {
        const type = sq.getAttribute('aria-label') || '';
        const walker = document.createTreeWalker(sq, NodeFilter.SHOW_TEXT); let n, min = null, where = '';
        const bad = [];
        while ((n = walker.nextNode())) { const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (el.closest('.sr')) continue; const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).opacity === '0' || getComputedStyle(el).color === 'rgba(0, 0, 0, 0)') continue; const m = cap(el); const part = el.closest('.lab') ? 'label' : 'thumb'; if (!min || m.cap < min.cap) { min = m; where = part + ':' + t.slice(0, 14); } const chain = []; let e = el; while (e && e !== sq && chain.length < 4) { chain.push((e.tagName.toLowerCase()) + (e.getAttribute('class') ? '.' + e.getAttribute('class').split(' ').join('.') : '')); e = e.parentElement; } bad.push({ t: t.slice(0, 10), cap: m.cap, px: m.px, chain: chain.join(' < ') }); }
        const sr = sq.getBoundingClientRect(), th = sq.querySelector('.thumb').getBoundingClientRect(), lb = sq.querySelector('.lab span').getBoundingClientRect(); const spill = lb.left < sr.left - 0.5 || lb.right > sr.right + 0.5;
        out.push({ spill, bad, i, type: type.split(':')[1] ? type.split(':')[1].split(',')[0].trim() : type, min, where, sq: Math.round(sr.width), thumb: [Math.round(th.width), Math.round(th.height)] });
      });
      return { hint, out };
    });
    hint = res.hint; all.push(...res.out.slice(0, batch.length));
  }
  const scroll = await p.evaluate(() => document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollWidth > innerWidth + 1);
  const spills = all.filter(r => r.spill).map(r => r.type);
  console.log('viewport', W + 'x' + H, 'hint', JSON.stringify(hint), 'space', all[0].sq, 'thumb', JSON.stringify(all[0].thumb));
  const small = all.filter(r => r.min && r.min.cap < hint.cap - 0.05).sort((a, b) => a.min.cap - b.min.cap);
  console.log('below the hint:', small.length, 'of', all.length, '| labels spilling:', spills.length ? spills.join(', ') : 'none', '| scroll:', scroll);
  fails += small.length + spills.length + (scroll ? 1 : 0);
  for (const r of small) { console.log('##', r.type); const seen = new Set(); for (const b of r.bad.filter(b => b.cap < hint.cap - .05)) { const k = b.chain; if (seen.has(k)) continue; seen.add(k); console.log('    ', b.cap, b.px + 'px', JSON.stringify(b.t), b.chain.slice(0, 120)); } }
  if (errs.length) { console.log('errors', errs.slice(0, 3)); fails++; }
  await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? `FAIL: ${fails} problem(s)` : 'OK: every miniature text at least the hint\'s size');
  process.exit(fails ? 1 : 0);
})();
