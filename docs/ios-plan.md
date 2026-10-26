# Tic Tac Chaos on iOS: the plan

The iOS app is the same game in a native shell (Capacitor). It uses the same Firebase project, accounts, live config and
Find Match queue as the web page, so web and iOS players are matched with each other. Nothing below has been built yet.
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
  - Join links (`https://tictacchaos.com/?room=CODE`) and the alert's Find Match link work as Universal Links.
  - The app handles a link when it starts and while it runs (Capacitor's `appUrlOpen` event, `main.js` `openLink`).
  - Once `scripts/app-config.js` holds the Team ID and bundle ID, every site build publishes
    `/.well-known/apple-app-site-association`.
- **Native touches, harmless on the web** (`src/net/platform.js`):
  - **Haptics:** `haptic(kind)` buzzes through the Capacitor Haptics plugin when it is present (nothing on the web):
    a light impact when a square is opened (`ui/input.js`), a heavy one when a square stamps in on the board
    (`ui/fx.js` `stampFx`), a success or error notification with the match-end screen (`ui/turns.js` `toWin`). Each
    fires once, from its event. Install `@capacitor/haptics` with the other plugins.
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
  - **Not built yet.** Needed: a "Delete account" button on the profile screen and a server call that deletes the
    account and its data (profile, username, records, history, Top opponents, `localStats`/`localHistory`, `lastSeen`).
  - Apple accounts must also have their Sign in with Apple token revoked (Apple's REST API, with the same key as above).
- **Sign in with Apple (guideline 4.8):** required when an app offers Google sign-in. Done, beside Google and email.
- **Privacy policy (guideline 5.1.1):**
  - Needs a public URL, linked in App Store Connect and inside the app (the login screen or the menu).
  - **Not written yet.** It must say what is collected: email, username, game records and history, a random device ID
    and app events for the playtest stats, match logs for problem reports. It must name Firebase/Google as processor,
    say how long data is kept (match logs 30 days) and how to delete an account.
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
- [ ] Firebase: Apple provider enabled (Services ID and key for the web); "Continue with Apple" works on staging's web page
- [ ] Privacy policy page live; link in the app
- [ ] In-app account deletion built and tested (including Apple token revocation)
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

## 6. App icon, launch screen and screenshots

All three are drawn from the game's own art (its fonts, colours and X and O characters: `scripts/make-share-images.js`;
the studio's logo: `assets/brand/jarhad-labs-logo.svg`). No third-party art anywhere.

- **`npm run app-icons`** (`scripts/make-app-icons.js`, Playwright's Chromium) writes `assets/app/`:
  - `icon-1024.png`: the App Store icon, 1024×1024, no transparency (Apple masks the corners itself; everything sits
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
