'use strict';
// Staging and production: the page's project by address, staging's gated rules, the site build, the deploy
// workflow's triggers, and the staging-only scripts' refusal to touch production.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..', '..');
const { pick, CONFIGS } = require('../../scripts/env-config.js');
const { gate, GATE } = require('../../scripts/staging-rules.js');
const site = require('../../scripts/build-site.js');

test('envs: the page picks production only on production addresses; everything else is staging', () => {
  for (const h of ['tictacchaos.com', 'www.tictacchaos.com', 'tic-tac-chaos.web.app', 'tic-tac-chaos.firebaseapp.com', 'TicTacChaos.com']) assert.equal(pick(h).name, 'production', h);
  for (const h of ['staging.tictacchaos.com', 'localhost', '127.0.0.1', '', 'jaredmk.github.io', 'evil.example', 'tictacchaos.com.evil.example']) {
    const e = pick(h);
    assert.equal(e.name, 'staging', h); assert.equal(e.staging, true);
    assert.notEqual(e.config.projectId, CONFIGS.production.projectId, `${h} never gets production's project`);
  }
  assert.equal(pick('tictacchaos.com').config.authDomain, 'tictacchaos.com', 'sign-in through the page\'s own domain');
  assert.equal(pick('staging.tictacchaos.com').config.authDomain, 'staging.tictacchaos.com');
  assert.equal(pick('tic-tac-chaos.web.app').config.authDomain, 'tic-tac-chaos.firebaseapp.com');
  assert.equal(CONFIGS.production.projectId, site.PRODUCTION_PROJECT);
  const rc = JSON.parse(fs.readFileSync(path.join(ROOT, '.firebaserc'), 'utf8')).projects;
  assert.equal(rc.production, CONFIGS.production.projectId); assert.equal(rc.staging, CONFIGS.staging.projectId, '.firebaserc and src/env.js name the same staging project');
  assert.notEqual(rc.staging, rc.production);
});

test('envs: staging\'s rules gate every grant to testers on the allowlist; public reads stay public; production\'s rules are not gated', () => {
  const prod = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'));
  assert.ok(!JSON.stringify(prod).includes('auth.token.staging'), 'production has no staging gate');
  const st = gate(prod);
  let grants = 0;
  (function walk(a, b, at) {
    for (const k of Object.keys(a)) {
      if (k === '.read' || k === '.write') {
        grants++;
        if (a[k] === false) assert.equal(b[k], false, at + k);
        else if (k === '.read' && a[k] === true) assert.equal(b[k], true, `${at}${k}: public reads stay public`);
        else assert.ok(String(b[k]).startsWith(GATE), `${at}${k} is gated`);
      } else if (a[k] && typeof a[k] === 'object') walk(a[k], b[k], at + k + '/');
      else assert.deepEqual(b[k], a[k], at + k);
    }
  })(prod, st, '/');
  assert.ok(grants > 50, `${grants} grants checked`);
  assert.ok(st.rules.admin.staging.allow.$key['.validate'], 'the allowlist\'s shape is checked');
});

test('envs: the site build: staging is noindex with robots kept out; production is indexable; version.json says which', () => {
  assert.equal(site.envOf(undefined, 'tic-tac-chaos'), 'production');
  assert.equal(site.envOf(undefined, 'anything-else'), 'staging');
  assert.equal(site.envOf('production', 'x'), 'production');
  assert.throws(() => site.envOf('prod'));
  const html = '<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n</head></html>';
  const n = site.noindex(html);
  assert.match(n, /<head>\n<meta name="robots" content="noindex, nofollow">/);
  assert.equal(site.noindex(n), n, 'once');
  assert.match(site.robots('staging'), /Disallow: \//); assert.doesNotMatch(site.robots('production'), /Disallow/);
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(index, /noindex/, 'the source page is indexable: only the staging build adds noindex');
});

test('envs: deploys: staging from the staging branch, production only from main and only a commit staging has', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
  assert.match(wf, /branches: \[staging, main\]/);
  assert.match(wf, /environment: \$\{\{ github\.ref_name == 'main' && 'production' \|\| 'staging' \}\}/);
  assert.match(wf, /main:push\) echo "Deploying to production/);
  assert.match(wf, /\*\) echo "::error::Deploys run only/, 'any other branch or trigger stops');
  assert.match(wf, /merge-base --is-ancestor "\$GITHUB_SHA" origin\/staging/, 'a release takes only what staging has');
  assert.match(wf, /if: env\.TARGET == 'staging'\n\s+run: node scripts\/staging-rules\.js/);
  assert.ok(!fs.existsSync(path.join(ROOT, '.github', 'workflows', 'firebase.yml')), 'the old main-only Firebase workflow is gone');
  assert.ok(!fs.existsSync(path.join(ROOT, 'deploy.sh')), 'deploy.sh is replaced by npm run deploy:staging and npm run release');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
  assert.equal(pkg['deploy:staging'], 'node scripts/deploy-staging.js'); assert.equal(pkg.release, 'node scripts/release.js');
  const fb = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
  assert.equal(fb.hosting.public, '_site'); assert.match(fb.hosting.predeploy[0], /build-site\.js/);
  assert.match(fs.readFileSync(path.join(ROOT, 'functions', '.env.staging'), 'utf8'), /^TTC_ENV=staging$/m);
});

test('envs: the staging seed refuses production', { skip: !fs.existsSync(path.join(ROOT, 'functions', 'node_modules', 'firebase-admin')) && 'functions/node_modules missing' }, () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'seed-staging.js')], { env: Object.assign({}, process.env, { TTC_PROJECT: 'tic-tac-chaos', GOOGLE_APPLICATION_CREDENTIALS: '/nonexistent' }), encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Refusing to seed "tic-tac-chaos"/);
});
