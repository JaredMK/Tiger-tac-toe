'use strict';
// Puts a backup made by scripts/reset-production.js back: the whole database replaced by the backup's.
//
//   node scripts/restore-backup.js <backups/....json.gz | list>   (GOOGLE_APPLICATION_CREDENTIALS, TTC_PROJECT;
//                                                                  CONFIRM must be RESTORE-PRODUCTION)
//
// "list" prints the backups in gs://{project}-backups. A restore first saves the database as it is now
// (backups/{time}Z-before-restore.json.gz), so a restore can be undone the same way. Accounts (Auth) are
// never touched by the reset, so only the database comes back. The "Restore production" workflow runs this.
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { stamp } = require('./reset-production.js');

async function main() {
  const arg = String(process.argv[2] || '').trim(), PROJECT = process.env.TTC_PROJECT;
  if (!PROJECT) throw new Error('TTC_PROJECT is not set.');
  if (!arg) throw new Error('Give the backup\'s name (backups/....json.gz), or "list".');
  const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
  const { Storage } = require(path.join(__dirname, '..', 'functions', 'node_modules', '@google-cloud', 'storage'));
  const bucket = new Storage({ projectId: PROJECT }).bucket(`${PROJECT}-backups`);
  if (arg === 'list') {
    const [files] = await bucket.getFiles({ prefix: 'backups/' });
    for (const f of files) console.log(`${f.name}  ${(Number(f.metadata.size) / 1048576).toFixed(2)} MB  ${f.metadata.timeCreated}`);
    if (!files.length) console.log(`No backups in gs://${PROJECT}-backups.`);
    return;
  }
  if (process.env.CONFIRM !== 'RESTORE-PRODUCTION') throw new Error('Type RESTORE-PRODUCTION to confirm (the workflow\'s confirm input).');
  if (!/^backups\/[\w.-]+\.json\.gz$/.test(arg)) throw new Error('The name looks like backups/2026-11-01-1200Z.json.gz ("list" shows them).');
  const [buf] = await bucket.file(arg).download();
  const json = zlib.gunzipSync(buf).toString('utf8'), data = JSON.parse(json);
  const [meta] = await bucket.file(arg).getMetadata();
  const want = meta.metadata && meta.metadata.sha256, got = crypto.createHash('sha256').update(json).digest('hex');
  if (want && want !== got) throw new Error('The backup does not match its checksum: not restored.');
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database();
  const now = (await db.ref('/').get()).val() || {};
  const before = `backups/${stamp()}Z-before-restore.json.gz`;
  await bucket.file(before).save(zlib.gzipSync(JSON.stringify(now), { level: 9 }), { contentType: 'application/gzip', resumable: false });
  console.log(`The database as it was: gs://${PROJECT}-backups/${before}`);
  // Root by root (a big root child by child), so no single write is too large; roots the backup lacks are removed.
  for (const r of Object.keys(now)) if (!(r in data)) await db.ref(r).remove();
  for (const [r, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && Object.keys(v).length > 500) {
      await db.ref(r).remove();
      const keys = Object.keys(v);
      for (let i = 0; i < keys.length; i += 500) await db.ref(r).update(Object.fromEntries(keys.slice(i, i + 500).map(k => [k, v[k]])));
    } else await db.ref(r).set(v);
  }
  console.log(`Restored ${arg}: ${Object.keys(data).length} roots (${Object.keys(data).join(', ')}).`);
  await admin.app().delete();
}

main().catch(e => { console.log('::error::' + e.message); process.exit(1); });
