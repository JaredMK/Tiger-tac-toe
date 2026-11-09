// Game templates (admin only for now): the setup screens' Templates row (src/ui/screens/setup.js templatesRow, tplAct) and
// the account's templates (src/net/accounts.js: templates/{uid}/{id} through the SDK). An admin sees the row, nobody else
// does; Save as template keeps the checklist's selection under a typed name; Use puts a template's selection on the
// checklist, never a game this screen may not deal and never an unknown one; Update saves the checklist back; Rename
// and Delete (asked first) do as they say; every change is written to the account. Rendered in Node with the browser's
// names stubbed and a stand-in SDK that records the writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const C = await import('../../src/net/connect.js');
const A = await import('../../src/net/accounts.js');
const { renderSetup, setupTypes, tpl, tplAct } = await import('../../src/ui/screens/setup.js');
const { SC_ONLY, TYPES } = await import('../../src/games/index.js');
const { state } = await import('../../src/ui/app.js');

const writes = [];                                   // [path, value] as the SDK would get them (null: removed)
C.setFb({ fns: {}, uid: 'adm1', fnM: {}, db: {}, m: { ref: (db, p) => p, set: (p, v) => { writes.push([p, JSON.parse(JSON.stringify(v))]); return Promise.resolve(); }, remove: p => { writes.push([p, null]); return Promise.resolve(); }, onValue: () => () => {}, update: () => Promise.resolve() } });
const board = () => E.newMatch(E.makeRng('tpl'), { games: ['ttt'] });
const cpuSetup = () => { Object.assign(state, board(), { screen: 'setup', online: null }); state.setup.vs = 'cpu'; for (const t of TYPES) state.setup.games[t] = true; };
const on = () => TYPES.filter(t => state.setup.games[t]);

test('the Templates row shows for an admin alone, on Play Computer, the host\'s lobby and Same phone', () => {
  cpuSetup();
  A.acct.user = { uid: 'adm1' }; A.acct.profile = { username: 'adm' }; A.acct.admin = false;
  assert.doesNotMatch(renderSetup(), /Templates|tpl-/, 'nobody but the admin sees a trace of it');
  A.acct.admin = true; A.setTemplates({});
  let html = renderSetup();
  assert.match(html, /<div class="tpls" role="group" aria-label="Templates">/);
  assert.ok(html.indexOf('class="tpls"') < html.indexOf('data-act="adv"'), 'above the Mini-games section');
  assert.match(html, /No templates yet/); assert.match(html, /data-act="tpl-save">Save as template</);
  assert.match(html, /data-act="tpl-use" disabled/); assert.match(html, /data-act="tpl-del" disabled/, 'nothing chosen: Use, Update, Rename and Delete wait');
  state.setup.vs = 'same'; assert.match(renderSetup(), /class="tpls"/, 'Same phone too');
  Object.assign(state, { online: { role: 'host', code: 'ABCDE', me: 'X', joined: false } }); state.setup.names = { X: 'adm', O: 'O' };
  assert.match(renderSetup(), /class="tpls"/, "the host's lobby too");
  state.online = null;
});
test('Save as template: the name typed in place (no browser prompt), the checklist\'s selection kept under it, written to the account', () => {
  cpuSetup(); A.acct.admin = true; A.setTemplates({}); writes.length = 0;
  for (const t of TYPES) state.setup.games[t] = ['ttt', 'c4', 'hilo'].includes(t);
  tplAct('tpl-save');
  let html = renderSetup();
  assert.match(html, /<input id="tplname" aria-label="Template name" maxlength="24"/, 'a field in the bar');
  assert.match(html, /data-act="tpl-ok">Save</); assert.match(html, /data-act="tpl-cancel">Cancel</);
  assert.doesNotMatch(html, /data-act="tpl-use"/, 'the field takes the buttons\' place');
  tpl.draft = '  Quick   ones  '; tplAct('tpl-ok');
  const list = A.templateList();
  assert.equal(list.length, 1); assert.equal(list[0].name, 'Quick ones'); assert.deepEqual(list[0].games, { c4: true, hilo: true, ttt: true });
  assert.equal(tpl.sel, list[0].id, 'the new template is the chosen one'); assert.equal(tpl.mode, null);
  assert.equal(writes.length, 1); assert.equal(writes[0][0], `templates/adm1/${list[0].id}`); assert.deepEqual(writes[0][1].games, { c4: true, hilo: true, ttt: true });
  html = renderSetup();
  assert.match(html, /class="tplrow on" data-act="tpl-pick"[^>]*><b>Quick ones<\/b><small>3 games<\/small>/);
  assert.match(html, /“Quick ones” saved/);
  tplAct('tpl-save'); tpl.draft = '   '; tplAct('tpl-ok');
  assert.equal(A.templateList().length, 1, 'no name, nothing saved'); assert.match(renderSetup(), /Type a name first/);
  tplAct('tpl-cancel'); assert.equal(tpl.mode, null);
  const long = 'x'.repeat(40);
  tplAct('tpl-save'); tpl.draft = long; tplAct('tpl-ok');
  assert.equal(A.templateList().find(t => t.name.startsWith('xxx')).name.length, 24, 'a name is cut to 24 characters');
});
test('Use puts the template\'s selection on the checklist, never a game this screen may not deal nor an unknown one; Update saves the checklist back', () => {
  cpuSetup(); A.acct.admin = true; writes.length = 0;
  const scOnly = SC_ONLY[0];
  A.setTemplates({ tplA: { name: 'Words', games: { wordle: true, hangman: true, nope: true, [scOnly]: true }, at: 1 }, tplB: { name: 'Brains', games: { ttt: true }, at: 2 } });
  assert.deepEqual(A.templateList().map(t => t.name), ['Brains', 'Words'], 'in order of name');
  assert.ok(!setupTypes().includes(scOnly), 'a Super Chaos only game is not on this checklist');
  tplAct('tpl-pick', { dataset: { id: 'tplA' } }); assert.equal(tpl.sel, 'tplA');
  tplAct('tpl-use');
  assert.deepEqual(on(), ['wordle', 'hangman'].sort((a, b) => TYPES.indexOf(a) - TYPES.indexOf(b)), 'its games on, the unknown and the undealable ones ignored, the rest off');
  assert.match(renderSetup(), /“Words” applied/);
  state.setup.games.c4 = true; state.setup.games.wordle = false;                 // edited: tick and untick
  tplAct('tpl-update');
  assert.deepEqual(A.templates.tplA.games, { c4: true, hangman: true }, 'the checklist as it stands, saved back');
  assert.equal(A.templates.tplA.name, 'Words');
  assert.deepEqual(writes[writes.length - 1][0], 'templates/adm1/tplA'); assert.deepEqual(writes[writes.length - 1][1].games, { c4: true, hangman: true });
  tplAct('tpl-pick', { dataset: { id: 'tplB' } }); tplAct('tpl-use');
  assert.deepEqual(on(), ['ttt']);
  for (const t of TYPES) state.setup.games[t] = false;
  tplAct('tpl-update'); assert.deepEqual(A.templates.tplB.games, { ttt: true }, 'nothing ticked: the template keeps its games'); assert.match(renderSetup(), /Tick at least one mini-game/);
});
test('Rename and Delete (asked first): in place, written to the account; the row\'s shape stays', () => {
  cpuSetup(); A.acct.admin = true; writes.length = 0;
  A.setTemplates({ tplA: { name: 'Words', games: { wordle: true }, at: 1 } });
  tplAct('tpl-pick', { dataset: { id: 'tplA' } });
  tplAct('tpl-rename');
  let html = renderSetup();
  assert.match(html, /<input id="tplname"[^>]*value="Words"/, 'the field starts with the old name'); assert.match(html, /data-act="tpl-ok">Rename</);
  tpl.draft = 'Letters'; tplAct('tpl-ok');
  assert.equal(A.templates.tplA.name, 'Letters'); assert.deepEqual(writes[0], ['templates/adm1/tplA', { name: 'Letters', games: { wordle: true }, at: 1 }]);
  tplAct('tpl-del');
  html = renderSetup();
  assert.match(html, /Delete “Letters”\?/); assert.match(html, /data-act="tpl-cancel">No</); assert.match(html, /data-act="tpl-del-yes">Yes, delete</);
  assert.doesNotMatch(html, /data-act="tpl-use"/);
  tplAct('tpl-cancel'); assert.match(renderSetup(), /data-act="tpl-use"/, 'No: the buttons are back'); assert.ok(A.templates.tplA);
  tplAct('tpl-del'); tplAct('tpl-del-yes');
  assert.equal(A.templates.tplA, undefined); assert.equal(tpl.sel, null);
  assert.deepEqual(writes[writes.length - 1], ['templates/adm1/tplA', null], 'removed from the account');
  assert.match(renderSetup(), /No templates yet/);
});
test('the account\'s templates are read as they may be: a bad entry is dropped, an unknown id too', () => {
  A.setTemplates({ ok12: { name: ' A  name ', games: { ttt: true, c4: false, hilo: 'yes' }, at: 5 }, 'bad id!': { name: 'x', games: { ttt: true }, at: 1 }, noName: { games: { ttt: true } }, xxxx: { name: 'x'.repeat(30), games: {}, at: 1 } });
  assert.deepEqual(Object.keys(A.templates).sort(), ['ok12', 'xxxx']);
  assert.deepEqual(A.templates.ok12, { name: 'A name', games: { ttt: true }, at: 5 }, 'only the games set true');
  assert.equal(A.templates.xxxx.name.length, 24);
  A.setTemplates(null); assert.equal(A.templates, null);
  assert.equal(A.saveTemplate('New', { ttt: true }, null, TYPES) != null, true, 'saving with none read yet starts the list'); A.setTemplates(null);
});
