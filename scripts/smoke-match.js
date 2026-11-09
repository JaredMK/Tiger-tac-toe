'use strict';
// A friend match end to end on a live environment, through the server as the phones play it: a smoke account opens a
// room, a second one joins with the code, the host starts it, and the match the server made is there (nine squares, a
// player to move, both seats). Then the room, the match, its presence and its log are deleted, and the seats freed:
// nothing reaches anyone's record, history or the stats (the match never finishes). Run by the Deploy workflow after the
// live check (scripts/smoke-live.js) and so after every release.
//   TTC_PROJECT=<project> GOOGLE_APPLICATION_CREDENTIALS=<key> node scripts/smoke-match.js production|staging
// The two smoke accounts (smoke-host, smoke-guest) are made once, with no email and no username: never on a list or
// a leaderboard. On staging they carry the testers' claim (staging's server lets only the list in).
const fs = require('node:fs');
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const ENVS = require('./env-config.js').CONFIGS;

const ENV = process.argv[2] === 'staging' ? 'staging' : 'production', CFG = ENVS[ENV];
const FN = `https://us-central1-${CFG.projectId}.cloudfunctions.net`;
const ID = 'https://identitytoolkit.googleapis.com/v1/accounts';
const VERSION = (fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'client.js'), 'utf8').match(/CLIENT_VERSION = '([^']+)'/) || [])[1];
const json = { 'content-type': 'application/json' };
let failed = false;
const check = (good, what) => { console.log(`${good ? 'ok  ' : 'FAIL'} ${what}`); if (!good) failed = true; };

async function session(uid) {                            // the smoke account, signed in as a phone would be (a custom token, then its id token)
  const claims = ENV === 'staging' ? { staging: true } : {};
  try { await admin.auth().getUser(uid); } catch (e) { await admin.auth().createUser({ uid, displayName: uid }); }
  await admin.auth().setCustomUserClaims(uid, claims);
  const token = await admin.auth().createCustomToken(uid, claims);
  const r = await (await fetch(`${ID}:signInWithCustomToken?key=${CFG.apiKey}`, { method: 'POST', headers: json, body: JSON.stringify({ token, returnSecureToken: true }) })).json();
  if (!r.idToken) throw new Error(`could not sign ${uid} in: ${JSON.stringify(r.error || r).slice(0, 160)}`);
  return r.idToken;
}
const timings = [];                                        // every call's round trip, for the report (the first call to a function is its cold start)
async function call(idToken, name, data) {
  const t0 = Date.now();
  const r = await fetch(`${FN}/${name}`, { method: 'POST', headers: Object.assign({ authorization: 'Bearer ' + idToken }, json), body: JSON.stringify({ data: Object.assign({}, data, { client: { v: VERSION, p: 'web' } }) }) });
  const j = await r.json().catch(() => ({}));
  timings.push(`${name} ${Date.now() - t0} ms`);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status} ${JSON.stringify(j.error || j).slice(0, 200)}`);
  return j.result;
}

(async () => {
  if (!process.env.TTC_PROJECT || process.env.TTC_PROJECT !== CFG.projectId) throw new Error(`TTC_PROJECT must be ${CFG.projectId} (this environment's key)`);
  const key = process.env.GOOGLE_APPLICATION_CREDENTIALS;   // (the key itself, so tokens are signed here: the deploy's account has no IAM signBlob)
  admin.initializeApp(Object.assign({ projectId: CFG.projectId, databaseURL: CFG.databaseURL }, key ? { credential: admin.credential.cert(JSON.parse(fs.readFileSync(key, 'utf8'))) } : {}));
  const db = admin.database();
  const hostUid = 'smoke-host', guestUid = 'smoke-guest';
  let code = null, game = null;
  try {
    const host = await session(hostUid), guest = await session(guestUid);
    const open = await call(host, 'openRoom', { name: 'Smoke', setup: {} });
    code = open && open.code;
    check(!!(open && open.ok && code), `a room opens (code ${code || 'none'})`);
    const join = await call(guest, 'joinRoom', { code, name: 'Smoke guest' });
    check(!!(join && join.ok), `the friend joins with the code (${join && (join.side || join.reason)})`);
    const start = await call(host, 'startRoom', { code });
    game = start && start.game;
    check(!!(start && start.ok && start.started && game), `the host starts the match (game ${game || 'none'})`);
    const again = await call(host, 'startRoom', { code });     // the same request twice (a second tap, a retry): one match, no error
    check(!!(again && again.ok && !again.started && !again.game), `a second start of the same room makes no second match (${JSON.stringify(again).slice(0, 80)})`);
    if (game) {
      const pub = (await db.ref(`games/${game}/pub`).get()).val() || {};
      let g = {};
      try { g = JSON.parse(pub.state || '{}'); } catch (e) { /* (below: no squares) */ }   // (the public state rides as one JSON string: functions/index.js makeGame)
      const squares = Array.isArray(g.squares) ? g.squares : [];
      check(pub.status === 'playing' && pub.mode === 'friend' && pub.room === code, `the match is a friend match, playing, from its room (${pub.status}, ${pub.mode})`);
      check(squares.length === 9 && squares.every(q => q && q.mini && q.mini.type), `the match is dealt: nine squares, each with its mini-game (${squares.length})`);
      check(g.turn === 'X' || g.turn === 'O', `a player is to move (${g.turn})`);
      const room = (await db.ref(`rooms/${code}`).get()).val() || {};
      check(room.status === 'playing' && room.game === game, `the room points at its match (${room.status})`);
    }
  } finally {                                            // nothing left behind: the room, the match, its presence and log, the seats
    const up = { [`active/${hostUid}`]: null, [`active/${guestUid}`]: null };
    if (code) { up[`rooms/${code}`] = null; up[`presence/${code}`] = null; }
    if (game) for (const p of [`games/${game}`, `gpresence/${game}`, `matchLogs/m${game}`, `matchLogIndex/m${game}`, `matchLogs/${game}`, `matchLogIndex/${game}`]) up[p] = null;
    await db.ref().update(up).catch(e => console.log('::warning::smoke match: could not clean up: ' + e.message));
  }
  if (failed) { console.log('::error::The friend-match check failed.'); process.exit(1); }
  console.log(`Call timings (the first call to each function is its cold start): ${timings.join(', ')}`);
  console.log(`A friend match on ${ENV}: opened, joined, started and cleaned up.`);
  process.exit(0);
})().catch(e => { console.log('::error::The friend-match check could not run: ' + e.message); process.exit(1); });
