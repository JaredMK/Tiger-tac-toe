'use strict';
// Compare environments (November 2026): the admin's settings on staging (tic-tac-chaos-staging) and production
// (tic-tac-chaos) side by side, a setting copied either way one at a time (functions/index.js envCompare, envCopy; the
// admin page's #envs, src/admin/envs.js). Pure: the lists, the paths a copy may touch, flattening a node into its settings.
//
// Included (every admin-controlled settings node a player's game reads):
//   releases          each game's release switch, its iOS switch (platform/ios), Coming soon and its date (soon),
//                     Leaving soon (leaving), Remove from rotation days (retire), Deprioritized (depri), and the Super
//                     Chaos switch (superchaos: Classic only while it is off)
//   features          Find Match on/off and admin-only (findMatch, findMatchAdmin)
//   config/tune       every mini-game's settings (the Games page's fields, presets, Go again, Mode, the computer's levels)
//   config/ai         the computer's difficulty (each level's Search, Sharpness, Mistakes, Risk) and the search's weights
//   config/anim       the pace (Animation speed, Speed's multiplier and effects)
//   config/timer      Find Match's and friend games' default timer
//   config/lineup     the Game lineup cards' backs (blurb, luck/skill, format)
//   config/<card>     the games' own tuning cards: wheels, pig, run, bulls, plinko, oddone, headcount, flash, snapshot,
//                     skyhop, scoop, pinball, roads, bowling
//   admin/config      the bots (level, waits) and the alerts' settings
// Excluded (player data, analytics, or meant to differ per environment):
//   config/clients (each platform's oldest client: tied to what each environment serves), config/verify (each one's email
//   cutoff), config/staging and admin/staging (staging's access switch and allowlist), config/versions and
//   config/versionLog (each environment's own version numbers: a copy into config/tune makes a new version there),
//   admin/secrets, admin/secretsSet, admin/ownerToken (keys and links), devmeta (owner devices), templates (per account),
//   and every play and analytics node (users, profiles, games, rooms, mfacts, finds, devices, devlog, matchLogs, reports…).
const CARDS = ['wheels', 'pig', 'run', 'bulls', 'plinko', 'oddone', 'headcount', 'flash', 'snapshot', 'skyhop', 'scoop', 'pinball', 'roads', 'bowling'];
const ROOTS = ['releases', 'features', 'config/tune', 'config/ai', 'config/anim', 'config/timer', 'config/lineup'].concat(CARDS.map(c => 'config/' + c), ['admin/config']);
const PROD = 'tic-tac-chaos', STAGE = 'tic-tac-chaos-staging';
// The other environment's project (null: neither of the two, e.g. the emulator's demo project; the tests give theirs).
const peerOf = p => (p === PROD ? STAGE : p === STAGE ? PROD : null);
const envOf = p => (p === PROD ? 'production' : p === STAGE ? 'staging' : String(p || ''));
// A path a copy may write: under one of the roots, plain segments, not too deep.
const SEG = /^[A-Za-z0-9_-]{1,40}$/;
function allowed(path) {
  if (typeof path !== 'string' || path.length > 200) return false;
  const parts = path.split('/');
  if (parts.length > 7 || !parts.every(s => SEG.test(s))) return false;
  return ROOTS.some(r => path === r || path.startsWith(r + '/'));
}
// A node's settings: every leaf as { path: value } (an empty object counts as nothing).
function flatten(v, at, out = {}) {
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) flatten(v[k], `${at}/${k}`, out); return out; }
  if (v !== null && v !== undefined) out[at] = v;
  return out;
}
const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
// The game a config/tune path belongs to (a copy there makes a new settings version for it), else null.
const tuneGame = path => { const m = /^config\/tune\/([A-Za-z0-9_-]+)(\/|$)/.exec(path); return m ? m[1] : null; };
module.exports = { CARDS, ROOTS, PROD, STAGE, peerOf, envOf, allowed, flatten, same, tuneGame };
