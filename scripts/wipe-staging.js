'use strict';
// Staging starts fresh (December 2026, asked for with the dashboard's redesign): its play data deleted once, exactly what the
// launch reset deletes on production (scripts/reset-production.js plan: matches, history, match logs, every stat and row,
// devices and their events, reports; every record back to 0-0-0), its accounts, usernames, admin, settings, releases,
// templates and owner devices kept. Staging alone: refused on production's project (production has its own workflow, with
// its typed confirmation). Once: its mark is meta/wipes/{ID}. The database as it was is written to the file given first
// (the Deploy workflow keeps it as the run's "staging-before-wipe" artifact; admin/secrets left out).
//   node scripts/wipe-staging.js <backup.json>      (GOOGLE_APPLICATION_CREDENTIALS, TTC_PROJECT)
const fs = require('node:fs');
const path = require('node:path');
const { plan } = require('./reset-production.js');
const ID = 'fresh1';

async function main() {
  const PROJECT = process.env.TTC_PROJECT, file = process.argv[2];
  if (!PROJECT || !file) throw new Error('usage: TTC_PROJECT=<staging project> node scripts/wipe-staging.js <backup.json>');
  if (PROJECT === 'tic-tac-chaos' || !/staging/.test(PROJECT)) throw new Error('This wipes staging only: use the "Reset production" workflow for production.');
  const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database();
  try {
    if ((await db.ref(`meta/wipes/${ID}`).get()).val()) { console.log(`Staging was wiped already (${ID}): nothing to do.`); return; }
    const data = (await db.ref('/').get()).val() || {};
    if (data.admin && data.admin.secrets) delete data.admin.secrets;
    fs.writeFileSync(file, JSON.stringify(data));
    console.log(`Staging's database as it was: ${file} (${(fs.statSync(file).size / 1048576).toFixed(2)} MB).`);
    const p = plan(data), counts = {};
    for (const r of p.remove) { const root = r.split('/')[0]; counts[root] = (counts[root] || 0) + 1; }
    console.log(`Deleting: ${Object.entries(counts).map(([r, k]) => `${r} (${k})`).join(', ') || 'nothing'}.`);
    console.log(`Records back to 0-0-0: ${p.accounts} account${p.accounts === 1 ? '' : 's'}.`);
    if (p.unknown.length) console.log(`::warning::Roots this wipe does not know, left alone: ${p.unknown.join(', ')}.`);
    const writes = Object.assign(Object.fromEntries(p.remove.map(r => [r, null])), p.records), keys = Object.keys(writes);
    for (let i = 0; i < keys.length; i += 500) await db.ref().update(Object.fromEntries(keys.slice(i, i + 500).map(k => [k, writes[k]])));
    await db.ref(`meta/wipes/${ID}`).set({ at: Date.now(), writes: keys.length });
    console.log(`Done: ${keys.length} writes.`);
  } finally { await admin.app().delete(); }
}
if (require.main === module) main().catch(e => { console.log('::error::' + e.message); process.exit(1); });
module.exports = { ID };
