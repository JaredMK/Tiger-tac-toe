'use strict';
// What is live where: each site's version.json (scripts/build-site.js) against the branch it deploys from.
// Production must be at main, staging at staging; a change on staging shows on production only once released.
//   node scripts/check-envs.js [remote]        (default remote: origin; it fetches main and staging first)
const { execSync } = require('node:child_process');
const remote = process.argv[2] || process.env.DEPLOY_REMOTE || 'origin';
const SITES = { production: 'https://tictacchaos.com', staging: 'https://staging.tictacchaos.com' };
const git = c => execSync(`git ${c}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
(async () => {
  try { git(`fetch -q ${remote} main staging`); } catch (e) { /* (offline: the last fetched) */ }
  const want = { production: git(`rev-parse ${remote}/main`), staging: git(`rev-parse ${remote}/staging`) };
  let bad = false;
  for (const [env, site] of Object.entries(SITES)) {
    const v = await fetch(`${site}/version.json`, { cache: 'no-store' }).then(r => r.json()).catch(e => ({ error: e.message }));
    const ok = v.sha === want[env] && v.env === env;
    if (!ok) bad = true;
    console.log(`${ok ? 'ok  ' : 'DIFF'} ${env.padEnd(10)} ${site}  live ${String(v.sha || v.error).slice(0, 7)}  ${env === 'production' ? 'main' : 'staging'} ${want[env].slice(0, 7)}${v.built ? `  built ${v.built}` : ''}`);
  }
  const unreleased = git(`rev-list --count ${remote}/main..${remote}/staging`);
  console.log(`${unreleased} commit${unreleased === '1' ? '' : 's'} on staging not yet released to production.`);
  if (bad) process.exit(1);
})();
