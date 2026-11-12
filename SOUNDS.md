# Sounds in Tic Tac Chaos

Every sound in the game is **synthesised in the page** with the Web Audio API (oscillators and filtered
noise, all written in `src/audio/sound.js`). No audio files are used, so:

- **Source:** the project itself. Nothing is downloaded, copied or licensed from anyone else.
- **Licence:** none needed. The sounds are original work in this repository.
- **File size:** zero bytes of audio. Each sound is rendered once when the page loads and played from
  memory, so a play starts at once.

Each sound below lists **when it plays** and **how it is made**. Oscillator types are sine, triangle,
square or sawtooth; "noise" is seeded filtered noise, so every play is the same. Sounds marked
*varied* change pitch slightly each time (±6%) so the ones that repeat do not feel mechanical.

Sounds start from the events they belong to, never from drawing the screen: a re-render plays nothing.

## Controls and interface

| Sound | When it plays | How it is made |
|---|---|---|
| `tap` | Any button press, including tapping a square to open it and the Board button (not a move or card, and never a game's own input: pads, keys, cells, Start buttons and presses a game takes itself play only their own sounds) | Triangle glide 640→430 Hz with a short noise tick. *Varied.* |
| `key` | Five Letters or Hangman key, Enter, Backspace | Triangle blip 1400→1100 Hz. *Varied.* |
| `toggle` | A switch, box or the sound switch | Two rising blips, 660 then 880 Hz |
| `pop` | An emoji reaction is sent, or the other player's arrives. *Varied.* | Sine glide 620→980 Hz with a faint overtone at 1240 Hz |
| `select` | Select all (Advanced checklist) | Rising three-note arpeggio, triangle |
| `deselect` | Deselect all | Falling three-note arpeggio, triangle |
| `back` | A Back button outside a game | Falling tone 620→330 Hz with low noise |
| `open` | The in-game menu or an explainer opens | Rising tone 330→660 Hz |
| `close` | The in-game menu or an explainer closes | Falling tone 660→330 Hz |
| `error` | A refused move, a press on a disabled control, "Not a word", no connection, a refused zoom | Two detuned square waves falling |
| `copy` | Share or copy the room link | Camera-like noise click, then two bright blips |
| `join` | A player joins the lobby | Two rising notes |
| `found` | A Find Match game is found | Rising four-note arpeggio |

## The board

| Sound | When it plays | How it is made |
|---|---|---|
| `spot` | The opponent's or computer's square lights up before its move (Super Chaos: in the round's recap) | Two soft sines that swell in |
| `yourTurn` | The turn comes to this player (online, and against the computer once its move has played), with a double-pulse haptic | Synthesised (CC0, made in code): a soft rising fifth, sine 659 then 988 Hz with quiet octaves, about 0.3 s |
| `turn` | The turn passes to the other player (to this player: `yourTurn` instead) (Super Chaos: a new round begins) | Boing: sine glide 260→620 Hz, then a small blip |
| `stamp` | A square is claimed (the owner's mark stamps in; Super Chaos: in the round's recap) | Low thump: sine 130→55 Hz with lowpass noise |
| `burst` | A comic burst pops round a square just claimed on the board. *Varied.* | Noise plus glide 900→1800 Hz |
| `reset` | A square resets after a draw (Super Chaos: also a square both players won in the same round) | Falling tone 520→240 Hz with low noise |
| `swish` | A line of three is drawn (tic-tac-toe, and the board's winning line) | Noise sweep up 600→3200 Hz with a blip |
| `won` | A square is won in its mini-game | Three-note chime |
| `winFanfare` | The match is won | Four-note fanfare, then a held chord |
| `loss` | The match is lost | Two falling notes |
| `tie` | The match is a draw, or the board is blocked | Soft three-note chord |

## The clock

| Sound | When it plays | How it is made |
|---|---|---|
| `tickSoft` | Each second in the last ten (the clock). *Varied.* | 1000 Hz sine, very short |
| `tickLoud` | Each second in the last three. *Varied.* | 1400 Hz sine, louder |
| `buzz` | The turn runs out | Sawtooth 220→170 Hz with noise |
| `randomMove` | The random move is made for a player who ran out of time | Three short blips |

## The mini-games

| Mini-game | Sound | When it plays | How it is made |
|---|---|---|---|
| Tic-tac-toe | `mark` | A mark is drawn: one stroke for the O's ring, two for the X (one as each stroke starts). *Varied.* A win: the `swish` as the line is drawn through the three, then the square's `won` chime as the marks hop | Bandpass noise scribble with a low triangle |
| Four in a Row | `c4drop` | The piece lands, at the moment its fall ends (the further the fall, the later; nothing as it falls): with the result's buzz | A soft wooden thunk: triangle 300→200 Hz with a quiet 620 Hz tap and low-passed noise, 0.16 s. *Varied.* |
| Sea Battle | `fire` | A shot is fired: the shell's whistle as it is lobbed in | Triangle glide 900→300 Hz with noise |
| Sea Battle | `splash` | A miss, as the shell lands (`bs/rules.js` `BST.land`) | Lowpass noise sweep with two bubbles |
| Sea Battle | `boom` | A hit, as the shell lands | Lowpass noise with a low glide 160→50 Hz |
| Sea Battle | `sink` | A ship sinks: under the ship surfacing and going down | Long low rumble |
| Five Letters | `tileG` | A tile turns green | Two tones, 660 and 990 Hz |
| Five Letters | `tileY` | A tile turns yellow | Triangle 520 Hz |
| Five Letters | `tileX` | A tile turns grey | Short falling triangle 330→280 Hz |
| Five Letters | `solve` | The word is solved, as the row starts to hop (Hangman too, as the word hops) | Three-note chime |
| Hangman | `ding` | A right letter, once for each blank it drops into as it lands (up to four, each a step higher: played at 1, 1.12, 1.26, 1.34 times its pitch) (and Higher/Lower's right answer) | Bell: 1046 Hz with a 1568 Hz partial |
| Hangman | `mark` / `thud` | A wrong letter: the pencil as the scarecrow's next part is drawn (tic-tac-toe's mark), then the letter thumping onto the wrong row | Low thump with lowpass noise |
| Hex | `hexPlace` | The stone lands on its cell (Takeover's piece too). *Varied.* | Wooden click: triangle 500 Hz with bandpass noise |
| Hex | `pathNote` | The winning line reaches each stone of the chain, one note a semitone higher each | Triangle 523 Hz, played faster or slower for each cell |
| Higher/Lower | `hiloBlip` | A guess is made. *Varied.* | 880 Hz blip |
| Higher/Lower | `higher` | The answer is higher, as the guess lands on the number line (the result's buzz) | Rising glide 500→900 Hz |
| Higher/Lower | `lower` | The answer is lower, as the guess lands on the number line (the result's buzz) | Falling glide 900→500 Hz |
| Snakes and Ladders, Dice Race | `rattle` | The die is rolled (also Risky Rolls) | Nine short noise ticks |
| Snakes and Ladders, Dice Race | `thunk` | The die lands (also Risky Rolls) | Low triangle with noise |
| Risky Rolls, Krabs | `diceTap` | A thrown die's first touch of the table, before it lands (the shared 3-D die: `ui/dice.js`). *Varied.* | A short bright noise click with a falling triangle blip |
| Snakes and Ladders, Dice Race, Candy Race, Bump | `hop` | The piece springs off for each space, a little higher in pitch each hop (a long move's hops come quicker and quicker); in Bump also, played low, the knocked piece coming down at Home. *Varied.* | Short glide 520→760 Hz |
| Snakes and Ladders, Dice Race, Candy Race, Bump | `c4drop` | The piece set down on its last space, after any ladder or snake (Four in a Row's wooden thunk: the move's result, so its buzz); a square won: the `won` chime as the piece jumps on it | As Four in a Row |
| Snakes and Ladders | `climb` | Up a ladder | Five rising notes |
| Snakes and Ladders | `slide` | Down a snake | Falling glide 1000→260 Hz with noise |
| Find the Pair | `flipUp` | A card is turned up | Noise sweep up 1200→2400 Hz with a tick |
| Find the Pair | `flipDown` | The cards turn back over | Noise sweep down |
| Find the Pair | `pair` | A pair is found | Three-note chime |
| Find the Pair | `nopair` | No match | Two falling notes |
| Candy Race | `wheelTick` | The wheel ticks, slowing as it stops. *Varied.* | 2200 Hz sine, very short |
| Bump | `spin` | The spinner spins, ticking to a stop (Candy Race's `wheelTick`) | Noise sweep down |
| Bump | `boing` | A piece is knocked back home | Spring glide 200→700 Hz with a wobble |
| Coin Flip | `coinFlick` | The thumb's flick as the coins are tossed (new). *Varied.* | A short click of bandpass noise at 4200 Hz under a ring of two high sines (3100 and 4650 Hz) |
| Coin Flip | `coinSpin` | The coins spin in the air | Glide 1200→2000 Hz with a shimmer |
| Coin Flip | `clink` | Each coin as it lands (0.78 s after it left, one 80 ms after the other). *Varied.* | Two high sines |
| Risky Rolls | `point` | A roll's points reach the pot. *Varied.* | Short glide 700→1000 Hz |
| Risky Rolls | `bank` | The pot reaches the banker's score | Four quick bright blips |
| Risky Rolls | `bust` | A repeated number: the pot breaks, the points are lost | Crash: lowpass noise with a falling sawtooth |
| Treasure Hunt | `dig` | A square is dug | Shovel: lowpass noise sweep with a thud |
| Treasure Hunt | `band` | The band is revealed as its colour blooms from the hole (`hunt/rules.js` `HUNTT.bloom`; the result's buzz): higher for Hot, lower for Cold | Triangle 880 Hz, played faster or slower for each band |
| Treasure Hunt | `thunk` / `sparkle` | The treasure is found: the shovel strikes the chest (the die's thunk), then the gem comes up out of it | As above; rising sparkles |
| Hexapawn | `pieceSlide` | A pawn moves | Lowpass noise sweep |
| Hexapawn | `knock` | A pawn is captured | Two knocks |
| Codebreaker | `peg` | A peg is placed; a guess sent, each of its four pegs as it lands in its row. *Varied.* | Triangle click |
| Codebreaker | `marker` | A feedback marker appears. *Varied.* | Short tick |
| Codebreaker | `reveal` | The code is cracked | Rising tone with two chimes |
| Blackjack, Ride the Bus | `cardSlide` | A card is dealt or drawn (the dealer's too). *Varied.* | Bandpass noise sweep down 2600→1100 Hz |
| Blackjack, Ride the Bus | `cardFlip` | A card turns face up (the dealer's hole card too). *Varied.* | Short bright noise snap with a faint triangle tick |
| Blackjack | `chips` | A hand is won, as its result shows, with `point` over it (the result's buzz); a natural 21 with `sparkle` instead | Three bright clinks with noise |
| Blackjack | `push` | A push (then the new hand's cards slide in, in the same turn) | Two level triangle notes, 523 Hz |
| Blackjack | `bust` | The player goes over 21 (the Risky Rolls crash) | Crash: lowpass noise with a falling sawtooth |
| Blackjack | `nopair` | The dealer wins the hand (Find the Pair's no-match), over a `thud` (the result's buzz) | Two falling notes |
| Ride the Bus | `ding` | A right guess (the Hangman bell), once the card's face shows; a second `cardSlide` as the card moves into its slot. For the computer or the other player, the sounds start after their choice has lit up (0.8 s) | Bell: 1046 Hz with a 1568 Hz partial |
| Ride the Bus | `thud` | A wrong guess (the Hangman thump); a `cardSlide` as the card goes back into the deck | Low thump with lowpass noise |
| Ride the Bus | `point` | A right card lands on its stop and the bus arrives under it: played a step higher each round (rate 1, 1.14, 1.28, 1.42) | Short rising triangle blip 700→1000 Hz |
| Roulette | `peg` | A number, a group or green 0 is picked for the bet (Codebreaker's peg). *Varied.* | Triangle click |
| Roulette | `rlSpin` | The wheel starts spinning (it fades as the wheel slows; the ball's clicks carry on) | Lowpass noise falling 1100→300 Hz over 1.25 s, with a low hum |
| Roulette | `ballTick` | The ball clicks as each pocket's edge passes under it (the wheel one way, the ball the other), slower and slower until it drops, the last three lower. *Varied.* | 3100 Hz triangle, very short |
| Roulette | `ballDrop` | The ball drops into its pocket | Two falling clicks and a short rattle |
| Roulette | `ding` / `thud` | A hit / a miss | As above |
| Roulette | `sparkle` | Green 0 comes up on a bet on 0: the square at once | Rising sparkles |
| Bullseye | `dartThrow` | The flick: the dart leaves the hand (this phone's own online throw: at the flick itself) | A quick thin whoosh: band-passed noise sweeping up, a faint rising triangle |
| Bullseye | `dartHit` / `dartBull` / `dartMiss` | The dart sticks: in a ring, a thunk; in the bullseye, a deeper thunk with a bright ring (and `sparkle` after it); off the board, a dull knock into the wall | Thunk: a short noise burst with a low falling triangle; the bullseye's: lower, with two high sine partials; the knock: low-passed noise, a low falling triangle and a faint click |
| Bullseye | `dartQuiver` | The dart quivers where it stuck | Four short falling triangle notes, each fainter |
| Echo | `tone` (live) | Each step of the pattern as it plays (timed from the Play pattern tap), each pad tapped back (at the press, and nothing else: no tap click), and, for someone else's attempt, their pattern and their taps as they replay. *The rate sets the pad's note: G, C, E, G.* | A soft triangle note, 392 Hz, made by an oscillator each time it plays (not rendered at load) |
| Echo | `tone` run / `ding` | A pattern beaten: the four pads' notes in a rising run, 80 ms apart (your own: from 0.26 s after the last tap, as its tone dies away; someone else's: once their taps have replayed), then the ding as the level's pip fills | As above |
| Echo | `buzz` / `tone` | A slip: the buzz with the wrong tap itself (a missed turn has the page's own buzz), then the note of the pad it should have been as that pad lights in its green ring, 0.38 s later | As above |
| Peg Drop | `marker` / `peg` / `ding` / `thunk` / `point` / `sparkle` | The chip is let go (the marker's click, lower); it clicks on every peg it touches, each at its own moment (Codebreaker's peg, higher row by row and a shade higher going right than left); a ding as it touches the bonus peg; it lands in its bin with a thunk and its points pop (`point`, higher the more it is worth); the winning drop sparkles | As listed above (`plop`, the sine falling 520→260 Hz it used to land with, stays for the physics games and Scratch & Match) |
| Cup Pong | `pongThrow` / `clink` / `splash` / `thud` / `pongRoll` | The flick (new `pongThrow`: a soft rising whoosh, bandpass noise 1100→2800 Hz under a faint triangle 260→420 Hz, *varied*; online your own plays at the flick itself, the rest with the server's record); the ball on the rim tings (Coin Flip's clink); a made cup splashes (Sea Battle's splash); a ball coming down on the table taps (the Hangman thud: a miss, or a rim-out off the rim); a long roll to the table's edge rattles (new `pongRoll`: lowpass noise 900→500 Hz with five quick triangle ticks 1900→1340 Hz). Haptics: the tap at the flick, medium as the ball lands (clink, thud, splash are RESULT sounds), success on the square won | As said |
| Trivia | `ding` / `thud` | Right / wrong (crossed out), as the pick is marked | As above |
| Craps | `rattle` / `diceTap` / `thunk` / `clack` / `diceWin` / `diceLose` / `toggle` | Each roll: the dice rattle (Risky Rolls' rattle), touch the felt (`diceTap`) and land (the thunk); the marker landing on the number to roll again (the clack); the round won (`diceWin`: a rising arpeggio with sparkles, as the last pair lands and hops) or lost (`diceLose`: a deflating slide and a sigh, as it dims); a Stop (the toggle, squares from before) | As above |
| Shut the Box | `rattle` / `diceTap` / `thunk` / `diceLose` / `select` / `deselect` / `error` / `domClick` / `c4drop` / `sparkle` | A roll: the dice rattle, touch the felt and land (the thunk, with the result's buzz); no tiles make the roll: Krabs' slump as the total is struck out (the error buzz); a tile picked or put back; a tile no way of making the roll takes: the error sound; a flip: Dominoes' click as each tile meets the box, each a little lower than the one before (1, 0.93, 0.86 … times its pitch); the last tile shut: the lid comes down (Four in a Row's wooden thunk, at 0.7 times its pitch) and a sparkle | As above |
| Ship, Captain & Crew | `rattle` / `diceTap` / `thunk` / `shipBell` / `point` / `ding` / `thud` | A roll: the dice rattle, the first ones touch the tray (`diceTap`) and the last lands (the thunk); each die set aside reaches its place on the deck (new: `shipBell`, a small brass bell, played at 0.84 times its pitch for the ship, as it is for the captain, 1.19 times for the crew); the cargo shows in its crate (Risky Rolls' point); a turn's end: the cargo counts into the total (the ding), or nothing scored (the thud) | `shipBell`: a click of bandpass noise, then sines at 880 and 2428 Hz and a triangle at 1765 Hz ringing out over 0.4 s (synthesised) |
| Takeover | `hexPlace` / `tkFlip` | The piece lands on its square (Hex's click); each square round it turns over to the mover's colour, one after the other, each a tone higher | `tkFlip`: a bandpass noise snap with a short triangle tone 587→660 Hz, played faster for each square |
| Flood | `splash` / `pop` / `thud` | The blob changes colour (Sea Battle's splash); a pop for each wave of squares it grabs, a little higher each wave; nothing grabbed: a thud | As above |
| Seating | `mark` / `ding` / `hop` / `cushion` / `whoosh` | The mover sits (Tic-tac-toe's mark), a ding if that makes a table theirs; the customer walks in (Bump's hop) and sits down (Pool's cushion), or, with no seat of their colour, walks out (Four in a Row's whoosh) | As above |
| Districts | `marker` / `flipUp` | The piece goes down (Codebreaker's marker); the regions take their new shades (Find the Pair's flip) | As above |
| Shelves | `mark` / `thud` | The mark (Tic-tac-toe's); the grey mark lands | As above |
| Roads | `pieceSlide` / `knock` | The line draws in (Hexapawn's slide); the blocked line is knocked out (Hexapawn's capture knock) | As above |
| Flap | `flap` / `crash` / `thud` / `sparkle` / `ding` | Each tap: a wing beat (new: filtered noise and a little rising tone); the crash; the result: thud or sparkle, the bar's ding | As above |
| Chopper | `rotor` / `crash` / `thud` / `sparkle` / `ding` | Each press: the rotor biting (new: four low noise chops); the crash; the result as Flap | As above |
| Patterns | `ding` / `thud` | Right (the answer drops into the gap) / wrong (crossed out), as the pick is marked (Trivia's) | As above |
| Risky Spins | `rlSpin` / `wheelTick` / `ding` / `thud` / `sparkle` | The wheel starts (Roulette's spin) and its pointer ticks over the pegs, one tick as each peg passes, slower and slower, the last three lower (Candy race's wheel ticks); it stops on points (ding; a sparkle for the high-risk wheel) or on nothing (thud) | As above |
| Risky Spins | `marker` / `bust` / `bank` | The points land in the turn's pot (Codebreaker's marker); a skull: the pot is lost (a thud, then the Risky Rolls crash); Bank: the pot onto the score (Risky Rolls' bank) | As above |
| Apple Pick | `rlSpin` / `wheelTick` / `ding` / `thud` | The spinner starts (Roulette's spin) and ticks round, slower and slower (Candy race's wheel ticks); it stops on a pick (ding) or on the bird or a spill (thud) | As above |
| Apple Pick | `rlSpin` / `wheelTick` / `ding` / `thud` | The spinner starts (Roulette's spin) and its pointer ticks over the pegs, one tick as each peg passes, slower and slower, the last three lower (Risky Spins' ticks, `ui/spin.js`); it stops on a pick (ding) or on the bird, a spill or a pick with nothing left to take (thud) | As listed above |
| Apple Pick | `appleDrop` | Each picked apple plops into the bucket, a little higher each time (the last one fills it: `sparkle`, then the square's chime). *Varied.* | Sine 420→240 Hz with a quiet triangle tap and a touch of low-passed noise, 0.18 s |
| Apple Pick | `birdSwoop` / `birdChirp` / `appleLift` | The bird swoops in over the bucket; it caws as it snatches; the apples lift away up to the tree | Swoop: bandpass noise rising 900→2600 Hz; caw (November 2026, in place of the three sine chirps): two rasping caws, the second lower, each a sawtooth falling 760→470 Hz with a quiet square a fifth over it and a breath of bandpass noise; lift: triangle rising 300→720 Hz |
| Apple Pick | `spill` / `appleRoll` | The bucket tips over; each apple rolls out and back up into the tree. *Roll varied.* | Spill: low-passed noise falling 600→250 Hz with three hollow triangle knocks; roll: triangle 520→380 Hz with a noise tick |
| Sniff | `hop` / `sniffSnf` / `higher` / `lower` / `hiloBlip` / `dig` / `pop` / `sparkle` | The dog's paws as it trots, one for each print it leaves (Bump's hop); its nose down as it arrives (new: `sniffSnf`, two short breaths in, soft. *Varied.*); "Hotter!" or "Colder!" as the word lands (Higher/Lower's rising and falling tones: the result's buzz), "Same" (Higher/Lower's blip); onto the treasure: it digs, twice (Treasure hunt's dig), the chest pops up out of the hole (the reaction's pop) and sparkles | `sniffSnf`: two bandpass noise puffs rising 1.7→2.6 kHz, 70 ms each; the rest as above |
| Word Tiles | `key` / `domClick` / `cardSlide` / `point` / `ding` / `sparkle` / `tileBag` | A rack tile picked (the keyboard's tick); a tile laid on a square, and each tile of a word as it lands on the board (Dominoes' click: the result's buzz); a tile taken back, Clear, and the new tiles out of the bag (the cards' slide); each word a move made as it is counted, a step higher each (Ride the Bus's blip), the last with the points in (`ding`; `sparkle` on the winning word); a swap: the tiles slide into the bag and rattle there (new: `tileBag`. *Varied.*), the new ones slide out | `tileBag`: five small bandpass noise clicks (2.4–3.4 kHz) with triangle ticks, dying away over 0.25 s; the rest as above |
| Mini Golf, Pool, Bowling | `clack` / `cushion` / `bumper` / `pinHit` / `plop` / `clink` / `thud` | (Super Chaos's Mini Golf: a clack as a shot locks in.) The shot's recording plays back, and its events sound as they come round, on both phones: two balls meeting (the Four in a Row clack), a ball on a wall or a cushion, a Mini Golf bumper kicking the ball off (Pinball's pop bumper), the ball or a pin on a pin, a ball dropping in the cup or a pocket (Peg Drop's plop; the white ball in a pocket thuds), a lip-out (Cup Pong's clink), a gutter ball; after a Pool scratch, a `pop` as the shooter's ball pops back onto the table | Cushion: a short falling triangle 220→140 Hz under low noise; pin hit: a sharp band of noise at 1500 Hz with a falling triangle |
| Mini Golf, Pool, Bowling | `ding` / `thud` / `strike` / `buzz` / `won` | The result as the replay ends: a ding for a good one (a ball sunk and another shot in Pool, six or more pins), a thud for a poor one (a lip-out, a scratch, a gutter ball); a strike's fanfare; the buzz when the black goes down; the square's chime when it is won | Strike: four rising triangle notes (E5 G5 B5 E6) over a band of noise sweeping down |
| Pool (November 2026: its own, in place of the shared clack, cushion, plop and thud) | `poolCue` / `poolCueSoft` / `poolTick` / `poolClack` / `poolCrack` / `poolRail` / `poolRailSoft` / `poolDrop` / `poolScratch` / `ding` / `buzz` / `pop` | Each from its event in the shot's recording, once, on both phones: the cue on the white as the shot starts (the soft one under a third of the meter); two balls meeting, by how fast they met (a tick for a touch, a clack, a crack for a hard hit); a cushion (soft or full); a ball dropping into a pocket; the white going down (the scratch: its own sound, the error buzz on the phone that shot it), then the `pop` of the shooter's ball coming back. The result: a `ding` just after one's own ball drops (nothing else down), the `buzz` as a shot that sank the black ends; a shot with nothing down has no result sound | All synthesised, *varied* but the scratch. Cue: a 28 ms band of noise at 2.6 kHz over a triangle falling 340→190 Hz (soft: 2.2 kHz, 300→200 Hz, quieter). Tick: 18 ms of noise at 3.2 kHz with a 1.7 kHz triangle blip. Clack: 30 ms of noise at 2.5 kHz with a 1150 Hz triangle. Crack: 45 ms of noise at 2 kHz, a 950 Hz triangle and a sine falling 190→120 Hz under it. Rail: a triangle falling 210→130 Hz over low-passed noise (soft: 190→140 Hz, half as loud). Drop: a sine thunk 170→95 Hz with low noise, then three fading clicks of noise at 1.5–1.2 kHz (the ball settling in the pocket). Scratch: the thunk (160→90 Hz), then a triangle sliding down 330→150 Hz |
| Mini Golf (November 2026: its own, in place of the shared clack, cushion, bumper, plop, clink, ding and thud) | `golfPutt` / `golfPuttSoft` / `golfKnock` / `golfKnockSoft` / `golfBoing` / `poolTick` / `poolClack` / `golfLip` / `golfCup` / `won` | Each from its event in the putt's recording, once, on both phones: the putter on the ball as the shot starts (the soft one under 30% of the meter; played a little higher for a harder putt); the ball on a wall or the kerb (soft at 14 units a second or less, else full, a little higher the harder); a post kicking the ball off (higher the faster the ball came); the two balls meeting (Pool's tick or clack); a lip-out (the rim's rattle as the ball hops it); the ball dropping into the cup (the result's buzz lands here), then the square's chime. A putt that rolls to a stop has no result sound | All synthesised, *varied* but the lip and the cup. Putt: 20 ms of noise at 3 kHz over a triangle falling 620→420 Hz with a 1250 Hz blip (soft: 2.6 kHz, 560→420 Hz, quieter). Knock: a triangle falling 330→210 Hz over low-passed noise (soft: 300→220 Hz, half as loud). Boing: a tick of noise, a sine rising 250→620 Hz, then a triangle falling 620→400 Hz. Lip: three fading ticks of noise at 1.8 kHz, each with a triangle 880→700 Hz. Cup: a sine thunk 300→150 Hz with low noise, three fading clicks of noise at 2–1.7 kHz (the ball rattling in the cup), a soft 190→150 Hz settle |
| Bowling (November 2026: its own, in place of the shared thud, ding and `strike`) | `bowlRoll` / `bowlHit` / `bowlCrash` / `pinHit` / `bowlPit` / `bowlGutter` / `bowlSweep` / `bowlStrike` | The roll, from its recording's events, once each, on both phones: the ball's rumble down the lane from the flick (played faster for a faster ball, so its pitch and length go with the speed); its crash into the rack (the result's buzz lands here); a roll that takes eight or more adds the rack going over; the pins against each other after it (the first seven); the ball and up to three pins dropping into the pit; a gutter ball (the error buzz); the sweep as the pins settle; a strike's fanfare. The square's chime when it is won | All synthesised. Roll: lowpass noise 150→240 Hz over a 60→82 Hz sine with faint board ticks, 1.15 s; hit: a wooden crack, bandpass noise 1250 Hz over a triangle 310→190 Hz and a 115→70 Hz thump; crash: seven staggered clacks falling 2100→1100 Hz over a lowpass wash; pit: a dull 96→56 Hz thump, *varied*; gutter: a hollow triangle clunk 170→95 Hz and a low run of noise; sweep: a soft lowpass whirr 620→300 Hz and a clunk; strike: the four rising notes of `strike` |
| Dash, Lane Rush | `beep` / `go` / `jump` / `skid` / `crash` / `sparkle` / `thud` / `ding` | The 3-2-1 count and go; a jump (Dash) or a lane change's tyres (Lane Rush) from the tap or swipe; the tumble or spin-out; then the result, for both phones: a thud (a crash) or a sparkle (the finish) as it shows, and a ding as the bar lands at the new distance | Beep: a short 880 Hz square; go: two rising squares; jump: a triangle sweeping up 420→900 Hz; skid: a band of noise falling 2200→900 Hz; crash: a noise burst over a low falling sine |
| Odd One Out | `reveal` / `tap` / `ding` / `thud` | Reveal (Codebreaker's reveal); for someone else's pick: their reveal, then their tap; found (ding) / not that one or out of time (thud) | As above |
| Sky Hop, Scoop Stack, Pinball | `go` | Start (the runners' go); for someone else's attempt, as its replay begins | As above |
| Sky Hop | `spring` / `crumble` / `crash` / `whoosh` / `sparkle` | Each bounce (new: a sine rising 330→760 Hz with a soft triangle overtone); a biscuit platform breaking (new: three low noise crackles); hitting a burr (the runners' crash); falling off the bottom (the whoosh); the top (sparkle). Live as the player plays, and in someone else's replay as it comes round | Spring: as said; crumble: three lowpass noise bursts falling 900→500 Hz |
| Scoop Stack | `scoop` / `whoosh` / `cushion` / `crash` / `thud` / `sparkle` | A scoop landing on the stack (new: a soft sine falling 420→230 Hz over low noise); one sliding off (the whoosh); one missed (Pool's cushion); a hazard landing (the crash); the third miss (thud); the target (sparkle) | As said |
| Pinball | `plunger` / `flipper` / `pinKnock` / `bumper` / `pinSling` / `pinWall` / `pinRoll` / `pinTarget` / `pinSave` / `pinDrain` / `sparkle` | The launch (noise rising 600→2600 Hz under a triangle 180→520 Hz); a flipper going up (a sharp noise click over a low triangle thump); the flipper striking the ball (new: a lowpass noise knock over a triangle 230→130 Hz); a pop bumper (a square 1100→700 Hz with a bright sine); a slingshot's kick (new: a noise snap over a square 520→260 Hz); a hard bounce off a rail (new: a soft triangle thud 170→110 Hz, quiet); a rollover lit (new: two rising triangle chimes, 1318 and 1760 Hz); a standup target lit (new: a tick and a bell, 1568 Hz with its fifth); a ball saved (new: three rising square beeps); the ball lost down the drain or out of time (new: a triangle falling 392→98 Hz over falling noise); every target lit (sparkle). Each once, from the ball's own events (physics-sim.js): live as the player plays, and in someone else's replay from the ball played through again from its inputs | All synthesised here |
| Sky Hop, Scoop Stack, Pinball | `ding` / `thud` / `won` | The result, for both phones: a ding for any gain, a thud for none; the square's chime when it is won | As above |
| Headcount, Flash | `go` / `tickSoft` / `reveal` / `key` | Start (the runners' go); in Flash a soft tick with each item; the question (Codebreaker's reveal); the number pad's keys (Five Letters') | As above |
| Snapshot | `reveal` / `flipDown` / `tickSoft` / `go` / `mark` / `deselect` | The pattern shows (reveal), the grid empties (Find the Pair's cards turning back), a soft tick each second of the countdown, then the taps open (go); a cell picked (Tic-tac-toe's mark) or unpicked | As above |
| Headcount, Flash, Snapshot | `tap` / `ding` / `thud` | For someone else's round: its own sounds as it plays, then their answer (tap); right (ding) / wrong or out of time (thud) | As above |

## Rules the game follows

- Every control plays a tap sound when pressed, whether or not the game takes the press; a mini-game's own inputs never do (they play their own sound only, and the click that ends a press a game took itself is silent).
- Opening a square and going back to the board make no whoosh: only your own tap plays (opening the
  computer's or the opponent's square, or coming back after a result, is silent apart from the move).
- Each move's sounds start from the move itself, timed to the animation they go with, once. Opponent
  and computer moves play theirs when they are replayed on screen, in the same order.
- Nothing plays while sound is off. The switch is on the main menu and in the in-game menu, and it is
  remembered between visits.
- The first tap unlocks audio, as iPhone requires. On iPhone the audio session is set to *ambient*, so
  the silent switch mutes the game and music already playing carries on. (The browser's own setting
  is used where the device supports it.)
- Audio that goes down (iPhone: backgrounded, locked, a notification, Bluetooth, a long session) comes back:
  the context is checked before every sound and replaced when it is not running or its clock has stopped
  (on any tap; once when the page comes back). A "Tap to restore sound" chip shows while it is down.

<!-- new-games-nov-2026: each new game lists its sounds after this line -->
| Dominoes | `domClick` / `cardSlide` / `knock` / `sparkle` / `ding` / `thud` | A tile clicked down on the table as it lands (new: a short bandpass noise click at 3.2 kHz with a triangle tick 1900→1300 Hz over a wooden knock 420→260 Hz, *varied*); each tile drawn off the boneyard (cardSlide); a pass, or a draw that found nothing (knock); the last tile out (sparkle); a blocked end: two knocks, then a ding for the fewer pips or a thud for a level count | Synthesised; `domClick` belongs in the haptics' RESULT set |
| Bingo | `bgCage` / `bgBall` / `diceTap` / `pop` / `plop` / `thud` / `point` / `sparkle` | Pick numbers: the cage turning (new `bgCage`: a soft bandpass hiss 2600→1400 Hz under eleven quick triangle clicks at 1.7–2.7 kHz, slowing and fading, over a low triangle rumble 140→90 Hz, 0.95 s), then each ball popping out of the spout onto the rail (new `bgBall`: a rising triangle tick 880→1320 Hz with a tap of noise at 3.4 kHz, then a lower clack 640→520 Hz, *varied*) and clicking into its place as its roll ends (diceTap); the call: the ball pressed (pop); the mark stamping onto each card the number is on as the ball lands on the tracker (a plop per card, X's first, O's 120 ms after it); a number on no card (thud); a complete line lighting cell by cell (a point each, each a note higher) and its sparkle as it is struck through; a call that completes both cards' lines ends in a thud instead (a tie). | Synthesised; `bgBall` belongs in the haptics' RESULT set (the last ball out is the draw's result) |
| Scratch & Match | `scratch` / `plop` / `ding` / `sparkle` | The foil rasped off a panel under the coin (four quick rubs over the rub's 650 ms, each two short bursts of bandpass noise sweeping 2600→1800 Hz then 1900→3000 Hz, *varied*); the picture popping as the last band goes (plop, with the result's buzz); a pair found (ding); three of a kind (sparkle) | Synthesised |
| War | `cardSlide` / `cardFlip` / `warDrum` / `point` / `ding` / `nopair` / `thud` | Each card flying in from its deck (the player's, then the dealer's), the pair turning together (one `cardFlip`); a tie: `warDrum` (a quick five-beat drum roll, low-passed noise over a falling 130 Hz thump) as "War!" lands, then the war's three down cards each side sliding in; the round won: a `point` at the verdict and a ding as each pip's token lands (two, the second a little higher, for a war won); the dealer's round: the card games' nopair with a thud (as 21's hand lost) | Drum roll: five noise hits 80 ms apart, lowpass 420 Hz, each a little louder, with a sine 130→70 Hz under each |
- `swPew` — Star Swarm: the ship's shot, a short square-wave laser blip (synthesised, varies a little each time).
- `swPop` — Star Swarm: an enemy bursts, a bandpass noise crack over a falling triangle tone (synthesised, varies).
- `swBlast` — Star Swarm: the ship blown up at the end of a run, low-passed noise with a falling sawtooth (synthesised).
| Snake | `snkCrunch` / `snkGulp` / `snkTurn` / `snkBonk` | Food of your own colour bitten (crisp crunch, *varied*); the other colour's food swallowed, a point for the other player (a low sinking gulp, *varied*); a turn (soft tick, *varied*); the nose into the wall or its own tail (a bonk). Start is `go`, a run's result `ding`/`thud`, the target reached `sparkle`. | Crunch: bandpass noise 2400→700 Hz with a triangle 520→330 Hz and a second noise tick; gulp: sine 420→190 Hz then a triangle 260→110 Hz with low-passed noise 500→220 Hz; turn: triangle 980→760 Hz, 40 ms; bonk: sine 300→80 Hz with low-passed noise 800→250 Hz and a triangle 150→60 Hz |
| Muncher | `go` / `munChomp` / `munPellet` / `munGhost` / `munDeath` / `sparkle` / `ding` / `thud` | Start (the runners' go; for someone else's run, as its replay begins); each dot eaten (a quick triangle chomp, 560→330 Hz then 330→520 Hz, *varied*), a power pellet eaten (new: a square sweep 220→660 Hz then a triangle wobble down), a frightened spook eaten (new: four square steps up and a chirp), a spook catching the muncher (new: six triangle tones winding down, then a soft lowpass pop), live and in a replay as they come round; the target reached or the maze emptied (sparkle); then the result for both phones: a ding for any dot gained, a thud for none | Chomp: two short triangle glides back to back, 0.1 s; pellet 0.42 s; spook eaten 0.36 s; death 0.7 s |
| Brick Break | `go` / `pop` / `brkPaddle` / `brkBrick` / `brkWall` / `thud` / `sparkle` / `ding` / `won` | Start (the runners' go); the serve (pop); the ball off the paddle (new: a rising triangle boop 520→700 Hz with a tap of noise); a brick breaking (new: a crack of bandpass noise over a square note falling 880→440 Hz); the ball off a side or the top (new: a soft triangle tick); the go's end: a miss or the time up (thud), the wall cleared (sparkle); for someone else's go, after its replay: a ding for a gain, a thud for none; the square's chime when it is won | Synthesised |
