# App Privacy labels: a draft from the code

**DRAFT for the owner's review.** These are the answers to App Store Connect's App Privacy questionnaire as the code
stands today (October 2026), worked out from what the client and the server actually send and store
(`src/net/tracking.js`, `src/net/accounts.js`, `src/net/connect.js`, `functions/index.js`, `functions/matchLogRules.js`,
`database.rules.json`). Check them against the live configuration (Firebase console, App Check, any SDK added to the
Capacitor shell) before submitting, and update them when the code changes. Apple holds the developer, not the code, to them.

## The short version

- **No tracking.** Nothing is shared with data brokers or advertising networks, nothing is linked with other companies'
  data about the user, and there is no advertising. The App Tracking Transparency prompt is not needed. Answer **"No, we do
  not use data for tracking purposes"**.
- **No third-party analytics SDK.** The only service is Firebase (Google), as a processor: Authentication, Realtime
  Database, Cloud Functions and (when switched on) App Check. There is no Firebase Analytics, Crashlytics, ad SDK or
  social SDK in the page or the functions.
- **Data is collected**: the email address of an account, a user id, a username, game records and history, usage events
  for the playtest stats, and diagnostics (error events, match logs). The table below says which, how, and whether it is
  linked to the user.

## What the code collects, and where it goes

| What | Where it comes from | Where it is stored | Linked to the account? | Kept |
|---|---|---|---|---|
| **Email address** | Google, Apple or email sign-in (`src/net/auth.js`, `accounts.js`) | Firebase Authentication (the user record); never copied into the database. Staging only: the tester allowlist `admin/staging/allow` holds the testers' addresses | Yes (it is the account) | While the account exists |
| **User id** (Firebase uid) | Every sign-in, including the anonymous one every player gets for server calls (`net/tracking.js`, `connect.js`) | Keys of `users/{uid}`, `history/{uid}`, `oppStats/{uid}`, `localStats/{uid}`, `localHistory/{uid}`, `lastSeen/{uid}`, `active/{uid}`, `queue/*/{uid}`; the players of each `games/{id}`; hashed in `rate/` and `statsSeen/` | Yes | While the account exists (games and rooms are swept; hashes pruned) |
| **Username** | Chosen by the player (`claimUsername`) | `users/{uid}/username`, `usernames/{lower}`; shown to opponents, in their history and Top opponents | Yes | While the account exists |
| **Game records and history** (wins/losses/draws per mode, squares won and lost per mini-game, each finished online match from the player's side, record against each opponent, a logged-in player's local record and matches) | Finished matches (`finishGame`, `friendGameDone`, `recordLocal`) | `users/{uid}`, `history/{uid}`, `oppStats/{uid}`, `localStats/{uid}`, `localHistory/{uid}` | Yes | While the account exists |
| **Last activity** | Any signed-in call (`devlog`, `track`, moves) | `lastSeen/{uid}` (a server time; the admin's Accounts table) | Yes | While the account exists |
| **Device id** (a random id the app itself makes and keeps in its storage: `KEY.dev`; not the IDFA or IDFV) and an optional **tester tag** from a playtest link (`?t=name`) | `src/net/tracking.js` `devId`, `testerTag` | `devices/{hash}` (the id hashed on the server, the tag, first seen, count), `devlog/{hash}/{event}`, `devicesDay/{day}` | The same call carries the account when there is one, and the match logs record the device's events beside the match's players, so treat it as **linked** | Not swept today |
| **Usage events** (app opened, a local match started and ended with its mode, winner and squares; client version and platform with every call) | `track`, `devlog` (`ev: open|start|end`), `clientInfo` | `stats/*` (aggregates, no ids), `statsSeen` (hashes), `devlog/{hash}` | Aggregates: no. Device events: as above | Aggregates kept; device events not swept today |
| **Diagnostics**: error events with a short message (`devError`: e.g. a move that would not save, a replay that could not play), the sound's state changes (`devAudio`), and each online match's event log (moves, presence, the phones' events, "Report a problem" with the player's note of up to a few hundred characters: `ui/report.js`) | `devlog` (`ev: error|audio|mlog|report`), the server's own writes | `devlog/{hash}`, `matchLogs/{key}`, `matchLogIndex/{key}` | Match logs name the match's players (uids) and the devices in it: **linked** | Match logs: deleted 30 days after their last event (`sweep`) |
| **Reactions** (an emoji sent during a match) | `net/reactions.js` | `reacts/{game}/{side}` | Yes, for the match | Removed with the game or room |
| **Friend-room names** (a guest without an account types a display name) | `net/room.js` | `rooms/{code}` seats, `games/{id}/pub` | A guest has no account: not linked | Rooms a day; games swept |

Not collected anywhere in the code: name (Apple's or Google's display name is not stored; the `Sign in with Apple` relay
address counts as the email above), phone number, physical address, payment or financial data, health data, precise or
coarse location (Geo Quiz uses map data, never the device's location), contacts, photos or videos, microphone audio (the
game only plays sound), browsing or search history, purchases (there are none), advertising data, sensitive information,
body or surroundings data. The server never records IP addresses or user agents itself; Google's infrastructure logs
requests as any host does (covered by Google's own terms; say so in the privacy policy).

## The questionnaire, data type by data type

Apple's categories, with the answer for each. "Linked" is Apple's "linked to the user's identity"; "Tracking" is Apple's
definition (across apps and websites owned by other companies, or shared with data brokers): **No for every row**.

| Apple data type | Collected? | Linked | Tracking | Purposes to tick |
|---|---|---|---|---|
| **Contact Info → Email Address** | Yes | Yes | No | App Functionality (account, login, password reset; the staging testers' gate) |
| Contact Info → Name | No | | | |
| Contact Info → Phone Number | No | | | |
| Contact Info → Physical Address | No | | | |
| Contact Info → Other User Contact Info | No | | | |
| Health & Fitness | No | | | |
| Financial Info (all) | No | | | |
| Location (precise, coarse) | No | | | |
| Sensitive Info | No | | | |
| Contacts | No | | | |
| User Content → Emails or Text Messages | No | | | |
| User Content → Photos or Videos | No | | | |
| User Content → Audio Data | No | | | |
| **User Content → Gameplay Content** | Yes (moves, match records and history, reactions) | Yes | No | App Functionality, Analytics |
| **User Content → Customer Support** | Yes ("Report a problem": the player's note, kept in the match's log) | Yes | No | App Functionality |
| **User Content → Other User Content** | Yes (the username) | Yes | No | App Functionality |
| Browsing History | No | | | |
| Search History | No | | | |
| **Identifiers → User ID** | Yes (Firebase uid, anonymous guests included) | Yes | No | App Functionality, Analytics |
| **Identifiers → Device ID** | Yes (the app's own random id: `devices/`, `devlog/`; not the IDFA/IDFV) | Yes (see the table above) | No | Analytics (the playtest page), App Functionality (abuse caps: new devices per day, rate limits) |
| Purchases | No | | | |
| **Usage Data → Product Interaction** | Yes (app opens, matches started and finished, squares won per mini-game, client version and platform) | Yes (when logged in; aggregates are not) | No | Analytics, App Functionality |
| Usage Data → Advertising Data | No | | | |
| Usage Data → Other Usage Data | No | | | |
| Diagnostics → Crash Data | No (no crash reporter; Apple's own opt-in crash reports are Apple's, not the app's) | | | |
| Diagnostics → Performance Data | No | | | |
| **Diagnostics → Other Diagnostic Data** | Yes (error events with their message, the sound's state, match logs) | Yes | No | App Functionality (finding and fixing problems in matches) |
| Surroundings, Body, Other Data | No | | | |

Purposes Apple offers, and which apply: **App Functionality** (yes), **Analytics** (yes: the admin's stats and playtest
pages), Product Personalization (no), Third-Party Advertising (no), Developer's Advertising or Marketing (no), Other (no).

## Things to double-check before answering

1. **App Check.** When it is switched on for iOS (App Attest through `@capacitor-firebase/app-check`), Google receives
   device attestation data. Apple generally treats this as part of App Functionality with no new data type, but read the
   current Firebase App Check privacy note first. On the web it is reCAPTCHA Enterprise (not in the app).
2. **Any SDK added to the shell** (a Capacitor plugin that phones home, an analytics or crash SDK) changes these answers
   and may need its own privacy manifest (`PrivacyInfo.xcprivacy`). The plugins the plan names (App, Share, Clipboard,
   Browser, Haptics, Firebase Authentication) collect nothing of their own.
3. **Required Reason APIs.** The app's web view uses `localStorage` (the saved match, the device id, settings), which is
   WebKit's, not the app's own UserDefaults call; Capacitor's own Preferences use is declared by Capacitor's manifest.
   Confirm Xcode's privacy report (Product → Generate Privacy Report) lists what the archive needs.
4. **Account deletion** is required (guideline 5.1.1(v)) and not built yet (`docs/ios-plan.md`). The privacy policy must
   say how long each item above is kept and how to delete an account; the labels and the policy must agree.
5. **Match logs** are deleted 30 days after the last event; `devices/` and `devlog/` are not swept today. If the policy
   promises a retention period for device events, add that sweep first.
6. **Staging testers** are allowlisted by email (`admin/staging/allow`): a TestFlight build pointed at staging stores the
   testers' addresses in the staging database as well as in Firebase Authentication.
7. **Children.** The app is not made for kids, and the age rating (simulated gambling: `docs/ios-plan.md`) keeps it out
   of the Kids category, so COPPA-style limits on identifiers do not apply; keep it that way, or the device id and
   analytics answers change.
