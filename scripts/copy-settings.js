'use strict';
// Staging's settings copied to production (the "Copy settings to production" workflow,
// .github/workflows/copy-settings.yml): the release switches, every game's settings, the computer's and the
// animation's, the bots' and alerts' settings and the Find Match switch. Never the accounts, the play data, the
// client minimums (config/clients), the email cutoff (config/verify), the alert keys (admin/secrets) or staging's
// allowlist (admin/staging).
//   node scripts/copy-settings.js export <file>              (staging's key): the settings into <file>
//   node scripts/copy-settings.js apply <file> <backup> [--dry-run]   (production's key): production's own values
//     saved to <backup> first, every change listed, then each path set to staging's (a path staging lacks is left alone)
const fs = require('node:fs');
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const PATHS = ['releases', 'features',
  'config/tune', 'config/ai', 'config/anim', 'config/wheels', 'config/pig', 'config/run', 'config/bulls', 'config/plinko',
  'config/oddone', 'config/headcount', 'config/flash', 'config/snapshot', 'config/skyhop', 'config/scoop', 'config/pinball',
  'config/roads', 'config/bowling',
  'admin/config'];

// Every leaf that differs between two values, as "path: old → new".
function diff(a, b, at, out) {
  const obj = v => v && typeof v === 'object';
  if (obj(a) || obj(b)) {
    for (const k of new Set([...Object.keys(obj(a) ? a : {}), ...Object.keys(obj(b) ? b : {})])) diff(obj(a) ? a[k] : undefined, obj(b) ? b[k] : undefined, `${at}/${k}`, out);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${at}: ${a === undefined ? '(none)' : JSON.stringify(a)} → ${b === undefined ? '(none)' : JSON.stringify(b)}`);
  return out;
}

(async () => {
  const [cmd, file, backup] = process.argv.slice(2), dry = process.argv.includes('--dry-run');
  const project = process.env.TTC_PROJECT;
  if (!project || !file || !['export', 'apply'].includes(cmd)) throw new Error('usage: TTC_PROJECT=<id> node scripts/copy-settings.js export <file> | apply <file> <backup> [--dry-run]');
  admin.initializeApp({ projectId: project, databaseURL: `https://${project}-default-rtdb.firebaseio.com` });
  const db = admin.database();
  if (cmd === 'export') {
    if (project === 'tic-tac-chaos') throw new Error('export reads staging: this key is production\'s');
    const out = {};
    for (const p of PATHS) out[p] = (await db.ref(p).get()).val();
    fs.writeFileSync(file, JSON.stringify({ from: project, at: new Date().toISOString(), paths: out }, null, 1));
    console.log(`Read ${PATHS.length} settings paths from ${project}: ${PATHS.filter(p => out[p] != null).length} set.`);
  } else {
    if (project !== 'tic-tac-chaos') throw new Error('apply writes production: this key is not production\'s');
    const src = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (src.from === project) throw new Error('the settings came from production itself');
    const before = {};
    for (const p of PATHS) before[p] = (await db.ref(p).get()).val();
    fs.writeFileSync(backup, JSON.stringify({ project, at: new Date().toISOString(), paths: before }, null, 1));
    console.log(`Production's current values saved (${backup}).`);
    let n = 0;
    for (const p of PATHS) {
      const v = src.paths[p];
      if (v == null) { console.log(`${p}: not set on staging, production's left as it is`); continue; }
      const changes = diff(before[p], v, p, []);
      if (!changes.length) { console.log(`${p}: the same already`); continue; }
      console.log(`${p}: ${changes.length} change${changes.length === 1 ? '' : 's'}`);
      for (const c of changes) console.log('  ' + c);
      n += changes.length;
      if (!dry) await db.ref(p).set(v);
    }
    console.log(dry ? `Dry run: ${n} changes listed, nothing written.` : `Copied: ${n} changes written to production.`);
  }
  process.exit(0);
})().catch(e => { console.error('::error::' + e.message); process.exit(1); });
