// The main board's miniatures fit their spaces (npm run check:minifit, or node scripts/check-miniature-fit.js 375x667,430x932 [games] [shots]): every game
// dealt into the nine spaces (each game in three of them: one in every row and every column) and played some way in (a
// few moves, then more: mid-game), and in each space every visible
// part of the miniature (as painted: clipped by what clips it) is measured against
//   - the space: inside the square's own box, kept clear of the # lines' band on its inner sides (the board's --lb),
//   - the game's title (.lab .lnm): never under it.
// Fails on any part out of its room or over the title, and on a page that scrolls. Screenshots in _shots/minifit/ with
// "shots" (and of every failure). Runs the page from this folder with src/env.js stubbed, as the other checks do.
const path = require('path'), fs = require('fs'), http = require('http');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, '_shots', 'minifit');
const SIZES = (process.argv[2] || '360x640,375x667,430x932').split(',').map(v => v.split('x').map(Number));
const ONLY = process.argv[3] && process.argv[3] !== 'shots' ? process.argv[3].split(',') : null, SHOTS = process.argv.includes('shots');
const MOVES = [3, 9];                                              // mid-game: a few moves in, then more
const ROTS = [0, 1, 2];                                            // each game in three spaces, one in every row and every column (the room differs by place: a column's width, a row's height, the board's edge)
// The game in space s on turn k: the space's row and column each moved back k (a diagonal of the board, so every game
// meets every row and every column), and a batch of fewer than nine games repeated to fill the board.
const gameAt = (batch, s, k) => batch[(3 * ((Math.floor(s / 3) - k + 3) % 3) + ((s % 3) - k + 3) % 3) % batch.length];
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html'; let f = path.join(ROOT, p); if (p === '/matter.min.js') f = path.join(ROOT, 'node_modules', 'matter-js', 'build', 'matter.min.js'); fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); } }); });
(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const { chromium } = require('playwright'); const b = await chromium.launch(); let fails = 0;
  for (const [W, H] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { try { localStorage.setItem('tiger-tac-toe.v4.onboard', JSON.stringify({ done: true, quiet: true, n: 9, speed: true })); } catch (e) { /* (none) */ } });
    await ctx.route('**/src/env.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.TTC_ENV={};' }));
    await ctx.route(/gstatic|firebase|cdnjs|googleapis|recaptcha/, r => r.abort());
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.waitForSelector('[data-act="cpu-go"]', { timeout: 20000 });
    await p.click('[data-act="cpu-go"]'); await p.waitForSelector('[data-act="start"]'); await p.click('[data-act="start"]'); await p.waitForTimeout(300);
    if (await p.$('[data-act="intro-close"]')) await p.click('[data-act="intro-close"]');
    await p.evaluate(async () => { await document.fonts.ready; const G = await import('/src/games/index.js'); for (let k = 0; k < 150 && !G.VIEWS.ready; k++) await new Promise(r => setTimeout(r, 100)); for (let k = 0; k < 60 && !physicsReady(); k++) await new Promise(r => setTimeout(r, 100)); });
    const types = await p.evaluate(async () => { const G = await import('/src/games/index.js'); return G.TYPES.filter(t => !(G.OLD_TYPES || []).includes(t) && !(G.SC_ONLY || []).includes(t)); }).then(t => (ONLY ? t.filter(x => ONLY.includes(x)) : t));
    const bad = new Map();
    for (const rot of ROTS) for (const moves of MOVES) for (let k = 0; k < types.length; k += 9) {
      const batch = types.slice(k, k + 9);
      await p.evaluate(async ([batch, moves, rot, gameSrc]) => {
        const E = await import('/src/core/engine.js'), gameAt = (0, eval)(gameSrc);
        state.spot = null; state.flash = null; state.lock = null; state.turn = state.cpu === 'X' ? 'O' : 'X';   /* (the player's turn: the computer's would start its move, its square's caption under the measuring) */ state.winner = null; state.screen = 'board'; state.zoom = null;
        state.squares.forEach((sq, i0) => {
          const t = gameAt(batch, i0, rot), r = E.makeRng(`fit-${t}-${moves}-${i0}`); sq.owner = null; sq.mini = E.newMini(t, r);
          if (t === 'trivia') { try { triviaDeal(state, sq, r); } catch (e) { /* (no bank) */ } }
          for (let n = 0; n < moves; n++) {
            const pl = n % 2 ? 'O' : 'X'; let m = null;
            try { m = E.localBest(E.publicMini(sq.mini, pl), pl, r, Object.assign({}, E.STYLE0), { value: 1, behind: 0, level: 'normal', until: null }).move; } catch (e) { m = null; }
            if (m && m.fing) { try { m = E.fingAi(sq.mini, pl, r, m.level); } catch (e) { m = null; } }
            if (m == null || m === 'auto') { try { m = E.randomLegalMove(sq.mini, pl, r); } catch (e) { m = null; } }
            if (m == null) break;
            const copy = JSON.parse(JSON.stringify(sq.mini));
            let res; try { res = E.applyMove(sq.mini, pl, m, r); } catch (e) { res = null; }
            if (!res || !res.ok) { sq.mini = copy; break; }
            if (res.outcome && res.outcome !== 'continue') { sq.mini = copy; break; }   // (kept one move short of the end: a space in play)
          }
        });
        render();
      }, [batch, moves, rot, gameAt.toString()]);
      await p.waitForTimeout(260);
      const res = await p.evaluate(() => {
        const R0 = e => e.getBoundingClientRect();
        const painted = (e, stop) => { const r = R0(e); let x = { l: r.left, t: r.top, r: r.right, b: r.bottom }; for (let q = e.parentElement; q && q !== stop.parentElement; q = q.parentElement) { const cs = getComputedStyle(q); const clips = q instanceof SVGSVGElement ? cs.overflow !== 'visible' : (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.clipPath !== 'none'); if (clips) { const c = R0(q); x = { l: Math.max(x.l, c.left), t: Math.max(x.t, c.top), r: Math.min(x.r, c.right), b: Math.min(x.b, c.bottom) }; } } return x; };
        const board = document.querySelector('.board'), lb = parseFloat(getComputedStyle(board).getPropertyValue('--lb')) || 0, out = [];
        document.querySelectorAll('.board .sq').forEach((sq, i) => {
          const th = sq.querySelector('.thumb'); if (!th) return;
          const s = R0(sq), col = i % 3, row = Math.floor(i / 3);
          const room = { l: s.left + (col > 0 ? lb : 0), r: s.right - (col < 2 ? lb : 0), t: s.top + (row > 0 ? lb : 0), b: s.bottom - (row < 2 ? lb : 0) };
          const nm = sq.querySelector('.lab .lnm'), tr = nm ? R0(nm) : null;
          const probs = [];
          const SHAPES = new Set(['path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline', 'line', 'text', 'use', 'image']);
          for (const e of th.querySelectorAll('*')) {
            const tag = e.tagName.toLowerCase(), cs = getComputedStyle(e);
            // what paints: an SVG shape; an HTML element with no element inside it (text, a dot, a bar), or one with a fill, border or shadow of its own
            const visual = e instanceof SVGElement ? SHAPES.has(tag) : !e.children.length || cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || cs.boxShadow !== 'none';
            if (!visual) continue;
            if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
            if (e instanceof SVGElement && (cs.fill === 'none' || cs.fill === 'transparent') && (cs.stroke === 'none' || cs.stroke === 'transparent') && tag !== 'use' && tag !== 'image' && tag !== 'text') continue;   // (an invisible hit shape)
            if (e.tagName === 'defs' || e.closest('defs, clipPath, mask, pattern, symbol')) continue;
            const x = painted(e, th); if (x.r - x.l < 0.5 || x.b - x.t < 0.5) continue;
            const over = Math.max(room.l - x.l, x.r - room.r, room.t - x.t, x.b - room.b);
            const cls = (e.getAttribute('class') || e.tagName).toString().slice(0, 40);
            if (over > 1) probs.push(`out of its room by ${over.toFixed(1)}px: <${e.tagName.toLowerCase()}.${cls}>`);
            if (tr && Math.min(x.r, tr.right) - Math.max(x.l, tr.left) > 1 && Math.min(x.b, tr.bottom) - Math.max(x.t, tr.top) > 1) probs.push(`over the title: <${e.tagName.toLowerCase()}.${cls}>`);
          }
          out.push({ i, type: sq.mini ? '' : '', probs: [...new Set(probs)].slice(0, 4) });
        });
        return out;
      });
      let any = false;
      res.forEach(r => { const t = gameAt(batch, r.i, rot); if (r.probs.length) { any = true; if (!bad.has(t)) bad.set(t, []); bad.get(t).push(`space ${r.i}, ${moves} moves: ${r.probs.join(' | ')}`); } });
      if (SHOTS || any) await p.screenshot({ path: path.join(OUT, `board-${W}-r${rot}-${moves}-${k / 9}.png`) });
    }
    const scroll = await p.evaluate(() => document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollWidth > innerWidth + 1);
    console.log(`viewport ${W}x${H}: ${types.length} games, ${bad.size} with a miniature out of its space or over its title${scroll ? ', the page scrolls' : ''}`);
    for (const [t, l] of bad) console.log(`  ${t}: ${[...new Set(l)].slice(0, 3).join(' || ')}`);
    fails += bad.size + (scroll ? 1 : 0);
    if (errs.length) { console.log('errors', errs.slice(0, 3)); fails++; }
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(fails ? `FAIL: ${fails} problem(s)` : 'OK: every miniature inside its space and clear of its title');
  process.exit(fails ? 1 : 0);
})();
