'use strict';
// Login smoke check for one environment, from outside, with the page's own web key (src/env.js): what the login
// screen needs from Firebase Authentication. Run by the Deploy workflow after every deploy and by the release script.
//   - the authorized domains hold the site's address (and the project's own Firebase addresses),
//   - Google sign-in is on (createAuthUri for google.com answers with Google's sign-in address),
//   - email sign-in is on (a sign-in with a made-up address is refused as wrong credentials, not as switched off),
//   - with STAGING_TEST_PASSWORD on staging: a real email sign-in as tester1@tictacchaos.com (scripts/seed-staging.js),
//   - Apple sign-in: on, or a warning (exit 0) with where to switch it on: docs/login-setup.md. With --require-apple
//     (or TTC_REQUIRE_APPLE=1) Apple being off fails too.
//   node scripts/smoke-login.js staging|production [--require-apple]
// The web popup itself is checked by scripts/smoke-browser.js (Continue with Google reaches Google's sign-in page);
// the iOS app's native sign-in by hand (docs/ios-plan.md, "Login checklist").
const fs = require('node:fs');
const path = require('node:path');

const ENV_JS = fs.readFileSync(path.join(__dirname, '..', 'src', 'env.js'), 'utf8');
function webConfig(env) {
  const m = ENV_JS.match(new RegExp(`${env}: \\{[^}]*?apiKey: '([^']+)'[^}]*?projectId: '([^']+)'`));
  if (!m) throw new Error(`no ${env} config in src/env.js`);
  return { apiKey: m[1], projectId: m[2] };
}
const HOSTS = { production: 'tictacchaos.com', staging: 'staging.tictacchaos.com' };
const IDT = 'https://identitytoolkit.googleapis.com/v1';

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data, error: (data.error && data.error.message) || (r.ok ? null : `HTTP ${r.status}`) };
}
// Is a provider on? createAuthUri answers with the provider's sign-in address, or OPERATION_NOT_ALLOWED when it is off.
async function provider(key, id, host) {
  const r = await post(`${IDT}/accounts:createAuthUri?key=${key}`, { providerId: id, continueUri: `https://${host}/__/auth/handler` });
  return r.ok && r.data.authUri ? { on: true } : { on: false, why: r.error || 'no sign-in address' };
}

async function check(env, requireApple) {
  const { apiKey, projectId } = webConfig(env), host = HOSTS[env];
  const fails = [], warns = [], ok = m => console.log('  ok  ' + m);
  console.log(`Login check: ${env} (${projectId}, ${host})`);

  const proj = await fetch(`${IDT}/projects?key=${apiKey}`).then(r => r.json()).catch(e => ({ error: { message: e.message } }));
  if (proj.error) fails.push(`could not read the project's sign-in settings: ${proj.error.message}`);
  else {
    const have = proj.authorizedDomains || [], want = [host, `${projectId}.firebaseapp.com`];
    const missing = want.filter(d => !have.includes(d));
    if (missing.length) fails.push(`authorized domains lack ${missing.join(', ')} (Authentication → Settings → Authorized domains; scripts/auth-domains.js adds the site's)`);
    else ok(`authorized domains: ${want.join(', ')}`);
  }

  const g = await provider(apiKey, 'google.com', host);
  if (g.on) ok('Google sign-in is on'); else fails.push(`Google sign-in is off or broken: ${g.why}`);

  const a = await provider(apiKey, 'apple.com', host);
  if (a.on) ok('Apple sign-in is on');
  else (requireApple ? fails : warns).push(`Apple sign-in is not set up: ${a.why} (docs/login-setup.md: the Services ID, the key, then Firebase's Apple provider)`);

  const e = await post(`${IDT}/accounts:signInWithPassword?key=${apiKey}`, { email: `login-check-${Date.now()}@example.com`, password: 'not-a-password-1', returnSecureToken: true });
  if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD/.test(e.error || '')) ok('email sign-in is on (a made-up address is refused as wrong credentials)');
  else fails.push(`email sign-in: expected a wrong-credentials refusal, got ${e.error || 'a sign-in'}`);

  const pass = process.env.STAGING_TEST_PASSWORD;
  if (env === 'staging' && pass) {
    const s = await post(`${IDT}/accounts:signInWithPassword?key=${apiKey}`, { email: 'tester1@tictacchaos.com', password: pass, returnSecureToken: true });
    if (s.ok && s.data.idToken) ok('email sign-in as tester1@tictacchaos.com went through');
    else fails.push(`email sign-in as tester1@tictacchaos.com failed: ${s.error}`);
  }

  for (const w of warns) console.log(`::warning::${env}: ${w}`);
  for (const f of fails) console.log(`::error::${env}: ${f}`);
  console.log(fails.length ? `Login check: ${env} FAILED (${fails.length}).` : `Login check: ${env} passed${warns.length ? ` with ${warns.length} warning${warns.length > 1 ? 's' : ''}` : ''}.`);
  return { fails, warns };
}

module.exports = { check, webConfig };
if (require.main === module) {
  const env = process.argv[2], requireApple = process.argv.includes('--require-apple') || process.env.TTC_REQUIRE_APPLE === '1';
  if (!HOSTS[env]) { console.error('usage: node scripts/smoke-login.js staging|production [--require-apple]'); process.exit(2); }
  check(env, requireApple).then(r => process.exit(r.fails.length ? 1 : 0), e => { console.log('::error::login check: ' + e.message); process.exit(1); });
}
