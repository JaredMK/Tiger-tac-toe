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
  return { applinks: { details: [{ appIDs: [`${app.teamId}.${app.bundleId}`], components: [{ '/': '/', '?': { room: '?*' }, comment: 'a friend room' }, { '/': '/', '?': { play: 'find' }, comment: 'Find Match' }] }] } };
}
function robots(env) { return env === 'staging' ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n'; }
function build(env, sha, out) {
  const OUT = out || OUT_SITE;
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT);
  for (const f of ['index.html', 'admin.html', 'admin.js', 'playtest.js', 'trivia.json', 'styles.html']) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
  fs.cpSync(path.join(ROOT, 'src'), path.join(OUT, 'src'), { recursive: true });
  const matter = path.join(ROOT, 'node_modules', 'matter-js', 'build', 'matter.min.js');
  if (fs.existsSync(matter)) fs.copyFileSync(matter, path.join(OUT, 'matter.min.js'));
  const cfg = path.join(OUT, 'src', 'ui', 'config.js'), src = fs.readFileSync(cfg, 'utf8');
  const stamped = src.replace(/^export const APP_VERSION = 'dev';/m, `export const APP_VERSION = '${sha.slice(0, 7)}';`);
  if (stamped === src) throw new Error('APP_VERSION not found in src/ui/config.js');
  fs.writeFileSync(cfg, stamped);
  fs.cpSync(path.join(ROOT, 'assets', 'share'), path.join(OUT, 'assets', 'share'), { recursive: true });
  for (const [f, to] of [['favicon.ico', 'favicon.ico'], ['apple-touch-icon.png', 'apple-touch-icon.png']]) fs.copyFileSync(path.join(ROOT, 'assets', 'share', f), path.join(OUT, to));
  if (env === 'staging') fs.writeFileSync(path.join(OUT, 'index.html'), previewHost(fs.readFileSync(path.join(OUT, 'index.html'), 'utf8'), env));
  if (env === 'staging') for (const f of ['index.html', 'admin.html', 'styles.html']) { const p = path.join(OUT, f); if (fs.existsSync(p)) fs.writeFileSync(p, noindex(fs.readFileSync(p, 'utf8'))); }
  fs.writeFileSync(path.join(OUT, 'robots.txt'), robots(env));
  const links = aasa(require('./app-config.js'));
  if (links) { fs.mkdirSync(path.join(OUT, '.well-known'), { recursive: true }); fs.writeFileSync(path.join(OUT, '.well-known', 'apple-app-site-association'), JSON.stringify(links) + '\n'); }
  fs.writeFileSync(path.join(OUT, 'version.json'), JSON.stringify({ sha, env, built: new Date().toISOString() }) + '\n');
  return OUT;
}
module.exports = { envOf, noindex, previewHost, robots, aasa, build, PRODUCTION_PROJECT };
if (require.main === module) {
  const env = envOf(process.argv[2], process.env.GCLOUD_PROJECT);
  let sha = process.env.GITHUB_SHA || '';
  if (!sha) try { sha = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch (e) { sha = 'unknown'; }
  build(env, sha);
  console.log(`Built _site/ for ${env} at ${sha.slice(0, 7)}.`);
}
