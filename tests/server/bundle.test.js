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
