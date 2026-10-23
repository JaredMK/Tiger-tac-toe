// Input: the page's click handler (each game's own controls go to its view.js: actions), the keyboard,
// scrolling lists, and joining by link.
import { startChaos } from '../core/chaos.js';
import { restrictGames } from '../core/games.js';
import { levelOf } from '../core/aiw.js';
import { NAME_MAX, normLocal, normSetup, seatLocal, startMatch, syncNames } from '../core/match.js';
import { resignLocal } from '../core/records.js';
import { normTimer } from '../core/timer.js';
import { hpSel, setHpSel } from '../games/hexapawn/view.js';
import { GAMES, TYPES } from '../games/index.js';
import { SND } from '../audio/sound.js';
import {
  acct, afterLogin, connectQuiet, gateAct, gateOn, loggedIn, loginMail, loginMsg, loginPass, loginReset, loginWith, logout,
  needAccount, saveUsername, setAfterLogin, setLoginMail, setLoginMsg, setLoginPass, setUnameDraft, unameDraft
} from '../net/accounts.js';
import { cancelSearch, closeIntro, findAgain, isMM, openFind, resignMM, search, startSearch } from '../net/matchmaking.js';
import { attemptMove, setTapEl, tapEl } from '../net/moves.js';
import { reactCooling, rx, sendReact } from '../net/reactions.js';
import { scMode, setMode, visibleTypes } from '../net/releases.js';
import {
  dbName, dbSetup, flushName, hostRoom, hostSide, isHost, joinCode, joinName, joinRoom, leaveLobby, leaveLoses,
  leaveRoom, lockMine, mySide, nameTimer, pinned, quitMatch, rematchCancel, rematchOnline, room, setJoinCode, setJoinName,
  setNameTimer, setNet, shareRoom, startOnline, validCode
} from '../net/room.js';
import { reportLocal, trackEnd, trackStart } from '../net/tracking.js';
import {
  RNG, advOpen, app, commit, cpuPlan, cpuTimer, flashReady, menuNote, menuOpen, menuStep, save, setAdvOpen,
  setCpuPlan, setCpuTimer, setMenuNote, setMenuOpen, setMenuStep, state, zoomedType
} from './app.js';
import { RATINGS_ENABLED } from './config.js';
import { closeExplain, explainT, openExplain } from './explainer.js';
import { fingGo } from './finger.js';
import { startFx } from './fx.js';
import { backspace, submitWord, typeLetter } from './keyboard.js';
import { render } from './render.js';
import { scPopup, scSkip } from './chaos.js';
import { repActive, repNote, repSkip, repVal } from './replay.js';
import { runGo } from './runner.js';
import { hist, openHistory, openLeaderboard, openProfile, prof, profileBack, setHist } from './screens/profile.js';
import { chaosSetup, noteMode, setGames, setupTypes } from './screens/setup.js';
import { cpuTurn, dismissFlash, scheduleCpu } from './turns.js';
import { closeReport, openReport } from './report.js';


// A mini-game's own control: the view whose actions have it.
const gameAction = act => { for (const t in GAMES) { const a = GAMES[t].view && GAMES[t].view.actions; if (a && Object.hasOwn(a, act)) return a[act]; } return null; };
// A tap inside a scrolling list never moves it: anything the browser does on its own (bringing a box it
// focuses fully into view) is put back before the next frame. A drag is a scroll and fires no click.
let tapScroll = null;
// A shared link (?room=CODE): the code read forgivingly (any case, spaces or stray characters dropped).
export function linkCode() {
  let v = null;
  try { v = new URLSearchParams(location.search).get('room'); } catch (e) { return null; }
  const c = String(v || '').toUpperCase().replace(/[^A-Z]/g, '');
  return validCode(c) ? c : null;
}
// A match is under way on this phone: online (a Find Match game, or a friend match that has started), or
// a local one on its board. A lobby, or a match already over, is not.
export function matchUnderway() {
  if (state.winner) return false;
  if (state.online) return isMM() || !!state.online.matchId;
  return ['board', 'mini'].includes(state.screen) && Array.isArray(state.squares) && state.squares.length === 9;
}
export let joinAsk = null;                             // a shared link opened during a match: { code }, until Leave & Join or Stay
// Leave & Join: the match is left as from the menu (a loss where it counts, recorded), then the join form for the link's code.
async function leaveAndJoin(code) {
  joinAsk = null;
  clearTimeout(cpuTimer); setCpuTimer(null); setCpuPlan(null);
  if (isMM()) await resignMM();
  else if (state.online) {
    const t0 = Date.now();
    while (state.online && !room && Date.now() - t0 < 6000) await new Promise(r => setTimeout(r, 150));   // the room, to leave it properly
    if (state.online) leaveRoom(false);
  } else if (leaveLoses() && resignLocal(state, state.setup.human === 'O' ? 'O' : 'X')) { trackEnd(); reportLocal(); }
  setMenuNote('');
  setJoinCode(code); state.online = null; state.setup.mode = 'two'; state.screen = 'join'; setNet('idle', '');
  commit();
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {

  /* ----- input ----- */
  app.addEventListener('click', e => {
    if (rx.tray && !e.target.closest('.rtray, [data-act="react-open"]')) { rx.tray = false; render(); }   // a tap elsewhere closes the reaction tray
    if (scPopup() && e.target.closest('main.screplay') && !e.target.closest('[data-act="explain"]')) { e.preventDefault(); scSkip(); return; }   // Super Chaos's replay: a tap anywhere on it (or its Skip) goes to its end
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    if (gateOn()) {                                                                     // staging's gate: only its own buttons and the login's
      if (act.startsWith('gate-')) gateAct(act);
      else if (act === 'login-google' || act === 'login-email' || act === 'login-create') loginWith(act === 'login-google' ? 'google' : act === 'login-email' ? 'email' : 'create');
      else if (act === 'login-reset') loginReset();
      return;
    }
    if (act === 'explain') { e.preventDefault(); openExplain(el.dataset.t); return; }    // never a move: open over anything, even mid-turn
    if (act === 'explain-close') { closeExplain(); return; }
    if (act === 'intro-close') { closeIntro(); return; }
    if (act === 'ask-stay') { joinAsk = null; render(); scheduleCpu(); return; }
    if (act === 'ask-leave') { if (joinAsk) leaveAndJoin(joinAsk.code); return; }
    if (act === 'dismiss') { if (Date.now() >= flashReady) dismissFlash(); return; }   // not before the animation is over
    if (act === 'rep-skip') { repSkip(); return; }                                      // an opponent's replay: straight to its result
    const free = ['pause', 'pause-report', 'pause-resume', 'pause-main', 'pause-back', 'pause-leave', 'leave', 'lobby-back', 'menu', 'find-again', 'profile', 'prof-back', 'prof-hist', 'mystats', 'hist-open', 'hist-sq', 'hist-back', 'hist-close', 'leaderboard', 'rejoin', 'host-retry', 'share', 'rematch', 'rematch-cancel', 'timer', 'review', 'review-sq', 'review-back', 'results', 'pview', 'react-open', 'react-send'];
    if (act === 'sound') { SND.setMuted(!SND.muted); if (!SND.muted) SND.play('toggle'); render(); return; }   // (the press's own sound came with the press when it was still on)
    if (act === 'react-mute') { rx.mute = !rx.mute; if (rx.mute && rx.card && rx.card.side !== mySide()) { clearTimeout(rx.hide); rx.card = null; } render(); return; }   // this match only: the opponent's emoji stop showing and sounding
    if (act === 'pause') { setMenuOpen(true); setMenuStep('main'); startFx('menu', menuStep); render(); scheduleCpu(); return; }
    if (act === 'pause-resume') { closeReport(); setMenuOpen(false); setMenuStep('main'); render(); scheduleCpu(); return; }
    if (act === 'pause-main') { setMenuStep('confirm'); startFx('menu', menuStep); render(); return; }
    if (act === 'pause-back') { setMenuStep('main'); startFx('menu', menuStep); render(); return; }
    if (act === 'pause-leave') { quitMatch(); return; }
    if (act === 'pause-report') { openReport(); return; }                            // (a dialog of its own over the menu: ui/report.js)
    if (menuOpen) return;                         // the menu is up: nothing underneath reacts
    if (state.flash && !free.includes(act)) return;   // everything else waits for the result to clear
    if (state.done && !free.includes(act)) return;    // the result is still on show
    if (cpuTurn() && !free.includes(act)) return;   // the computer is playing
    if (repActive() && !free.includes(act)) return;   // an opponent's inputs are playing back
    if (state.screen === 'mini' && !free.includes(act) && !['zoom', 'back', 'sound', 'key', 'bksp', 'enter'].includes(act)) repNote(act, repVal(el));   // this phone's input, for the move's replay on the other side (the keyboard logs its own)
    if (act === 'react-open') { if (!reactCooling()) { rx.tray = !rx.tray; render(); } return; }   // (before the stamp: a reaction never clears a claim's stamp)
    if (act === 'react-send') { sendReact(Number(el.dataset.i)); return; }
    state.stamp = null;                           // a claim stamps in once
    if (act === 'zoom') {                        // open squares to play, claimed squares to look
      const i = Number(el.dataset.i);
      if (state.winner || !state.squares[i]) { SND.play('error'); return; }
      if (lockMine() && state.lock !== i) { SND.play('error'); return; }
      state.screen = 'mini'; state.zoom = i; state.draft = ''; state.sel = []; state.notice = null; setHpSel(null); SND.play('tap');   // (a plain tap: no whoosh into the square)
      if (!state.online) { state.pick = null; state.pickSq = null; }
      commit();
    } else if (act === 'back') {
      if (lockMine() || pinned()) return;
      if (state.done) return;
      state.screen = 'board'; state.zoom = null; state.draft = ''; state.sel = []; state.notice = null; state.stamp = null;
      if (!state.online) { state.pick = null; state.pickSq = null; }
      commit();
    } else if (act === 'mode-go') {              // the main menu: pick a mode, then set up
      state.setup.mode = 'two'; normSetup(state.setup); normLocal(state.setup); if (scMode()) normLocal(state.setup).p2 = 'cpu'; state.screen = 'setup'; setAdvOpen(false); commit();
    } else if (act === 'kind') {                 // Play Local: player 2 is a Human or the Computer
      if (chaosSetup() && el.dataset.kind !== 'cpu') { setMode('classic'); noteMode('Super Chaos needs a computer or online opponent'); }   // (Super Chaos: against the computer or online only: Human switches to Classic)
      normLocal(state.setup).p2 = el.dataset.kind === 'cpu' ? 'cpu' : 'human'; commit();
    } else if (act === 'gmode') {                // the Mode, Super Chaos or Classic: Play Local (Super Chaos against the computer), the host's room, Find Match; kept on this device
      setMode(el.dataset.v);
      if (isHost()) { state.online.chaos = scMode(); commit(); dbSetup({ chaos: state.online.chaos }); return; }   // (only the Super Chaos games among those on are dealt)
      if (scMode() && state.screen === 'setup') normLocal(state.setup).p2 = 'cpu';
      commit();
    } else if (act === 'level') {                // Play Local: the computer's level, Easy, Normal or Hard
      normLocal(state.setup).level = levelOf(el.dataset.v); commit();
    } else if (act === 'lside') {                // Play Local: player 1's side, X, O or Random (drawn at every start)
      normLocal(state.setup).pick = ['X', 'O', 'random'].includes(el.dataset.side) ? el.dataset.side : 'X'; commit();
    } else if (act === 'review') {               // the results screen: look back over the final board
      if (state.winner) { state.screen = 'review'; state.zoom = null; render(); }
    } else if (act === 'review-sq') {
      if (state.winner) { state.screen = 'review-mini'; state.zoom = Number(el.dataset.i); render(); }
    } else if (act === 'review-back') {
      if (state.winner) { state.screen = 'review'; state.zoom = null; render(); }
    } else if (act === 'results') {
      if (state.winner) { state.screen = 'win'; state.zoom = null; render(); }
    } else if (act === 'howto') {
      state.screen = 'howto'; commit();
    } else if (act === 'menu') {
      state.screen = 'menu'; state.confirm = null; setMenuNote(''); commit();
    } else if (act === 'timer') {
      if (isHost()) { state.setup.timer = normTimer(Number(el.dataset.v)); commit(); dbSetup({ timer: state.setup.timer }); }
    } else if (act === 'rematch') {               // the same settings again (a Random side drawn again)
      if (state.online) { rematchOnline(); return; }
      seatLocal(state.setup, RNG);
      if (state.sc ? startChaos(state, RNG) : startMatch(state, RNG)) { trackStart(); commit(); }   // (a Super Chaos match: another)
    } else if (act === 'rematch-cancel') {        // the rematch asked for, taken back
      rematchCancel();
    } else if (act === 'online-go') {
      state.screen = 'online'; setNet('idle', ''); commit();
      connectQuiet();                               // (whether Find Match is on: it follows the database from here)
    } else if (act === 'friend-go') {
      state.screen = 'friend'; setNet('idle', ''); commit();
    } else if (act === 'find-go') {               // the main menu: Find Match (or back to the match in progress)
      openFind();
    } else if (act === 'search-go') {
      startSearch();
    } else if (act === 'search-cancel') {
      if (search.on) cancelSearch(); else { state.screen = 'online'; commit(); }
    } else if (act === 'find-again') {
      findAgain();
    } else if (act === 'login') {
      setAfterLogin(null); setLoginMsg(null); state.screen = acct.user && acct.ready && !loggedIn() ? 'username' : 'login'; commit(); connectQuiet();
    } else if (act === 'login-google') {
      loginWith('google');
    } else if (act === 'login-email') {
      loginWith('email');
    } else if (act === 'login-create') {
      loginWith('create');
    } else if (act === 'login-reset') {
      loginReset();
    } else if (act === 'uname-save') {
      saveUsername();
    } else if (act === 'logout') {
      logout();
    } else if (act === 'leaderboard') {
      if (RATINGS_ENABLED) openLeaderboard();
    } else if (act === 'mystats') {
      openProfile(null, 'menu');
    } else if (act === 'pview') {                 // your stats: Online, Local or All
      if (prof) { prof.view = ['online', 'local', 'all'].includes(el.dataset.v) ? el.dataset.v : 'online'; render(); }
    } else if (act === 'prof-hist') {
      state.screen = 'profhist'; render();
    } else if (act === 'intro-close') {
      closeIntro();
    } else if (act === 'profile') {
      openProfile(el.dataset.uid || null);
    } else if (act === 'prof-back') {
      profileBack();
    } else if (act === 'hist-open') {
      openHistory(el.dataset.id);
    } else if (act === 'hist-sq') {
      if (hist) { hist.zoom = Number(el.dataset.i); state.screen = 'hreview-mini'; render(); }
    } else if (act === 'hist-back') {
      if (hist) { hist.zoom = null; state.screen = 'hreview'; render(); }
    } else if (act === 'hist-close') {
      setHist(null); state.screen = 'profhist'; render();
    } else if (act === 'lobby-back') {           // the online screens go back one step; a lobby is left cleanly
      if (state.online) leaveLobby(); else { state.screen = 'friend'; setNet('idle', ''); commit(); }
    } else if (act === 'host') {                  // hosting needs an account: logged out, the login first, then straight back to Host
      setAdvOpen(false);
      if (!loggedIn()) { needAccount('host'); return; }
      hostRoom(null, false);
    } else if (act === 'host-retry') {
      hostRoom(state.online && room ? state.online.code : null, !!room);
    } else if (act === 'join-go') {
      state.screen = 'join'; state.online = null; setNet('idle', ''); render();
    } else if (act === 'join') {
      const nameEl = document.getElementById('jname'), codeEl = document.getElementById('jcode');
      setJoinName((nameEl ? nameEl.value : joinName).trim().slice(0, NAME_MAX) || 'Friend'); setJoinCode((codeEl ? codeEl.value : joinCode).toUpperCase().replace(/[^A-Z]/g, ''));
      joinRoom(joinCode, joinName, false);
    } else if (act === 'rejoin') {
      if (state.online) joinRoom(null, null, true);
    } else if (act === 'share') {
      shareRoom();
    } else if (act === 'leave') {
      leaveRoom();
    } else if (act === 'adv') {
      setAdvOpen(!advOpen); render();
    } else if (act === 'games-none') {            // Deselect all: every mini-game off, in place (Start waits for one)
      if (state.screen === 'setup') setGames(g => { for (const t of chaosSetup() ? setupTypes() : TYPES) g[t] = false; });
    } else if (act === 'games-all') {             // Select all: every mini-game on, in place
      if (state.screen === 'setup') setGames(g => { for (const t of setupTypes()) g[t] = true; });
    } else if (act === 'side') {
      if (isHost()) {                             // X or O: the seats move over in the room (its answer updates the screen); Random: drawn at each start
        const pick = el.dataset.side === 'random' ? 'random' : el.dataset.side === 'O' ? 'O' : 'X';
        state.setup.hostPick = pick; save();
        if (nameTimer) { clearTimeout(nameTimer); setNameTimer(null); flushName(state.setup.names[state.online.me]); }   // the name typed so far first: the room's echo below would show the old one
        if (pick !== 'random' && pick !== state.online.me) hostSide(pick); else render();
        dbSetup({ hostPick: pick });
        return;
      }
      const side = el.dataset.side === 'O' ? 'O' : 'X';
      state.setup.human = side; syncNames(state.setup);
      commit();
    } else if (act === 'fing-start') {           // Sky Hop, Scoop Stack, Pinball: the attempt starts now; from here the player stays in the square until it ends
      fingGo();
    } else if (act === 'run-go') {                // Dash, Lane Rush: the count, then the run
      runGo();
    } else if (act === 'move') {
      setHpSel(null);
      if (el.dataset.m === '[]') return;
      setTapEl(el);                                  // the control pressed: it shows the press at once, online (see dbMove)
      attemptMove(JSON.parse(el.dataset.m));
      setTapEl(null);
    } else if (act === 'key') {
      typeLetter(el.dataset.k);
    } else if (act === 'bksp') {
      backspace();
    } else if (act === 'enter') {
      submitWord();
    } else if (act === 'cancel') {
      state.confirm = null; commit();
    } else if (act === 'start') {
      if (state.online) { startOnline(); return; }
      if (chaosSetup()) normLocal(state.setup).p2 = 'cpu';       // (Super Chaos: against the computer)
      seatLocal(state.setup, RNG);
      restrictGames(state.setup.games, visibleTypes());           // never a game this player may not see
      if (chaosSetup() ? startChaos(state, RNG) : startMatch(state, RNG)) { trackStart(); commit(); }
    } else {                                       // a mini-game's own control: its view's actions
      const own = gameAction(act);
      if (own) own(el, e, act);
    }
  });
  app.addEventListener('pointerdown', e => {
    const sc = e.target.closest && e.target.closest('[data-keep-scroll]');
    const typing = e.target.closest && e.target.closest('input:not([type="checkbox"]), textarea, select');   // a text field may scroll up for the keyboard
    tapScroll = sc && !typing ? { sc, top: sc.scrollTop } : null;
  }, true);
  app.addEventListener('click', () => {
    const t = tapScroll; tapScroll = null;
    if (!t) return;
    const back = () => { if (t.sc.isConnected && t.sc.scrollTop !== t.top) t.sc.scrollTop = t.top; };
    requestAnimationFrame(back);
  }, true);
  // Tapping a game's name ticks its box without the browser focusing the box (which can scroll the list
  // to bring a half-hidden box into view): the label's own click is cancelled and the box flipped here.
  app.addEventListener('click', e => {
    const label = e.target.closest && e.target.closest('label.chk');
    if (!label || e.target.matches('input') || e.target.closest('.qbtn')) return;   // the "?" opens the game's explainer instead
    e.preventDefault();
    const box = label.querySelector('input[data-t]');
    if (!box || box.disabled) return;
    box.checked = !box.checked;
    box.dispatchEvent(new Event('change', { bubbles: true }));
  });
  // Setup screen: names are saved as they are typed (no re-render, so the field keeps focus);
  // ticking a game updates the list in place.
  app.addEventListener('input', e => {
    const el = e.target;
    if (el.matches && el.matches('input[data-p]') && state.setup) { state.setup.names[el.dataset.p] = el.value; save(); if (state.online && state.online.me === el.dataset.p) dbName(el.value); }
    if (el.matches && el.matches('input[data-ln]') && state.setup) { normLocal(state.setup)[el.dataset.ln === 'n2' ? 'n2' : 'n1'] = el.value.slice(0, NAME_MAX); save(); }
    if (el.id === 'jname') setJoinName(el.value);
    if (el.id === 'lemail') setLoginMail(el.value);
    if (el.id === 'lpass') setLoginPass(el.value);
    if (el.id === 'uname') setUnameDraft(el.value);
    if (el.id === 'jcode') { const v = el.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5); if (v !== el.value) el.value = v; setJoinCode(v); }
  });
  app.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target && e.target.id === 'jcode') { e.preventDefault(); const b = app.querySelector('[data-act="join"]'); if (b) b.click(); }
    if (e.key === 'Enter' && e.target && (e.target.id === 'lpass' || e.target.id === 'lemail')) { e.preventDefault(); loginWith('email'); }
    if (e.key === 'Enter' && e.target && e.target.id === 'uname') { e.preventDefault(); saveUsername(); }
  });
  app.addEventListener('change', e => {
    const el = e.target;
    if (el.matches && el.matches('input[data-t]') && state.setup) setGames(g => { g[el.dataset.t] = el.checked; });
  });
  // Physical keyboard, for desktops: Wordle typing and Hangman letters.
  document.addEventListener('keydown', e => {
    if (explainT) { if (e.key === 'Escape' || e.key === 'Enter') closeExplain(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;   // typing a name, or a report's note
    const type = zoomedType();
    if (!type) return;
    if (/^[a-zA-Z]$/.test(e.key)) {
      if (type === 'wordle') typeLetter(e.key.toUpperCase());
      else if (type === 'hangman') { repNote('move', `m=${JSON.stringify(e.key.toUpperCase())}`); attemptMove(e.key.toUpperCase()); }
    } else if (e.key === 'Backspace') backspace();
    else if (e.key === 'Enter') submitWord();
  });
  document.addEventListener('contextmenu', e => e.preventDefault());
  // No zooming (with the viewport's maximum-scale and touch-action: manipulation): iPhone's pinch is a gesture
  // event that the viewport tag alone does not stop.
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setJoinAsk(v) { joinAsk = v; }
