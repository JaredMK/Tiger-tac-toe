# Login setup: Google, Apple and email (both Firebase projects)

`scripts/smoke-login.js` checks this after every deploy and before every release: Google and email on, the authorized
domains, and Apple (a warning while it is off). Production is `tic-tac-chaos`, staging `tic-tac-chaos-staging`.
Team ID `2F7M8F9NBG`, app bundle ID `com.jaredkrosser.tictacchaos`.

## Sign in with Apple

Apple sign-in needs three things from Apple (an App ID with the capability, a Services ID, a key), then Firebase's Apple
provider in each project. Until the Firebase provider is on, every Apple sign-in (web and app) is refused with
`auth/operation-not-allowed` ("Apple sign-in isn't set up yet").

### A. Apple Developer (developer.apple.com → Account → Certificates, Identifiers & Profiles), once

1. **App ID.** Identifiers → `com.jaredkrosser.tictacchaos` → tick **Sign In with Apple** (Enable as a primary App ID)
   → Save. (Xcode's automatic signing then puts it in the provisioning profile; the entitlement is already in
   `ios/App/App/App.entitlements`.)
2. **Services ID** (the web's Apple sign-in; Firebase uses it for the web and the redirect). Identifiers → **+** →
   **Services IDs** → Continue.
   - Description: `Tic Tac Chaos web`
   - Identifier: `com.jaredkrosser.tictacchaos.web`
   - Register. Then open it, tick **Sign In with Apple** → **Configure**:
     - Primary App ID: `com.jaredkrosser.tictacchaos`
     - Domains and Subdomains (comma-separated, no `https://`):
       `tic-tac-chaos.firebaseapp.com, tic-tac-chaos-staging.firebaseapp.com, tictacchaos.com, staging.tictacchaos.com`
     - Return URLs (one per line):
       - `https://tic-tac-chaos.firebaseapp.com/__/auth/handler`
       - `https://tic-tac-chaos-staging.firebaseapp.com/__/auth/handler`
       - `https://tictacchaos.com/__/auth/handler`
       - `https://staging.tictacchaos.com/__/auth/handler`
     - Next → Done → Continue → **Save**.
3. **Key.** Keys → **+** → Key Name `Tic Tac Chaos Sign in with Apple` → tick **Sign in with Apple** → Configure →
   Primary App ID `com.jaredkrosser.tictacchaos` → Save → Continue → Register → **Download** the `.p8` file (only
   once: keep it safe, never in the repository). Note the **Key ID** (10 characters) shown with it.

One Services ID and one key serve both projects.

### B. Firebase console, in **each** project (tic-tac-chaos, then tic-tac-chaos-staging)

1. Authentication → **Sign-in method** → **Add new provider** (or the Apple row) → **Apple** → **Enable**.
2. Services ID: `com.jaredkrosser.tictacchaos.web`
3. OAuth code flow configuration:
   - Apple team ID: `2F7M8F9NBG`
   - Key ID: the key's 10-character ID
   - Private key: open the `.p8` file in a text editor and paste all of it, the BEGIN and END lines included.
4. **Save**. (The callback URL Firebase shows is the project's `https://<project>.firebaseapp.com/__/auth/handler`,
   already in the Services ID's Return URLs.)
5. Check: `node scripts/smoke-login.js production` and `node scripts/smoke-login.js staging` print
   `ok  Apple sign-in is on`. From then on, `--require-apple` (or `TTC_REQUIRE_APPLE=1`) makes Apple being off a failure.

The app's own Apple sign-in (the native sheet) uses the App ID's capability and the bundle ID; Firebase accepts its
token once the Apple provider is on (the bundle ID is the token's audience, which Firebase takes for an iOS app).

## Google

On in both projects (Authentication → Sign-in method → Google). The iOS app needs the project's
`GoogleService-Info.plist` built in (`npm run ios:build`, from `ios-config/`): without it the plugin starts without its
providers and both Google and Apple say "isn't set up in this version of the app yet" (error code `not-enabled`).

## Email

On in both projects (Email/Password). The staging deploy also signs in as `tester1@tictacchaos.com` with
`STAGING_TEST_PASSWORD`.
