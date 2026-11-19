// The site's first load (scripts/build-site.js bundle, December 2026): the page's modules bundled and minified into
// hashed files under b/ (the entry, its chunks preloaded, one chunk per mini-game view), the stylesheets joined into one
// hashed file with the fonts as their own hashed files, the computer's worker beside them; index.html points at them;
// the hashed files are cached a year (firebase.json), the page and the worker revalidated.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');
const { build } = require('../../scripts/build-site.js');

test('bundled, hashed and cached', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-site-'));
  try {
    build('staging', 'abcdef1234567', out);
    const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8'), B = path.join(out, 'b'), files = fs.readdirSync(B);
    assert.doesNotMatch(html, /src\/main\.js|src\/ui\/styles\.css/, 'the page no longer loads the modules one by one');
    const entry = html.match(/<script type="module" src="b\/(main-[A-Z0-9]+\.js)"><\/script>/);
    assert.ok(entry && files.includes(entry[1]), 'the hashed entry');
    assert.ok((html.match(/rel="modulepreload"/g) || []).length >= 2, 'the entry and its chunks preloaded');
    const css = html.match(/href="b\/(app-[A-Z0-9]+\.css)"/);
    assert.ok(css && files.includes(css[1]));
    const sheet = fs.readFileSync(path.join(B, css[1]), 'utf8');
    assert.doesNotMatch(sheet, /data:font\/woff2/, 'no font inside the stylesheet');
    assert.ok(files.filter(f => /^f-[A-Z0-9]+\.woff2$/.test(f)).length >= 4, 'the fonts as their own files');
    assert.ok(files.includes('ai.worker.js'), "the computer's worker, beside the chunks");
    assert.ok(files.filter(f => /^c-/.test(f)).length > 50, 'a chunk per mini-game view');
    assert.match(fs.readFileSync(path.join(out, 'src', 'ui', 'config.js'), 'utf8'), /APP_VERSION = 'abcdef1'/, 'src/ kept, stamped (the admin page)');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
  const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'firebase.json'), 'utf8'));
  const h = fb.hosting.headers.find(x => x.source === '/b/*-*.@(js|css|woff2)');
  assert.ok(h && /max-age=31536000, immutable/.test(h.headers[0].value), 'the hashed files cached a year');
});

// Earlier builds' hashed files stay 7 days (retainBuilds): the new b/ gets every file of the live manifest still within its
// 7 days, with the day each stopped being current; one past it is dropped; a missing manifest (the first build) keeps nothing.
test('earlier builds are kept 7 days', async () => {
  const { retainBuilds, RETAIN_MS } = require('../../scripts/build-site.js');
  const B = fs.mkdtempSync(path.join(os.tmpdir(), 'ttc-b-')), now = Date.parse('2026-12-10T12:00:00Z'), day = RETAIN_MS / 7;
  try {
    fs.writeFileSync(path.join(B, 'c-NEWNEWNEW1.js'), 'new'); fs.writeFileSync(path.join(B, 'ai.worker.js'), 'w');
    const live = { 'c-OLDONEAAAA.js': 'old1', 'c-OLDTWOBBBB.js': 'old2', 'c-NEWNEWNEW1.js': 'new' };
    const manifest = { files: { 'c-OLDONEAAAA.js': { out: new Date(now - 6 * day).toISOString() }, 'c-OLDTWOBBBB.js': { out: new Date(now - 8 * day).toISOString() }, 'c-LIVENOWCCC.js': { out: null }, 'c-NEWNEWNEW1.js': { out: null } } };
    const get = async u => { const f = u.split('/b/')[1]; if (f === 'manifest.json') return Buffer.from(JSON.stringify(manifest)); if (live[f] || f === 'c-LIVENOWCCC.js') return Buffer.from(live[f] || 'cur'); throw new Error('404'); };
    const r = await retainBuilds(B, 'https://x.test', get, now);
    assert.deepEqual(r.kept.sort(), ['c-LIVENOWCCC.js', 'c-OLDONEAAAA.js'], 'the one inside 7 days and the one the live build used; the one past 7 days dropped');
    assert.ok(!fs.existsSync(path.join(B, 'c-OLDTWOBBBB.js')));
    const m = JSON.parse(fs.readFileSync(path.join(B, 'manifest.json'), 'utf8')).files;
    assert.equal(m['c-NEWNEWNEW1.js'].out, null); assert.equal(m['c-LIVENOWCCC.js'].out, new Date(now).toISOString(), "a file no longer current: its 7 days start with this build");
    assert.equal(m['c-OLDONEAAAA.js'].out, new Date(now - 6 * day).toISOString(), 'a kept file keeps its day');
    assert.ok(!('ai.worker.js' in m), 'the fixed-name worker is not a hashed file');
    const none = await retainBuilds(B, 'https://x.test', async () => { throw new Error('404'); }, now);
    assert.deepEqual(none.kept, [], 'no manifest: nothing kept');
  } finally { fs.rmSync(B, { recursive: true, force: true }); }
});
