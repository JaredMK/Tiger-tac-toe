'use strict';
// The iOS app brought up to date in one step (CLAUDE.md, Updating the iOS app):
//   npm run ios:update -- staging        the staging branch's newest code, talking to staging (the default)
//   npm run ios:update -- production     main's newest code (what was released), talking to production
//   (--staging and --production do the same; --open opens Xcode after; --here builds the files as they are in this folder,
//    no git at all: a change not deployed yet, or another branch)
// The app carries its own copy of the game (bundled, never loaded from a URL), so it stays as old as the code its last build
// was made from. Once that was a local `main` nobody had pulled (November 2026: client 1.2.0, staging at 1.35.0): so this
//   1. fetches, puts this folder on the branch and fast-forwards it (it stops, touching nothing, at changes of your own or at
//      a branch that has gone its own way). The ios/ files every build rewrites (the project's version, the plist's URL
//      scheme) are put back first, else the pull would fail; whatever was in them is kept as a patch (.git/ios-update/),
//   2. npm ci, where the lock file is not the one node_modules was made from,
//   3. scripts/ios-build.js: the web files, the project's settings, cap sync,
//   4. checks the copy inside the Xcode project, file by file, against the build, its commit and its environment.
// Never a release and never a push.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync, execFileSync } = require('node:child_process');
const ROOT = path.join(__dirname, '..');
const BRANCH = { staging: 'staging', production: 'main' };
const { OUT, PUBLIC, CAP_FILES } = require('./ios-web.js');

function parseArgs(args) {
  const known = ['staging', 'production', 'open', 'here'], got = args.map(a => a.replace(/^--/, ''));
  const bad = got.find(a => !known.includes(a));
  if (bad) throw new Error(`unknown option "${bad}" (staging, production, --open, --here)`);
  if (got.includes('staging') && got.includes('production')) throw new Error('staging or production, not both');
  return { env: got.includes('production') ? 'production' : 'staging', open: got.includes('open'), here: got.includes('here') };
}
// The changed files: the ios/ ones a build rewrites, and the rest (someone's work, never touched).
const splitChanges = files => ({ ios: files.filter(f => f.startsWith('ios/')), own: files.filter(f => !f.startsWith('ios/')) });
function tree(dir, base) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? tree(path.join(dir, e.name), path.join(base || '', e.name)) : [path.join(base || '', e.name)]);
}
// What is wrong with the app's copy (pub) of the build (out): [] when it is that build, whole and nothing else.
function copyProblems(out, pub, env, sha) {
  const bad = [];
  if (!fs.existsSync(pub)) return [`${pub} is missing`];
  const a = tree(out), b = tree(pub).filter(f => !CAP_FILES.includes(f)), has = new Set(b), want = new Set(a);
  for (const f of a) {
    if (!has.has(f)) bad.push(`missing: ${f}`);
    else if (!fs.readFileSync(path.join(out, f)).equals(fs.readFileSync(path.join(pub, f)))) bad.push(`not the build's: ${f}`);
  }
  for (const f of b) if (!want.has(f)) bad.push(`left over: ${f}`);
  const read = f => { try { return fs.readFileSync(path.join(pub, f), 'utf8'); } catch (e) { return ''; } };
  if (!read('index.html').includes(`<meta name="ttc-env" content="${env}">`)) bad.push(`index.html does not name ${env}`);
  if (!read('src/ui/config.js').includes(`APP_VERSION = '${sha.slice(0, 7)}'`)) bad.push(`not stamped as ${sha.slice(0, 7)}`);
  return bad;
}

function main() {
  const { env, open, here } = parseArgs(process.argv.slice(2)), branch = BRANCH[env], remote = process.env.DEPLOY_REMOTE || 'origin';
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  const run = cmd => { console.log(`\n$ ${cmd}`); execSync(cmd, { cwd: ROOT, stdio: 'inherit' }); };
  if (!here) {
    console.log(`\n$ git fetch ${remote}`);
    git('fetch', '-q', remote);
    const tip = `${remote}/${branch}`;
    try { git('cat-file', '-e', `${tip}:scripts/ios-update.js`); } catch (e) { throw new Error(`${tip} is from before ios:update: ${env === 'production' ? 'build production after the next release (staging works now: npm run ios:update -- staging)' : 'deploy it to staging first'}.`); }
    const { ios, own } = splitChanges(git('diff', '--name-only', 'HEAD').split('\n').filter(Boolean));
    if (own.length) throw new Error(`this folder has changes of its own:\n  ${own.join('\n  ')}\nDeploy or put them away first, or build the folder as it is with --here. Nothing was touched.`);
    // the branch can only move forward: checked before anything is touched
    let local = null;
    try { local = git('rev-parse', '-q', '--verify', `refs/heads/${branch}`); } catch (e) { /* not here yet: the checkout makes it */ }
    if (local && git('merge-base', local, tip) !== local) throw new Error(`the local ${branch} has commits ${tip} does not (push them, or build the folder as it is with --here). Nothing was touched.`);
    if (ios.length) {
      const dir = path.resolve(ROOT, git('rev-parse', '--git-path', 'ios-update'));
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.patch`);
      fs.writeFileSync(file, execFileSync('git', ['diff', '--binary', 'HEAD', '--', ...ios], { cwd: ROOT, maxBuffer: 1 << 28 }));
      console.log(`The last build's changes in ios/ put back (kept in ${path.relative(ROOT, file)}).`);
      git('checkout', '-q', 'HEAD', '--', ...ios);
    }
    if (git('rev-parse', '--abbrev-ref', 'HEAD') !== branch) git('checkout', '-q', branch);
    git('merge', '-q', '--ff-only', tip);
    console.log(`On ${branch} at ${git('log', '-1', '--format=%h %s').slice(0, 100)}`);
  } else console.log(`Building the folder as it is (${git('rev-parse', '--abbrev-ref', 'HEAD')}): not necessarily what ${env} has.`);
  // the packages the lock file names
  const lock = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'package-lock.json'))).digest('hex'), mark = path.join(ROOT, 'node_modules', '.ttc-lock');
  if (!fs.existsSync(mark) || fs.readFileSync(mark, 'utf8') !== lock) { run('npm ci --no-audit --no-fund'); fs.writeFileSync(mark, lock); }
  run(`node scripts/ios-build.js ${env}`);
  const sha = git('rev-parse', 'HEAD'), bad = copyProblems(OUT, PUBLIC, env, sha);
  if (bad.length) throw new Error(`the copy inside the Xcode project is not this build (${bad.length}; run it again):\n  ${bad.slice(0, 10).join('\n  ')}`);
  const v = fs.readFileSync(path.join(ROOT, 'src', 'core', 'client.js'), 'utf8').match(/CLIENT_VERSION = '([\d.]+)'/)[1];
  console.log(`\nChecked: the Xcode project holds ${env} ${v}, build ${sha.slice(0, 7)}. Now press Run in Xcode; the game's Settings then say "Build ${sha.slice(0, 7)}".`);
  if (open) run('npx cap open ios');
}
module.exports = { parseArgs, splitChanges, copyProblems };
if (require.main === module) try { main(); } catch (e) { console.error(`\nios:update: ${String(e.stderr || '').trim() || e.message}`); process.exit(1); }
