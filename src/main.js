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
import { connectQuiet, finishLogin, hadAccount, redirectPending } from './net/accounts.js';
import { openFind } from './net/matchmaking.js';
import { fetchReleases } from './net/releases.js';
import { closeSeat, init as roomInit, joinCode, joinName, resumeOnline, setJoinCode, setJoinName } from './net/room.js';
import { devOpen, devPulse, init as trackingInit, takeTag } from './net/tracking.js';
import { clockTimer, commit, setClockTimer, state } from './ui/app.js';
import { fetchAttConfig } from './ui/attention.js';
import { init as chaosInit } from './ui/chaos.js';
import { tick } from './ui/clock.js';
import { KEY } from './ui/config.js';
import { init as debugInit } from './ui/debug.js';
import { init as fingerInit } from './ui/finger.js';
import { init as inputInit, joinAsk, linkCode, matchUnderway, setJoinAsk } from './ui/input.js';
import { init as physicsInit, loadPhysics } from './ui/physics.js';
import { render } from './ui/render.js';
import { fetchRunConfig, init as runnerInit } from './ui/runner.js';
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
roomInit();
inputInit();
pongInit();
soundInit();
chaosInit();
function boot() {
  setClockTimer(setInterval(tick, 250));
  fetchReleases();                                            // which mini-games are released, before any match is set up
  fetchRunConfig();                                           // the runners' difficulty, for the squares to come
  fetchBullsConfig();                                         // Bullseye's board, bullseye and sweep speeds, likewise
  fetchWheelsConfig();                                        // Risk Wheels' points, odds and target, likewise
  fetchPlinkoConfig();                                        // Plinko's target, likewise
  fetchPigConfig();                                           // Risky Rolls' die and target, likewise
  fetchRoadsConfig();                                         // Roads' honeycomb, likewise
  fetchOddConfig();                                           // Odd One Out's shade differences, likewise
  fetchAttConfig('headcount', setHeadConfig); fetchAttConfig('flash', setFlashConfig); fetchAttConfig('snapshot', setSnapConfig);   // the attention games' difficulty, likewise
  fetchAttConfig('skyhop', setHopConfig); fetchAttConfig('scoop', setScoopConfig); fetchAttConfig('pinball', setPinConfig);   // and the finger games'
  fetchAttConfig('bowling', setBowlConfig);                       // Bowling's two taps' speeds
  loadTrivia();                                               // the Trivia questions, for the match to come
  loadPhysics();                                              // Matter.js and physics.js, for Mini Golf, Pool and Bowling
  takeTag();                                                  // a playtester's link (?t=sam): before the address is tidied below
  devOpen();
  setInterval(devPulse, 60000);
  const link = linkCode();
  try { setJoinName(localStorage.getItem(KEY + '.name') || ''); } catch (e) { /* no storage */ }
  if (link) {
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* (an old browser keeps it) */ }   // handled once: a reload is not a second link
    if (state.online && state.online.code === link) { /* the same room: carry on in it */ }
    else if (matchUnderway()) setJoinAsk({ code: link });                     // ask first: the match would be left
    else {                                                                  // a lobby (left cleanly once connected), or nothing on
      if (state.online) { const o = state.online; connectQuiet().then(ok => { if (ok && o.code && o.me) closeSeat(o.code, o.me, o.role === 'host'); }); state.online = null; }
      setJoinCode(link); state.screen = 'join'; state.setup.mode = 'two';
    }
  }
  const play = !link && new URLSearchParams(location.search).get('play') === 'find';   // the empty-queue alert's link: straight into Find Match
  if (play) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* (kept) */ } }
  if (state.flash && !state.spot) playFlash(true);           // a result still on show at the reload: its move has played, the result finishes
  commit();                                                   // (a match that ended as the page loaded is reported like any other)
  if (state.online) resumeOnline();
  else if (hadAccount() || redirectPending()) {             // logged in before, or back from Google's sign-in page: the account, in the background
    setAcctLoading(true); render();
    connectQuiet().then(() => { setAcctLoading(false); finishLogin(); commit(); if (play && !joinAsk) openFind(); });
  }
  else if (play) openFind();
}

SND.load();                                                // renders the sounds now, in the background

boot();
