# Sounds in Tic Tac Chaos

Every sound in the game is **synthesised in the page** with the Web Audio API (oscillators and filtered
noise, all written in the `sound` section of `index.html`). No audio files are used, so:

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
| `tap` | Any button press, including tapping a square to open it and the Board button (not a move or card) | Triangle glide 640→430 Hz with a short noise tick. *Varied.* |
| `key` | Wordle or Hangman key, Enter, Backspace | Triangle blip 1400→1100 Hz. *Varied.* |
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
| `spot` | The opponent's or computer's square lights up before its move | Two soft sines that swell in |
| `turn` | The turn passes to the other player | Boing: sine glide 260→620 Hz, then a small blip |
| `stamp` | A square is claimed (the owner's mark stamps in) | Low thump: sine 130→55 Hz with lowpass noise |
| `burst` | A comic burst pops round a square just claimed on the board. *Varied.* | Noise plus glide 900→1800 Hz |
| `reset` | A square resets after a draw | Falling tone 520→240 Hz with low noise |
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
| Tic-tac-toe | `mark` | A mark is placed. *Varied.* | Bandpass noise scribble with a low triangle |
| Connect 4 | `whoosh` | A piece is dropped | Noise sweep down 3000→500 Hz |
| Connect 4 | `clack` | The piece lands | Short noise click with a triangle |
| Battleship | `fire` | A shot is fired | Triangle glide 900→300 Hz with noise |
| Battleship | `splash` | A miss | Lowpass noise sweep with two bubbles |
| Battleship | `boom` | A hit | Lowpass noise with a low glide 160→50 Hz |
| Battleship | `sink` | A ship sinks | Long low rumble |
| Wordle | `tileG` | A tile turns green | Two tones, 660 and 990 Hz |
| Wordle | `tileY` | A tile turns yellow | Triangle 520 Hz |
| Wordle | `tileX` | A tile turns grey | Short falling triangle 330→280 Hz |
| Wordle | `solve` | The word is solved | Three-note chime |
| Hangman | `ding` | A right letter (and Higher/Lower's right answer) | Bell: 1046 Hz with a 1568 Hz partial |
| Hangman | `thud` | A wrong letter | Low thump with lowpass noise |
| Hex | `hexPlace` | A tile is placed. *Varied.* | Wooden click: triangle 500 Hz with bandpass noise |
| Hex | `pathNote` | Each cell of the winning path lights, one note a semitone higher each | Triangle 523 Hz, played faster or slower for each cell |
| Higher/Lower | `hiloBlip` | A guess is made. *Varied.* | 880 Hz blip |
| Higher/Lower | `higher` | The answer is higher | Rising glide 500→900 Hz |
| Higher/Lower | `lower` | The answer is lower | Falling glide 900→500 Hz |
| Snakes and Ladders, Dice Race | `rattle` | The die is rolled (also Risky Rolls) | Nine short noise ticks |
| Snakes and Ladders, Dice Race | `thunk` | The die lands (also Risky Rolls) | Low triangle with noise |
| Snakes and Ladders, Dice Race, Candy Race, Bump | `hop` | The piece hops one space. *Varied.* | Short glide 520→760 Hz |
| Snakes and Ladders | `climb` | Up a ladder | Five rising notes |
| Snakes and Ladders | `slide` | Down a snake | Falling glide 1000→260 Hz with noise |
| Memory | `flipUp` | A card is turned up | Noise sweep up 1200→2400 Hz with a tick |
| Memory | `flipDown` | The cards turn back over | Noise sweep down |
| Memory | `pair` | A pair is found | Three-note chime |
| Memory | `nopair` | No match | Two falling notes |
| Candy Race | `wheelTick` | The wheel ticks, slowing as it stops. *Varied.* | 2200 Hz sine, very short |
| Bump | `spin` | The spinner spins | Noise sweep down |
| Bump | `boing` | A piece is knocked back home | Spring glide 200→700 Hz with a wobble |
| Coin Flip | `coinSpin` | The coins spin | Glide 1200→2000 Hz with a shimmer |
| Coin Flip | `clink` | Each coin lands. *Varied.* | Two high sines |
| Risky Rolls | `point` | Points at risk grow after a roll. *Varied.* | Short glide 700→1000 Hz |
| Risky Rolls | `bank` | Points are banked | Four quick bright blips |
| Risky Rolls | `bust` | A repeated number: the points are lost | Crash: lowpass noise with a falling sawtooth |
| Treasure Hunt | `dig` | A square is dug | Shovel: lowpass noise sweep with a thud |
| Treasure Hunt | `band` | The band is revealed: higher for Hot, lower for Cold | Triangle 880 Hz, played faster or slower for each band |
| Treasure Hunt | `sparkle` | The treasure is found | Rising sparkles |
| Hexapawn | `pieceSlide` | A pawn moves | Lowpass noise sweep |
| Hexapawn | `knock` | A pawn is captured | Two knocks |
| Mastermind | `peg` | A peg is placed. *Varied.* | Triangle click |
| Mastermind | `marker` | A feedback marker appears. *Varied.* | Short tick |
| Mastermind | `reveal` | The code is cracked | Rising tone with two chimes |

## Rules the game follows

- Every control plays a tap sound when pressed, whether or not the game takes the press.
- Opening a square and going back to the board make no whoosh: only your own tap plays (opening the
  computer's or the opponent's square, or coming back after a result, is silent apart from the move).
- Each move's sounds start from the move itself, timed to the animation they go with, once. Opponent
  and computer moves play theirs when they are replayed on screen, in the same order.
- Nothing plays while sound is off. The switch is on the main menu and in the in-game menu, and it is
  remembered between visits.
- The first tap unlocks audio, as iPhone requires. On iPhone the audio session is set to *ambient*, so
  the silent switch mutes the game and music already playing carries on. (The browser's own setting
  is used where the device supports it.)
