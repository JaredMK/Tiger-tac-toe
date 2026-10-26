// The login and username screens.
import { acct, gate, gateEmail, loginBusy, loginFinishing, loginMail, loginMsg, loginPass, unameDraft, unameMsg } from '../../net/accounts.js';
import { esc } from '../app.js';
import { CHEV, toon } from '../art.js';

// The sign-in buttons follow each brand's own guidelines, logos included (the one exception to the game's no-logos rule,
// CLAUDE.md "Original art only"): Google's "G" on a white button with a grey border, Roboto Medium; Apple's mark on a black
// button in the system font, "Continue with Apple". Both at least 44px tall, the logo at the left, the text centred.
export const GOOGLE_G = '<svg class="sso-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
export const APPLE_MARK = '<svg class="sso-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>';
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
      <button class="sso google" data-act="login-google"${off}>${GOOGLE_G}<span>Continue with Google</span></button>
      <button class="sso apple" data-act="login-apple"${off}>${APPLE_MARK}<span>Continue with Apple</span></button>
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
