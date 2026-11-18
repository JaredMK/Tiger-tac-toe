'use strict';
// Builds the site Firebase Hosting serves (_site/): the page and its modules as they are (no build step), the
// admin page, the Trivia questions and Matter.js's fallback copy, with
//   - the version in the match logs stamped in (src/ui/config.js APP_VERSION: this commit),
//   - version.json ({ sha, env, built }): what is live where (scripts/check-envs.js reads it),
//   - the link-preview image, home-screen icon and favicons (assets/share, made by scripts/make-share-images.js),
//   - once the iOS app has its ids (scripts/app-config.js): /.well-known/apple-app-site-association, its Universal Links,
//   - staging only: a noindex meta tag on every page and a robots.txt that keeps crawlers out, and the preview tags
//     pointing at staging's own address (its image is served there before a release puts it on production).
// Which environment: the argument, or the project being deployed (firebase.json's predeploy runs this with
// GCLOUD_PROJECT set): the production project is production, anything else is staging.
//   node scripts/build-site.js [production|staging]
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..'), OUT_SITE = path.join(ROOT, '_site');
const PRODUCTION_PROJECT = 'tic-tac-chaos';
function envOf(arg, project) {
  if (arg === 'production' || arg === 'staging') return arg;
  if (arg) throw new Error(`unknown environment "${arg}" (production or staging)`);
  return project === PRODUCTION_PROJECT ? 'production' : 'staging';
}
const NOINDEX = '<meta name="robots" content="noindex, nofollow">';
function noindex(html) { return html.includes(NOINDEX) ? html : html.replace(/<head>\n?/i, m => m + NOINDEX + '\n'); }
// index.html names production's address in its preview tags; staging's build points them at itself.
const PROD_HOST = 'https://tictacchaos.com/', STAGING_HOST = 'https://staging.tictacchaos.com/';
function previewHost(html, env) { return env === 'staging' ? html.replace(/(<meta (?:property|name)="(?:og:url|og:image|twitter:image)" content=")https:\/\/tictacchaos\.com\//g, '$1' + STAGING_HOST) : html; }
// Universal Links (the app, docs/ios-plan.md): which links open the app, once it has its ids (scripts/app-config.js).
function aasa(app) {
  if (!app || !app.teamId || !app.bundleId) return null;
  return { applinks: { details: [{ appIDs: [`${app.teamId}.${app.bundleId}`], components: [{ '/': '/join/*', comment: 'a friend room (net/invite.js)' }, { '/': '/', '?': { room: '?*' }, comment: 'a friend room (the older link)' }, { '/': '/', '?': { play: 'find' }, comment: 'Find Match' }] }] } };
}
// The first load (December 2026; docs/fun-review.md Part 3: about 430 requests and 12 s to the menu on a mid-range phone over
// slow 4G): the page's modules (src/main.js and all it imports) bundled and minified by esbuild into _site/b/, split into
// chunks so each mini-game's view (main.js imports them by name: one chunk each) and the physics loader come in their own
// files, every name carrying its content's hash (served with a year's caching: firebase.json), and the three stylesheets
// joined and minified into one hashed file; index.html points at them. The computer's worker is its own bundle at a fixed
// name beside them (ui/think.js finds it next to its own chunk, b/ai.worker.js, revalidated like the page). src/ stays as it
// was for the admin page; the app's build (scripts/build-app.js) is untouched.
function bundle(OUT) {
  const esbuild = require('esbuild'), B = path.join(OUT, 'b');
  fs.mkdirSync(B, { recursive: true });
  const r = esbuild.buildSync({ entryPoints: [path.join(OUT, 'src', 'main.js')], bundle: true, format: 'esm', splitting: true, minify: true, target: 'es2022',
    outdir: B, entryNames: '[name]-[hash]', chunkNames: 'c-[hash]', metafile: true, logLevel: 'error', legalComments: 'none' });
  esbuild.buildSync({ entryPoints: [path.join(OUT, 'src', 'ui', 'ai.worker.js')], bundle: true, format: 'esm', minify: true, target: 'es2022', outfile: path.join(B, 'ai.worker.js'), logLevel: 'error', legalComments: 'none' });
  const main = Object.keys(r.metafile.outputs).find(f => /\/main-[A-Z0-9]+\.js$/i.test(f) && r.metafile.outputs[f].entryPoint);
  const deps = [main].concat(r.metafile.outputs[main].imports.filter(i => i.kind === 'import-statement').map(i => i.path)).map(f => path.basename(f));
  const sha = b => require('node:crypto').createHash('sha256').update(b).digest('hex').slice(0, 10).toUpperCase();
  const fonts = fs.readFileSync(path.join(OUT, 'src', 'ui', 'fonts.css'), 'utf8').replace(/url\((['"]?)data:font\/woff2;base64,([A-Za-z0-9+/=]+)\1\)/g, (m, q, b64) => {   // each embedded font its own hashed file (font-display: swap): the stylesheet a third the size, the fonts in parallel
    const buf = Buffer.from(b64, 'base64'), name = `f-${sha(buf)}.woff2`;
    fs.writeFileSync(path.join(B, name), buf);
    return `url(${name})`;
  });
  const css = [fonts].concat(['styles.css', 'comic.css'].map(f => fs.readFileSync(path.join(OUT, 'src', 'ui', f), 'utf8'))).join('\n');
  const min = esbuild.transformSync(css, { loader: 'css', minify: true, legalComments: 'none' }).code;
  const hash = sha(min);
  fs.writeFileSync(path.join(B, `app-${hash}.css`), min);
  const idx = path.join(OUT, 'index.html');
  let html = fs.readFileSync(idx, 'utf8');
  const links = /<link rel="stylesheet" href="src\/ui\/fonts\.css">\s*<link rel="stylesheet" href="src\/ui\/styles\.css">\s*<link rel="stylesheet" href="src\/ui\/comic\.css">/;
  if (!links.test(html) || !html.includes('<script type="module" src="src/main.js"></script>')) throw new Error('index.html: the stylesheets or the main module not where the bundle expects them');
  html = html.replace(links, `<link rel="stylesheet" href="b/app-${hash}.css">`).replace('<script type="module" src="src/main.js"></script>', `${deps.map(f => `<link rel="modulepreload" href="b/${f}">`).join('\n')}\n<script type="module" src="b/${path.basename(main)}"></script>`);   // (the entry and every chunk it imports, preloaded together: the big shared chunk starts with the stylesheet, not after the entry)
  fs.writeFileSync(idx, html);
  return { main: path.basename(main), css: `app-${hash}.css`, files: fs.readdirSync(B).length };
}
function robots(env) { return env === 'staging' ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n'; }
function build(env, sha, out) {
  const OUT = out || OUT_SITE;
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT);
  for (const f of ['index.html', 'privacy.html', 'admin.html', 'admin.js', 'trivia.json', 'styles.html']) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));   // (privacy.html: the privacy policy, on both sites and in the app's build)
  fs.cpSync(path.join(ROOT, 'src'), path.join(OUT, 'src'), { recursive: true });
  const matter = path.join(ROOT, 'node_modules', 'matter-js', 'build', 'matter.min.js');
  if (fs.existsSync(matter)) fs.copyFileSync(matter, path.join(OUT, 'matter.min.js'));
  const cfg = path.join(OUT, 'src', 'ui', 'config.js'), src = fs.readFileSync(cfg, 'utf8');
  const stamped = src.replace(/^export const APP_VERSION = 'dev';/m, `export const APP_VERSION = '${sha.slice(0, 7)}';`);
  if (stamped === src) throw new Error('APP_VERSION not found in src/ui/config.js');
  fs.writeFileSync(cfg, stamped);
  if (!process.env.TTC_NO_BUNDLE) bundle(OUT);                   // (TTC_NO_BUNDLE=1: the modules as they are, to measure against) the page's modules and stylesheets bundled, minified and hashed (December 2026: the first load)
  fs.cpSync(path.join(ROOT, 'assets', 'share'), path.join(OUT, 'assets', 'share'), { recursive: true });
  for (const [f, to] of [['favicon.ico', 'favicon.ico'], ['apple-touch-icon.png', 'apple-touch-icon.png']]) fs.copyFileSync(path.join(ROOT, 'assets', 'share', f), path.join(OUT, to));
  if (env === 'staging') fs.writeFileSync(path.join(OUT, 'index.html'), previewHost(fs.readFileSync(path.join(OUT, 'index.html'), 'utf8'), env));
  if (env === 'staging' && fs.existsSync(path.join(ROOT, 'icons.html'))) {   // the app icon options' comparison page (scripts/make-icon-options.js): staging only
    for (const f of ['icons.html', 'icons-patchwork.html']) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
    fs.cpSync(path.join(ROOT, 'assets', 'icon-options'), path.join(OUT, 'assets', 'icon-options'), { recursive: true });
  }
  if (env === 'staging' && fs.existsSync(path.join(ROOT, 'design-review.html'))) {   // the menus' design review (mock-ups beside the live screens): staging only, linked from nowhere
    fs.copyFileSync(path.join(ROOT, 'design-review.html'), path.join(OUT, 'design-review.html'));
    fs.cpSync(path.join(ROOT, 'assets', 'design-review'), path.join(OUT, 'assets', 'design-review'), { recursive: true });
  }
  if (env === 'staging' && fs.existsSync(path.join(ROOT, 'turn-indicator.html'))) {   // the your-turn indicator's mock-ups (December 2026): staging only, linked from nowhere
    fs.copyFileSync(path.join(ROOT, 'turn-indicator.html'), path.join(OUT, 'turn-indicator.html'));
    fs.cpSync(path.join(ROOT, 'assets', 'turn-indicator'), path.join(OUT, 'assets', 'turn-indicator'), { recursive: true });
  }
  if (env === 'staging') for (const f of ['index.html', 'privacy.html', 'admin.html', 'styles.html', 'icons.html', 'icons-patchwork.html', 'design-review.html', 'turn-indicator.html']) { const p = path.join(OUT, f); if (fs.existsSync(p)) fs.writeFileSync(p, noindex(fs.readFileSync(p, 'utf8'))); }
  fs.writeFileSync(path.join(OUT, 'robots.txt'), robots(env));
  const links = aasa(require('./app-config.js'));
  if (links) { fs.mkdirSync(path.join(OUT, '.well-known'), { recursive: true }); fs.writeFileSync(path.join(OUT, '.well-known', 'apple-app-site-association'), JSON.stringify(links) + '\n'); }
  fs.writeFileSync(path.join(OUT, 'version.json'), JSON.stringify({ sha, env, built: new Date().toISOString() }) + '\n');
  return OUT;
}
module.exports = { envOf, noindex, previewHost, robots, aasa, build, bundle, PRODUCTION_PROJECT };
if (require.main === module) {
  const env = envOf(process.argv[2], process.env.GCLOUD_PROJECT);
  let sha = process.env.GITHUB_SHA || '';
  if (!sha) try { sha = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch (e) { sha = 'unknown'; }
  build(env, sha);
  console.log(`Built _site/ for ${env} at ${sha.slice(0, 7)}.`);
}
