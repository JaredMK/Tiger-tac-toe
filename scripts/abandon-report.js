'use strict';
// The abandonment report (December 2026): why matches end early, from data the owner exports.
//   node scripts/abandon-report.js <file> [--mine] [--days N]
// <file>: the admin page's "Export for analysis" (Matches, Why matches end early: kind 'ttc-abandon', the rows already
// made), or a whole database backup (the daily backup's JSON, gzipped or not: gs://tic-tac-chaos-backups/daily/…), whose
// rows are made here by the admin page's own code (src/admin/metrics.js build, scope, abandonRows), my devices left out
// unless --mine, the last N days (90) up to the newest match in it. Prints the same numbers as the page, as Markdown.
const fs = require('node:fs');
const zlib = require('node:zlib');
const X = require('../src/admin/metrics.js');
const { GAMES } = require('../src/games/index.js');

const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('Give a file: node scripts/abandon-report.js <export.json | backup.json[.gz]> [--mine] [--days N]'); process.exit(1); }
const days = Number((args[args.indexOf('--days') + 1]) || 90) || 90, mine = args.includes('--mine');
let buf = fs.readFileSync(file);
if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
const data = JSON.parse(buf.toString('utf8'));

function rowsOf(d) {
  if (d && d.kind === 'ttc-abandon' && Array.isArray(d.rows)) return { rows: d.rows, src: `the admin's export (${d.env || '?'}, ${d.exported || '?'})` };
  const db = d && d.mfacts ? d : d && d.data && d.data.mfacts ? d.data : null;   // (a backup: the database's root, or wrapped)
  if (!db) throw new Error('Not an export or a database backup: no rows and no mfacts in it.');
  let newest = 0;
  for (const byId of Object.values(db.mfacts || {})) for (const r of Object.values(byId || {})) if (r && r.t0 > newest) newest = r.t0;
  const now = newest + 3600000, M = X.build({ matches: db.mfacts, finds: db.finds, devices: db.devices, logs: db.devlog, users: db.users, local: db.localStats, seen: db.lastSeen, reports: db.reports, logIndex: db.matchLogIndex, meta: db.devmeta, bots: db.bots }, now);
  const S = X.scope(M, { mine, range: [7, 30, 90].includes(days) ? String(days) : '90' });
  return { rows: X.abandonRows(S), src: `a database backup (newest match ${new Date(newest).toISOString()}), ${S.from} to ${S.to}${mine ? ', my devices included' : ', my devices left out'}` };
}
const pc = v => (v == null ? '–' : Math.round(v * 100) + '%');
const mins = ms => (ms == null ? '–' : ms < 60000 ? Math.round(ms / 1000) + ' s' : Math.round(ms / 60000) + ' min');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n');
const name = t => (GAMES[t] && GAMES[t].meta.info.name) || t;

const { rows, src } = rowsOf(data), R = X.abandonReport(rows);
const out = [`# Why matches end early`, `From ${src}.`, '',
  `${R.quits} of ${R.started} matches (${pc(R.rate)}) were given up: ${R.abandoned} abandoned, ${R.unfinished} never finished. ${R.detail} carry the quit facts.${R.idleMed != null ? ` Median time since the last move: ${mins(R.idleMed)}.` : ''}`, '',
  '## How it ended', table(['How', 'Matches', 'Share', 'Idle before (median)'], R.byWhy.sort((a, b) => b.quits - a.quits).map(r => [r.label, r.quits, pc(r.quits / (R.quits || 1)), mins(r.idle)])), '',
  '## By mode', table(['Mode', 'Matches', 'Given up', 'Abandoned', 'Never finished', 'Given up %'], R.byMode.sort((a, b) => b.started - a.started).map(r => [X.MODE_LABEL[r.mode] || r.mode, r.started, r.quits, r.abandoned, r.unfinished, pc(r.rate)])), ''];
if (R.byAfter.length) out.push('## Local matches never finished (no quit facts): what came next on the device (a guess from its events)', table(['Next', 'Matches', 'With an error logged'], R.byAfter.sort((a, b) => b.quits - a.quits).map(r => [r.label, r.quits, r.err])), '');
out.push('## By mini-game (quits with it in front of the quitter, against the matches it was played in)', table(['Mini-game', 'Played in', 'Quits on it', 'Quit %', 'Over-represented'], R.byGame.filter(r => r.quits).sort((a, b) => b.quits - a.quits || b.played - a.played).map(r => [name(r.t), r.played, r.quits, pc(r.rate), r.lift == null ? '–' : r.lift.toFixed(2)])), '',
  "## The quitter's board position", table(['Position', 'Quits', 'Share', 'From the row alone (older matches)', 'Other side at match point'], R.byPos.map(r => [r.pos, r.quits, pc(r.quits / (R.withPos || 1)), r.derived, r.mp])),
  `In the square in front of them: behind ${R.inSquare.behind}, level ${R.inSquare.level}, ahead ${R.inSquare.ahead}.`, '',
  '## By stage (moves made)', table(['Stage', 'Quits', 'Finished matches that long'], R.byStage.map(r => [r.label, r.quits, r.finishedAt])), '');
if (R.quits < 30) out.push(`**Thin data**: ${R.quits} quits. Shares and per-game rates on numbers this small say little.`);
console.log(out.join('\n'));
