// The online screens: Play Online, Play a Friend, Join.
import { scTypes } from '../../core/chaos.js';
import { NAME_MAX, playerName } from '../../core/match.js';
import { normTimer } from '../../core/timer.js';
import { other } from '../../core/util.js';
import { INFO, SC_ONLY, TYPES } from '../../games/index.js';
import { acct } from '../../net/accounts.js';
import { activeElsewhere, findOn } from '../../net/matchmaking.js';
import { scMode } from '../../net/releases.js';
import { modeRow } from './setup.js';
import { visibleTypes } from '../../net/releases.js';
import { joinCode, joinName, leaveLoses, net, online, room } from '../../net/room.js';
import { TIMER_LABEL, esc, state } from '../app.js';
import { CHEV, ICONS } from '../art.js';
import { joinAsk } from '../input.js';

/* ----- online screens ----- */
// Play Online: a friend (a room and its code) or Find a Match (anyone waiting).
export function renderOnline() {
  const back = activeElsewhere(), can = back || findOn;
  return `<main class="scr setup online-scr">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button></div>
    <div class="online-mid" data-keep-scroll="online"><div class="menu-card">
    <h1>Play Online</h1>
    <p class="sub">Play a friend with a room code, or find a match against anyone waiting. Both need an internet connection.</p>
    ${modeRow(scMode())}
    <button class="primary" data-act="friend-go">Play a Friend</button>
    <button class="primary mm${can ? '' : ' off'}" data-act="find-go"${can ? '' : ' disabled'}>${back ? 'Back to your match' : `Find a Match${can ? '' : '<small>Not available at this time</small>'}`}</button>
  </div></div></main>`;
}
export function renderFriend() {
  return `<main class="scr setup online-scr">
    <div class="bar"><button class="back" data-act="online-go" aria-label="Back to Play Online">${CHEV}Back</button></div>
    <div class="online-mid" data-keep-scroll="friend"><div class="menu-card">
    <h1>Play a Friend</h1>
    <p class="sub">One of you hosts a room and shares its code; the other joins.</p>
    <button class="primary" data-act="host">Host game</button>
    <button class="primary alt" data-act="join-go">Join game</button>
  </div></div></main>`;
}
export function renderJoin() {
  const o = online(), seated = !!(o && o.me && o.joined);
  const hostSide = o && o.me ? other(o.me) : null;
  const hostName = seated && room && room.players && room.players[hostSide] ? room.players[hostSide].name : null;
  const timer = room && room.setup ? normTimer(room.setup.timer) : 0;
  // Seated: the game as separate labelled lines, like the other setup screens.
  const sc = !!(room && room.setup && room.setup.chaos);
  const pool = TYPES.filter(t => (visibleTypes().includes(t) || (room && room.setup && room.setup.games && room.setup.games[t])) && (sc ? scTypes().includes(t) : !SC_ONLY.includes(t)));   // the games this guest knows of, and the host's (an admin host may deal games on test); Super Chaos deals only its own
  const games = room && room.setup && room.setup.games ? pool.filter(t => room.setup.games[t] !== false) : pool;
  const info = seated && room ? `<div class="jinfo">
      <div class="field"><span>Host</span><div class="namebox">${esc(hostName || 'the host')}</div></div>
      <div class="field"><span>Your side</span><div class="namebox">${room.setup && room.setup.hostPick === 'random' ? 'Drawn at random every match' : `<b class="side ${o.me}">${o.me}</b>`}</div></div>
      <div class="field"><span>Mode</span><div class="namebox">${sc ? 'Super Chaos · both move at once, 1 minute a round' : 'Classic'}</div></div>
      ${sc ? '' : `<div class="field"><span>Time per turn</span><div class="namebox">${TIMER_LABEL[timer]}</div></div>`}
      <div class="field"><span>Mini-games</span><div class="namebox${games.length === pool.length ? '' : ' gl'}">${games.length === pool.length ? `All ${pool.length}` : `<span>${games.length} of ${pool.length}</span><span class="gicons" aria-label="${esc(games.map(t => INFO[t].name).join(', '))}">${games.map(t => ICONS[t]).join('')}</span>`}</div></div>
    </div>` : '';
  const status = net.status === 'error' ? `<div class="warn">${esc(net.msg)}</div>`
    : seated && room ? `${info}<div class="status ok">Waiting for <b>${esc(hostName || 'the host')}</b> to start…</div>`
    : o && net.status === 'connecting' ? `<div class="status">${esc(net.msg)}</div>`
    : o ? '<div class="status">Connected · waiting for the host…</div>' : '';
  const form = o ? '' : `<label class="field"><span>Your name</span><input id="jname" value="${esc(joinName)}" maxlength="${NAME_MAX}" placeholder="Your name" autocomplete="off" autocapitalize="words"></label>
    <label class="field"><span>Room code</span><input id="jcode" class="codein" value="${esc(joinCode)}" maxlength="5" placeholder="ABCDE" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="latin"></label>`;
  return `<main class="scr setup">
    <div class="bar"><button class="back" data-act="lobby-back" aria-label="${o ? 'Leave the room and go back' : 'Back to Play a Friend'}">${CHEV}Back</button>
      <div class="ttl"><b>Join game</b><small>${o ? `Room ${esc(o.code)}` : 'Enter the code the host shared'}</small></div></div>
    <div class="setup-box" data-keep-scroll="setup">${form}${status}${o && net.status === 'error' ? '<button class="primary" data-act="rejoin">Try again</button>' : ''}</div>
    ${o ? '' : `<div class="setup-foot"><button class="primary" data-act="join">Join</button></div>`}</main>`;
}
export function renderJoinAsk() {
  if (!joinAsk) return '';
  const me = state.online ? state.online.me : state.setup.human === 'O' ? 'O' : 'X';
  const opp = me ? esc(playerName(state, other(me))) : 'someone';
  return `<div class="flash pause ask" role="dialog" aria-label="Join another game?"><div class="card"><h2>Join another game?</h2>
    <p>You're in a match with <b>${opp}</b>. Leave it and join this one?${leaveLoses() ? ' <b>Leaving counts as a loss.</b>' : ''}</p>
    <div class="row"><button class="btn" data-act="ask-stay">Stay</button><button class="btn go" data-act="ask-leave">Leave &amp; Join</button></div></div></div>`;
}
