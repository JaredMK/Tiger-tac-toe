# The computer opponents

How the computer plays Tic Tac Chaos: what it knows, how it chooses a square, how it plays inside one, how the three
levels differ, and how all of it was measured. The code is `src/core/ai.js` (the decision), `src/core/mc2.js` (the
match search), `src/core/aiw.js` (the levels and settings) and each game's `src/games/<game>/ai.js` (its tactics).

## Fair play

Every decision starts from `publicMini(mini, me)`: what a person looking at the screen could know. The hidden word,
number, ship, treasure, face-down cards and future dice never reach the computer's code. The same holds on the
server, where the bots run the same engine. (Trivia and Patterns are the one designed exception: the computer could
always know the answer, so it answers to a set rate instead.)

## One decision

1. **Each open square's best local move.** The game's `best(pm, me, rng, style, ctx)` returns its move and what it
   expects of it (`q`: the chance it claims the square now; `after`: the position it leaves; `qLose`, `stay`,
   `shared`). `needs(pm, p)` is the turns p still expects to need there.
2. **Each square's worth on the main board** (`squareValue`): a line it completes wins the match (`AI.win`), a line
   of the other side's it stops comes next (`AI.block`), then the lines still open through it for either side, a
   line with one of its own squares on it counting three times an empty one (so forks count twice over).
3. **The plain score** = worth × what the move gains in the race for the square (`moveGain`, from both sides'
   `needs`), discounted for a square the other side leads beyond catching (`catchUp`: a lost cause, unless it would
   give the other side the match and can still be stopped).
4. **The match search** (levels that search; below) replaces the plain score's choice of square.
5. A move that wins the match at once is always taken, before anything else.

What the tactics said of a square is kept until the square changes (`LOCAL` in `ai.js`: the same public position,
side and standing on the board), so on a phone the 300 ms go to the one or two squares that changed and to the
search, not to working the other seven out again.

## The match search (`mc2.js`)

A Monte Carlo search over the rest of the match, in a web worker on the page (`ui/think.js`, `ui/ai.worker.js`) and
inside the same budget on the server.

- **The model.** Every open square is a race in turns still needed, each side's from the game's `needs`. A playout
  plays the match out turn by turn: each side picks its square the way the plain computer would (worth × gain, now
  and then any square by its worth: `explore`), its turn there makes a turn's progress with chance `prog`, a square
  is claimed once its side needs nothing more, a dead square resets (`fresh`), until the board decides the match.
- **The candidate's own move** is played as the game's tactics judge it: claimed with chance `q`, lost with
  `qLose`, else the position `after`.
- **Sharing the playouts.** Every candidate square plays round after round; one that is clearly behind the leader
  (its paired difference more than `drop` standard errors under zero) is let go and its rounds go to the squares
  still in doubt. Measured against a 6,000-round oracle, this decides as well as an even share in about half the
  time, and four times the playouts cut the worth lost per decision to about a third.
- **The choice.** The candidate that wins the match most often; among those the playouts cannot tell apart, the one
  the plain score rates highest.
- **Tempo** (`safeLead`, `closeTo` in `ai.js`): a square it leads by more than `margin` turns can wait while it
  plays elsewhere (banking the lead), and it comes back once the lead is down to the margin, or sooner when the
  other side could catch up in one lucky move, threatens the match elsewhere, or the square blocks or completes a
  line; a square it is about to win that matters on the board is finished first, but never ahead of a block of the
  other side's match.

### What was tried and dropped

A second model was built and measured: each game's squares played alone by the Hard computer against itself
(`scripts/ai-calibrate.js`), a race model fitted per game (how much luck decides its squares, the first mover's
share, the draws), and playouts that drew every square's real length from it. It lost to the model above
(45.0% [40.2, 49.9] over 400 matches, main board alone), with or without the tempo rules and at every spread tried,
so it is not in the engine. The calibration tool stays as a measuring tool: it shows, per game, how well `needs`
predicts who takes a square.

## Inside the squares

Hard plays each game's strongest form; the plain levels play its simpler one. What is proven exact and what is a
heuristic:

Square duels are single squares, the new Hard against the old Hard, fixed work (interval 95%); 50% means no
change is possible or none was found.

| Game | Hard's play | Status | Square duel vs old Hard |
|---|---|---|---|
| Risky Rolls | The exact race table (bank or roll, by both scores and the pot), built from the turn's first call | Exact (checked by value iteration to 4e-8) | 50% (already exact) |
| Risky Spins | The exact race table for the square's own two wheels (which wheel, when to bank) | Exact (8e-8) | 50% (already exact) |
| 21 | Hit or stand by the exact odds of the hand against the dealer's card, a tie weighed as a fresh hand | Optimal to 2e-6 of a hand | 50% |
| Little Wheel | A group or 8 numbers; green 0 by value iteration over both scores | Exact | 50% |
| Ride the Bus | The likeliest guess from the cards seen | Optimal for expected turns (checked over all 56,186 hands) | 50% |
| Peg Drop | Three drops ahead on the real peg, then a random-peg race table | Heuristic, 0.01% of a square per drop from the exact table (`tests/sim/plinko-table.js`) | 51.0% [48.9, 53.2] |
| Scratch & Match | A solved table: the panel with the fewest expected scratches over every card still possible (`scratch/table.js`) | Exact for the default layout | 51.8% [49.6, 54.0] |
| Bingo | The exact race for 3x3 cards once the square's table is built, rollouts until then | Exact where built | 51.0% [47.9, 54.1] |
| Apple Pick, Krabs, Coin Flip, War, Snakes and Ladders, Candy Race, Bump | One legal move | No decision | 50% |
| Higher/Lower | The full race table over the range, both sides' guesses left and the fifth-miss rule | Exact | 50% (already exact) |
| Sea Battle | The solved race on the 4x4 sea (ships of 2 to 4); equal shots drawn at random on the search's checkerboard | Exact on 4x4 | 51.0% [48.8, 53.2] |
| Treasure Hunt | 6x6 positions solved to the end; opens one in from a corner | Exact on 6x6 after the opening | 48.9% [46.8, 51.1] / 53.4% [51.2, 55.6] (two seeds) |
| Codebreaker | Every code and a wait weighed at every position; sets of 12 or fewer solved | Near-optimal | 51.1% [48.9, 53.3] |
| Five Letters | Depth-limited race search over the word list | Heuristic, unchanged | 50% |
| Hangman | A solved first letter per length; word sets of 10 or fewer solved; a fitted value beyond | Heuristic above 10 words | 53.9% [51.8, 56.1] (level against a long clock) |
| Find the Pair | The exact odds of every way to turn cards, and of waiting (re-turning two seen cards) when showing a new card would help the other side more | Exact table, heuristic threshold | 75.0% [73.0, 76.8] |
| Sniff | All 8 steps weighed; a sideways or backward step when stepping nearer would set the other side up | Heuristic | 60.6% [58.4, 62.7] |
| Trivia, Patterns | Answers to a set rate by design | No race decision | 50% |
| Tic-Tac-Toe | The solved game; among equal moves the one an opponent is likeliest to go wrong against | Exact in turn | 50% (all draws) |
| Four in a Row | A threat-aware search (win in 1, loss in 2, forced replies, parity) with a 323-position book | Heuristic | 75.2% [71.6, 78.5] from random openings; about level on a long clock |
| Hex | 5x5 with the swap solved: a 190-position book into an exact search | Exact where winning | 57.4% [53.0, 61.7] from random openings |
| Takeover | 5x5 solved (a 51-position book, then exact) | Exact in turn | 55.6% [52.5, 58.7] from random openings |
| Flood | Every position solved over colour regions, including the pass where grabbing first loses | Exact in turn | 61.0% [57.9, 64.0] |
| Seating | Best play is a draw; the last 8 seats solved, 2 to 3 moves searched above | Exact at 8 seats or fewer | 103 squares won, 2 lost in 10,000 (the rest level) |
| Roads | Every edge two moves deep, the best three a third; the last 6 edges solved | Heuristic above 6 edges | 56.1% [53.0, 59.1] |
| Dominoes | A determinised search over the unseen tiles, the other hand constrained by what its draws and passes imply; never reads the other hand | Heuristic | 53.8% [52.2, 55.3] |
| Districts | Exact from 10 empty spots; the first mover takes about 95% of decided squares | Exact late | 50.8% [47.7, 53.9] |
| Shelves | Solved exactly, the solution kept for the process | Exact | 50% (already exact) |
| Echo, Headcount, Flash, Snapshot | Plays to a set rate by design | No decision to improve | 50% |

Two behaviours are new and visible, both legal moves that make no progress on purpose: in **Find the Pair** Hard
re-turns two cards it has already seen rather than show a new one that would more likely hand the other side a
pair, and in **Sniff** it may step sideways or away rather than nearer. They are where the largest gains come
from, they make those squares longer, and they have dials (`memory/ai.js` `MH.margin`/`MH.wait`, `sniff/ai.js`
`SH.margin`/`SH.wait`; Flood's pass: `FLOOD_PASS`). In a match the computer plays another square instead whenever
one is worth playing.

## The three levels

One engine; a level is four settings (`aiw.js` `levelCfg`, the admin's Bot Settings, `config/ai`):

| Setting | What it does |
|---|---|
| Search | Playouts of the match for each open square when it chooses where to play. 0: the plain score decides. |
| Sharpness | How often a square is played with its strongest tactics rather than the plain ones. |
| Mistakes | How often it makes a careless move: any legal move, anywhere open. |
| Risk appetite | Points added to what it banks at in the push-your-luck games. |

LEVELS_TABLE

Move timing is the page's, not the engine's: the computer "thinks" 0.7 s, its square glows 0.6 s, then its move
plays as a replay at a person's pace (`ui/app.js` `CPU_BASE`; faster only in the player's own Speed setting), at
every level. The search runs inside that pause.

The search's own settings (shared by every level that searches): `attack`, `defend` (the lines' weights), `explore`,
`prog`, `fresh` (the playout model), `drop` (when the search lets a square go), `margin` (tempo play) and `budget`
(the ms a decision may take where there is a clock). `npm run tune-ai` tunes the first five by self-play; it never
touches the levels' settings.

## How it was measured

- **The reference.** The engine at the commit in `docs/ai-ref.txt` ("the old Hard"), exported by
  `node scripts/ai-versus.js ref` into `.ai-ref/`. Both sides decide on the same match; the rules are the
  checkout's.
- **The games.** The 39 luck and brain games (no skill games, none that is Super Chaos only).
- **Square duels**: `node scripts/ai-versus.js duel <types|all> <n>`: one square of a game, sides and the first move
  swapped: the local play alone.
- **Matches**: `node scripts/ai-versus.js match <n> <A> <B>` with A and B from `new:hard`, `new:normal`,
  `new:easy`, `ref:hard`, `ref:normal`, `ref:easy`, `random` (any legal move anywhere), `simple` (the square worth
  most on the board, any legal move there). Shares count a drawn match as half; intervals are 95% (Wilson).
- `--budget=300` plays with a clock, as on a phone; without it every search does a fixed amount of work.

RESULTS
