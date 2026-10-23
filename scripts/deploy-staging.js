'use strict';
// npm run deploy:staging -- "what changed"
// Commits every change with that message and pushes it to the `staging` branch: the Deploy workflow tests it and
// deploys the site, functions and rules to staging (https://staging.tictacchaos.com). Never production.
// DEPLOY_REMOTE=<remote> pushes to another remote (default: origin).
const { execSync } = require('node:child_process');
const out = c => execSync(c, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const msg = process.argv.slice(2).join(' ').trim();
const remote = process.env.DEPLOY_REMOTE || 'origin';
try {
  if (!msg) throw new Error('Give a message: npm run deploy:staging -- "what changed"');
  execSync('git add -A', { stdio: 'inherit' });
  if (out('git diff --cached --name-only')) execSync(`git commit -q -m ${JSON.stringify(msg)}`, { stdio: 'inherit' });
  else console.log('Nothing new to commit; pushing what is already committed.');
  try { execSync(`git fetch -q ${remote} staging`, { stdio: 'ignore' }); } catch (e) { /* no staging branch yet: this push makes it */ }
  let theirs = '';
  try { theirs = out(`git rev-parse -q --verify ${remote}/staging`); } catch (e) { /* none */ }
  if (theirs) {
    try { execSync(`git merge-base --is-ancestor ${theirs} HEAD`, { stdio: 'ignore' }); }
    catch (e) { throw new Error(`${remote}/staging has commits this branch does not: merge them first (git merge ${remote}/staging), then deploy again.`); }
  }
  execSync(`git push -q ${remote} HEAD:refs/heads/staging`, { stdio: 'inherit' });
  console.log(`Pushed ${out('git rev-parse --short HEAD')} to ${remote}/staging.`);
  console.log('The Deploy workflow tests it and deploys it to staging in a few minutes: https://staging.tictacchaos.com');
} catch (e) { console.error(e.message); process.exit(1); }
