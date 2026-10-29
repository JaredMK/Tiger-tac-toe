// The mini-games' name and score bars at phone widths (npm run check:headers [-- widths [cpu|same] [games]]): every
// mini-game opened with long names (against the computer, or two people on one phone), fresh and after a few moves.
// Fails if a player's name overlaps anything (as it shows, clipping included), is cut without "…", or is left under
// 40px in a tally; if anything sticks out of its tally; or if the page or the game's area scrolls. Screenshots of the
// failures go to _shots/headers (SHOOT=1: every game). The page runs from this folder with src/env.js stubbed, as
// scripts/app-screenshots.js does; it needs Playwright and its Chromium.
const path = require('path'), fs = require('fs'), http = require('http');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, '_shots', 'headers'), WS = (process.argv[2] || '320,360,390,430').split(',').map(Number), MODE = process.argv[3] || 'same', ONLY = process.argv[4];
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html'; let f = path.join(ROOT, p); if (p === '/matter.min.js') f = path.join(ROOT, 'node_modules/matter-js/build/matter.min.js'); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
srv.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${srv.address().port}/`;
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('Playwright is not installed'); process.exit(1); }
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  let total = 0;
  for (const W of WS) {
    const ctx = await b.newContext({ viewport: { width: W, height: Math.round(W * 16 / 9) }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.route('**/src/env.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.TTC_ENV={};' }));
    await ctx.route(/gstatic|firebase|cdnjs|googleapis|recaptcha/, r => r.abort());
    const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto(url); await p.waitForSelector('[data-act="cpu-go"]', { timeout: 20000 });
    await p.click('[data-act="cpu-go"]'); await p.waitForSelector('[data-act="start"]'); await p.click('[data-act="start"]'); await p.waitForTimeout(300);
    if (await p.$('[data-act="intro-close"]')) await p.click('[data-act="intro-close"]');
    await p.evaluate(async () => { for (let k = 0; k < 60 && !physicsReady(); k++) await new Promise(r => setTimeout(r, 100)); for (let k = 0; k < 40 && !triviaReady(); k++) await new Promise(r => setTimeout(r, 100)); await document.fonts.ready; });
    const types = (await p.evaluate(() => TYPES)).filter(t => !ONLY || ONLY.split(',').includes(t));
    const bad = [];
    for (const t of types) for (const moves of [0, 3]) {
      const r = await p.evaluate(async ([t, moves, MODE]) => {
        if (MODE === 'cpu') { state.cpu = 'O'; state.setup.names = { X: 'Bartholomew_Longname', O: 'Computer' }; }
        else { state.cpu = null; state.setup.names = { X: 'Bartholomew_Longname', O: 'Maximiliana_Q_Wright' }; }
        state.names = state.setup.names;
        const sq = state.squares[1]; const rng = makeRng('hdr-' + t);
        try { sq.mini = newMini(t, rng); } catch (e) { return { err: e.message }; }
        sq.owner = null;
        if (t === 'trivia') triviaDeal(state, sq, makeRng('tq'));
        state.turn = 'X'; state.lock = null; state.winner = null;
        for (let k = 0; k < moves; k++) {
          let mv; try { mv = randomLegalMove(sq.mini, state.turn, rng); } catch (e) { break; }
          if (mv == null) break;
          state.screen = 'mini'; state.zoom = 1;
          try { playMove(state, 1, mv, rng); } catch (e) { break; }
          state.flash = null; state.spot = null; state.done = null; state.stamp = null; state.lock = null;
          if (sq.owner || state.winner) { sq.owner = null; state.winner = null; break; }
        }
        state.screen = 'mini'; state.zoom = 1; state.flash = null; state.done = null; state.draft = ''; state.sel = []; render();
        await new Promise(r => setTimeout(r, 80));
        const R0 = e => e.getBoundingClientRect(), out = [];
        const R = e => { const r = R0(e); let x = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; for (let q = e.parentElement; q && q !== document.body; q = q.parentElement) { const cs = getComputedStyle(q); if (cs.overflow !== 'visible' || cs.overflowX !== 'visible') { const c = R0(q); x.left = Math.max(x.left, c.left); x.top = Math.max(x.top, c.top); x.right = Math.min(x.right, c.right); x.bottom = Math.min(x.bottom, c.bottom); } } x.width = Math.max(0, x.right - x.left); x.height = Math.max(0, x.bottom - x.top); return x; };   // what shows of it: clipped by every ancestor that clips
        const over = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        const scr = document.querySelector('#app'), hdrBottom = (() => { const g = scr.querySelector('.ctals, .rprogs, .g-arc > :first-child'); return g ? R(g).bottom : 0; })();
        const names = [...scr.querySelectorAll('b.X, b.O')].filter(n => !n.closest('.hdr, .hdrrow, .tbar') && R(n).width > 0);
        const leaves = [...scr.querySelectorAll('*')].filter(e => !e.closest('.wheel') && !e.closest('.hdr, .hdrrow, .tbar') && R(e).width > 0 && R(e).height > 0 && (!e.children.length || ['I', 'SVG', 'SMALL', 'SPAN', 'B'].includes(e.tagName.toUpperCase())));
        for (const n of names) {
          const nr = R(n);
          for (const e of leaves) {
            if (e === n || n.contains(e) || e.contains(n)) continue;
            const blk = x => { let q = x.parentElement; while (q && getComputedStyle(q).display.startsWith('inline')) q = q.parentElement; return q; };
            const inl = x => getComputedStyle(x).display.startsWith('inline');
            if (inl(n) && inl(e) && blk(n) === blk(e) && getComputedStyle(blk(n)).display === 'block') continue;   // (two pieces of one wrapped line of text)
            const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity === 0) continue;
            if (over(nr, R(e))) { const er = R(e); out.push(`name "${n.textContent.slice(0, 12)}" [${[nr.left, nr.top, nr.right, nr.bottom].map(Math.round)}] x <${e.tagName.toLowerCase()}.${(e.getAttribute("class") || "").replace(/ /g, ".")}> [${[er.left, er.top, er.right, er.bottom].map(Math.round)}]`); }
          }
          if (n.closest('.ctal, .rprog, .busrow, .hleft, .pscore') && R0(n).width < 40) out.push(`name "${n.textContent.slice(0, 12)}" only ${Math.round(R0(n).width)}px wide`);
          if (n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).textOverflow !== 'ellipsis') out.push(`name "${n.textContent.slice(0, 12)}" cut without …`);
          const box = n.parentElement, br = R(box);
          for (const k of box.querySelectorAll('*')) { const kr = R(k); if (kr.width && (kr.right > br.right + 1 || kr.left < br.left - 1)) out.push(`<${k.tagName.toLowerCase()}.${(k.getAttribute('class') || '')}> outside its tally`); }
        }
        if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page scrolls sideways'); if (document.scrollingElement.scrollHeight > innerHeight + 1) out.push('page scrolls'); { const g = scr.querySelector('.minigame, .mini-body, .g-arc, [class^="g-"]'); if (g && g.scrollHeight > g.clientHeight + 1 && getComputedStyle(g).overflowY !== 'visible') out.push('game area scrolls'); }
        return { out: [...new Set(out)] };
      }, [t, moves, MODE]);
      if (process.env.SHOOT && !moves) await p.screenshot({ path: path.join(OUT, `s-${MODE}-${W}-${t}.png`) });
      if (r.err) console.log(W, t, "ERR", r.err);
      else if (r.out.length) { bad.push(`${t}${moves ? '+' + moves : ''}`); console.log(W, t, moves, r.out.slice(0, 6).join(' | ')); await p.screenshot({ path: path.join(OUT, `h2-${MODE}-${W}-${t}-${moves}.png`) }); }
    }
    console.log('W', W, MODE, 'problems in', bad.length, bad.join(','));
    total += bad.length;
    await ctx.close();
  }
  await b.close(); srv.close();
  process.exit(total ? 1 : 0);
});
