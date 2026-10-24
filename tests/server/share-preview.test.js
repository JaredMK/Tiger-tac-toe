'use strict';
// Link previews: the page's Open Graph and Twitter tags, the 1200x630 image they name, the home-screen icon and
// the favicons; staging's build points the tags at staging and keeps noindex.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const site = require('../../scripts/build-site.js');
const ROOT = path.join(__dirname, '..', '..');
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const meta = (html, key) => { const m = new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html); return m && m[1]; };
const png = f => { const b = fs.readFileSync(path.join(ROOT, 'assets', 'share', f)); assert.equal(b.toString('latin1', 1, 4), 'PNG', f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

test('share: the page carries its Open Graph and Twitter tags, with an absolute image on the production address', () => {
  assert.equal(meta(index, 'og:title'), 'Tic Tac Chaos');
  assert.equal(meta(index, 'og:description'), 'Tic-tac-toe, but every square is a mini-game. Play free with friends or online.');
  assert.equal(meta(index, 'og:type'), 'website');
  assert.equal(meta(index, 'og:url'), 'https://tictacchaos.com/');
  assert.equal(meta(index, 'og:image'), 'https://tictacchaos.com/assets/share/og-image.png');
  assert.equal(meta(index, 'og:image:width'), '1200'); assert.equal(meta(index, 'og:image:height'), '630');
  assert.equal(meta(index, 'twitter:card'), 'summary_large_image');
  for (const k of ['twitter:title', 'twitter:description', 'twitter:image']) assert.equal(meta(index, k), meta(index, k.replace('twitter:', 'og:')), k);
  assert.match(index, /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png">/);
  assert.match(index, /<link rel="icon" href="\/favicon\.ico"/);
});

test('share: the image files are the sizes the tags say', () => {
  assert.deepEqual(png('og-image.png'), { w: 1200, h: 630 });
  assert.deepEqual(png('apple-touch-icon.png'), { w: 180, h: 180 });
  assert.deepEqual(png('favicon-32.png'), { w: 32, h: 32 }); assert.deepEqual(png('favicon-16.png'), { w: 16, h: 16 });
  assert.ok(fs.statSync(path.join(ROOT, 'assets', 'share', 'og-image.png')).size < 600 * 1024, 'small enough for every app (WhatsApp asks for under 600 KB)');
});

test('share: staging points the preview tags at staging; production keeps its own address; both builds carry the files', () => {
  const st = site.previewHost(index, 'staging');
  for (const k of ['og:url', 'og:image', 'twitter:image']) assert.match(meta(st, k), /^https:\/\/staging\.tictacchaos\.com\//, k);
  assert.equal(site.previewHost(index, 'production'), index);
  const out = site.build('staging', 'abc1234567');
  const built = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(built, /noindex/); assert.equal(meta(built, 'og:image'), 'https://staging.tictacchaos.com/assets/share/og-image.png');
  for (const f of ['assets/share/og-image.png', 'favicon.ico', 'apple-touch-icon.png']) assert.ok(fs.existsSync(path.join(out, f)), f);
  site.build('production', 'abc1234567');
  const prod = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.doesNotMatch(prod, /noindex/); assert.equal(meta(prod, 'og:image'), 'https://tictacchaos.com/assets/share/og-image.png');
});
