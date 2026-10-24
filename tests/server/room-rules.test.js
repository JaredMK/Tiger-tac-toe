'use strict';
// The friend rooms' security rules on the Realtime Database emulator (npm test): the forgery of a record is closed
// (security review F1). A room is written only by the server: no phone makes one, seats anyone, writes a match, its
// status or its game; only its two players read it; nobody lists the rooms. The players write their own seat's name,
// the host the setup (in the lobby), each their rematch flag and their leaving; presence has a shape.
// The emulator: the one the Firebase Emulator Suite runs (npm run test:emulators), else the database emulator's jar
// from firebase-tools' cache, started here (needs Java). Without either, the test is skipped and says so.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { initializeApp, deleteApp } = require('firebase/app');
const D = require('firebase/database');

const ROOT = path.join(__dirname, '..', '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 10000, what = 'condition') {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await wait(100); }
}
function emulatorJar() {
  if (process.env.FIREBASE_DATABASE_EMULATOR_JAR && fs.existsSync(process.env.FIREBASE_DATABASE_EMULATOR_JAR)) return process.env.FIREBASE_DATABASE_EMULATOR_JAR;
  const dir = path.join(os.homedir(), '.cache', 'firebase', 'emulators');
  if (!fs.existsSync(dir)) return null;
  const jars = fs.readdirSync(dir).filter(f => /^firebase-database-emulator.*\.jar$/.test(f)).sort();
  return jars.length ? path.join(dir, jars[jars.length - 1]) : null;
}
const hasJava = () => { try { return spawnSync('java', ['-version'], { stdio: 'ignore' }).status === 0; } catch (e) { return false; } };
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const suite = process.env.FIREBASE_DATABASE_EMULATOR_HOST || null;
const jar = suite ? null : emulatorJar();
if (!suite && !(jar && hasJava())) {
  test(`room rules on the database emulator (skipped: ${jar ? 'Java is not installed' : 'no database emulator jar in ~/.cache/firebase/emulators (firebase setup:emulators:database)'})`, { skip: true }, () => {});
  return;
}
const PROJECT = suite ? 'demo-tic-tac-chaos' : 'ttc-rules-test', NS = `${PROJECT}-default-rtdb`;
let HOST = '127.0.0.1', PORT = 0, proc = null;
async function owner(method, p, body) {
  const r = await fetch(`http://${HOST}:${PORT}${p}${p.includes('?') ? '&' : '?'}ns=${NS}`, { method, headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body });
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${await r.text()}`);
  return r.text();
}
test.before(async () => {
  if (suite) { [HOST, PORT] = [suite.split(':')[0], Number(suite.split(':')[1])]; }
  else {
    PORT = await freePort();
    proc = spawn('java', ['-jar', jar, '--host', HOST, '--port', String(PORT), '--single_project_mode', 'Warning'], { stdio: 'ignore' });
    await until(() => fetch(`http://${HOST}:${PORT}/.json?ns=${NS}`).then(() => true, () => false), 30000, 'the database emulator');
    await owner('PUT', '/.settings/rules.json', fs.readFileSync(path.join(ROOT, 'database.rules.json')));   // the live rules
  }
});
test.after(async () => {
  for (const c of clients) await deleteApp(c.app).catch(() => {});
  if (proc) proc.kill();
});
const clients = [];
let n = 0;
function client(uid) {
  const app = initializeApp({ apiKey: 'test', projectId: PROJECT, databaseURL: `https://${NS}.firebaseio.com`, appId: '1:1:web:1' }, 'c' + (++n));
  const db = D.getDatabase(app);
  D.connectDatabaseEmulator(db, HOST, PORT, { mockUserToken: { sub: uid, user_id: uid } });
  const c = { app, db, uid, write: (p, v) => D.set(D.ref(db, p), v), read: async p => (await D.get(D.ref(db, p))).val(), update: (p, v) => D.update(D.ref(db, p), v) };
  clients.push(c);
  return c;
}
const denied = (promise, what) => assert.rejects(promise, e => /permission[_ ]denied/i.test(String(e.code || e.message)), `${what} should be refused`);

test('room rules: a room is the server\'s to make and run; its two players read it, nobody else; a phone writes only its name, the host\'s setup, a rematch flag and its leaving', async () => {
  const host = client('uid-host'), guest = client('uid-guest'), stranger = client('uid-stranger'), victim = client('uid-victim');
  const code = 'RULES', t = Date.now();
  // the room as the server makes it (openRoom, then joinRoom): the host alone in the lobby
  await owner('PUT', `/rooms/${code}.json`, JSON.stringify({ created: t, host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: 'Hosty', joined: t } }, setup: { games: { ttt: true }, timer: 0, hostSide: 'X', hostPick: 'X', chaos: false } }));
  assert.equal((await host.read(`rooms/${code}`)).host, host.uid, 'the host reads the room');
  await denied(guest.read(`rooms/${code}`), 'someone not yet seated reading it');
  await denied(stranger.read('rooms'), 'listing the rooms');
  await denied(stranger.read(`rooms/${code}/players`), 'reading the seats');
  // nobody takes a seat, seats anyone else, or makes a room by hand (the record forgery of the review)
  await denied(guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: 'Me', joined: t }), 'taking the free seat by hand');
  await denied(host.write(`rooms/${code}/players/O`, { uid: victim.uid, name: 'V', joined: t }), 'the host seating someone else');
  await denied(host.update(`rooms/${code}`, { players: { X: { uid: host.uid, name: 'H' }, O: { uid: victim.uid, name: 'V' } } }), 'the host rewriting the seats');
  await denied(stranger.write('rooms/FORGE', { created: t, host: stranger.uid, status: 'playing', players: { X: { uid: stranger.uid, name: 'S', joined: t }, O: { uid: victim.uid, name: 'V', joined: t } }, setup: { hostSide: 'X' } }), 'a room made by hand');
  await denied(host.write(`rooms/${code}/match`, { state: '{"squares":[]}', secrets: '{}' }), 'a match written to the room');
  await denied(host.write(`rooms/${code}/status`, 'playing'), 'the status');
  await denied(host.write(`rooms/${code}/game`, 'g0000000000'), "the match's id");
  await denied(host.write(`rooms/${code}/host`, victim.uid), 'the host');
  await denied(host.write(`rooms/${code}/created`, 1), 'the creation time');
  // the guest seated (by the server): now they read it too; the setup is the host's, in the lobby; each writes their own name
  await owner('PUT', `/rooms/${code}/players/O.json`, JSON.stringify({ uid: guest.uid, name: 'Guesty', joined: t }));
  assert.equal((await guest.read(`rooms/${code}`)).players.O.uid, guest.uid);
  await denied(stranger.read(`rooms/${code}`), 'a stranger still');
  await host.write(`rooms/${code}/setup/timer`, 60);
  await host.update(`rooms/${code}/setup`, { hostPick: 'random', chaos: false, 'games/ttt': false });
  await denied(guest.write(`rooms/${code}/setup/timer`, 0), 'the guest changing the setup');
  await denied(host.write(`rooms/${code}/setup/timer`, 'soon'), 'a timer that is not a number');
  await denied(host.write(`rooms/${code}/setup/timer`, 100000), 'a timer out of range');
  await denied(host.write(`rooms/${code}/setup/hostPick`, 'both'), 'a side that is not one');
  await denied(host.write(`rooms/${code}/setup/other`, true), 'a setup field that is not one');
  await denied(host.write(`rooms/${code}/setup/chaos`, true), 'Super Chaos while it is not released (nor the admin)');
  await guest.write(`rooms/${code}/players/O/name`, 'Gus');
  await denied(guest.write(`rooms/${code}/players/X/name`, 'Hacked'), "the other player's name");
  await denied(guest.write(`rooms/${code}/players/O/uid`, stranger.uid), "the seat's uid");
  await denied(guest.write(`rooms/${code}/players/O/joined`, 1), "the seat's time");
  await denied(guest.write(`rooms/${code}/players/O/name`, 'x'.repeat(13)), 'a name over 12 characters');
  await denied(guest.write(`rooms/${code}/players/O/name`, ''), 'an empty name');
  await denied(guest.write(`rooms/${code}/players/O/name`, 7), 'a name that is not a string');
  // a guest leaves the lobby: their own seat only; the host closes the lobby: the room goes (only in the lobby)
  await denied(guest.write(`rooms/${code}/players/X`, null), "the host's seat");
  await denied(guest.write(`rooms/${code}`, null), 'the guest deleting the room');
  await guest.write(`rooms/${code}/players/O`, null);
  assert.equal(await host.read(`rooms/${code}/players/O`), null);
  await owner('PUT', `/rooms/${code}/players/O.json`, JSON.stringify({ uid: guest.uid, name: 'Gus', joined: t }));
  // the match on (the server): the setup is closed, the room stays; the players' rematch flags and leaving are theirs
  await owner('PATCH', `/rooms/${code}.json`, JSON.stringify({ status: 'playing', game: 'g0000000000' }));
  await denied(host.write(`rooms/${code}/setup/timer`, 0), 'the setup once the match is on');
  await denied(host.write(`rooms/${code}`, null), 'the host deleting the room once the match is on');
  await denied(guest.write(`rooms/${code}/players/O`, null), 'a seat given up mid-match');
  await host.write(`rooms/${code}/rematch/X`, D.serverTimestamp());
  await denied(host.write(`rooms/${code}/rematch/O`, D.serverTimestamp()), "the other's rematch flag");
  await denied(guest.write(`rooms/${code}/rematch/O`, 123), 'a flag that is not the moment');
  await guest.write(`rooms/${code}/rematch/O`, D.serverTimestamp());
  await host.write(`rooms/${code}/rematch/X`, null);
  await denied(stranger.write(`rooms/${code}/left`, { side: 'O', name: 'x', at: D.serverTimestamp() }), 'a stranger marking the room left');
  await denied(guest.write(`rooms/${code}/left`, { side: 'X', name: 'x', at: D.serverTimestamp() }), 'leaving for the other side');
  await denied(guest.write(`rooms/${code}/left`, { side: 'O', name: 'x', at: 5 }), 'a leaving at some other time');
  await denied(guest.write(`rooms/${code}/left`, { side: 'O', name: 'x', at: D.serverTimestamp(), note: '<script>' }), 'a leaving with more in it');
  await guest.write(`rooms/${code}/left`, { side: 'O', name: 'Gus', at: D.serverTimestamp() });
  await denied(host.write(`rooms/${code}/left`, { side: 'X', name: 'H', at: D.serverTimestamp() }), 'left is written once');
  assert.equal((await host.read(`rooms/${code}/left`)).side, 'O');
});
test('room rules: presence has a shape, is the seat\'s own, and is read by the two players only; a game\'s presence the same', async () => {
  const host = client('uid-ph'), guest = client('uid-pg'), stranger = client('uid-ps');
  const code = 'PRESE', t = Date.now();
  await owner('PUT', `/rooms/${code}.json`, JSON.stringify({ created: t, host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: 'H', joined: t }, O: { uid: guest.uid, name: 'G', joined: t } }, setup: { hostSide: 'X' } }));
  await host.write(`presence/${code}/X`, { online: true, away: false, at: t });
  await host.update(`presence/${code}/X`, { online: false, at: t });
  await denied(host.write(`presence/${code}/O`, { online: true, at: t }), "the other seat's presence");
  await denied(stranger.write(`presence/${code}/X`, { online: true, at: t }), "a stranger's");
  await denied(host.write(`presence/${code}/X`, { online: 'yes', at: t }), 'online that is not a boolean');
  await denied(host.write(`presence/${code}/X`, { at: t }), 'no online');
  await denied(host.write(`presence/${code}/X`, { online: true, at: 'now' }), 'a time that is not a number');
  await denied(host.write(`presence/${code}/X`, { online: true, junk: 'x'.repeat(2000) }), 'junk in the presence');
  await denied(stranger.write('presence/NONE1/X', { online: true }), 'presence for a room that is not there');
  assert.equal((await guest.read(`presence/${code}`)).X.online, false, 'the other player reads the presence');
  await denied(stranger.read(`presence/${code}`), 'a stranger reading it');
  await owner('PUT', '/games/g1.json', JSON.stringify({ pub: { players: { X: { uid: host.uid, name: 'H' }, O: { uid: guest.uid, name: 'G' } }, status: 'playing' } }));
  await host.write('gpresence/g1/X', { online: true, away: true, at: t });
  await denied(host.write('gpresence/g1/O', { online: true, at: t }), "the other side's game presence");
  await denied(host.write('gpresence/g1/X', { online: 1, at: t }), 'game presence out of shape');
  await denied(host.write('gpresence/g1/X', { online: true, extra: 'x' }), 'game presence with more in it');
  await denied(stranger.read('gpresence/g1'), "a stranger reading a game's presence");
});
