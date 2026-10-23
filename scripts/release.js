'use strict';
// npm run release
// Puts what is on staging live on production (https://tictacchaos.com), by moving main to staging's tip (a
// fast-forward merge of staging into main): the Deploy workflow then deploys exactly that commit to production.
// Before asking, it checks that
//   - main is behind staging only (production never has a commit staging lacks),
//   - this checkout is at staging's tip and clean, and the unit tests pass here (npm test),
//   - the staging deploy of that commit went through (its Deploy run on GitHub: tests, deploy, live check).
// Then it lists what goes out and asks you to type "release". Nothing else ever deploys to production.
// DEPLOY_REMOTE=<remote> uses another remote (default: origin).
const { execSync, spawnSync } = require('node:child_process');
const readline = require('node:readline');
const out = c => execSync(c, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
const remote = process.env.DEPLOY_REMOTE || 'origin';
const fail = m => { console.error(m); process.exit(1); };
function repoOf(url) { const m = /github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i.exec(url); return m ? `${m[1]}/${m[2]}` : null; }
async function stagingRun(sha) {
  const repo = repoOf(out(`git remote get-url ${remote}`));
  if (!repo) return { state: 'unknown', why: 'not a GitHub remote' };
  const headers = { accept: 'application/vnd.github+json' };
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) headers.authorization = 'Bearer ' + (process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/runs?branch=staging&head_sha=${sha}&per_page=5`, { headers });
    if (!r.ok) return { state: 'unknown', why: `GitHub answered HTTP ${r.status}` };
    const runs = (await r.json()).workflow_runs || [];
    if (!runs.length) return { state: 'none' };
    const last = runs[0];
    return { state: last.status !== 'completed' ? 'running' : last.conclusion, url: last.html_url };
  } catch (e) { return { state: 'unknown', why: e.message }; }
}
const ask = q => new Promise(res => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, a => { rl.close(); res(a.trim()); }); });
(async () => {
  execSync(`git fetch -q ${remote} main staging`, { stdio: 'inherit' });
  const staging = out(`git rev-parse ${remote}/staging`), main = out(`git rev-parse ${remote}/main`);
  if (staging === main) { console.log(`Nothing to release: production is already at staging (${staging.slice(0, 7)}).`); return; }
  try { execSync(`git merge-base --is-ancestor ${main} ${staging}`, { stdio: 'ignore' }); }
  catch (e) { fail(`${remote}/main has commits staging does not: bring them into staging first (git merge ${remote}/main on staging, deploy to staging), then release.`); }
  if (out('git rev-parse HEAD') !== staging) fail(`This checkout is not at staging's tip (${staging.slice(0, 7)}): check it out (git checkout ${staging.slice(0, 7)}) so the tests run on what goes out.`);
  if (out('git status --porcelain')) fail('This checkout has uncommitted changes: commit them to staging first (npm run deploy:staging), or put them aside.');
  console.log('Unit tests (npm test)…');
  if (spawnSync('npm', ['test', '--silent'], { stdio: ['ignore', 'ignore', 'inherit'] }).status !== 0) fail('The tests failed: nothing released.');
  console.log('Unit tests passed.');
  const run = await stagingRun(staging);
  if (run.state === 'success') console.log(`Staging deploy of ${staging.slice(0, 7)} went through: ${run.url}`);
  else if (run.state === 'unknown') console.log(`(Could not check the staging deploy of ${staging.slice(0, 7)}: ${run.why}. Check it on GitHub before confirming.)`);
  else fail(`The staging deploy of ${staging.slice(0, 7)} has ${run.state === 'none' ? 'not run' : run.state === 'running' ? 'not finished' : `not passed (${run.state})`}${run.url ? `: ${run.url}` : ''}. Release once it has.`);
  console.log(`\nGoing live on https://tictacchaos.com (production), ${remote}/main ${main.slice(0, 7)} → ${staging.slice(0, 7)}:`);
  console.log(out(`git log --oneline --no-decorate ${main}..${staging}`).split('\n').map(l => '  ' + l).join('\n'));
  const a = await ask('\nType "release" to put this live on production: ');
  if (a !== 'release') { console.log('Not released.'); return; }
  execSync(`git push -q ${remote} ${staging}:refs/heads/main`, { stdio: 'inherit' });   // a fast-forward: main becomes staging's tip
  console.log(`Released ${staging.slice(0, 7)}. The Deploy workflow deploys it to production in a few minutes: https://tictacchaos.com`);
})().catch(e => fail(e.message));
