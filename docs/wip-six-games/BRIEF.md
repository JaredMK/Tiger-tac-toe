# Shared brief: the six games of December 2026 (Tic Tac Chaos)

You are building ONE mini-game (or one rework) of Tic Tac Chaos in your own git worktree. Six other builders are
doing the same in their own worktrees at the same time; your branches are merged afterwards by the lead. Read this
whole brief first.

## The project in two lines
Tic-tac-toe where every square is a mini-game. Plain ES modules, no build step in development. `CLAUDE.md` at the
repo root is the project's notes: read its sections **"Adding a mini-game"** and **"Standing rules"** before you write
anything (grep for the headings; the file is very long, read those sections fully and skim the paragraphs on the
games named as your references below).

## Your worktree, and what is already done for you
- Your worktree: `/home/user/g-<id>` on branch `g/<id>` (`<id>` is your game's id, given in your task). Run every
  command from it. `node_modules` is linked. Do not `cd` into any other checkout, do not push, do not deploy.
- The scaffold commit already did the registration for all six games: `src/games/index.js`, `admin.js` (`GAMES`,
  `TEST_TYPES`), `database.rules.json`, `scripts/set-releases.js` `ALL`, the games count in `tests/core/match.test.js`,
  `CLIENT_VERSION` 1.30.0 (and its test and the iOS marketing version), and `FIND_MATCH_HOLD` (already holds `pint`,
  `jigsaw`, `hive`; `rally` was held before).
- Your game's folder `src/games/<id>/` currently holds a **stand-in** (a copy of Heads or Tails under your id) so the
  whole test suite passes from the start. Replace all four files (`rules.js`, `ai.js`, `meta.js`, `view.js`) with the
  real game. The other five stand-ins stay as they are in your worktree: leave them alone.
- (Road Race's builder: your folder `src/games/rally/` is the real, existing game; you rework it.)

## What you may edit
1. `src/games/<id>/*` (yours entirely; extra files such as a word list or puzzle data live here too).
2. `tests/games/<id>.test.js`, `tests/sim/<id>.sim.js`, and optionally `tests/ui/<id>.test.mjs`.
3. Your marked slots, and nothing outside them, in three shared files:
   - `src/audio/sound.js`: between `// [<id>] …` and `// [/<id>]` (your `def(...)` sounds; names start with your sound prefix).
   - `src/ui/haptics.js`: your two lines `for (const n of []) RESULT_SOUNDS.add(n);   // [<id>] results` and `… BAD_SOUNDS.add(n);   // [<id>] bad` (fill the arrays).
   - `src/ui/styles.css`: between `/* [<id>] … */` and `/* [/<id>] */` at the end of the file.
4. A script under `scripts/` if your game needs generated data (e.g. `scripts/make-<id>-….js`).
5. Any OTHER shared file only if the game truly cannot work without it (e.g. a list in `src/ui/replay.js`,
   `src/ui/mini.js`, `src/net/moves.js`, `src/core/verify.js`, `src/net/live.js`, `tests/core/match.test.js` `SECRET_KEYS`).
   Keep such an edit to the smallest possible change and LIST IT in your report file (the lead merges those by hand).
   Never touch: `CLAUDE.md`, `SOUNDS.md`, `docs/help-text.md`, `scripts/help-text.js`, `admin.js`, `src/games/index.js`,
   `src/core/client.js`, `src/core/games.js`, other games' folders. (Write what should go in CLAUDE.md and SOUNDS.md into
   your report file instead.)
- Your controls' `data-act` names must start with your act prefix (given in your task): the click handler already
  treats those as game inputs (no interface tap sound), so play your own sound from the view.

## The new-game checklist (every item is required)
- `meta.js`: `info` { name, hint }, `release = 'admin'`, `minVersion = '1.30.0'`, `category` ('luck' | 'skill' | 'brain'),
  `placeholder = false`, `explainer` { name, play, win } (plain and short; `{k}` shows a `TUNE` value; `explainVars` for
  words that depend on settings), an original `icon` (24x24 stroke SVG like the others), `realTime = true` and/or
  `turnSecs: 60` where it applies, and `TUNE`: **every tunable value** as `{ k, label, def, min, max, step, group }`
  (or `opts`), `group` one of exactly `Board`, `Rules`, `Timing`, `Computer` (a test holds this). Include the
  **Go again on success** switch (`core/tune.js` `AGAIN_TUNE`, key `again`, off by default; read with `goAgain(mini)`;
  the explainer's `{goAgain}` text via `goAgainText` { on, off }; see War or Rock Paper Scissors or Hook-a-Duck) with the
  meaning given in your task. The computer's own numbers (errors by level) are settings too.
- `rules.js` (pure: no page, no clock, no `Math.random`; every random choice from the `rng` passed in; the server runs
  the same file): `create(type, rng)`, `apply(mini, p, m, rng, idx)` → `{ ok, outcome: 'continue'|'win'|'draw', winner?, again?, note }`
  (validate the move strictly: the server takes moves from phones), `publicView`, `randomMove`, `moveFlash`, `flashMs`
  (covers every animation of the move), `timeoutClose` (what a timeout leaves of a move under way: nothing is ever
  played for a player out of time), and `secret`/`hide` if anything is hidden. A level square is a draw (no tie goes to
  either player). No first-mover handicaps. Keep the state small and JSON-plain (it lives in a Realtime Database record).
- `ai.js`: `needs(pm, p)` (the moves still needed, from the public view) and `best(pm, me, rng, style, ctx)` →
  `{ move, q }` with `ctx.level` 'easy' | 'normal' | 'hard' (Hard a real step up where the game has choices; it must keep
  to `ctx.until`, the ms it may still spend, null = a fixed amount of work). The computer must never be superhuman at a
  timing game: its error stands in for a finger.
- `view.js`: `screen(...)`, `miniature(mini, final)` (a small PICTURE of the game with each player's progress beside
  it, public information only, text never under the board hint's size: use `ui/thumbs.js` `thumbArt`, `pipRows`,
  `ui/tok.js` `barRows`), `moveText`, `sounds(f, add, won, mini, last)`, `actions`, `replay` (`synth`: a replay shows the
  committed result of the other side's turn, never their drafting), and `ownLine` / `hold` / `heldSub` where useful.
  Animations and sounds fire exactly once, from the move's event (the flash), never from a render. Result words go in a
  reserved line; the layout never shifts; no help text inside the game; no claim/stamp inside the game ("Won by" is the
  frame's). Fits with no scrolling at 360x640 (and 390x660, 390x844, 430x932): size from the space available
  (`--gw`, `--gh`, container units), never fixed pixels. `touch-action: none` on play areas. Canvas views use
  `ui/stage.js` `stage(selector, paint)`.
- Sounds: synthesised with the helpers in `src/audio/sound.js` (`def`, `sfxTone`, `sfxNoise`), in your slot. Game inputs
  play only their own sound. Classify the result sounds and the bad ones in your haptics slot; buzz this phone's own
  inputs through `net/platform.js` `haptic('tap')` as the reference games do; the other side's moves never buzz
  (`ui/haptics.js` `ownMove`).
- Original names, characters and art only: nothing that resembles an existing game's or brand's characters, logos or
  look. Colours and fonts from the shared style tokens; X is red and O is yellow (the players' colours are theirs
  alone: never use `--x`/`--o` as your own CSS variable names, and keep a hazard or a neutral piece off those colours).
- Tests `tests/games/<id>.test.js` (CommonJS, `require('../engine.js')` as `E`; see the reference game's test): the
  rules and their edges, strict move validation, the public view free of secrets, a square always ends (random play of
  a few hundred squares; **winnable by a player moving alone**: one side passing/missing every turn, the other still
  wins), the computer's moves always legal at every level.
- Simulation `tests/sim/<id>.sim.js` on `tests/sim/duel.js` (`npm run sim -- <id>`): 500 squares Normal v Normal with
  asserts, then variants printed. **Targets: an average (mean) of 3–6 turns per player, and the median too; first mover
  45–60%; no square won in a player's first turn or two as a rule.** Tune the DEFAULTS in `TUNE` until it holds; also
  print Hard v Hard, Easy v Easy, Hard v Normal. If the game cannot meet a target, say so plainly in the sim's header
  and in your report (do not fudge the assert).

## How to check your work (do all of it before you commit)
1. `node --test tests/games/<id>.test.js` and `npm run sim -- <id>`.
2. `npm test` (about 3 minutes; all of it must pass: it holds every game to the registry's rules, the miniatures'
   rules, the replays' rule, the explainers' round trip, etc.). Fix what your game breaks.
3. In a real browser (Playwright + Chromium are installed: `require('playwright')`, `chromium.launch()` with no
   options). Model your script on `scripts/check-headers.js` (it serves the checkout, stubs `src/env.js`, sets the
   onboarding to quiet, starts a Play Computer match, and reaches the page's own names through `window`, see
   `src/ui/debug.js`). Open YOUR game in a match against the computer at 360x640 and 390x844, play several whole turns
   with real pointer events (yours and the computer's replies), and take screenshots at each stage into
   `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/<id>-*.png`; then LOOK at them with
   the Read tool and fix what looks wrong (overlaps, clipped text, things off-screen, an ugly or unclear picture). Also
   look at the main board with your miniature on it, at the "?" explainer, and at a won square. No page errors.
4. `node scripts/check-headers.js 360,390 cpu ttt,<id>` and `node scripts/check-miniature-text.js 360x640,430x932 ttt,<id>`.
5. `FLOW_GAMES=<id> npm run test:flows` (plays your game on the page's own flows to a claim: vs the computer, on one
   phone, online with the engine as the server).
6. Admin's Test play renders your settings: `tests/ui/admin-games.test.mjs` is part of `npm test`.

## When you are done
- Commit everything on your branch (one or a few commits; do not push). End each commit message with:
  ```
  Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01P6kuR5jsvUvzva5f217c15
  ```
  Never put a model id in code, comments or commit text beyond that trailer.
- Write your report to `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/parts/<id>.md` with these sections:
  1. **CLAUDE.md paragraph**: one dense paragraph in the notes' house style (see Key Drop's or Bin Shot's paragraph):
     the rules as built, the state's fields, the move's shape, settings and defaults, what is hidden/held from Find
     Match and why, the view's main pieces and timings table, sounds, the computer by level, the sim's numbers, tests.
  2. **SOUNDS.md row**: one table row like the others in `SOUNDS.md` (game | names | how each is made).
  3. **Sim numbers**: mean and median turns each, the winner's, first mover %, draws, at the defaults and the variants.
  4. **Shared-file edits** outside your slots (file, what, why), or "none".
  5. **Decisions and doubts**: anything you chose where the task was open, anything not done, anything that looks weak.
  6. **Screenshots**: the paths of the final ones.
- Your final message back: 5–10 lines (what was built, the sim's headline numbers, anything failing or left out).

## Style of the code base
Dense modern JS, small pure functions, long explanatory comments at the top of each file, timing tables as one
`const NAME = { … }` object mirrored by the stylesheet, British spelling in comments. Match it. Keep the state and the
moves compact. Player-facing text is short and plain; no gambling words anywhere.
