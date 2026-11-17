# Balance review: the 19 released games (November 2026)

**Source of every number below: simulation** (`node scripts/balance-sim.js --squares 1000 --matches 300`, computer
against computer at Normal, the code's default settings, 1,000 squares a game, 300 whole matches; 837 s). **None of it
comes from staging play**: this session cannot read staging's database (no key), and staging's older stats hold sums
only (no percentiles, no times). Once you have played on the new build, open admin → Balance report → Export JSON and
send it; real play (small and skewed towards the admin's own) will then sit beside these figures.

Caveats of the simulation:
- **Time is an estimate**, not a measurement: each action's animation and result hold, plus 2.5 s of thinking for a
  turn's first action and 1 s for each further action in the same turn; whole matches add 1.5 s a turn on the board.
- The Normal computer is strong on shared-information games: Five Letters, Codebreaker and Higher/Lower finish faster
  here (median 2–3 moves) than people will. Tic-tac-toe and Four in a Row are near-perfect play, so they draw or run
  long; people blunder and finish sooner.
- Bullseye and Claw Machine: the computer's timing error stands in for a person's tap.

## Baseline per game

Winner's moves are a side's turns in the square (bonus moves within a turn count once).

| Game | Winner's moves p25 / median / p75 | First mover wins | Resets | Est. time in square, s p25 / median / p75 |
|---|---|---|---|---|
| Bullseye | 4 / 5 / 5 | **60.9%** | 0% | 36 / 45 / 51 |
| Bump | 5 / 5 / 6 | 52.4% | 0% | 40 / 46 / 54 |
| Candy Race | 4 / 5 / 5 | **61.7%** | 0% | 34 / 43 / 47 |
| Coin Flip | 2 / 3 / 6 | 56.4% | 0% | 14 / 27 / 48 |
| Five Letters | 2 / 2 / 3 | 51.0% | 0% | 14 / 18 / 22 |
| Tic-tac-toe | — | — | **100%** | — |
| Four in a Row | **19 / 19 / 20** | **75.3%** | 9% | **138 / 138 / 145** |
| Sea Battle | 3 / 3 / 4 | 48.8% | 0% | 21 / 24 / 32 |
| Hangman | 3 / 4 / 4 | 53.3% | 0% | 23 / 27 / 31 |
| Higher/Lower | 2 / 3 / 4 | 50.5% | 0% | 16 / 24 / 28 |
| Risky Rolls | 4 / 5 / 6 | 57.7% | 0% | **94 / 105 / 120** |
| Risky Spins | 4 / 5 / **7** | 54.6% | 0% | **72 / 98 / 132** |
| Little Wheel | 3 / 4 / 6 | 54.1% | 0% | 34 / 47 / 73 |
| Peg Drop | 3 / 4 / 5 | **61.7%** | 0% | 31 / 37 / 47 |
| Snakes and Ladders | 3 / 5 / 6 | 55.9% | 0% | 31 / 44 / 54 |
| Rock Paper Scissors | 4 / 4 / 5 | 57.0% | 0% | 39 / 50 / 63 |
| War | 3 / 4 / 5 | 54.4% | 0% | 30 / 39 / 49 |
| Claw Machine | 3 / 4 / 5 | 56.8% | 0% | 48 / 58 / 72 |
| Codebreaker | 2 / 2 / 3 | 46.5% | 0% | 19 / 19 / 24 |

## Games taking too long, and the changes tried

Each change simulated over 1,000 squares; moves are the winner's p25 / median / p75. Nothing has been changed: apply
the ones you agree with on each game's admin page (a new settings version, so the Balance report will compare them).

- **Four in a Row** (19 / 19 / 20, first mover 75%). There is no board-size setting; `k 3` (three in a row) is 5 / 5 / 5
  but the first mover wins 100%: don't. The `miss` setting only makes the computer err (a stand-in for human play):
  `miss 15` 10 / 14 / 18, 59%; `miss 30` 8 / 11 / 15, 57%. Expect people to finish well under the simulated 19, but
  it stays the longest game. Watch it in real data before changing anything; a smaller board would need code.
- **Risky Spins** (4 / 5 / 7, about 98 s, long p75): **`target 25`** → 3 / 4 / 6, 78 s, first mover 53%. Recommended.
  (`target 20`: 2 / 3 / 5, 59 s: too short.)
- **Risky Rolls** (4 / 5 / 6, about 105 s): `target 40` → 3 / 4 / 5, 80 s, first mover 60.5% (just over the 60% line);
  `target 35` → 3 / 3 / 4, 61.8%: too short and unfair; `sides 6, target 35` → 4 / 5 / 6, 97 s, 58%. Best trade:
  `target 40` if 60.5% is acceptable, else leave it (its moves are on target; only its time is long).
- **Tic-tac-toe** (every computer-vs-computer square resets): a property of perfect play, not a setting. Only `miss`
  (the computer's own) moves it: `miss 25` → 41% resets, 3 / 4 / 4, first mover 60%. Leave it unless real data shows
  long chains of resets.

First-mover rates over 60% (not slow, but over the target):
- **Peg Drop** (61.7%): **`bonus 1`** → 4 / 4 / 5, 57.5%. Recommended. (`target 14`: 59.9%; `target 10`: 67%, worse.)
- **Candy Race** (61.7%): **`gap 2`** → 3 / 4 / 5, 57.3%, 34 s. Recommended. (`gap 4`: 62%.)
- **Bullseye** (60.9%): `goal 8` → 4 / 5 / 6, 59.8%, 50 s; `goal 6`: still 60.9%. A marginal gain; optional.

Quick (under the 4–6 target, by the simulation): Five Letters, Codebreaker and Higher/Lower (median 2–3), Coin Flip
(3). The computer is the likely cause for the first three; check real play before lengthening them.

## Match length and the match clock

Whole matches (300, computer against computer at Normal, the 19 games): turns for both sides 38 / **46** / 57
(p25 / median / p75); each player's own turns 19 / **23** / 29; estimated minutes for the whole match 4.3 / **5.8** / 7.1;
squares ended 5 / 6 / 7; 5.7% drawn; the side moving first won 45%.

A player's own share of a match is about half of it: about 3 minutes at the median and 3.6 at the 75th percentile, and
+5 s a move adds about 2 minutes more (23–29 moves). So:
- **5 min + 5 s** (the default) covers the 75th percentile with room to spare (about 7.4 minutes available per player).
  Keep it as the default.
- **3 min + 5 s** (about 5 minutes available) suits quick players and will run out for slow ones: keep it as the quick
  option.
- **10 min + 5 s** is rarely needed by this estimate; keep it for relaxed play (a slow thinker, a long Four in a Row)
  until real data says otherwise.
- **No limit** stays for friends.

People think longer than 2.5 s a turn and replays add time, so treat these as lower bounds: the Balance report's
match length by timer (finished against abandoned, clock run-outs) is the figure to decide on once there is real play.
