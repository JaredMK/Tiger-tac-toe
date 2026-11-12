// The main menu.
import { acct, loggedIn, pendingMe } from '../../net/accounts.js';
import { activeElsewhere, findOn, resumable, resumeBusy } from '../../net/matchmaking.js';
import { privacyUrl } from '../../net/platform.js';
import { esc, menuNote } from '../app.js';
import { toon } from '../art.js';
import { APP_VERSION, RATINGS_ENABLED } from '../config.js';
import { burstSvg } from '../fx.js';
import { ICON, roundStk, tape } from '../stickers.js';

/* ----- main menu ----- */
// The studio credit at the foot of the main menu: the JarHead Labs jar (assets/brand/jarhad-labs-logo.svg, the studio's logo, without its background) and a link to its X account.
const JARHEAD_URL = 'https://x.com/jarheadlabs';
const JARHEAD_LOGO = '<svg class="jhl" aria-hidden="true" focusable="false" viewBox="296 106 434 764"><defs><clipPath id="jhIn"><path d="M401 365V402C401 436 321 432 321 497V790Q321 854 385 854H640Q704 854 704 790V497C704 432 624 436 624 402V365Z"/></clipPath></defs><path d="M611 136V186H663" fill="none" stroke="#f7982e" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/><circle cx="490" cy="186" r="32" fill="#8150b5"/><circle cx="553" cy="252" r="17" fill="#00adbf"/><path d="M401 365V402C401 436 321 432 321 497V790Q321 854 385 854H640Q704 854 704 790V497C704 432 624 436 624 402V365Z" fill="#ffffff"/><path clip-path="url(#jhIn)" d="M300 612C372 586 420 628 488 610S612 566 730 578V880H300Z" fill="#00adbf"/><circle cx="568" cy="682" r="19" fill="#ffffff"/><circle cx="505" cy="740" r="13" fill="#ffffff"/><path d="M401 365V402C401 436 321 432 321 497V790Q321 854 385 854H640Q704 854 704 790V497C704 432 624 436 624 402V365" fill="none" stroke="#0f2a30" stroke-width="22" stroke-linejoin="round"/><rect x="371" y="301" width="283" height="53" rx="20" fill="#ffffff" stroke="#0f2a30" stroke-width="22"/><ellipse cx="443" cy="500" rx="15" ry="23" fill="#0f2a30"/><ellipse cx="577" cy="500" rx="15" ry="23" fill="#0f2a30"/><path d="M472 551Q510 586 548 551" fill="none" stroke="#0f2a30" stroke-width="18" stroke-linecap="round"/></svg>';
export function renderMenu() {
  // The Sticker book (stickers.css): the logo taped down with the X and O stuck beside it, a sticker for each way to
  // play with a line of what it is, Find Match a small "soon" tag while the admin has it off, round stickers for the
  // rules and the settings. The order of the controls (and their data-act) is the menu's as ever.
  return `<main class="scr menu sb">${menuTop()}<div class="menu-card">
    <div class="stk logo slap">${tape('y')}${tape('b')}<h1 class="title"><span class="sr">Tic Tac Chaos</span><span class="ttop wob" aria-hidden="true">${'TIC TAC'.split('').map((c, k) => c === ' ' ? '<span>&nbsp;</span>' : `<span style="animation-delay:${(k * .09).toFixed(2)}s">${c}</span>`).join('')}</span><span class="chaos wob">${burstSvg('CHAOS!', 'r', 300, 150, 54)}</span></h1>
      <div class="pals" aria-hidden="true"><span class="stk rd pal X">${toon('X')}</span><span class="stk rd pal O">${toon('O')}</span></div></div>
    <p class="hand">every square is a <span class="hl">mini-game!</span></p>${menuNote ? `<div class="notice" role="status">${esc(menuNote)}</div>` : ''}
    ${resumable ? `<button class="stk mode m-res" data-act="resume" style="--k:2"${resumeBusy ? ' disabled' : ''}><b>Resume match</b><small>pick up where you left off</small></button>` : ''}
    <button class="stk mode m-cpu" data-act="cpu-go" style="--k:3"><b>Play Computer</b><small>you vs the machine</small></button>
    <button class="stk mode m-friend" data-act="friend-go" style="--k:4"><b>Play a Friend</b><small>share a code, or pass the phone</small></button>
    ${findBtn()}
    <div class="menu-rounds">${roundStk('howto', ICON.help, 'how to play', { r: -5, k: 6 })}${roundStk('settings', ICON.cog, 'settings', { r: 4, k: 7 })}</div>
  </div><div class="menu-foot"><a class="credit" href="${JARHEAD_URL}" target="_blank" rel="noopener noreferrer" aria-label="by JarHead Labs, on X (opens in a new tab)">${JARHEAD_LOGO}<span>by JarHead Labs</span></a><a class="privacy" href="${privacyUrl()}" target="_blank" rel="noopener noreferrer" aria-label="Privacy policy (opens in a new tab)">Privacy</a><span class="build" aria-label="Build ${esc(APP_VERSION)}">${esc(APP_VERSION)}</span></div></main>`;
}
// Find Match: a sticker like the others while it is on (back into the match in progress if there is one); while the
// admin has it off, a small tag that says soon (still a disabled button: the menu's controls keep their order).
function findBtn() {
  const back = activeElsewhere();
  if (back) return '<button class="stk mode m-find" data-act="find-go" style="--k:5"><b>Back to your match</b><small>it\'s still on</small></button>';
  if (findOn) return '<button class="stk mode m-find" data-act="find-go" style="--k:5"><b>Find Match</b><small>meet a rival</small></button>';
  return '<button class="stk soon slap" data-act="find-go" style="--k:5" disabled aria-label="Find Match: coming soon">Find Match<small>soon</small></button>';
}
// The main menu's top row: My Stats (or the leaderboard, with ratings on), and the account (Log in, or your username).
export let acctLoading = false;                     // a returning player's account is being fetched at start
function menuTop() {
  const p = acct.profile;
  const chip = loggedIn() ? (RATINGS_ENABLED ? `<button class="btn chip in" data-act="profile" aria-label="Your profile: ${esc(p.username)}, rating ${p.rating}"><span>${esc(p.username)}</span><b>${p.rating}</b></button>`
      : `<button class="btn chip in" data-act="profile" aria-label="Your profile: ${esc(p.username)}"><span>${esc(p.username)}</span></button>`)
    : pendingMe() ? `<button class="btn chip in" data-act="profile" aria-label="Your profile: ${esc(pendingMe().username)}"><span>${esc(pendingMe().username)}</span></button>`   // (the last account on this phone, while its sign-in comes back: never "…")
    : acct.user && acct.ready ? '<button class="btn chip" data-act="login">Pick a username</button>'
    : acct.user || acctLoading ? '<button class="btn chip" disabled aria-label="Loading your account">…</button>'
    : '<button class="btn chip" data-act="login">Log in</button>';
  const left = RATINGS_ENABLED ? '<button class="btn" data-act="leaderboard">Leaderboard</button>' : '';   // your stats: tap your username
  return `<div class="menu-top"><div class="menu-left">${left}</div>${chip}</div>`;   // (sound and the rest: Settings)
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setAcctLoading(v) { acctLoading = v; }
