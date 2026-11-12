// Districts and Roads (the November 2026 polish, round 2). Districts: the map on its sheet, a tap on an open spot the
// move as ever, the piece dropping onto its spot, each region's plate (X's pieces against O's) turning over as the
// piece lands, a region's padlock stamped at the moment it locks (with the piece, or as the grey piece shuts it), the
// last piece ringed, the winner's regions lighting up. Roads: a tap on an open edge the move as ever, the road laid
// from the end that joins the mover's roads, each longest road as a figure on a chip by the name (the leader's in
// their colour) turning over as the road lands, a barrier dropped across the blocked edge, the last road marked, a
// light run along the winner's road. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const dist = await import('../../src/games/districts/view.js');
const roads = await import('../../src/games/roads/view.js');
const DR = await import('../../src/games/districts/rules.js');
const RR = await import('../../src/games/roads/rules.js');
const H = await import('../../src/ui/haptics.js');
const { SFX } = await import('../../src/audio/sound.js');

// the view's screen as ui/mini.js calls it: a = the move's flash (its animation playing), or none
const draw = (view, mini, o = {}) => view.screen({ owner: null, mini }, o.a || null, null, mini, !!o.view, !!o.locked, o.a || null, null, () => false, () => -1, !!o.fresh, o.turn || 'X', '');
const sounds = (view, f, mini, won) => { const out = []; view.sounds(f, (n, ms, rate) => out.push([n, ms, rate]), !!won, mini, null); return out; };
const count = (html, re) => (html.match(re) || []).length;
const flashOf = (R, type, mini, by, m, r) => { const f = { type, by, kind: r.outcome === 'win' ? 'claim' : r.outcome === 'draw' ? 'draw' : 'move', note: r.note, winner: r.winner }; R.moveFlash(m, by, null, null, mini, f); return f; };
// Districts games played by its own search, every move kept with the board after it: [{ mini, f, r }]
function distGames(n) {
  const out = [];
  for (let g = 0; g < n; g++) {
    const rng = E.makeRng('maps-d' + g), mini = E.newMini('districts', rng); let p = 'X';
    for (let k = 0; k < 20; k++) {
      const b = DR.distSearch(mini, p, rng); if (!b) break;
      const r = E.applyMove(mini, p, b.k, rng);
      out.push({ mini: JSON.parse(JSON.stringify(mini)), f: flashOf(DR, 'districts', mini, p, b.k, r), r });
      if (r.outcome !== 'continue') break;
      p = p === 'X' ? 'O' : 'X';
    }
  }
  return out;
}
function roadGames(n) {
  const out = [];
  for (let g = 0; g < n; g++) {
    const rng = E.makeRng('maps-r' + g), mini = E.newMini('roads', rng); let p = 'X';
    for (let k = 0; k < 40; k++) {
      const b = RR.roadPick(mini, p, rng); if (!b) break;
      const r = E.applyMove(mini, p, b.k, rng);
      out.push({ mini: JSON.parse(JSON.stringify(mini)), f: flashOf(RR, 'roads', mini, p, b.k, r), r });
      if (r.outcome !== 'continue') break;
      p = p === 'X' ? 'O' : 'X';
    }
  }
  return out;
}

test('districts: the control is a tap on an open spot, one a spot, the move its number; none while it is not this phone\'s move', () => {
  const mini = E.newMini('districts', E.makeRng('maps'));
  const html = draw(dist, mini);
  assert.equal(count(html, /data-act="move"/g), mini.who.length, 'every empty spot');
  mini.who.forEach((_, k) => assert.ok(html.includes(`data-act="move" data-m='${k}' role="button"`), `spot ${k}`));
  assert.equal(count(html, /class="dhit" r="5\.5"/g), mini.who.length, 'the tap target as it was (the map itself is drawn larger)');
  assert.match(html, /class="dmap go tX"/, 'open to the mover: the hollows breathe in their colour');
  E.applyMove(mini, 'X', 3, E.makeRng('m'));
  const after = draw(dist, mini, { turn: 'O' });
  assert.equal(count(after, /data-act="move"/g), mini.who.filter(w => !w).length, 'a taken spot takes no tap');
  const locked = draw(dist, mini, { locked: true, turn: 'O' });
  assert.equal(count(locked, /data-act="move"/g), 0); assert.match(locked, /class="dmap" /, 'no call to place');
  assert.doesNotMatch(html, /transform="translate\([^"]*"[^>]*data-act|data-act[^>]*transform=/, 'the tapped element carries no transform of its own (a replayed press, g.rpress, would send it to the corner)');
  assert.doesNotMatch(html, />[^<]*(tap|place|lock more)[^<]*</i, 'no help text on the map');
});

test('districts: every region has a plate with both counts, clear of every spot and inside its region', () => {
  for (let g = 0; g < 40; g++) {
    const mini = E.newMini('districts', E.makeRng('plate' + g)), L = dist.distLabels(mini.map);
    assert.equal(L.length, mini.map.regions.length);
    L.forEach((at, r) => {
      assert.ok(at, `map ${g}: region ${r} has room for its plate`);
      const hw = 5 * at.k, hh = 4.3 * at.k;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) assert.equal(DR.distTo([at.x + dx * hw, at.y + dy * hh], mini.map.regions[r]), 0, 'inside its region');
      for (const s of mini.map.spots) assert.ok(Math.hypot(Math.max(Math.abs(s.x - at.x) - hw, 0), Math.max(Math.abs(s.y - at.y) - hh, 0)) >= 5.5, 'clear of every spot\'s tap target');
    });
    assert.equal(count(draw(dist, mini), /class="dplate/g), mini.map.regions.length);
  }
});

test('districts: the piece drops in once, with its move; the counts turn over as it lands; the last piece and its grey are ringed', () => {
  const mini = E.newMini('districts', E.makeRng('maps')), r = E.applyMove(mini, 'X', 5, E.makeRng('m'));
  const f = flashOf(DR, 'districts', mini, 'X', 5, r);
  const live = draw(dist, mini, { a: f, locked: true, turn: 'O' });
  assert.equal(count(live, /class="dspot X[^"]* pop"/g), 1, 'the piece'); assert.equal(count(live, /class="dspot G[^"]* drop"/g), 1, 'its grey');
  assert.equal(count(live, /class="dring"/g), 2, 'a ripple each as it lands'); assert.match(live, new RegExp(`class="dring" style="--t:${dist.DIST_T.land}ms"`)); assert.match(live, new RegExp(`class="dring" style="--t:${dist.DIST_T.grey}ms"`));
  const touched = mini.map.spots[5].r.length;
  assert.equal(count(live, /class="dpi bump"/g), touched, 'the plate of every region it touches');
  assert.equal(count(live, new RegExp(`class="dch X tf" style="--f:${dist.DIST_T.tally}ms"`, 'g')), touched, 'its count there turning over at the tally');
  assert.match(live, /You lead \d of 5|leads \d of 5/);
  const idle = draw(dist, mini, { turn: 'O' });
  assert.doesNotMatch(idle, / pop"| drop"|dring|bump|shift|stamp| tf"| tu"|dwin/, 'nothing plays without a move');
  assert.equal(count(idle, /class="dlast"/g), 2, 'the last piece and its grey, ringed');
  assert.ok(dist.DIST_T.grey + dist.DIST_T.lock <= DR.flashMs(f, 0, false), 'inside the move\'s time');
});

test('districts: a region\'s padlock is stamped at the moment it locks, with the snap; a region already locked is not stamped again', () => {
  const games = distGames(12), locks = games.filter(x => { const M = dist.distMoments(x.mini.map, x.mini.who, x.f.dist); return M.times.length; });
  assert.ok(locks.length >= 8, 'moves that lock a region');
  let byPiece = 0, byGrey = 0;
  for (const x of locks) {
    const M = dist.distMoments(x.mini.map, x.mini.who, x.f.dist), live = draw(dist, x.mini, { a: x.f, locked: true, fresh: x.r.outcome === 'win' });
    const fresh = M.lockAt.filter(t => t != null);
    assert.equal(count(live, /class="dpad [XO] stamp"/g), fresh.length, 'a stamp for each region locked by this move');
    assert.equal(count(live, /class="dpad [XO]/g), M.now.lock.filter(Boolean).length, 'every locked region carries its padlock');
    assert.equal(count(live, /class="dseal in"/g), fresh.length);
    for (const t of fresh) { assert.ok(t === dist.DIST_T.tally || t === dist.DIST_T.grey); if (t === dist.DIST_T.tally) byPiece++; else byGrey++; assert.match(live, new RegExp(`class="dpad [XO] stamp" style="--t:${t}ms"`)); }
    const s = sounds(dist, x.f, x.mini, x.r.outcome === 'win');
    assert.deepEqual(s.filter(e => e[0] === 'distLock').map(e => e[1]), M.times, 'a snap at each moment a region locks');
    assert.ok(M.times[M.times.length - 1] + dist.DIST_T.lock <= DR.flashMs(x.f, 0, x.r.outcome === 'win'), 'inside the move\'s time');
    const idle = draw(dist, x.mini, {});
    assert.doesNotMatch(idle, /stamp|dseal in/); assert.equal(count(idle, /class="dpad [XO]"/g), M.now.lock.filter(Boolean).length);
  }
  assert.ok(byPiece > 0 && byGrey > 0, 'locked by the piece, and by the grey piece shutting the region');
  assert.ok(SFX.distLock, 'the padlock\'s snap is a sound'); assert.ok(H.RESULT_SOUNDS.has('distLock'), 'and the move\'s buzz');
});

test('districts: a square won lights the winner\'s regions one after the other, inside the move\'s time; the line says it without "You leads"', () => {
  const wins = distGames(12).filter(x => x.r.outcome === 'win');
  assert.ok(wins.length >= 6);
  for (const x of wins) {
    const live = draw(dist, x.mini, { a: x.f, locked: true, fresh: true }), t = DR.distTally(x.mini.map, x.mini.who);
    const n = x.r.note === 'locked' ? t.lock.filter(l => l === x.r.winner).length : t.lead.filter(l => l === x.r.winner).length;
    const at = [...live.matchAll(/class="dwin" style="--t:(\d+)ms"/g)].map(m => Number(m[1]));
    assert.equal(at.length, n, 'each of the winner\'s regions');
    assert.ok(at.every((v, i) => !i || v === at[i - 1] + dist.DIST_T.win), 'one after the other');
    assert.ok(at[at.length - 1] + 500 <= DR.flashMs(x.f, 0, true), 'inside the move\'s time');
    assert.doesNotMatch(live, /X claimed|O claimed|class="stamp/, 'no claim in the square');
    assert.doesNotMatch(draw(dist, x.mini, { a: x.f, locked: true }), /dwin/, 'only as the square is won');
  }
  for (const x of distGames(3)) assert.doesNotMatch(draw(dist, x.mini, { a: x.f, locked: true }), /You leads|You locks/);
});

test('districts: the miniature is the map with each player\'s locked regions as pips', () => {
  const x = distGames(2).filter(g => g.r.outcome === 'win')[0], t = DR.distTally(x.mini.map, x.mini.who);
  const html = dist.miniature(x.mini, false);
  assert.match(html, /<svg class="tdist"/); assert.equal(count(html, /class="dreg/g), x.mini.map.regions.length);
  for (const p of ['X', 'O']) { const row = html.match(new RegExp(`<div class="tr ${p}"[^>]*>(.*?)</div>`))[1]; assert.equal(count(row, /<i class="[^"]* on"/g), t.locks[p], `${p}'s locks`); assert.equal(count(row, /<i /g), t.need); }
  assert.doesNotMatch(html, /class="(back|btn|big|sq|chip)[ "]/);
});

test('roads: the control is a tap on an open edge, one an edge, the move its number; none while it is not this phone\'s move', () => {
  for (const n of [30, 19, 24]) {
    const mini = E.newMini('roads', E.makeRng('maps')); mini.segs = new Array(n).fill(null);
    const html = draw(roads, mini);
    assert.equal(count(html, /class="rhit"/g), n, `${n} edges`);
    for (let k = 0; k < n; k++) assert.ok(html.includes(`data-act="move" data-m='${k}' role="button"`), `edge ${k}`);
    E.applyMove(mini, 'X', 4, E.makeRng('m'));
    assert.equal(count(draw(roads, mini, { turn: 'O' }), /class="rhit"/g), mini.segs.filter(w => !w).length, 'a road or a blocked edge takes no tap');
    assert.equal(count(draw(roads, mini, { locked: true }), /class="rhit"/g), 0);
    assert.doesNotMatch(html, />[^<]*(tap|claim|longest)[^<]*</i, 'no help text on the map');
  }
});

test('roads: the road is laid once, with its move, from the end that joins the mover\'s roads; the barrier drops after it; the last road is marked', () => {
  const mini = E.newMini('roads', E.makeRng('maps')), G = RR.roadGeom(mini.segs);
  // X holds one edge; the edge played next joins it at its own second corner (so it is laid from there)
  let k = -1, j0 = -1;
  for (let j = 0; j < G.segs.length && k < 0; j++) { const c = G.segs.findIndex((e, i) => i !== j && G.segs[j].includes(e[1]) && !G.segs[j].includes(e[0])); if (c >= 0) { k = c; j0 = j; } }
  assert.ok(k >= 0, 'an edge whose second corner joins another');
  mini.segs[j0] = 'X';
  const r = E.applyMove(mini, 'X', k, E.makeRng('m')), f = flashOf(RR, 'roads', mini, 'X', k, r);
  const live = draw(roads, mini, { a: f, locked: true, turn: 'O' });
  assert.equal(count(live, /class="rseg X draw"/g), 1); assert.equal(count(live, /class="rcase draw"/g), 1);
  const [p, q] = G.segs[k].map(v => G.pts[v]);
  assert.ok(live.includes(`class="rseg X draw" x1="${q[0]}" y1="${q[1]}" x2="${p[0]}" y2="${p[1]}"`), 'drawn from the corner it joins on');
  assert.equal(count(live, /class="rblk drop last"/g), 1, 'its barrier'); assert.equal(count(live, /class="rdot pop"/g), 2, 'the road\'s two corners');
  assert.match(live, new RegExp(`class="rlen lead tu" style="--u:${roads.ROAD_T.land}ms">1</b><b class="rlen lead tf" style="--f:${roads.ROAD_T.land}ms">2</b>`), 'the road\'s length turns over as it lands, on the leader\'s colour');
  assert.match(live, /X's road: 2/);
  assert.equal(count(live, /class="rglow X in"/g), 1, 'the glow reaches the new edge alone'); assert.equal(count(live, /class="rglow X"/g), 1, 'the edge already glowing stays as it was');
  assert.deepEqual(sounds(roads, f, mini), [['pieceSlide', 0, undefined], ['knock', roads.ROAD_T.block, undefined], ['point', roads.ROAD_T.land + 70, undefined], ['domClick', roads.ROAD_T.land, undefined]], 'the slide, the barrier, the longer road, and last the road\'s click: the move\'s buzz');
  assert.ok(roads.ROAD_T.block + 150 <= RR.flashMs(f, 0, false), 'inside the move\'s time');
  const idle = draw(roads, mini, { turn: 'O' });
  assert.doesNotMatch(idle, /draw"| in"|drop| pop"| tf"| tu"|rshine/, 'nothing plays without a move');
  assert.equal(count(idle, /class="rnew"/g), 1, 'the last road\'s centre line'); assert.equal(count(idle, /class="rblk last"/g), 1, 'the last barrier');
  assert.equal(count(idle, /class="rlen lead"/g), 1); assert.match(idle, /class="ctal X"[^]*?class="rlen lead">2<\/b>[^]*class="rlen">0<\/b>/, 'the longer road\'s figure on its player\'s colour');
});

test('roads: a square won runs a light along the winner\'s road with a rising note an edge, inside the move\'s time', () => {
  const wins = roadGames(10).filter(x => x.r.outcome === 'win');
  assert.ok(wins.length >= 4);
  for (const x of wins) {
    const live = draw(roads, x.mini, { a: x.f, locked: true, fresh: true }), n = RR.roadLongest(x.mini.segs, x.r.winner).len;
    const at = [...live.matchAll(/class="rshine"[^>]*style="--t:(\d+)ms"/g)].map(m => Number(m[1]));
    assert.equal(at.length, n, 'every edge of the winner\'s longest road');
    assert.ok(at.every((v, i) => !i || v > at[i - 1]), 'one after the other');
    assert.ok(at[at.length - 1] + 360 <= RR.flashMs(x.f, 0, true), 'inside the move\'s time');
    const notes = sounds(roads, x.f, x.mini, true).filter(e => e[0] === 'pathNote');
    assert.deepEqual(notes.map(e => e[1]), at, 'a note as the light reaches each edge'); assert.ok(notes.every((e, i) => !i || e[2] >= notes[i - 1][2]), 'rising');
    assert.match(live, /the longest road/); assert.doesNotMatch(live, /X claimed|O claimed|class="stamp/, 'no claim in the square');
    assert.doesNotMatch(draw(roads, x.mini, { a: x.f, locked: true }), /rshine/, 'only as the square is won');
  }
});

test('roads: the miniature is the honeycomb with both roads, each player\'s longest as a figure beside it', () => {
  const x = roadGames(1).pop(), html = roads.miniature(x.mini, false);
  assert.match(html, /<svg class="troad comb"/);
  for (const p of ['X', 'O']) { const len = RR.roadLongest(x.mini.segs, p).len; assert.match(html, new RegExp(`<div class="tr ${p}"><b class="${p}">${p}</b><span class="trdn">${len}</span></div>`)); assert.equal(count(html, new RegExp(`class="${p} top"`, 'g')), len, `${p}'s longest road the widest`); }
  assert.doesNotMatch(html, /class="(back|btn|big|sq|chip)[ "]/);
});
