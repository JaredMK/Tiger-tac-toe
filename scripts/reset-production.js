'use strict';
// The launch reset: production starts clean but keeps its people and its settings.
//
//   node scripts/reset-production.js [--dry-run]      (GOOGLE_APPLICATION_CREDENTIALS: a service-account key;
//                                                     TTC_PROJECT: the project; CONFIRM must be RESET-PRODUCTION)
//
// 1. Backup first: the whole database, as gzipped JSON, to gs://{project}-backups/backups/{YYYY-MM-DD-HHMM}Z.json.gz
//    (the bucket is made if it is missing). The upload is read back and compared before anything is deleted.
// 2. Delete what matches and play left behind (DELETE below): games, rooms, history, match logs, stats, tracking.
// 3. Every account's record back to 0-0-0 (RECORD below); its username, joined date and anything else stays.
// Kept: Auth accounts and their claims (the admin flag), users/ profiles (and their public profiles/, the records zeroed with them), usernames/, admin/, config/ (game and
// computer settings), releases/, features/, bots/ (bot settings), meta/, review/. A root it does not know is
// listed in the log and left alone. --dry-run makes the backup and prints what it would do, and changes nothing.
// Restore: scripts/restore-backup.js (the "Restore production" workflow). The "Reset production" workflow runs this.
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const START_RATING = 1200;                                              // (functions/serverRules.js START_RATING)
const DELETE = ['rooms', 'games', 'gpresence', 'presence', 'reacts', 'active', 'queue', 'botGames', 'history', 'localHistory',
  'matchLogs', 'matchLogIndex', 'matchLogRoom', 'stats', 'statsSeen', 'localStats', 'oppStats', 'leaderboard', 'botStats',
  'alertLog', 'alertStats', 'alertState', 'botsLock', 'devices', 'devlog', 'lastSeen', 'reports', 'rate'];
const KEEP = ['users', 'profiles', 'usernames', 'admin', 'config', 'releases', 'features', 'bots', 'meta', 'review', 'rate', 'prefs'];   // (prefs: a player's own settings, the Animation choice)
const RECORD = { wins: 0, losses: 0, draws: 0, games: 0, rating: START_RATING, friend: null, minis: null };
const PUBLIC_RECORD = ['wins', 'losses', 'draws', 'games', 'friend', 'minis'];   // the record's part of a public profile (profiles/{uid}: no rating), put back to 0-0-0 with it
const PROFILE = ['username', 'joined', ...Object.keys(RECORD)];        // the fields an account is known to have

// What the reset does to a database snapshot: the root paths to delete (each child of a big root on its own,
// so no single write is too large), the accounts' record updates, and what it leaves alone.
function plan(data) {
  data = data || {};
  const roots = Object.keys(data), remove = [], records = {}, unknown = [], extraFields = new Set();
  for (const r of roots) {
    if (DELETE.includes(r)) {
      const v = data[r];
      if (v && typeof v === 'object') for (const k of Object.keys(v)) remove.push(`${r}/${k}`);
      else remove.push(r);
    } else if (!KEEP.includes(r)) unknown.push(r);
  }
  for (const [uid, u] of Object.entries(data.users || {})) {
    if (!u || typeof u !== 'object') continue;
    for (const [k, v] of Object.entries(RECORD)) records[`users/${uid}/${k}`] = v;
    if (u.username) for (const k of PUBLIC_RECORD) records[`profiles/${uid}/${k}`] = RECORD[k];   // the public profile's record with it (profileSync would too, in its own time)
    for (const k of Object.keys(u)) if (!PROFILE.includes(k)) extraFields.add(k);
  }
  return { remove, records, unknown, extraFields: [...extraFields].sort(), accounts: Object.keys(data.users || {}).length };
}

const stamp = (d = new Date()) => d.toISOString().slice(0, 16).replace('T', '-').replace(':', '');

async function main() {
  const dry = process.argv.includes('--dry-run');
  if (!dry && process.env.CONFIRM !== 'RESET-PRODUCTION') throw new Error('Type RESET-PRODUCTION to confirm (the workflow\'s confirm input).');
  const PROJECT = process.env.TTC_PROJECT;
  if (!PROJECT) throw new Error('TTC_PROJECT is not set.');
  const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
  const { Storage } = require(path.join(__dirname, '..', 'functions', 'node_modules', '@google-cloud', 'storage'));
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database();

  // 1. The backup. The alert keys (admin/secrets: Twilio, Resend) stay out of it: a backup is not a place for
  // credentials, and a restore must never roll them back (they live in Secret Manager from now on anyway).
  const data = (await db.ref('/').get()).val() || {};
  if (data.admin && data.admin.secrets) { delete data.admin.secrets; console.log('admin/secrets left out of the backup.'); }
  const json = JSON.stringify(data), gz = zlib.gzipSync(json, { level: 9 });
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  const storage = new Storage({ projectId: PROJECT }), bucketName = `${PROJECT}-backups`, bucket = storage.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (!exists) { await storage.createBucket(bucketName, { location: 'US', storageClass: 'STANDARD', iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' } }); console.log(`Made the bucket gs://${bucketName}.`); }
  const name = `backups/${stamp()}Z${dry ? '-dryrun' : ''}.json.gz`;
  await bucket.file(name).save(gz, { contentType: 'application/gzip', metadata: { metadata: { sha256: hash, project: PROJECT, roots: Object.keys(data).join(',') } }, resumable: false });
  const [back] = await bucket.file(name).download();
  const check = crypto.createHash('sha256').update(zlib.gunzipSync(back)).digest('hex');
  if (check !== hash) throw new Error(`The backup read back does not match (${check} vs ${hash}): nothing was deleted.`);
  console.log(`Backup: gs://${bucketName}/${name} (${(json.length / 1048576).toFixed(2)} MB of JSON, ${(gz.length / 1048576).toFixed(2)} MB gzipped, sha256 ${hash.slice(0, 16)}…), read back and checked.`);

  // 2 and 3. The plan, then the writes.
  const p = plan(data);
  const counts = {};
  for (const r of p.remove) { const root = r.split('/')[0]; counts[root] = (counts[root] || 0) + 1; }
  console.log(`Deleting: ${Object.entries(counts).map(([r, k]) => `${r} (${k})`).join(', ') || 'nothing'}.`);
  console.log(`Records back to 0-0-0: ${p.accounts} account${p.accounts === 1 ? '' : 's'}.`);
  console.log(`Kept: ${KEEP.filter(r => data[r] != null).join(', ')}.`);
  if (p.unknown.length) console.log(`::warning::Roots this reset does not know, left alone: ${p.unknown.join(', ')}.`);
  if (p.extraFields.length) console.log(`::warning::Account fields left as they are (not part of the record): ${p.extraFields.join(', ')}.`);
  if (dry) { console.log('Dry run: nothing changed.'); await admin.app().delete(); return; }
  const writes = Object.assign(Object.fromEntries(p.remove.map(r => [r, null])), p.records);
  const keys = Object.keys(writes);
  for (let i = 0; i < keys.length; i += 500) await db.ref().update(Object.fromEntries(keys.slice(i, i + 500).map(k => [k, writes[k]])));
  const left = DELETE.filter(r => data[r] != null);
  const still = (await Promise.all(left.map(r => db.ref(r).limitToFirst(1).get().then(s => (s.exists() ? r : null))))).filter(Boolean);
  if (still.length) console.log(`::warning::Written to again since the backup (play going on?): ${still.join(', ')}. Run the reset again once the game is quiet.`);
  console.log(`Done: ${keys.length} writes. Restore with the "Restore production" workflow and the backup's name: ${name}`);
  await admin.app().delete();
}

if (require.main === module) main().catch(e => { console.log('::error::' + e.message); process.exit(1); });
module.exports = { plan, DELETE, KEEP, RECORD, START_RATING, stamp };
