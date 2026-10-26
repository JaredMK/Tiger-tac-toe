'use strict';
// The iOS app's build pieces (scripts/build-site.js aasa, scripts/build-app.js): Universal Links only once the app has its
// ids, the app's page naming its Firebase project and its own SDK copy, the SDK's files importing each other from the copy.
const test = require('node:test');
const assert = require('node:assert/strict');
const { aasa } = require('../../scripts/build-site.js');
const { appHead, localImports, SDK } = require('../../scripts/build-app.js');
const app = require('../../scripts/app-config.js');

test('Universal Links: nothing published until the app has its Team ID and bundle ID; then the join and Find Match links', () => {
  assert.equal(aasa({ teamId: '', bundleId: '' }), null);
  assert.equal(aasa({ teamId: 'A1B2C3D4E5', bundleId: '' }), null);
  if (!app.teamId || !app.bundleId) assert.equal(aasa(app), null, 'scripts/app-config.js: not set yet');
  const a = aasa({ teamId: 'A1B2C3D4E5', bundleId: 'com.example.ttc' });
  assert.deepEqual(a.applinks.details[0].appIDs, ['A1B2C3D4E5.com.example.ttc']);
  assert.deepEqual(a.applinks.details[0].components.map(c => c['?']), [{ room: '?*' }, { play: 'find' }]);
});
test('the app\'s page: its Firebase project and its own SDK named first in the head', () => {
  const html = '<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n</head>';
  const out = appHead(html, 'production', true);
  assert.match(out, /<head>\n<meta name="ttc-env" content="production">\n<meta name="ttc-sdk" content="vendor\/firebase\/">\n<meta charset/);
  assert.doesNotMatch(appHead(html, 'staging', false), /ttc-sdk/, '--no-sdk: the CDN');
  assert.deepEqual(SDK.filter(f => !/^firebase-[a-z-]+\.js$/.test(f)), []);
});
test('the SDK copy: its files import their sister files from the copy, not from the CDN', () => {
  const base = 'https://www.gstatic.com/firebasejs/11.10.0/';
  assert.equal(localImports(`import{a}from"${base}firebase-app.js";export*from"${base}firebase-app.js"`, base), 'import{a}from"./firebase-app.js";export*from"./firebase-app.js"');
});
