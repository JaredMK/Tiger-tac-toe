// The page's entry: every mini-game's view is loaded, the listeners go on in the page's original order,
// the sounds are rendered and the page boots.
import { init as bowlingInit } from './games/bowling/view.js';
import { fetchBullsConfig, init as bullseyeInit } from './games/bullseye/view.js';
import { init as echoInit } from './games/echo/view.js';
import { setFlashConfig } from './games/flash/rules.js';
import { setHeadConfig } from './games/headcount/rules.js';
import { fetchOddConfig } from './games/oddone/view.js';
import { setPinConfig } from './games/pinball/rules.js';
import { setBowlConfig } from './games/bowling/rules.js';
import { fetchPigConfig } from './games/pig/view.js';
import { fetchRoadsConfig } from './games/roads/view.js';
import { fetchPlinkoConfig } from './games/plinko/view.js';
import { init as pongInit } from './games/pong/view.js';
import { setScoopConfig } from './games/scoop/rules.js';
import { setHopConfig } from './games/skyhop/rules.js';
import { setSnapConfig } from './games/snapshot/rules.js';
import { loadTrivia } from './games/trivia/view.js';
import { fetchWheelsConfig } from './games/wheels/view.js';
import { GAMES } from './games/index.js';
import { SND, init as soundInit } from './audio/sound.js';
import { connectQuiet, finishLogin, gateStart, hadAccount, redirectPending } from './net/accounts.js';
import { init as connectInit } from './net/connect.js';
import { checkResume, freshVisit, openFind, resumable } from './net/matchmaking.js';
import { fetchReleases } from './net/releases.js';
import { closeSeat, init as roomInit, joinCode, joinName, joinRoom, resumeOnline, setJoinCode, setJoinName } from './net/room.js';
import { devAudio, devOpen, devPulse, init as trackingInit, takeTag } from './net/tracking.js';
import { clockTimer, commit, setClockTimer, state } from './ui/app.js';
import { fetchAttConfig } from './ui/attention.js';
import { setTunes } from './core/tune.js';
import { AI_CLOCK } from './core/ai.js';
import { setAiWeights } from './core/aiw.js';
import { setAnimSpeed } from './core/timer.js';
import { setClientMins, updateNeeded } from './ui/update.js';
import { initPlatform, onAppLink, startLink, tidyLink } from './net/platform.js';
import { init as chaosInit } from './ui/chaos.js';
import { tick } from './ui/clock.js';
import { KEY } from './ui/config.js';
import { init as debugInit } from './ui/debug.js';
import { init as fingerInit } from './ui/finger.js';
import { init as inputInit, joinAsk, linkCode, matchUnderway, setJoinAsk } from './ui/input.js';
import { init as physicsInit, loadPhysics } from './ui/physics.js';
import { render } from './ui/render.js';
import { fetchRunConfig, init as runnerInit } from './ui/runner.js';
import { sandboxBoot, sandboxParams } from './ui/sandbox.js';
import { acctLoading, setAcctLoading } from './ui/screens/menu.js';
import { playFlash } from './ui/turns.js';

debugInit();
// Each game's view (its screen, miniature, words, sounds and inputs), before anything is drawn.
await Promise.all(Object.keys(GAMES).map(t => import(`./games/${t}/view.js`).then(v => { GAMES[t].view = v; })));
bullseyeInit();
echoInit();
fingerInit();
bowlingInit();
physicsInit();
runnerInit();
trackingInit();
connectInit();                                              // (back in front: the socket bounced before the room's resync below)
roomInit();
inputInit();
pongInit();
SND.report = devAudio;                                      // (the sound's ups and downs, to the device's and match's logs)
soundInit();
chaosInit();
AI_CLOCK.now = () => performance.now();                      // the engine's computer keeps to its time budget here (the Hard computer, where the core runs it itself: Super Chaos)
// The admin's settings (config/*: Mini-game Settings, the tuning cards, the Hard computer's weights), for the
// squares dealt from then on: read at the start, and again whenever the page comes back into view (at most
// once a minute), so a change on the dashboard reaches a phone that stayed open.
let configsAt = 0;
function loadConfigs() {
  configsAt = Date.now();
  fetchRunConfig();                                           // the runners' difficulty, for the squares to come
  fetchBullsConfig();                                         // Bullseye's board, bullseye and sweep speeds, likewise
  fetchWheelsConfig();                                        // Risky Spins' points, odds and target, likewise
  fetchPlinkoConfig();                                        // Peg Drop's target, likewise
  fetchPigConfig();                                           // Risky Rolls' die and target, likewise
  fetchRoadsConfig();                                         // Roads' honeycomb, likewise
  fetchOddConfig();                                           // Odd One Out's shade differences, likewise
  fetchAttConfig('headcount', setHeadConfig); fetchAttConfig('flash', setFlashConfig); fetchAttConfig('snapshot', setSnapConfig);   // the attention games' difficulty, likewise
  fetchAttConfig('skyhop', setHopConfig); fetchAttConfig('scoop', setScoopConfig); fetchAttConfig('pinball', setPinConfig);   // and the finger games'
  fetchAttConfig('bowling', setBowlConfig);                       // Bowling's two taps' speeds
  fetchAttConfig('tune', setTunes, true);                         // every mini-game's settings (Mini-game Settings: config/tune), likewise
  fetchAttConfig('ai', setAiWeights, true);                       // the Hard computer's weights (npm run tune-ai: config/ai), likewise
  fetchAttConfig('anim', v => setAnimSpeed(v && v.speed), true);   // the admin's Animation speed (config/anim): the whole game's pace
  fetchAttConfig('clients', v => { const was = updateNeeded(); setClientMins(v); if (updateNeeded() !== was) render(); }, true);   // the oldest version still allowed per platform (config/clients): below it, "Please update"
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !sandboxParams() && Date.now() - configsAt > 60000) loadConfigs(); });
function boot() {
  initPlatform();                                             // the app: links out of the game open in its own browser (net/platform.js)
  setClockTimer(setInterval(tick, 250));
  if (sandboxParams()) { loadTrivia(); loadPhysics(); sandboxBoot(); return; }   // the admin's test play: one mini-game with the editor's settings (no live config, nothing saved or reported)
  gateStart();                                                // staging: who this is, for the allowlist's gate (src/net/accounts.js)
  fetchReleases();                                            // which mini-games are released, before any match is set up
  loadConfigs();                                              // the admin's settings, for the squares to come
  loadTrivia();                                               // the Trivia questions, for the match to come
  loadPhysics();                                              // Matter.js and physics.js, for Mini Golf, Pool and Bowling
  takeTag();                                                  // a playtester's link (?t=sam): before the address is tidied below
  devOpen();
  setInterval(devPulse, 60000);
  try { setJoinName(localStorage.getItem(KEY + '.name') || ''); } catch (e) { /* no storage */ }
  const url = startLink(), link = linkCode(url);
  const autoJoin = link ? roomLink(link) : null;
  if (link) tidyLink();                                       // handled once: a reload is not a second link
  if (state.screen !== 'join' && !joinAsk) freshVisit();      // a fresh visit: the main menu (a join link: joining, or its question over the match it would leave)
  const play = !link && playLink(url);                        // the empty-queue alert's link: straight into Find Match
  if (play) tidyLink();
  if (state.flash && !state.spot) playFlash(true);           // a result still on show at the reload: its move has played, the result finishes
  commit();                                                   // (a match that ended as the page loaded is reported like any other)
  if (resumable) checkResume();                               // (a match held for Resume that has ended meanwhile: its button goes)
  if (state.online) resumeOnline();
  else if (hadAccount() || redirectPending()) {             // logged in before, or back from Google's sign-in page: the account, in the background
    setAcctLoading(true); render();
    connectQuiet().then(() => { setAcctLoading(false); finishLogin(); commit(); if (play && !joinAsk) openFind(); });
  }
  else if (play) openFind();
  if (autoJoin) joinRoom(autoJoin, joinName.trim() || 'Friend', false);
  onAppLink(openLink);                                        // the app: a link opened while it runs (a Universal Link to tictacchaos.com/?room=CODE)
}
const playLink = url => { try { return new URL(url, 'https://tictacchaos.com/').searchParams.get('play') === 'find'; } catch (e) { return false; } };
// A join link's code: the room joined at once (the name kept from before, else "Friend"; the code is the link's), or, with
// a match under way, the question whether to leave it first. Returns the code to join now, or null.
function roomLink(link) {
  if (state.online && state.online.code === link) return null;            // the same room: carry on in it
  if (matchUnderway()) { setJoinAsk({ code: link }); return null; }        // ask first: the match would be left
  if (state.online) { const o = state.online; connectQuiet().then(ok => { if (ok && o.code && o.me) closeSeat(o.code, o.me, o.role === 'host'); }); state.online = null; }   // a lobby (left cleanly once connected)
  setJoinCode(link); state.screen = 'join'; state.setup.mode = 'two';
  return link;
}
// A link handed to the app while it runs (the page itself is never reloaded for it): a room's code joins (or asks first),
// the alert's Find Match link opens Find Match.
function openLink(url) {
  const link = linkCode(url);
  if (link) { const code = roomLink(link); commit(); if (code) joinRoom(code, joinName.trim() || 'Friend', false); return; }
  if (playLink(url) && !matchUnderway()) openFind();
}

SND.load();                                                // renders the sounds now, in the background

boot();
