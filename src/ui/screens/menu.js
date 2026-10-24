// The main menu.
import { soundBtn } from '../../audio/sound.js';
import { acct, loggedIn } from '../../net/accounts.js';
import { esc, menuNote } from '../app.js';
import { toon } from '../art.js';
import { RATINGS_ENABLED } from '../config.js';
import { burstSvg } from '../fx.js';

/* ----- main menu ----- */
// The studio credit at the foot of the main menu: the JarHead Labs jar (assets/brand/jarhad-labs-logo.svg, the studio's logo, without its background) and a link to its X account.
const JARHEAD_URL = 'https://x.com/jarheadlabs';
const JARHEAD_LOGO = '<svg class="jhl" aria-hidden="true" focusable="false" viewBox="296 106 434 764"><defs><clipPath id="jhIn"><path d="M401 365V402C401 436 321 432 321 497V790Q321 854 385 854H640Q704 854 704 790V497C704 432 624 436 624 402V365Z"/></clipPath></defs><path d="M611 136V186H663" fill="none" stroke="#f7982e" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/><circle cx="490" cy="186" r="32" fill="#8150b5"/><circle cx="553" cy="252" r="17" fill="#00adbf"/><path d="M401 365V402C401 436 321 432 321 497V790Q321 854 385 854H640Q704 854 704 790V497C704 432 624 436 624 402V365Z" fill="#ffffff"/><path clip-path="url(#jhIn)" d="M300 612C372 586 420 628 488 610S612 566 730 578V880H300Z" fill="#00adbf"/><circle cx="568" cy="682" r="19" fill="#ffffff"/><circle cx="505" cy="740" r="13" fill="#ffffff"/><path d="M401 365V402C401 436 321 432 321 497V790Q321 854 385 854H640Q704 854 704 790V497C704 432 624 436 624 402V365" fill="none" stroke="#0f2a30" stroke-width="22" stroke-linejoin="round"/><rect x="371" y="301" width="283" height="53" rx="20" fill="#ffffff" stroke="#0f2a30" stroke-width="22"/><ellipse cx="443" cy="500" rx="15" ry="23" fill="#0f2a30"/><ellipse cx="577" cy="500" rx="15" ry="23" fill="#0f2a30"/><path d="M472 551Q510 586 548 551" fill="none" stroke="#0f2a30" stroke-width="18" stroke-linecap="round"/></svg>';
export function renderMenu() {
  return `<main class="scr menu">${menuTop()}<div class="menu-card">
    <h1 class="title"><span class="sr">Tic Tac Chaos</span><span class="ttop wob" aria-hidden="true">${'TIC TAC'.split('').map((c, k) => c === ' ' ? '<span>&nbsp;</span>' : `<span style="animation-delay:${(k * .09).toFixed(2)}s">${c}</span>`).join('')}</span><span class="chaos wob">${burstSvg('CHAOS!', 'r', 300, 150, 54)}</span></h1>
    <div class="pals" aria-hidden="true">${toon('X')}${toon('O')}</div>${menuNote ? `<div class="notice" role="status">${esc(menuNote)}</div>` : ''}
    <button class="primary" data-act="mode-go" data-mode="local">Play Local</button>
    <button class="primary alt" data-act="online-go">Play Online</button>
    <button class="btn howto" data-act="howto">How to Play</button>
  </div><a class="credit" href="${JARHEAD_URL}" target="_blank" rel="noopener noreferrer" aria-label="by JarHead Labs, on X (opens in a new tab)">${JARHEAD_LOGO}<span>by JarHead Labs</span></a></main>`;
}
// The main menu's top row: My Stats (or the leaderboard, with ratings on), and the account (Log in, or your username).
export let acctLoading = false;                     // a returning player's account is being fetched at start
function menuTop() {
  const p = acct.profile;
  const chip = loggedIn() ? (RATINGS_ENABLED ? `<button class="btn chip in" data-act="profile" aria-label="Your profile: ${esc(p.username)}, rating ${p.rating}"><span>${esc(p.username)}</span><b>${p.rating}</b></button>`
      : `<button class="btn chip in" data-act="profile" aria-label="Your profile: ${esc(p.username)}"><span>${esc(p.username)}</span></button>`)
    : acct.user && acct.ready ? '<button class="btn chip" data-act="login">Pick a username</button>'
    : acct.user || acctLoading ? '<button class="btn chip" disabled aria-label="Loading your account">…</button>'
    : '<button class="btn chip" data-act="login">Log in</button>';
  const left = RATINGS_ENABLED ? '<button class="btn" data-act="leaderboard">Leaderboard</button>' : '';   // your stats: tap your username
  const sound = soundBtn('menu');   // the sound switch, beside the top-left corner
  return `<div class="menu-top"><div class="menu-left">${left}${sound}</div>${chip}</div>`;
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setAcctLoading(v) { acctLoading = v; }
