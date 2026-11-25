# Tic Tac Chaos on iOS: the plan

The iOS app is the same game in a native shell (Capacitor). It uses the same Firebase project, accounts, live config and
Find Match queue as the web page, so web and iOS players are matched with each other. The project is built and committed
(`ios/`, section 7); **section 8 is the current build's audit, the exact steps to TestFlight and the phone checklist.**
This page covers what the code already does for it, what you need, how to set it up, what Apple requires, and a checklist
to reach TestFlight.

## 1. What the code already does

- **Client versions and platforms** (`src/core/client.js`, `src/net/platform.js`):
  - Every server call and app-open event says which client sent it: `{ v: CLIENT_VERSION, p: 'web' | 'ios' }`.
  - Each mini-game declares the oldest client version that has it (`minVersion` in its `meta.js`).
  - Find Match, friend rooms and bot matches deal only games that both players' clients have and that are switched on
    for both their platforms.
  - The admin's Releases page has an **iOS on/off** switch per game. It sets `releases/platform/ios/{type}`, and the app
    hides the game when it is off.
  - The admin's Releases page also has a **Clients** card: the minimum supported version per platform
    (`config/clients`). Below it, the game shows "Please update", and the server refuses that client a new match.
- **Sign-in** (`src/net/auth.js`):
  - Google, Apple and email, on the web today.
  - In the app, Google and Apple go through the native sign-in sheets (the `@capacitor-firebase/authentication` plugin
    with `skipNativeAuth: true`). The resulting credential then goes into the same Firebase web SDK
    (`signInWithCredential`), so accounts are identical on both platforms.
- **No browser-tab assumptions:**
  - No core flow relies on a page reload, `window.open` or navigating the address (`tests/ui/ios-ready.test.mjs` checks
    this).
  - Sharing, copying, opening outside pages and "Please update" all go through `src/net/platform.js`.
  - Staging's tester gate opens without a reload.
- **Deep links:**
  - Join links (`https://tictacchaos.com/join/CODE`, the invite's link, and the older `/?room=CODE`) and the alert's
    Find Match link work as Universal Links (the site's `apple-app-site-association` lists `/join/*`).
  - The app handles a link when it starts and while it runs (Capacitor's `appUrlOpen` event, `main.js` `openLink`).
  - Once `scripts/app-config.js` holds the Team ID and bundle ID, every site build publishes
    `/.well-known/apple-app-site-association`.
- **Native touches, harmless on the web** (`src/net/platform.js`):
  - **Haptics:** `haptic(kind)` buzzes through the Capacitor Haptics plugin (a phone browser with `navigator.vibrate`
    gets a plain buzz; iPhone Safari has none, so on an iPhone only the app buzzes). The map is `ui/haptics.js`: a light
    impact for a square opened and every move made on this phone, a medium one for a result landing and a claimed
    square, the success pattern for a mini-game won, heavy then success for the match, the error pattern for a refused
    move, a bust or a lost square, and two medium pulses with the `yourTurn` chime when the turn comes back. Each fires
    once, from its event, only with Settings' Vibration on.
  - **Connection lost:** during an online match, `.info/connected` false for 3 seconds shows a full-width band over the
    board or the mini-game ("Connection lost — reconnecting…", `ui/turnbar.js`; the board stays visible) and bounces the
    SDK's socket every 10 seconds until it is back (`net/connect.js` `lostWatch`, `NET_LOST`). Coming back from the
    background (`visibilitychange`) bounces the socket at once and ticks the clock; `net/room.js` then re-reads the
    record (`resync`). `tests/ui/netlost.test.mjs` covers it.
  - **Safe areas:** `viewport-fit=cover`; `#app` pads by `--sat/--sab/--sal/--sar` (`styles.css` `:root`), so the top bar,
    the screens and the bottom buttons keep clear of the notch and the home bar; the overlays laid from the page's edges
    (explainer, side reveal, join question, report dialog, the refused note, the reaction dock, the sound chip) use the
    same variables. Keep `"contentInset": "never"` in `capacitor.config.json` so the web view runs under the status bar.
  - **iPad:** at 700px and wider the board and every mini-game keep to 600px (`--gw` cap) and the turn bar's rows, a
    mini-game's title bar and the board's foot to 720px, centred (the end of `styles.css`). Nothing scrolls at 768x1024,
    1024x768 or 1180x820. Keep `UIRequiresFullScreen` off only if the layout is checked at Split View widths too.
- **The app's web files** (`npm run build:app`, `scripts/build-app.js`):
  - The site build goes into `_app/`.
  - `index.html` gets a `<meta name="ttc-env">` tag naming the Firebase project. Inside the app the page's address is
    `capacitor://localhost`, which can't name a project.
  - The Firebase SDK is copied into the app (`vendor/firebase/`), so the app runs its own copy of every script.
  - The admin page is left out.

## 2. What you need

| | What | Notes |
|---|---|---|
| 1 | **Apple Developer Program** membership | $99 a year. Enrol as an organisation (needs a D-U-N-S number) if the seller should be JarHead Labs rather than you. Allow a few days. |
| 2 | **A Mac with Xcode**, or a cloud build | No Mac: a GitHub Actions macOS runner (this repo already uses Actions), Codemagic, or Ionic Appflow. They build, sign and upload to TestFlight. A Mac is still the easiest way to try the app on a phone the first time. |
| 3 | **A bundle ID** | e.g. `com.jarheadlabs.tictacchaos`. It can never change after the first upload. |
| 4 | **Your Team ID** | developer.apple.com → Membership details. |
| 5 | **A privacy policy page** | A public URL, e.g. `tictacchaos.com/privacy`. Doesn't exist yet. |
| 6 | **A support URL / contact email** | Required in App Store Connect. |
| 7 | **An App Store icon** (1024×1024, no transparency), a **launch screen** and **screenshots** (6.9" and 6.5" iPhone, 13" iPad) | `npm run app-icons` draws the icon, the launch image and the studio mark (`assets/app/`); `npm run app-shots` captures the screenshots (`_shots/`). See section 6. |

## 3. Capacitor setup steps

Run these on the Mac, or as the cloud build's steps.

1. **Install Capacitor:**
   `npm i @capacitor/core @capacitor/ios @capacitor/app @capacitor/share @capacitor/clipboard @capacitor/browser @capacitor-firebase/authentication`
   and `npm i -D @capacitor/cli`.
2. **Write `capacitor.config.json`:**
   ```json
   { "appId": "<bundle ID>", "appName": "Tic Tac Chaos", "webDir": "_app",
     "ios": { "contentInset": "never", "scheme": "Tic Tac Chaos" },
     "plugins": { "FirebaseAuthentication": { "skipNativeAuth": true, "providers": ["google.com", "apple.com"] } } }
   ```
3. **Build the web files:** `npm run build:app` (production; `npm run build:app -- staging` for a staging build). This
   needs network access, to copy the Firebase SDK.
4. **Create the iOS project:** `npx cap add ios`, then `npx cap sync ios`. Repeat `npx cap sync ios` after every
   `npm run build:app`.
5. **Firebase console** (the production project, and staging for testers):
   - Add an **iOS app** with the bundle ID.
   - Download **GoogleService-Info.plist** into `ios/App/App/`.
6. **Google sign-in:** add the plist's `REVERSED_CLIENT_ID` as a URL scheme (Xcode → Info → URL Types).
7. **Sign in with Apple:**
   - Xcode: Signing & Capabilities → **Sign in with Apple**.
   - Firebase console: Authentication → Sign-in method → **Apple**: enable it.
   - For the web page as well: create an Apple **Services ID**, a key and the return URL
     `https://tic-tac-chaos.firebaseapp.com/__/auth/handler` (and the staging project's), then enter the Services ID, Team
     ID, key ID and private key there.
   - Until the provider is enabled, the web's "Continue with Apple" says "That way of logging in isn't available yet".
8. **Universal Links:**
   - Fill in `scripts/app-config.js` (`teamId`, `bundleId`) and deploy. `https://tictacchaos.com/.well-known/apple-app-site-association`
     then answers.
   - Xcode: Signing & Capabilities → **Associated Domains** → `applinks:tictacchaos.com` (plus
     `applinks:staging.tictacchaos.com` for a staging build).
9. **App Check** (optional; off today on the web too): enable the **App Attest** provider for the iOS app in Firebase.
   Hand its token to the web SDK through `@capacitor-firebase/app-check` (a custom provider in `src/net/connect.js`
   `appCheck`). The web's reCAPTCHA doesn't run inside the app.
10. **Sound:** check the silent switch and Web Audio inside the web view (the page asks for an "ambient" audio session).
    If sound stays off, set the app's `AVAudioSession` category to ambient in `AppDelegate.swift`.
11. **The App Store id:** once the app exists in App Store Connect, put its Apple id in `src/net/platform.js`
    `APP_STORE_ID`, so "Please update" opens its page.
12. **Release a new app version:**
    - Bump `CLIENT_VERSION` in `src/core/client.js` whenever a change needs a newer client: a new mini-game (set its
      `minVersion` to the new version), or a change to moves or records an older app couldn't play.
    - Keep Xcode's marketing version equal to `CLIENT_VERSION`.
    - Once the update is live, raise the iOS minimum on the admin's Clients card if old apps must stop.

## 4. App Store requirements

- **Account deletion (guideline 5.1.1(v)):**
  - Required, because the app lets players create accounts. Players must be able to delete their account inside the app,
    not only by emailing you.
  - **Built.** My Stats has **Delete account** (a Yes/No question first); the server's `deleteAccount` refuses while the
    player is in an online match, else deletes every node of theirs (profile, public profile, username, records, history,
    Top opponents, `localStats`/`localHistory`, `lastSeen`, queue and `active` entries, a lobby left open) and the Auth user.
  - **Still to do:** Apple accounts must also have their Sign in with Apple token revoked (Apple's REST API, with the same key
    as above; `deleteAccount` is where to add it once the key exists).
- **Sign in with Apple (guideline 4.8):** required when an app offers Google sign-in. Done, beside Google and email.
- **Privacy policy (guideline 5.1.1):**
  - Needs a public URL, linked in App Store Connect and inside the app (the login screen or the menu).
  - **Written, as a draft to review:** `privacy.html` (https://tictacchaos.com/privacy.html once released; staging's copy
    first), linked from the main menu, the login screen and the credits (the app opens the live site's page in its in-app
    browser: `net/platform.js` `privacyUrl`). It says what is collected (email, username, game records and history, Top
    opponents, a random device id and app events, match logs, the tester tag), why, how long it is kept (match logs 30 days;
    device logs, last activity and the alert log 90 days; account data until deletion), how to delete an account, names
    Firebase/Google as processor and the Open Trivia Database, and the age line (13+). Before it leaves draft: confirm the
    contact address (privacy@tictacchaos.com is a placeholder) and the studio's legal details.
- **Age rating:**
  - Apple's questionnaire asks about **simulated gambling**. Blackjack, Roulette, Craps, Risky Rolls and Ride the Bus
    are casino-style games without real money.
  - Answering "frequent/intense" gives the top age band (17+, or 18+ under Apple's 2025 age-rating update). "Infrequent"
    typically gives 12+/13+. Check the result in App Store Connect before submitting.
  - If a younger rating matters, the new **iOS switches** can keep the casino games off iOS. Cross-play with web players
    then also leaves them out of those matches.
- **Privacy "nutrition" labels** (App Store Connect → App Privacy). Likely answers:
  - Contact info: email address (linked to the user; for app functionality).
  - Identifiers: user ID (linked); device ID (the playtest random ID; linked when logged in).
  - User content: username (linked; app functionality).
  - Usage data: product interaction (matches played, stats; analytics and app functionality).
  - Diagnostics: crash/performance data (error events, match logs; app functionality).
  - **No tracking:** nothing is shared with data brokers or used for ads, so no App Tracking Transparency prompt is
    needed.
- **Minimum functionality (guideline 4.2):** the app bundles its own files and plays offline (Play Computer, Same
  phone), so it's not a wrapped website. Keep it that way: don't point Capacitor at the live site (`server.url`).
- **Executable code (guideline 2.5.2):** game code ships inside the app. Live config (settings, releases, animation
  speed) is data, which is fine. New mini-games need an app update (that's what `minVersion` is for).
- **Export compliance:** the app uses only standard HTTPS. Set `ITSAppUsesNonExemptEncryption` to `NO` in Info.plist.
- **Ratings/leaderboard** are off; nothing else here needs Game Center.

## 5. Checklist to TestFlight

- [ ] Apple Developer Program membership active (organisation or individual decided)
- [ ] Bundle ID chosen and registered (Identifiers), with Sign in with Apple and Associated Domains capabilities
- [ ] `scripts/app-config.js` filled in (Team ID, bundle ID); deployed; `/.well-known/apple-app-site-association` answers on tictacchaos.com and staging
- [ ] Firebase: iOS app added to production (and staging); `GoogleService-Info.plist` downloaded
- [ ] Firebase: Apple provider enabled in both projects (`docs/login-setup.md`: Services ID, key, then the provider); `node scripts/smoke-login.js production` says Apple is on
- [ ] Privacy policy page live (written: `privacy.html`, a draft to review; linked in the game) and named in App Store Connect
- [ ] In-app account deletion built and tested (done, server and page; Apple token revocation still to add)
- [ ] Email verification for email-and-password accounts (done: Find Match, hosting and the username need a proved email)
- [ ] Mac or cloud build ready (Xcode current; signing certificate and provisioning profile, or automatic signing)
- [ ] `npm run build:app -- staging` → `npx cap add ios` → `npx cap sync ios`; the app opens and plays Play Computer offline
- [ ] On a phone, a staging build:
  - [ ] Google, Apple and email sign-in
  - [ ] Find Match against a web player (check the iOS switches hold)
  - [ ] Host and join a friend room
  - [ ] An invite link opens the app
  - [ ] Sound, including with the silent switch on
  - [ ] Reopening after the app has been in the background
  - [ ] The "Please update" screen (set the iOS minimum above the build's version, then clear it)
- [ ] App Store Connect: app record created (name, bundle ID, SKU, primary language); `APP_STORE_ID` set in `src/net/platform.js`
- [ ] Age rating questionnaire answered (simulated gambling); App Privacy labels filled in (`docs/app-privacy-labels.md`, checked against the live configuration); export compliance answered
- [ ] Icon (1024×1024), launch screen and screenshots (section 6)
- [ ] Production build: `npm run build:app` → `npx cap sync ios` → Xcode Archive → upload (or the cloud build's upload)
- [ ] TestFlight: internal testers added; the build processed and installed; a full match web ↔ iOS played

### Login checklist (every build sent to TestFlight)

Run on the simulator (staging build: `npm run ios:build -- staging --run`) and on a phone with the TestFlight build
(production). Logging in can't be checked automatically in the app (`scripts/smoke-login.js` covers the projects'
settings, `scripts/smoke-browser.js` the web's Google window), so do it by hand, before uploading:

- [ ] `npm run ios:build` printed `GoogleService-Info.plist: … (project tic-tac-chaos)` (or `tic-tac-chaos-staging`
      for staging), and Xcode → App → Build Phases → Copy Bundle Resources lists `GoogleService-Info.plist`
- [ ] Info.plist's URL Types hold the plist's `REVERSED_CLIENT_ID` (`com.googleusercontent.apps.475136918613-…` for
      production); Signing & Capabilities shows **Sign in with Apple** and **Associated Domains**
- [ ] `node scripts/smoke-login.js production` (and `staging`): all `ok`, Apple included
- [ ] Continue with Google: Google's sheet opens, pick an account, the app reaches the username screen or the menu
- [ ] Continue with Apple: Apple's sheet opens (Face ID / passcode), the app reaches the username screen or the menu
- [ ] Email: a wrong password says "Wrong email or password."; the right one logs in
- [ ] Log out, then in again with each; close and reopen the app: still logged in
- [ ] Cancel each sheet: no message at all
- [ ] Any failure: the message names the way and an **Error code**; the full error is in Safari → Develop → [the
      simulator or phone] → the app → Console (`[login]` lines) and on the admin's Players page, the device's player, Errors (the device's `login`
      errors). `not-enabled` = the plist was not built in; `auth/operation-not-allowed` = the provider is off in Firebase
      (`docs/login-setup.md`); `1000` = the Apple capability is missing or the device has no Apple ID signed in.

## 6. App icon, launch screen and screenshots

All three are drawn from the game's own art (its fonts, colours and X and O characters: `scripts/make-share-images.js`;
the studio's logo: `assets/brand/jarhad-labs-logo.svg`). No third-party art anywhere.

- **`npm run app-icons`** (`scripts/make-app-icons.js`, Playwright's Chromium) writes `assets/app/`:
  - `icon-1024.png`: the App Store icon (Face-off, `scripts/icon-options.js` `APP_ICON`; `npm run app-icons -- icon` redraws it alone), 1024×1024, no transparency (Apple masks the corners itself; everything sits
    inside the middle 80%).
  - `launch-2048.png`: the launch screen's picture, the title on the plain cream (`#f4e6c8`), 2048×2048.
  - `jarhad-mark-512.png`: the JarHad Labs mark on a transparent background, for an About row or the launch screen's corner.
- **The icon in Xcode** (Xcode 14 or later): open `ios/App/App/Assets.xcassets`, select **AppIcon**, set the attributes
  inspector's iOS size to **Single Size**, and drop `icon-1024.png` on the one slot (Capacitor's template ships a
  placeholder `AppIcon-512@2x.png` there: replace it). The same image is the App Store icon in App Store Connect.
- **The launch screen:** Capacitor's template has `LaunchScreen.storyboard` showing the `Splash` image set with *Aspect
  Fill*. Either replace the three `splash-2732x2732*.png` files in `Assets.xcassets/Splash.imageset` with
  `launch-2048.png` (upscaled 2732 copies, or the one file in each slot: it is centred art on a flat colour, so any fit
  works), or in the storyboard set the image view's **Content Mode** to *Center* (or *Aspect Fit*) and the view's
  **Background** to the cream (`#f4e6c8`, sRGB 244/230/200), so the picture sits in the middle with the same cream
  around it on every screen size. Set the status bar style to dark content (the launch background is light).
- **`npm run app-shots`** (`scripts/app-screenshots.js`) serves this folder, stubs `src/env.js` (no project, no network)
  and captures the main menu, the board mid-match, two mini-games (Higher/Lower and Five Letters by default,
  `SHOT_MINIS=`) and the match-end screen at App Store Connect's sizes: iPhone 6.9" 1320×2868 (440×956 @3), iPhone 6.5"
  1284×2778 (428×926 @3) and iPad 13" 2064×2752 (1032×1376 @2), into `_shots/<device>/` (gitignored). Upload them as
  they are, or lay captions over them; App Store Connect scales the 6.9" set for the smaller iPhones if no other set is
  given.

## 7. Set up, run and ship (as built)

Capacitor 8 uses Swift packages: no CocoaPods. Needs Xcode 16.3 or later (the Firebase plugin's package uses Swift tools 6.1) and Node 22.

- **Once:** put the two Firebase plists in `ios-config/` as `GoogleService-Info.production.plist` and `GoogleService-Info.staging.plist` (or pass
  `--plists DIR`; `~/Desktop/ttc-ios/` and `~/Downloads/` are searched too). Each must be for `com.jaredkrosser.tictacchaos`, with Google sign-in on.
- **Every time:** `npm run ios:build` (production) or `npm run ios:build -- staging`: web files, `cap add ios` (first time), `scripts/ios-setup.js`, `cap sync ios`.
  `-- --open` opens Xcode, `-- --run` runs the Simulator. Then Xcode: pick the **App** scheme and a device, Run; or Product > Archive.
- **Signing:** automatic, team `2F7M8F9NBG`. Sign in to Xcode > Settings > Accounts with the Apple ID of that team; the first build registers the App ID's
  capabilities (Sign in with Apple, Associated Domains) from `App.entitlements`.
- **Deep links:** `/.well-known/apple-app-site-association` is served by every site build once `app-config.js` is filled; it is live on staging after a staging
  deploy and on tictacchaos.com after a release.

## 8. The 1.20.0 build (December 2026): audit, steps to TestFlight, phone checklist

`CLIENT_VERSION` is **1.20.0** (the app's marketing version). Every mini-game's `minVersion` was audited: it is the first
version that holds the game's rules as they are now (the last change to its `rules.js`, its word list or the shared
family file it plays by), so an older app is dealt only what it can still play (a 1.2.0 app: Tic-tac-toe, Four in a
Row, Roads and the few others unchanged since). After this build is on TestFlight, set the **iOS minimum** on the
admin's Games page (Platforms card) to 1.20.0 in each environment: older builds then see "Please update".

### Which server the build talks to (read before archiving)

A production build talks to the production project, and production is whatever `main` holds. While `main` is behind
`staging`, a production build is a new client on an old server: its invites point at `tictacchaos.com/join/CODE`, which
the old site does not serve, the live opponent view's writes are refused, and the server plays by older rules. So:

- **To test now:** `npm run ios:build -- staging` (the staging project; a STAGING badge shows in a corner).
- **For the store, or a production TestFlight build:** release the web first (`release`), then `npm run ios:build`.

### What was audited, and how

There is no Mac in the cloud session that prepared this build, so the Simulator and the archive are yours (below). What
was checked there, on the app's own files (`npm run build:app`, production) in Chromium with a stand-in for the Capacitor
shell (`window.Capacitor`, its plugins recording every call), every outside request refused:

| Item | Result |
|---|---|
| Build and sync | `npm run build:app` and `npx cap sync ios` run clean; 7 plugins (Firebase Authentication, App, Browser, Clipboard, Filesystem, Haptics, Share) in `CapApp-SPM/Package.swift` |
| Starts offline | No page error; all four fonts (Bangers, Comic Neue 400/700, Luckiest Guy, Patrick Hand) load from `fonts.css` (embedded); the only requests are the live settings and the anonymous sign-in, refused without harm |
| Safe areas, clipping | Menu, Play Computer, Settings, login and results at 375x667, 393x852 and 430x932 (a 59px top and 34px bottom inset on the two taller ones); the menu also at 768x1024 and 1024x768: every control inside the insets, no text cut, no scroll |
| Every mini-game | All 69 (the 17 released and the admin-only ones) open in a square, fit with no scroll or cut text, and play a move, at 375x667, 393x852, 768x1024 and 1024x768 |
| Portrait lock | `Info.plist`: iPhone portrait only, iPad all four (held by `tests/server/ios-setup.test.js`) |
| Deep links | `/join/CODE` and `/?room=CODE` handed to the running app open the join screen with the code; `App.entitlements` has `applinks:` for both sites; the site's association file lists `/join/*` |
| Invites | "Join my Tic Tac Chaos game! Code: CODE https://tictacchaos.com/join/CODE" (staging's address in a staging build); Share goes to the Share plugin as text alone, Copy to the Clipboard plugin (`tests/flows/invite-browser.test.mjs`) |
| Haptics, turn alert | A square opened: light; a move, then the turn back: two medium pulses; Vibration off: none |
| Settings | Sound, Animation (Normal/Speed) and Vibration shown; Speed switches `html.spd`; the build stamp shows |
| Share result | The card is written to the cache (Filesystem) and shared with its text (Share) |
| Privacy link | Opens `https://tictacchaos.com/privacy.html` in the in-app browser; the game stays |
| Account deletion | My Stats' Delete account calls the server's `deleteAccount` (same code as the web; needs a login: phone) |
| Icon, launch | The Patchwork icon in the one 1024 slot; the launch screen redrawn as the Comic Chaos logo on the cream |

Fixed in this pass (app only): the launch screen still showed the old logo; the web view had no background of its own
(a white flash before the page: now the cream, `capacitor.config.json` `ios.backgroundColor`); the app followed the
phone's Dark Mode for its status bar (white text over the cream: now always light, `UIUserInterfaceStyle`); the project's
version was 1.2.0. For both platforms: a tally's name ("Computer") was cut in a few admin-only games on a 375px phone and
inside an iPad's 600px game (the computer's icon left the tally; Risky Spins' gauge and Poker Hands' pips a little tighter).

Not checked there, so on the Simulator or the phone: WebKit itself (the audit ran in Chromium), the native sheets (Google
sign-in, share, the in-app browser), real haptics and sound, Universal Links from Messages, the launch screen, and
anything online against a second device (the live opponent view, replays, the match clock: the same code the two-phone
emulator smoke and the server suite exercise on the web).

### What differs from the web, and why

- **Sign-in:** Google goes through the native sheet, then the same Firebase account. **Continue with Apple is hidden**
  (as on the web) until the Apple provider is on in Firebase (`docs/login-setup.md`, then `apple: true` in `src/env.js`).
  TestFlight does not need it; **App Review does** (guideline 4.8).
- **Links and invites** name the live site (the app's own address is `capacitor://localhost`); outside pages open in the
  in-app browser; the result card goes to the share sheet as a file (no download).
- **Haptics** are the phone's own patterns; iPhone Safari cannot buzz at all.
- **Orientation:** an iPhone never rotates (the web shows "Rotate your phone" instead); an iPad rotates.
- **No admin page**, the Firebase SDK is inside the app, the appearance is always light.
- **"Please update"** opens the App Store's front page until `APP_STORE_ID` is set (`src/net/platform.js`).
- **App Check** is off on both.

### Steps on the Mac (Xcode 26 or later: App Store Connect requires it; Node 22)

1. `git pull` on the `staging` branch, then `npm ci`.
2. The two Firebase plists are in `ios-config/` as before (`GoogleService-Info.production.plist`, `.staging.plist`).
3. `npm run ios:build -- staging --open` (or `npm run ios:build -- --open` for production, after a release). It prints
   `GoogleService-Info.plist: … (project tic-tac-chaos-staging)` and `version 1.20.0 (<build number>)`.
4. Simulator first: pick an iPhone, press Run. Go through the Login checklist (section 5) and the list below.
5. Xcode: destination **Any iOS Device (arm64)** → **Product → Archive**.
6. Organizer → **Distribute App** → **App Store Connect** → **Upload** (automatic signing, team `2F7M8F9NBG`). The first
   upload needs the app's record in App Store Connect (My Apps → + → New App, bundle ID `com.jaredkrosser.tictacchaos`).
7. App Store Connect → TestFlight: wait for "Processing" to end (no export-compliance question: the build answers it),
   add yourself under Internal Testing, install from the TestFlight app.

### Checklist on the phone

- [ ] Launch: the cream screen with the comic logo, then the menu, no white flash; the status bar's text is dark in Dark Mode too
- [ ] Nothing under the notch or the home bar on the menu, the board and a mini-game; the phone held sideways does not rotate
- [ ] Airplane mode: the app opens, Play Computer plays a whole match, the fonts are the comic ones
- [ ] Continue with Google: the sheet, then the menu with your username; close and reopen: still logged in; email login too
- [ ] Settings: Sound off and on (and the silent switch mutes it), Speed makes moves snappier, Vibration off stops every buzz
- [ ] Buzzes: a light one opening a square, a stronger one when a square is claimed, two pulses with a chime when your turn comes back
- [ ] Host a game → Share invite into Messages: the text has the code and a `/join/CODE` link; Copy invite pastes the same
- [ ] On a second device tap that link: the app opens on the join screen with the code (app closed, and app open)
- [ ] A friend match, web against the app: the other side's open square glows with Live, Watch follows their turn, their move replays, both match clocks run and "+5" shows
- [ ] Background the app mid-match for 20 seconds and return: the board catches up, no stuck screen
- [ ] Results → Share result: the share sheet shows the picture and the text
- [ ] The Privacy link (menu foot) opens in the in-app browser and Done returns to the game
- [ ] My Stats → Delete account (a throwaway account): asks first, then the menu says "Account deleted"
- [ ] iPad, if you have one: rotates, the board stays centred

## 9. The 1.21.0 build (December 2026)

`CLIENT_VERSION` 1.21.0 (Word Tiles' 11x11 board; the committed project's `MARKETING_VERSION` 1.21.0). The haptic map was
checked in the app's build in Chromium with a stand-in `window.Capacitor` recording the Haptics plugin's calls: a square
opened and a placement LIGHT, the turn coming back MEDIUM twice (with the YOUR TURN! burst), a refused move ERROR, a
square won SUCCESS then the stamp's MEDIUM, the match won HEAVY then SUCCESS, a square lost and the match lost ERROR.
For TestFlight, on the Mac, after the next release: `npm run ios:build` (production; staging: `-- staging`), then
Archive and upload as in section 8. On the phone: Settings → Vibration on, play the computer and feel each of the above.

## 10. App Store review readiness (December 2026, 1.23.0)

Audited on the app's own files (`npm run build:app`, production) in Chromium with a stand-in Capacitor shell and the
iPhone 17 Pro Max's safe areas (62 top, 34 bottom), every outside request blocked; no Mac, so not on the Simulator.

| Item | Before | Now |
|---|---|---|
| Wrapper, bundling | Capacitor 8.6, the game bundled in `_app/` with its own Firebase SDK; no server URL | Unchanged: starts offline, a full match against the computer to the result screen with no page error |
| Sign in with Apple | Built and wired, hidden everywhere (`src/env.js` `apple: false`) | Shown in the iOS app always (`ui/screens/account.js` `appleOn`); the web keeps its switch. **Needs the Firebase Apple provider on (below)** |
| Account deletion | In the app (Settings, My Stats); no Apple token revocation | An Apple-ID account's token is revoked first (`net/auth.js` `appleRevoke`: Apple's sheet once more, Firebase `revokeAccessToken`); a closed sheet deletes nothing |
| Admin / debug | No admin page; Test play and the owner link in the code, unreachable | Both refuse to run in the app (`sandboxParams`, `ownerLink`) |
| Web-only wording | Two login errors named the browser | The app's words never name a browser (`net/accounts.js` `authError`) |
| Privacy manifest | None of the app's own | `ios/App/App/PrivacyInfo.xcprivacy`: no tracking, the 8 data types of `docs/app-privacy-labels.md`, written by `ios-setup.js` and in the app's resources |
| Devices | iPhone and iPad | **iPhone only** (`TARGETED_DEVICE_FAMILY 1`; an iPad runs the iPhone app, portrait) |
| Xcode | This doc said 16.3 | **Xcode 26 and the iOS 26 SDK** (App Store Connect requires them for uploads since April 28, 2026) |
| Icon, launch, portrait, export compliance, version | Patchwork 1024 RGB (no alpha), comic launch screen, portrait, `ITSAppUsesNonExemptEncryption` NO, 1.23.0 | Unchanged |

Screenshots for the 6.9" iPhone (1320x2868): `SHOT_APP=1 SHOT_DEVICES=iphone69 SHOT_MINIS=bullseye npm run app-shots` after
`npm run build:app` (the app's own files in Chromium, not the Simulator: no status bar is drawn).

### By hand, before submitting

1. **Firebase, both projects:** Authentication → Sign-in method → Apple → Enable, with the Services ID, Team ID
   `2F7M8F9NBG`, Key ID and the `.p8` private key (`docs/login-setup.md` A and B). The key is what token revocation uses:
   without it `revokeAccessToken` fails (the deletion still goes ahead, the failure logged as `login apple-revoke`).
2. **Xcode 26 on the Mac**, then `npm run ios:build -- --open` (production, after a web release) and Archive.
3. **On the Simulator or a phone:** Continue with Apple signs in; Settings → Delete account on that Apple account shows
   Apple's sheet once, then "Account deleted"; the Login checklist (section 5) and the phone checklist (section 8).
4. **App Store Connect:** the app record (bundle ID above); iPhone screenshots 6.9" (the five above); the App Privacy
   answers from `docs/app-privacy-labels.md`; the age rating questionnaire (simulated gambling: Infrequent/Mild);
   the support URL and privacy policy URL (`https://tictacchaos.com/privacy.html`); a demo account for review; the review
   note (`docs/app-review-note.md`); after the record exists, `APP_STORE_ID` in `src/net/platform.js` (so "Please update"
   opens the app's own page).
