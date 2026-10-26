'use strict';
// The privacy policy (privacy.html, App Store guideline 5.1.1): a plain page at the site's root, in every build (both sites,
// staging with noindex, and the app's web files), saying what is kept, why, for how long, how to delete an account, who
// processes it, the age line and a contact; and the game links to it (the main menu, the login screen, the credits) through
// net/platform.js, a relative link on the web and the live site's page in the app.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const site = require('../../scripts/build-site.js');
const { buildApp } = require('../../scripts/build-app.js');
const ROOT = path.join(__dirname, '..', '..');
const read = p => fs.readFileSync(p, 'utf8');
const html = read(path.join(ROOT, 'privacy.html'));

test('privacy: the page says what is collected and why, how long it is kept, how to delete, who else sees it, the age line and a contact; marked a dated draft', () => {
  assert.match(html, /DRAFT — for review · \d{1,2} \w+ 20\d\d/, 'a draft, with its date');
  for (const h of ['What we collect', 'How long we keep it', 'Deleting your account', 'Who else sees it', 'Children', 'Contact']) assert.match(html, new RegExp(`<h2>${h}</h2>`), h);
  for (const what of ['email', 'username', 'Game records and history', 'Top opponents', 'random device id', 'Match logs', 'tester tag']) assert.match(html, new RegExp(what), what);
  assert.match(html, /Match logs:<\/b> 30 days/); assert.match(html, /90 days/); assert.match(html, /until you delete the account/);
  assert.match(html, /<b>Delete account<\/b>/, 'the in-app button'); assert.match(html, /mailto:privacy@tictacchaos\.com/, 'the contact (a placeholder for the owner to confirm)');
  assert.match(html, /Firebase<\/b> \(Google LLC\)/); assert.match(html, /Open Trivia Database/); assert.match(html, /aged 13 and over/);
  assert.match(html, /placeholder/, 'the owner is told what to confirm');
  assert.doesNotMatch(html, /<script/, 'no scripts: the CSP needs nothing for it');
  assert.match(html, /<link rel="stylesheet" href="src\/ui\/fonts\.css">/, "the game's fonts");
});

test('privacy: both site builds carry the page (staging with noindex); the app build keeps it beside the game, with no admin page', async () => {
  const out = site.build('staging', 'abc1234567');
  assert.match(read(path.join(out, 'privacy.html')), /noindex/);
  site.build('production', 'abc1234567');
  assert.doesNotMatch(read(path.join(out, 'privacy.html')), /noindex/);
  assert.equal(read(path.join(out, 'privacy.html')), html, 'as it is');
  const app = await buildApp('production', 'abc1234567', { noSdk: true });
  assert.ok(fs.existsSync(path.join(app.out, 'privacy.html')), 'in the app');
  assert.ok(!fs.existsSync(path.join(app.out, 'admin.html')), 'no admin page in the app');
});

test('privacy: linked from the main menu, the login screen and the credits, through the platform (privacyUrl)', () => {
  for (const f of ['src/ui/screens/menu.js', 'src/ui/screens/account.js', 'src/ui/explainer.js']) assert.match(read(path.join(ROOT, f)), /privacyUrl\(\)/, f);
  assert.match(read(path.join(ROOT, 'src/net/platform.js')), /export function privacyUrl\(\) \{ return NATIVE \? siteUrl\(\) \+ 'privacy\.html' : 'privacy\.html'; \}/);
});
