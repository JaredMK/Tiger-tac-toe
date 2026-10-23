'use strict';
// Adds the game's domains to a project's Firebase Authentication "Authorized domains" (sign-in works only from
// those). Both projects get all three: tictacchaos.com, www.tictacchaos.com and staging.tictacchaos.com.
// Domains already there stay. Run by the deploy workflow; idempotent.
//   TTC_PROJECT=<project> node scripts/auth-domains.js      (GOOGLE_APPLICATION_CREDENTIALS: a service-account key)
const path = require('node:path');
const { GoogleAuth } = require(path.join(__dirname, '..', 'functions', 'node_modules', 'google-auth-library'));
const DOMAINS = ['tictacchaos.com', 'www.tictacchaos.com', 'staging.tictacchaos.com'];
(async () => {
  const p = process.env.TTC_PROJECT;
  if (!p) throw new Error('TTC_PROJECT is not set.');
  const c = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${p}/config`;
  const have = (await c.request({ url, headers: { 'x-goog-user-project': p } })).data.authorizedDomains || [];
  const missing = DOMAINS.filter(d => !have.includes(d));
  if (!missing.length) { console.log(`Authorized domains of ${p}: all there (${have.join(', ')}).`); return; }
  await c.request({ url: url + '?updateMask=authorizedDomains', method: 'PATCH', headers: { 'x-goog-user-project': p }, data: { authorizedDomains: have.concat(missing) } });
  console.log(`Authorized domains of ${p}: added ${missing.join(', ')}.`);
})().catch(e => { console.log('::error::Could not set the authorized domains: ' + String(e.message).split('\n')[0]); process.exit(1); });
