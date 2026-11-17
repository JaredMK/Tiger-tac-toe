'use strict';
// Staging's settings copied to production (a game whose settings change gets a new settings version there: bumpVersions) (the "Copy settings to production" workflow,
// .github/workflows/copy-settings.yml): the release switches, every game's settings, the computer's and the
// animation's, the bots' and alerts' settings and the Find Match switch. Never the accounts, the play data, the
// client minimums (config/clients), the email cutoff (config/verify), the alert keys (admin/secrets) or staging's
// allowlist (admin/staging). The admin's game templates (templates/{uid}) go too: an account's uid differs between the
// projects, so they travel by the admin account's email (staging's admins, by their claim) and land on the production
// account with that email and the admin claim; a template set is replaced whole.
//   node scripts/copy-settings.js export <file>              (staging's key): the settings into <file>
//   node scripts/copy-settings.js apply <file> <backup> [--dry-run]   (production's key): production's own values
//     saved to <backup> first, every change listed, then each path set to staging's (a path staging lacks is left alone)
const fs = require('node:fs');
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const PATHS = ['releases', 'features',
  'config/tune', 'config/ai', 'config/anim', 'config/timer', 'config/wheels', 'config/pig', 'config/run', 'config/bulls', 'config/plinko',
  'config/oddone', 'config/headcount', 'config/flash', 'config/snapshot', 'config/skyhop', 'config/scoop', 'config/pinball',
  'config/roads',
  'admin/config'];

// Every leaf that differs between two values, as "path: old → new".
function diff(a, b, at, out) {
  const obj = v => v && typeof v === 'object';
  if (obj(a) || obj(b)) {
    for (const k of new Set([...Object.keys(obj(a) ? a : {}), ...Object.keys(obj(b) ? b : {})])) diff(obj(a) ? a[k] : undefined, obj(b) ? b[k] : undefined, `${at}/${k}`, out);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${at}: ${a === undefined ? '(none)' : JSON.stringify(a)} → ${b === undefined ? '(none)' : JSON.stringify(b)}`);
  return out;
}

// Settings versions (December 2026, core/tune.js): a game whose settings the copy changes gets a new version on production
// (config/versions/<type> and its log, as the admin's Save does), so production's stats keep each version's squares apart.
// The version numbers are each environment's own: config/versions is never copied.
// The admins' templates on this project, by email: { email: { id: template } }.
async function readTemplates(db) {
  const out = {};
  let page;
  do {
    const r = await admin.auth().listUsers(1000, page);
    for (const u of r.users) if (u.customClaims && u.customClaims.admin === true && u.email) {
      const t = (await db.ref(`templates/${u.uid}`).get()).val();
      if (t) out[u.email.toLowerCase()] = t;
    }
    page = r.pageToken;
  } while (page);
  return out;
}
const mask = e => e.replace(/^(.).*(@.*)$/, '$1…$2');   // (the run's log is not the place for a whole address)

async function bumpVersions(db, before, after, dry) {
  for (const t of new Set(Object.keys(before).concat(Object.keys(after)))) {
    const a = before[t] || {}, b = after[t] || {};
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const ch = {};
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) ch[k] = { from: a[k] === undefined ? 'default' : a[k], to: b[k] === undefined ? 'default' : b[k] };
    if (dry) { console.log(`  ${t}: a new settings version on production`); continue; }
    const r = await db.ref(`config/versions/${t}`).transaction(cur => (Number.isInteger(cur) && cur >= 1 ? cur : 1) + 1);
    const nv = r.snapshot.val();
    await db.ref(`config/versionLog/${t}/v${nv}`).set({ at: Date.now(), by: 'copy-settings', ch });
    console.log(`  ${t}: settings version ${nv} on production`);
  }
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
    const templates = await readTemplates(db);
    fs.writeFileSync(file, JSON.stringify({ from: project, at: new Date().toISOString(), paths: out, templates }, null, 1));
    console.log(`Read ${PATHS.length} settings paths from ${project}: ${PATHS.filter(p => out[p] != null).length} set; templates of ${Object.keys(templates).length} admin account(s).`);
  } else {
    if (project !== 'tic-tac-chaos') throw new Error('apply writes production: this key is not production\'s');
    const src = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (src.from === project) throw new Error('the settings came from production itself');
    const before = {};
    for (const p of PATHS) before[p] = (await db.ref(p).get()).val();
    const tplTo = {};   // email -> production uid (an admin there), and its templates now
    for (const email of Object.keys(src.templates || {})) {
      try {
        const u = await admin.auth().getUserByEmail(email);
        if (u.customClaims && u.customClaims.admin === true) tplTo[email] = u.uid;
        else console.log(`templates: ${mask(email)} is not an admin on production, left out`);
      } catch (e) { console.log(`templates: no production account for ${mask(email)}, left out`); }
    }
    for (const [email, uid] of Object.entries(tplTo)) before[`templates/${uid}`] = (await db.ref(`templates/${uid}`).get()).val();
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
      if (p === 'config/tune') await bumpVersions(db, before[p] || {}, v, dry);   // (each game whose settings change gets a new settings version on production too)
    }
    for (const [email, uid] of Object.entries(tplTo)) {
      const p = `templates/${uid}`, v = src.templates[email];
      const changes = diff(before[p], v, p, []);
      if (!changes.length) { console.log(`${p} (${mask(email)}): the same already`); continue; }
      console.log(`${p} (${mask(email)}): ${changes.length} change${changes.length === 1 ? '' : 's'}`);
      for (const c of changes) console.log('  ' + c);
      n += changes.length;
      if (!dry) await db.ref(p).set(v);
    }
    console.log(dry ? `Dry run: ${n} changes listed, nothing written.` : `Copied: ${n} changes written to production.`);
  }
  process.exit(0);
})().catch(e => { console.error('::error::' + e.message); process.exit(1); });
