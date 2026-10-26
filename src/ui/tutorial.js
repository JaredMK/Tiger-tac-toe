// The first-time tutorial: about a minute on the real board, against the computer on Easy, with the two simplest
// mini-games (Tic-Tac-Toe and Coin Flip). Short captions in a bar reserved at the bottom of the game screens
// (#app.tut: the board and the mini-games are that much shorter, so nothing moves): the board, a tap into a
// square, a move, the first square claimed, three in a row; then a card offering a first match against the
// computer on Easy, or the main menu. Skip is always there. Shown once (a flag on this device, TUT_KEY) at a
// fresh visit that has no join link, no match to resume and no sign of play before (main.js boot); replayed
// from How to Play. Its match is the player's own to play, never tracked, recorded or resumed: it stays
// out of the stats (state.stats null), and a tutorial match left in the saved state is dropped at the next load.
import { CPU_NAME, newState, normCpu, startMatch } from '../core/match.js';
import { TYPES } from '../games/index.js';
import { SND } from '../audio/sound.js';
import { acct, gateOn, hadAccount, loggedIn } from '../net/accounts.js';
import {
  RNG, app, commit, cpuTimer, flashTimer, holdTimer, setCpuPlan, setCpuTimer, setFlashTimer, setHoldTimer, setMenuOpen,
  setMenuStep, setSpotTimer, spotTimer, state
} from './app.js';
import { toon } from './art.js';
import { KEY } from './config.js';
import { closeExplain } from './explainer.js';
import { fxAt, fxAttr, startFx } from './fx.js';
import { playComputer } from './input.js';
import { repStop } from './replay.js';
import { cpuTurn } from './turns.js';
import { updateNeeded } from './update.js';

export const TUT_KEY = KEY + '.tutorial';                     // 'done' once the tutorial has been shown on this device
export const TUT_GAMES = ['ttt', 'coins'];                    // the two mini-games it deals (both released, one of each kind)
const STEPS = ['intro', 'zoom', 'play', 'won', 'line', 'end'];
// The captions and labels, one per step (player-facing: docs/help-text.md, scripts/help-text.js).
const CAPTION = {
  intro: 'Nine squares, each a mini-game. Win squares to get three in a row.',
  zoom: 'Tap a square to zoom in.',
  play: 'Play the mini-game.',
  yours: 'Your turn: tap a square.',
  cpu: "The computer's turn: watch its move.",
  won: 'You won a square!',
  lost: 'The computer won a square. Win one back!',
  claim: 'Win a mini-game to claim its square.',
  line: 'Get three squares in a row to win the match.',
  ready: 'Ready?',
  go: 'Play the computer on Easy',
  menu: 'Main menu',
  skip: 'Skip',
  next: 'Next',
  gotit: 'Got it',
};
export let tut = null;                                        // { step } while the tutorial runs

export function tutorialSeen() { try { return localStorage.getItem(TUT_KEY) === 'done'; } catch (e) { return true; } }   // (no storage: never shown, rather than at every visit)
function markSeen() { try { localStorage.setItem(TUT_KEY, 'done'); } catch (e) { /* this visit only */ } }
// Due at a fresh visit: never shown here, and nothing says this player has played before (a match in the saved
// state, an account logged in before). main.js boot asks, with no join link and nothing to resume.
export function tutorialDue() { return !tutorialSeen() && !hadAccount() && !(state.moves > 0 || state.winner); }
// A tutorial match left in the saved state (the page closed mid-tutorial): dropped before the page reads the
// state as a match (it is never resumed, never asked about by a join link); the setup is kept.
export function tutorialReset() {
  if (!state.tutorial) return;
  Object.assign(state, newState(RNG), { setup: state.setup, tutorial: false });
}
// Everything a match leaves running: its timers and a replay (quitMatch does the same).
function stopMatch() {
  clearTimeout(cpuTimer); setCpuTimer(null); setCpuPlan(null);
  clearTimeout(spotTimer); setSpotTimer(null);
  clearTimeout(flashTimer); setFlashTimer(null);
  clearTimeout(holdTimer); setHoldTimer(null); repStop();
  setMenuOpen(false); setMenuStep('main'); closeExplain(true);
  state.flash = null; state.done = null; state.spot = null; state.lock = null; state.confirm = null; state.notice = null;
}
export function startTutorial() {
  markSeen();
  stopMatch();
  const s = state.setup, games = s.games;
  s.games = Object.fromEntries(TYPES.map(t => [t, TUT_GAMES.includes(t)]));   // the deal: these two alone (the player's own list comes back below; the match keeps its pool in state.games)
  s.mode = 'two'; s.human = 'X'; s.players = { X: 'human', O: 'cpu' }; s.level = 'easy';   // you are X and go first; the computer on Easy
  s.names = { X: (loggedIn() ? acct.profile.username : '') || 'You', O: CPU_NAME };
  const ok = startMatch(state, RNG);
  s.games = games;
  if (!ok) { state.screen = 'menu'; commit(); return false; }
  state.quick = false; state.stats = null; state.tutorial = true;   // never tracked or recorded (no trackStart: nothing for the stats, the record or the playtest log)
  tut = { step: 0 };
  startFx('tut', 0);
  commit();
  return true;
}
function endTutorial() {
  tut = null; state.tutorial = false; state.confirm = null;
  app.classList.remove('tut');
  if (app.dataset.tut) delete app.dataset.tut;
}
// Skip, or Main menu on the last card: out to the main menu (the flag is set already: not shown again by itself).
export function skipTutorial() {
  endTutorial(); stopMatch();
  state.screen = 'menu'; state.zoom = null;
  commit();
}
// The last card's Play: a real Play Computer match on Easy, your side drawn (Play Computer's own path, ui/input.js).
function playEasy() {
  endTutorial(); stopMatch();
  Object.assign(normCpu(state.setup), { pick: 'random', level: 'easy' });
  if (!playComputer()) skipTutorial();
}
// The tutorial's buttons (ui/input.js hands every tut-* act here). Returns true when the act was one of them.
export function tutAct(act) {
  if (!act || !act.startsWith('tut-')) return false;
  if (act === 'tut-replay') { startTutorial(); return true; }      // How to Play: Replay the tutorial
  if (!tut) { state.screen = 'menu'; commit(); return true; }       // (a button left from a tutorial no longer running)
  if (act === 'tut-skip' || act === 'tut-menu') skipTutorial();
  else if (act === 'tut-play') playEasy();
  else if (act === 'tut-next') {
    SND.play('tap');
    tut.step = Math.min(tut.step + 1, STEPS.length - 1);
    startFx('tut', tut.step);
    if (STEPS[tut.step] === 'end') { state.confirm = 'tutorial'; SND.play('swish'); }   // the card: the computer waits under it (ui/turns.js scheduleCpu)
    commit();
  }
  return true;
}
// The step follows the match (never backwards): into a square or a move made, the play step; back on the board
// with a square claimed (or four moves of your own without one), the claim step; the match over, the card.
function sync() {
  const claimed = state.squares.some(sq => sq.owner);
  let min = 0;
  if (state.winner) min = 5;
  else if (state.screen === 'board' && (claimed || state.moves >= 8)) min = 3;
  else if (state.screen === 'mini' || state.moves > 0) min = 2;
  if (min > tut.step) { tut.step = min; startFx('tut', min); }
}
function caption() {
  const step = STEPS[tut.step];
  if (step === 'intro') return CAPTION.intro;
  if (step === 'zoom') return CAPTION.zoom;
  if (step === 'play') return cpuTurn() ? CAPTION.cpu : state.screen === 'mini' ? CAPTION.play : CAPTION.yours;
  if (step === 'won') return state.squares.some(sq => sq.owner === 'X') ? CAPTION.won : state.squares.some(sq => sq.owner === 'O') ? CAPTION.lost : CAPTION.claim;
  return CAPTION.line;
}
// Rendered with every screen (ui/render.js): the caption bar in its reserved strip, or the last card over everything.
// #app.tut reserves the strip; data-tut names the step (the board's glow, the squares' pulse: styles.css).
export function renderTutorial() {
  const on = !!tut && !!state.tutorial && !gateOn() && !updateNeeded();   // (staging's gate or "Please update" on show: nothing of the tutorial over them; it is there once they go)
  app.classList.toggle('tut', on);
  if (!on) { if (app.dataset.tut) delete app.dataset.tut; return ''; }
  sync();
  const step = STEPS[tut.step], at = fxAt('tut', tut.step);
  app.dataset.tut = step;
  if (step === 'end') {
    return `<div class="tutend" role="dialog" aria-modal="true" aria-label="${CAPTION.ready}"${fxAttr(at)}><div class="tutcard">
      <div class="tutpals" aria-hidden="true">${toon('X')}${toon('O')}</div><h2>${CAPTION.ready}</h2>
      <button class="primary" data-act="tut-play">${CAPTION.go}</button>
      <button class="btn" data-act="tut-menu">${CAPTION.menu}</button></div></div>`;
  }
  const next = step === 'intro' || step === 'won' ? CAPTION.next : step === 'line' ? CAPTION.gotit : '';   // (a step that waits for the player's play has no Next; its slot stays, so nothing moves)
  return `<div class="tutbar" role="status" aria-live="polite"><p class="tutcap"${fxAttr(at)}>${caption()}</p>
    <div class="tutrow"><button class="link tutskip" data-act="tut-skip">${CAPTION.skip}</button><button class="btn go tutnext${next ? '' : ' off'}" data-act="tut-next"${next ? '' : ' disabled aria-hidden="true"'}>${next || CAPTION.next}</button></div></div>`;
}
