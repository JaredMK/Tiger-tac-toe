# Art-style audit: 20 mini-games against the comic style (November 2026)

Report only: no code changed. Screenshots at 390x844 (CSS px, 1x JPEG) are in `docs/art-audit/`.

## How it was captured

- `scripts/audit/play.js`'s in-page helpers, driven by a scratch runner. The runner is not committed; how it differs from `play.js`:
  - **Board:** the eight outer squares are pre-filled so that the centre square decides the match.
  - **Two runs per game:** a win run (this phone at Hard against the computer at Easy) and a lose run (this phone at Easy against the computer at Hard). Each was retried up to 3 seeds to get the wanted outcome.
- **Screenshots per run**, `docs/art-audit/<id>-<win|lose>-<shot>.jpg`:

  | Shot | What it shows |
  |---|---|
  | `setup` | The game as first opened |
  | `mid` | Mid-play, after about 2 moves |
  | `opp` | The computer's move being played back (opponent turn) |
  | `square` | The square just decided (the game's own win or lose moment) |
  | `result` | The match result screen |

- **Outcomes not reached**, since luck decides these games:
  - Candy Race: no win (its `win-*` shots show a loss).
  - Bump, Hangman and War: no loss (their `lose-*` shots show a win).
  - Coin Flip's win run has no `opp` shot.
- **Shared screens:**
  - The Play Computer setup and the result screens are the same for every game: `ttt-win-cpusetup.jpg` (the main menu), and any `*-result.jpg`. They are reviewed once, under Shared below.
  - Each game's "setup" is therefore its opening state.
- **Code scan:** hardcoded colours, fonts and sizes were read from each game's `view.js` and its rules in `src/ui/styles.css` / `src/ui/comic.css`.

## 1. Baseline: what "our comic style" is

Taken from:
- **Shared theme:** `src/ui/styles.css` `:root` (`--ink`, `--x`, `--o`, `--bg`, `--paper`, `--sea`, `--green`, `--gold`, `--cr/--cy/--cg/--cb`) and `src/ui/comic.css` (Comic Chaos: `--cc-sh`, `--cc-skew`, `--cc-burst`).
- **Shared components:** `src/ui/tok.js` (the player token), `src/ui/progress.js` (`arcTally`, `gaugeBar`) and `src/ui/hash.js`.
- **Newest games** (December 2026): Door Drop, Barrel Launch, Gem Swap, Letter Hive. See `art-audit/baseline-doors-mid.jpg`, `baseline-barrel-mid.jpg`, `baseline-gems-mid.jpg`, `baseline-hive-mid.jpg` and `baseline-doors-win.jpg`.

| Element | The rule |
|---|---|
| Outlines | Every object outlined in ink (`--ink` #161210). Play-surface panels 3–3.5 px; pieces and props 2–3 px (SVG stroke about 1.8 at miniature scale); round joins. |
| Palette | Flat fills from the tokens: cream page `--bg`, paper `--paper`/`--card`, sea `--sea`/`--sea-2`, `--green`, `--gold`. **Red `--x` and yellow `--o` mean the players and nothing else.** Scenery may use a simple two-stop sky gradient (Door Drop, Barrel Launch); no wood grain, metal shading, vignettes or gloss. |
| Fonts | Frame (header, Board/"?", captions, buttons): Bangers and Comic Neue (`comic.css`). Inside a game: Luckiest Guy for big words and result lines (`.ddline`/`.brlline` 21px) and Patrick Hand for small text. Nothing under about 14px for anything a player must read. No Nunito/Arial/system faces. |
| Shadows / stickers | Hard offset ink shadow, no blur: panel `0 4px 0 var(--ink)` (newest games), frame `--cc-sh` 4px 4px. Bursts (`--cc-burst`) for big moments only. |
| Buttons | The game's one big action is a `.big` slab: ink border, hard shadow, the mover's colour (red for X, yellow for O), greyed when it's not your turn (never removed). |
| Pieces / tokens | A player is their character: the toon X/O (`ui/art.js` `toonG`: Tic-Tac-Toe, the header, Door Drop, Barrel Launch, the race tracks) or, small, `ui/tok.js` `tok(p)` (a disc in the player's colour with the drawn mark). |
| Tallies | `arcTally` boxes (`.ctal`) in a row across the top: name, gauge or pips, figures. |
| Backgrounds | The game sits on the raised cream page (`.gwrap`), and its play surface is one ink-framed panel that fills the room it is given. |
| Win/lose | Inside the square: the game's own moment, plus the result line in its reserved row (green `--green` for good, `--muted` for bad). The match: the shared loud result screen (`win.js`: a burst, rays, halftone). |
| Effects | Bursts, confetti and screen shake from the move's event (`ui/fx.js`). |

## 2. Per game

Rating:
- **Matches:** nothing a player would notice.
- **Minor:** small departures.
- **Off:** visibly a different style.

Screenshot paths are under `docs/art-audit/`; `<id>-*` means that game's 10 shots.

| Game (id) | Rating | Mismatches | Screenshots |
|---|---|---|---|
| Tic-Tac-Toe (`ttt`) | Matches | The reference (toon marks, ink tiles, hard shadows). The lose frame shows O's three in a column without the strike line the win frame has: probably the frame's timing, check it. | `ttt-win-mid.jpg`, `ttt-win-square.jpg`, `ttt-lose-square.jpg` |
| Four in a Row (`c4`) | Matches | Sea-blue board, ink outlines. Pieces are its own plain white ×/ring on red/yellow discs, not `tok()` or the toon (see fix 4). | `c4-*` |
| Candy Race (`candy`) | Matches | Track, wheel and counters all on tokens (`--cr/--cy/--cg/--cb`). Track sits high with a large empty band below. Status line ("No spins yet") about 12px Patrick Hand. | `candy-*` |
| Bump (`bump`) | Matches | As Candy Race. Wheel's pink segment is not a token. Small status text. | `bump-*` |
| Snakes and Ladders (`snakes`) | Matches | Snakes and ladders drawn over the number tiles, covering numbers (busy). Small status text. | `snakes-*` |
| Sea Battle (`bs`) | Matches | `--sea` grid, burst hits, firer's colour on shots. Ship card's caption ("Hunting · 3 parts") about 11px. | `bs-*` |
| Risky Rolls (`pig`) | Matches | Felt from tokens. Its own large score cards rather than `.ctal` tallies (bigger than every other game's). | `pig-*` |
| Apple Pick (`apple`) | Minor | Orchard flat and ink-outlined (good). Helper line under the wheel ("You: 10 apples to pick") about 12px. | `apple-*` |
| Takeover (`takeover`) | Minor | Tiles use plain white ×/ring glyphs (own drawing, not `tok()`/toon). The 5x5 grid fills only the top half of the play area, leaving a big empty band. | `takeover-*` |
| Coin Flip (`coins`) | Minor | Coins carry plain ×/ring glyphs. The undecided coin is a grey halftone disc (the only grey piece). | `coins-*` |
| Codebreaker (`mastermind`) | Minor | Peg colours add orange and pink outside the tokens (needed for six colours). Feedback pegs about 5px. Secret-code bar is a black pill seen nowhere else. Guess rows small in a mostly empty panel. Win frame still shows "? ? ? ?" (check the reveal's timing). | `mastermind-*` |
| Five Letters (`wordle`) | Minor | **"In the word" tiles are `--o` yellow, the O player's colour.** Tally is a thin strip of dots, not `.ctal` boxes. Keys small. | `wordle-*` |
| Hangman (`hangman`) | Minor | Wrong-letter chips about 12px. Word on bare dashes (no tiles, unlike Five Letters). Status line about 12px. | `hangman-*` |
| Higher/Lower (`hilo`) | Minor | Same thin tally strip as Five Letters. Guess-history line about 11px. | `hilo-*` |
| Peg Drop (`plinko`) | Minor | Board a pale grey-blue (not a token); slot labels in off-token blue-greys. "Computer" cut to "Comput…" in its tally at 390px. Bonus text `#8a5d00`. | `plinko-*` |
| Rock Paper Scissors (`rps`) | Minor | Green felt is a hardcoded radial vignette (`.rpsarena` `#74b47e → #3f7f52`). "House"/"You" labels about 10px. | `rps-*` |
| War (`war`) | Minor | Blue felt a hardcoded vignette (`.g-war` `#5873ba → #2c3972`) inside a wood rail. "Dealer" label about 10px. | `war-*` |
| Claw Machine (`claw`) | Minor | Purple cabinet and glossy glass streaks (neither in the palette). The claw and cable are thin grey lines with no ink. Prizes use their own colour set (`claw/view.js` `#e5605a #4e9de0 #7cc457 #f2b33d #b07fe0 #f08bb8`). The Drop button disappears on the computer's turn (every other game greys it). | `claw-*` |
| Bullseye (`bullseye`) | **Off** | A painted, semi-realistic scene: teal wall (`#4b7d8a/#386270`), a wood floor with grain (`#7a5230/#2f2118`), metal-shaded darts (`#c9d0d8 #8b949f #eef1f5 #727b86`). Thin or no ink outlines on board and darts. 16 hardcoded hex values and 16 `rgba()` in `bullseye/view.js`, none tokens. | `bullseye-*` |
| Little Wheel (`rl`) | **Off** | Casino-style wheel: a wood rim and spokes (`#7a4a2a #a8703f`), **red pockets `#d6301e`, a near-copy of the X player's red**, black `#2b2b2b`. Pocket numbers tiny (about 7px). The tallies stacked beside the wheel instead of across the top (the only game laid out so). | `rl-*` |

## 3. Shared (not one game's)

- **Match result screens** (`*-win-result.jpg`, `*-lose-result.jpg`) and the main menu (`ttt-win-cpusetup.jpg`): one Comic Chaos design for every game, consistent. On the main menu at 390px the "Play a Friend" panel's "2 PLAYERS" tag runs off the right edge.
- **Two font families:**
  - The frame uses Bangers / Comic Neue; game interiors use Luckiest Guy (191 declarations in `styles.css`) / Patrick Hand, the newest games included. This is consistent between games, and the two display faces differ only slightly.
  - Nunito, which is not loaded, still appears in shared and other games' code, so it renders as Arial: `.tcd` (the card miniatures), `.tswarm`, `.t31sh`, `.rmysh`, `.poknil`, `.mjsh`, and the canvases of Bowling and Sky Hop.
- **Player tokens drawn three ways:**
  - The toon characters: Tic-Tac-Toe, the race tracks, the header and the newest games.
  - `ui/tok.js` `tok()`: the December batches.
  - Each game's own white ×/ring glyph: Four in a Row, Takeover, Coin Flip.

## 4. Fix list, by visual impact

Items marked **[shared]** are one change covering several games.

| # | Fix | Games |
|---|---|---|
| 1 | Redraw Little Wheel flat: an ink-outlined wheel in tokens, pockets in ink/cream and green 0, never `--x` red. Numbers at least 12px. Tallies moved to the top row. | rl |
| 2 | Flatten Bullseye's scene: a token-coloured wall and floor (no grain), an ink-outlined board, darts in flat fills with ink outlines; drop the metal shading and `rgba()` glows. | bullseye |
| 3 | **[shared]** Table and felt tokens (`--felt-green`, `--felt-blue`, `--wood`, `--cabinet`), each a flat fill or a single two-stop gradient, used by every table. | rps, war, rl, claw, bullseye, pig (and 21, Krabs, Poker, Thirty-One, Rummy outside this list) |
| 4 | **[shared]** One player token: Four in a Row, Takeover and Coin Flip draw their marks through `ui/tok.js` (or the toon at large sizes), not their own glyphs. | c4, takeover, coins |
| 5 | **[shared]** One tally: Five Letters' and Higher/Lower's dot strips, Little Wheel's stacked tallies and Risky Rolls' big cards onto `arcTally`; check the 390px truncation ("Comput…") in the shared tally. | wordle, hilo, rl, pig, plinko |
| 6 | **[shared]** A minimum readable size token (for example `--txt-min: 14px`) for status, caption and label text. | apple, bump, candy, snakes, bs, hangman, hilo, mastermind, rps, war |
| 7 | Five Letters' "in the word" colour off `--o` (a clue token such as tan or orange), so yellow keeps meaning player O. | wordle |
| 8 | Claw Machine: the cabinet onto tokens, no glass gloss, an ink-outlined claw and cable, prizes in token colours, Drop greyed (not removed) on the computer's turn. | claw |
| 9 | Peg Drop: board and slot colours onto tokens (`--sea-2`/`--paper`), bonus text onto a token. | plinko |
| 10 | **[shared]** Replace Nunito with Comic Neue (a `--font-text` token) everywhere. | miniatures and canvases of 21, Ride the Bus, Krabs, Thirty-One, Rummy, Poker, Mahjong, Star Swarm, Bowling, Sky Hop |
| 11 | Fill the play area: Takeover's grid and Codebreaker's rows sized from the room, not left in the top half. | takeover, mastermind |
| 12 | Small points: Codebreaker's feedback pegs larger, its code bar as an ink panel; Hangman's word on tiles; Snakes and Ladders' ladders under the numbers; Bump's pink onto a token; Coin Flip's grey coin onto paper or ink. | mastermind, hangman, snakes, bump, coins |
| 13 | **[shared]** One display face: Luckiest Guy inside games vs Bangers in the frame (low impact; decide, then use a `--font-display` token). | all |
| 14 | Check two frames that may be timing: Tic-Tac-Toe's strike line on the computer's win, and Codebreaker's code reveal on a win. | ttt, mastermind |

## 5. The other games in `src/games` (not audited here)

86 folders: 21, Backgammon Lite, Barrel Launch, Bin Shot, Bingo, Block Drop, Bowling, Brick Break, Castle Smash, Chopper,
Coin Pusher, Cup Pong, Darts Cricket, Dash, Dice Combo, Dice Race (retired), Districts, Dominoes, Door Drop, Echo,
Find the Pair, Flap, Flash, Flood, Fruit Reels, Fruit Slice, Gem Swap, Glass Bridge, Headcount, Heads or Tails, Hex,
Hexapawn (retired), Home Run Heroes, Hook-a-Duck, Key Drop, Krabs, Lane Rush, Letter Hive, Mahjong, Mancala Race,
Marble Toss, Maze Runner, Mini Golf, Muncher, Mystery Face, Number Shuffle, Odd One Out, Patterns, Peg Jump Race, Pig,
Pinball, Point Roll, Poker Hands, Pool, Puzzle Build, Rhythm Tap, Ride the Bus, Risky Spins, Road Race, Roads, Rummy
Lite, Scoop Stack, Scratch & Match, Seating, Shape Split, Shell Game, Shelves, Ship Captain & Crew, Shuffleboard, Shut
the Box, Sky Hop, Snake, Snapshot, Sniff, Split It, Standoff Grid, Star Swarm, Tank Duel, Target Practice, Thirty-One,
Trail Race, Treasure Hunt, Trivia, Twist Four, Wall Race, Word Tiles.
