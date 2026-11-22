// The mini-game review's browser pass (docs/mini-game-review.md, Phase 1): each game played against the computer on the
// page itself, from both seats, in headless Chromium at an iPhone's width (375x667), with screenshots and a performance
// trace under 4x CPU slowdown.
//
//   node scripts/audit/play.js [games,…|all] [--out dir] [--jobs 2] [--size 375x667] [--no-throttle]
//
// Per game, one page: a match of that game alone (the other eight squares already owned, with no line and no match point
// for either side, so that both sides must play in the centre square and nothing but its miniature is live on the board:
// O X O / X . O / X O X; the centre claimed ends the match).
//   seat X (this phone X, the computer O at Normal), under the CPU slowdown: up to 7 of this phone's turns or the
//     claim. This phone's moves are the computer's own choice for its side at Normal (core/ai.js localBest on the
//     public view), sent through the page's attemptMove after a real tap on the board's square (a round or an attempt
//     is started first where the game needs it). Screenshots: `<id>-fresh.png` the game as first opened, `<id>-view.png`
//     the game mid-way on this phone's turn, `<id>-board.png` the board with the miniature mid-way, `<id>-replay.png`
//     the computer's move being played back, `<id>-end.png` the end.
//   seat O (this phone O, the computer X moving first), no slowdown: up to 4 turns or the claim: errors and stalls only.
// The trace: every task over 50 ms (PerformanceObserver 'longtask') and every frame gap over 50 ms (requestAnimationFrame
// timestamps) from the match's start, each with what was on screen. Headless Chromium paints in software, so a heavy
// canvas reads slower here than on a phone's GPU: the long tasks (script on the main thread) are the firmer figure.
// Results: <out>/<id>.json and the screenshots beside it (default out: _shots/audit, never committed).
const path = require('path'), fs = require('fs'), http = require('http');
const ROOT = path.join(__dirname, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', path.join(ROOT, '_shots', 'audit'))), JOBS = Number(arg('--jobs', 2)), [W, H] = arg('--size', '375x667').split('x').map(Number), THROTTLE = !process.argv.includes('--no-throttle');
const WANT = process.argv[2] && !process.argv[2].startsWith('--') && process.argv[2] !== 'all' ? process.argv[2].split(',') : null;
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  let f = path.join(ROOT, p); if (p === '/matter.min.js') f = path.join(ROOT, 'node_modules', 'matter-js', 'build', 'matter.min.js');
  fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(b); } });
});

// ---- in the page ----
async function setup([type, me, seed]) {
  const E = await import('/src/core/engine.js'), G = await import('/src/games/index.js'), RP = await import('/src/ui/replay.js');
  for (let k = 0; k < 150 && !G.VIEWS.ready; k++) await new Promise(r => setTimeout(r, 100));
  for (let k = 0; k < 80 && !physicsReady(); k++) await new Promise(r => setTimeout(r, 100));
  if (type === 'trivia') for (let k = 0; k < 60 && !triviaReady(); k++) await new Promise(r => setTimeout(r, 100));
  const rng = E.makeRng(seed), cpu = me === 'X' ? 'O' : 'X';
  Object.assign(state, E.newMatch(rng, { games: [type] }), { screen: 'board', zoom: null, flash: null, done: null, spot: null, stamp: null, drawStamp: null, winner: null, stats: null });
  state.online = null; state.sc = null; state.practice = null;
  state.cpu = cpu; state.cpuLevel = 'normal'; state.setup.human = me; state.setup.vs = 'cpu';
  state.setup.names = me === 'X' ? { X: 'You', O: 'Computer' } : { X: 'Computer', O: 'You' }; state.names = state.setup.names;
  ['O', 'X', 'O', 'X', null, 'O', 'X', 'O', 'X'].forEach((o, i) => { if (o) state.squares[i].owner = o; });
  state.turn = 'X';
  const A = window.__audit = { E, RP, rng: E.makeRng(seed + ':me'), me, type, t0: performance.now(), long: [], frames: [], nFrames: 0, errs: [] };
  const ctx = () => `${state.screen}${state.zoom != null ? ':' + state.zoom : ''}${state.flash ? ' flash:' + (state.flash.kind || '') : ''}${RP.repActive() ? ' replay' : ''}${state.spot ? ' spot' : ''}${state.done ? ' done' : ''} turn:${state.turn}`;
  A.ctx = ctx;
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) A.long.push({ ms: Math.round(e.duration), at: Math.round(e.startTime - A.t0), on: ctx() }); }).observe({ entryTypes: ['longtask'] }); } catch (e) { A.errs.push('no longtask observer'); }
  let last = 0; const fr = t => { if (last && t - last > 50) A.frames.push({ ms: Math.round(t - last), at: Math.round(t - A.t0), on: ctx() }); last = t; A.nFrames++; requestAnimationFrame(fr); }; requestAnimationFrame(fr);
  commit();
  return true;
}
// What this phone can do now: 'move' (its turn, the board or its square on show, nothing playing), 'again' (held to the
// square), 'over', 'cpu-replay' (the computer's move on show), 'wait'.
function status() {
  const A = window.__audit, st = state;
  if (st.winner || st.screen === 'win' || st.squares[4].owner) return 'over';
  const busy = !!(st.flash || st.done || st.spot || A.RP.repActive());
  if (st.turn !== A.me) return st.screen === 'mini' && (st.flash || A.RP.repActive()) ? 'cpu-replay' : 'wait';
  if (busy) return 'wait';
  if (st.screen === 'mini' && st.zoom === 4) return 'in';
  return st.screen === 'board' ? 'move' : 'wait';
}
function act() {                                                   // this phone's move in the open square: the computer's own choice at Normal
  const A = window.__audit, E = A.E, st = state, sq = st.squares[4], p = A.me;
  const needsStart = E.ATT_TYPES.includes(A.type) || E.FINGER_TYPES.includes(A.type);
  try {
    if (needsStart && !(sq.mini.started && sq.mini.started[p])) { E.attStart(st, 4, p, Date.now()); render(); }
    let m = null;
    try { m = E.localBest(E.publicMini(sq.mini, p), p, A.rng, Object.assign({}, E.STYLE0), { value: 1, behind: 0, level: 'normal', until: null }).move; } catch (e) { A.errs.push('localBest: ' + e.message); }
    if (m && m.fing) m = E.fingAi(sq.mini, p, A.rng, m.level);   // (a finger game's attempt: the computer's hand, core/ai.js fingPlay)
    if (m == null || m === 'auto') m = E.randomLegalMove(sq.mini, p, A.rng);
    if (m == null) return { ok: false, reason: 'no move' };
    const r = attemptMove(m);
    return { ok: !!(r && r.ok), reason: r && r.reason, note: r && r.note };
  } catch (e) { return { ok: false, reason: 'threw: ' + e.message }; }
}
const result = () => { const A = window.__audit; return { winner: state.winner || null, owner: state.squares[4].owner || null, long: A.long, frames: A.frames, nFrames: A.nFrames, errs: A.errs, ms: Math.round(performance.now() - A.t0), on: A.ctx() }; };

// ---- one game ----
async function seat(b, url, type, me, opt) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('tiger-tac-toe.v4.onboard', JSON.stringify({ done: true, quiet: true, n: 9, speed: true })); } catch (e) { /* (none) */ } });
  await ctx.route('**/src/env.js', r => r.fulfill({ contentType: 'application/javascript', body: 'window.TTC_ENV={};' }));
  await ctx.route(/gstatic|firebase|cdnjs|googleapis|recaptcha/, r => r.abort());
  const p = await ctx.newPage(), out = { me, turns: 0, refused: [], pageErrors: [], shots: [], stuck: null };
  p.on('pageerror', e => out.pageErrors.push(String(e.message).slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) out.pageErrors.push('console: ' + m.text().slice(0, 160)); });
  const shot = async name => { const f = path.join(OUT, `${type}-${name}.png`); try { await p.screenshot({ path: f }); out.shots.push(path.basename(f)); } catch (e) { /* (the page went) */ } };
  try {
    await p.goto(url); await p.waitForSelector('[data-act="cpu-go"]', { timeout: 30000 });
    if (opt.throttle) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
    await p.evaluate(setup, [type, me, `audit:${type}:${me}`]);
    const t0 = Date.now(); let seenReplay = false, fresh = false, lastStatus = '', since = Date.now(), midBoard = false;
    while (Date.now() - t0 < opt.capMs && out.turns < opt.turns + 0.5) {
      const s = await p.evaluate(status);
      if (s !== lastStatus) { lastStatus = s; since = Date.now(); }
      if (s === 'over') break;
      if (Date.now() - since > 45000) { out.stuck = `45 s as "${s}": ` + (await p.evaluate(() => window.__audit.ctx())); break; }
      if (s === 'cpu-replay' && opt.shots && !seenReplay && Date.now() - since > 500) { seenReplay = true; await shot('replay'); }
      if (s === 'move') {
        if (opt.shots && out.turns >= 2 && !midBoard) { midBoard = true; await shot('board'); }
        const sq = await p.$$('.board .sq'); if (sq[4]) await sq[4].tap().catch(() => sq[4].click().catch(() => {}));
        await p.waitForFunction(() => state.screen === 'mini' && state.zoom === 4, null, { timeout: 8000 }).catch(() => {});
        await p.waitForTimeout(600);
        continue;
      }
      if (s === 'in') {
        if (opt.shots && !fresh) { fresh = true; await shot('fresh'); }
        if (opt.shots && out.turns === 2 && !out.shots.includes(`${type}-view.png`)) await shot('view');
        const r = await p.evaluate(act);
        if (!r.ok) { out.refused.push(r.reason || 'refused'); if (out.refused.length > 3) { out.stuck = 'moves refused: ' + out.refused.join(', '); break; } }
        else if ((await p.evaluate(() => !(state.lock != null && state.turn === window.__audit.me))) || true) out.turns += (await p.evaluate(() => (state.lock != null && state.turn === window.__audit.me && !state.winner ? 0.0001 : 1)));
        await p.waitForTimeout(250);
        continue;
      }
      await p.waitForTimeout(120);
    }
    if (opt.shots && !out.shots.includes(`${type}-view.png`)) { await shot('view'); }
    await p.waitForTimeout(opt.shots ? 2500 : 300);
    if (opt.shots) await shot('end');
    Object.assign(out, await p.evaluate(result)); out.turns = Math.round(out.turns);
  } catch (e) { out.stuck = 'harness: ' + String(e.message).slice(0, 200); }
  await ctx.close();
  return out;
}

srv.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const E = require(path.join(ROOT, 'src', 'core', 'engine.js'));
  const types = E.TYPES.filter(t => !WANT || WANT.includes(t)), queue = types.slice();
  let done = 0;
  const worker = async () => {
    for (;;) {
      const t = queue.shift(); if (!t) return;
      const X = await seat(b, url, t, 'X', { throttle: THROTTLE, shots: true, turns: 7, capMs: 150000 });
      const O = await seat(b, url, t, 'O', { throttle: false, shots: false, turns: 4, capMs: 70000 });
      const over = a => a.filter(x => x.ms > 50), worst = a => a.reduce((m, x) => Math.max(m, x.ms), 0);
      const res = { type: t, name: E.INFO[t].name, size: `${W}x${H}`, throttle: THROTTLE ? 4 : 1,
        X: { turns: X.turns, winner: X.winner, ms: X.ms, stuck: X.stuck, refused: X.refused, pageErrors: X.pageErrors, errs: X.errs, shots: X.shots },
        O: { turns: O.turns, winner: O.winner, ms: O.ms, stuck: O.stuck, refused: O.refused, pageErrors: O.pageErrors, errs: O.errs },
        perf: { longTasks: over(X.long || []).length, worstTask: worst(X.long || []), frames: X.nFrames, slowFrames: over(X.frames || []).length, worstFrame: worst(X.frames || []), tasks: (X.long || []).sort((a, c) => c.ms - a.ms).slice(0, 12), gaps: (X.frames || []).sort((a, c) => c.ms - a.ms).slice(0, 12) } };
      fs.writeFileSync(path.join(OUT, `${t}.json`), JSON.stringify(res, null, 1));
      done++;
      console.log(`${done}/${types.length} ${t}: X ${X.turns} turns${X.winner ? ' won ' + X.winner : ''}${X.stuck ? ' STUCK ' + X.stuck : ''}; O ${O.turns}${O.stuck ? ' STUCK ' + O.stuck : ''}; tasks>50 ${res.perf.longTasks} (worst ${res.perf.worstTask}), frames>50 ${res.perf.slowFrames} (worst ${res.perf.worstFrame})${X.pageErrors.length || O.pageErrors.length ? ' ERR ' + X.pageErrors.concat(O.pageErrors).slice(0, 2).join(' | ') : ''}`);
    }
  };
  await Promise.all(Array.from({ length: JOBS }, worker));
  await b.close(); srv.close();
});
