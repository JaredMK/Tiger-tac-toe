// Signing in with Google or Apple, wherever the game runs. The account is always a Firebase Auth one (the same project,
// accounts and data on the web and in the app); only how the provider's credential is got differs:
//   the web page: Firebase Auth's own sign-in window (or, where there is none, the whole page goes to the provider and
//     comes back: a redirect, finished by connect.js getRedirectResult);
//   the iOS app: the native sign-in sheets (Google's SDK, Sign in with Apple) through the Capacitor Firebase Authentication
//     plugin (@capacitor-firebase/authentication, skipNativeAuth: it hands back the provider's tokens and signs nothing in
//     itself), then that credential into the same web SDK (signInWithCredential), so every listener here works unchanged.
// The plugin is looked up on the page (window.Capacitor.Plugins), never imported: the web page carries none of it.
import { NATIVE } from './platform.js';

export const PROVIDERS = ['google', 'apple'];
const nativeAuth = () => (NATIVE && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FirebaseAuthentication) || null;
function webProvider(A, how) {
  if (how === 'google') return new A.GoogleAuthProvider();
  const p = new A.OAuthProvider('apple.com');                      // Sign in with Apple (the Firebase console's Apple provider)
  p.addScope('email'); p.addScope('name');
  return p;
}
// Signs in with the provider. Returns 'done' (signed in), or 'away' (the page is going to the provider and will come back
// signed in: `beforeAway` is called first, to remember where the player was heading). Throws Firebase Auth's errors.
export async function providerSignIn(fb, how, beforeAway) {
  const A = fb.authM, hook = window.TTT_FIREBASE || null;
  const nat = nativeAuth();
  if (nat) {
    if (how === 'google') {
      const r = await nat.signInWithGoogle({ skipNativeAuth: true });
      const c = (r && r.credential) || {};
      await A.signInWithCredential(fb.auth, A.GoogleAuthProvider.credential(c.idToken || null, c.accessToken || null));
    } else {
      const r = await nat.signInWithApple({ skipNativeAuth: true });
      const c = (r && r.credential) || {};
      await A.signInWithCredential(fb.auth, new A.OAuthProvider('apple.com').credential({ idToken: c.idToken, rawNonce: c.nonce }));
    }
    return 'done';
  }
  const popup = (hook && hook.popup) || A.signInWithPopup;          // (the tests: the emulator's sign-in, without its window)
  try { await popup(fb.auth, webProvider(A, how)); return 'done'; }
  catch (e) {
    if (!/popup-blocked|operation-not-supported|web-storage-unsupported/.test(String(e && e.code))) throw e;
    if (beforeAway) beforeAway();                                    // no sign-in window here: the whole page goes to the provider and comes back
    await ((hook && hook.redirect) || A.signInWithRedirect)(fb.auth, webProvider(A, how));
    return 'away';
  }
}
// Logging out: the app's native session too (so the next sign-in asks again which account).
export async function providerSignOut() {
  const nat = nativeAuth();
  if (nat) await nat.signOut().catch(() => {});
}
// Deleting an account that signs in with Apple (App Store Review Guideline 5.1.1(v)): its Sign in with Apple token is revoked
// first. In the app the native sheet is asked once more for a fresh authorization code, which Firebase Auth hands to Apple
// (revokeAccessToken: needs the Apple provider's Services ID and key in the Firebase console, docs/login-setup.md).
// Returns 'none' (no Apple sign-in on the account, or not in the app: the web shows no Apple button), 'revoked', or
// 'cancelled' (the player closed the sheet: the account stays). A failed revocation throws, for the caller to log.
export const usesApple = u => !!(u && (u.providerData || []).some(p => p && p.providerId === 'apple.com'));
export async function appleRevoke(fb) {
  const nat = nativeAuth(), u = fb && fb.auth && fb.auth.currentUser;
  if (!nat || !usesApple(u)) return 'none';
  let r;
  try { r = await nat.signInWithApple({ skipNativeAuth: true }); }
  catch (e) { if (/cancel|1001/i.test(String((e && (e.code || e.message)) || e))) return 'cancelled'; throw e; }
  const code = r && r.credential && r.credential.authorizationCode;
  if (!code) throw new Error('Sign in with Apple gave no authorization code');
  await fb.authM.revokeAccessToken(fb.auth, code);
  return 'revoked';
}
