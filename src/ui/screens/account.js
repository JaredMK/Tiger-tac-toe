// The login and username screens.
import { acct, loginBusy, loginFinishing, loginMail, loginMsg, loginPass, unameDraft, unameMsg } from '../../net/accounts.js';
import { esc } from '../app.js';
import { CHEV, toon } from '../art.js';

/* ----- the screens ----- */
export function renderLogin() {
  if (acct.user || loginFinishing) {                       // signed in: the profile is on its way, then the username or the menu
    return `<main class="scr setup acct-scr">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>
      <div class="ttl"><b>Log in</b><small>Signed in</small></div></div>
    <div class="setup-box"><div class="searching" role="status" aria-live="polite"><div class="spinner" aria-hidden="true">${toon('X')}${toon('O')}</div><h2>Logging you in…</h2></div></div></main>`;
  }
  const msg = loginMsg ? `<div class="${loginMsg.ok ? 'status ok' : 'warn'}" role="status">${esc(loginMsg.text)}</div>` : '';
  const off = loginBusy ? ' disabled' : '';
  return `<main class="scr setup acct-scr">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>
      <div class="ttl"><b>Log in</b><small>For Find Match, your stats and your game history</small></div></div>
    <div class="setup-box" data-keep-scroll="login">
      <button class="primary google" data-act="login-google"${off}>Continue with Google</button>
      <div class="or"><span>or with your email</span></div>
      <label class="field"><span>Email</span><input id="lemail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="${esc(loginMail)}"></label>
      <label class="field"><span>Password</span><input id="lpass" type="password" autocomplete="current-password" value="${esc(loginPass)}"></label>
      ${msg}
      <div class="row2"><button class="btn go" data-act="login-email"${off}>Log in</button><button class="btn" data-act="login-create"${off}>Create account</button></div>
      <button class="link wide" data-act="login-reset"${off}>Forgot password?</button>
    </div></main>`;
}
export function renderUsername() {
  return `<main class="scr setup acct-scr">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>
      <div class="ttl"><b>Pick a username</b><small>It is how other players see you, and it can't be changed later</small></div></div>
    <div class="setup-box" data-keep-scroll="username">
      <label class="field"><span>Username</span><input id="uname" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(unameDraft)}"></label>
      <p class="hint">3 to 16 letters, numbers or underscores.</p>
      ${unameMsg ? `<div class="warn" role="status">${esc(unameMsg)}</div>` : ''}
      <button class="primary" data-act="uname-save"${loginBusy ? ' disabled' : ''}>Save</button>
      <button class="link wide" data-act="logout">Log out</button>
    </div></main>`;
}
