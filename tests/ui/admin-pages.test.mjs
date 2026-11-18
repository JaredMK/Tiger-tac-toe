// The admin dashboard's pages (src/admin/pages.js) and its one table (src/admin/table.js), December 2026: a number shows the
// same value on every page it appears on, under every filter, with and without my devices; a number's link opens exactly
// the rows it counts; the headline numbers equal a count made straight from the raw rows; every table sorts, filters,
// searches and exports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as P from '../../src/admin/pages.js';

const W = createRequire(import.meta.url)('../admin-world.js');
const { X, T } = P;
const NAMES = { ttt: 'Tic-tac-toe', c4: 'Four in a Row', pig: 'Risky Rolls' };
const world = W.world(), M = X.build(world, W.NOW);
function ctxOf(filters) {
  const states = new Map();
  return { S: X.scope(M, filters), names: NAMES, released: () => true, versions: { ttt: 2 }, ts: (id, def) => { if (!states.has(id)) states.set(id, T.newState(def)); return states.get(id); }, drills: new Map(), logs: {}, devEdit: null, PS: null, accounts: null, alertLog: [], alertStats: {} };
}
const PAGES = { overview: P.overview, players: P.players, matches: P.matches, growth: P.growth, health: P.health };
// Every number card on a page: its metric and what it shows.
const cards = html => [...html.matchAll(/data-metric="(\w+)"[\s\S]*?<a class="big"[^>]*>([^<]*)<\/a>(?:<span>([^<]*)<\/span>)?/g)].map(m => ({ id: m[1], shown: m[2], sub: m[3] || '' }));
const FILTERS = [{}, { mine: true }, { platform: 'ios' }, { platform: 'web', mine: true }, { mode: 'cpu' }, { mode: 'friend', mine: true }, { mode: 'find' }, { range: '7' }, { range: 'today', mine: true }, { range: '90' }];

test('a number shows the same value on every page it is on, under every filter, with and without my devices', () => {
  let seen = 0;
  for (const f of FILTERS) {
    const ctx = ctxOf(f), by = new Map();
    for (const [name, page] of Object.entries(PAGES)) for (const c of cards(page(ctx))) {
      seen++;
      if (by.has(c.id)) assert.deepEqual([c.shown, c.sub], by.get(c.id).v, `${c.id} on ${name} and on ${by.get(c.id).name} (${JSON.stringify(f)})`);
      else by.set(c.id, { v: [c.shown, c.sub], name });
    }
    for (const id of ['active', 'newPlayers', 'started', 'finished', 'completion', 'd1', 'd7', 'errorRate', 'reports']) assert.ok(by.has(id), `the Overview's ${id}`);
    for (const c of cards(P.overview(ctx))) assert.ok(Object.entries(PAGES).some(([n, page]) => n !== 'overview' && cards(page(ctx)).some(x => x.id === c.id)), `${c.id} is on a detail page too: nothing lives only on the Overview`);
  }
  assert.ok(seen > 200);
});

test('a number\'s link opens exactly the rows it counts; each has a one-line definition', () => {
  for (const f of [{}, { mine: true }, { mode: 'cpu' }]) {
    const ctx = ctxOf(f);
    for (const id of X.METRIC_IDS) {
      const m = X.metric(ctx.S, id), html = P.drill(ctx, id);
      assert.match(html, new RegExp(`The ${m.rows.length} rows? this number counts`), id);
      if (m.of == null && !['turns', 'minutes', 'sessionLen', 'findWait', 'firstPlayer'].includes(id)) assert.equal(m.v, m.rows.length, `${id}: a count is the count of its rows`);
      if (m.of != null) { assert.equal(m.n, m.rows.length, `${id}: a share's rows are its numerator`); assert.ok(m.n <= m.of); }
      assert.ok(X.tip(id) && X.tip(id).length > 20 && !X.tip(id).includes('\n'), `${id} has a one-line definition`);
      assert.ok(X.label(id));
    }
  }
  const html = P.overview(ctxOf({}));
  for (const c of cards(html)) assert.match(html, new RegExp(`data-metric="${c.id}"[\\s\\S]*?data-tip="[^"]{20,}"[\\s\\S]*?href="#drill/${c.id}"`), `${c.id}: its definition and its link`);
});

test('the headline numbers equal a count made straight from the raw rows, with and without my devices', () => {
  const day = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));
  const from = day(W.NOW - 29 * 86400000), to = day(W.NOW), inR = t => day(t) >= from && day(t) <= to;
  const rows = Object.values(world.matches).flatMap(d => Object.values(d));
  const mineDev = h => h.startsWith('dddddddd');
  for (const mine of [false, true]) {
    const S = X.scope(M, { range: '30', mine }), v = id => X.metric(S, id).v;
    const ms = rows.filter(r => inR(r.t0) && (mine || !r.own));
    assert.equal(v('started'), ms.length, 'matches started');
    assert.equal(v('finished'), ms.filter(r => r.t1 && !['resign', 'timeout'].includes(r.end)).length, 'matches finished');
    assert.equal(v('abandoned'), ms.filter(r => r.t1 && ['resign', 'timeout'].includes(r.end)).length, 'matches abandoned');
    const evs = Object.entries(world.logs).filter(([h]) => mine || !mineDev(h)).flatMap(([, l]) => Object.values(l)).filter(e => inR(e.t));
    assert.equal(v('opens'), evs.filter(e => e.ev === 'open').length, 'app opens');
    assert.equal(v('errors'), evs.filter(e => e.ev === 'error').length, 'errors');
    assert.equal(v('shares'), evs.filter(e => e.ev === 'act' && e.act === 'share').length, 'shares');
    assert.equal(v('squares'), ms.filter(r => r.t1 && !['resign', 'timeout'].includes(r.end)).flatMap(r => JSON.parse(r.sq)).filter(e => e.end === 'won').length, 'completed squares');
    const finds = Object.values(world.finds).flatMap(d => Object.values(d)).filter(r => inR(r.t) && (mine || !r.own));
    assert.equal(v('findBot'), finds.filter(r => r.k === 'bot').length); assert.equal(v('findPeople'), finds.filter(r => r.k === 'people').length);
    assert.equal(v('reports'), Object.values(world.reports).filter(r => inR(r.at) && (mine || !mineDev(r.h))).length, 'problem reports');
    const devs = Object.entries(world.logs).filter(([h, l]) => (mine || !mineDev(h)) && Object.values(l).some(e => inR(e.t)));
    assert.equal(v('active'), devs.length, 'active players (here every person has one device)');
  }
});

test('Players and Matches are linked: a match names its players as links to them; a person\'s page lists their matches; a report links its match and its player', () => {
  const ctx = ctxOf({});
  const m = P.match(ctx, 'g1');
  assert.match(m, /href="#players\/u%3Au1">sam<\/a>/); assert.match(m, new RegExp(`href="#players/d%3A${W.H('c')}"`), 'a guest, by their device');
  assert.match(m, /Reported/); assert.match(m, /data-mlexport="mg1"|Loading its log/);
  const p = P.profile(ctx, 'u:u1');
  assert.match(p, /data-go="#matches\/g1"/); assert.match(p, /data-go="#matches\/g2"/); assert.match(p, /<dt>Source<\/dt><dd>tiktok<\/dd>/);
  assert.match(P.matches(ctx), /data-go="#matches\/l_a1"/);
  assert.match(P.health(ctx), new RegExp(`href="#players/d%3A${W.H('a')}"`), 'a report\'s player');
  assert.match(P.profile(ctx, 'nobody'), /No such player/); assert.match(P.match(ctx, 'nothing'), /No such match/);
});

test('the one table: sorts by any column, searches, filters a column (numbers by >, <, =, a-b), exports what it shows as CSV, shows the first rows', () => {
  const cols = [{ k: 'name', label: 'Name', get: r => r.name }, { k: 'n', label: 'Games, "all"', get: r => r.n, num: true, tip: 'How many' }];
  const rows = [{ name: 'sam', n: 3 }, { name: 'Ava', n: 12 }, { name: 'liam, jr', n: 7 }, { name: 'zoe', n: null }];
  const st = T.newState();
  assert.deepEqual(T.apply(cols, rows, st).map(r => r.name), ['sam', 'Ava', 'liam, jr', 'zoe'], 'as given');
  T.sortBy(st, cols, 'n'); assert.deepEqual(T.apply(cols, rows, st).map(r => r.n), [12, 7, 3, null], 'a number column: highest first, the empty last');
  T.sortBy(st, cols, 'n'); assert.deepEqual(T.apply(cols, rows, st).map(r => r.n), [3, 7, 12, null], 'again: the other way');
  T.sortBy(st, cols, 'name'); assert.deepEqual(T.apply(cols, rows, st).map(r => r.name), ['Ava', 'liam, jr', 'sam', 'zoe'], 'text: A first');
  st.q = 'A'; assert.deepEqual(T.apply(cols, rows, st).map(r => r.name), ['Ava', 'liam, jr', 'sam'], 'the search, any case, any column');
  st.q = ''; st.filt = { n: '>5' }; assert.deepEqual(T.apply(cols, rows, st).map(r => r.name), ['Ava', 'liam, jr']);
  st.filt = { n: '3-7' }; assert.deepEqual(T.apply(cols, rows, st).map(r => r.n), [7, 3]);
  st.filt = { n: '<=3', name: 'sa' }; assert.deepEqual(T.apply(cols, rows, st).map(r => r.name), ['sam']);
  st.filt = { name: 'jr' };
  const html = T.html('t1', cols, rows, st);
  assert.match(html, /data-tsort="t1" data-k="n">Games, &quot;all&quot;<\/button><i class="tipi"[^>]*data-tip="How many"/); assert.match(html, /aria-sort="ascending"/);
  assert.match(html, /data-tq="t1"/); assert.match(html, /data-tcsv="t1"/); assert.match(html, /1 of 4/); assert.match(html, /data-tclear="t1"/);
  assert.equal(T.csvOf('t1'), 'Name,"Games, ""all"""\r\n"liam, jr",7\r\n', 'what the table shows, quoted where it must be');
  const many = Array.from({ length: 250 }, (_, i) => ({ name: 'p' + i, n: i })), big = T.newState();
  assert.equal((T.html('t2', cols, many, big).match(/<tr>/g) || []).length - 1, T.LIMIT); assert.match(T.html('t2', cols, many, big), /data-tall="t2">Show all 250</);
  big.all = true; assert.equal((T.html('t2', cols, many, big).match(/<tr>/g) || []).length - 1, 250);
  assert.equal(T.csvOf('t2').split('\r\n').length - 2, 250, 'the export is every row, not the first hundred');
});

test('every stats page carries the filters; the settings version only where it applies; every table on every page is the one table', () => {
  const ctx = ctxOf({});
  for (const [name, page] of Object.entries(PAGES)) {
    const html = page(ctx);
    for (const k of ['mine', 'range', 'platform', 'mode']) assert.match(html, new RegExp(`data-gf="${k}"`), `${name}: ${k}`);
    assert.doesNotMatch(html, /data-gf="version"/, name);
    assert.equal((html.match(/<table/g) || []).length, (html.match(/class="tb" data-tb=/g) || []).length, `${name}: no table but the one`);
  }
  assert.match(P.filterBar(ctx, { version: true }), /data-gf="version"/); assert.match(P.gameStats(ctx, 'ttt'), /data-gf="version"/);
  assert.match(P.filterBar(ctxOf({ range: 'custom', from: '2026-11-01', to: '2026-11-10' })), /type="date" data-gf="from" value="2026-11-01"/);
});
