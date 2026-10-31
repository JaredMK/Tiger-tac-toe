// What a failed login says (net/accounts.js authError): each way of logging in names itself and what to do, a code
// always beside a message that cannot say more, nothing for a sheet or window closed on purpose, and never "Wrong
// email or password" for Google or Apple. The cases are the ones the app's plugin and the web SDK really give.
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
globalThis.window = { TTC_ENV: { staging: false } };
const { authError } = await import('../../src/net/accounts.js');
const err = (code, message) => Object.assign(new Error(message || code), code ? { code } : {});

test('the app built without its Firebase file: the plugin says the provider is not enabled', () => {
  const g = authError(err('', 'Google sign-in provider is not enabled. Make sure to add the provider to the providers list in the Capacitor configuration.'), 'google');
  assert.equal(g.text, "Google sign-in isn't set up in this version of the app yet. Use Apple or email for now.");
  assert.equal(g.code, 'not-enabled');
  const a = authError(err('', 'Apple sign-in provider is not enabled. Make sure to add the provider to the providers list in the Capacitor configuration.'), 'apple');
  assert.match(a.text, /^Apple sign-in isn't set up in this version of the app yet\./);
});
test('a provider switched off in Firebase: "isn\'t set up yet", with the code', () => {
  const a = authError(err('auth/operation-not-allowed'), 'apple');
  assert.equal(a.text, "Apple sign-in isn't set up yet. Use Google or email for now.");
  assert.equal(a.code, 'auth/operation-not-allowed');
  assert.match(authError(err('auth/operation-not-allowed'), 'email').text, /Email login isn't available/);
});
test("Apple's sheet failing to start (AuthorizationError 1000) and a refused token", () => {
  assert.match(authError(err('1000', 'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1000.)'), 'apple').text, /^Apple sign-in couldn't start\./);
  const g = authError(err('auth/invalid-credential', 'Firebase: Unable to parse Google id_token'), 'google');
  assert.match(g.text, /^Google didn't accept the sign-in/);
  assert.equal(authError(err('auth/invalid-credential'), 'email').text, 'Wrong email or password.', 'only email gets the password message');
});
test('closed on purpose says nothing; anything else names its code', () => {
  assert.equal(authError(err('auth/popup-closed-by-user'), 'google'), null);
  assert.equal(authError(err('1001', 'The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)'), 'apple'), null);
  assert.equal(authError(err('', 'The user canceled the sign-in flow.'), 'google'), null);
  const x = authError(err('auth/some-new-thing'), 'google');
  assert.equal(x.text, "Couldn't log in. Try again.");
  assert.equal(x.code, 'auth/some-new-thing');
  assert.equal(authError(err('', 'odd'), 'google').code, 'Error');
});
