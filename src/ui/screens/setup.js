// The setup screen: sides, names, the timer and the mini-game checklist.
import { scTypes } from '../../core/chaos.js';
import { SUPER_CHAOS_ENABLED } from '../../core/config.js';
import { restrictGames } from '../../core/games.js';
import { CPU_NAME, NAME_MAX, dealable, enabledGames, normCpu, normLocal } from '../../core/match.js';
import { LEVELS, LEVEL_NAME } from '../../core/aiw.js';
import { acct, loggedIn } from '../../net/accounts.js';
import { TIMER_OPTIONS } from '../../core/timer.js';
import { other } from '../../core/util.js';
import { GAMES, INFO, SC_ONLY } from '../../games/index.js';
import { connected } from '../../net/connect.js';
import { noticeSeq } from '../../net/moves.js';
import { chaosBadge, chaosVisible, scPicked, testBadge, visibleTypes } from '../../net/releases.js';
import { dbSetup, isHost, net } from '../../net/room.js';
import { TIMER_LABEL, advOpen, app, esc, save, state } from '../app.js';
import { CHEV, ICONS, toonT } from '../art.js';
import { qBtn } from '../explainer.js';
import { fxAt, fxAttr } from '../fx.js';
import { render } from '../render.js';

/* ----- setup screen ----- */
// Super Chaos (simultaneous rounds) is on for the next match: its switch on (a friend room: the room's, set by the
// host), and the mode visible here (admin only until released). Its checklist holds only the Super Chaos games.
export const chaosSetup = () => (isHost() ? !!state.online.chaos && chaosVisible() : state.setup.vs === 'cpu' && scPicked());   // (Play Local: Super Chaos against the computer is always open; a host's room: only where the switch is on)
export const setupTypes = () => (chaosSetup() ? visibleTypes().filter(t => scTypes().includes(t)) : visibleTypes().filter(t => !SC_ONLY.includes(t)));   // (a Super Chaos only game: in its checklist only)
// The Mode selector, Super Chaos | Classic (Play Local, the host's room, Find Match): only where Super Chaos is open
// to this player; its "?" explains Super Chaos.
export const modeRow = sc => (!isHost() || chaosVisible() ? `<div class="timerrow scmode" role="group" aria-label="Mode"><span>Mode ${qBtn('mode', 'sm')}</span><button class="seg${sc ? ' on' : ''}" data-act="gmode" data-v="chaos" aria-pressed="${sc}">Super Chaos${isHost() ? chaosBadge() : ''}</button><button class="seg${sc ? '' : ' on'}" data-act="gmode" data-v="classic" aria-pressed="${!sc}">Classic</button></div>` : '');
export function renderSetup() {
  const s = state.setup;
  const VT = setupTypes(), on = enabledGames(s).filter(t => VT.includes(t)).length;   // (an admin-only game does not exist here for anyone but the admin)
  const host = isHost();
  const sc = chaosSetup();
  const guest = host ? other(state.online.me) : null;
  // The host's room: the host is Player 1 and the friend Player 2 (X and O are drawn at random when each match starts).
  const field = p => (p === guest
    ? `<div class="field"><span>Player 2 · friend</span><div class="namebox">${state.online.joined ? esc(s.names[p]) : '<i>not joined yet</i>'}</div></div>`
    : `<div class="field"><span>Player 1 · you</span><div class="namebox">${esc((acct.profile && acct.profile.username) || s.names[p] || 'You')}</div></div>`);   // (hosting needs an account: always its username)
  const chk = t => `<label class="chk${s.games[t] ? '' : ' off'}${dealable(t) ? '' : ' wait'}" title="${dealable(t) ? '' : `Loading its ${t === 'trivia' ? 'questions' : 'physics'}… (needs a connection the first time)`}"><input type="checkbox" data-t="${t}"${s.games[t] ? ' checked' : ''}>${ICONS[t]}<span>${INFO[t].name}</span>${testBadge(t)}${dealable(t) ? '' : '<i class="tst wait">Loading</i>'}${qBtn(t, 'sm')}</label>`;
  const timer = host && !sc ? `<div class="timerrow" role="group" aria-label="Time per turn"><span>Time per turn</span>${TIMER_OPTIONS.map(v => `<button class="seg${(s.timer || 0) === v ? ' on' : ''}" data-act="timer" data-v="${v}">${TIMER_LABEL[v]}</button>`).join('')}</div>` : '';
  const room = host ? `<div class="room"><small>Room code</small><b class="code">${esc(state.online.code)}</b>
      <div class="row"><button class="btn" data-act="share">Share invite</button><button class="btn" data-act="copy-invite">Copy invite</button></div>
      ${state.notice ? `<div class="notice" role="status"${fxAttr(fxAt('notice', noticeSeq))}>${esc(state.notice)}</div>` : ''}
      <div class="status${net.status === 'connected' ? ' ok' : net.status === 'error' ? ' bad' : ''}">${net.status === 'connected' ? `<b>${esc(s.names[guest])}</b> joined` : esc(net.msg || 'Waiting for friend…')}</div>
      ${net.status === 'error' ? '<button class="btn" data-act="host-retry">Try again</button>' : ''}</div>` : '';
  const ready = setupReady(s);
  const vsCpu = !host && s.vs === 'cpu';
  const title = host ? 'Host game' : vsCpu ? 'Play Computer' : 'Same phone';
  const sub = host ? 'Share the code, set up, then start once your friend is in' : vsCpu ? 'You vs Computer' : 'Two players taking turns on this phone';
  // Same phone: two people on this phone; player 1 picks X, O or Random, player 2 takes the other side. (The computer is
  // Play Computer's, from the main menu: no Human/Computer choice here.)
  const L = host ? null : normLocal(s), s1 = L && L.pick !== 'random' ? L.pick : null, s2 = s1 ? other(s1) : null;
  const face = side => (side ? toonT(side) : '<span class="rtoon" aria-hidden="true">?</span>');
  const slots = () => {
    const pick = v => `<button class="seg${v === 'random' ? '' : ' ' + v}${L.pick === v ? ' on' : ''}" data-act="lside" data-side="${v}" aria-pressed="${L.pick === v}">${v === 'X' ? 'X' : v === 'O' ? 'O' : 'Random'}</button>`;
    return `<div class="slot ${s1 || 'R'} p1">
      <div class="who-p">${face(s1)}</div>
      <div class="sides three lside" role="group" aria-label="Player 1's side">${pick('X')}${pick('O')}${pick('random')}</div>
      <label class="field ${s1 || ''}"><span>Player 1 name${L.pick === 'random' ? ' · X or O, drawn every match' : ''}</span><input data-ln="n1" value="${esc(L.n1)}" maxlength="${NAME_MAX}" placeholder="${s1 || 'X or O'}" autocomplete="off" autocapitalize="words" aria-label="Player 1 name"></label></div>
    <div class="slot ${s2 || 'R'} p2">
      <div class="who-p">${face(s2)}</div>
      <label class="field ${s2 || ''}"><span>Player 2 name</span><input data-ln="n2" value="${esc(L.n2)}" maxlength="${NAME_MAX}" placeholder="${s2 || 'X or O'}" autocomplete="off" autocapitalize="words" aria-label="Player 2 name"></label></div>`;
  };
  // Play Computer: you (your username, or "You") against the computer; your side X, O or Random, its difficulty.
  const cpuSlots = () => {
    const C = normCpu(s), c1 = C.pick !== 'random' ? C.pick : null, c2 = c1 ? other(c1) : null, you = (loggedIn() && acct.profile.username) || 'You';
    const pick = v => `<button class="seg${v === 'random' ? '' : ' ' + v}${C.pick === v ? ' on' : ''}" data-act="cside" data-side="${v}" aria-pressed="${C.pick === v}">${v === 'random' ? 'Random' : v}</button>`;
    return `<div class="vscpu"><div class="vsme">${face(c1)}<b>${esc(you)}</b></div><i class="vsv" aria-hidden="true">vs</i><div class="vsme">${face(c2)}<b>${CPU_NAME}</b></div></div>
    <div class="timerrow" role="group" aria-label="You play as"><span>You play as:</span>${pick('X')}${pick('O')}${pick('random')}</div>
    <div class="timerrow" role="group" aria-label="Difficulty"><span>Difficulty</span>${LEVELS.map(v => `<button class="seg${C.level === v ? ' on' : ''}" data-act="clevel" data-v="${v}" aria-pressed="${C.level === v}">${LEVEL_NAME[v]}</button>`).join('')}</div>`;
  };
  return `<main class="scr setup">
    <div class="bar">${host ? `<button class="back" data-act="lobby-back" aria-label="Close the room and go back">${CHEV}Back</button>` : vsCpu ? `<button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>` : `<button class="back" data-act="friend-go" aria-label="Back to Play a Friend">${CHEV}Back</button>`}
      <div class="ttl"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>
    <div class="setup-box" data-keep-scroll="setup">
    ${room}
    ${host ? `<div class="names">${field(state.online.me)}${field(guest)}</div>` : vsCpu ? cpuSlots() : `<div class="slots">${slots()}</div>`}
    ${SUPER_CHAOS_ENABLED ? modeRow(sc) : ''}
    ${timer}
    <div class="adv${advOpen ? ' open' : ''}"><button class="adv-h" data-act="adv" aria-expanded="${advOpen}"><span>Mini-games</span><small>${gamesCount(on, VT.length)}</small><i class="chev">${CHEV}</i></button>
      ${advOpen ? `<div class="games-top"><button class="btn selall" data-act="games-none"${on === 0 ? ' disabled' : ''}>Deselect all</button><button class="btn selall" data-act="games-all"${on === VT.length ? ' disabled' : ''}>Select all</button></div><div class="games">${byName(VT).map(chk).join('')}</div>` : ''}</div>
  </div>
  <div class="setup-foot"><button class="primary" data-act="start"${ready ? '' : ' disabled'}>Start match</button>${(w => `<small class="warn${w ? '' : modeNote ? ' info' : ''}" role="status">${w || modeNote}</small>`)(setupWarn(s))}</div></main>`;
}
// A brief note in the setup's foot (its reserved line): Human chosen for player 2 while Super Chaos was on
// switched the mode to Classic.
let modeNote = '', modeNoteTimer = 0;
export function noteMode(text, ms = 3000) {
  modeNote = text; clearTimeout(modeNoteTimer);
  modeNoteTimer = setTimeout(() => { modeNote = ''; if (state.screen === 'setup') render(); }, ms);
}
// How many mini-games are on: "All", or "x/N".
export const gamesCount = (on, n) => (on === n ? 'All' : `${on}/${n}`);
// The Mini-games checklist: one list in alphabetical order (a game's kind, meta.js category, is in its "?").
export const byName = types => types.slice().sort((a, b) => INFO[a].name.localeCompare(INFO[b].name));
// Start opens once at least one mini-game is on (online, also once the friend is in).
const onGames = s => enabledGames(s).filter(t => setupTypes().includes(t));   // the games on, among those this player may see (Super Chaos: its own)
function setupReady(s) { const on = onGames(s).length; return isHost() ? !!(on && state.online.joined && connected) : !!on; }
function setupWarn(s) { return !onGames(s).length ? 'Select at least one mini-game to start' : isHost() && !setupReady(s) ? 'Start opens once your friend has joined' : ''; }
// Ticking a mini-game (or Select all) changes the screen in place, with no re-render, so the list
// stays exactly where it was scrolled and Mini-games stays open. The choice is saved for the next match.
export function setGames(change) {
  const s = state.setup;
  change(s.games);
  save();
  const VT = setupTypes(), on = onGames(s).length;
  for (const box of app.querySelectorAll('input[data-t]')) {
    const v = !!s.games[box.dataset.t];
    box.checked = v;
    box.closest('.chk').classList.toggle('off', !v);
  }
  const n = app.querySelector('.adv-h small'); if (n) n.textContent = gamesCount(on, VT.length);
  const all = app.querySelector('[data-act="games-all"]'); if (all) all.disabled = on === VT.length;
  const none = app.querySelector('[data-act="games-none"]'); if (none) none.disabled = on === 0;
  const start = app.querySelector('[data-act="start"]'); if (start) start.disabled = !setupReady(s);
  const warn = app.querySelector('.setup-foot .warn'); if (warn) warn.textContent = setupWarn(s);
  dbSetup({ games: restrictGames(Object.assign({}, s.games), VT) });   // (the room never holds a game its host may not deal)
}
