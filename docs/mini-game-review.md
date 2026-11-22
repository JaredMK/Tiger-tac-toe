# Mini-game review (started 22 November 2026)

**This file is the review's memory.** Before working on any game, re-read its section. If the session restarts or
is summarised, continue from the "Where things stand" block below.

## The brief (the owner's, 22 November 2026)
Review and upgrade every mini-game, unreleased (Admin only) ones first. Goal: every mini-game feels exceptional,
plays well inside Classic, and looks and sounds like one game. Follow CLAUDE.md. Staging only. iPhone only, no iPad.

Gameplay rules (Classic: players alternate one move in any square, so an opponent can ignore a square forever):
1. winnable by one player moving alone; median 3–6 moves per player
2. every move advances the mover; no move should mainly set up the opponent
3. first mover wins 45–60%
4. when both play the same square they should interact: race, block, steal, knock back
5. private information only where Same phone mode already handles it

Phases: **1 Audit** (no code changes) → **2 Style guide** (`docs/style-guide.md`) → **STOP: send the style guide and
the audit summary, wait for approval** → **3 Upgrades** in approved batches of 4–6 games, worst first, a staging
deploy after each batch (released games: look, sound and smoothness directly; any rule change behind a per-game
admin switch, default off; unreleased games change freely; keep tests passing, add tests only for rule changes) →
**4 Report** (this file finalised: before and after scorecards, changes per game, rule changes waiting on switches,
games to cut or rework further).

## Where things stand
- **Phase: 1 (audit), in progress.** No game code is to change in this phase.
- The six new games (Split It `pint`, Gem Swap `gems`, Castle Smash `castle`, Tank Duel `tanks`, Puzzle Build `jigsaw`,
  Letter Hive `hive`) and Road Race's rework (`rally`) were finished, merged and deployed to staging on 23 November 2026
  (their notes are in CLAUDE.md). They have not been audited yet: audit them with the rest.
- Audit harness and raw results: see "Method" (scripts under `scripts/audit/`, results under `docs/review-data/`).
- First simulation pass (22 Nov): `docs/review-data/sim/<id>.json` for 94 games (Wall Race's run did not finish; the
  seven new games not run). **Not yet trusted**: `scripts/audit/sim.js` disagrees with several games' own
  `tests/sim/<id>.sim.js` (e.g. Brick Break 82% first mover here, 59% in its own sim; Four in a Row's median 19 moves;
  Echo stuck: it needs Start). Validate the harness before using these numbers.
- Next step: see the last line of the log at the end of this file.

## Method (Phase 1)
For each game, from the code as it is on `staging`:
- **Simulation**: 300 squares, the computer against itself at Normal (`scripts/balance-sim.js --squares 300
  --no-matches --no-changes`: the engine as the page and the server run it, the first mover alternating): the winner's
  moves (25%, median, 75%), the reset (draw) rate, the first mover's share of decided squares. A "move" there is a
  turn as the stats count it (a bonus action inside a turn is not a new move).
- **Play from both seats**: the page itself in headless Chromium at 375x667 (an iPhone SE's width), a Play Computer
  match of that game alone, once as X and once as O, played with real taps where the control is a tap and through the
  page's own `attemptMove` otherwise; page errors, stalls and refused moves noted.
- **Screenshots** at 375 px: the full view mid-game, the board with its miniature, a replay of the computer's move.
- **Performance**: the same play under 4x CPU slowdown (Chromium's CPU throttling), every task over 50 ms
  (`longtask`) and every frame gap over 50 ms while a move plays, noted with what was on screen.
- **Real stats**: `docs/stats/` (the admin's CSV exports of 22 November 2026: production, 7 days; only the 18
  released games have any: plays, not finished %, median seconds, first mover wins %).
- **Scores 1–5** (5 best) on eight things; fun is not scored, a suspected fun problem is flagged with the reason.

### The scoring rubric
| Score | 5 | 3 | 1 |
|---|---|---|---|
| Rule fit | all five gameplay rules hold (alone-winnable, median 3–6, every move advances the mover, first mover 45–60%, private info only where Same phone handles it) | one rule a little off (median 6–8 or 2–3, first mover 60–65% or 40–45%) | a rule broken outright (not winnable alone, first mover over 70%, median over 9 or under 2, moves that mainly help the other side) |
| Clarity in the first 10 s | what to do and what just happened are obvious with no explainer | understood after one move or a look at the "?" | still unclear after a few moves |
| Shared-board interaction | both players in the square clearly affect each other (race on one board, block, steal, knock back) | a race side by side: each sees the other's progress, nothing to do about it | two solitaires with no bearing on each other |
| Visuals | among the best in the game: one look, strong drawing, clear states | fine but plain, or a little off the game's look | placeholder-like, cluttered or off-style |
| Miniature | reads at board size at a glance: what game, who is ahead | readable with a second look | noise at board size |
| Smoothness | no task or frame over 50 ms at 4x slowdown, instant touch response, no layout jump | a few hitches of 50–100 ms | hitches over 100 ms, a layout jump, or a delayed touch |
| Audio | every action and result has its own fitting sound at an even level, pleasant on repeat | sounds present but thin, generic or uneven | missing, grating or badly out of level |
| AI | plays like a fair person at each level, Hard a real step up, never superhuman or foolish | plays legally and sensibly, levels barely differ | plays badly, or wins by means a person cannot use |

## Status
| Game | id | Status | Audit | Upgrade |
|---|---|---|---|---|
| 21 | `bj` | Admin only | not started | |
| Apple Pick | `apple` | Admin only | not started | |
| Backgammon Lite | `bglite` | Admin only | not started | |
| Bin Shot | `toss` | Admin only | not started | |
| Bingo | `bingo` | Admin only | not started | |
| Block Drop | `blocks` | Admin only | not started | |
| Bowling | `bowling` | Admin only | not started | |
| Brick Break | `bricks` | Admin only | not started | |
| Castle Smash | `castle` | Admin only | not started | |
| Chopper | `chopper` | Admin only | not started | |
| Coin Pusher | `pusher` | Admin only | not started | |
| Cup Pong | `pong` | Admin only | not started | |
| Darts Cricket | `cricket` | Admin only | not started | |
| Dash | `dash` | Admin only | not started | |
| Dice Combo | `combo` | Admin only | not started | |
| Districts | `districts` | Admin only | not started | |
| Dominoes | `dominoes` | Admin only | not started | |
| Echo | `echo` | Admin only | not started | |
| Find the Pair | `memory` | Admin only | not started | |
| Flap | `flap` | Admin only | not started | |
| Flash | `flash` | Admin only | not started | |
| Flood | `flood` | Admin only | not started | |
| Fruit Reels | `reels` | Admin only | not started | |
| Fruit Slice | `slice` | Admin only | not started | |
| Gem Swap | `gems` | Admin only | not started | |
| Glass Bridge | `bridge` | Admin only | not started | |
| Headcount | `headcount` | Admin only | not started | |
| Heads or Tails | `heads` | Admin only | not started | |
| Hex | `hex` | Admin only | not started | |
| Home Run Heroes | `homer` | Admin only | not started | |
| Hook-a-Duck | `duck` | Admin only | not started | |
| Key Drop | `keydrop` | Admin only | not started | |
| Krabs | `craps` | Admin only | not started | |
| Lane Rush | `lane` | Admin only | not started | |
| Letter Hive | `hive` | Admin only | not started | |
| Mahjong | `mahjong` | Admin only | not started | |
| Mancala Race | `mancala` | Admin only | not started | |
| Marble Toss | `marble` | Admin only | not started | |
| Maze Runner | `maze` | Admin only | not started | |
| Mini Golf | `golf` | Admin only | not started | |
| Muncher | `muncher` | Admin only | not started | |
| Mystery Face | `faces` | Admin only | not started | |
| Number Shuffle | `numbers` | Admin only | not started | |
| Odd One Out | `oddone` | Admin only | not started | |
| Patterns | `patterns` | Admin only | not started | |
| Peg Jump Race | `pegs` | Admin only | not started | |
| Pig | `piggy` | Admin only | not started | |
| Pinball | `pinball` | Admin only | not started | |
| Point Roll | `proll` | Admin only | not started | |
| Poker Hands | `poker` | Admin only | not started | |
| Pool | `pool` | Admin only | not started | |
| Puzzle Build | `jigsaw` | Admin only | not started | |
| Rhythm Tap | `rhythm` | Admin only | not started | |
| Ride the Bus | `bus` | Admin only | not started | |
| Risky Spins | `wheels` | Admin only | not started | |
| Road Race | `rally` | Admin only | not started | |
| Roads | `roads` | Admin only | not started | |
| Rummy Lite | `rummy` | Admin only | not started | |
| Scoop Stack | `scoop` | Admin only | not started | |
| Scratch & Match | `scratch` | Admin only | not started | |
| Seating | `seating` | Admin only | not started | |
| Shape Split | `split` | Admin only | not started | |
| Shell Game | `shell` | Admin only | not started | |
| Shelves | `shelves` | Admin only | not started | |
| Ship, Captain & Crew | `scc` | Admin only | not started | |
| Shuffleboard | `shuffle` | Admin only | not started | |
| Shut the Box | `shut` | Admin only | not started | |
| Sky Hop | `skyhop` | Admin only | not started | |
| Snake | `snake` | Admin only | not started | |
| Snapshot | `snapshot` | Admin only | not started | |
| Sniff | `sniff` | Admin only | not started | |
| Split It | `pint` | Admin only | not started | |
| Standoff Grid | `clash` | Admin only | not started | |
| Star Swarm | `swarm` | Admin only | not started | |
| Takeover | `takeover` | Admin only | not started | |
| Tank Duel | `tanks` | Admin only | not started | |
| Target Practice | `target` | Admin only | not started | |
| Thirty-One | `t31` | Admin only | not started | |
| Trail Race | `trail` | Admin only | not started | |
| Treasure Hunt | `hunt` | Admin only | not started | |
| Trivia | `trivia` | Admin only | not started | |
| Twist Four | `twist` | Admin only | not started | |
| Wall Race | `walls` | Admin only | not started | |
| Word Tiles | `wtiles` | Admin only | not started | |
| Bullseye | `bullseye` | Released | not started | |
| Bump | `bump` | Released | not started | |
| Candy Race | `candy` | Released | not started | |
| Claw Machine | `claw` | Released | not started | |
| Codebreaker | `mastermind` | Released | not started | |
| Coin Flip | `coins` | Released | not started | |
| Five Letters | `wordle` | Released | not started | |
| Four in a Row | `c4` | Released | not started | |
| Hangman | `hangman` | Released | not started | |
| Higher/Lower | `hilo` | Released | not started | |
| Little Wheel | `rl` | Released | not started | |
| Peg Drop | `plinko` | Released | not started | |
| Risky Rolls | `pig` | Released | not started | |
| Rock Paper Scissors | `rps` | Released | not started | |
| Sea Battle | `bs` | Released | not started | |
| Snakes and Ladders | `snakes` | Released | not started | |
| Tic-Tac-Toe | `ttt` | Released | not started | |
| War | `war` | Released | not started | |

## Per-game audits
(One section a game, added as each is audited: unreleased first.)

## Log
- 22 Nov 2026: file created; the 300-square simulations started for the 95 games already on staging; the audit
  harness (browser play, screenshots, performance) is being written. Next: finish the harness, run it, then audit the
  unreleased games in groups.
- 23 Nov 2026: the seven new and reworked games merged and deployed to staging (separately from this review). Trail Race
  fixed on the way (a trail that boxed itself in left its player with no move). Next: validate `scripts/audit/sim.js`,
  finish the simulation pass, then the browser pass, then audit the Admin only games.
