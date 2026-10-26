'use strict';
// The iOS app's web files (docs/ios-plan.md): the same build as the site (scripts/build-site.js), into _app/ for Capacitor's
// webDir, with what a page served from inside the app needs and a page on the web does not:
//   - <meta name="ttc-env">: the Firebase project (src/env.js: the app's own address, capacitor://localhost, cannot say),
//   - the Firebase SDK copied in (vendor/firebase/, <meta name="ttc-sdk">: src/net/connect.js), so the app runs its own copy of
//     every script and starts offline (Play Computer, Same phone) the same as online; its files import each other from the
//     copy rather than from Google's CDN,
//   - no admin page, robots.txt or version.json (the app is no site).
// Never run by the deploys; run on the Mac (or the cloud build) before `npx cap sync ios`.
//   node scripts/build-app.js [production|staging] [--no-sdk]     (production by default; --no-sdk: the CDN, for a quick try)
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { build, envOf } = require('./build-site.js');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, '_app');
const SDK = ['firebase-app.js', 'firebase-database.js', 'firebase-auth.js', 'firebase-functions.js', 'firebase-app-check.js'];
function versionOfSdk() {
  const m = fs.readFileSync(path.join(ROOT, 'src', 'net', 'connect.js'), 'utf8').match(/FIREBASE_VERSION = '([\d.]+)'/);
  if (!m) throw new Error('FIREBASE_VERSION not found in src/net/connect.js');
  return m[1];
}
// The page's head with the app's own tags (after <head>, before src/env.js reads them).
function appHead(html, env, sdk) {
  const tags = [`<meta name="ttc-env" content="${env}">`].concat(sdk ? ['<meta name="ttc-sdk" content="vendor/firebase/">'] : []);
  return html.replace(/<head>\n?/i, m => m + tags.join('\n') + '\n');
}
// A CDN file, its imports of its sister files pointed at the copy next to it.
const localImports = (code, base) => code.split(base).join('./');
async function vendorSdk(dir) {
  const v = versionOfSdk(), base = `https://www.gstatic.com/firebasejs/${v}/`;
  fs.mkdirSync(dir, { recursive: true });
  for (const f of SDK) {
    const r = await fetch(base + f);
    if (!r.ok) throw new Error(`${base + f}: HTTP ${r.status}`);
    fs.writeFileSync(path.join(dir, f), localImports(await r.text(), base));
  }
  return v;
}
async function buildApp(env, sha, opts) {
  build(env, sha, OUT);
  for (const f of ['admin.html', 'admin.js', 'playtest.js', 'styles.html', 'robots.txt', 'version.json']) fs.rmSync(path.join(OUT, f), { force: true });
  fs.rmSync(path.join(OUT, '.well-known'), { recursive: true, force: true });
  const sdk = !(opts && opts.noSdk);
  const v = sdk ? await vendorSdk(path.join(OUT, 'vendor', 'firebase')) : null;
  const p = path.join(OUT, 'index.html');
  fs.writeFileSync(p, appHead(fs.readFileSync(p, 'utf8'), env, sdk));
  return { out: OUT, sdk: v };
}
module.exports = { appHead, localImports, buildApp, SDK };
if (require.main === module) {
  const args = process.argv.slice(2), env = envOf(args.find(a => !a.startsWith('--')) || 'production');
  let sha = process.env.GITHUB_SHA || '';
  if (!sha) try { sha = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch (e) { sha = 'unknown'; }
  buildApp(env, sha, { noSdk: args.includes('--no-sdk') }).then(r => console.log(`Built _app/ for ${env} at ${sha.slice(0, 7)}${r.sdk ? ` with Firebase ${r.sdk}` : ' (the SDK from the CDN)'}.`))
    .catch(e => { console.error('Could not build the app: ' + e.message); process.exit(1); });
}
