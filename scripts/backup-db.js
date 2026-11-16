#!/usr/bin/env node
// The daily database backup (December 2026; the "Back up production" workflow, every day at 03:17 UTC, or by hand):
// the whole database as gzipped JSON to gs://{project}-backups/daily/{YYYY-MM-DD-HHMM}Z.json.gz (the bucket made if it is
// missing), read back and checked against its sha256, then every daily backup older than KEEP_DAYS (30) deleted. The
// alert keys (admin/secrets) are left out, as in the launch reset's backup. Restore one with the "Restore production"
// workflow (scripts/restore-backup.js, "list" shows them).
//   GOOGLE_APPLICATION_CREDENTIALS, TTC_PROJECT   node scripts/backup-db.js
const path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const KEEP_DAYS = 30, PREFIX = 'daily/';
const stamp = (d = new Date()) => d.toISOString().slice(0, 16).replace('T', '-').replace(':', '');
// The backups past their keep (pure: the names and their times, now): the ones to delete.
function expired(files, now, days = KEEP_DAYS) {
  return files.filter(f => f.name.startsWith(PREFIX) && Number.isFinite(f.time) && now - f.time > days * 86400000).map(f => f.name);
}
async function main() {
  const PROJECT = process.env.TTC_PROJECT;
  if (!PROJECT) throw new Error('TTC_PROJECT is not set.');
  const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
  const { Storage } = require(path.join(__dirname, '..', 'functions', 'node_modules', '@google-cloud', 'storage'));
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const data = (await admin.database().ref('/').get()).val() || {};
  if (data.admin && data.admin.secrets) delete data.admin.secrets;
  const json = JSON.stringify(data), gz = zlib.gzipSync(json, { level: 9 });
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  const storage = new Storage({ projectId: PROJECT }), bucketName = `${PROJECT}-backups`, bucket = storage.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (!exists) { await storage.createBucket(bucketName, { location: 'US', storageClass: 'STANDARD', iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' } }); console.log(`Made the bucket gs://${bucketName}.`); }
  const name = `${PREFIX}${stamp()}Z.json.gz`;
  await bucket.file(name).save(gz, { contentType: 'application/gzip', metadata: { metadata: { sha256: hash, project: PROJECT, roots: Object.keys(data).join(',') } }, resumable: false });
  const [back] = await bucket.file(name).download();
  const check = crypto.createHash('sha256').update(zlib.gunzipSync(back)).digest('hex');
  if (check !== hash) throw new Error(`The backup read back does not match (${check} vs ${hash}).`);
  console.log(`Backup: gs://${bucketName}/${name} (${(json.length / 1048576).toFixed(2)} MB of JSON, ${(gz.length / 1048576).toFixed(2)} MB gzipped), read back and checked.`);
  const [files] = await bucket.getFiles({ prefix: PREFIX });
  const old = expired(files.map(f => ({ name: f.name, time: Date.parse(f.metadata.timeCreated) })), Date.now());
  for (const n of old) await bucket.file(n).delete();
  console.log(`Kept ${files.length - old.length} daily backups (${KEEP_DAYS} days); deleted ${old.length}.`);
}
if (require.main === module) main().catch(e => { console.error(`::error::${e.message}`); process.exit(1); });
module.exports = { expired, KEEP_DAYS, PREFIX };
