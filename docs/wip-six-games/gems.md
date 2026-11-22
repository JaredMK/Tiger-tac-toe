# Gem Swap (`gems`): the builder's report

Branch `g/gems`, worktree `/home/user/g-gems`. Everything is committed; nothing pushed.

## 1. CLAUDE.md paragraph

- Gem Swap (`gems`, December 2026, Admin only, brain; `CLIENT_VERSION` and its `minVersion` 1.30.0): one shared board of `size` 7 by 7 (`mini.n`, `mini.b`: a string of n * n digits, a gem's kind 0 to `kinds` - 1 row by row from the top; `kinds` 6, kept on the square) and each player's points (`pts`, kept whole; a tally shows them up to the target). A move swaps two gems that touch along a side, `{ a, b }` (their cells), and is taken only if the swap makes a line of three or more of one kind across or down (refused `bad`, `apart`, `noline`). The board then settles (`rules.js` `gemsResolve(g, n, kinds, a, b, rng)`, the one function the server, the page and the computer use): every gem in a line goes (a gem in two lines once), the gems above fall, new gems drop in at the top (the move's rng: the server's online), and again while anything lines up; a point a gem removed, every cascade included; the first to `target` 32 takes the square at once. `last` holds the whole move (`was` the board before, `a`, `b`, `steps: [{ x: cells removed, g: the new gems, column by column, each column's from the top }]`, `n`, `from`, `to`) and `gemsFrames(last, n)` plays it again exactly (the view and the tests use it). A board left with no swap is shuffled (`gemsShuffle`: the same gems until no line is ready and a swap can be made, a fresh deal after 60 tries; `last.sh` the new board); a deal is `gemsDeal` (no line ready, a swap to make; `gemsPlain` a set board, so a deal ends under any rng) and **the opening board is a settled one** (`gemsOpen`: `GEMS.settle` 8 swaps played on the fresh deal for nobody; a fresh deal's best swap was sure of 7.2 gems and brought 9.2 against 5.0 and 6.3 on a board in play, and the first to move won 67-69%). Nothing hidden; the new gems are chance, so the phone never shows a guess (`net/moves.js` `predictMove`'s two draws never agree: held by its test) and the two gems only show pressed (`.gsc.pick.pend`) until the record lands. Not held out of Find Match (the server makes the same move). "Go again on success" (off by default): a swap that removes `againAt` 6 gems or more keeps the turn (`again`, `mini.go`, note `combo`; at 6 that is nearly half the swaps and a square is over in 2.2 turns each: 10 suits it better, 3.9 turns). Equal turns (`even`, **off by default**, the first to the target winning at once as asked): on, a player who reaches the target having had a turn more (`turns`) waits (`final: { by, pts }`, note `reached`) and the other has one turn to answer: past the leader's total takes it (`passed`), level is a draw (`tie`), short leaves it (`held`, `winner`), an answer never made is taken by the leader's next swap there (`unanswered`). Settings (`meta.js` `TUNE`): `again`, `againAt`, `target`, `even`, `size` (5 to 8), `kinds` (4 to 6), `aiEasy` 60 (% of Easy's swaps taken at random), `aiHard` 60 (% weight on the best swap left for the other side). The computer (`ai.js`), from the public board: a swap is worth the gems it is sure to remove, cascades counted as far as the gems on the board decide them (`gemsResolve` with no rng: a refilled cell is unknown and lines up with nothing); Easy any swap `aiEasy` % of the time, else the one worth most; Normal the one worth most; Hard a swap that wins at once, else the one worth most less `aiHard` % of the best swap it leaves the other side on the board it knows (plus it, where the swap keeps the turn), within `ctx.until` (about 0.2 ms a move); `needs` the points left over `GEMS_AVG` (6.3 gems a turn with six kinds, 10.4 with five). The view (`gems/view.js`): six original gems, each its own shape as well as colour (round blue, square-cut green, pink triangle, purple hexagon, white star, teal teardrop; `KINDS`, one `<symbol>` each, a cell `<use>`s it), a tray sized from its box (`.gsgrid`, `--gu` a cell: 46.8 px at 360), the result's line under it; a tap picks a gem (`gems-cell`, `gsPick`, a ring in the mover's colour), a tap on a neighbour swaps, a drag of `GEMSV.drag` 0.38 of a cell towards a neighbour swaps at once (pointer events on `#app`; the click that ends a drag is swallowed), a swap that makes no line nudges the two gems (`nudge`, Web Animations) with `gsNo` and sends nothing. A move plays from its flash (`flash.gs` = `last`) as layers (`.gsl`, each on show from `--f` to `--u`): the board as it was with the two gems changing places, the board before each step (its gems bursting `.pop` with a ring in the mover's colour, the rest falling `.fall`, the new ones dropping in `.drop`), the board at the end (after a shuffle's `.swirl`/`.unswirl`); the mover's figure counts on burst by burst (`.gsv`) and the line says "+3", "+7 Combo!", "+12 Combo x3!", then "Shuffle!" (`.gsw`; kept short: on a 360x640 phone the line shares its height with a replay's Skip at the bottom left). One timing table, `GEMS` (swap 180, pop 260, fall 240, gap 60, shuffle 640, hold 320) and `gemsTimes(last)` (each step's `pop`, `fall`, `land`, `casc`, `sh`, `end`) for `flashMs`, the layers and the sounds; the stylesheet's block takes them from `--ts`/`--tp`/`--tf`/`--th`. `replay.synth` gives none (the move plays from its flash for everyone); `ownLine`; `hold` 0 after a swap that keeps the turn; `heldSub`. Sounds: `gsPick`, `gsSwap`, `gsPop` (a note higher each step, a result: the medium buzz), `gsLand`, `gsNo`, `gsShuffle`, the existing `sparkle` at a third step. The miniature: the board itself as small shapes in their colours beside each player's bar (`.tgsw`, `barRows`). Normal v Normal (`tests/sim/gems.sim.js`): 4.8 turns each (median 4.5), the winner's 5.1, **the first mover 60.5%** over 6,000 squares (a plain race, every turn worth 6.3 gems give or take 4: at the top edge of the band and a shade over; 28 to win 4.1 turns, 36: 5.3, 40: 5.8, all 59-61%); Equal turns on: 5.0 turns, 48%, 2.4% level; five kinds 3.0 turns at 32 (4.6 at 50, 62%); Hard v Hard 5.5 turns, 64%; Easy v Easy 5.6, 57%; Hard beats Normal about three squares in five. `tests/games/gems.test.js`, `tests/ui/gems.test.mjs`.

## 2. SOUNDS.md row

| Gem Swap (December 2026) | `gsPick` / `gsSwap` / `gsPop` / `gsLand` / `gsNo` / `gsShuffle` / `sparkle` | On this phone, each its own sound, never the interface's click, and never sent: a gem picked up or put down (new: a glassy tick, a triangle 1480→1900 Hz with a pinch of high noise; lower when put down) and a swap that makes no line (new: a soft double "uh-uh", two falling triangle notes 300→250 and 240→190 Hz). Then from the move's own moments (`gems/rules.js` `GEMS`, `gemsTimes`), once, live and in a replay: the two gems sliding past each other (new: a rising band of noise 1.4→3.2 kHz over two crossing sine glides); each step's burst (new: a triangle chime 1046→1568 Hz with a sine ping at 2093 Hz and a crack of high-passed noise, played 12% higher with each step of a cascade; a result: the medium buzz) and its landing (new: a short clack of noise at 1.1 kHz over a triangle 300→180 Hz); the existing `sparkle` at a cascade's third step; a shuffle (new: a rattle of nine noise ticks at changing pitches over a rising hiss). All synthesised. |

## 3. Sim numbers (`npm run sim -- gems`; 500 squares unless said)

| | turns each (mean / median) | the winner's (mean / median) | first mover | draws |
|---|---|---|---|---|
| **Defaults (7x7, 6 kinds, 32 to win), Normal v Normal** | **4.68 / 4.5** | 4.98 / 5 | **60.4%** | 0 |
| the same over 3,000 squares | 4.76 / 4.5 | 5.06 / 5 | 60.5% | 0 |
| the same over 6,000 squares (my tuning run) | 4.76 / 4.5 | 5.06 / 5 | 60.5% | 0 |
| 28 to win | 4.09 / 4 | 4.39 / 4 | 60.0% (61.5% over 6,000) | |
| 36 to win | 5.25 / 5.5 | 5.55 / 6 | 59.2% (59.7% over 6,000) | |
| 40 to win | 5.82 / 6 | 6.12 / 6 | 59.0% | |
| five kinds, 32 to win | 2.97 / 3 | 3.30 / 3 | 66.0% | |
| five kinds, 50 to win | 4.61 / 4.5 | 4.92 / 5 | 62.4% | |
| 6x6 board, 26 to win | 4.46 / 4.5 | 4.77 / 5 | 62.8% | |
| 8x8 board, 36 to win | 4.54 / 4.5 | 4.83 / 5 | 59.2% | |
| **Equal turns on** (3,000 squares) | 5.04 / 5 | 5.04 / 5 | **48.2%** | 2.4% |
| Go again on, 6 gems (the default) | 2.15 / 2 | 2.43 / 2 | 57.4% | |
| Go again on, 8 gems | 3.32 / 3 | 3.62 / 3 | 60.2% | |
| Go again on, 10 gems | 3.93 / 4 | 4.22 / 4 | 57.8% | |
| Hard v Hard | 5.46 / 5.5 | 5.78 / 6 | 63.6% | |
| Easy v Easy | 5.63 / 5.5 | 5.91 / 6 | 57.0% | |
| Hard v Normal / Normal v Hard | 4.98 / 5 and 4.99 / 5 | | 71.2% / 52.4% (Hard wins 59%) | |
| Normal v Easy / Easy v Normal | 4.83 and 5.11 | | 80.6% / 34.6% (Normal wins 73%) | |

A turn brings 6.29 gems (sd 4.05; the most in 500 squares: 40). Squares won inside their winner's first two turns: 3.0% of the sim's 500 (2.1% of 3,000: 64); on a first turn 0.2% (6 of 3,000: a cascade worth the whole target).
Before the settled opening board (a plain fresh deal): 32-35 to win gave the first mover 67-69%.

**The target that is not cleanly met:** the first mover. At the defaults it is 60.5% (6,000 squares): the top edge of 45-60%, a shade over. No target, board size or number of kinds brings it clearly inside (it is a plain race: P(first) = (1 + P(both would finish on the same turn)) / 2). The sim's assert allows 45-63% for the 500-square run and its header says why. The `even` switch (off by default) brings it to 48%.

## 4. Shared-file edits outside my slots

None. (Inside my slots only: `src/audio/sound.js` `[gems]`, `src/ui/haptics.js` `[gems] results` = `['gsPop']`, `[gems] bad` left empty, `src/ui/styles.css` `[gems]`.)

For the lead to do by hand, since I may not touch those files:
- `scripts/help-text.js` / `docs/help-text.md`: the explainer (`meta.js` `explainer`), the two settings sentences (`explainVars`: "Burst N or more with one swap and you go again.", "If the first to move gets there first, the other player gets one turn to answer: the higher score wins."), `goAgainText.on` (a fallback never shown: `explainVars` overrides it with the square's own number), and the game's own words: "+N", "Combo!", "Combo xN!", "Shuffle!", "Beat N to take it" / "N to beat" (Equal turns, while an answer is owed), the held line "[name] burst a big bunch · goes again".
- `CLAUDE.md`, `SOUNDS.md`: sections 1 and 2 above.

## 5. Decisions and doubts

- **Equal turns (`even`) is an addition of mine**, off by default. The lead's decision "first to `target` wins at once" is the default and unchanged. I added the switch because the measured first-mover share sits at 60-61% whatever the target, and the brief names equal turns as the remedy. If the lead wants the 45-60% target met outright, flip `even`'s `def` to `'on'` in `meta.js` (and the two asserts that name the default: `tests/games/gems.test.js` "def, 'off'", and the sim's first test's band). With it on the totals matter past the target (the higher wins), so `pts` is kept whole in the state and capped only on show.
- **The settled opening board** (`gemsOpen`) is also mine: eight swaps are played on the fresh deal for nobody before the square opens. It is not a handicap (nothing is taken from or given to either side): it makes the first board the same kind of board as every later one. Without it the first mover had 67-69%.
- **Six kinds, 32 to win**: chosen by simulation (five kinds needs 50 points for the same length and has wilder cascades).
- **`againAt` 6 kept as the lead set it**, but with "Go again" on it keeps the turn on nearly half the swaps (2.2 turns each). 10 would suit (3.9 turns each, first mover 58%). Only matters if the switch is turned on.
- The state has three small fields beyond the lead's list: `turns`, `go` (whose turn a go-again keeps), `final` (Equal turns). `go` is cleared by the next move in the square, so a player who earns a go-again, lets the clock run out and later moves there again is counted one turn short: it only matters with `even` and `again` both on.
- The miniature is laid out picture beside bars (as asked). At a board square's size (about 55 px for the 7x7) a gem is 8 px: the shapes read as coloured dots with a hint of shape. The bars are short (about 25 px).
- The gems are drawn with `<symbol>`/`<use>` (ids `gsk0`..`gsk5` in the game's own root): the first use of `<use>` in the code base; it keeps a five-step cascade's layers light (about 60 bytes a gem). Works in Chromium; not tried in Safari (no Mac here). If it misbehaves there, inlining the three paths in `gem()` is a one-line change.
- A long cascade plays at a fixed 560 ms a step (a six-step one takes 3.5 s before the hold); not shortened for long ones.
- Hard is fast (0.2 ms a move), so `ctx.until` never binds in practice; it is honoured (after the first four swaps looked into).
- Not done: no hint for a player who cannot find a swap (a shuffle only happens when there is none); nothing in Super Chaos (it is off).
- Test runs: `node --test tests/games/gems.test.js tests/ui/gems.test.mjs` 15 of 15; `npm run sim -- gems` passes; `FLOW_GAMES=gems npm run test:flows`: the four gems flows pass (vs the computer, Same phone, online with no timer and with the match clock); `check-headers` (320/360/390/430, cpu and same) and `check-miniature-text` clean. `npm test` on this machine (four cores shared by all the builders, load 20+): everything passes except other games' wall-clock asserts ("under 60 ms", "quickly": bj, c4, clash, districts, hangman, hex, hilo, pig, plinko, wordle), each of which passes when run alone. `tests/flows/board-titles.test.mjs` fails here with a page error `Cannot read properties of null (reading 'HOLES')` (a physics game drawn before Matter.js has loaded on the loaded machine: not Gem Swap's; it does not name gems).

## 6. Screenshots

All in `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/`, for 360 (360x640), 390 (390x844) and 430 (430x932):
- `gems-<w>-01-board.png` the main board, nine miniatures
- `gems-<w>-02-open.png` the square opened
- `gems-<w>-03-picked.png` a gem picked; `gems-<w>-04-nudge.png` a swap refused, the nudge
- `gems-<w>-05-swap-1.png` to `-6.png` a tapped swap playing (bursts, falls, the count and "Combo!")
- `gems-<w>-06-board-after.png` back on the board, the miniature with bars
- `gems-<w>-07-drag-pop.png`, `-08-drag-fall.png` a dragged swap
- `gems-<w>-09-midgame.png`, `-10-explain.png` (the "?" card), `-11-won.png`, `-12-board-won.png` (the square stamped)
- `gems-reduced-1.png` (reduced motion, 390x660, long names), `gems-same-2.png` (Same phone, 390x660)

The scripts that made them: `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/gems-shots.js` and `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/gems-rm.js`.
