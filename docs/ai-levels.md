# Computer levels by game (November 2026)

Hard v Normal (HvN) and Normal v Easy (NvE): share of decided squares won by the stronger level, 300 squares a pairing (Mini Golf and Pool 100), from `tests/sim/levels.js` at the defaults. Normal's main-board Sharpness is 0, so each game's own Normal plays at Normal.

| id | name | Easy / Normal / Hard now | HvN | NvE | note |
|---|---|---|---|---|---|
| ttt | Tic-Tac-Toe | 1 mark ahead, blocks 70% / 2 ahead (wins, blocks, no forks), 8% worst-cell mistakes / solved + traps | 100% (43-0, 257 drawn) | 72.1% (145-56, 99 drawn) | Hard never loses: every decided square is Hard's |
| c4 | Four in a Row | 3 ahead, blocks 90%, 6% mistakes / 5 ahead, ties random / deep search + book, 4% mistakes | 68.8% (196-89, 15 drawn) | 68.3% (198-92, 10 drawn) | |
| bs | Sea Battle | fires anywhere, next to a hit 90% / placement-weighted hunt / solved shared race | 46.0% | 75.3% | H≈N: shared sea, luck-bound |
| wordle | Five Letters | forgets half the colours, common-letter words / common-letter word fitting every clue / race solver | 60.3% | 65.3% | shared race: info helps both |
| hangman | Hangman | common English letters, random of 6 / likeliest letter among fitting words / race solver | 49.0% | 61.7% | H≈N: shared word, a letter a turn; Race mode NvE 86% |
| hex | Hex | reply weighed 90%, blocks 90%, picks of 2 / one reply ahead, ties random / deep search (2k nodes), 12% mistakes | 71.7% | 69.3% | |
| hilo | Higher/Lower | halves / anywhere in range / race odds | 56.7% | 58.7% | luck-bound (a guess hits 1 in r); Race mode similar |
| snakes | Snakes and Ladders | roll | 45.0% | 55.7% | pure luck, no choice |
| memory | Find the Pair | remembers 65% / 100% / 100% + waits 40% when it pays | 72.3% | 69.0% | |
| candy | Candy Race | draw | 51.7% | 56.7% | pure luck, no choice |
| bump | Bump | spin | 51.7% | 51.0% | pure luck, no choice |
| coins | Coin Flip | flip | 50.3% | 44.7% | pure luck, no choice |
| pig | Risky Rolls | banks at a fixed small pot (~6) / the rule (score-aware) / exact race | 57.7% | 70.0% | HvN luck-bound: the rule is near-optimal |
| hunt | Treasure Hunt | digs from 15% of the clues / most telling cell / race solver | 58.0% | 60.3% | shared race; Race mode NvE ~77% |
| mastermind | Codebreaker | uses 70% of the feedback / all of it, best split half the time / race solver | 59.3% | 67.0% | shared race |
| bj | 21 | stands on 15 whatever the dealer shows / basic strategy / exact odds | 43.3% (50.2% over 3,000) | 52.7% | luck: basic strategy ≈ exact |
| bus | Ride the Bus | 40% hunches / 10% hunches / likeliest guess | 48.7% | 56.7% | luck: the likeliest guess is the only real choice |
| rl | Little Wheel | green 0 on a whim 50% / 0 for a reason / race table | 45.3% | 70.7% | HvN luck: Normal's 0 rule ≈ the table |
| bullseye | Bullseye | 70% of Normal's rates / rates / 125% | 68.7% | 71.7% | |
| echo | Echo | 80% of Normal's pass rate / ai1-ai4 / 122% | 69.7% | 70.7% | |
| plinko | Peg Drop | 75% of drops into any slot / best expected slot / race look-ahead | 52.7% | 70.3% | HvN luck-bound (pegs) |
| pong | Cup Pong | 6x error, any cup / error, any cup / half error, best make odds | 51.7% | 71.0% | HvN: the table's scatter dominates (perfect aim ~53%) |
| trivia | Trivia | knows 28% / 53% / 80% | 72.3% | 70.0% | |
| oddone | Odd One Out | 75% of Normal's finds / ai1-ai3 / 125% | 68.7% | 66.0% | |
| dash | Dash | finishes in ~6 runs / 4.5 / 3.5 | 68.0% | 71.7% | |
| pool | Pool | aim 45 mrad, power 6% / 20, 2.5% / 5, 1% | 70.7% (100 squares) | 70.0% (100 squares) | 100 squares a pairing (~4 s a square); NvE measured with Hard at 10/1.5, Easy and Normal unchanged since |

| id | name | Easy / Normal / Hard now | HvN | NvE | note |
|---|---|---|---|---|---|
| golf | Mini Golf | same shot choice; aim/power error 120/16, 45/8, 4/1 | 71.0% | 72.0% | 100 squares a pairing. Normal's error raised from 20/4: Hard at 2 mrad v Normal at 20 was only 54% (the course and terrain decide most). |
| lane | Lane Rush | runs to finish ~5.5 / 4.5 / 3.5, spread 50/45/40% | 70.0% | 69.7% | |
| flap | Flap | same | 71.3% | 74.0% | |
| chopper | Chopper | same | 74.0% | 68.7% | |
| bowling | Bowling | Easy any of the better half of picks, 65 ms; Normal and Hard both the robust pick (best over 12 rolls with their own error), 45 / 32 ms | 70.3% | 73.7% | Normal now picks robustly too (before: the perfect-timing best, which made Hard 90%). |
| craps | Krabs | identical (one move: Roll) | 53.0% | 53.0% | pure luck, no choice; no mistake rate |
| takeover | Takeover | look-ahead 1 / 2 / solved 5x5; mistakes 8/8/22% (a grab from the better half) | 70.3% | 71.0% | Hard needs 22% slips to stay in band (the solver otherwise 86%). |
| flood | Flood | Easy biggest grab now (minds your answer 0%), Normal 60%, Hard solved; mistakes 20/6/2% | 72.3% | 69.0% | |
| seating | Seating | Easy any free seat (mistakes 100%), Normal the likeliest seat, Hard two plies | 46.3% | 65.2% (1 drawn) | Hard can't beat Normal: two plies and also 200 playouts a seat (tried, removed) both measured ~50%. Customers' luck decides. |
| districts | Districts | look-ahead 1 / 2 / expectimax; mistakes 25/5/10% | 66.5% (103 drawn) | 71.1% (103 drawn) | |
| shelves | Shelves | Easy never blocks (blockEasy off), Normal blocks, Hard solved; mistakes 15/10/0% (a spot on a shelf it holds) | 65.0% (143 drawn) | 71.7% (127 drawn) | many draws by nature |
| roads | Roads | Easy never cuts your road (blockEasy off), Normal does, Hard searches; mistakes 25/5/20% | 69.5% (77 drawn) | 70.4% (74 drawn) | |
| flap/chopper | see above | | | | |
| patterns | Patterns | right 40 / 60 / 80% | 70.3% | 69.3% | the right % is its mistake rate (no aiMiss) |
| wheels | Risky Spins | Easy cautious (banks 10 points earlier), Normal bank-at rule, Hard exact race; mistakes 30/10/0% (the other wheel, an early bank) | 59.0% | 63.3% | luck-heavy: the exact race is only ~60% over a sensible rule |
| apple | Apple Pick | identical (one move: Spin) | 53.3% | 47.0% | pure luck; no mistake rate |
| dominoes | Dominoes | Easy any fitting tile (mistakes 100%), Normal 4 deals of the hidden tiles played out, Hard 48 | 59.2% (1 drawn) | 59.2% (1 drawn) | 3-tile hands: a perfect-information search gains only ~60% over random; 150 deals no better |
| scratch | Scratch & Match | Easy misses the obvious third (mistakes 65%), Normal takes it (10%), Hard weighs every card | 65.3% | 70.3% | |
| bingo | Bingo | Easy another offered ball 40% (never lets go of a line now), Normal greedy, Hard exact/rollouts | 55.4% (29 drawn) | 68.4% (18 drawn) | Hard ≈ Normal: the ball choice barely matters |
| war | War | identical (one move: Flip) | 48.3% | 44.3% | pure luck; no mistake rate |
| shut | Shut the Box | Easy any tiles (100%), Normal rule of thumb, Hard exact table | 49.7% | 51.3% | luck: which tiles you flip barely changes the odds |
| combo | Dice Combo | Easy commonest face, first combo; Normal plain holds; Hard exact; mistakes 30/8/0% (careless hold, another open combo) | 61.0% | 64.7% | luck-heavy; more Normal mistakes lowered NvE more than they raised HvN |
| bglite | Backgammon Lite | Easy any legal turn (100%), Normal weighs race/hits/blots/blocks, Hard 60 playouts a turn | 60.3% | 72.7% | Hard ~57-60% over Normal at any playout count/Normal mistakes (dice) |
| scc | Ship, Captain & Crew | Easy keeps cargo ≥3 (cautious), Normal ≥8, Hard exact race | 49.7% | 64.7% | Hard can't beat a keep-at-8 rule (it is near optimal) |
| rps | Rock Paper Scissors | identical (random throw v a random house) | 51.7% | 44.0% | pure luck: no throw is better; no mistake rate |
| poker | Poker Hands | Easy/Normal plain keeps with careless throws 70% / 35%, Hard exact EV | 63.7% | 66.7% | the plain keeps are ~optimal, so Normal is made careless to separate them |
| t31 | Thirty-One | Easy careless take/throw 45% (never past a win on show), Normal plain, Hard EV over unseen cards | 66.3% | 67.3% | |

| id | name | Easy / Normal / Hard now | HvN | NvE | note |
|---|---|---|---|---|---|
| rummy | Rummy Lite | the same plans; careless takes/throws (own `worse`) Easy 70%, Normal 20%, Hard 0; Hard counts unseen outs | 67.7% | 65.0% | luck-heavy: needs big mistake gaps |
| claw | Claw Machine | timing error 180 / 100 / 25 ms; Easy any prize, Normal the widest's first moment, Hard weighs every prize and moment | 71.3% | 68.3% | |
| duck | Hook-a-Duck | identical (any duck) | 56.3% | 47.3% | pure luck: ducks look alike, no choice; no mistake setting, thinking time only |
| pusher | Coin Pusher | unchanged play (random / pressure / simulated columns; 300 / 110 / 50 ms); regrouped and relabelled | 74.3% | 69.0% | was already in band |
| wtiles | Word Tiles | each plays the best of the words it notices: Easy 2% and words of up to 5 letters, Normal 3%, Hard 6% (was: lower half / 3% / always the best) | 74.0%* | 67.3% | was 97% / 100% |
| snake | Snake | each level's own hand (misses a turn 3 / 2 / 0.5%, per food 0.5 / 0.5 / 0.5, loses track 24 / 18 / 12%); Hard never steers into a pocket; Hard tries 1 run (setting, was 2) | 70.7% | 70.7% | was 84 / 78 |
| swarm | Star Swarm | each level's own hand (reaction 330-450 / 260-360 / 170-260 ms, aim 80 / 60 / 40, misses a threat 28 / 20 / 11%); Hard reads a drifter's sway | 65.0% | 67.3% | was 91 / 49 (Easy = Normal) |
| bricks | Brick Break | own hands (reaction 220-360 / 180-300 / 150-250, aim 70 / 55 / 45, lapse 17 / 13 / 10); Hard tilts the paddle at the fullest column (switch) | 67.7% | 70.0% | was 97 / 97 |
| muncher | Muncher | own hands (decides every 300 / 200 / 40 ms, keeps 1 / 2 / 2 cells off a spook, forgets 25 / 10 / 0%); Hard predicts spooks and tries 6 runs (setting) | 70.0% | 68.3% | **fixed: squares that never ended** (below) |
| sniff | Sniff | Hard searches by every kept step; Normal goes by its last 2 steps, Easy by none; a step any way (own `worse`) Easy 20%; Hard breaks walk-round cycles | 59.0% | 71.0% | **fixed: square that never ended**; luck-heavy, HvN capped ~59-60 at a sane square length |
| headcount | Headcount | Normal right ai1..ai3 %; Easy 70% of Normal's rate; Hard right on 20% of Normal's misses too | 73.0% | 71.7% | was 45 / 47 (levels identical) |
| flash | Flash | the same, Easy 70%, Hard 40% | 71.0% | 72.0% | was 57 / 48 |
| snapshot | Snapshot | the same, Easy 70%, Hard 25% | 71.7% | 69.0% | was 49 / 49 |
| shell | Shell Game | the same over its 5 levels, Easy 70%, Hard 40% | 69.7% | 74.0% | was 48 / 53 |
| skyhop | Sky Hop | own hands (reaction 250-360 / 220-320 / 190-280, aim 75 / 65 / 55, hazard missed 18 / 15 / 12%, misjudges a mover 55 / 50 / 44%) | 74.7% | 70.3% | was 49 / 47 (one hand for all) |
| scoop | Scoop Stack | own hands (reaction 290-400 / 260-360 / 230-320, aim 52 / 46 / 40, lapse 23 / 20 / 17) | 69.3% | 69.3% | was 49 / 44; very sensitive: ±10% of the hand moves it 20 points |
| pinball | Pinball | own hands (reaction 110-150 / 50-90 / 20-40 ms, flip error 110 / 50 / 10, lets a ball by 20 / 0 / 0%, launches anyhow 100 / 25 / 0%); Hard aims flips at unlit targets | 67.0% | 71.3% | was 60 / 71 |
| piggy | Pig | risk appetite: Easy banks at 6 and never chases a lead, Normal at 9 and goes for it all when the other side is close, Hard the solved race | 68.3% | 77.3% | NvE is 73.6% over 1,000 squares; the bank point is an integer (5 → 87%, 7 → 59%), 6 is the closest |
| bridge | Glass Bridge | forgets which glass held (own `worse`) Easy 45%, Normal 10%, Hard never | 55.7% | 65.7% | pure luck otherwise: an untried pane is a guess for all; HvN can't pass ~57% (1,000 squares: 56.8 / 62.8) |
| reels | Fruit Reels | identical (spin) | 51.7% | 48.7% | pure luck, no choice: no mistake setting |
| homer | Home Run Heroes | timing error 130 / 100 / 75 ms; Easy lets 10% of pitches go | 70.0% | 71.0% | was 80 / 84 |
| maze | Maze Runner | unchanged play; Easy's stray (30%) is a setting | 67.7% | 65.3% | in band already |
| split | Shape Split | cut error 9 / 6 / 4 points of a percent | 72.0% | 72.7% | was 84 / 78 |
| faces | Mystery Face | a guess its clues rule out (own `worse`) Easy 70%, Normal 30%; Hard the guess that splits best | 63.0% | 70.7% | squares are ~1.6 turns: HvN capped near 63 |
| mahjong | Mahjong | careless throw (own `worse`) Easy 42%, Normal 25%, Hard 0; Hard counts unseen copies; Easy takes the pile only to win | 68.3% | 68.3%* | was 50 / 73 (Hard = Normal) |
| pegs | Peg Jump Race | Easy greedy without minding jumps it hands over + 30% slips; Normal greedy and wary; Hard searches 2 whole turns (setting) with 15% slips | 71.3% | 69.7% | was 85 / 92; Hard needs slips (depth 1: 62%, 2 clean: 85%) |

| id | name | Easy / Normal / Hard now | H v N | N v E | before H v N / N v E | note |
|---|---|---|---|---|---|---|
| twist | Twist Four | best by score, no block, 50% slips / best by score + blocks your line, 20% slips / best by score + blocks, no slips | 66.7% | 71.7% | 82.0 / 88.3 | the old look at your reply was weaker than best-by-score + block (0-60); see 4 |
| mancala | Mancala Race | banks most now, no guard, 12% slips / banks most now, guards against your best reply / searches one turn deep | 73.7% | 69.3% | 81.7 / 99.0 | |
| walls | Wall Race | shortest way, walls when behind, 30% slips / same, 15% slips / 2-ply search of steps and walls, 12% slips | 72.7% | 73.3% | 100 / 100 | measured at 300 (Hard now 2-ply: 33 ms a square) |
| target | Target Practice | aim error 9 / 7 / 5.5 | 67.3% | 68.0% | 82.0 / 80.0 | |
| heads | Heads or Tails | identical (random call) | 53.7% | 53.7% | 53.7 / 53.7 | pure luck: a fair coin, no call better |
| proll | Point Roll | 50% long shots, else any number / most this turn / fewest turns (exact) | 51.7% | 62.3% | 51.7 / 64.3 | luck-limited: every number is worth ~2 a turn by design; Normal long shots (30%) only lowered N v E to 52%, so Normal/Hard left as they were |
| marble | Marble Toss | aim 10 / 8.5 / 7; all aim at the best hole; mistakes another hole | 68.3% | 69.3% | 84.3 / 85.3 | |
| shuffle | Shuffleboard | distance error 22 / 16 / 10.5% | 68.7% | 68.7% | 73.3 / 78.3 | |
| toss | Bin Shot | aim 10 / 8 / 6; allows 80 / 100 / 100% of the fan | 68.7% | 69.0% | 79.3 / 80.7 | |
| cricket | Darts Cricket | middle of any open number, aim 6 / best spot, aim 7 / best spot, aim 5.5 | 71.3% | 71.7% | 84.3 / 89.0 | Easy's hand is steadier than Normal's; its choice is what is weaker |
| slice | Fruit Slice | sliced 55/65/72%, bombs 24/20/15% | 71.3% | 69.7% | 90.3 / 94.0 | |
| rhythm | Rhythm Tap | timing 86/75/70 ms, notes let go 22/20/18% | 65.3% | 69.0% | 97.7 / 96.7 | keys renamed aiLetGo* |
| rally | Road Race | lapses 125 / 85 / 60 in 100 s | 70.0% | 69.3% | 83.3 / 63.7 | |
| blocks | Block Drop | random among best 20% / best give or take 6 / two pieces ahead | 69.6% (11 drawn) | 72.9% (9 drawn) | 55.7 / 96.3 | |
| numbers | Number Shuffle | anywhere in what's left, 40% an order it could rule out / anywhere in what's left / halving | 71.0% | 71.0% | 73.7 / 59.7 | |
| trail | Trail Race | best position give or take 0.25, 40% random / same, no slips / also your best answer | 72.0% | 67.0% | 72.0 / 65.0 | |
| keydrop | Key Drop | timing 95 / 70 / 50 ms | 68.0% | 71.3% | 63.7 / 71.3 | |
| pint | Split It | timing 170 / 120 / 90 ms (unchanged) | 65.3% | 66.0% | 65.3 / 66.0 | already in band |
| gems | Gem Swap | 65% random swaps / 35% random / weighs what it leaves you | 66.2% (7 drawn) | 68.6% (7 drawn) | 53.7 / 73.0 | |
| castle | Castle Smash | aim/power 80/8, 40/4, 20/2 + Hard best of 4 (unchanged) | 67.7% | 67.0% | 67.7 / 67.0 | already in band; 250 ms a square |
| tanks | Tank Duel | angle/power 5/7, 3.5/5, 3.5/5 + Hard's searched solution, 85% error after a seen shot | 70.7% | 68.0% | 82.7 / 68.0 | |
| jigsaw | Puzzle Build | right placements 55/75/92% (unchanged) | 73.7% | 72.3% | 73.7 / 72.3 | already in band |
| hive | Letter Hive | 1-3 words / 1-4 words / 2-5 shorter words, no full-hive hunt | 69.3% | 70.7% | 88.7 / 80.7 | |
| barrel | Barrel Launch | timing 70 / 60 / 50 ms | 68.7% | 68.3% | 68.7 / 87.0 | |
| doors | Door Drop | forgets 70 / 35 / 0% of what it saw | 64.3% | 68.7% | 54.3 / 62.7 | mostly luck; memory is the only lever |
