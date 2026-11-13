// The online screens: Play a Friend, Join.
import { scTypes } from '../../core/chaos.js';
import { NAME_MAX, playerName } from '../../core/match.js';
import { setupSpec, timerLabel } from '../../core/timer.js';
import { other } from '../../core/util.js';
import { INFO, SC_ONLY, TYPES } from '../../games/index.js';
import { acct, loggedIn } from '../../net/accounts.js';
import { visibleTypes } from '../../net/releases.js';
import { joinCode, joinName, leaveLoses, net, online, room } from '../../net/room.js';
import { advOpen, esc, state } from '../app.js';
import { byName, gamesCount } from './setup.js';
import { CHEV, ICONS, gameIcon, toon } from '../art.js';
import { bubble, panel } from '../comic.js';
import { joinAsk } from '../input.js';

/* ----- online screens ----- */
// Play a Friend: host a room and share its code, or join one; or Same phone, two people taking turns on this phone.
export function renderFriend() {
  return `<main class="scr setup online-scr cc calm">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>
      <div class="ttl"><b>Play a Friend</b></div></div>
    <div class="online-mid" data-keep-scroll="friend"><div class="menu-card">
    <p class="ccfr" aria-hidden="true"><span class="pal X">${toon('X')}</span>${bubble('One hosts, one joins!', '', 'ccpunch')}<span class="pal O">${toon('O')}</span></p>
    ${panel('host', 'Host game', { tag: 'make a room', sub: 'you get a code to share', cls: 'y', k: 1 })}
    ${panel('join-go', 'Join game', { tag: 'got a code?', sub: 'type in the code you were sent', cls: 'c fr', k: 2 })}
    <button class="link wide same" data-act="same-go">Same phone</button>
  </div></div></main>`;
}
export function renderJoin() {
  const o = online(), seated = !!(o && o.me && o.joined);
  const hostSide = o && o.me ? other(o.me) : null;
  const hostName = seated && room && room.players && room.players[hostSide] ? room.players[hostSide].name : null;
  const timer = room && room.setup ? setupSpec(room.setup) : 'off';
  // Seated: the game as separate labelled lines, like the other setup screens.
  const sc = !!(room && room.setup && room.setup.chaos);
  const pool = TYPES.filter(t => (visibleTypes().includes(t) || (room && room.setup && room.setup.games && room.setup.games[t])) && (sc ? scTypes().includes(t) : !SC_ONLY.includes(t)));   // the games this guest knows of, and the host's (an admin host may deal games on test); Super Chaos deals only its own
  const games = room && room.setup && room.setup.games ? pool.filter(t => room.setup.games[t] !== false) : pool;
  const on = new Set(games), list = byName(pool);
  const info = seated && room ? `<div class="jinfo">
      <div class="field"><span>Opponent</span><div class="namebox">${esc(hostName || 'the host')}</div></div>
      ${sc ? '' : `<div class="field"><span>Timer</span><div class="namebox">${timerLabel(timer)}</div></div>`}
      <div class="adv jgames${advOpen ? ' open' : ''}"><button class="adv-h" data-act="adv" aria-expanded="${advOpen}"><span>Mini-games</span><small>${gamesCount(games.length, pool.length)}</small><i class="chev">${CHEV}</i></button>
        ${advOpen ? `<div class="games">${list.map(t => `<div class="chk ro${on.has(t) ? '' : ' off'}"><input type="checkbox" disabled${on.has(t) ? ' checked' : ''} aria-label="${esc(INFO[t].name)}: ${on.has(t) ? 'on' : 'off'}">${gameIcon(t)}<span>${INFO[t].name}</span></div>`).join('')}</div>` : ''}</div>
    </div>` : '';
  const status = net.status === 'error' ? `<div class="warn">${esc(net.msg)}</div>`
    : seated && room ? `${info}<div class="status ok">Waiting for <b>${esc(hostName || 'the host')}</b> to start…</div>`
    : o && net.status === 'connecting' ? `<div class="status">${esc(net.msg)}</div>`
    : o ? '<div class="status">Connected · waiting for the host…</div>' : '';
  const form = o ? '' : `${loggedIn() ? `<div class="field"><span>You play as</span><div class="namebox">${esc(acct.profile.username)}</div></div>` : `<label class="field"><span>Your name</span><input id="jname" value="${esc(joinName)}" maxlength="${NAME_MAX}" placeholder="Your name" autocomplete="off" autocapitalize="words"></label>`}
    <label class="field"><span>Room code</span><input id="jcode" class="codein" value="${esc(joinCode)}" maxlength="5" placeholder="ABCDE" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="latin"></label>`;
  return `<main class="scr setup cc calm join-scr">
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
