'use strict';
// After a deploy: the live functions and rules answer as they should. Run by the deploy workflow.
// It uses a throwaway guest session (deleted at the end) and writes nothing to the game.
const KEY = 'AIzaSyDnugsFX6N1chaeGHiKOfBiiUFTSYTX9SU';
const FN = 'https://us-central1-tic-tac-chaos.cloudfunctions.net';
const DB = 'https://tic-tac-chaos-default-rtdb.firebaseio.com';
const ID = 'https://identitytoolkit.googleapis.com/v1/accounts';
const json = { 'content-type': 'application/json' };
let failed = false;
const check = (good, what) => { console.log(`${good ? 'ok  ' : 'FAIL'} ${what}`); if (!good) failed = true; };
(async () => {
  for (const f of ['claimUsername', 'findMatch', 'cancelSearch', 'move', 'timeout', 'resign']) {
    const r = await fetch(`${FN}/${f}`, { method: 'POST', headers: json, body: '{"data":{}}' });
    const j = await r.json().catch(() => ({}));
    check(r.status === 401 && j.error && j.error.status === 'UNAUTHENTICATED', `${f} is live and asks for a login (HTTP ${r.status})`);
  }
  const tr = await fetch(`${FN}/track`, { method: 'POST', headers: json, body: '{"data":{}}' });
  const tj = await tr.json().catch(() => ({}));
  check(tr.status === 400 && tj.error && tj.error.status === 'INVALID_ARGUMENT', `track is live and refuses an empty event (HTTP ${tr.status})`);
  const s = await (await fetch(`${ID}:signUp?key=${KEY}`, { method: 'POST', headers: json, body: JSON.stringify({ returnSecureToken: true }) })).json();
  if (!s.idToken) { console.log('::warning::No guest session for the rules check:', JSON.stringify(s.error || s).slice(0, 200)); }
  else {
    const lb = await fetch(`${DB}/leaderboard.json?orderBy=%22rating%22&limitToLast=1&auth=${s.idToken}`);
    check(lb.status === 200, `the leaderboard can be read, sorted by rating (rules and index are live) (HTTP ${lb.status})`);
    const w = await fetch(`${DB}/users/${s.localId}/rating.json?auth=${s.idToken}`, { method: 'PUT', body: '3000' });
    check(w.status === 401, `a phone cannot write a rating (HTTP ${w.status})`);
    const g = await fetch(`${DB}/games.json?shallow=true&auth=${s.idToken}`);
    check(g.status === 401, `a phone cannot list the games or their hidden values (HTTP ${g.status})`);
    const st = await fetch(`${DB}/stats.json?shallow=true&auth=${s.idToken}`);
    check(st.status === 401, `only the admin can read the stats (HTTP ${st.status})`);
    const sw = await fetch(`${DB}/stats/modes/local/started.json?auth=${s.idToken}`, { method: 'PUT', body: '1' });
    check(sw.status === 401, `a phone cannot write the stats (HTTP ${sw.status})`);
    const c = await fetch(`${FN}/claimUsername`, { method: 'POST', headers: Object.assign({ authorization: 'Bearer ' + s.idToken }, json), body: JSON.stringify({ data: { username: 'smoke_test' } }) });
    check(c.status === 401, `a guest cannot claim a username (HTTP ${c.status})`);
    await fetch(`${ID}:delete?key=${KEY}`, { method: 'POST', headers: json, body: JSON.stringify({ idToken: s.idToken }) }).catch(() => {});
  }
  if (failed) { console.log('::error::The live check failed.'); process.exit(1); }
})().catch(e => { console.log('::error::The live check could not run: ' + e.message); process.exit(1); });
