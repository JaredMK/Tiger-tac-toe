// The main menu.
import { soundBtn } from '../../audio/sound.js';
import { acct, loggedIn } from '../../net/accounts.js';
import { esc, menuNote } from '../app.js';
import { toon } from '../art.js';
import { RATINGS_ENABLED } from '../config.js';
import { burstSvg } from '../fx.js';

/* ----- main menu ----- */
// The studio credit at the foot of the main menu: the JarHead Labs jar (drawn from the studio's logo) and a link to its X account.
const JARHEAD_URL = 'https://x.com/jarheadlabs';
const JARHEAD_LOGO = '<svg class="jhl" aria-hidden="true" focusable="false" viewBox="188 130 399 710"><defs><clipPath id="jhIn"><path d="M293 372V407C279 457 228 442 228 545V786Q228 800 242 800H529Q543 800 543 786V545C543 442 492 457 478 407V372Z"/></clipPath></defs><path fill="#243139" d="M269 301H501Q535 301 535 335V338Q535 372 508 380V404C517 424 574 444 574 535V819Q574 831 562 831H209Q197 831 197 819V535C197 444 254 424 262 404V380Q235 372 235 338V335Q235 301 269 301Z"/><path fill="#f6f3ec" d="M293 372V407C279 457 228 442 228 545V786Q228 800 242 800H529Q543 800 543 786V545C543 442 492 457 478 407V372Z"/><rect x="266" y="330" width="238" height="27" rx="5" fill="#f6f3ec"/><path clip-path="url(#jhIn)" fill="#57b2c4" d="M220 609C258 590 300 590 340 606S420 625 470 609 535 598 550 606V806H220Z"/><g fill="#243139"><ellipse cx="324.5" cy="494.5" rx="14" ry="24"/><ellipse cx="446" cy="495.5" rx="14" ry="24"/></g><path d="M340 550Q385.5 588 431 550" fill="none" stroke="#243139" stroke-width="20" stroke-linecap="round"/><g fill="#f6f3ec"><circle cx="435.5" cy="672" r="18.5"/><circle cx="379.5" cy="725.5" r="13.5"/></g><circle cx="362" cy="210" r="32" fill="#7651c2"/><circle cx="419.5" cy="274.5" r="20.5" fill="#57b2c4"/><path fill="#e8983f" d="M474 142H542Q552 142 552 152V197Q552 205 544 205H526Q518 205 518 213V233Q518 243 508 243H474Q464 243 464 233V152Q464 142 474 142Z"/></svg>';
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
