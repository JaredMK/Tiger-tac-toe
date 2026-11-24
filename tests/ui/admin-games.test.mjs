// The admin's Games page (admin.js, November 2026: Mini-game Settings and Releases in one): the list of every mini-game, each
// game's page (its release switches, its Mode where it is a race game, its settings, its tuning card, Test play, Save and
// Reset to defaults), the old hashes' redirects, and what Reset and Save write. admin.js is the page's own script (not a
// module): it runs here with the browser's names stubbed, its Firebase hook set to "offline" (no SDK, the database stood in
// for by a mock that records every write), and the page's HTML read back from the stand-in #app.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------- the stand-in page: #app's HTML, and the controls in it as elements with a value ----------
const unesc = s => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attrs = tag => { const o = {}; for (const m of tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) if (m.index > 0 || !/^(input|select|option|button)$/.test(m[1])) o[m[1]] = m[2] === undefined ? '' : unesc(m[2]); return o; };
const camel = k => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function elements(html) {   // every <input>, <select> and <button>: { tagName, type, dataset, value, checked, min, max, disabled }
  const out = [];
  for (const m of html.matchAll(/<input\b([^>]*)>|<(select|button|textarea)\b([^>]*)>([\s\S]*?)<\/\2>/g)) {
    const tag = m[2] || 'input', a = attrs(m[2] ? m[3] : m[1]), el = { tagName: tag.toUpperCase(), type: a.type || (tag === 'select' ? 'select-one' : tag === 'button' ? 'submit' : 'text'), dataset: {}, min: a.min || '', max: a.max || '', disabled: 'disabled' in a, checked: 'checked' in a, id: a.id || '', className: a.class || '', value: a.value || '' };
    for (const k of Object.keys(a)) if (k.startsWith('data-')) el.dataset[camel(k.slice(5))] = a[k];
    if (tag === 'select') {
      const opts = [...(m[4] || '').matchAll(/<option\b([^>]*)>/g)].map(x => attrs(x[1]));
      const sel = opts.find(o => 'selected' in o) || opts[0];
      el.value = sel ? sel.value : '';
    }
    if (tag === 'textarea') el.value = (m[4] || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    el.closest = () => null; el.insertAdjacentElement = () => {}; el.classList = { add() {} }; el.matches = () => false;
    out.push(el);
  }
  return out;
}
// A selector as the page uses them: tag? [data-x], [data-x="v"], [data-x^="v"], #id, .class; a comma joins alternatives.
function matches(el, sel) {
  return sel.split(',').some(one => {
    one = one.trim();
    const tag = (one.match(/^(input|select|button|textarea)/) || [])[1];
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    if (one.startsWith('#')) return el.id === one.slice(1);
    if (one.startsWith('.')) return el.className.split(/\s+/).includes(one.slice(1));
    const rest = one.slice(tag ? tag.length : 0);
    return [...rest.matchAll(/\[data-([\w-]+)(?:(\^?)="([^"]*)")?\]/g)].every(([, k, pre, v]) => { const d = el.dataset[camel(k)]; return d !== undefined && (v === undefined || (pre ? d.startsWith(v) : d === v)); });
  });
}
const app = { innerHTML: '', edits: [], addEventListener() {}, scrollTo() {} };
app.querySelectorAll = sel => elements(app.innerHTML).map(el => app.edits.reduce((x, e) => (e.when(x) ? Object.assign(x, e.set) : x), el)).filter(el => matches(el, sel));
app.querySelector = sel => app.querySelectorAll(sel)[0] || null;
// Edits "typed" into the page: a change to the controls the selectors find (applied as the page is read).
const type = (when, set) => app.edits.push({ when, set });

// ---------- the browser's names ----------
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.document = { getElementById: id => (id === 'app' ? app : null), addEventListener() {}, createElement: () => ({ setAttribute() {}, className: '', textContent: '' }), body: { appendChild() {} } };
globalThis.location = { hash: '#games', href: 'http://localhost/admin.html', search: '' };
const replaced = [];
globalThis.history = { replaceState: (_, __, h) => { replaced.push(h); location.hash = h; } };
const stored = {};
globalThis.localStorage = { getItem: k => (k in stored ? stored[k] : null), setItem(k, v) { stored[k] = String(v); } };
globalThis.sessionStorage = {};
globalThis.CSS = { escape: s => s };
globalThis.confirm = () => true;
globalThis.TTC_ENV = { config: {}, staging: false };
globalThis.TTT_FIREBASE = { offline: true };
globalThis.scrollTo = () => {};
for (const f of ['admin.js']) new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: path.join(ROOT, f), importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER }).runInThisContext();
const W = createRequire(import.meta.url)('../admin-world.js');   // a few days of rows, as the server writes them
Date.now = () => W.NOW;                                           // (the page counts back from now)
const A = window.TTC_ADMIN;
assert.ok(A, 'admin.js offers its parts to the tests when the Firebase hook says offline');
await A.loadMetas();
const E = await import('../../src/games/index.js');
const { RACE_TYPES } = await import('../../src/core/race.js');

// The database stood in for: every write recorded; a read answers what was written, else what the test seeded.
function mockDb(seed = {}) {
  const store = Object.assign({}, seed), writes = [], versions = [];   // (versions: the settings-version writes, kept apart: config/versions and config/versionLog)
  const put = (p, v) => { (/^config\/version/.test(p) ? versions : writes).push([p, v]); if (v === null) delete store[p]; else store[p] = v; };
  const dbM = { ref: (db, p) => p, set: async (p, v) => put(p, v), get: async p => ({ val: () => (p in store ? store[p] : null) }), query: p => p, orderByChild: () => null, limitToLast: () => null, startAt: () => null,
    runTransaction: async (p, fn) => { const v = fn(p in store ? store[p] : null); put(p, v); return { committed: true, snapshot: { val: () => v } }; } };
  return { fb: { dbM, db: null, fnM: {}, fns: null }, writes, store, versions };
}
const ctl0 = () => ({ config: {}, secretsSet: {}, bots: {}, botStats: {}, alertStats: {}, features: {}, releases: {}, runCfg: {}, bullsCfg: {}, wheelsCfg: {}, plinkoCfg: {}, pigCfg: {}, roadsCfg: {}, oddCfg: {}, attCfg: { headcount: {}, flash: {}, snapshot: {} }, fingCfg: { skyhop: {}, scoop: {}, bowling: {}, pinball: {} }, alertLog: [], tune: {}, ai: {}, anim: {}, timer: {}, clients: {}, allow: {} });
const draw = hash => { location.hash = hash; app.edits = []; A.draw(); return app.innerHTML; };
const btn = t => ({ dataset: { tunereset: t }, tagName: 'BUTTON', disabled: false, closest: () => null, insertAdjacentElement() {} });

test('the Games list: every mini-game once, alphabetical, with its icon, category, release badges, the Race badge and the changed marker, under the comparison table; Platforms and Pace are on Settings', () => {
  A.ready();
  A.ctl = Object.assign(ctl0(), { tune: { wordle: { mode: 'race' }, pig: { target: 60 } }, releases: { hex: true, pig: false, platform: { ios: { c4: false } } }, pigCfg: { sides: 6, target: 51 }, clients: { ios: '1.2.0' } });
  const html = draw('#games');
  for (const t of E.TYPES) assert.equal((html.match(new RegExp(`class="grow" href="#games/${t}"`, 'g')) || []).length, 1, `${t} listed once`);
  assert.equal((html.match(/class="grow" href="#games\//g) || []).length, E.TYPES.length, 'the pool and nothing else (the retired games are not listed)');
  for (const seg of html.split('<h3 class="ggrp"').slice(1)) {
    const names = [...seg.matchAll(/class="grow" href="#games\/(\w+)"/g)].map(m => E.GAMES[m[1]].meta.info.name);
    assert.deepEqual(names, names.slice().sort((a, b) => a.localeCompare(b)), 'alphabetical by the shown name, within each status');
  }
  const row = t => (html.match(new RegExp(`<li><a class="grow" href="#games/${t}"[\\s\\S]*?</a></li>`)) || [''])[0];
  assert.match(row('ttt'), /class="gico"[^>]*><svg/, 'the icon');
  assert.match(row('ttt'), /Brain · 7 settings</, 'the category and the settings count (its own one and the computer\'s six: a mistake rate and a thinking time a level)');
  assert.match(row('ttt'), /badge rel">Released</); assert.doesNotMatch(row('ttt'), /badge chg/);
  assert.match(row('hex'), /badge rel">Released</, 'released in the database although admin only in the code');
  assert.match(row('pig'), /badge adm">Testing</, 'un-released in the database'); assert.match(row('pig'), /badge chg">changed</, 'a TUNE value saved');
  assert.match(row('dash'), /badge adm">Testing</); assert.doesNotMatch(row('dash'), /badge chg/);
  assert.match(row('c4'), /badge ios">iOS off</); assert.doesNotMatch(row('ttt'), /badge ios/);
  assert.match(row('wordle'), /badge race">Race</); assert.match(row('wordle'), /badge chg/, 'the mode is a saved setting');
  assert.doesNotMatch(row('hangman'), /badge race/, 'a race game in Shared: no badge');
  assert.doesNotMatch(row('ttt'), /badge race/);
  assert.doesNotMatch(html, /id="clientsCard"|id="scCard"|id="animCard"/, 'nothing that is not a game\'s on the Games page');
  assert.ok(html.indexOf('id="compareCard"') > 0 && html.indexOf('id="compareCard"') < html.indexOf('id="gamesCard"'), 'the comparison table above the list');
  assert.match(html, /data-gf="version"/, 'the settings-version filter');
  assert.doesNotMatch(html, /Mini-game Settings|href="#releases/, 'no trace of the old pages');
  const set = draw('#settings');
  assert.match(set, /id="clientsCard"/, 'the Clients card'); assert.match(set, /data-clientmin="ios" value="1.2.0"/);
  assert.match(set, /id="scCard"[\s\S]*data-rel="superchaos"/, 'the Super Chaos switch'); assert.match(set, /SUPER_CHAOS_ENABLED/);
  assert.match(set, /id="animCard"><h2>Pace<\/h2>/, 'the Pace card (the Animation figures)');
  for (const id of ['timerCard', 'findCard', 'botsCard', 'aiCard', 'alertsCard', 'templatesCard', 'ownerCard']) assert.match(set, new RegExp(`id="${id}"`), id);
  assert.doesNotMatch(set, /class="grow"/, 'no game on Settings');
});
test('the tuning card\'s stored values count as changed', () => {
  A.ctl = Object.assign(ctl0(), { pigCfg: { sides: 6, target: 51 } });
  assert.equal(A.gameChanged('pig'), true);
  A.ctl = Object.assign(ctl0(), { pigCfg: { sides: 8, target: 51 } });
  assert.equal(A.gameChanged('pig'), false, 'stored as the defaults: not changed');
  A.ctl = Object.assign(ctl0(), { runCfg: { dash: { target: 550, v0: 13, ramp: 3, gapMin: 18, gapMax: 32, mix: { rock: 30, crate: 20, spike: 20, flyer: 20, pair: 11 } } } });
  assert.equal(A.gameChanged('dash'), true, 'a mix weight off the default');
});
test('one bar of sections on every page: Overview, Players, Matches, Games, Growth, Health, Settings; no page is the old menu', () => {
  A.ctl = ctl0();
  for (const h of ['', '#overview', '#players', '#matches', '#games', '#games/ttt', '#growth', '#health', '#settings']) {
    const html = draw(h);
    assert.deepEqual([...html.matchAll(/<nav class="nav"[\s\S]*?<\/nav>/g)].length, 1, h);
    assert.deepEqual([...html.match(/<nav class="nav"[\s\S]*?<\/nav>/)[0].matchAll(/href="#(\w+)"/g)].map(m => m[1]), ['overview', 'players', 'matches', 'games', 'growth', 'health', 'settings'], h);
  }
  assert.match(draw(''), /href="#overview" aria-current="page"/, 'no hash: the Overview');
  assert.match(draw('#games/ttt'), /href="#games" aria-current="page"/);
});
test('a race game\'s page: the release switches, the Mode switch at the top, the settings without a mode field in them, one Save / Reset / Test play', () => {
  A.ctl = Object.assign(ctl0(), { tune: { wordle: { mode: 'race' } } });
  const html = draw('#games/wordle');
  assert.match(html, /<a class="btn back" href="#games"/, 'back to the Games list');
  assert.match(html, /id="relCard"[\s\S]*data-rel="wordle" checked[\s\S]*data-relios="wordle" checked/, 'Released, iOS on');
  assert.match(html, /id="modeCard"/);
  assert.match(html, /<input type="radio" name="mode" value="shared" data-tune="wordle" data-k="mode">/);
  assert.match(html, /<input type="radio" name="mode" value="race" data-tune="wordle" data-k="mode" checked>/, 'Race, as saved');
  assert.ok(html.indexOf('id="modeCard"') < html.indexOf('id="tuneCard"'), 'the Mode above the settings');
  assert.doesNotMatch(html, /<select data-tune="wordle" data-k="mode"/, 'the mode is not in the settings list as well');
  assert.match(html, /data-tune="wordle" data-k="limit"/, 'its other settings');
  assert.equal((html.match(/data-gamesave="wordle"/g) || []).length, 1); assert.equal((html.match(/data-tunereset="wordle"/g) || []).length, 1); assert.equal((html.match(/data-testplay="wordle"/g) || []).length, 1);
  assert.match(html, /class="unsaved" role="status"/);
  for (const t of RACE_TYPES) assert.match(draw(`#games/${t}`), /id="modeCard"/, `${t}: a Mode switch`);
});
test('a game that is not a race game has no Mode switch; a game with a tuning card shows it on the page with no Save of its own', () => {
  A.ctl = Object.assign(ctl0(), { pigCfg: { sides: 6, target: 60 }, releases: { pig: false, platform: { ios: { pig: false } } } });
  let html = draw('#games/pig');
  assert.doesNotMatch(html, /id="modeCard"|name="mode"/);
  assert.match(html, /value="testing" data-rel="pig" checked><b>Testing</); assert.match(html, /data-relios="pig">[\s\S]*?>iOS off</);
  assert.match(html, /id="pigCard"/, 'Risky Rolls\' own card'); assert.match(html, /data-pigcfg="target" value="60"/); assert.match(html, /<option value="6" selected>/);
  assert.equal((html.match(/>Save</g) || []).length, 1, 'one Save on the page'); assert.equal((html.match(/>Test play</g) || []).length, 1, 'one Test play');
  assert.doesNotMatch(html, /data-pigsave|data-runsave|data-fingsave|data-attsave|data-tunesave/);
  html = draw('#games/dash');
  assert.match(html, /id="runCard"[\s\S]*Dash tuning/, 'the runner\'s card'); assert.match(html, /data-runcfg="dash:target"/); assert.match(html, /data-runcfg="dash:mix.rock"/);
  assert.doesNotMatch(html, /Lane Rush tuning|data-runcfg="lane:/, 'this runner alone');
  assert.equal((html.match(/>Save</g) || []).length, 1);
  for (const t of E.TYPES) { const h = draw(`#games/${t}`); assert.match(h, new RegExp(`data-gamesave="${t}"`), `${t}: Save`); assert.match(h, new RegExp(`data-tunereset="${t}"`)); assert.match(h, new RegExp(`data-rel="${t}"`)); assert.doesNotMatch(h, /undefined|NaN|\[object/, `${t}: nothing undrawn`); }
  for (const t of ['dash', 'lane', 'flap', 'chopper', 'bullseye', 'plinko', 'pig', 'roads', 'oddone', 'wheels', 'headcount', 'flash', 'snapshot', 'skyhop', 'scoop', 'pinball']) assert.ok(A.legacyPath(t), `${t}: a tuning card path`);
});
test('the computer\'s levels on a game\'s page: Computer: Easy, Normal, Hard in that order after the game\'s own groups, each with its thinking time (and mistakes where the game can slip), plain labels', () => {
  A.ctl = ctl0();
  const order = h => [...h.matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => m[1]);
  let html = draw('#games/keydrop');
  assert.deepEqual(order(html).filter(g => g.startsWith('Computer')), ['Computer: Easy', 'Computer: Normal', 'Computer: Hard']);
  for (const k of ['aiMsEasy', 'aiMs', 'aiMsHard', 'aiThinkEasy', 'aiThinkNormal', 'aiThinkHard']) assert.ok(html.includes(`data-tune="keydrop" data-k="${k}"`), `${k}: a field`);
  assert.ok(!html.includes('data-k="aiMissEasy"'), 'Key Drop is an attempt: no generic mistakes without a worse() of its own');
  html = draw('#games/c4');
  for (const k of ['aiMissEasy', 'aiMissNormal', 'aiMissHard', 'aiThinkEasy']) assert.ok(html.includes(`data-tune="c4" data-k="${k}"`), `${k}: a field`);
  assert.match(html, /Mistakes: chance a move is a deliberately weaker one/);
  html = draw('#games/shell');
  const g = order(html); assert.ok(g.indexOf('Level 5') < g.indexOf('Computer'), 'a game\'s own groups before the computer\'s');
});
test('Shell Game\'s page: its settings by level, the difficulty presets (Gentle, Normal, Brutal: the one the page holds is lit), Save and Test play', async () => {
  const { PRESETS } = await import('../../src/games/shell/meta.js');
  A.ctl = ctl0();
  let html = draw('#games/shell');
  assert.match(html, /<div class="presets" role="group" aria-label="Difficulty presets">/);
  assert.deepEqual([...html.matchAll(/data-preset="(\w+)" data-pgame="shell" aria-pressed="(\w+)"/g)].map(m => [m[1], m[2]]), [['Gentle', 'false'], ['Normal', 'true'], ['Brutal', 'false']], 'Normal is the defaults: lit');
  for (const g of ['Rules', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Computer']) assert.ok(html.includes(`<h3>${g}</h3>`), `${g}: its own group`);
  for (const k of ['levels', 'again', 'c1', 'ms1', 'sw1', 'pr1', 'far1', 'rp1', 'sh1', 'c5', 'ms5', 'ai1', 'ai5']) assert.ok(html.includes(`data-tune="shell" data-k="${k}"`), `${k}: a field`);
  assert.match(html, /data-tune="shell" data-k="levels" min="1" max="5" step="1" value="3"/); assert.match(html, /data-tune="shell" data-k="c1" min="2" max="7" step="1" value="3"/); assert.match(html, /data-tune="shell" data-k="pr2" min="0" max="2" step="1" value="1"/);
  assert.equal((html.match(/>Save</g) || []).length, 1); assert.equal((html.match(/>Test play</g) || []).length, 1);
  A.ctl = Object.assign(ctl0(), { tune: { shell: PRESETS.Brutal } });
  html = draw('#games/shell');
  assert.deepEqual([...html.matchAll(/data-preset="(\w+)" data-pgame="shell" aria-pressed="(\w+)"/g)].map(m => m[2]), ['false', 'false', 'true'], 'Brutal saved: lit');
  assert.match(html, /data-tune="shell" data-k="ms1" min="80" max="1200" step="5" value="255"/);
  assert.doesNotMatch(draw('#games/flash'), /class="presets"/, 'a game without presets has no row');
});

test('the old hashes open where their content went: #settings/<type> and #releases to Games, Playtesters to Players, Stats and Balance to Games, Bots, Devices and Staging Access to Settings', () => {
  A.ctl = ctl0();
  replaced.length = 0;
  location.hash = '#settings'; assert.deepEqual(A.route(), ['settings']); assert.deepEqual(replaced, [], 'Settings is a page of its own now');
  location.hash = '#settings/pig'; assert.deepEqual(A.route(), ['games', 'pig']); assert.equal(replaced.at(-1), '#games/pig');
  for (const [from, to] of [['releases', 'games'], ['playtest', 'players'], ['stats', 'games'], ['balance', 'games'], ['bots', 'settings'], ['devices', 'settings'], ['access', 'settings']]) {
    location.hash = '#' + from; assert.deepEqual(A.route(), [to], from); assert.equal(replaced.at(-1), '#' + to);
  }
  location.hash = '#nonsense'; assert.deepEqual(A.route(), ['overview']);
  const html = draw('#settings/dash');
  assert.match(html, /<h2>[\s\S]*Dash<\/h2>/); assert.match(html, /id="runCard"/); assert.equal(location.hash, '#games/dash');
  assert.match(draw('#releases'), /id="gamesCard"/);
});
test('Reset to defaults clears the game\'s config/tune node and its tuning card\'s node, nothing else', async () => {
  const db = mockDb({ 'config/tune/pig': { target: 60 }, 'config/pig': { sides: 6, target: 60 }, 'config/tune': { pig: { target: 60 } } });
  A.fb = db.fb; A.ctl = Object.assign(ctl0(), { tune: { pig: { target: 60 } }, pigCfg: { sides: 6, target: 60 } });
  draw('#games/pig');
  await A.resetGame('pig', btn('pig'));
  assert.deepEqual(db.writes, [['config/tune/pig', null], ['config/pig', null]]);
  assert.deepEqual(A.ctl.pigCfg, {}, 'read back: the card is at its defaults');
  assert.deepEqual(db.versions[0], ['config/versions/pig', 2], 'a Reset makes a new settings version (v1: everything before)');
  assert.equal(db.versions[1][0], 'config/versionLog/pig/v2'); assert.equal(db.versions[1][1].note, 'Reset to defaults');
  assert.deepEqual(db.versions[1][1].ch['card.target'], { from: 60, to: 'default' }, 'what changed: the tuning card\'s target back to its default');
  db.writes.length = 0;
  await A.resetGame('dash', btn('dash'));
  assert.deepEqual(db.writes, [['config/tune/dash', null], ['config/run/dash', null]], 'a runner: its node under config/run');
  db.writes.length = 0;
  await A.resetGame('bullseye', btn('bullseye'));
  assert.deepEqual(db.writes, [['config/tune/bullseye', null], ['config/bulls', null]], 'Bullseye\'s card is config/bulls');
  db.writes.length = 0;
  await A.resetGame('ttt', btn('ttt'));
  assert.deepEqual(db.writes, [['config/tune/ttt', null]], 'a game without a card: its tune node alone');
  globalThis.confirm = () => false;
  db.writes.length = 0;
  db.versions.length = 0;
  await A.resetGame('pig', btn('pig'));
  assert.deepEqual(db.writes, [], 'not confirmed: nothing written');
  assert.deepEqual(db.versions, [], 'and no new version');
  globalThis.confirm = () => true;
});
test('Save writes what changed: the Mode as a TUNE value, a tuning card to its own node in its own shape, nothing where nothing changed', async () => {
  const db = mockDb();
  A.fb = db.fb; A.ctl = ctl0();
  draw('#games/wordle');
  const save = { dataset: { gamesave: 'wordle' }, tagName: 'BUTTON', disabled: false, closest: () => null, insertAdjacentElement() {} };
  await A.saveGame('wordle', save);
  assert.deepEqual(db.writes, [], 'as saved: nothing to write');
  draw('#games/wordle');
  type(el => el.type === 'radio' && el.dataset.k === 'mode', { checked: false });   // Race picked
  type(el => el.type === 'radio' && el.value === 'race', { checked: true });
  await A.saveGame('wordle', save);
  assert.deepEqual(db.writes, [['config/tune/wordle', { mode: 'race' }]], 'the mode alone, as a config/tune value');
  assert.deepEqual(A.ctl.tune.wordle, { mode: 'race' });
  assert.equal(A.raceOn('wordle'), true);
  // a tuning card: Risky Rolls' die and target, in config/pig's own shape; its TUNE untouched
  db.writes.length = 0;
  draw('#games/pig');
  type(el => el.dataset.pigcfg === 'target', { value: '70' });
  await A.saveGame('pig', { dataset: { gamesave: 'pig' }, tagName: 'BUTTON', disabled: false, closest: () => null, insertAdjacentElement() {} });
  assert.deepEqual(db.writes, [['config/pig', { sides: 8, target: 70 }]]);
  assert.deepEqual(A.ctl.pigCfg, { sides: 8, target: 70 });
  // a runner: config/run/<type> with its mix
  db.writes.length = 0;
  draw('#games/dash');
  type(el => el.dataset.runcfg === 'dash:mix.rock', { value: '40' });
  await A.saveGame('dash', { dataset: { gamesave: 'dash' }, tagName: 'BUTTON', disabled: false, closest: () => null, insertAdjacentElement() {} });
  assert.equal(db.writes.length, 1); assert.equal(db.writes[0][0], 'config/run/dash'); assert.equal(db.writes[0][1].mix.rock, 40); assert.equal(db.writes[0][1].target, 550);
  // a refused value: nothing written
  db.writes.length = 0;
  draw('#games/pig');
  type(el => el.dataset.pigcfg === 'target', { value: '5' });
  await A.saveGame('pig', { dataset: { gamesave: 'pig' }, tagName: 'BUTTON', disabled: false, closest: () => null, insertAdjacentElement() {} });
  assert.deepEqual(db.writes, [], 'out of range: refused');
});

// The Balance report (December 2026, #balance; src/admin/balance.js) and a game's settings version card.
const seedWorld = () => { const w = W.world(); A.seed(Object.assign({}, w, { devmeta: w.meta, token: 'abcdefghijklmnopqrstuvwx' })); return w; };
const kpiOf = (html, id) => { const m = html.match(new RegExp(`data-metric="${id}"[\\s\\S]*?<a class="big"[^>]*>([^<]*)<`)); return m ? m[1] : null; };

test('a game\'s numbers are on its own page, by settings version, and in the comparison table: the same figures; its version card', () => {
  A.ctl = Object.assign(ctl0(), { releases: { ttt: true, pig: true }, versions: { ttt: 2 }, versionLog: { ttt: { v2: { at: Date.parse('2026-11-16'), by: 'admin@x', ch: {} } } } });
  seedWorld(); A.setFilter('version', 'current'); A.setFilter('mine', false);
  const list = draw('#games'), cmp = list.slice(list.indexOf('id="compareCard"'));
  assert.ok(list.indexOf('id="qualityCard"') > 0 && list.indexOf('id="qualityCard"') < list.indexOf('id="compareCard"'), 'the games\' quality first (December 2026), then the comparison');
  assert.match(list, /data-gf="opp"[\s\S]*?The computer[\s\S]*?data-gf="pos"[\s\S]*?Corners/, 'its own filters: the opponent type and the board position');
  assert.match(list, /id="qualityCard"[\s\S]*?Excluded %[\s\S]*?Never played %[\s\S]*?Not finished %[\s\S]*?Human beats AI %[\s\S]*?Avg pick order[\s\S]*?Help taps \/ play[\s\S]*?Rematch %/);
  const row = (cmp.match(/<tr><td><a href="#games\/ttt">Tic-tac-toe<\/a><\/td>[\s\S]*?<\/tr>/) || [''])[0];
  assert.match(row, />Released</); assert.match(row, />v2</);
  assert.match(row, /<td class="num"><a href="#drill\/x:sq%3Attt"[^>]*>1<\/a><\/td>/, 'one square at version 2 (mine left out), a link to its rows');
  const page = draw('#games/ttt');
  assert.match(page, /id="relCard"/, 'the settings page as ever'); assert.match(page, /Settings version 2/); assert.match(page, /<b>v2<\/b> 2026-11-16/);
  assert.match(page, /id="gameStats"><h2>Tic-tac-toe: how it plays<\/h2>/);
  assert.ok(page.indexOf('id="gameStats"') > page.indexOf('data-gamesave="ttt"'), 'under the settings');
  assert.match(page, /Completed squares[\s\S]*?<b class="big"><a href="#drill\/x:sq%3Attt"[^>]*>1<\/a><\/b><span>version 2<\/span>/, 'the same count as the table\'s');
  assert.match(page, /By settings version/); assert.match(page, /v2 <span class="badge rel">current<\/span>/); assert.match(page, />v1</, 'the version before, side by side');
  A.setFilter('mine', true);
  assert.match(draw('#games/ttt'), /<b class="big"><a href="#drill\/x:sq%3Attt"[^>]*>2<\/a><\/b>/, 'with my devices: the owner\'s square too');
  A.setFilter('mine', false);
});

test('Include my devices: off by default, on every stats page, remembered; every number takes my devices in or leaves them out together', () => {
  A.ctl = ctl0(); seedWorld();
  for (const h of ['#overview', '#players', '#matches', '#games', '#growth', '#health']) assert.match(draw(h), /<input type="checkbox" data-gf="mine">/, h + ': the switch, off');
  assert.equal(kpiOf(draw('#overview'), 'active'), '3'); assert.equal(kpiOf(draw('#players'), 'active'), '3', 'the same number on its detail page');
  assert.equal(kpiOf(draw('#overview'), 'finished'), kpiOf(draw('#matches'), 'finished'));
  A.setFilter('mine', true);
  assert.equal(JSON.parse(localStorage.getItem('ttc.admin.filters')).mine, true, 'kept in this browser');
  assert.match(draw('#growth'), /data-gf="mine" checked/, 'the same choice on every page');
  assert.equal(kpiOf(draw('#overview'), 'active'), '4'); assert.equal(kpiOf(draw('#players'), 'active'), '4');
  A.setFilter('platform', 'ios');
  assert.equal(kpiOf(draw('#overview'), 'active'), '1', 'the platform filter'); assert.match(draw('#health'), /<option value="ios" selected>/);
  A.setFilter('platform', 'all'); A.setFilter('mine', false);
});

test('Players: people and their devices together; a person\'s page has their devices (nickname, Excluded), matches, sessions and games; Settings lists my devices and the owner link', async () => {
  A.ctl = ctl0(); const m = mockDb(); A.fb = m.fb; seedWorld();
  let html = draw('#players');
  for (const h of ['Player', 'Type', 'Username', 'Nickname', 'Devices', 'Device IDs', 'Platform', 'Source', 'First seen', 'Last seen', 'Sessions', 'Matches', 'Record', 'Excluded']) assert.match(html, new RegExp(`data-k="[a-z]+">${h}</button>`), h);
  assert.match(html, /data-go="#players\/u%3Au1"/, 'an account'); assert.match(html, new RegExp(`data-go="#players/d%3A${W.H('a')}"`), 'a guest, by their device');
  assert.doesNotMatch(html, /jarhad/, 'my own account left out');
  html = draw('#players/' + encodeURIComponent('u:boss'));
  assert.match(html, /<h2>jarhad<\/h2><span class="badge own">/); assert.match(html, /<code>dddddddd<\/code>/);
  assert.match(html, new RegExp(`data-nick="${W.H('d')}"[^>]*>Mine<`), 'the prefix\'s nickname on its device'); assert.match(html, new RegExp(`data-devex="${W.H('d')}" checked`));
  for (const h of ['Devices', 'Matches', 'Sessions', 'Mini-games played']) assert.match(html, new RegExp(`<h2>${h}</h2>`), h);
  assert.match(html, /data-go="#matches\/l_d1"/, 'their match, a link to it');
  html = draw('#players/' + encodeURIComponent('u:u1'));
  assert.match(html, new RegExp(`data-devex="${W.H('b')}" aria`), 'a player\'s device: counted'); assert.match(html, /tiktok/, 'the source tag');
  const set = draw('#settings');
  assert.match(set, /\?owner=abcdefghijklmnopqrstuvwx/, 'the owner link'); assert.match(set, /id="exId"/);
  assert.match(set, /<code>dddddddd<\/code>[\s\S]*?jarhad/, 'an excluded device, and who it is');
  await A.metaPut(W.H('b'), { nick: "Sam's phone" });
  assert.deepEqual(m.writes.at(-1), ['devmeta/' + W.H('b'), { ex: false, at: m.writes.at(-1)[1].at, nick: "Sam's phone" }], 'a player\'s device named, still counted');
  assert.match(draw('#players'), /Sam&#39;s phone/, 'on the list at once');
  await A.metaPut(W.H('d'), { ex: false });
  assert.deepEqual([m.writes.at(-1)[0], m.writes.at(-1)[1].ex, m.writes.at(-1)[1].nick], ['devmeta/' + W.H('d'), false, 'Mine'], 'switched off on its own hash, its name kept');
  assert.equal(A.devmeta.dddddddd.ex, true, 'the prefix entry untouched');
  assert.equal(kpiOf(draw('#overview'), 'active'), '4', 'counted again at once');
});

test('statuses: the Games list in three groups (Released, Testing, Deprioritized, each alphabetical); a game\'s page sets its status; Deprioritized only for a game not released', async () => {
  await A.loadMetas();
  const db = mockDb(); A.fb = db.fb;
  A.ctl = Object.assign(ctl0(), { releases: { hex: false, maze: false, ttt: true, depri: { hex: true, ttt: true }, soon: { maze: true } } });
  let list = draw('#games');
  const hR = list.indexOf('id="ggrp-released"'), hT = list.indexOf('id="ggrp-testing"'), hD = list.indexOf('id="ggrp-depri"');
  assert.ok(hR > 0 && hR < hT && hT < hD, 'Released, then Testing, then Deprioritized');
  const at = t => list.indexOf(`class="grow" href="#games/${t}"`);
  assert.ok(at('ttt') > hR && at('ttt') < hT, 'a released game flagged: still Released');
  assert.ok(at('maze') > hT && at('maze') < hD); assert.ok(at('hex') > hD, 'hex deprioritized');
  assert.match(list, /id="ggrp-depri">Deprioritized <small>1<\/small>/);
  for (const k of ['released', 'testing', 'depri']) {
    const seg = list.slice(list.indexOf(`id="ggrp-${k}"`)).split('<h3 class="ggrp"')[0];
    const names = [...seg.matchAll(/class="grow" href="#games\/(\w+)"/g)].map(m => E.GAMES[m[1]].meta.info.name);
    assert.deepEqual(names, names.slice().sort((a, b) => a.localeCompare(b)), `${k}: alphabetical`);
  }
  assert.equal((list.match(/class="grow" href="#games\//g) || []).length, E.TYPES.length, 'every game once');
  assert.match(list, /href="#games\/hex"[\s\S]*?badge dep">Deprioritized</);
  let html = draw('#games/hex');
  assert.match(html, /role="radiogroup" aria-label="Status"/);
  assert.match(html, /value="depri" data-rel="hex" checked><b>Deprioritized</);
  // Deprioritize a Testing game with Coming soon on: releases/{t} false, the flag set, Coming soon cleared
  const radio = (t, v) => ({ type: 'radio', value: v, dataset: { rel: t }, closest: () => null, insertAdjacentElement() {} });
  await A.saveRelease(radio('maze', 'depri'));
  assert.deepEqual(db.writes.splice(0), [['releases/maze', false], ['releases/depri/maze', true], ['releases/soon/maze', null]]);
  assert.equal(A.statusOf('maze'), 'depri');
  // Release it: the flag cleared
  await A.saveRelease(radio('maze', 'released'));
  assert.deepEqual(db.writes.splice(0), [['releases/maze', true], ['releases/depri/maze', null]]);
  assert.equal(A.statusOf('maze'), 'released');
  await A.saveRelease(radio('maze', 'testing'));
  assert.deepEqual(db.writes.splice(0), [['releases/maze', false]]);
  assert.equal(A.statusOf('maze'), 'testing');
  await A.saveRelease(radio('maze', 'bogus')); assert.equal(db.writes.length, 0, 'an unknown status: nothing written');
});
test('Leaving soon: a switch and a date on a released game\'s Release card, saved to releases/leaving and cleared; never on a game not released; un-releasing clears it; a badge on Games', async () => {
  await A.loadMetas(); A.ready();
  const db = mockDb(); A.fb = db.fb;
  A.ctl = Object.assign(ctl0(), { releases: { ttt: true, war: true, pig: false, leaving: { war: '2999-03-04', ttt: true }, retire: { all: { ttt: '2999-05-06' } } } });
  let html = draw('#games/war');
  assert.match(html, /data-leaving="war" checked><span class="good">Leaving soon</);
  assert.match(html, /type="date" data-leavedate="war" value="2999-03-04">/);
  html = draw('#games/ttt');
  assert.match(html, /data-leavedate="ttt" value="">/); assert.match(html, /Banner: the removal day, May 6/, 'no date of its own: the removal day named');
  html = draw('#games/pig');
  assert.match(html, /data-leaving="pig" disabled><span class="">Leaving soon: not released</); assert.match(html, /data-leavedate="pig" value="" disabled>/);
  const list = draw('#games');
  assert.match(list, /href="#games\/war"[\s\S]*?badge ret">Leaving Mar 4</); assert.match(list, /href="#games\/ttt"[\s\S]*?badge ret">Leaving soon</);
  const box = (d, extra) => Object.assign({ dataset: d, closest: () => null, insertAdjacentElement() {} }, extra);
  // on with no date: true; a date picked: the date; off: cleared
  await A.saveLeaving(box({ leaving: 'c4' }, { checked: true }));
  assert.deepEqual(db.writes.pop(), ['releases/leaving/c4', true]);
  draw('#games/c4'); type(el => el.dataset.leavedate === 'c4', { value: '2999-12-24' });
  await A.saveLeaving(box({ leavedate: 'c4' }, { value: '2999-12-24' }));
  assert.deepEqual(db.writes.pop(), ['releases/leaving/c4', '2999-12-24']); app.edits = [];
  await A.saveLeaving(box({ leaving: 'c4' }, { checked: false }));
  assert.deepEqual(db.writes.pop(), ['releases/leaving/c4', null]);
  await A.saveLeaving(box({ leaving: 'pig' }, { checked: true }));
  assert.deepEqual(db.writes.pop(), ['releases/leaving/pig', null], 'not released: never set');
  // un-released (Testing): the flag goes with it
  await A.saveRelease({ type: 'radio', value: 'testing', dataset: { rel: 'war' }, closest: () => null, insertAdjacentElement() {} });
  assert.deepEqual(db.writes.splice(0), [['releases/war', false], ['releases/leaving/war', null]]);
  assert.equal(A.ctl.releases.leaving.war, undefined);
});
test('Coming soon: a switch and a release date beside Released and iOS; never for a game released everywhere; a date passed warns', async () => {
  await A.loadMetas();
  A.ctl = Object.assign(ctl0(), { releases: { pig: false, ttt: true, war: true, platform: { ios: { war: false } }, soon: { pig: '2020-01-02', war: true, ttt: true } } });
  let html = draw('#games/pig');
  assert.match(html, /data-soon="pig" checked><span class="good">Coming soon</);
  assert.match(html, /type="date" data-soondate="pig" value="2020-01-02">/);
  assert.match(html, /id="soonLate"[^>]*>The release date \(2020-01-02\) has passed and the game is still not released: players see "Coming soon"/);
  html = draw('#games/war');
  assert.match(html, /Coming soon on iOS/, 'released on the web, off on iOS: coming soon on iOS alone');
  assert.doesNotMatch(html, /id="soonLate"/, 'no date: no warning');
  html = draw('#games/ttt');
  assert.match(html, /data-soon="ttt" disabled><span class="">Coming soon: released</, 'released everywhere: never coming soon');
  assert.match(html, /data-soondate="ttt" value="" disabled>/);
  assert.match(draw('#games'), /badge soon[^>]*>Coming soon · date passed</, 'the list says so too');
});
test('a game\'s Lineup card: the back\'s line with its count, luck or skill and the format, its meta.js the defaults; Save keeps what differs at config/lineup, Reset clears it', async () => {
  await A.loadMetas();
  const db = mockDb(); A.fb = db.fb; A.ctl = ctl0();
  const m = E.metaOf('coins');
  let html = draw('#games/coins');
  assert.ok(html.indexOf('id="relCard"') < html.indexOf('id="lineupCard"') && html.indexOf('id="lineupCard"') < html.indexOf('id="tuneCard"'), 'under the release switches');
  assert.match(html, new RegExp(`<textarea data-lublurb="coins" maxlength="120" rows="3">${m.lineupBlurb.replace(/'/g, '&#39;').replace(/[.?*+()]/g, '\\$&')}</textarea>`));
  assert.match(html, new RegExp(`id="luCount">${m.lineupBlurb.length} / 120<`));
  assert.match(html, new RegExp(`<option value="${m.luckSkill}" selected>`)); assert.match(html, /data-lureset="coins" disabled/, 'nothing saved: nothing to reset');
  const save = { dataset: { lusave: 'coins' }, tagName: 'BUTTON', disabled: false, closest: () => null, insertAdjacentElement() {} };
  await A.saveLineup('coins', save, false);
  assert.deepEqual(db.writes.pop(), ['config/lineup/coins', null], 'as the defaults: nothing kept');
  type(el => el.dataset.lublurb === 'coins', { value: '  Flip   them all.  ' }); type(el => el.dataset.luls === 'coins', { value: '2' });
  await A.saveLineup('coins', save, false);
  assert.deepEqual(db.writes.pop(), ['config/lineup/coins', { blurb: 'Flip them all.', luckSkill: 2 }], 'what differs, tidied');
  assert.equal(db.versions.length, 0, 'display text: no settings version');
  app.edits = []; html = draw('#games/coins');
  assert.match(html, /<textarea data-lublurb="coins"[^>]*>Flip them all\.<\/textarea>/); assert.match(html, /badge chg">changed</);
  type(el => el.dataset.lublurb === 'coins', { value: 'x'.repeat(121) });
  await A.saveLineup('coins', save, false);
  assert.equal(db.writes.length, 0, 'too long: nothing written');
  app.edits = [];
  await A.saveLineup('coins', { dataset: { lureset: 'coins' }, tagName: 'BUTTON', disabled: false, closest: () => null, insertAdjacentElement() {} }, true);
  assert.deepEqual(db.writes.pop(), ['config/lineup/coins', null]); assert.equal(A.ctl.lineup.coins, undefined);
});
test('Remove from rotation: a date everywhere and one for iOS on a game\'s Release card, saved to releases/retire and cleared; badges and the Scheduled removals list on Games', async () => {
  await A.loadMetas();
  const db = mockDb(); A.fb = db.fb;
  A.ctl = Object.assign(ctl0(), { releases: { retire: { all: { war: '2020-01-02' }, ios: { claw: '2999-03-04' } } } });
  let html = draw('#games/war');
  assert.match(html, /<h3>Remove from rotation<\/h3>/);
  assert.match(html, /<span>Everywhere \(out\)<\/span><input type="date" data-retire="all" data-rt="war" value="2020-01-02">/, 'a day passed: out of rotation');
  assert.match(html, /data-retclear="war" data-p="all"/, 'a Clear beside a date set');
  assert.match(html, /data-retire="ios" data-rt="war" value="">/); assert.doesNotMatch(html, /data-retclear="war" data-p="ios"/);
  const list = draw('#games');
  assert.ok(list.indexOf('id="retireCard"') > 0 && list.indexOf('id="retireCard"') < list.indexOf('id="gamesCard"'), 'the scheduled removals above the list');
  assert.deepEqual([...list.matchAll(/<tr><td><a href="#games\/(\w+)">/g)].map(m => m[1]).filter(t => ['war', 'claw'].includes(t)), ['war', 'claw'], 'soonest first');
  assert.match(list, /href="#games\/war">[\s\S]*?Out of rotation/); assert.match(list, /href="#games\/claw">[^<]*<\/a><\/td><td>iOS<\/td><td>2999-03-04<\/td><td><span class="badge soon">Scheduled/);
  const row = t => (list.match(new RegExp(`<li><a class="grow" href="#games/${t}"[\\s\\S]*?</a></li>`)) || [''])[0];
  assert.match(row('war'), /badge ret">Retired</); assert.match(row('claw'), /badge ret">Leaves Mar 4 on iOS</);
  // a day picked: written; Clear: removed
  await A.saveRetire({ dataset: { retire: 'ios', rt: 'ttt' }, value: '2999-12-31', closest: () => null, insertAdjacentElement() {} }, false);
  assert.deepEqual(db.writes.pop(), ['releases/retire/ios/ttt', '2999-12-31']);
  assert.equal(A.ctl.releases.retire.ios.ttt, '2999-12-31');
  await A.saveRetire({ dataset: { retclear: 'war', p: 'all' }, closest: () => null, insertAdjacentElement() {} }, true);
  assert.deepEqual(db.writes.pop(), ['releases/retire/all/war', null]);
  assert.equal(A.ctl.releases.retire.all.war, undefined);
  await A.saveRetire({ dataset: { retire: 'all', rt: 'ttt' }, value: '', closest: () => null, insertAdjacentElement() {} }, false);
  assert.equal(db.writes.length, 0, 'no day: nothing written');
  assert.doesNotMatch(draw('#games'), /href="#games\/war">[^<]*<\/a><\/td>/, 'cleared: off the list');
});
test('Matches: "Why matches end early" with its tables and the export for analysis', () => {
  A.ctl = ctl0();
  const html = draw('#matches');
  assert.match(html, /id="abandonCard"><h2>Why matches end early/);
  for (const id of ['abWhy', 'abMode', 'abGame', 'abPos', 'abStage']) assert.match(html, new RegExp(`data-t(?:able|id)?="${id}"|id="${id}"|"${id}"`), id);
  assert.match(html, /data-abexport="1"/);
  assert.ok(html.indexOf('id="abandonCard"') < html.lastIndexOf('<h2>Every match</h2>'), 'above the list of every match');
});
