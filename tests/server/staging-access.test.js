'use strict';
// Staging's access switch (the admin's Staging access: config/staging/mode, 'open' or 'allowlist'; no value is Allowlist).
//   the server's gate (functions/serverRules.js stagingAllows, from functions/index.js onStaging): Open lets every call through
//   as on production, Allowlist only the admin's or a listed tester's account; the admin's calls keep their own check;
//   staging's database rules (scripts/staging-rules.js, production's with the gate) on the database emulator: with the switch
//   Open an outsider (a signed-in player on no list) does what a production player can, with it on Allowlist (or unset) they
//   are refused, and either way they never read or write the admin's paths, the switch included;
//   the switch is set to Open on staging only, once (scripts/set-releases.js stagingOpen1), and its shape is held.
// The emulator: as tests/server/room-rules.test.js (the database emulator's jar, Java); without it the rules part is skipped.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..', '..');
const R = require('../../functions/serverRules.js');
const { gate, OPEN } = require('../../scripts/staging-rules.js');
const PROD = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'));

test('the server\'s gate: Open lets any caller through (as production); Allowlist only the admin or a listed tester', () => {
  const outsider = { uid: 'u1', email: 'someone@example.com' }, tester = { uid: 'u2', staging: true }, adminT = { uid: 'u3', admin: true };
  assert.equal(R.stagingAllows(outsider, true), true, 'Open: an outsider');
  assert.equal(R.stagingAllows(null, true), true, 'Open: no login at all (the call\'s own checks decide, as on production)');
  assert.equal(R.stagingAllows(outsider, false), false, 'Allowlist: an outsider is blocked');
  assert.equal(R.stagingAllows(null, false), false, 'Allowlist: nobody logged in is blocked');
  assert.equal(R.stagingAllows(tester, false), true, 'Allowlist: a listed tester');
  assert.equal(R.stagingAllows(adminT, false), true, 'Allowlist: the admin');
  const src = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  assert.match(src, /function needAdmin\(req\) \{\s*if \(!req\.auth \|\| !req\.auth\.token \|\| req\.auth\.token\.admin !== true\) throw/, 'the admin\'s calls check the admin\'s claim themselves, Open or not');
  assert.match(src, /config\/staging\/mode/, 'the server reads the switch');
  assert.match(src, /if \(await stagingOpen\(\)\) return \{ ok: true, open: true \}/, 'stagingAccess answers Open for anyone');
});
test('the switch: set Open on staging only, once; its shape held by the rules; never copied to production', () => {
  const sets = fs.readFileSync(path.join(ROOT, 'scripts', 'set-releases.js'), 'utf8');
  assert.match(sets, /\{ id: 'stagingOpen1', path: 'config\/staging\/mode', value: 'open', env: 'staging' \}/);
  assert.match(sets, /if \(env && env !== ENV\) continue;/);
  const st = PROD.rules.config.staging;
  assert.equal(st['.write'], 'auth != null && auth.token.admin === true', 'the admin alone switches it');
  assert.match(st.mode['.validate'], /'open'.*'allowlist'/);
  assert.equal(st.$other['.validate'], false);
  assert.ok(!/config\/staging/.test(fs.readFileSync(path.join(ROOT, 'scripts', 'copy-settings.js'), 'utf8')), 'copy-settings never takes it to production');
  assert.ok(String(gate(PROD).rules.users.$uid['.read'] || '').includes(OPEN), 'staging\'s gate gives way when the switch is Open');
});

// ---- the rules on the database emulator ----
function emulatorJar() {
  if (process.env.FIREBASE_DATABASE_EMULATOR_JAR && fs.existsSync(process.env.FIREBASE_DATABASE_EMULATOR_JAR)) return process.env.FIREBASE_DATABASE_EMULATOR_JAR;
  const dir = path.join(os.homedir(), '.cache', 'firebase', 'emulators');
  if (!fs.existsSync(dir)) return null;
  const jars = fs.readdirSync(dir).filter(f => /^firebase-database-emulator.*\.jar$/.test(f)).sort();
  return jars.length ? path.join(dir, jars[jars.length - 1]) : null;
}
const hasJava = () => { try { return spawnSync('java', ['-version'], { stdio: 'ignore' }).status === 0; } catch (e) { return false; } };
const suite = process.env.FIREBASE_DATABASE_EMULATOR_HOST || null;
const jar = suite ? null : emulatorJar();
if (!suite && !(jar && hasJava())) {
  test(`staging access on the database emulator (skipped: ${jar ? 'Java is not installed' : 'no database emulator jar (firebase setup:emulators:database)'})`, { skip: true }, () => {});
  return;
}
const { initializeApp, deleteApp } = require('firebase/app');
const D = require('firebase/database');
const wait = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const PROJECT = 'ttc-staging-access', NS = `${PROJECT}-default-rtdb`;   // (its own namespace: its own rules, even inside the Emulator Suite)
let HOST = '127.0.0.1', PORT = 0, proc = null;
async function owner(method, p, body) {
  const r = await fetch(`http://${HOST}:${PORT}${p}${p.includes('?') ? '&' : '?'}ns=${NS}`, { method, headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body });
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${await r.text()}`);
  return r.text();
}
const clients = [];
let n = 0;
function client(uid, claims) {
  const app = initializeApp({ apiKey: 'test', projectId: PROJECT, databaseURL: `https://${NS}.firebaseio.com`, appId: '1:1:web:1' }, 'sa' + (++n));
  const db = D.getDatabase(app);
  D.connectDatabaseEmulator(db, HOST, PORT, uid ? { mockUserToken: Object.assign({ sub: uid, user_id: uid }, claims || {}) } : undefined);
  const c = { uid, write: (p, v) => D.set(D.ref(db, p), v), read: async p => (await D.get(D.ref(db, p))).val(), app };
  clients.push(c);
  return c;
}
const denied = (promise, what) => assert.rejects(promise, e => /permission[_ ]denied/i.test(String(e.code || e.message)), `${what} should be refused`);
test.before(async () => {
  if (suite) [HOST, PORT] = [suite.split(':')[0], Number(suite.split(':')[1])];
  else {
    PORT = await freePort();
    proc = spawn('java', ['-jar', jar, '--host', HOST, '--port', String(PORT), '--single_project_mode', 'Warning'], { stdio: 'ignore' });
    const t0 = Date.now();
    while (!(await fetch(`http://${HOST}:${PORT}/.json?ns=${NS}`).then(() => true, () => false))) { if (Date.now() - t0 > 30000) throw new Error('no database emulator'); await wait(100); }
  }
  await owner('PUT', '/.settings/rules.json', JSON.stringify(gate(PROD)));   // staging's rules, as its deploy writes them
});
test.after(async () => { for (const c of clients) await deleteApp(c.app).catch(() => {}); if (proc) proc.kill(); });

const prefs = { sound: 'on' };
async function asOutsider(out) {
  await out.write(`prefs/${out.uid}`, prefs);
  assert.deepEqual(await out.read(`prefs/${out.uid}`), prefs);
}
test('staging rules: Allowlist (unset, then set) blocks an outsider; Open lets them play as on production; the admin\'s paths stay the admin\'s', async () => {
  const out = client('uid-outsider'), tester = client('uid-tester', { staging: true }), boss = client('uid-admin', { admin: true }), guest = client(null);
  await owner('PUT', '/admin/staging/allow/x.json', JSON.stringify({ email: 'x@example.com' }));
  // the switch unset: Allowlist, as before it existed
  await denied(out.write(`prefs/${out.uid}`, prefs), 'an outsider writing their settings (no switch: Allowlist)');
  await denied(out.read(`users/${out.uid}`), 'an outsider reading their account');
  await tester.write(`prefs/${tester.uid}`, prefs);
  assert.equal(await guest.read('config/staging/mode'), null, 'the switch is public to read (the page reads it before a login)');
  // Allowlist set by the admin
  await boss.write('config/staging/mode', 'allowlist');
  await denied(out.write(`prefs/${out.uid}`, prefs), 'an outsider (Allowlist)');
  // Open
  await denied(out.write('config/staging/mode', 'open'), 'an outsider opening staging');
  await denied(boss.write('config/staging/mode', 'wide'), 'a value that is not open or allowlist');
  await boss.write('config/staging/mode', 'open');
  assert.equal(await guest.read('config/staging/mode'), 'open');
  await asOutsider(out);
  assert.equal(await out.read(`users/${out.uid}`), null, 'their own account readable, as on production');
  await denied(out.read(`users/uid-tester`), 'someone else\'s account (production\'s rule still holds)');
  await denied(out.read('admin/staging/allow'), 'the admin\'s list');
  await denied(out.write(`admin/staging/allow/${out.uid}`, { email: 'me@example.com' }), 'adding themselves to the list');
  await denied(out.read('admin/config'), 'the admin\'s settings');
  await denied(out.write('config/staging/mode', 'allowlist'), 'the switch (Open)');
  await denied(out.write('releases/hex', true), 'releasing an Admin only game');
  await denied(out.read('stats'), 'the stats');
  // back to Allowlist: the gate is back at once
  await boss.write('config/staging/mode', 'allowlist');
  await denied(out.write(`prefs/${out.uid}`, prefs), 'an outsider once Allowlist is back');
  await tester.write(`prefs/${tester.uid}`, prefs);
  assert.equal(await boss.read('admin/staging/allow/x/email'), 'x@example.com', 'the list kept through the switching');
});
