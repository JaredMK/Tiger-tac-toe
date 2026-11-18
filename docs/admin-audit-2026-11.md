# Admin dashboard audit (18 November 2026)

What the dashboard shows today, where each number comes from, and where the same metric is worked out in different ways.
Written before the redesign; nothing here has been changed yet.

## 1. Where numbers are computed today (five places)

| # | Source | Computed by | Used on |
|---|---|---|---|
| A | Server counters `stats/…` (and `statsOwn/…` since 18 Nov) | `functions/statsRules.js`, added up as matches start and end | Overview, Players over time, Stats, Growth, runner cards |
| B | Balance counters `stats/bal/…` (histograms by settings version and day) | `statsRules.js` `balanceUpdates`, read by `src/admin/balance.js` | Balance report, a game's version card |
| C | Device events `devices/`, `devlog/` | the browser, `playtest.js` | Playtesters, Devices |
| D | Account records `users/`, `localStats/`, `lastSeen/` | the browser, `admin.js` `accountRows`, `src/ui/pstats.js` | Players & Accounts |
| E | Match log index `matchLogIndex/`, `matchLogs/`; `reports/`; `alertLog/`; `botStats/` | the browser, as stored | Match inspector, Problem reports, Bots |

No page shares a definition with another: each reads its own source and applies its own rules.

## 2. Every page, and what is on it

### Menu (tiles)
- Overview tile: "N active today" (A: `stats/days/{today}/active`).
- Players tile: number of accounts (D). Playtesters tile: number of devices (C). Devices tile: devices and how many are mine (C + `devmeta`).
- Matches tile: number reported (E). Games tile: games, released, changed, iOS off, minimums, speed (settings).

### Overview (`#overview`)
- Period tabs of its own: Today / This week / This month / All time.
- KPIs (A): Active players · Logins · New accounts · Matches finished / started · Abandon rate · Avg finished match (turns, minutes) · First player (X) wins.
- Charts (A): Players per day (active, logins, new accounts) · Matches finished per day by mode.
- Errors, last 7 days (A, `stats/health`): opens, errors, errors per 100 opens, by day and by build. Platforms and client versions: opens, last 7 days.
- Problem reports (E): the last 20.

### Players & Accounts (`#players`)
- Accounts table (D): username, signed up, last active, games, record, win rate. Sortable. No search, no export.
- Account detail: record by view (Online / Local / All), by side, squares won and lost per mini-game.
- Usernames to review (flagged names).
- Players over time (A): active, logins, new accounts by day / week / month; matches started and finished by day.

### Playtesters (`#playtest`)
- Tester-tag filter of its own.
- KPIs (C): Devices seen (and active in 7 days) · Came back the next day · Came back within 7 days · Games started / finished, last 7 days.
- Activity by hour, last 7 days (C). Funnel (C): opened, started a game, finished a game, started another.
- Devices table (C): device, tester, first seen, last seen, sessions, games, games per session, came back. Sortable.
- Device timeline: sessions with their games, errors and sound events. Sessions table: the latest 30, or all.

### Devices (`#devices`)
- Exclude a device, owner link, search.
- Devices table (C + `devmeta` + `users`): nickname, short ID, platform, first and last seen, usernames, games played, Excluded.

### Matches (`#matches`)
- Match inspector (E): reported, started, mode, players, events, app version, note. Filters of its own: text, mode, from, to.
- A match's timeline and Export. Online matches and matches a phone logged; kept 30 days; the latest 500 plus every reported one.

### Games (`#games`, `#games/<type>`)
- Above the list (not per-game): Platforms (Super Chaos switch, client minimums), Pace.
- Each game's page: release switches, Mode, tuning card, settings, presets, Save / Reset / Test play, version card. Runner games also show runs to finish, average distance and a crash chart (A).

### Bot Settings (`#bots`)
- Find Match switch, Timer, Bots (level; bot matches run, finished, players won, bots won, draws: E `botStats`), Computer difficulty, Empty-queue alerts (settings, keys, test; sent and held back; the last 8 alerts).

### Stats (`#stats`)
- Matches by mode (A): started, finished, abandoned (resigned, timed out, never finished), average turns and minutes, X wins, draws. All time only.
- Matches by timer (A): the same, online matches only, with completion and clock run-outs.
- Mini-games table (A): completed, resets, left open, average winner / loser / total moves, X wins, O wins, and the Super Chaos columns. Filters of its own: Shared or Race, modes. Sortable. Chart: average winner moves.

### Balance report (`#balance`)
- Filters of its own: leave out admin matches, from, to, settings version, admin-only games.
- Per game (B): squares, winner's moves (25th, median, 75th), time in the square, left open, reset, first mover, flags; this version against the previous one.
- Match length (B): turns and minutes by mode and by timer, finished or abandoned. Export JSON.

### Growth (`#growth`)
- First-run funnel by install day (A): opened, first tap, first move, first claim, match finished, second match. Last 21 days.
- Retention by install day (A): new devices, D1, D7, D30.
- Rematches, shares and invites (A): last 7 days and today. Sources (A): devices and sign-ups by `?t=` tag.
- Find Match waits (A): paired, average wait, took the computer, fill rate, gave up, wait buckets. Last 7 days.

### Staging Access (`#access`, staging only)
- Open or Allowlist, the allowlist.

## 3. The same metric, computed differently

| Metric | Where | How it is computed there | Why the values differ |
|---|---|---|---|
| **Matches finished** | Overview KPI | `finished − resigned − timeouts`, bot matches left out | |
| | Overview chart | `days/{d}/finished/{mode}`: resigned and timed-out matches included, bot matches included | counts abandoned matches the KPI leaves out |
| | Players over time | sum of `days/{d}/finished` over every mode | same as the chart, not the KPI |
| | Stats, by mode | per mode, bot matches a row of their own | |
| | Stats, by timer | `done`: a clock run-out counts as finished; online only | |
| | Playtesters | `finish` events from devices: an online match counts once per phone, so twice | double counts two-phone matches |
| | Balance report | `bal/ml … /fin/n`: Super Chaos left out, counted from December only | different start date and scope |
| | Accounts "Games" | wins + losses + draws on the account: logged-in players only, bot matches not counted | |
| **Matches started** | Overview / Stats | `started` counters | |
| | Playtesters, Devices | `start` events per device (twice for two phones); Devices takes the larger of two counts | |
| **Abandon rate / completion** | Overview | (never finished + resigned + timed out) ÷ started | |
| | Stats by timer | completion = done ÷ started | clock run-outs count as finished here only |
| | Balance | finished against abandoned among *reported* matches | matches never finished are in neither |
| | Playtesters | "ended mid-match" per session | a different thing with a similar name |
| **Active players** | Overview, Players over time | accounts, or guest browsers, that **played or logged in** (a hash counted once per period) | a guest who then logs in counts twice |
| | Playtesters | devices with **any event**, opens included | devices, not people; opening counts |
| | Growth | devices first seen | |
| **Retention** | Playtesters | all devices pooled: seen the next day; seen **any day within 7** | "7 days" means days 1 to 7 |
| | Growth | per install day: seen **exactly** 1, 7, 30 days later; only devices first seen since December | "D7" means day 7 alone |
| **Funnel** | Playtesters | opened → started → finished → started another *after finishing* | |
| | Growth | opened → tap → move → claim → finished → second match *started* (whether or not the first finished) | last step differs; four extra steps |
| **Completed squares** | Stats | `stats/mini`: all time, by mode; games that were admin-only at the time kept under "testing" | |
| | Balance | `stats/bal/sq`: by version and day, from December; admin-only games under their own name; Super Chaos left out | counts never match the Stats table |
| | Runner cards | every mode summed, testing included | |
| **Moves to win** | Stats | average (sum ÷ count) | |
| | Balance | median and percentiles | an average and a median of the same squares differ |
| **First-mover rate** | Stats, by mode | X's share of decided **matches** | |
| | Stats, mini-games | X's share of won **squares** (X is not always first into a square) | not a first-mover rate at all |
| | Balance | the square's **actual first mover** | the only correct one |
| **Match length** | Overview, Stats | average turns and minutes | |
| | Balance | median and percentiles, from histogram buckets | |
| **Errors** | Overview | server counters per day and build | |
| | Playtesters | error events inside a device's sessions | never totalled the same way |
| **My devices left out** | Overview, Stats, Growth, Balance | `statsOwn` split, only for play since 18 Nov | older play of mine is still in the totals |
| | Playtesters, Devices | by the device's Excluded mark, all history | |
| | Accounts, Match inspector, Reports, Bots | not filtered at all | admin accounts and my matches always shown |
| | Balance | also its older "admin played" segment | a third, narrower rule |
| **Dates** | everywhere | New York days | |
| | Match inspector | the browser's own time zone | a match can fall on a different day |

Also:
- **Periods.** Seven pages have seven period controls or fixed windows (Overview tabs, Players day/week/month, Playtesters "last 7 days", Growth "last 21 / last 7", Balance from/to, Match inspector from/to, Stats all time only).
- **Mode filter.** Only the Stats mini-games table and the Match inspector have one, each its own.
- **Platform.** Shown only as opens on the Overview and a column on Devices. No other number can be split by web and iOS.
- **Players and devices are separate.** Accounts know nothing of devices; device tables did not know accounts until 18 Nov; the Match inspector names players and devices as plain text with no links; the tester tag lives on the device and the sign-up source on the account, and neither page shows the other.
- **No drill-down.** Counters cannot show the rows behind a number.

## 4. What this means for the redesign

Filters by platform, mode and date on every number, and a drill-down from every count, need row-level data. The counters
(A and B) cannot do either. Two row sources can:

1. **Device events** (C): already kept. Sessions, active people, retention, the first-run funnel, invites, errors and opens all
   come from them, with full history (90 days), every filter, and the rows behind each number.
2. **Match records**: one row per match with its mode, timer, platform, players (account and device), result, turns, length
   and every square (game, settings version, winner, moves, first mover, time). The server has all of this when a match
   starts and ends; it is not kept as a row today. This is the one new thing the server needs to write.

Everything else on the dashboard becomes a function over those two sets of rows, in one module.

## 5. After the redesign: where everything went

Every number now comes from rows (one per match, one per Find Match search, the device events, accounts, reports) through one
module, `src/admin/metrics.js`. The same filters are on every stats page. Every number links to its rows.

| Old page | Item | New location |
|---|---|---|
| Menu | Section tiles | Gone: one bar of sections on every page |
| Overview | Period tabs | The Dates filter (every page) |
| | Active players, new accounts | Overview and Players |
| | Logins | Players → a person → Sessions (a login is an event on the device); no headline number |
| | Matches finished / started, abandon rate | Overview and Matches (started, finished, abandoned, never finished, completion) |
| | Avg match turns and minutes | Matches (medians, with 25% and 75% by mode and timer) |
| | First player (X) wins | Matches |
| | Players per day, Matches per day charts | Overview, Players, Matches |
| | Errors by day and build; platforms and client versions | Health |
| | Problem reports | Health (and a number on the Overview) |
| Players & Accounts | Accounts table | Players (accounts and guests in one table) |
| | Account detail (record, by side, mini-games) | Players → a person (record all time; matches, sessions, mini-games) |
| | Usernames to review | Players, under the table |
| | Players over time | Players (active per day); Overview |
| Playtesters | Tester-tag filter | Players: search or filter the Source column; Growth → Sources |
| | Devices seen, came back next day / in 7 days | Players (active, new); Growth (D1, D7, D30, W1) |
| | Games started / finished | Matches |
| | Activity by hour | Dropped (per-day charts instead). Say if you want it back |
| | Funnel | Growth → First run (six steps) |
| | Devices table, device timeline | Players, and a person's page (devices, sessions, matches, errors) |
| | Sessions table | Overview/Players → Sessions number → its rows; a person's Sessions |
| Devices | Devices table, nickname, Excluded switch | Players (every device is on its person); a person's page → Devices |
| | Exclude a device, owner link | Settings → My devices |
| Matches | Match inspector, filters | Matches → Every match (search, column filters) |
| | Timeline, Export | Matches → a match → Event log, Export JSON |
| Games | Platforms (Super Chaos, client minimums), Pace | Settings |
| | Each game's page (releases, mode, settings, presets, Save / Reset / Test play, version card, runner numbers) | Unchanged, same address `#games/<game>` |
| Bot Settings | Find Match switch, Timer, Bots, Computer difficulty, Alerts | Settings |
| | Bot matches run / won | Health → Find Match |
| | Alerts sent | Health → Alerts sent |
| Stats | Matches by mode, by timer | Matches → Length and completion, by mode and timer |
| | Mini-games table and chart | Games → Compare the games |
| | Shared or Race filter | Dropped as a filter; a square's rows keep `race`. Say if you want it back |
| | Super Chaos columns | Dropped (Super Chaos is off; its matches are kept under mode "Super Chaos") |
| Balance report | Per game, by version | Games → Compare the games; each game's page → How it plays, By settings version |
| | Match length | Matches → Length and completion |
| | Leave out admin matches | The Include my devices filter (one rule everywhere) |
| | Export JSON | CSV on every table |
| Growth | Funnel, retention, events, sources | Growth |
| | Find Match waits | Health → Find Match |
| Staging Access | Open / Allowlist, the allowlist | Settings (staging only) |
| (new) | Game templates | Settings |

Old addresses still open the right place: `#playtest` → Players; `#devices`, `#bots`, `#access` → Settings; `#stats`, `#balance`,
`#releases`, `#settings/<game>` → Games.

### What changed in the data

- The server no longer adds to `stats/`, `statsOwn/` or `botStats/`. It writes one row per match (`mfacts/`) and one per Find
  Match search (`finds/`).
- Rows are kept 90 days (the same as device events, and what the privacy policy says). No number reaches further back.
- Staging's play data was deleted once by this build's deploy (accounts, settings, releases, templates and owner devices
  kept); the database as it was is the run's `staging-before-wipe` artifact (30 days). Production keeps its old data until
  Reset production is run.

### Definitions that changed

| Metric | Before | Now |
|---|---|---|
| Active players | played or logged in (Overview); any event (Playtesters) | a person (an account, or a guest's device) who opened the game on a day in the range |
| Matches finished | eight variants | ended, and not by a resignation or two missed turns (a clock run-out is a finish) |
| D7 | "within 7 days" (Playtesters); "exactly day 7" (Growth) | exactly day 7; W1 is "any of days 1–7" |
| Moves to win | average (Stats); median (Balance) | median, with 25% and 75% |
| First mover | X's share of squares (Stats); the real first mover (Balance) | the real first mover |
| My devices | three different rules | one: an owner device, or a match with an admin account or an owner device in it |
