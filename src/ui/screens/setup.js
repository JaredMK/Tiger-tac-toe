// The setup screen: sides, names, the timer and the mini-game checklist.
import { scTypes } from '../../core/chaos.js';
import { restrictGames } from '../../core/games.js';
import { CPU_NAME, NAME_MAX, cpuSide, dealable, enabledGames, normLocal } from '../../core/match.js';
import { TIMER_OPTIONS } from '../../core/timer.js';
import { other } from '../../core/util.js';
import { GAMES, INFO, SC_ONLY } from '../../games/index.js';
import { connected } from '../../net/connect.js';
import { noticeSeq } from '../../net/moves.js';
import { chaosBadge, chaosVisible, testBadge, visibleTypes } from '../../net/releases.js';
import { dbSetup, isHost, net } from '../../net/room.js';
import { LEVELS, LEVEL_NAME } from '../../core/aiw.js';
import { TIMER_LABEL, advOpen, app, esc, save, state } from '../app.js';
import { CHEV, CPU_ICON, ICONS, toonT } from '../art.js';
import { qBtn } from '../explainer.js';
import { fxAt, fxAttr } from '../fx.js';

/* ----- setup screen ----- */
// Super Chaos (simultaneous rounds) is on for the next match: its switch on (a friend room: the room's, set by the
// host), and the mode visible here (admin only until released). Its checklist holds only the Super Chaos games.
export const chaosSetup = () => (isHost() ? !!state.online.chaos : !!state.setup.chaos) && chaosVisible();
export const setupTypes = () => (chaosSetup() ? visibleTypes().filter(t => scTypes().includes(t)) : visibleTypes().filter(t => !SC_ONLY.includes(t)));   // (a Super Chaos only game: in its checklist only)
export function renderSetup() {
  const s = state.setup;
  const VT = setupTypes(), on = enabledGames(s).filter(t => VT.includes(t)).length;   // (an admin-only game does not exist here for anyone but the admin)
  const host = isHost(), mode = host ? 'online' : s.mode === 'cpu' ? 'cpu' : 'two', human = s.human === 'O' ? 'O' : 'X', cpu = cpuSide(s);
  const sc = chaosSetup();
  const guest = host ? other(state.online.me) : null;
  const field = p => (p === guest
    ? `<div class="field ${p}"><span>${p} player · friend</span><div class="namebox">${state.online.joined ? esc(s.names[p]) : '<i>not joined yet</i>'}</div></div>`
    : `<label class="field ${p}"><span>${p} player${cpu === p ? ' · computer' : host ? ' · you' : ''}</span><input data-p="${p}" value="${esc(s.names[p] || '')}" maxlength="${NAME_MAX}" placeholder="${cpu === p ? CPU_NAME : p}" autocomplete="off" autocapitalize="words" aria-label="${p} player name"></label>`);
  const pick = host && s.hostPick === 'random' ? 'random' : human;   // the host: X, O, or drawn at random for every match
  const sides = mode !== 'two' ? `<div class="sides${host ? ' three' : ''}" role="group" aria-label="Your side"><span>You play</span><button class="seg X${pick === 'X' ? ' on' : ''}" data-act="side" data-side="X" aria-pressed="${pick === 'X'}">${host ? 'X<small>goes first</small>' : 'X · goes first'}</button><button class="seg O${pick === 'O' ? ' on' : ''}" data-act="side" data-side="O" aria-pressed="${pick === 'O'}">O</button>${host ? `<button class="seg${pick === 'random' ? ' on' : ''}" data-act="side" data-side="random" aria-pressed="${pick === 'random'}">Random</button>` : ''}</div>` : '';
  const chk = t => `<label class="chk${s.games[t] ? '' : ' off'}${dealable(t) ? '' : ' wait'}" title="${dealable(t) ? '' : `Loading its ${t === 'trivia' ? 'questions' : 'physics'}… (needs a connection the first time)`}"><input type="checkbox" data-t="${t}"${s.games[t] ? ' checked' : ''}>${ICONS[t]}<span>${INFO[t].name}</span>${testBadge(t)}${dealable(t) ? '' : '<i class="tst wait">Loading</i>'}${catIcon(t)}${qBtn(t, 'sm')}</label>`;
  const timer = host && !sc ? `<div class="timerrow" role="group" aria-label="Time per turn"><span>Time per turn</span>${TIMER_OPTIONS.map(v => `<button class="seg${(s.timer || 0) === v ? ' on' : ''}" data-act="timer" data-v="${v}">${TIMER_LABEL[v]}</button>`).join('')}</div>` : '';
  const room = host ? `<div class="room"><small>Room code</small><b class="code">${esc(state.online.code)}</b>
      <div class="row"><button class="btn" data-act="share">Share link</button></div>
      ${state.notice ? `<div class="notice" role="status"${fxAttr(fxAt('notice', noticeSeq))}>${esc(state.notice)}</div>` : ''}
      <div class="status${net.status === 'connected' ? ' ok' : net.status === 'error' ? ' bad' : ''}">${net.status === 'connected' ? `<b>${esc(s.names[guest])}</b> joined` : esc(net.msg || 'Waiting for friend…')}</div>
      ${net.status === 'error' ? '<button class="btn" data-act="host-retry">Try again</button>' : ''}</div>` : '';
  const ready = setupReady(s);
  const title = host ? 'Host game' : 'Play Local';
  const sub = host ? 'Share the code, set up, then start once your friend is in' : '';
  // Play Local: player 1 is a person who picks X, O or Random; player 2 is a person or the computer, on the other side.
  const L = host ? null : normLocal(s), s1 = L && L.pick !== 'random' ? L.pick : null, s2 = s1 ? other(s1) : null;
  const face = side => (side ? toonT(side) : '<span class="rtoon" aria-hidden="true">?</span>');
  const slots = () => {
    const isCpu = L.p2 === 'cpu';
    const pick = v => `<button class="seg${v === 'random' ? '' : ' ' + v}${L.pick === v ? ' on' : ''}" data-act="lside" data-side="${v}" aria-pressed="${L.pick === v}">${v === 'X' ? 'X' : v === 'O' ? 'O' : 'Random'}</button>`;
    return `<div class="slot ${s1 || 'R'} p1">
      <div class="who-p">${face(s1)}</div>
      <div class="sides three lside" role="group" aria-label="Player 1's side">${pick('X')}${pick('O')}${pick('random')}</div>
      <label class="field ${s1 || ''}"><span>Player 1 name${L.pick === 'random' ? ' · X or O, drawn every match' : ''}</span><input data-ln="n1" value="${esc(L.n1)}" maxlength="${NAME_MAX}" placeholder="${s1 || 'X or O'}" autocomplete="off" autocapitalize="words" aria-label="Player 1 name"></label></div>
    <div class="slot ${s2 || 'R'} p2${isCpu ? ' cpu' : ''}">
      <div class="who-p">${face(s2)}</div>
      <div class="kind" role="group" aria-label="Player 2"><button class="seg${isCpu ? '' : ' on'}" data-act="kind" data-kind="human" aria-pressed="${!isCpu}"${sc ? ' disabled' : ''}>Human</button><button class="seg${isCpu ? ' on' : ''}" data-act="kind" data-kind="cpu" aria-pressed="${isCpu}">Computer</button></div>
      <label class="field ${s2 || ''}">${isCpu ? `<i class="slot-ico" aria-hidden="true">${CPU_ICON}</i>` : ''}<span>Player 2 name</span><input data-ln="n2" value="${esc(L.n2)}" maxlength="${NAME_MAX}" placeholder="${isCpu ? CPU_NAME : s2 || 'X or O'}" autocomplete="off" autocapitalize="words" aria-label="Player 2 name"></label>
      ${isCpu ? `<div class="sides three level" role="group" aria-label="Computer level"><span>Level</span>${LEVELS.map(v => `<button class="seg${L.level === v ? ' on' : ''}" data-act="level" data-v="${v}" aria-pressed="${L.level === v}">${LEVEL_NAME[v]}</button>`).join('')}</div>` : ''}</div>`;
  };
  return `<main class="scr setup">
    <div class="bar">${host ? `<button class="back" data-act="lobby-back" aria-label="Close the room and go back">${CHEV}Back</button>` : `<button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>`}
      <div class="ttl"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>
    <div class="setup-box" data-keep-scroll="setup">
    ${room}
    ${host ? `<div class="names">${field('X')}${field('O')}</div>` : `<div class="slots">${slots()}</div>`}
    ${chaosVisible() ? `<div class="timerrow scmode" role="group" aria-label="Super Chaos"><span>Super Chaos ${chaosBadge()}${qBtn('superchaos', 'sm')}</span><button class="seg${sc ? '' : ' on'}" data-act="chaos" data-v="0" aria-pressed="${!sc}">Off</button><button class="seg${sc ? ' on' : ''}" data-act="chaos" data-v="1" aria-pressed="${sc}">On</button></div>` : ''}
    ${host ? sides : ''}
    ${timer}
    <div class="adv${advOpen ? ' open' : ''}"><button class="adv-h" data-act="adv" aria-expanded="${advOpen}"><span>Advanced</span><small>${on} of ${VT.length} mini-games on</small><i class="chev">${CHEV}</i></button>
      ${advOpen ? `<div class="games-top"><button class="btn selall" data-act="games-none"${on === 0 ? ' disabled' : ''}>Deselect all</button><button class="btn selall" data-act="games-all"${on === VT.length ? ' disabled' : ''}>Select all</button></div><div class="games">${byName(VT).map(chk).join('')}</div>` : ''}</div>
  </div>
  <div class="setup-foot"><button class="primary" data-act="start"${ready ? '' : ' disabled'}>Start match</button><small class="warn">${setupWarn(s)}</small></div></main>`;
}
// The Advanced checklist: one list in alphabetical order, each game's kind (meta.js: category) a small
// sticker on the row's top edge, by the "?" (no room taken from the name), its word on hover and for a screen reader.
export const byName = types => types.slice().sort((a, b) => INFO[a].name.localeCompare(INFO[b].name));
const CAT_SVG = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const CATS = {
  luck: ['Luck', CAT_SVG('<path d="M12 11.2C10.5 10 7.8 8.7 7.8 6.1a2.1 2.1 0 0 1 4.2 0 2.1 2.1 0 0 1 4.2 0c0 2.6-2.7 3.9-4.2 5.1z" transform="rotate(45 12 12)" fill="currentColor" stroke="none"/><path d="M12 11.2C10.5 10 7.8 8.7 7.8 6.1a2.1 2.1 0 0 1 4.2 0 2.1 2.1 0 0 1 4.2 0c0 2.6-2.7 3.9-4.2 5.1z" transform="rotate(135 12 12)" fill="currentColor" stroke="none"/><path d="M12 11.2C10.5 10 7.8 8.7 7.8 6.1a2.1 2.1 0 0 1 4.2 0 2.1 2.1 0 0 1 4.2 0c0 2.6-2.7 3.9-4.2 5.1z" transform="rotate(225 12 12)" fill="currentColor" stroke="none"/><path d="M12 11.2C10.5 10 7.8 8.7 7.8 6.1a2.1 2.1 0 0 1 4.2 0 2.1 2.1 0 0 1 4.2 0c0 2.6-2.7 3.9-4.2 5.1z" transform="rotate(315 12 12)" fill="currentColor" stroke="none"/><path d="M12 13c.1 3 .6 5.8 1.8 8.2"/>')],   // a four-leaf clover
  skill: ['Skill', CAT_SVG('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>')],   // a target
  brain: ['Brain', CAT_SVG('<path d="M12 4.5v15"/><path d="M12 6.5C12 4.8 10.6 3.8 9 3.8 7.3 3.8 6 5 6 6.6 4.4 6.9 3.5 8.3 3.5 9.8c0 1 .4 1.8 1.1 2.4-.7.6-1.1 1.5-1.1 2.5 0 1.7 1.3 3 2.9 3.2.3 1.6 1.6 2.6 3.1 2.6 1.4 0 2.5-1 2.5-2.5"/><path d="M12 6.5c0-1.7 1.4-2.7 3-2.7 1.7 0 3 1.2 3 2.8 1.6.3 2.5 1.7 2.5 3.2 0 1-.4 1.8-1.1 2.4.7.6 1.1 1.5 1.1 2.5 0 1.7-1.3 3-2.9 3.2-.3 1.6-1.6 2.6-3.1 2.6-1.4 0-2.5-1-2.5-2.5"/><path d="M7 10.5c1.3 0 2.2.8 2.2 2M17 10.5c-1.3 0-2.2.8-2.2 2"/>')],   // two halves
};
const catIcon = t => { const c = GAMES[t] && GAMES[t].meta.category, k = CATS[c]; return k ? `<i class="gcat ${c}" role="img" aria-label="${k[0]}" title="${k[0]}">${k[1]}</i>` : ''; };
// Start opens once at least one mini-game is on (online, also once the friend is in).
const onGames = s => enabledGames(s).filter(t => setupTypes().includes(t));   // the games on, among those this player may see (Super Chaos: its own)
function setupReady(s) { const on = onGames(s).length; return isHost() ? !!(on && state.online.joined && connected) : !!on; }
function setupWarn(s) { return !onGames(s).length ? 'Select at least one mini-game to start' : isHost() && !setupReady(s) ? 'Start opens once your friend has joined' : ''; }
// Ticking a mini-game (or Select all) changes the screen in place, with no re-render, so the list
// stays exactly where it was scrolled and Advanced stays open. The choice is saved for the next match.
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
  const n = app.querySelector('.adv-h small'); if (n) n.textContent = `${on} of ${VT.length} mini-games on`;
  const all = app.querySelector('[data-act="games-all"]'); if (all) all.disabled = on === VT.length;
  const none = app.querySelector('[data-act="games-none"]'); if (none) none.disabled = on === 0;
  const start = app.querySelector('[data-act="start"]'); if (start) start.disabled = !setupReady(s);
  const warn = app.querySelector('.setup-foot .warn'); if (warn) warn.textContent = setupWarn(s);
  dbSetup({ games: restrictGames(Object.assign({}, s.games), VT) });   // (the room never holds a game its host may not deal)
}
