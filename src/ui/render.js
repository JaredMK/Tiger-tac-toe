// Rendering: everything drawn from state, kept in place (no element is replaced when it need not be).
import { busFly } from '../games/bus/view.js';
import { refusedNote } from '../net/moves.js';
import { devWatch } from '../net/tracking.js';
import { app, entering, esc, lastView, menuOpen, setEntering, setLastView, setMenuOpen, state } from './app.js';
import { renderBoard, reviewSquares } from './board.js';
import { scPopup, scShown } from './chaos.js';
import { closeExplain, explainT, renderExplain, renderHowTo } from './explainer.js';
import { fingPaint } from './finger.js';
import { anchorFx, animate, fxAt, startFx, sweepBursts } from './fx.js';
import { refocus, typingIn } from './keyboard.js';
import { renderMini } from './mini.js';
import { physPaint } from './physics.js';
import { repMark, repRate } from './replay.js';
import { runPaint } from './runner.js';
import { renderGate, renderLogin, renderUsername } from './screens/account.js';
import { gateOn } from '../net/accounts.js';
import { renderFind, renderIntro } from './screens/find.js';
import { renderMenu } from './screens/menu.js';
import { renderFriend, renderJoin, renderJoinAsk, renderOnline } from './screens/online.js';
import { renderHistory, renderLeaderboard, renderProfHist, renderProfile } from './screens/profile.js';
import { renderSandbox } from './sandbox.js';
import { renderSetup } from './screens/setup.js';
import { renderWin } from './screens/win.js';
import { renderHeader, renderReactDock } from './turnbar.js';
import { reactOn } from '../net/reactions.js';
import { playFlash } from './turns.js';

export function render() {
  // The in-game menu belongs to the game's screens (the board and a square, live or under review after the
  // match): it closes when the screen leaves them (the results screen has no menu card to close it, so a
  // menu left open would refuse every tap there). After the match, View board's Menu opens it as ever.
  if (menuOpen && (!['board', 'mini', 'review', 'review-mini'].includes(state.screen) || (state.winner && (state.screen === 'board' || state.screen === 'mini')))) setMenuOpen(false);
  const view = state.screen + ':' + state.zoom;
  setEntering(view !== lastView); setLastView(view);
  if (entering) startFx('enter', view);                       // a new screen: the event for its own entry (the zoom into a square)
  if (entering && explainT) closeExplain(true);                 // another screen (Back, a menu, a move): no explainer left over it
  const kept = entering ? [] : [...app.querySelectorAll('[data-keep-scroll]')].map(e => [e.dataset.keepScroll, e.scrollTop]);
  const focus = entering ? null : typingIn();
  const boards = entering ? [] : KEEP_BOARDS.map(sel => [sel, app.querySelector(sel)]).filter(([, e]) => e);
  app.classList.toggle('rxon', reactOn());                       // (an online match: the reactions' strip at the bottom, kept the whole match)
  const html = renderHeader() + renderMain() + renderReactDock() + renderExplain() + renderIntro() + renderJoinAsk() + (refusedNote && state.online ? `<div class="refused" role="status">${esc(refusedNote)}</div>` : '');
  if (!boards.length) app.innerHTML = html;
  else {
    const fresh = document.createElement('div');
    fresh.innerHTML = html;
    graft(app, fresh, boards.map(([sel, old]) => [old, fresh.querySelector(sel)]).filter(([old, now]) => now && sameShape(old, now) && sameChain(old, now, app, fresh)));
  }
  for (const [k, top] of kept) { const e = app.querySelector(`[data-keep-scroll="${k}"]`); if (e) e.scrollTop = top; }   // the same screen again: lists stay where they were scrolled
  if (focus) refocus(focus);                                  // and a field being typed in keeps the focus, and the cursor
  const wl = document.getElementById('wlist') || document.getElementById('mmlist');
  if (wl) wl.scrollTop = wl.scrollHeight;
  animate();
  busFly();
  anchorFx();
  repMark(); repRate();                                       // a replay: the control just pressed, the animations at its rate
  runPaint();
  physPaint();
  fingPaint();
  if (state.flash && !state.spot && fxAt('move', state.flash) == null) { console.error('A result on show without its move event', state.flash); playFlash(true); }   // (never expected: no animation, but the result still clears)
  sweepBursts();
  devWatch();                                                 // a match starting or ending here: the playtest log
}
// Boards kept across a re-render of the same screen: their cells take the new classes and labels, but
// the elements stay, so only a cell that changed repaints (rebuilding the whole Hex board on a tap made
// phones blank part of it for a frame) and a running animation runs on (the Find Match hop).
const KEEP_BOARDS = ['.hexboard', '.searching .spinner', '.vsintro', '.hdr .tbar'];   // (the turn bar: its bounce runs on through re-renders)   // (the searching hop: re-rendered every few seconds, it would restart and hitch)
function sameShape(a, b) {
  if (a.tagName !== b.tagName || a.children.length !== b.children.length) return false;
  for (let k = 0; k < a.children.length; k++) if (!sameShape(a.children[k], b.children[k])) return false;
  return true;
}
// the same tags all the way up to the two roots
function sameChain(a, b, ra, rb) {
  for (; a !== ra && b !== rb; a = a.parentNode, b = b.parentNode) if (!a || !b || a.tagName !== b.tagName) return false;
  return a === ra && b === rb;
}
function syncAttrs(a, b) {
  for (const at of [...a.attributes]) if (!b.hasAttribute(at.name)) a.removeAttribute(at.name);
  for (const at of [...b.attributes]) if (a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
}
function syncNode(a, b) {
  syncAttrs(a, b);
  if (!b.children.length) { if (a.textContent !== b.textContent) a.textContent = b.textContent; return; }
  for (let k = 0; k < b.children.length; k++) syncNode(a.children[k], b.children[k]);
}
// The new screen put in place around the kept boards: everything else is replaced, but a kept board and
// the elements it sits in never leave the page (taken out even for a moment, its animations start over).
function graft(oldP, newP, pairs) {
  const top = (e, p) => { while (e.parentNode !== p) e = e.parentNode; return e; };
  const stay = new Map();                                       // a new child -> the old one it stays as, and the boards inside
  for (const [old, now] of pairs) {
    const nc = top(now, newP), oc = top(old, oldP);
    if (!stay.has(nc)) stay.set(nc, [oc, []]);
    if (stay.get(nc)[0] === oc) stay.get(nc)[1].push([old, now]);
  }
  const olds = new Set([...stay.values()].map(v => v[0]));
  for (const c of [...oldP.childNodes]) if (!olds.has(c)) c.remove();
  let at = oldP.firstChild;
  for (const nc of [...newP.childNodes]) {
    const s = stay.get(nc);
    if (!s) { oldP.insertBefore(nc, at); continue; }
    const [oc, inner] = s;
    if (oc !== at) oldP.insertBefore(oc, at);                   // two boards the other way round: moved
    if (inner.some(([old]) => old === oc)) syncNode(oc, nc);
    else { syncAttrs(oc, nc); graft(oc, nc, inner); }
    at = oc.nextSibling;
  }
}
function renderMain() {
  if (gateOn()) return renderGate();                          // staging: only testers on the allowlist get past this
  if (state.screen === 'sandbox') return renderSandbox();     // (the admin's test play, while it checks or when it cannot run)
  if (state.screen === 'menu') return renderMenu();
  if (state.screen === 'online') return renderOnline();
  if (state.screen === 'friend') return renderFriend();
  if (state.screen === 'join') return renderJoin();
  if (state.screen === 'setup') return renderSetup();
  if (state.screen === 'login') return renderLogin();
  if (state.screen === 'howto') return renderHowTo();
  if (state.screen === 'username') return renderUsername();
  if (state.screen === 'find') return renderFind();
  if (state.screen === 'leaderboard') return renderLeaderboard();
  if (state.screen === 'profile') return renderProfile();
  if (state.screen === 'profhist') return renderProfHist();
  if (state.screen === 'hreview' || state.screen === 'hreview-mini') return renderHistory();
  if (state.screen === 'win' && state.winner) return renderWin();
  if (state.screen === 'review' && state.winner) return renderBoard(true);
  if (state.screen === 'review-mini' && state.winner && state.zoom != null) {
    const sq = reviewSquares()[state.zoom];
    if (sq) return renderMini(sq, true);
  }
  if (state.screen === 'mini' && state.zoom != null) {
    const sq = scShown(state.zoom) || state.squares[state.zoom];   // (Super Chaos's recap: the square before its claim or reset)
    if (sq && scPopup()) return renderBoard() + renderMini(sq, false, true);   // the recap's replay of the computer's move: a pop-up over the board
    if (sq) return renderMini(sq);
  }
  return renderBoard();
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setRender(v) { render = v; }
