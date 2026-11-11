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

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------- the stand-in page: #app's HTML, and the controls in it as elements with a value ----------
const unesc = s => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attrs = tag => { const o = {}; for (const m of tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) if (m.index > 0 || !/^(input|select|option|button)$/.test(m[1])) o[m[1]] = m[2] === undefined ? '' : unesc(m[2]); return o; };
const camel = k => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function elements(html) {   // every <input>, <select> and <button>: { tagName, type, dataset, value, checked, min, max, disabled }
  const out = [];
  for (const m of html.matchAll(/<input\b([^>]*)>|<(select|button)\b([^>]*)>([\s\S]*?)<\/\2>/g)) {
    const tag = m[2] || 'input', a = attrs(m[2] ? m[3] : m[1]), el = { tagName: tag.toUpperCase(), type: a.type || (tag === 'select' ? 'select-one' : tag === 'button' ? 'submit' : 'text'), dataset: {}, min: a.min || '', max: a.max || '', disabled: 'disabled' in a, checked: 'checked' in a, id: a.id || '', className: a.class || '', value: a.value || '' };
    for (const k of Object.keys(a)) if (k.startsWith('data-')) el.dataset[camel(k.slice(5))] = a[k];
    if (tag === 'select') {
      const opts = [...(m[4] || '').matchAll(/<option\b([^>]*)>/g)].map(x => attrs(x[1]));
      const sel = opts.find(o => 'selected' in o) || opts[0];
      el.value = sel ? sel.value : '';
    }
    el.closest = () => null; el.insertAdjacentElement = () => {}; el.classList = { add() {} }; el.matches = () => false;
    out.push(el);
  }
  return out;
}
// A selector as the page uses them: tag? [data-x], [data-x="v"], [data-x^="v"], #id, .class; a comma joins alternatives.
function matches(el, sel) {
  return sel.split(',').some(one => {
    one = one.trim();
    const tag = (one.match(/^(input|select|button)/) || [])[1];
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
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.sessionStorage = {};
globalThis.CSS = { escape: s => s };
globalThis.confirm = () => true;
globalThis.TTC_ENV = { config: {}, staging: false };
globalThis.TTT_FIREBASE = { offline: true };
globalThis.scrollTo = () => {};
for (const f of ['playtest.js', 'admin.js']) new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: path.join(ROOT, f), importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER }).runInThisContext();
const A = window.TTC_ADMIN;
assert.ok(A, 'admin.js offers its parts to the tests when the Firebase hook says offline');
await A.loadMetas();
const E = await import('../../src/games/index.js');
const { RACE_TYPES } = await import('../../src/core/race.js');

// The database stood in for: every write recorded; a read answers what was written, else what the test seeded.
function mockDb(seed = {}) {
  const store = Object.assign({}, seed), writes = [];
  const dbM = { ref: (db, p) => p, set: async (p, v) => { writes.push([p, v]); if (v === null) delete store[p]; else store[p] = v; }, get: async p => ({ val: () => (p in store ? store[p] : null) }), query: p => p, orderByChild: () => null, limitToLast: () => null, startAt: () => null };
  return { fb: { dbM, db: null, fnM: {}, fns: null }, writes, store };
}
const ctl0 = () => ({ config: {}, secretsSet: {}, bots: {}, botStats: {}, alertStats: {}, features: {}, releases: {}, runCfg: {}, bullsCfg: {}, wheelsCfg: {}, plinkoCfg: {}, pigCfg: {}, roadsCfg: {}, oddCfg: {}, attCfg: { headcount: {}, flash: {}, snapshot: {} }, fingCfg: { skyhop: {}, scoop: {}, bowling: {}, pinball: {} }, alertLog: [], tune: {}, ai: {}, anim: {}, timer: {}, clients: {}, allow: {} });
const draw = hash => { location.hash = hash; app.edits = []; A.draw(); return app.innerHTML; };
const btn = t => ({ dataset: { tunereset: t }, tagName: 'BUTTON', disabled: false, closest: () => null, insertAdjacentElement() {} });

test('the Games list: every mini-game once, alphabetical, with its icon, category, release badges, the Race badge and the changed marker; Platforms and Pace on top', () => {
  A.ready({});
  A.ctl = Object.assign(ctl0(), { tune: { wordle: { mode: 'race' }, pig: { target: 60 } }, releases: { hex: true, pig: false, platform: { ios: { c4: false } } }, pigCfg: { sides: 6, target: 51 }, clients: { ios: '1.2.0' } });
  const html = draw('#games');
  for (const t of E.TYPES) assert.equal((html.match(new RegExp(`href="#games/${t}"`, 'g')) || []).length, 1, `${t} listed once`);
  assert.equal((html.match(/href="#games\//g) || []).length, E.TYPES.length, 'the pool and nothing else (the retired games are not listed)');
  const names = [...html.matchAll(/class="grow" href="#games\/(\w+)"/g)].map(m => E.GAMES[m[1]].meta.info.name);
  assert.deepEqual(names, names.slice().sort((a, b) => a.localeCompare(b)), 'alphabetical by the shown name');
  const row = t => (html.match(new RegExp(`<li><a class="grow" href="#games/${t}"[\\s\\S]*?</a></li>`)) || [''])[0];
  assert.match(row('ttt'), /class="gico"[^>]*><svg/, 'the icon');
  assert.match(row('ttt'), /Brain · 1 setting</, 'the category and the settings count');
  assert.match(row('ttt'), /badge rel">Released</); assert.doesNotMatch(row('ttt'), /badge chg/);
  assert.match(row('hex'), /badge rel">Released</, 'released in the database although admin only in the code');
  assert.match(row('pig'), /badge adm">Admin only</, 'un-released in the database'); assert.match(row('pig'), /badge chg">changed</, 'a TUNE value saved');
  assert.match(row('dash'), /badge adm">Admin only</); assert.doesNotMatch(row('dash'), /badge chg/);
  assert.match(row('c4'), /badge ios">iOS off</); assert.doesNotMatch(row('ttt'), /badge ios/);
  assert.match(row('wordle'), /badge race">Race</); assert.match(row('wordle'), /badge chg/, 'the mode is a saved setting');
  assert.doesNotMatch(row('hangman'), /badge race/, 'a race game in Shared: no badge');
  assert.doesNotMatch(row('ttt'), /badge race/);
  assert.match(html, /id="clientsCard"/, 'the Clients card'); assert.match(html, /data-clientmin="ios" value="1.2.0"/);
  assert.match(html, /id="scCard"[\s\S]*data-rel="superchaos"/, 'the Super Chaos switch'); assert.match(html, /SUPER_CHAOS_ENABLED/);
  assert.match(html, /id="animCard"><h2>Pace<\/h2>/, 'the Pace card (the Animation figures)');
  assert.ok(html.indexOf('id="clientsCard"') < html.indexOf('id="gamesCard"'), 'Platforms above the list');
  assert.doesNotMatch(html, /Mini-game Settings|href="#settings|href="#releases/, 'no trace of the old pages');
});
test('the tuning card\'s stored values count as changed', () => {
  A.ctl = Object.assign(ctl0(), { pigCfg: { sides: 6, target: 51 } });
  assert.equal(A.gameChanged('pig'), true);
  A.ctl = Object.assign(ctl0(), { pigCfg: { sides: 8, target: 51 } });
  assert.equal(A.gameChanged('pig'), false, 'stored as the defaults: not changed');
  A.ctl = Object.assign(ctl0(), { runCfg: { dash: { target: 550, v0: 13, ramp: 3, gapMin: 18, gapMax: 32, mix: { rock: 30, crate: 20, spike: 20, flyer: 20, pair: 11 } } } });
  assert.equal(A.gameChanged('dash'), true, 'a mix weight off the default');
});
test('the menu has the Games tile and no Mini-game Settings or Releases tile', () => {
  A.ctl = ctl0();
  const html = draw('');
  assert.match(html, /href="#games"><b>Games<\/b>/);
  assert.doesNotMatch(html, /href="#settings"|href="#releases"/);
  assert.match(html, /mini-games · \d+ released/);
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
  assert.match(html, /data-rel="pig">[\s\S]*?>Admin only</); assert.match(html, /data-relios="pig">[\s\S]*?>iOS off</);
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
test('the old hashes open the new pages: #settings and #releases the list, #settings/<type> the game\'s page', () => {
  A.ctl = ctl0();
  replaced.length = 0;
  location.hash = '#settings'; assert.deepEqual(A.route(), ['games']); assert.deepEqual(replaced, ['#games']);
  location.hash = '#settings/pig'; assert.deepEqual(A.route(), ['games', 'pig']); assert.equal(replaced.at(-1), '#games/pig');
  location.hash = '#releases'; assert.deepEqual(A.route(), ['games']); assert.equal(replaced.at(-1), '#games');
  location.hash = '#bots'; assert.deepEqual(A.route(), ['bots']); assert.equal(replaced.length, 3, 'another page: nothing rewritten');
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
  await A.resetGame('pig', btn('pig'));
  assert.deepEqual(db.writes, [], 'not confirmed: nothing written');
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
