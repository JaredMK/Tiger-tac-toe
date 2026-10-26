// The iOS app's side of the shared code (net/platform.js, net/auth.js), with a Capacitor shell faked on `window`: the
// client says it is iOS, links and invites point at the production site, and Google and Apple sign in through the native
// plugin's credential into the same Firebase web SDK (signInWithCredential), never through a popup or a redirect.
import test from 'node:test';
import assert from 'node:assert/strict';

const calls = [];
globalThis.window = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {
  FirebaseAuthentication: {
    signInWithGoogle: async o => { calls.push(['google', o]); return { credential: { idToken: 'g-id', accessToken: 'g-at' } }; },
    signInWithApple: async o => { calls.push(['apple', o]); return { credential: { idToken: 'a-id', nonce: 'raw-nonce' } }; },
    signOut: async () => { calls.push(['signOut']); },
  },
  Share: { share: async o => { calls.push(['share', o]); } },
} } };
const P = await import('../../src/net/platform.js');
const { CLIENT_VERSION } = await import('../../src/core/client.js');
const { providerSignIn, providerSignOut } = await import('../../src/net/auth.js');

test('the app: the client is iOS at this code\'s version; links and invites name the production site', () => {
  assert.equal(P.PLATFORM, 'ios');
  assert.equal(P.NATIVE, true);
  assert.deepEqual(P.clientInfo(), { v: CLIENT_VERSION, p: 'ios' });
  assert.equal(P.siteUrl(), 'https://tictacchaos.com/', 'never capacitor://localhost');
});
test('the app: the invite goes to the native share sheet', async () => {
  assert.equal(await P.shareText('Join my Tic Tac Chaos game! Code: ABCDE https://tictacchaos.com/?room=ABCDE'), true);
  assert.deepEqual(calls.pop(), ['share', { text: 'Join my Tic Tac Chaos game! Code: ABCDE https://tictacchaos.com/?room=ABCDE' }]);
});
test('the app: Google and Apple sign in natively, the credential then into the web SDK (no popup, no redirect)', async () => {
  const signed = [];
  class OAuthProvider { constructor(id) { this.id = id; } credential(o) { return { provider: this.id, ...o }; } addScope() {} }
  const A = {
    OAuthProvider, GoogleAuthProvider: { credential: (id, at) => ({ provider: 'google.com', id, at }) },
    signInWithCredential: async (auth, cred) => { signed.push(cred); },
    signInWithPopup: () => { throw new Error('no popup in the app'); }, signInWithRedirect: () => { throw new Error('no redirect in the app'); },
  };
  const fb = { authM: A, auth: {} };
  assert.equal(await providerSignIn(fb, 'apple'), 'done');
  assert.deepEqual(calls.pop(), ['apple', { skipNativeAuth: true }]);
  assert.deepEqual(signed.pop(), { provider: 'apple.com', idToken: 'a-id', rawNonce: 'raw-nonce' });
  assert.equal(await providerSignIn(fb, 'google'), 'done');
  assert.deepEqual(calls.pop(), ['google', { skipNativeAuth: true }]);
  assert.deepEqual(signed.pop(), { provider: 'google.com', id: 'g-id', at: 'g-at' });
  await providerSignOut();
  assert.deepEqual(calls.pop(), ['signOut']);
});
