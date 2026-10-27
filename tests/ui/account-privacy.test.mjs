// The App Store's account requirements on the page: the privacy policy linked from the main menu, the login screen and the
// credits (a relative link on the web); "Verify your email" for an email-and-password account; My Stats' Delete account with
// its question; a stranger's profile shows the public record alone (their history and opponents are private).
// Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const { privacyUrl } = await import('../../src/net/platform.js');
const { renderMenu } = await import('../../src/ui/screens/menu.js');
const { renderLogin, renderVerify } = await import('../../src/ui/screens/account.js');
const { renderProfile, setProf } = await import('../../src/ui/screens/profile.js');
const { renderHowTo } = await import('../../src/ui/explainer.js');
const { acct, askDelete, cancelDelete, delState, grandfathered, setVerifySince, unverified } = await import('../../src/net/accounts.js');
const A = await import('../../src/net/accounts.js');
const { state } = await import('../../src/ui/app.js');

const LINK = /<a href="privacy\.html" target="_blank" rel="noopener noreferrer"/;
test('the privacy policy: a relative link on the web; from the main menu, the login screen and the credits', () => {
  assert.equal(privacyUrl(), 'privacy.html');
  state.screen = 'menu'; state.online = null;
  const menu = renderMenu();
  assert.match(menu, /<a class="privacy" href="privacy\.html" target="_blank" rel="noopener noreferrer"[^>]*>Privacy<\/a>/);
  assert.match(menu, /class="menu-foot"><a class="credit"/, 'beside the studio credit');
  const login = renderLogin(false);
  assert.match(login, /<p class="agree">By continuing you agree to the <a href="privacy\.html"[^>]*>Privacy policy<\/a>\.<\/p>/);
  const howto = renderHowTo();
  assert.match(howto, /<span>Credits<\/span>/, 'the credits always show (the privacy link is in them)');
  assert.match(howto, /<p class="priv">What the game keeps about you, and how to delete your account: <a href="privacy\.html"[^>]*>Privacy policy<\/a><\/p>/);
  assert.match(login, LINK); assert.match(howto, LINK);
});
test('"Verify your email": Continue, Send the link again, Log out, and a way back to the menu; nothing proved without a signed-in account', () => {
  const html = renderVerify();
  assert.match(html, /<b>Verify your email<\/b>/);
  for (const act of ['verify-retry', 'verify-resend', 'logout', 'menu']) assert.match(html, new RegExp(`data-act="${act}"`), act);
  assert.match(html, /We sent a verification link to <b><\/b>\. Open it, then tap Continue\./, 'no account on this page: no address');
  assert.equal(unverified(), false, 'no Firebase here: nothing to verify');
});
test('My Stats: Log out and Delete account; the question (No / Yes, delete) only after a tap, and gone on No', () => {
  acct.user = { uid: 'me', email: 'me@example.com' }; acct.profile = { username: 'me_too' };
  setProf({ uid: 'me', own: true, user: { username: 'me_too', wins: 2, losses: 1, draws: 0, games: 3, joined: 1700000000000 }, hist: [], local: {}, opps: [], view: 'online', back: 'menu' });
  let html = renderProfile();
  assert.match(html, /<b>My Stats<\/b>/);
  assert.match(html, /data-act="prof-hist"/, 'your own game history');
  assert.match(html, /Top opponents/);
  assert.match(html, /<button class="link wide" data-act="logout">Log out<\/button><button class="link wide delacct" data-act="del-account">Delete account<\/button>/);
  assert.doesNotMatch(html, /role="dialog"/, 'no question yet');
  askDelete();
  assert.equal(A.delState, 'ask');
  html = renderProfile();
  assert.match(html, /<div class="flash pause delask" role="dialog" aria-label="Delete your account\?"><div class="card"><h2>Delete your account\?<\/h2>/);
  assert.match(html, /deleted for good/);
  assert.match(html, /<button class="btn" data-act="del-cancel">No<\/button><button class="btn go" data-act="del-confirm">Yes, delete<\/button>/);
  cancelDelete();
  assert.equal(A.delState, null);
  assert.doesNotMatch(renderProfile(), /role="dialog"/);
  assert.equal(delState, null, 'as imported at the start');
});
test("someone else's profile: their public record, no game history, no opponents, no Delete account", () => {
  acct.user = { uid: 'me', email: 'me@example.com' }; acct.profile = { username: 'me_too' };
  setProf({ uid: 'them', own: false, user: { username: 'Zed_99', wins: 4, losses: 2, draws: 1, games: 7, friend: { wins: 1, losses: 0, draws: 0, games: 1 }, joined: 1700000000000 }, hist: null, local: null, opps: null, view: 'online', back: 'menu' });
  const html = renderProfile();
  assert.match(html, /<b>Zed_99<\/b><small>Player profile<\/small>/);
  assert.match(html, /<b>5-2-1<\/b>/, 'Find Match and friend games together');
  assert.match(html, /Find Match 4-2-1 · Friends 1-0-0/);
  assert.match(html, /<p class="hint center ppriv">Game history and opponents are private\.<\/p>/);
  for (const s of ['prof-hist', 'del-account', 'logout', 'Top opponents', 'ptabs']) assert.doesNotMatch(html, new RegExp(s), s);
  acct.user = null; acct.profile = null; setProf(null);
});

test('email verification: accounts made before the cutoff (config/verify/since) are grandfathered; with no cutoff set, every account is', () => {
  const made = iso => ({ metadata: { creationTime: new Date(iso).toUTCString() } });
  setVerifySince(null);
  assert.equal(grandfathered(made('2026-10-01')), true, 'no cutoff yet');
  setVerifySince(Date.parse('2026-11-01T00:00:00Z'));
  assert.equal(grandfathered(made('2026-10-31T23:59:00Z')), true, 'made before: treated as verified');
  assert.equal(grandfathered(made('2026-11-01T00:01:00Z')), false, 'made after: must verify');
  assert.equal(grandfathered({}), false, 'no creation time: must verify');
  setVerifySince('nonsense');
  assert.equal(grandfathered(made('2026-11-02')), true, 'a cutoff that is not a number counts as none');
  setVerifySince(null);
});
