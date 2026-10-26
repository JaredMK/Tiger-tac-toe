// The login, username and "Verify your email" screens.
import { acct, gate, gateEmail, loginBusy, loginFinishing, loginMail, loginMsg, loginPass, unameDraft, unameMsg, verifyEmail } from '../../net/accounts.js';
import { privacyUrl } from '../../net/platform.js';
import { esc } from '../app.js';
import { CHEV, toon } from '../art.js';

// The privacy policy, from the login screen (and the main menu and the credits): privacy.html, opened outside the game.
const privacyLink = label => `<a href="${privacyUrl()}" target="_blank" rel="noopener noreferrer">${label}</a>`;

/* ----- the screens ----- */
// Staging's gate: nothing else of the page until the player has logged in with an account on the allowlist.
export function renderGate() {
  const shell = (title, body) => `<main class="scr setup acct-scr gate-scr">
    <div class="bar"><div class="ttl"><b>${title}</b><small>Staging: for testers on the list only</small></div></div>
    <div class="setup-box">${body}</div></main>`;
  const out = '<button class="btn" data-act="gate-out">Log out</button>';
  if (gate === 'login') return renderLogin(true);
  if (gate === 'verify') return shell('Verify your email', `<p class="hint">Open the verification link sent to <b>${esc(gateEmail)}</b>, then tap Continue.</p>
    ${loginMsg ? `<div class="status ok" role="status">${esc(loginMsg.text)}</div>` : ''}<button class="primary" data-act="gate-retry">Continue</button><button class="btn" data-act="gate-resend">Send the link again</button>${out}`);
  if (gate === 'denied') return shell('Not on the list', `<p class="hint"><b>${esc(gateEmail || 'This account')}</b> is not on the staging list. Ask the admin to add it, then tap Check again.</p>
    <button class="primary" data-act="gate-retry">Check again</button>${out}`);
  if (gate === 'offline') return shell('No connection', '<p class="hint">Check your internet, then try again.</p><button class="primary" data-act="gate-retry">Try again</button>');
  return shell('Staging', `<div class="searching" role="status" aria-live="polite"><div class="spinner" aria-hidden="true">${toon('X')}${toon('O')}</div><h2>Checking access…</h2></div>`);
}
export function renderLogin(gated) {
  if (acct.user || loginFinishing) {                       // signed in: the profile is on its way, then the username or the menu
    return `<main class="scr setup acct-scr">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>
      <div class="ttl"><b>Log in</b><small>Signed in</small></div></div>
    <div class="setup-box"><div class="searching" role="status" aria-live="polite"><div class="spinner" aria-hidden="true">${toon('X')}${toon('O')}</div><h2>Logging you in…</h2></div></div></main>`;
  }
  const msg = loginMsg ? `<div class="${loginMsg.ok ? 'status ok' : 'warn'}" role="status">${esc(loginMsg.text)}</div>` : '';
  const off = loginBusy ? ' disabled' : '';
  return `<main class="scr setup acct-scr">
    <div class="bar">${gated ? '' : `<button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>`}
      <div class="ttl"><b>Log in</b><small>${gated ? 'Staging: for testers on the list only' : 'For Find Match, your stats and your game history'}</small></div></div>
    <div class="setup-box" data-keep-scroll="login">
      <button class="primary google" data-act="login-google"${off}>Continue with Google</button>
      <button class="primary apple" data-act="login-apple"${off}>Continue with Apple</button>
      <div class="or"><span>or with your email</span></div>
      <label class="field"><span>Email</span><input id="lemail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="${esc(loginMail)}"></label>
      <label class="field"><span>Password</span><input id="lpass" type="password" autocomplete="current-password" value="${esc(loginPass)}"></label>
      ${msg}
      <div class="row2"><button class="btn go" data-act="login-email"${off}>Log in</button><button class="btn" data-act="login-create"${off}>Create account</button></div>
      <button class="link wide" data-act="login-reset"${off}>Forgot password?</button>
      <p class="agree">By continuing you agree to the ${privacyLink('Privacy policy')}.</p>
    </div></main>`;
}
// An email-and-password account proves its address before Find Match, hosting or a username (the server refuses until
// then: { verify: true }, net/accounts.js needVerify). Continue checks again, the link can be sent again, or log out.
export function renderVerify() {
  const off = loginBusy ? ' disabled' : '';
  return `<main class="scr setup acct-scr verify-scr">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>
      <div class="ttl"><b>Verify your email</b><small>Find Match, hosting and your username need a verified email</small></div></div>
    <div class="setup-box" data-keep-scroll="verify">
      <p class="hint">We sent a verification link to <b>${esc(verifyEmail())}</b>. Open it, then tap Continue.</p>
      ${loginMsg ? `<div class="${loginMsg.ok ? 'status ok' : 'warn'}" role="status">${esc(loginMsg.text)}</div>` : ''}
      <button class="primary" data-act="verify-retry"${off}>Continue</button>
      <button class="btn" data-act="verify-resend"${off}>Send the link again</button>
      <button class="link wide" data-act="logout">Log out</button>
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
