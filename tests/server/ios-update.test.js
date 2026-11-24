'use strict';
// npm run ios:update (scripts/ios-update.js): which environment, whose changes it may put back, and the check that the copy
// inside the Xcode project is the build just made (an old copy there is an old game on the phone: November 2026).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseArgs, splitChanges, copyProblems } = require('../../scripts/ios-update.js');
const { isConflictCopy, dropConflictCopies } = require('../../scripts/build-app.js');

test('the environment: staging unless production is asked for; a word or a flag; anything else is refused', () => {
  assert.deepEqual(parseArgs([]), { env: 'staging', open: false, here: false });
  assert.deepEqual(parseArgs(['production', '--open']), { env: 'production', open: true, here: false });
  assert.equal(parseArgs(['--production']).env, 'production');
  assert.equal(parseArgs(['--staging', '--here']).here, true);
  assert.throws(() => parseArgs(['prod']), /unknown option/);
  assert.throws(() => parseArgs(['staging', 'production']), /not both/);
});
test('only the ios/ files a build rewrites may be put back; the rest is someone\'s work', () => {
  assert.deepEqual(splitChanges(['ios/App/App/Info.plist', 'src/main.js', 'capacitor.config.json']), { ios: ['ios/App/App/Info.plist'], own: ['src/main.js', 'capacitor.config.json'] });
});
test('the copy inside the Xcode project: whole, the build\'s own, its commit and environment', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-ios-')), out = path.join(dir, 'out'), pub = path.join(dir, 'pub');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(out, 'src', 'ui'), { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), '<head>\n<meta name="ttc-env" content="staging">\n</head>');
  fs.writeFileSync(path.join(out, 'src', 'ui', 'config.js'), "export const APP_VERSION = 'abcdef1';");
  assert.equal(copyProblems(out, pub, 'staging', 'abcdef1234').length, 1, 'no copy at all');
  fs.cpSync(out, pub, { recursive: true });
  fs.writeFileSync(path.join(pub, 'cordova.js'), '');
  assert.deepEqual(copyProblems(out, pub, 'staging', 'abcdef1234'), []);
  assert.match(copyProblems(out, pub, 'production', 'abcdef1234').join(), /does not name production/);
  assert.match(copyProblems(out, pub, 'staging', '9999999000').join(), /not stamped as 9999999/);
  fs.writeFileSync(path.join(pub, 'old.js'), '');
  fs.rmSync(path.join(pub, 'index.html'));
  fs.appendFileSync(path.join(pub, 'src', 'ui', 'config.js'), ' ');
  const bad = copyProblems(out, pub, 'staging', 'abcdef1234').join('\n');
  for (const m of [/missing: index\.html/, /not the build's: src.ui.config\.js/, /left over: old\.js/]) assert.match(bad, m);
});
test('iCloud\'s conflict copies never go into the app', t => {
  for (const n of ['client 2.js', 'src 3', 'stale.test 2.mjs', 'icon-1024 2.png']) assert.ok(isConflictCopy(n), n);
  for (const n of ['client.js', 'f-1A2B.woff2', 'AppIcon-512@2x.png', 'src']) assert.ok(!isConflictCopy(n), n);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-ios-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'core')); fs.mkdirSync(path.join(dir, 'src 2'));
  for (const f of ['client.js', 'client 2.js']) fs.writeFileSync(path.join(dir, 'core', f), '');
  dropConflictCopies(dir);
  assert.deepEqual(fs.readdirSync(dir), ['core']); assert.deepEqual(fs.readdirSync(path.join(dir, 'core')), ['client.js']);
});
// No cache can keep an old game: no service worker on any page, nothing loaded from a site, no live-update plugin, and
// the app's own scheme handler answers every file with no-cache.
test('no cache and no URL between the app and its bundled files', () => {
  const root = path.join(__dirname, '..', '..'), cap = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
  assert.equal(cap.server, undefined, 'capacitor.config.json: no server.url');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(d => /live-?update|capgo|appflow|code-?push/i.test(d)), [], 'no live-update plugin');
  const all = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? all(path.join(d, e.name)) : /\.js$/.test(e.name) ? [path.join(d, e.name)] : []);
  for (const f of all(path.join(root, 'src'))) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /serviceWorker|caches\.open/, f);
});
