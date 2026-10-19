# Tic Tac Chaos: project notes

Tic-tac-toe where every square is a mini-game. Mobile-first web game on GitHub Pages, with Firebase (Auth, Realtime Database, Cloud Functions) for online play.

## Architecture
Plain ES modules, no build step: GitHub Pages serves the files as they are.

- `index.html`: the shell (meta tags, `#app`, `src/ui/fonts.css`, `src/ui/styles.css`, `src/main.js` as a module).
- `src/main.js`: the entry. Loads every game's `view.js` (by the registry), registers the listeners in a fixed order, renders the sounds, boots.
- `src/core/`: the engine, pure (no page, no clock, no `Math.random`; every random choice from an rng passed in). `board.js` main board, turn flow, win and draw; `match.js` setup and new matches; `minis.js` a square's mini-game through the registry; `timer.js` one deadline a turn, playback timings; `random.js` seeded randomness; `ai.js` the computer on the main board; `chaos.js` Super Chaos (simultaneous rounds vs the computer); `records.js` online match records (secrets kept apart); `games.js` release control; `config.js` tunable settings; `replay.js` a move's replay log (its shape and limits; the server keeps it on the move's entry); `stats.js`, `util.js`. `engine.js` gathers the engine's public names (the server and tests use it as `E`).
- `src/games/<game>/`: one folder per mini-game (49, including the retired Dice race and Hexapawn).
  - `rules.js`: pure logic, shared with the server. Hooks the core calls: `create`, `apply`, `publicView`, `randomMove`, `moveFlash`, `secret`, `hide`, `flashMs`; Super Chaos's `scCreate`, `scFork`, `scApply`, `scAfter`, `scMerge` where a game needs them.
  - `ai.js`: `needs` (moves still needed) and `best` (the computer's move).
  - `meta.js`: `info` (name, hint), `explainer` ({ name, play, win } for the "?"), `icon`, `release` ('admin' or 'released'), `superChaos` (dealt in Super Chaos) and `scExplainer` where its rules differ there, default settings (`*_DEFAULTS`).
  - `view.js`: `screen`, `miniature`, `moveText`, `sounds`, `actions` (its own `data-act` controls), `replay` (hooks for the shared replay: `input`, `synth`) where it keeps a draft, its drawing, animations and input.
  - A hook a game lacks falls back to the core's default. Wordle and Hangman keep their word lists in `words.js`.
- `src/games/shared/`: what a family shares (runner, attention, finger, physics with `physics-sim.js` on Matter.js, cards, lines, placement). A game's `rules.js` re-exports the family's hooks. Pinball's tables live in `physics-sim.js` (`PIN_LAYOUTS`, the lower table, `pinTable`, `pinLayoutCheck`): a square deals a layout and seven of its spots (`pinball/rules.js` `pinDeal`), and `tests/games/pinball.test.js` holds every layout to the layout check (an overlap fails `npm test`, so the deploys).
- `src/games/index.js`: the registry, one line per game (rules, AI, meta) in menu order, retired games last. `TYPES`, `TEST_TYPES` (from `meta.release`), `OLD_TYPES` and `INFO` come from it. The core dispatches with `rulesOf(type).apply(...)`, `aiOf(type).best(...)`, `viewOf(type).screen(...)`.
- `src/ui/`: `app.js` (state, timings, shared helpers), `render.js`, `board.js`, `mini.js`, `turnbar.js`, `turns.js` (computer's turn, result card), `replay.js` (opponent replays: an opponent's logged inputs played through the view, the Skip button; this phone's inputs logged for its moves), `chaos.js` (Super Chaos's round clock, recap and the 2x replay pop-up), `clock.js`, `input.js` (click handler; game controls go to the view's `actions`), `screens/`, and the shared components: `attention.js`, `runner.js`, `finger.js` (frameworks), `physics.js` (helpers), `progress.js` (bars, tallies), `explainer.js` (the "?" pop-up), `cards.js`, `track.js`, `keyboard.js`, `art.js`, `fx.js`. `config.js` holds the storage key and switches (`RATINGS_ENABLED`). `debug.js` puts the page's names on `window` for the browser tests and the console.
- `src/audio/sound.js`: the single sound manager.
- `src/net/`: `connect.js` (Firebase config, SDK, server time), `room.js` (friend games, presence, playback of the opponent's moves), `moves.js`, `matchmaking.js` (Find Match), `accounts.js`, `releases.js`, `reactions.js`, `tracking.js`.
- Client and server share `rules.js`: `functions/index.js` requires `src/core/engine.js` (Node 22 loads ES modules with `require`). `scripts/sync-functions.js` copies `src/core` and `src/games` (no views) and `trivia.json` into `functions/` before every deploy (firebase.json predeploy) and every emulator run.
- Load-time rule: a module must not use another module's value while loading if the two import each other (only inside functions). Keys and switches read at load live in `ui/config.js` and `core/config.js`.
- `admin.html` + `playtest.js`: the admin dashboard (keeps its own copies of a few defaults; `tests/core/admin-sync.test.js` checks them).
- Tests: `npm test` runs `tests/games/<game>.test.js`, `tests/shared/`, `tests/core/`, `tests/server/` and `tests/page.test.js` (about 10 s); one game alone: `node --test tests/games/<game>.test.js`. `npm run sim -- <name>` runs a slow simulation in `tests/sim/` (`npm run sim` lists them). `npm run test:emulators` runs the server on the Firebase Emulator Suite (needs Java).
- Deploy: `./deploy.sh "message"` commits, pushes `main` and deploys only what changed since the live version (git diff): the site through `pages.yml`, functions and/or rules through `firebase.yml` (tests first). `DEPLOY_REMOTE` picks the remote (the live repository is Tiger-tac-toe).

## Adding a mini-game
Create src/games/<name>/ with rules.js, view.js, ai.js and meta.js, and register it. Every game needs: an explainer (in the format below), a miniature for the main board, AI, a timeout rule, animations, sounds, stats tracking, and a default release status of Admin only.

## Standing rules (apply to every change)
- Layout never shifts. Reserve fixed space for status, result text and buttons; no board moves when text appears or disappears.
- Animations and sounds fire exactly once, from the move event that caused them, never from rendering or re-rendering. The main board shows a claimed square only after its replay finishes.
- Opponent moves (computer or online) are shown: highlight the square on the main board, zoom in, play the move with normal animation at human-like pacing, return. Real-time games show the opponent's attempt live.
- Every game must record and replay opponent moves through the shared replay system (`core/replay.js`, `ui/replay.js`): a move carries a compact log (its inputs with their timings, or the run's/attempt's own log or recording) that plays back deterministically through the game's normal view: the selection pressed and typed in, then the move. Online the log rides the move; the computer's moves get one too. Replays play at normal speed with a Skip button after 2 seconds; Super Chaos replays the computer's round at 2x in a pop-up over its square. A game whose view plays the mover's screen from the flash itself (a run, an attempt, a reveal, a throw) says so (`OWN` in `ui/replay.js`); one with a draft (letters, pegs, numbers, cards, a two-tap aim, a pull) adds `replay` hooks (`input`, `synth`) in its `view.js`.
- No help text inside mini-games. Instructions live only in the "?" explainer: "Name — Play: … Win: …", plain and short.
- Sound: one AudioContext, resumed on every tap and whenever the page becomes visible. Game inputs play only their own sound, never the UI click. CC0 or synthesised sounds only, listed in SOUNDS.md.
- Mobile: touch-action none on play areas; no long-press magnifier, selection or callout; no tap highlight; no horizontal scrolling; aim for 60fps. Inputs can start anywhere on the mini-game screen.
- Original art only. No characters, logos or names from existing games or brands. Colours and fonts come from the shared style tokens.
- Online: Find Match is server-authoritative. Hidden information (answers, decks, hidden cells) stays on the server until revealed. Physics games: the client sends aim and power, the server simulates and sends a recording, both phones replay it. Real-time skill games report results that the server sanity-checks.
- Release control: new games default to Admin only. Admin-only games never appear to non-admins anywhere, and never in Find Match.
- Turn timer: one deadline per turn, never reset by actions within a turn.
- Stats count only squares that ended claimed by X or O. Bot games are tracked separately.
- Balance targets: about 4–6 of a player's own moves to win a square; no guaranteed wins in 2 moves; every move should help the mover more than the opponent (no waiting traps); first-mover win rate under 60%. Tunable values live in the admin config, not in code.
- Shared components: quiz games (Trivia, Patterns, Geo Quiz) use the quiz component (Reveal locks the player in, cross-outs centred and shared, question persists until solved, button press feedback). Runners use the runner framework. Attention games use the attention framework (Start locks the player in, 3 levels, first to 3 correct).
- Data attribution: Open Trivia Database (CC BY-SA 4.0), OEIS (CC BY-SA 4.0), VisualPuzzles (MIT), Natural Earth (public domain), flag-icons (MIT). Credits screen and README.
- Ratings and the leaderboard are off (RATINGS_ENABLED = false). Don't re-enable without being asked.

## Workflow
- Keep changes scoped to what's asked. Touch only the relevant game folders.
- Run `npm test` for the games you changed. Run simulations only when a prompt asks or when changing a game's balance.
- Don't stop for review unless the prompt asks. If something is ambiguous, pick the option most consistent with these rules and note it.
- Deploy once at the end with deploy.sh.
- Finish with a short report: what changed, anything skipped or uncertain, and the live URL. Keep it under 10 lines.
