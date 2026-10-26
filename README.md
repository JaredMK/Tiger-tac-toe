# Tic Tac Chaos

Play it: https://tictacchaos.com

A two-player, pass-and-play game for one phone, against the computer, or online, drawn in a
1930s rubber-hose cartoon style: thick wobbly ink lines, flat colours on cream paper, an X and an O
with faces, and a squash-and-stretch stamp with comic-book bursts when a square is won. The
fonts (Luckiest Guy, Patrick Hand) are embedded, so the look survives offline. The game is plain
ES modules with no build step: `index.html` is a shell that loads `src/main.js`; the engine
(`src/core`) and every mini-game's rules, AI and meta (`src/games/<game>/`) are shared with the
server; the page's own code is in `src/ui`, `src/audio`, `src/net` and each game's `view.js` (see
CLAUDE.md for the map). The local modes work offline. Online play uses Firebase: the Realtime
Database, Authentication, and Cloud Functions for accounts, matchmaking, records and history (see
"Setting up Firebase").

Serve the folder with any static server (ES modules do not load from `file://`), for example
`npx http-server .`, and open it in a browser.

A main menu comes first: "Play Computer", "Play a Friend", "Find Match" and "How to Play", with a small "by JarHead
Labs" credit and the studio's jar logo at the foot, linking to its X account (https://x.com/jarheadlabs,
in a new tab). The menu card is centred in the space above it, so the two never overlap, even on the
smallest phone. Every match is Classic: Super Chaos is switched off for everyone (`src/core/config.js`
`SUPER_CHAOS_ENABLED`), its code kept for its return, and no mode is offered anywhere. **Play Computer**
starts a match at once, with no setup screen: your side drawn at random, every released mini-game, the
computer at Normal (a rematch draws the side again). **Play a Friend** offers "Host game" and "Join game"
(below), and a small **Same phone** for two people passing one phone: one setup screen with two player
slots, player 1 a name and a side (X, O or Random), player 2 a name and the other side. A blank name is
the side's letter. X moves first. Every match opens with a card saying who is who ("You are X", or on a
shared phone "Player 1 is X · Player 2 is O"), for about 3 seconds or until tapped.
A rematch keeps the choice: X or O stay, and Random is drawn again for every match. Under "Mini-games"
are the mini-games in the mix (all on by default), with "Deselect all" and "Select all" buttons at
the top, in one alphabetical list; a small icon at each row's right end shows the game's kind, luck
(a clover), skill (a target) or brain (each game's `category` in its meta.js; its word on hover and for
screen readers). The page itself never scrolls or
rubber-bands on any screen; only inner lists like this one scroll. With none ticked, Start stays off and a short note says "Select at least one mini-game to
start". Ticking a game, Select all or Deselect all changes the list in place: it stays exactly where
it was scrolled, Mini-games stays open, and the choice is saved for the next match. Computer players carry the computer icon next to their name in the game: in
the turn indicator, on the square they are about to play, and in the results.

The game screen has a slim top row with "Menu" and the turn clock in a fixed-size box of its own
(empty without a time limit), so the clock never squeezes or overlaps anything. Under it is the turn
bar: the X and O characters with the players' names on each side (the board itself shows who owns
what, so there is no squares-won score); the current player's character bounces gently, and
"[name]'s turn" shows clearly underneath. Long names are cut off cleanly with "…".

"Menu" pauses the game with "Resume" and "Main menu"; the latter asks "Leave this match?" and, on Yes,
ends the match and returns to the main menu. Leaving a match that is recorded (any online match, or a
local one while logged in) counts as a loss, and the question says so: "Leave this match? It will
count as a loss." The loss is recorded like any other result. Nothing moves while the menu is open, the computer included. When a square is won, the owner's
mark squashes in with two comic-book bursts, once, around the square on the board (the result card
before it shows only the winner's character: no words and no bursts). Each burst's word is
picked at random from POW!, BAM!, CHAOS!, BOOM!, KAPOW!, WHAM!, ZAP!, SMASH!, CRUNCH!, YOINK!,
SNATCHED!, MINE!, CLAIMED!, GOTCHA!, KABLAM! and BOP!, never one shown the time before. A burst pops
in, stays about a second and pops out; it never stays on screen (with reduced motion it does not
animate, and still goes after a second).

Every screen outside a match (Play a Friend, Same phone, Find Match, Host game, Join
game and its waiting screen) has its back button in the top-left corner, in the same style as the Board button inside a
mini-game, and it goes back one screen. The one exception is Find a Match while it is searching: its
only way out is the Cancel button under the timer.

Every animation is started by the event that causes it, exactly once: a move made on this phone, by
the computer or played back from the other phone, a square's claim landing on the board (the stamp),
the glow on a square about to be played, a Find the Pair card turned up, a peg placed, a note popping up, a
screen coming into view. Drawing the screen never starts one: the page is drawn from the state as it
is, and each animation on it is then set to the point its event has reached. So a redraw in the
middle of one (a room update, the other player's presence, the menu) carries it on from where it was,
and a redraw after it has finished just shows the end: nothing replays or plays twice.

The results screen shows a message picked at random for the match: a win message for a person who
beat the computer, a loss message when the computer won, the winner's name with a win message when
two people played on one phone or the computer played itself, and online each phone shows its own
player's win or loss. A drawn match shows both characters, "It's a draw!" and a message from the tie
list. "View board" shows the
final main board; every square, claimed or not, opens read-only with everything hidden revealed, and
a button returns to the results with "Rematch" (the same settings and opponent again) and "Main menu".

The page never zooms (the game and the admin dashboard): the viewport has `maximum-scale=1, user-scalable=no`,
the page is `touch-action: manipulation` (no double-tap zoom; play areas are `none`), iPhone's pinch
gestures (`gesturestart`, `gesturechange`) are cancelled, and every text field is at least 16px so focusing one
does not zoom in.

## Rules

- The main board is a 3×3 tic-tac-toe grid. Every square holds its own mini-game.
- To claim a square, win the mini-game inside it. Three claimed squares in a row wins the match.
  The mini-game shows only its own winning moment (the ship sunk, the word solved, the finish line);
  the square becomes X or O on the main board, with its stamp, once the view has zoomed back out, in
  every mode (a match's last square: the stamp on the board, then the result).
- X and O alternate. A turn is exactly one move in one unclaimed mini-game of your choice.
- Every move animates and its result stays on screen for about a second, with input locked. Then the
  board comes back on its own and the turn passes to the other player.
- All mini-games run in parallel and persist between turns. There is no alternation inside a
  mini-game: you may move in the same mini-game on consecutive turns of yours, so piece counts
  can be lopsided.
- A mini-game's screen shows no instructions or help lines: how to play is in its **?** explainer only. Above and below the game
  there are only scores, progress, results and whose turn it is (the header shows the game's name and the ?), each line a fixed height,
  so nothing on the board moves when a line changes or empties.
- The nine starting squares are nine different games whenever the match has nine or more to deal from
  (fewer: each square any of them). A square that resets takes a game of the match's list not used yet in the
  match (dealt at the start, played, or on the board), then one not on the board now (an open square's, or
  the one resetting), then any (`core/match.js` dealNine, pickReset; Super Chaos too).
- The header of each mini-game has a small icon beside the **?** (each game's `target` in its meta.js,
  `scTarget` in Super Chaos where it differs): a shared target (one board for both), an individual one (your
  own progress) or a shared course (the runners: one course, your own distance). A tap shows its one line
  under it for a moment (over the game: nothing moves).
- If a mini-game ends with no winner (full board), that square resets with a newly randomised mini-game.
- If neither player has a legal move in a mini-game, that square resets the same way. A player who has
  no legal move in one square simply plays another; a player with no legal move anywhere is skipped.
  (Only Hexapawn could leave a player without a move, and it is no longer dealt; see below.)
- As soon as neither player can still get three in a row (every line holds a square of each), the
  match ends in a draw: nobody has to play out squares that cannot change the result. (It used to go
  on until the board was full, then the player with more squares won; games recorded that way still
  show "most squares".) A local match already past that point when the page loads ends as a draw then.
- Claimed squares stay on view: the board shows the owner's mark over the mini-game's final state, and
  tapping one opens that final state read-only with a "Won by" banner and every secret revealed (the
  Five Letters and Hangman words, the Higher/lower number, the Sea Battle ship, all Find the Pair cards). Looking
  never costs a turn.
- Every mini-game has a "?" in the top-right corner of its full view: a short card with how to play
  and how to win. It never uses a turn, and a tap anywhere closes it; it covers the whole screen, so
  nothing underneath takes that tap, and going to another screen closes it too. It opens as an overlay on
  top of the page: nothing under it moves or changes size. The same "?" sits on each game in the
  Mini-games checklist, and "How to Play" on the main menu shows the core rules with the list of
  mini-games, each opening its card.
- Pages only ever scroll up and down: sideways scrolling is locked across the app.

Each square is assigned one of these 18 at random when the match starts, all equally likely (duplicates
are fine; there are no weights). A square that resets draws again from the same list:

| Mini-game | How to win |
| --- | --- |
| Tic-tac-toe | 3×3, three in a row. As soon as neither player can still make three in a row (every line holds an X and an O), it is a draw and the square resets with a new mini-game, as if the board were full |
| Four in a Row | The standard 7 columns × 6 rows, pieces drop to the lowest open cell, four in a row in any direction |
| Sea Battle | 4×4 sea with one hidden ship shared by both players: 1 to 4 cells long (Patrol Boat, Destroyer, Submarine, Carrier), across or down, placed at random. Its name and a silhouette of its parts show under the grid, and under the miniature on the main board. A move fires at one cell: a hit shows a burst, a miss a splash, and the ship's direction is never shown. A hit that does not sink the ship lets the same player fire again at once, and their turn goes on until they miss or sink it (as with Hangman's right letters); a timed-out random shot fires once and ends the turn. Whoever hits its last part sinks it (the whole ship shows and goes under) and wins |
| Five Letters | One hidden common 5-letter word shared by both players; a move is a guess with green/yellow/grey feedback. Each player has 5 guesses a square (shown as dots; the admin's setting): a player whose 5th guess misses loses the square to the other, in Super Chaos too (squares from before: no limit). Guesses must be real words (checked against an embedded list of about 15,000); a non-word shows "Not a word" and does not use the turn |
| Hangman | Hidden 5–7 letter word; guess a letter. A right letter is revealed and you guess again at once; a wrong letter ends your turn. Revealing the last letter wins. The miniature on the board shows the wrong letters themselves, crossed out in red as in the full view, wrapping onto more lines as they add up |
| Hex | 4×4 hex grid; X connects left to right, O connects top to bottom |
| Higher/lower | The computer picks 1–30; each guess is answered higher or lower. Guessing it wins. Each player has at most 5 guesses in a square (shown as pips, ●●●○○, by each name in the full view and in the miniature): a player whose 5th guess misses loses the square, and the other player claims it. The same limit holds in Super Chaos. The computer halves the range, and on its last guess takes the likeliest number. (An older match's square keeps 1–20 and no limit) |
| Snakes and Ladders | 20 spaces in 4 rows of 5, numbered from the bottom; the path starts at the bottom left (both pieces wait on Start, before space 1) and winds upward with the race tracks' curved turns, space 20 at the top. Every board gets 2 ladders and 2 snakes placed at random: no two share an end, none starts on space 1 or touches space 20, none starts where another ends, each spans at least 3 spaces and crosses rows. A move rolls a die; the piece hops up space by space, then climbs the ladder or slides down the snake whose start it landed on. Reaching or passing space 20 wins. (It replaced the Dice race: an older match's Dice race square plays to the end, and its history and stats keep that name) |
| Find the Pair | 3×3 face-down cards with exactly one matching pair; a move flips two cards for 2 seconds. Flipping the pair wins |
| Bump | A race track of 9 spaces and a Finish; both pieces start at Home, before space 1. A move spins a 1-2-3 spinner (equal odds) and the piece hops that far. Landing exactly on the other piece knocks it back Home. Reaching or passing the Finish wins |
| Candy race | A winding path of 12 randomly coloured spaces (any three in a row are all different colours) from Start to a Finish shown in all four colours; a spin of the colour wheel hops your token to the next space of that colour. No such space ahead means you reach the Finish and win |
| Coin flip | Five coins: two X, two O and one mystery coin (?) that belongs to nobody, in random places. Flip turns up to 3 coins that aren't yours, the other side's and the mystery coin (all of them if there are 3 or fewer, otherwise 3 picked at random). The coins are picked as each turn starts and ringed in the player's colour before Flip is tapped, and exactly those flip; skipping the square and coming back a later turn may show a new set. Each lands X or O at random, the mystery coin too. All five the same wins for that symbol's player (so with no coin of your own left, a flip can hand the square to the other side) |
| Risky Rolls | Each player has a banked score. A move is a whole push-your-luck turn: roll the die (an 8-sided d8 by default), and a number not yet rolled this turn joins the points at risk (a small +N by your score, with this turn's dice in a row); then roll again or bank. Banking moves them into your score and ends the move; a repeated number busts, losing them (at most as many rolls as the die has sides). A roll tumbles the die on screen for 0.6 s, flicking through other faces, before it lands on the number rolled. The next roll can be made the moment the last one has landed. Once your score and the points at risk reach 51, only Bank is left. First to a banked 51 wins. The die (6 or 8 sides) and the target are on the admin's **Risky Rolls tuning** card (`config/pig`), copied into each square when it is dealt (an older square keeps a d6 to 21). The computer banks at about 12 points at risk with a d8 (9 with a d6): about 6 turns to 51. A bust turns red only once the die has landed; after a winning bank the die keeps the last number rolled |
| Treasure hunt | 6×6 grid with one hidden treasure. A move digs a cell: the treasure wins; otherwise the cell shows how warm it is, never the distance itself, counted in steps up, down, left or right: Hot (1 step), Warm (2–3), Cool (4–5) or Cold (6+), each with its own colour and label. A colour key sits under the grid in every mode, Super Chaos included: Hot = 1 step, Warm = 2–3, Cool = 4–5, Cold = 6+, each with its swatch (one row, always there, so nothing moves). Everything dug stays visible. A 5×5 square from a match started before keeps its size and answers in the same bands |
| Codebreaker | One hidden code shared by both players: 4 pegs from 6 colours, no colour twice, picked by the computer. A move is one guess of 4 different colours (tap a slot, then a colour; tap a filled slot to clear it). Feedback is a solid marker for each right colour in the right spot and a hollow marker for each right colour in the wrong spot, always solid first, so the order says nothing about which peg is which. Every guess and its markers stay on show, no guess limit; guessing the exact code wins. Each colour also carries a symbol (circle, square, triangle, diamond, star, plus). The hidden code sits in a compact row of small, peg-sized slots, so the guess history gets the room |
| Blackjack | Each player plays their own hands against the dealer and has their own win tally (shown for both, as pips). A move is one whole hand, under one turn clock: **Deal** gives the player two cards face up and the dealer one face up and one face down, every hand from a freshly shuffled 52-card deck; then **Hit** or **Stand** (no Double). Aces count 1 or 11, face cards 10; reaching 21 stands by itself. The dealer then turns the hole card over, hits on 16 or less and stands on every 17 (soft ones too). Beating the dealer without going over 21, or the dealer busting, adds 1 to the tally (every win counts 1); a natural blackjack (21 on the first two cards) adds 1 at once, unless the dealer has one too (a push). A loss or a bust adds nothing, and the tally never goes down; a dealer blackjack beats any other 21. **A push does not end the turn**: the tied hand is shown ("Push: a new hand"), then the same player is dealt a new hand at once, from a reshuffled deck, and plays on, push after push, until a hand is won or lost; the turn clock covers the whole turn, and the computer and timeouts follow the same rule. First to 3 takes the square In Super Chaos one shoe is shuffled for the square at each round's start: both players who play it that round face the same dealer hand (played out once to the same end) with their own cards from that shoe; a push deals again from a deck of the player's own |
| Ride the Bus | Each player has their own four rounds and their own deck, and both players' progress shows: (1) red or black, (2) higher or lower than card 1, (3) inside or outside cards 1 and 2, (4) the exact suit, one guess. The ace is high (2 lowest); a tie is wrong (an equal value in round 2, a value equal to either card in round 3). A right guess keeps the card and goes straight on to the next round in the same turn; a wrong one discards the card and ends the turn, with the cards already kept still kept, and next time the player tries the round they failed again with a newly drawn card. Every card comes from a freshly shuffled deck without the player's kept cards; a failed card goes back into that player's deck. Opening the square shows only kept cards, never the last failed one. A move plays out in order: for the computer or the other player, the chosen button lights up in their colour for about 0.8 s first; then the card flips and its face shows; then the tick or cross; then, only if right, the card moves into its progress slot (nothing in the progress area changes before the flip ends). Passing round 4 takes the square |
| Roulette | A small wheel of 25 pockets: 1 to 24 (odd red, even black, alternating round the wheel) and a green 0. A move is one spin with one bet: any 8 numbers, a group (1–8, 9–16 or 17–24), or green 0 on its own. The ball landing on a number or group bet on is a hit, and two hits take the square; as the ball lands, a marker moves from the wheel to that number on the betting board (and stays on it until the next spin), so a bet covering it is plain to see; green 0 coming up on a bet on 0 takes it at once (0 on any other bet is a miss). Each player's hits show; the board's miniature also shows the last six spins, every one: a hit in the spinner's colour (glowing), a miss plain, its number in its pocket's colour. The green 0 button is the same size as the number buttons; after the ball lands, the result (Hit!, Miss or Green 0!) holds for an extra second before play moves on |
| Bullseye | A small dartboard with a bullseye in its middle, on a field 100 units across and 120 down; after every throw it glides to a new random spot. A move is one throw, aimed in two steps: a vertical line sweeps left and right (tap, or **Stop**, to lock it), then a horizontal line sweeps up and down (tap, or **Throw!**); the dart flies to where they cross. The bullseye scores 3, the rest of the board 1, off the board 0; first to 5 points. Each player's lines speed up with every throw of theirs that scores. The board's size, the bullseye's, the sweep speed and the speed-up are on the admin's **Bullseye tuning** card (`config/bulls`), copied into each square as it is dealt; the defaults (a board 18 across, a bullseye 5 across, 1.04 s a sweep, 12% faster per scoring throw) aim at 5-6 throws to win. The computer lands the bullseye about 15% of the time, the board 45% and misses 40% at the start, a little worse as its lines speed up; a timed-out throw stops both lines at random. Someone else's throw (the computer's, the other phone's, a timed-out one) plays back as their screen showed it: the sideways line sweeps and stops, then the up-down line, then the dart Online, the server picks the board's spots and scores the two stopped lines the phone sends |
| Echo | Four coloured pads. One 10-step pattern per square, the same for both players; the four levels are its first 4, 6, 8 and 10 steps. The square opens on a **Play pattern** button and nothing plays until it is tapped; from then the player stays in the square (no Board button) until the attempt goes in. The pattern plays once (each pad lights with its own note, about 0.45 s a step, lit for 0.3 s of it, so the same pad twice in a row flashes twice with a dark gap between; the flashes stay with reduced motion, as a change of brightness; no replays, and a reload mid-attempt does not play it again), then the player taps it back: each tap lights its pad and sounds. A slip ends the attempt (the pad tapped shakes, the right one lights); the whole pattern tapped back advances them to the next level, and a failed level plays the same steps next time. Beating all four wins. Someone else's attempt (the computer's, the other phone's) replays as their screen showed it: the pattern, a beat, their taps, then the result. A pad tap plays the pad's own tone and nothing else (no click); the tap that completes a pattern plays its tone first, then the success sound after it |
| Peg Drop | A board with 7 drop slots, 6 rows of pegs and 7 bins worth 5, 3, 3, 2, 2, 1 and 1 points, in an order drawn per square, each bin shaded by its points from lightest (1) to darkest (5), the 5 with no other mark. A square opens with its bins clear (the last chip is not left lying in its bin). Each player has their own points; the first to 12 wins (the target is on the admin's **Peg Drop tuning** card, `config/plinko`). A slot dropped from, by either player, is locked (greyed) until all seven have been used; then they all reopen. One peg is the gold bonus peg (never in the top row, which a slot would hit every time): +2 when the chip touches it; once hit, another is drawn, there from the next turn until it is hit. At every peg the chip goes left or right, 50/50 (against a wall, inward); the server decides the path. The chip falls onto the first peg, then at each peg squashes a little and pops up and out in a short arc onto the next, and settles on the floor of its bin; the move lasts until its points have popped up out of the bin. The computer drops from the open slot with the most points to expect (the bonus peg counted, every path worked out) |
| Cup Pong | Each player has their own rack of 3 cups at the far end of the table, touching in a tight triangle. Opening the square shows the rack of the player to move at once (during a throw, the thrower's). A move is one throw: a flick up from anywhere on the game area (the table or the line under it); the direction aims, the speed sets the distance. Nothing is drawn while the finger moves (no aim line, no target): only the ball and the cups. The ball flies (growing, then shrinking) to where the throw sends it, plus a little scatter: inside a cup it sinks and the cup goes; within the rim it bounces, and drops in a quarter of the time; otherwise it misses. Sink all 3 to win. The miniature on the main board is a tiny table with each player's three cups as a small triangle on their side; a sunk cup fills in with its player's colour, so the more filled, the closer to winning. Online the phone sends the aim and power; the server rolls the scatter and decides |
| Trivia | One question per square, shared by both players (from the Open Trivia Database, see Credits; easy and medium, multiple choice), never one asked before in the match, its four answers shuffled. A new question starts face down with a **Reveal** button (Board leaves without acting). Reveal turns it up for both players and holds the player to the square (no Board button, no other square) until they answer this turn, the turn's timer still running; online the question itself stays on the server until then. Once up, it stays up whenever the square is opened, until it is answered right and a new one comes, face down again. A move: tap an answer. A wrong one shakes and is crossed out, for both players, and the question stays; the right answer is never shown. The next turn there, either player's, carries on with the options left. The right answer glows, scores a point for the player who picked it, and the next turn gets a new question. First to 3 right wins. A timed-out turn counts as one wrong pick (an option still standing is crossed out). The computer knows the answer about half the time and otherwise guesses among the options still standing, never one crossed out. Someone else's pick (the computer's, the other phone's) replays: the card turned up (if it was turned up that turn), a short pause, their pick. Online, the right answer stays on the server until someone picks it. The square's miniature on the board shows the question's options as dots under both players' progress, the crossed-out ones dimmed and struck through, so how many are left shows at a glance |
| Dash | A race to 550 m, side on (a clean run of the whole course takes about 27 s: it starts at 13 m/s and gains 3 m/s every 100 m, to 29.5 m/s at the finish, with a hazard every 18-32 m; a typical player takes about 4 runs: `npm run sim -- dash`): an original round runner who runs on their own. A move is one run, from the player's saved distance until they crash (into a ground hazard not jumped, or a low flyer jumped into) or finish; the crash point is the new saved distance. Tap to jump, hold to jump higher; stay down for the flyers. The speed goes with the distance (resuming at 400 m runs at 400 m speed); every run opens with a 3-2-1 count and two seconds with no obstacles. The course is fixed from a seed per square, one course for both players (each player's distance on it their own; first to the finish wins, in a match and in Super Chaos alike), so what crashed you is still there (past the grace stretch) on the retry, and the other player meets it too. Both players' progress bars show; 550 m takes the square. Online, the phone reports the crash distance and the run's time, and the server refuses what the course and the clock would not allow. Every run is worked out in fixed steps (1/240 s) and logged as its inputs at their steps (a compact string carried with the move), so the server plays it through again and accepts it only when it ends exactly where the move says, and the other phone sees the run itself: someone else's run (the computer's, the other player's) is replayed on the course from its log, at its own speed with its jumps and its crash or finish, before the result. The computer's runs are driven by an autopilot that clears every hazard until the one it is drawn to crash at, where it stays on the ground (or jumps into a flyer) |
| Lane Rush | A race to 1,000 m on a three-lane road from above: the car drives itself; swipe (or tap a side) to change lanes. It starts at 27 m/s (54 m/s by the finish) with rows of one or two cars every 10-18 m, half of them two (all on the Runner tuning card). The cars are spread across all three lanes (about a third in each, the open lane moving from row to row), and every row leaves a lane open: from any lane the row before left open, an open lane is at most one lane over, and such rows are at least 0.6 s apart (rows needing no change can be closer). A test driver who sees only the screen and reacts a quarter of a second late gets through every course. A crash (a car ahead, or a lane change into one) spins out; the rest is as Dash: one run a move, the distance kept, the speed with the distance, the count and the grace stretch, one fixed course per square, the same for both players. Every run is logged and replayed as Dash's: someone else's run (the computer's, the other phone's) is shown in full from its log, the car driving the course, dodging and then crashing (or finishing), before the result. The computer's driver takes the open lanes (lined up with the row after) and moves into a car of the row it is drawn to crash at. The road takes all the height the screen has (the result line sits over the top of the road instead of under it), and the car rides low in it, so about 35 m of road ahead is in sight (it was about 28) |
| Mini Golf | One hole from 22 hand-laid layouts (Zigzag, Dogleg, The horseshoe, The funnel, Round the bar, Pinball, Switchback, Island, Gates, Spiral, Hairpin, Chicane, Corner pocket, Bumper alley, The cross, Ladder, Moat, Keyhole, The lobby, Diamond, Double dogleg, Pinwheel) and the mirror image of each that is not its own (all but The horseshoe and Pinball): 42 holes. Each has turns and walls or bumpers in the way, the same for both players, who start side by side on the tee. Every layout has 2 to 4 round bumpers more than it first had, placed round the way to the cup (clear of the walls and of the cup itself), and every bumper is a kicker, as in Pinball: a ball touching one is sent straight off it at 0.85 of the speed it came in at plus 18 more (95 at most), even a slow roll, with a flash of the bumper and Pinball's pop-bumper sound; a wall just bounces. (The extra bumpers were placed and the kick set with the computer's putts measured on every hole: `npm run sim -- golf`.) In a local game the square gets a layout this phone has not had lately (either way round), until most of the 22 have come up, then it starts again (the phone keeps the list); online the server deals any of the 42 at random. A move is one shot: drag back from anywhere on the table to aim and set the power (an aim line and a meter show it), let go to shoot; the balls knock each other. Full power: a full putt rolls about 174 units on open ground, more than the course's 160. The difficulty is the course: every hole has turns, walls and bumpers in the way, and the computer, with its usual error, averages 3 to 5 putts on every one of the 42 (about 4.4 over them all). The ball drops only if it reaches the cup slowly enough, else it lips out. The first ball in the cup takes the square for its owner, even knocked in by the other player. Physics by Matter.js (see Credits): the shot is played out where the move is made (this phone locally, the server online) and its recording replays on both phones, frame for frame (smoothly between frames). Mini Golf, Pool and Bowling play at 1.5 times the speed the world is worked out in: the balls travel and slow down half as fast again along exactly the same paths, so a shot goes just as far and ends just the same, in two thirds of the time |
| Pool | Six pockets about 2.2 times the ball across (balls 7.8 units across, pockets 16.8: half as big again and twice the size they were), a shared white ball, two red balls (X), two yellow (O) and a black one, racked the same way every time. Drag back from the white ball to aim and shoot: the meter is the pull, and the speed goes with its square, so a light pull is a gentle tap while a full one sends the white the table's length 3.6 times and more (off the far rails three or four times). The physics runs in quarter steps for Pool, so nothing passes through a rail or another ball at that speed. Sink your own ball and you shoot again; sink the other player's and it counts for them; sink the black and you lose the square at once, whatever else went down; sink the white (a scratch) and the turn ends with the white back on its spot and an extra ball of the other player's colour on a free spot (more of theirs to sink, and to sink for them by mistake). Two of your balls down takes the square. Shots play 1.5 times as fast, as in Mini Golf |
| Craps | Each player has their own count of rounds won; first to 3 takes the square. A move is one tap of **Roll** (the only button): the dice then keep rolling by themselves until the round is won or lost. On the come-out roll 7 or 11 wins the round and 2, 3 or 12 loses it; anything else is the point (the puck goes on it), and from then the point wins and a 7 loses. Every move starts a fresh round; a loss takes nothing away. The dice are rolled where the move is made (the server online), and the round plays back roll by roll (each pair tumbling in, the round's rolls in a row under the felt, the result at the end). The computer and a timed-out turn simply roll. The first mover wins 56.6% of squares (computer against computer, 20,000 squares), the winner needing about 4.7 of their own moves |
| Takeover | A 5x5 board, empty to begin with. A move: tap an empty square to take it and the squares above, below, left and right of it, the other player's included (they turn over to you). A bar under the board shows X's squares, the empty ones and O's, in their colours with their counts, moving with every move. When no square is empty, the one with most squares wins (25 squares: no tie). The computer looks two moves ahead: the square that leaves it furthest ahead after the other player's best reply |
| Flood | A 6x6 grid of five colours; the top-left square starts the blob, shared and not scored. A move: pick a colour other than the blob's; the blob turns that colour and grabs every square of it joined to it, and those squares are the mover's. The blob is drawn as one shape (no lines between its squares); whose each square is shows only as a small X or O. Under the board, a bar for each player against the 18 target. First to 18 of the 35 squares wins (no tie). The computer looks two moves ahead (what it grabs, less the other player's best answer), and always grows the blob when it can |
| Seating | Ten tables of two seats, each seat one of four colours. A move: sit in any empty seat; then the customer sits in a random empty seat of their colour, or, when the move took the last one of their colour, walks in, across the room and out. The next customer's colour is drawn only from colours with an empty seat (the server draws it; it is always on show). Both seats of a table make it yours. Five tables wins at once; when no seat is left, most tables wins; a tie resets the square. The computer: its own half-table first, then the other player's, then a fresh table whose other seat is not the next customer's colour |
| Districts | A random map of five regions with 16 spots, inside regions or on borders; a border spot counts for every region it touches, and every region is touched by an odd number of spots (3 or more). A move: a piece on any empty spot; then a grey piece lands on a random empty spot (the server picks it) and counts for nobody, so each player places 4. Once the map is full, each region goes to whoever has more pieces touching it (level: nobody's); most regions wins, and a tie goes to the player who moved second in the square ("Ties go to O" above the map). Regions are shaded in their current leader's colour, and each player's tally shows the regions they lead as a big number by their name (it turns over as a move shifts a region). Every empty spot is the same white (one colour token, `--spot`, with no hover shade). The computer looks two moves ahead, weighing the regions still in play. (Grey pieces and the tie rule came in to even out the first mover's edge: 88% to 51% between the game's own computer players; a square started before them plays on without them.) |
| Shelves | Seven shelves of three spots (21). A move: a mark on an open spot; then a grey mark lands on a random open spot (the server picks it). Once full, the score is the number of shelves you are on (up to 7); higher wins, and a tie goes to the player who moved second in the square ("Ties go to O" above the shelves). The computer goes for shelves it is not on, more so ones the other player is missing too and that are nearly full. (Seven shelves and the tie rule even out the first mover's edge. Solved exactly over every grey placement, between the game's own computer players: six shelves with ties resetting, the first mover won 80.2%, tied 19.8% and lost 0.02%; seven shelves with ties resetting, 51.7%, 48.1% and 0.2%, so still 99.6% of the squares that ended; with ties to the second mover, 51.7% to 48.3%. A square started before plays on with six shelves, ties resetting.) |
| Roads | A honeycomb: 7 hexagons (one in the middle, a ring of six) and the 30 edges between their corners (the roads). A move: claim an open edge; then a random open line is blocked (the server picks it). Once none is open, the score is your longest trail (each edge once, corners can be passed more than once); longer wins, a tie resets the square. Each player's longest road glows; the hexagons sit under the roads, so nothing covers them. The computer lengthens its own road and takes the edge that would lengthen the other player's most. With 30 edges a square takes 15 moves, 7.5 a player (computer against computer), so the admin's **Roads tuning** card (`config/roads`) also offers a smaller honeycomb of 4 hexagons (19 edges, 5 moves a player). An older square keeps its 4x4 grid |
| Flap | A runner (as Dash): a race to 450 m, one flight a move, the distance kept when you crash, faster the further along (6 m/s, then 1.5 m/s faster every 100 m: the whole course in about 50 s), the course fixed per player from a seed, a two-second grace stretch at the start of each flight. A tap sets the bird climbing; it falls between taps; the sky stops it; the ground is a crash. Posts every 9-12 m (some 40 a course), each with a gap of 3.7, 3.2 or 2.8 m (wide 10%, middle 40%, narrow 50%) whose middle is within reach of the last one's. Before the first tap in the grace stretch the bird holds its height. The computer flies a distance drawn to finish in about 4-5 flights: its bird flaps to stay just below the middle of each gap and, at the post it is drawn to crash at, climbs into it. Every flight is logged and replayed as Dash's runs are (the server plays the log through; the other phone sees the flight, flap by flap). Online, a crash must be past the grace stretch, in no less time than the course allows |
| Chopper | A runner (as Dash): a race to 1,000 m, one flight a move. Held, the chopper climbs (a continuous rotor sound while held); let go, it drops. The distance counter runs 1.6 times as fast as before for the same flying (Chopper counts 1.6 of its metres to each metre on the screen, so a run gets 1.6 times as far at the same speed and spacing to the eye). A cave whose middle wanders and whose walls wave, narrowing from 5.6 m to 3.4 m over the course (both heights on the Runner tuning card); blocks float in it (small, big or none by the mix: 10% none, 50% small, 40% big, every 22-40 of its metres), and the speed ramps up 1.6 m/s per 100 m, always leaving at least 1.9 m to pass above or below all along the way in. In the grace stretch the walls close in from the edges and touch nothing. The computer and the online checks as Flap (a wall crash can be anywhere past the grace stretch); every flight is logged (the presses and releases at their steps) and replayed as Dash's runs are. The computer's pilot aims at the middle of the corridor clear for the next 0.8 s (the roomier side of each block) and dives into the floor where it is drawn to crash |
| Patterns | One puzzle per square, shared by both players, made by a generator from a rule (nothing is written by hand): a sequence with one item missing, at the end ("What comes next?") or, a quarter of the time, in the middle ("What is missing?"), and four options. Numbers (add or subtract a step, multiply, two steps taking turns, squares, each the sum of the two before, two sequences interleaved), shapes (turning a step at a time, sides going up, size growing or shrinking, colours in a cycle, solid and outline taking turns, or two of these at once) and dots (going up by a rule). The answer comes from the same rule; the wrong options from rules nearly right (a step off, the wrong operation, the wrong turn, the colours in the wrong order), and every puzzle is checked so that exactly one option fits and no two options are alike. As Trivia: a wrong pick is crossed out for both players and the puzzle stays, never showing the answer; a right one scores and the next turn there gets a new puzzle (of another family when it can). 3 right wins. Online the answer stays on the server. The computer is right about 60% of the time and never picks a crossed-out option; a timed-out turn is one wrong pick (an option still standing crossed out) |
| Risk Wheels | Each player has their own points; first to 18 wins. Each square deals three new wheels of 10 equal segments, drawn again until every rule holds: High risk has one or two 10s and otherwise 0s but for at most two small values (1-2), and the lowest average; Medium has no 10s, at least two 5s, a top value above Low's, and its average between; Low has every value 1-4 (at least two different) and the highest average; the averages at least 0.4 apart. On screen there are only the three wheels (no names, no averages): each has its own colour (High purple, Medium blue, Low green) and each segment shows its points in a shade of that colour set by the points, the same on every wheel (0 palest, 10 darkest). A move: spin one wheel once; it stops with the pointer on the server's segment and rests there until spun again. The target and the ranges are on the admin's **Risk Wheels tuning** card (`config/wheels`), copied into each square as it is dealt. The computer works out every wheel's chance of reaching the target first from the score as it stands (both players playing their best), so it takes more risk the further behind it is. A timed-out turn spins the low-risk wheel |
| Sniff | A 5x5 field, one buried treasure and one dog, shared, starting at least 3 steps from it (diagonal steps count as one; 2 when the treasure is in the very middle). A move walks the dog one step any of 8 ways (diagonals too): "Hotter!" when that brought it closer as the crow flies (straight-line distance), "Colder!" when further, "Same" when the distance did not change, shown for about two seconds. Nothing is kept on the board or the miniature: the step shows only while it plays, as a thin line in the walker's colour from cell to cell (a small dot on each cell, a small arrowhead on the step), and then the field is just the field and the dog. On the computer's (or the other phone's) turn, the step it picks lights up briefly in its colour before the dog walks. Whoever walks the dog onto the treasure wins (the chest pops up). Online the server keeps the treasure. The computer remembers only the last 3 steps: it steps onto a cell where the treasure could still be by those, or else toward those cells; a timed-out turn is a random step Super Chaos plays its own form: a dog each (see Super Chaos). |
| Bowling | A lane from above with a fresh rack of ten every roll. Aiming is two taps, as in Darts: an arrow sweeps left and right across the lane, a tap (on the lane or the Stop button) locks its direction; then a power meter rises and falls, a tap locks the power (the arrow crosses the lane in 0.73 s, the meter fills in 0.6 s: the admin's **Bowling tuning** card, `config/bowling`), and the ball rolls with exactly that aim and power. A roll wide of the pins is a gutter ball; one too soft stops short. There is no back wall: past the end of the lane is a pit, and the ball and any pin that go in drop out of sight and are gone (nothing bounces back). Every pin knocked down goes on the roller's total (both totals show); a strike gets its own flourish; the first to 25 pins takes the square. Someone else's roll replayed shows its result the same way: the pins it knocked down and their new total, held a moment before it closes. The miniature on the main board: the last rack, then a line each for X and O (the mark, a bar, and the pins out of 25) The roll plays 1.5 times as fast, as in Mini Golf |
| Odd One Out | A grid of tiles of one colour, one of them a slightly different shade (lightness, with a touch of hue, so it is fair with colours hard to tell apart). The difference is set per level in perceptual units (CIEDE2000 ΔE; about 1 is the smallest difference most people can see side by side), the same on every colour: by default 4 at level 1 (noticeable, not obvious), 2.8 at level 2 (subtle) and 2 at level 3 (very subtle), meant for a typical player to miss about 25%, 40% and 55% in the 5 seconds; on the admin's **Odd One Out tuning** card (`config/oddone`). The computer finds it 75%, 60% and 45% of the time. The square opens with the grid greyed and a **Reveal** button; Reveal shows the shades and starts 5 seconds (a bar runs down), and from then the player stays in the square until the pick goes in (a reload carries on the same countdown). A tap is the move: the odd tile is a find, anything else is not; no tap in time counts as a miss. The odd one is then ringed and a wrong pick crossed; nothing on the board moves. Each player's grid grows with their finds: 3×3, then 4×4, then 5×5, the difference smaller each time; a new grid every move. 3 finds wins. Someone else's pick (the computer's, the other phone's) replays: the grey grid, the shades, a short pause, their pick. Online, the odd tile's place stays on the server until the tap (the 5 seconds are kept by the app, not the server) |
| Headcount | Each player has their own progress; first to 3 right wins. A move is one round, and every round is new. The square opens on a **Start** button (and Board), with the level and what to count, the creature's picture by its name ("Count the [beetle] beetles"), above it (the same line while the round plays, and the picture again with the question, "How many [beetle] beetles?"); Start plays the round and from then the player stays in the square until the answer goes in (online the server holds them to it too, so running out of time answers that round, wrong; a reload carries on from where the round was, never from the top). Small creatures cross a square field, coming in at one edge and leaving at the other, never appearing or vanishing inside it; then a number pad in the field's place (exact answer only). Level 1: 14–20 to count and 4–7 decoys of another kind, left and right, uneven timing with bunches. Level 2: 18–25 and 7–11 decoys, in all four directions (left, right, up, down) at widely varying speeds, so their paths cross often (about 15 times a round). Level 3: 22–30 and 8–12 decoys that look like them (green and teal beetles, red and orange ladybirds, grey and brown mice), four directions, each stopping once or twice and starting again, in bunches. Two going the same way in the same lane never cover each other. Right: a step up; wrong (or no answer in time): no step, and the turn ends. The result shows the right count for a moment. Every value (how many, how many decoys, the crossing time and the gap between creatures, per level) is on the admin's **Headcount tuning** card (`config/headcount`); the computer gets 45%, 30% and 20% right at levels 1, 2 and 3 |
| Flash | As Headcount: own progress, first to 3 right, Start, a fresh round each move. Cards flash one at a time in the middle for 0.5 s each, each a star, heart or bolt in blue, green or purple (none of them X's or O's colours): 6 at level 1, 7 at level 2, 8 at level 3. Then one question with 4 options, shown only once the flashes are over: "How many stars?" (a shape) or "How many blue items?" (a colour), never about one that did not show. The wrong options are near misses (one off, a neighbouring shape's or colour's count, two off), and exactly one option is right, checked against the cards shown. The result marks the right option (and a wrong pick). The times and the number of cards per level are on the **Flash tuning** card (`config/flash`); the computer gets 80%, 70% and 60% right |
| Snapshot | As Headcount: own progress, first to 3 right, Start, a fresh round each move. A grid with some cells filled shows for 5 seconds (a bar running down), then the grid stays blank for a 5-second countdown (5, 4, 3, 2, 1 and a bar), with a few words over it, one of "Remember what you saw…", "Don't forget!" and "Hold that thought…" (the round's own, drawn at random); only then can the player tap the cells back in and tap **Submit**, with no time limit of its own (only the turn's clock); it must match exactly. Level 1: 4 across by 5 down with 7 filled; level 2: 5×5 with 9; level 3: 5 across by 6 down with 11. Never a giveaway pattern: no full row or column, no straight line of four (across, down or diagonal), never one solid rectangle, nothing mirror- or turn-symmetric. The result lays the pattern over the attempt: right cells, missed cells and extra cells each marked. The grid sizes, the cells filled, the seconds on show and the countdown are on the **Snapshot tuning** card (`config/snapshot`); the computer gets 65%, 50% and 35% right |
| Sky Hop | Both players climb the same course, the same every time (seeded per square, one course for both: a stretch that beat you is still there next try, and for the other player); each player's height is their own. A move is one attempt: the square opens on the hopper standing on its start ledge at the height the player reached, with **Start** below; Start begins the attempt and holds the player to the square until it ends. The hopper (a round sprout in the player's colour, original art) bounces on its own off every platform it lands on; dragging a finger left and right anywhere on the mini-game screen (on, above or below the scene) steers it, one to one; the sides of the sky are walls (nothing wraps round), and every platform, its swing too, lies inside them. Falling off the bottom ends the attempt; the highest point reached is kept. Each attempt starts on a full-width ledge at the saved height that holds for 2 seconds, with nothing hazardous, and nothing that breaks, in reach of the first bounce. The start is not easy: wide gaps, narrow platforms, few extras between, and a quarter of the platforms on the way up crumble from 8 m. Higher up: wider gaps, narrower platforms, cloud planks that slide to and fro, biscuits that crumble after one bounce, and now and then a burr beside the way up (never across it). Every course is a chain of platforms each within one bounce of the last, so no gap is impossible (a perfect hand climbs every course to the top). First to the target height (150 m) wins. Every value is on the admin's **Sky Hop tuning** card (`config/skyhop`): target 150 m, bounce 22 m/s, gaps 3 to 4.5 m, platforms 1.5 to 1.1 m wide, extras 0.4 to 0.2 per gap, moving platforms from 10 m (65% by the top, 2.2 m/s), breaking from 8 m (25% there, 60% by the top), burrs from 15 m (about one every 25 m). A strong run reaches the top in about 28 s (inside the minute's turn); an average hand needs about 4.5 attempts (`tests/sim/finger.sim.js`). The computer, playing like an average player, needs about 4 to 5 attempts of about 13 s each |
| Scoop Stack | Each player keeps their own stack from turn to turn. Both players face the same drops: the square's seed (one for both) sets what falls in each attempt, so a player's third attempt drops what the other player's third did. A move is one attempt, started with **Start** (held to the square until it ends). A drag left and right anywhere on the screen moves the cone at the bottom; scoops (strawberry, mint, vanilla, caramel, blueberry) fall to the top of the stack, which grows upwards (the view follows its top). A scoop landing within half a scoop of the top's middle stacks; further off it slides off, or falls straight past (a miss). A miss counts only once the scoop has fallen to the bottom edge of the screen (the misses' cones cross out then); three misses end the attempt, as does catching a pebble or a burnt scoop. The top of the stack sways a little behind quick moves. Nothing lands in the first 2 seconds. Falling speed and hazards rise with the stack. Every attempt is checked before it starts to be catchable by a cone moving at 72% of its speed (a perfect cone catches every scoop and dodges every hazard, sway and all). First to 25 scoops wins. Every value is on the **Scoop Stack tuning** card (`config/scoop`); the computer needs about 4 to 5 attempts |
| Pinball | A portrait table on Matter.js, dealt per square: one of seven upper playfields (Classic, Bumper nest, Twin ramps, The loop, The bank, The alley, Islands: their own bumper clusters, rails, lanes and loops) picked at random, with seven of that layout's target spots dealt at random (11 to 13 spots each; a spinner spot moves round its ring). The lower table is the same on every layout and built like a real one: the two flippers at the bottom of the table, a drain gap of about a ball and a half between their tips at rest (so a ball really can go down between them), an inlane guide above each flipper feeding the ball onto it with an outlane beside it, and a slingshot above each inlane. The table is enclosed: walls all round, the plunger lane on the right with a one-way gate across its top that shuts once the ball is out, so the ball can never leave the screen or fall back into the lane; every wall is a capsule (round ends: no corner a ball can catch on), and every element keeps a unit clear of every other. A layout check holds every layout to that in `npm test` (no two elements overlapping or within a unit, nothing outside the table, no pocket a ball could rest in, room for the ball at every spot: an overlap fails the build), and `npm run sim -- pinball` has the computer's hand light every spot of every layout, so any seven dealt can all be hit, and checks the drains between the flippers, that the ball never escapes or sticks, and that the recordings pass the check. Each player lights their own targets, which stay lit for them from turn to turn (shown in their colour before they launch). A move is one ball: **Start**, then a tap (or a pull down and let go: the further, the harder) launches it from the plunger; a press on the left half of the screen holds the left flipper, on the right half the right one (below the table too). The ball plays until it drains; a drain in the first 3 seconds is saved (the ball comes back to the plunger). Lighting every target wins. The flippers are swept shapes worked out at 480 steps a second (a ball pinched between both tips is pushed clear, up), so nothing passes through them or the walls, and every touch of a target counts. Online a ball is its inputs (the flippers as they change, each launch and its power, at their steps): the server plays it through again from them on a fresh table and keeps its own result and recording, never the phone's claim. The table's settings (target size, ball save, longest ball, slope, bumper kick, spinner speed) are on the **Pinball tuning** card (`config/pinball`) |
| Standoff Grid | Super Chaos only (never in a normal match). A 5x5 grid both share. A move claims one empty cell (it pops in, in the mover's colour, on their own screen at once; never judged there: no four in a row, no line, since the other player's claim could block it). Both claiming the same cell in the same round block it for good: grey and crossed, nobody's, and it breaks lines (in the recap both marks slam into it from either side, then it shuts). First to four in a row (row, column or diagonal: 28 runs) wins, looked for only at the round's end once both claims (and any block) are down, the line lighting up in the square in the recap; both completing one in the same round reset the square, as does a full grid or one where neither player can still make four. Timeout: a random empty cell. The computer completes its own four, blocks the other player's threes (and, more lightly, twos), weighs its own runs above the other player's, and goes easy on a cell the other player is likely to want when a collision there would cost it (a collision keeps the block but gains it nothing); among near-equal cells it picks at random, so it cannot be read. Computer against computer: about 7 rounds a square, under half won (the rest reset). Admin only; a brain game. |

No longer dealt, but still played to the end in a match started before they were taken out, and kept
under their own names in that match's history and the stats:

| Mini-game | Why it went |
| --- | --- |
| Dice race | Replaced by Snakes and Ladders |
| Hexapawn | Taken out: nobody has to move in a square, so the best play was often not to move at all, and positions came up where whoever moved there next lost, so neither player would. The rules it was played by: 3 columns × 4 rows, 3 pawns each on the home rows; a pawn steps straight forward into an empty square or captures diagonally forward; reaching the far row wins; when neither side can move, the square resets |

A reset in such a match deals only the games still in the list above, and a saved setup with only
Hexapawn ticked opens with every game ticked.

Hidden information (the Five Letters and Hangman words, the Higher/lower number, the Find the Pair cards, the
Sea Battle ship, the Codebreaker code, the Blackjack dealer's hole card and the rest of the deck) is never
shown on the board or in a mini-game before it is revealed.

### Credits

Trivia questions are from the [Open Trivia Database](https://opentdb.com) (opentdb.com), licensed
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The question file in this repository,
`trivia.json`, is shared under the same licence. It was downloaded once with `scripts/fetch-trivia.js`
(one request every 5 seconds, as the API asks; run by hand or by the "Fetch trivia questions" workflow,
which commits the file to a `trivia-data` branch), keeping only easy and medium multiple-choice questions
with their HTML entities decoded, and dropping anything time-sensitive (current officeholders, standing
records, "as of" facts, prices, recent years), adult or crude, from niche-fandom categories, or too long
for a phone screen. The file in the repository is two such fetches merged (at most 90 questions a
category, easy and medium mixed), then read through by hand with the wrong, ambiguous, dated, crude or
too-niche ones taken out: 776 questions across ten categories. The game never calls the API. The same
credit is under How to Play in the game.

Mini Golf, Pool, Bowling and Pinball run on [Matter.js](https://brm.io/matter-js) (MIT licence, by Liam Brummitt
and contributors): the page loads it from cdnjs (`matter-js` 0.20.0), with the copy from npm beside the
page as a fallback, and the Cloud Functions use the npm package. The tables, the shots and the rules are
the game's own (`src/games/shared/physics-sim.js`, run by the engine).

## Playing online

Play a Friend offers "Host game" and "Join game" (and Same phone, above). The host gets a five-letter
room code (no look-alike letters) and a **Share invite** button: "Join my Tic Tac Chaos game! Code: ABCDE
tictacchaos.com/?room=ABCDE", the code in both the words and the link, since some apps drop one of them;
"Waiting for friend…" shows until the guest joins. The guest enters the code on the Join screen, or opens
the link, which joins at once. The host is Player 1 and the guest Player 2: there is no side to pick, and
X and O are drawn at random when each match starts, rematches included. The host picks the mini-games
and the time per turn, and starts once the guest is in; both phones then show the same board. Once in,
the guest sees the game as separate labelled lines, like the other setup screens: Player 1 (the host),
Player 2 (them), Sides ("X and O drawn at random each match"), Time per turn and Mini-games, then
"Waiting for [host] to start…".
Who played which side is stored with the match itself, so the result is credited to the right players
even when the next match swaps the seats.

A code is read whatever its case and with any spaces around it, and a room more than a day old is
refused as expired ("The game CODE has expired. Ask the host for a new code."). Opening a join link
while already in a match (online or local) no longer lands on "No game with this code found" (the
old room was being resumed instead of the link): it asks first, "You're in a match with [name]. Leave
it and join this one?", adding "Leaving counts as a loss." when it does, with **Leave & Join** or
**Stay**. Leave & Join leaves the match exactly as the menu does (the loss recorded) and opens the
join form with the link's code; Stay carries on. A link to the room you are already in just carries
on, and a link is handled once, so a reload does not ask again.

Backing out of a lobby leaves it cleanly. The host's Back closes the room: it is deleted from the
database with its presence entries, the code stops working, a guest already in it is sent to the main
menu with "The room was closed.", and the host returns to Play a Friend. The guest's Back gives up the
seat, so the host's room stays open (it shows "Waiting for friend…" again), and returns to the join
form with the name and code still filled in. A room still being opened, or a seat still being taken,
when Back is tapped is let go as soon as the database answers.

Only the player on the move can act; the other can still open squares to look, and sees "Waiting
for [name]…". Each player's moves play on the other phone the way computer moves do: the chosen
square glows on the main board for about a second with a "[name] plays here" label, then a zoom into
the square, the animation, a short hold, back to the board, Risky Rolls' rolls one by one (a follow-up move in
a square you are already looking at plays right there). The board never runs ahead of what has been
played back: while the square glows it is shown as it was before the move (not yet filled in, not
yet claimed), and a square the move wins is claimed on the board, with its stamp, only once the
playback is back on the board. Each move on the record carries the square as it was before it for
this. "Rematch" on the win screen, from either
player, starts again in the same room with the same settings. Leaving a match under way through the
menu ends it as a loss for the one leaving (written to the match, so the server records it for both
players), tells the other player ("[name] left the match") and sends them back to the main menu too.

Leaving the app does not end a match. Lock the phone, answer a call, switch apps: the other player
sees "[name] is away", the match waits (or the clock runs, if one is set), and when you come back,
or open the page or the link again, you are back in your seat and every move you missed plays back
with the usual highlight-and-animate sequence, in order; a square changed by a later move shows what
it was until that move's turn comes.

### How it works

The game has no server of its own. Online play runs on a free Firebase project: a Realtime Database
holds each room at `/rooms/CODE`, and both phones read and write it. Neither phone is in charge, so
nothing stops when one of them is backgrounded, reloaded or switched off for a while.

- Each player is signed in anonymously (no account, no prompt). The room code and seat (X or O) are
  kept in localStorage, so reopening the page or the link rejoins the same seat.
- A move is a database transaction: it checks that it is that player's turn and that the move is
  legal, applies it and passes the turn, all at once. Two moves at the same moment cannot both go
  through, and a double tap cannot move twice. The moving phone generates the randomness of its own
  move (dice, coins, spins, resets) and the result is written into the state.
- Hidden values (the Five Letters and Hangman words, the Higher/lower number, the Find the Pair cards, the
  Sea Battle cell, the treasure, the Codebreaker code) are generated when the match starts and kept in a separate node of
  the room, `match/secrets`; the state the phones render never contains them before they are
  revealed. A Blackjack hand's hole card and deck are dealt when the hand starts and kept there the
  same way until the dealer plays (Ride the Bus cards and the Roulette ball are drawn and spun as the
  move is made, so there is nothing to keep).
- The record keeps the last few moves, so a phone that was away plays back what it missed. Presence
  is tracked with `onDisconnect` and the page's visibility: "[name] is away" shows while the other
  player is out of the app or offline.
- The turn deadline is stored in server time and both phones use the server clock offset, so the
  countdown is the same on both screens. When it passes, either phone applies the random timeout
  move in a transaction, so it happens exactly once. The clock keeps running while a player is away;
  that is the point of the clock.
- Rooms older than 24 hours are deleted whenever a new room is created.

### Time per turn

The host's lobby offers a time per turn: No limit (the default) or 1 minute. Find Match is always
1 minute. (A room or saved setting from before with 30 seconds or 3 minutes becomes 1 minute.) The
guest sees the setting in the lobby. With a limit on, a countdown shows in the header on both phones; it starts
when the player on the move has finished or skipped the replay of the move before theirs (their phone starts it
on the record, once a turn: `core/timer.js` `startClock`; a phone that never gets there still has a turn that runs
out, from the latest moment the replay could have ended, `startBy`), turns red and pulses in the last ten
seconds, and keeps running while the in-game menu is open or while a player is away.

When the clock runs out, nothing is played for that player (`core/board.js` `timeoutMove`). A turn with no
move made is missed: it passes to the other player, and both phones say "[name] ran out of time · turn missed".
A move already under way ends as it stands, with no choice made for the player: Risky Rolls banks the turn's
points, Blackjack stands on the hand in play, a round or an attempt begun (Headcount, Flash, Snapshot, a finger
game, a Trivia question turned up) counts as failed, and a bonus shot, letter or guess owed is simply not taken;
that is not a miss. A player's second missed turn in a row loses the match at once (it counts as giving up): the
win screen reads "[name] wins — [other] ran out of time twice".

### Setting up Firebase

The project `tic-tac-chaos` already exists, with the Realtime Database and anonymous sign-in on (the
original setup is in the git history). Accounts and matchmaking add Cloud Functions, which need the
pay-as-you-go plan. Expected use stays inside the free quotas; the budget alert is a safety net.
Once, from a computer:

1. **Blaze plan.** Open https://console.firebase.google.com/project/tic-tac-chaos/usage/details and
   click **Modify plan** (or the plan name, "Spark", at the bottom of the left menu, then
   **Upgrade**). Choose **Blaze (pay as you go)**, pick or create a Cloud Billing account (it needs a
   card), and confirm.
2. **Budget alert at $1/month.** If the upgrade offers a budget, set it to $1. Otherwise open
   https://console.cloud.google.com/billing/budgets, choose the billing account, click **Create
   budget**: name it "Tic Tac Chaos", scope it to the project `tic-tac-chaos`, set **Budget type:
   Specified amount** to $1, keep the 50%, 90% and 100% alert thresholds, and keep **Email alerts to
   billing admins and users** ticked. Click **Finish**. A budget sends emails; it does not stop spending.
3. **Sign-in methods.** Open **Build → Authentication → Sign-in method**. Click **Add new provider →
   Google**, switch **Enable** on, pick the support email and **Save**. Then **Add new provider →
   Email/Password**, switch the first **Enable** on (leave "Email link" off) and **Save**. Password
   reset emails need nothing more (the wording is under **Authentication → Templates**). Leave
   **Anonymous** on: friend-code games without an account use it.
4. **Authorised domain.** Still in Authentication, open **Settings → Authorized domains**, click
   **Add domain**, enter `jaredmk.github.io` and click **Add**.
5. **A deploy key for GitHub.** Open
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=tic-tac-chaos and click
   **Create service account**. Name it `github-deploy`, click **Create and continue**, and add these
   roles: **Editor**, **Cloud Functions Admin**, **Cloud Run Admin** and **Service Account User**.
   Click **Done**. Open the new account, go to **Keys → Add key → Create new key → JSON**, and save
   the file. Then in GitHub open the `Tiger-tac-toe` repository, **Settings → Secrets and variables →
   Actions → New repository secret**, name it `FIREBASE_SERVICE_ACCOUNT`, paste the whole content of
   the JSON file, and click **Add secret**. Delete the downloaded file.

That is all: the next push deploys the functions and the rules (see "Deploying"). The first
functions deploy also switches on the Google Cloud services they run on (Cloud Functions, Cloud
Build, Artifact Registry, Cloud Run, Eventarc, Cloud Scheduler), which can take several minutes.

For local work, the Firebase CLI installs with `npm install -g firebase-tools` (Node 22). The
emulators need Java 11 or newer; `firebase login` is only needed to deploy from your own computer.

The web config in `src/net/connect.js` (`FIREBASE_CONFIG`) is not a secret: it identifies the project, and
the security rules decide what anyone can do with it. The Firebase SDK (about 400 KB) is fetched
from Google's CDN only when something online is used (or at start for a player who logged in
before); local modes stay offline-capable.

## Reactions

In an online match (a friend code or Find Match) the 💬 button by the Menu opens a tray of six fixed
emoji: 👋 😂 😮 😤 👏 🔥. A reaction shows as a bubble by the sender's character for about 2.5 seconds
(a new one replaces it), with a pop on both phones. Sending never uses a move and works on either
player's turn. One every 2 seconds per player: the button greys out meanwhile. The in-game menu has
"Mute opponent's reactions" for this match. There is no text: a reaction is one of the six numbers
0 to 5, stored under `reacts/{room or game}/{side}` as `{ e, t }`, and the database rules refuse anything
else (text, another number, another seat, a faster write, a made-up time). Reactions are not kept in
the history, and local games have none.

## Accounts, Find Match, records and history

**Logging in.** The main menu has **Log in** at the top right.
A player logs in with Google or with an email and a password (**Create account** the first time,
**Forgot password?** emails a reset link). On first login they pick a username, permanent and unique
whatever the capitals. The menu then shows the username instead of Log in; tapping it opens the
player's stats, which have **Log out** (there is no separate Stats button).

**Usernames** are checked on the server, whatever a page sends: 3 to 16 characters, letters, numbers
and underscores only, and not offensive. The word list is the widely used open-source "List of Dirty,
Naughty, Obscene, and Otherwise Bad Words" (English, CC BY 4.0, `functions/badwords.js`) plus a few
extra spellings. Look-alike characters are undone first (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, @→a,
$→s, and so on), then: a listed word of 4 or more letters is caught anywhere in the name; a 3-letter
word only as a word of its own (between underscores or digits, or a CamelCase part, such as
`Big_Ass` or `BigAss`); and ordinary words that merely contain a listed one (Classic, Scunthorpe,
Analyst, Cockpit, Grape, Therapist…) are on an allow-list. The page runs the same check first for a
quick answer.

**Usernames already taken** are checked against the same rules once per rules version by
`scripts/check-usernames.js` (run by the deploy workflow): it changes nothing, writes the names that
would be refused today, with the word that caught each one, where only the admin can read them (the
dashboard's "Usernames to review" card), and prints only a count in the public log. Playing locally, against the computer or joining with a friend's
code needs no account (a guest in a friend game without one uses an anonymous session, as before).

Hosting a friend game needs an account too: tapping **Host game** while logged out goes to the login
first, then straight back to hosting once logged in (and named). Joining a friend's game does not.

**Find Match** (main menu; needs an account) pairs strangers in a single queue for a **Classic** match
(turn by turn, 1 minute a turn; every released mini-game the server can verify), with no options to
pick. Tapping Find Match goes straight into searching (after
logging in, if needed): "Searching…" (X and O hopping on one looping CSS animation, O half a hop
behind by its delay) with just the time waited, and **Cancel**, which goes back to the main menu. The
server pairs players by how long they have waited, longest first. Sides are drawn at random. Two
players who search at the same moment are paired once: the queue is changed in one database
transaction. A player can be in only one matchmaking game at a time; with one in progress, Find
Match reads **Back to your match**. When a match starts, a vs card shows both usernames with their
records for about 3 seconds (or until tapped); the server's turn clock allows for it.

**Super Chaos from Find Match** (off for now; kept as code, and described here for its return; the server
runs these games: `src/core/scgame.js`, `functions/index.js`: `scMove`, `scTick`, `scBegin`).
Each step of a move (a guess, a hit, a roll, a locked-in shot) goes to a Cloud Function as a request, which
checks it with the same engine the page uses (`src/core`) on that side's own copy of the round, makes every
random choice itself (dice, coins, the round's Roulette spin, Bump's spins, cards, words, codes), applies it and
answers with what that phone may see: the move's result and its square as the step left it, the secrets hidden.
The phone plays its own result from that answer. The other side learns only that a move is in; both moves
show on both phones in the round's recap once both are in (the waiting phone at once, the last mover's once its
own result has played), with the joint results (Mini Golf's two shots, the shared spin, Bump's spins) worked out
on the server. The round's deadline is a server time: past it (and a short grace) the first phone to ask, or the
scheduled sweep, settles the round, a side not in having missed it (nothing played for it; two missed rounds in
a row lose the match). The next round begins once both phones are through the recap (a bot is at once; a phone
gone is waited for 30 seconds). The phones never write a matchmaking game; they read its public state and their own
side's node (`games/{id}/sides/{side}`: their move, or their progress through one, for a reload). These matches
count as Find Match on the records, in the history and in the stats (their squares under Super Chaos).
Find Match is Classic now (turn by turn, the server playing each move, below). A lone searcher gets a bot
after their wait: the bot plays by the computer's own play at the admin's level, its move due after a
think, and bot matches are counted apart.

In a Classic game a move goes to a Cloud Function, which checks that it is that
player's turn and that the move is legal with the same engine the page uses (`src/core`), makes
every random choice itself (dice, coins, spins, cards, words, codes, timeout moves), applies the
move and writes the public state. The phones never write a matchmaking game; they read its public
state and play every move back exactly as in a friend game (the square lit up on the board, the
zoom, the animation), including the moves missed while away. Hidden values (words, numbers, codes,
cards, the treasure, the ship) are stored where no phone can read them, and appear in the public
state only when the game reveals them. The turn deadline is a server time. When it passes, either
phone asks the server for the timeout move and the server checks the deadline first; a scheduled
function does the same every minute for games nobody is watching. Two timeouts in a row lose the
match. Leaving a Find Match game through the menu is a resignation, which loses it ("Leave this
match? It will count as a loss." in the confirmation).

**Records.** A player's record is wins-losses-draws (3-5-1). The main record counts Find Match
games only; friend-code games go on a separate "vs friends" record (for a player who is logged in).
The server also counts, per mini-game, the squares each player won and lost in every online game
(Find Match and friends). When a match ends, a Cloud Function writes both records, both players'
mini-game counts and both histories in one atomic update, once per game; phones cannot write any
of it. The record shows next to the usernames on the vs card, on the results screen ("Your record
1-0-0", and the opponent's, whose name opens their profile) and on profiles. Each record is also kept
by the side played (`sides/X` and `sides/O` under the Find Match record, the friends record and the
local record), for the games played as X and as O.

**Local games** are recorded too for a logged-in player, as Player 1, against the computer or pass
and play, won, lost or left (a loss). The phone reports each finished match once to the `recordLocal`
Cloud Function, which checks it and writes the player's local record, local mini-game counts and a
history entry to `localStats/{uid}` and `localHistory/{uid}`, readable only by that player. A report
waits on the phone while offline and goes when it can. The online records are not touched.

**Game history**: each game is one row: a small snapshot of its final main board (X, O and empty squares,
the player's own squares outlined), Won / Lost / Draw, the opponent, how it ended and when, a **You: X** (or O)
badge for the side the player was, and the mode; a tap opens the full final board.

**My Stats** (tap your username): the **Game history** button first, then a selector, **Online / Local / All**. Online covers Find Match and
friend games together (with a "Find Match x-y-z · Friends x-y-z" line under it), Local the local
games, All both. The record (wins-losses-draws and the win rate: wins over all games, draws
included, so 3-5-1 is 33%) follows the selection. The record by side (as X and as O) and the squares won and
lost per mini-game are the admin's only (the dashboard's player detail, under Accounts). Under the record, **Top opponents**: the three people played most
online (Find Match and friend rooms; never a bot, the computer or a friend playing without an account),
most games first (then the latest played, then by name), each with the record against them (W-L-D); a
tap opens their profile, whose Back returns here. Its three rows are always there, blank where there is
no one yet ("No online opponents yet"), so nothing moves as it loads. The server keeps the count
(`oppStats/{uid}/{opponent}`) where it records each result, so it covers every game, not only the
history the profile loads; anyone logged in can read it, so another player's profile shows theirs. Another player's profile (tap their name) shows their online
record only, with no selector: local games stay private.

**History.** Every online game and, on your own stats, every recorded local game, newest first,
marked Find Match, Friend or Local, with the opponent, the date, the result and how it ended (three
in a row, no line left (a draw), timeout, resignation, or most squares for games from before the draw
rule). Tapping a game opens the read-only review board with
everything that was hidden revealed.

**Ratings and the leaderboard are switched off for now.** One flag, `RATINGS_ENABLED = false`, in
`src/ui/config.js` and in `functions/serverRules.js`, turns them off: no rating is calculated, changed or
shown anywhere, the leaderboard is gone from the menu, and matchmaking pairs by wait time only. The
Elo, rating-range pairing and leaderboard code is all still there; setting both flags to `true`
brings back ranked play with ratings (everyone starts at 1200, standard Elo with K = 32) and the
top-100 leaderboard.

**Back-fill.** Records and mini-game counts were added after people had already played, so the
deploy workflow runs `scripts/backfill-records.js` once after deploying: it recounts every
player's records and mini-game counts from their game history (older ranked and casual games count
as Find Match) and leaves a marker so it never runs twice. It prints only counts. In the same way
`scripts/backfill-accounts.js` recounted the games played as X and as O from every player's game
history (Find Match, friends and local; a match against a bot left out of the player's count when
bot matches are kept out of the records) and set each account's last activity from its latest game. Top opponents came
the same way: `scripts/backfill-opponents.js` counts every player's record against each opponent from
their game history once (games against a bot left out).

**Security rules** (`database.rules.json`): phones may read profiles, records, histories and the
records against each opponent (`oppStats`), and
their own matchmaking game's public state; a player's local record and history only by that player;
only Cloud Functions write ratings, records, mini-game counts, usernames, the leaderboard, histories,
the records against each opponent,
queues and game state. A game's hidden values have no read rule at all, and the username review list
is readable by the admin only. The admin's matchmaking settings (`admin/config`) are read and written
by the admin only; the alert keys (`admin/secrets`) can be written by the admin and read by nobody
but the server; the bot list, bot numbers and alert log are the admin's only, and so are every
player's local record (for the Accounts table), the accounts' last activity (`lastSeen`) and the
playtest logs (`devices`, `devlog`); the bots' own game
records (`botGames`) and the alert limits have no read rule at all.

### Switching Find Match on and off

Find Match is **off** until it is switched on with the **Find Match** card on the admin dashboard
(it is stored at `features/findMatch` in the database: anyone can read it, only the admin can change
it). While it is off, the **Find Match** button on the main menu is greyed out with "Not available at
this time" (as is the Find Match button on a finished Find Match game's results), the server refuses
to queue anyone, and anyone already searching is taken out of the queue and sent back to the main menu.
Matches already under way carry on, and "Back to your match" still works. Play a Friend is not
affected. Switching it on takes effect at once on every open page.

### Mini-game Settings (admin)

Every mini-game has its own settings page on the dashboard (**Mini-game Settings**, grouped Luck, Skill and
Brain): all its tunable values (sizes, targets, speeds, counts, odds, timings, the computer's rates), listed in
the game's `meta.js` as `TUNE` (`{ k, label, def, min, max, step, group }`, group Board, Rules, Timing or
Computer; `def` is the value the code had). **Save** writes the values that differ from the defaults to
`config/tune/<game>` (anyone can read it, only the admin can write it); the game reads it at start and the
server every 20 s, and a square is dealt with the values of that moment and keeps them (`mini.tune`, only the
non-default ones) to its end, on both phones and the server alike (`src/core/tune.js`: `tuneLive` when
dealing, `tune(mini)` after). **Reset to defaults** removes them (and the game's older tuning card's values,
where it has one, shown on the same page). A "?" explainer can name a setting (`{k}` in its text), filled with
the square's own value.

### Test play (admin)

On each game's settings page a **Test play** button opens a new tab with that mini-game alone (`index.html?sandbox=<game>&cfg=…`), using the
settings as they stand on the page (its settings and its tuning card's), saved or not: they ride in the address (base64url JSON) and are set in
that tab only, never read from or written to the live config. The tab checks the signed-in account is the
admin's first (anyone else is told it is for the admin only). Nothing there is saved (the saved match on that
device is untouched) and no stats or device events go out. The game is played in the middle square, the
player held to it; a bar at the bottom (the page is that much shorter: it covers nothing) has **Restart**,
**Computer: On/Off** (off: two players on the phone; in Super Chaos it simply never moves), **Level:
Easy/Normal/Hard** (the computer's level, `&level=`) and **Rules: Normal/Super Chaos** (fixed for a game that
is only one or the other) (`src/ui/sandbox.js`).

### Mode: Super Chaos or Classic

**Off for now: every match is Classic, and no Mode selector shows anywhere, the admin included**
(`src/core/config.js` `SUPER_CHAOS_ENABLED` false; the admin's Releases page says so). The rest of this
section, and the Super Chaos section below, describe it for when it returns.

One **Mode** selector, Super Chaos | Classic, in Play Local's setup and the host's lobby (Find Match is Super
Chaos only); the choice is kept on the device. The guest's join screen shows the host's mode. The Mini-games
list shows only the games of the mode chosen. The selector shows only where Super Chaos is open to the player:
the admin, or everyone once **Super Chaos mode** is released on the admin's Releases page
(`releases/superchaos`), Super Chaos then being the default; otherwise players get Classic only, with no
selector. Find Match is Super Chaos for everyone, run by the server (above), whatever the switch says.

### Game releases

Every mini-game is **Released** or **Admin only**. The **Game releases** card on the admin dashboard
has a switch per game (stored at `releases/{type}`: anyone can read it, only the admin can change it;
a game not there is as the code has it: each game's `meta.js` says `release = 'admin'` for the games
that start admin only, gathered as `TEST_TYPES` in `src/games/index.js`). A tap releases or un-releases at once (no confirmation; "Saved" shows beside it, or why it was not); the change applies to new matches at once, and
matches already under way are not affected. Release switches asked for in a prompt are set by `scripts/set-releases.js` (each set once, by the Firebase deploy workflow).

An admin-only game exists for nobody but the admin: it is not in the Mini-games checklist, How to Play
or the explainer list, never dealt or drawn for a reset, never in Find Match, and never in a room
anyone else hosts, logged in or not. The game page reads the releases at every start (a plain read of
the public node, SDK or no SDK, kept for the next visit) and follows them live once online; the
engine cuts every setup down to the games its player may see before a match starts. The admin
(the account with the admin flag, read from its sign-in token) sees every game, admin-only ones with
a small **Testing** badge, and can play them in local matches and in friend games they host; their
guest plays them in that match only. Find Match deals released games only, even for the admin.

Enforcement is on the server too: the database rules refuse a room setup that names an admin-only
game unless the host is the admin, and the server checks every new friend match against the releases
(with the host's admin flag); a match that holds a game its players may not see (a tampered page) is
taken out of the room, which goes back to its lobby. The stats keep testing data apart: squares of
games played while admin only are counted under "Admin-only games (testing)" in the mini-game table,
whatever the mode, not with the released games' numbers.

### Clients: the web page and the iOS app

The game runs on the web and, later, as an iOS app ([docs/ios-plan.md](docs/ios-plan.md)) that shares everything with it:
the same Firebase project, accounts, live settings and Find Match, so web and iOS players are matched with each other.

- Every client reports its version (`src/core/client.js` `CLIENT_VERSION`) and platform (`web` or `ios`) with every server call.
- Each mini-game declares the oldest client version that has it (`minVersion` in its `meta.js`). Find Match and friend rooms
  deal only the games both players' clients have.
- The admin's Releases page has an **iOS on/off** switch per game (`releases/platform/ios/{type}`). A game switched off for
  iOS stays out of the app and out of any match with an iOS player in it; the web keeps it.
- The **Clients** card there sets the minimum supported version per platform (`config/clients`). A client below it shows
  "Please update" instead of the game, and the server refuses it a new match.
- Sign-in is Google, Apple or email on both platforms. Apple needs its provider enabled in the Firebase console (see the plan).

### Matchmaking backfill and the empty-queue alert

Both are switched on and set from the admin dashboard (they start off), and both act only when
someone is searching Find Match **alone** (no other live searcher; two people searching are always
paired with each other first).

**The empty-queue alert** comes first: once a player has searched alone for a few seconds (5 by
default), the admin gets a text and/or an email, "[username] (record) is searching for a match and
nobody else is", with a link (`?play=find`) that opens the game straight into Find Match. It is
sent once per search, and limited: one per player per 30 minutes (re-queueing doesn't re-alert),
at least 3 minutes between alerts, at most 20 a day; all adjustable. The admin's own searches never
alert. Texts go through Twilio and email through Resend, with keys typed into the dashboard (kept in
the database where only the server can read them); the dashboard's **Send a test alert** checks
them, and the last alerts are listed with how each channel went.

**Bots** come next: each search draws its own wait, from 40 to 70 seconds by default (adjustable).
If the player is still alone when it is up, one of five bot accounts that isn't already in a game
takes them on. The match is an ordinary Find Match game: the bot's account looks like any other
(a made-up ordinary username, a profile, a record and history of its own, shown online), and it
plays through the same server moves. Each bot has its own style (how much it builds its own lines,
how much it blocks, how often it slips, how bold it is at Risky Rolls) and pace (thinking time drawn afresh
for every move: 1.5 to 5 seconds, 3 to 8 for a Five Letters, Hangman or Codebreaker guess, quicker for a
follow-up in the same turn, never more than 8), set in `functions/bots.js`. Each bot move is queued
on the server as a Cloud Task for the moment it is due, so it comes on time whether or not the
player's phone is checking in (the minute's sweep is a fallback); a bot never runs out of time. With the default wait, the alert comes about 35 seconds or more before any
bot, which is the window to join.

Bot matches are counted apart: their own row ("Find Match vs a bot") in the dashboard's stats, and
the number run, finished and won on the bots card. Whether they count in the player's record is a
switch on the dashboard (on by default); they never change a rating or the leaderboard.

To set up the alerts (once):
1. **Email (Resend):** sign up at https://resend.com with the address the alerts should go to. Under
   **API Keys**, create a key (it starts with `re_`, and shows only once) and paste it into the
   dashboard's Resend API key. Without a domain of your own, Resend sends only to the address you
   signed up with, from `onboarding@resend.dev`; that is all an alert to yourself needs.
2. **Text (Twilio):** sign up at https://www.twilio.com and upgrade the account (trial accounts are
   not worth it here). Buy a toll-free number, then submit its toll-free verification (Messaging →
   Regulatory compliance; free, it usually takes a few business days; US carriers block texts from
   unverified toll-free numbers). Paste the Account SID, Auth Token and the number into the
   dashboard.
3. On the dashboard, type the phone number and the email address, tick Text and/or Email, switch
   the alert on and press **Send a test alert**.

## Sound

Every tap and every move makes a sound. All of them are synthesised in the page with the Web Audio API,
so there are no audio files to download or license; [SOUNDS.md](SOUNDS.md) lists each sound, when it
plays and how it is made. Sound is on by default, and the switch on the main menu and in the in-game
menu turns it off (remembered between visits). The searching screen of Find a Match is silent (its one sound is the match being found). The first tap unlocks audio, as iPhone requires; on
iPhone the audio session is *ambient*, so the silent switch mutes the game and the player's music carries on.
Keeping it alive: iPhone takes a page's audio away (backgrounded, locked, a call or a notification, Bluetooth
connecting) and leaves the AudioContext "interrupted" or "suspended", or "running" with its clock stopped,
and resume() often never brings it back. So the context is checked before every sound: one that is not
running, or whose clock has stopped, is replaced by a new one (at once on any tap, since iPhone starts one
only inside a gesture; once when the page comes back; a check every 1.5 s while the page shows). While audio
is down a small "Tap to restore sound" chip shows at the bottom of the screen (fixed: nothing moves). Every
change of state, new context and failure goes to the device's log (devlog `audio`, on the admin's playtest
timeline) and, in a match, to its match log. Echo's pads are played live by oscillators. A game's own inputs (pads, keys, cells, Start buttons and the like) play only their own sound, never the menu click as well.

## Super Chaos (simultaneous play, vs Computer or a friend)

A second way to play Play Local and Play a Friend, switched on in its setup ("Super Chaos: Off / On";
in a friend room the host's lobby, and the guest's lobby shows "Mode: Super Chaos"). It is admin only
until released: the switch shows only to the admin (with a Testing sticker) until the dashboard's Game
releases card releases it (`releases/superchaos`; the database rules refuse it on a room otherwise).
Find Match is unchanged, and so are the normal modes.

- **Rounds.** Each round both players choose any unclaimed square and make one move there (the game's
  normal move: one run, one hand, one guess; a move that goes on, such as a right Hangman letter or a
  Craps point, goes on to its end). Both play at the same time: neither waits for the other, and nobody
  gets a second move for being quick. Once the player's move is in, their square says "Waiting for
  Computer…" until the computer's is too; then the recap opens a pop-up over the computer's square
  with a 2x replay of its move (the same replay system: its inputs, then each step of the move with
  its animation). Then anything only both moves together decide plays in its square ("Both moves
  together": a Bump knock, a Standoff Grid collision), and then the round's results play on the board one
  square at a time: a square won glows with "X takes it!" as its mark stamps in; a square both won
  shows both marks flying in and clashing ("Both won it: reset!"), then turns over to its new game. The replay skips dead
  time: any idle gap over 0.3 s (thinking, waiting) is cut to 0.3 s. It is plainly a replay: a
  "[name]'s move — replay" banner, a frame in the opponent's colour and a small replay icon; a tap
  anywhere on it, or Skip, jumps to the end. On the main board a small badge in each player's colour
  marks the square each played last (both at once), moved every round. (Mini Golf's shared shot plays
  as before.) The round ends once both moves are in, or when the round's clock
  (60 seconds, in the top bar with the round counter) runs out: nothing is played for a player not in, who
  misses the round (a move under way ends as it stands, as in a timed turn); two missed rounds in a row lose the
  match. The next round's clock starts only once the recap and its replays are over (online, on both phones). The
  clock holds while the menu or an explainer is open, or the page is out of sight. From the moment a player's
  move is in until the other player's replay is ready to play, the waiting band ("Waiting for [name]…") stays
  up, on the board or over the square where they wait (a Mini Golf shot or a Bump spin locked in), so there is
  never an empty gap; and the board shows nothing of the round's result (a claim, a reset and its new game, a
  miniature's change) until the replay or the joint result that shows it has played.
- **Results resolve together.** Nothing is claimed during the round: a square won shows the game's own
  winning moment, and its X or O comes only on the main board after the round resolves. A square both
  players won in the same round resets with a new random Super Chaos game (the reset on the board, no claim); both completing three in a row in the same round is a draw; any other claim stands.
  Both may play in the same square in the same round.
- **Shared squares.** Where both share a target, board or question, each player sees only their own
  move's result during the round; the other's move and result stay hidden until the round's recap, and
  both resolve as if simultaneous. Sea Battle: a 5x5 sea with a Submarine (3 squares, across or
  down); a hit fires again, as in a match, until a miss or the sinking shot (the time running out ends it there). Both
  players' shots (hits and misses) join the sea at the round's end, and the recap shows them. The shot that hits its last part is a
  plain hit on the mover's screen (no sinking, no claim): whoever hits the ship's last part wins it, judged at the round's end; when both hit its last parts in the same round (each sinking it on their own sea, or
  sharing out the last parts between them), the square resets. Five Letters,
  Higher/Lower, Codebreaker, Treasure Hunt: both guesses (and their answers) join the shared history.
  Hangman: one shared word; each sees the letters known before the round plus their own; a player whose
  own view completes it wins; finished only by both together, it resets. Trivia and Patterns: the
  question is face up for both; wrong answers are crossed out for both at the round's end, each player
  who was right scores, and a new question comes if anyone was. Bump: a joint-resolution game, as Mini
  Golf: a spin is locked in and the player waits in the square; nothing moves and no number is drawn until
  the round ends, when the system knows whether the other player spun there too. Then the spins are drawn
  and played in the player's own square: both pieces hopping together from where the round began when both
  spun there (and no replay of the other's move after), else the player's piece alone; then the knocks (a
  piece ending on the other's space sends it home; both on the same space both go home). The other
  player's lone spin elsewhere is their replay. Peg Drop: both may drop from
  the same slot (it locks once); both on the bonus peg get +2 each and one new peg appears. Mini Golf:
  each player locks in aim and power; at the round's end both shots play out together (the balls roll at
  once and can collide); both sinking resets it. The player stays at the hole once their shot is locked
  in ("Shot locked in", waiting for the other); when the round ends both shots play out there, in their
  own view (their ball and the other's moving at once), the result held a moment; then the recap goes on
  on the board (a computer's shot already shown there is not replayed again in the pop-up). Roulette: the
  square's spin is drawn as each round begins (on the record in a friend room, kept off its public state):
  each player's bet spins the wheel there and then, the result on their own screen at once (a player's own
  move always plays out fully before any waiting, replay or recap), and two bets in the same square that
  round land on the same number, so both see the identical spin; it joins the square's history once, and
  both taking the square that round resets it. A bet alone in the square spins as normal. Every other game
  keeps its own randomness (Craps, Blackjack, Peg Drop, Candy Race...). Sniff: one field and one treasure
  (never in the middle cell) but a dog each, both starting in the middle; a move walks your own dog one
  step, hotter or colder by your own dog's distance (the other player's step and its word show in their
  replay); both dogs and their paths stay on the board, each a thin line in its owner's colour (a dot on each cell it stood on, an arrowhead on its latest step); the first dog
  onto the treasure wins, both in the same round reset it (normal mode keeps one shared dog). Standoff Grid
  (Super Chaos only): a 5x5 grid; each claims one empty cell; both claiming the same cell block it for good
  (grey, it breaks lines: the two marks slam into it in the recap); four in a row wins, both at once reset
  it, as does a full grid or one where neither can still make four. In the recap the board shows nothing of the other player's move
  (their square's miniature, their last-played badge) until the pop-up has replayed it. Craps: each player's
  round always ends within their own move (nothing carries over). Every
  other Super Chaos game already keeps each player's progress apart and plays as normal.
- **Super Chaos games** (each game's `meta.js`: `superChaos`): Sea Battle, Five Letters, Hangman,
  Higher/Lower, Snakes and Ladders, Candy Race, Bump, Risky Rolls, Treasure Hunt, Codebreaker, Blackjack,
  Ride the Bus, Roulette, Bullseye, Echo, Peg Drop, Cup Pong, Trivia, Odd One Out, Dash, Lane Rush, Mini
  Golf, Bowling, Craps, Flap, Chopper, Patterns, Risk Wheels, Headcount, Flash, Snapshot, Sky Hop, Scoop
  Stack, Pinball, Sniff, Standoff Grid. The Mini-games checklist shows only these while Super Chaos is on. Standoff Grid
  is Super Chaos only (`meta.scOnly`): never in a normal match's checklist or deal (`dealable(t, sc)`).
- **The computer** makes its move at the start of each round, with its usual choice of square and the
  game's own tactics, without seeing the human's choice or this round's results; it takes a person's
  time over it.
- **The recap** (on the main board): a Mini Golf square plays both shots first; then the computer's
  square lights up and its move replays in the pop-up (played through to its end, the result held about a
  second); then what both moves settle together (a Bump knock, a Standoff Grid collision); then each square's
  result in turn (about a second each); then the next round. A square both players won in the same round
  is a new game on the record before the recap starts; its replay still plays the game the moves were
  made in (the square as the recap shows it: `shownSq` in `ui/chaos.js`). Tested for every Super Chaos
  game: `tests/core/chaos-double.test.js` (both win the same square: it resets, the replay is there,
  play goes on), from rounds found by `tests/core/sc-double.js` (the seeds kept in `sc-double.json`).
- **With a friend** (a friend room, each player on their own phone): the same rounds, both moving at
  once, and the server runs the match exactly as it runs Find Match (`core/scgame.js`; the room is only a
  lobby that points at the match, `rooms/{code}/game`). Each step of a move is a request (`scMove`), the
  round settles on the server once both are in or at its deadline (a side not in misses the round; two
  misses in a row forfeit), the settled round carries its start in server time and each phone plays the
  recap from there at its own pace, its own outcome first (`scRecapOrder`), and the next round begins
  once both phones are through it (`scBegin`; a phone through it waits at most 30 seconds for the other).
  A reload, or a phone coming back, reads the record and joins the round as it stands, or the recap where
  it is. Nothing of the other player's move, and no secret, ever reaches a phone before the recap (the
  public state is the server's `scPublicState`, each side's own node its `scSideView`). How it is built:
  `src/net/chaos.js`, `src/ui/chaos.js` (the sequence by the clock), `src/core/scgame.js`; tests:
  `tests/core/scgame.test.js`, and the server's in `tests/emulator/server.test.js`. (Until October 2026 a
  friend room's match was a record the two phones wrote by transactions, under the security rules alone;
  the review found that record forgeable, so every online match is the server's now.)
- **Stats**: its own mode, `chaos`, in the anonymous stats and the dashboard (Matches by mode, the
  mini-game table, the playtest log). Not in a player's local record or history yet.
- How it is built: `src/core/chaos.js` (the round: each player's move on their own copy of the board, the
  merge, claims and resets; each game's Super Chaos hooks in its `rules.js`: `scCreate`, `scFork`,
  `scRound` (a draw at each round's start that both moves share: the Roulette spin), `scApply`, `scAfter`,
  `scMerge`) and `src/ui/chaos.js` (the clock, the end of the round, the recap).
  Tests: `tests/core/chaos.test.js`.

## Playing against the computer

The computer plays at one of three levels: Play Computer plays it at **Normal** (the admin sets the level for the
Find Match bots, on Bot Settings): **Normal** is the computer described below, as it has always played;
**Easy** is the same computer with a careless move about 30% of the time (any legal move, anywhere open);
**Hard** chooses its square by Monte Carlo search and plays the strategy games by search and the luck
games by expected value. Hard's square choice (`src/core/mc.js`): every open square is a race, as Normal
sees it (the moves each side still needs there), and for each candidate square the rest of the match is
played out a few hundred times on that model, each side picking its square as Normal would (with some
exploring), each move making its progress with a set chance, until the board decides; the square whose
playouts win most often is the move, its own first move judged as the game's tactics judge it (a win now,
a loss now, or the position after). Inside the squares Hard's tactics are each game's own (`ai.js`, with
`ctx.level === 'hard'` and `ctx.until`, the ms left): deeper, time-bounded search where there is a search
(Four in a Row, Hex, Hexapawn, Takeover, Flood, Seating, Districts, Shelves, Roads, Standoff Grid), expected-value
decisions in the luck and decision games (Risky Rolls, Blackjack, Roulette, Peg Drop and the rest), and
sharper inference in the hidden-information games. A Hard decision keeps to about 300 ms: on the page it
runs in a web worker (`src/ui/ai.worker.js`, `src/ui/think.js`) while the computer "thinks", so the page
never stalls (the physics games' shots are worked out on the page first and handed over; Super Chaos's
computer, which the engine runs itself at the round's start, keeps to the same budget on the page's
thread); on the server, in Node, the same budget. Hard's strategy weights (line value, defence priority,
risk appetite, the playouts' exploring and progress chance, the playouts per candidate) are tuned by
self-play with `npm run tune-ai` (`scripts/tune-ai.js`: hill climbing over thousands of computer-against-
computer matches on every core, a change kept only when it wins clearly more; `--save` writes them to
`config/ai`, read by the game at start and the server every 20 s and shown on the admin's Bot Settings
page, where they can be reset; it is never run on its own) and apply to Hard only: Normal and Easy play
the code's own numbers whatever is saved. `npm run sim -- levels` plays Hard against Normal (and Easy
against Normal) over whole matches and prints the win rates (LEVELS_N=500 for the full run).

Whose move it is shows on the main board at a glance (`src/ui/board.js`, `waitBand`): while the computer or
the other phone is on the move (in Super Chaos, once this side's move is in and the other's is not), the
board dims a little and a translucent band across its middle shows the other side's character bouncing
gently, "[name] is playing…" ("Waiting for [name]…" in Super Chaos) and the turn's countdown where there is
one; on one's own turn the board is at full brightness. The band
lies over the board (nothing moves), never over the top bar or Menu, lets taps through, and fades in and out;
it stays through the computer's chosen square lighting up unless that square lies under it.

The computer takes its turn in the open: a short pause to think, then the square it chose lights up
on the main board for about a second (a pulsing glow in its colour and a "Computer plays here" label),
then it zooms into that square, makes its move with the usual animation (its chosen cards, coins or
word are shown first), and the board returns. Opening the menu holds it wherever it is.

### Opponent replays

Every opponent move, the computer's or the other phone's, is shown through one replay system
(`src/core/replay.js`, `src/ui/replay.js`). A move carries a compact log: its inputs with their timings
(`[[ms, control, value], ...]`, at most 48 of them, a pause between two cut to 1.5 s), recorded on the
mover's phone from the page's own taps and typing, or for a run, an attempt or a physics shot the
run's own log or the recording the move already holds. Online the log rides the move (the record's
entry, or the Find Match call); the computer's moves get one too (its typed letters, its pegs, its
pull and so on, made up from the move). On the other side the replay plays deterministically through
the game's normal view: the square as the mover found it, their controls pressed and typed in turn
(the pressed control is marked, with its own sound), then the move itself with its usual animation
and result. Replays run at normal speed; a **Skip** button comes up two seconds in and jumps to the
result. Every replay plays through to the end of the move (every animation of it finished: a game's
`flashMs` covers them all) and then holds the final state, the score updated, for about a second before
it closes; the Super Chaos pop-up too (at 2x, its animations at that rate, the last step's result held
a full second). A game whose view already plays the mover's screen from the move (a run, a pinball ball, an
Echo pattern, a dart throw, a Trivia reveal) is listed as `OWN` in `src/ui/replay.js`, and one that
keeps a draft (Five Letters' letters, Codebreaker's pegs, Roulette's chips, Find the Pair's cards, Bowling's two
taps, the golf and pool pull) adds `replay` hooks (`input`, `synth`) in its `view.js`. Not everything
can be replayed in full: Headcount's digit typing, Snapshot's cell taps and Cup Pong's flick leave no
log of their own (the reveal, the grid and the throw play from the move instead), pauses longer than
1.5 s are shortened, and a log keeps only its last 48 inputs.

It plays fairly. Every decision starts from a public view of each mini-game that leaves out the hidden
word, number, ship, treasure, face-down cards and the dice or coins still to come: it knows exactly
what a person looking at the screen knows.

Each turn it scores the best move in every open square as *the square's value on the main board*
times *how much the move shifts the chance of claiming that square*, and plays the highest. A square
that wins the match is taken at once; one the opponent is about to win is worth defending, by
blocking in interactive games or racing in the luck games; squares on lines still open for the
computer, or open for the opponent, come next; squares on no open line are worth almost nothing,
beyond a little. The chance of claiming a square comes from how many moves
each side still needs there, with the odds built in for the luck games; a guess in a shared-clue game
(Five Letters, Hangman, Higher/lower, Sea Battle, Treasure hunt, Find the Pair, Codebreaker) counts for less because the clue
helps the other player too.

Inside a square: Tic-tac-toe plays full minimax; Four in a Row searches five moves ahead with alpha-beta
and a threat count; Hex spots wins and blocks through shortest-connection distances, one reply ahead;
Sea Battle fires where the ship can still fit given every hit and miss (around a hit once there is
one), and between equals at the cell most likely to sink it, and after a hit keeps firing on its bonus
shots; Treasure hunt digs only cells consistent with every band clue (hot, warm, cool, cold), the one
that best narrows the candidates; Higher/lower guesses the midpoint; Five Letters keeps the words consistent
with all feedback and guesses the one that splits them best; Codebreaker keeps the list of codes
consistent with every guess so far and plays the guess (any of the 360 codes) whose worst-case
answer leaves the fewest, which cracks any code in at most 5 guesses; Hangman takes the letter most common in
the words still consistent with the pattern; Find the Pair remembers every card shown and flips a known
pair, else unseen cards; Coin flip reads its exact chances from the marked coins (and the small
chance of handing the square over when none of its own are left); Snakes and Ladders works out the
expected rolls to the top with the ladders and snakes in; Bump and the races count the moves left;
Blackjack plays standard basic strategy for hit and stand (no doubling; a dealer who stands on soft 17, no
splits);
Ride the Bus picks the guess most likely right given its kept cards and the cards left in its deck;
Roulette bets a group, now and then green 0 instead: when the opponent is one hit from a square that
matters (one that would win them the match or block a line of its own), or when well behind; Risky Rolls keeps rolling while the bust risk
is acceptable and banks around 8 to 10, bolder when behind and safer when ahead, always when the bank
would reach 21. In an older match, a Hexapawn square still gets full minimax (the only win is the
far row; a position where neither side can move resets the square), weighed on the board by how close
each side's leading pawn is to the far row.

## Deploying

Two environments, each its own Firebase project with its own data:

| | Address | Branch | Firebase project |
|---|---|---|---|
| Staging | https://staging.tictacchaos.com | `staging` | `.firebaserc` alias `staging` |
| Production | https://tictacchaos.com (www redirects to it) | `main` | `tic-tac-chaos` |

The old address, https://jaredmk.github.io/Tiger-tac-toe/, redirects to tictacchaos.com (`pages.yml`,
`.github/pages-redirect/`). The page picks its project by its address (`src/env.js`): only the production
hostnames get production; every other address, localhost included, gets staging.

Work goes to staging:

```sh
npm run deploy:staging -- "what changed"
```

It commits everything and pushes the `staging` branch. The Deploy workflow (`.github/workflows/deploy.yml`)
runs the unit tests and the server tests on the Firebase Emulator Suite and, only if they pass, deploys
what changed since staging's last good deploy: the site (Firebase Hosting; `scripts/build-site.js`
builds `_site/`), the functions, the rules (production's, gated to the allowlist,
`scripts/staging-rules.js`). Then it checks the live site, functions and rules (`scripts/smoke-live.js`)
and seeds staging's accounts (`scripts/seed-staging.js`).

Production takes only what staging has, when you release it:

```sh
npm run release
```

From a clean checkout at staging's tip, it runs the tests, checks that staging's deploy of that commit
passed, lists the commits going out and asks you to type `release`. It then fast-forwards `main` to
`staging`, and the Deploy workflow deploys that commit to production. A push to `main` with a commit
staging lacks is refused, a run started by hand never deploys production, and production's
`FIREBASE_SERVICE_ACCOUNT` lives in the GitHub environment `production`, open to the `main` branch only.
`npm run check:envs` shows what is live where. `DEPLOY_REMOTE` picks another remote than `origin`.

Staging is for testers only: it is noindex, shows a STAGING badge, and lets in only accounts on the
allowlist (the admin page's Staging Access; the server checks it and its rules and calls refuse anyone
else). Its test accounts are `tester1@tictacchaos.com` to `tester3@tictacchaos.com`, with the password in
the `staging` environment's `STAGING_TEST_PASSWORD` secret; the admin account is the
`STAGING_ADMIN_EMAIL` and `STAGING_ADMIN_USERNAME` variables.

## Game stats and the admin dashboard

Every match in every mode is counted, anonymously: two players on one phone, against the computer,
computer against computer (before it was taken out), friend code and Find Match (casual and ranked
before it was one queue). Snakes and Ladders and Bump are counted like every mini-game; the Dice race
and Hexapawn keep their own rows, marked "(old)", for the matches they were played in.
Phones report their local matches to the
`track` Cloud Function (a guest's with a random id the browser made up, never a name); the server
counts online matches itself, where it runs or saves them. Nobody can write the stats directly, and
only the admin can read them. Stats start from the first deploy with this feature (older matches were
never counted).

Per mini-game, counting only completed squares (those that ended claimed by X or O; a square still
open when the match ended, by any route, and a board reset after a draw are left out, and the note
under the table says how many): completed, average moves the winner made in it, the loser, and in
total (the two together); X and O win rates; then the same for Super Chaos in columns of its own (SC
completed, average winner moves, average total moves: every Super Chaos square, against the computer
and in friend rooms, is counted under `mini/chaos`, so the mode picker covers normal matches only).
Squares of abandoned matches (resigned, lost on time, never finished) are not counted at all (from
21 Oct 2026; before that, resigned matches' squares counted, and friend-room Super Chaos squares counted
under Friend code). An **All mini-games** row on top combines every completed
square. The stored counters keep claimed squares apart from draws and open ones, so the table is
worked out from them for past matches too.
"Moves" are the turns a side spent in that square (a Risky Rolls roll or a Hangman letter that earns another go
is part of the same turn). Overall: logins and active players per day, week and month (UTC; a login is
an account signing in or coming back to the game); new accounts; matches started and finished by mode;
finished (played to a result) and abandoned (resigned, lost on time or never finished, each counted)
per mode; average match length in turns and minutes over finished matches only (`modes/{mode}/done`,
`doneTurns`, `doneMs`, `doneTimed`, from 21 Oct 2026); how often X, who moves first, wins.

The dashboard is https://tictacchaos.com/admin.html (staging's: https://staging.tictacchaos.com/admin.html). It opens on a menu of section tiles,
each its own page with a back button (the address keeps the page: `#overview`, `#players`, `#playtest`,
`#matches`, `#settings`, `#settings/<game>`, `#bots`, `#releases`, `#stats`): **Overview** (the headline
numbers and the players and matches charts), **Players & Accounts** (Accounts, usernames to review, players
over time), **Playtesters & Devices**, **Matches** (the match inspector), **Mini-game Settings** (below),
**Bot Settings** (Find Match on/off, the bots, the empty-queue alert), **Releases** and **Stats** (Matches by
mode, the mini-game table). What is on them: the **Find Match** on/off switch
(see "Switching Find Match on and off"), the **Bots** and **Empty-queue alerts** controls (see
"Matchmaking backfill and the empty-queue alert"), tables and charts, with the
mini-game table sortable (by average winner moves to find games that are too fast or too slow), the
**Runner tuning** card (Dash, Lane Rush, Flap and Chopper: the target distance, starting speed, speed ramp, obstacle
spacing and mix, and Chopper's cave height at the start and the finish, saved to `config/run` and applied to squares dealt from then on; with the tracker:
runs to finish, average distance per run, and where the crashes cluster, every 50 m), the **Bullseye tuning** card (the board's size, the bullseye's, the sweep speed and the speed-up per scoring throw, saved to `config/bulls`), the **Peg Drop tuning** card (the target, saved to `config/plinko`), the **Risky Rolls tuning** card (the die, 6 or 8 sides, and the target score, saved to `config/pig`), the **Roads tuning** card (the honeycomb of 7 hexagons or the smaller one of 4, saved to `config/roads`), the **Odd One Out tuning** card (the shade difference at each level, saved to `config/oddone`), the **Headcount**, **Flash** and **Snapshot tuning** cards (each level's difficulty: how many creatures and decoys and how fast they cross, the cards per round and the time per card, the grid sizes, cells filled, seconds on show and the countdown; saved to `config/headcount`, `config/flash` and `config/snapshot`), the **Sky Hop**, **Scoop Stack** and **Pinball tuning** cards (every difficulty value of the finger games, saved to `config/skyhop`, `config/scoop` and `config/pinball`, aimed at about 3 to 6 attempts to win for an average player), the **Risk Wheels tuning** card (the target and the ranges each square's wheels are drawn from, saved to `config/wheels`) and
filterable by mode, the **Accounts** and **Playtest activity** cards (below), and the "Usernames to review" card (existing names the word list would refuse
today, with the word that caught each; nothing is changed). It opens only for the account with the admin flag; the database rules refuse the
stats to everyone else.

### Accounts

Every account with a username (not the bots): username, sign-up date, last active, games played and
record (W-L-D, with the win rate), Find Match, friends and local games together (hover a record for
the split). Sortable by any column; newest sign-ups first. Last active is the last time the account
played, logged in or opened the game (`lastSeen/{uid}`, written by the server). Dates and times are
New York time. Tapping an account opens its **player detail** under the table, with an **Online / Local / All**
selector: the record and win rate, the **Played as** table (games played as X and as O, the record and the
win rate of each) and the **Mini-games** table (squares won, squares lost and win rate per mini-game, most
won first, with an **All mini-games** row on top). It counts a square only once it ended claimed by X or O,
and lists only the games in the pool (Hexapawn's and the Dice race's numbers stay in the database). Players
don't see these two tables: they are the admin's. The numbers come from `users/{uid}` (Find Match at the
top, friend games under `friend`) and `localStats/{uid}`, added up by `src/ui/pstats.js`, which the
profile uses for its record too.

### Playtest activity (no account needed)

Every device gets a random anonymous id, made up by its browser and kept in its own storage
(`localStorage`, read and written inside try/catch; with no storage, an id for that visit only).
Nothing personal is ever collected: the server keeps a one-way hash of the id, the times of the
device's app opens and matches (started, then finished or left, with the mode), and an optional
**tester tag**. To tell playtesters apart, send each one their own link with `?t=` and a name, for
example `https://tictacchaos.com/?t=sam` (letters, numbers, `-` and `_`, up to 24,
lower case). The tag is saved with that device the first time it is seen and never replaced (a later
link with another tag keeps the first), and taken out of the address bar. The phone sends each event
to the `devlog` Cloud Function; a retry or a reload never counts twice.

The card (with a filter by tester) shows, in New York time (America/New_York, summer time included):
**activity by hour** for the last 7 days (games started, games finished, active devices); the
**funnel** opened the app → started a game → finished a game → started another; **retention**, the
share of devices first seen before today that came back the next day and within 7 days; a
**devices** table (shortened anonymous id, tester tag, first and last seen, sessions, games, average
games per session, came back on a later day), where tapping a device opens its timeline of sessions
and games; and **sessions** (a new one starts after 30 minutes with nothing): games played, the most
finished in a row, length, modes, and whether it ended mid-match (left, or unfinished). Finished
means played to a result; left means this device quit (resigned or left the match). The numbers are
worked out in `playtest.js`, which the dashboard loads.

### Making yourself the admin (once)

1. Log in to the game with the account you want (Google or email) and pick its username, if you have
   not yet.
2. On GitHub, open the `Tiger-tac-toe` repository, then **Actions**, then **Make admin (stats
   dashboard)** in the list on the left.
3. Click **Run workflow**, type that username, leave the action on **grant**, and click the green
   **Run workflow** button. It takes about a minute; a green tick means done.
4. Open admin.html and log in with the same account.

The same workflow with **revoke** takes the flag away. Under the hood it runs `scripts/make-admin.js`,
which sets the `admin` custom claim on that account with the `FIREBASE_SERVICE_ACCOUNT` key; you can
also run it yourself (`node scripts/make-admin.js <username>`, with `GOOGLE_APPLICATION_CREDENTIALS`
pointing at a key). The username you type shows in the workflow's log, which is public for a public
repository; usernames are public anyway (records and profiles).

## Match logs and the match inspector (for debugging)

Every online match (Find Match, a friend room, Super Chaos in a friend room) and every Super Chaos match
against the computer keeps a compact, timestamped log of what happened: the start (mode, players, the
squares dealt), each round's start and result, each move accepted or refused and why, timeouts, a phone
dropping off and coming back (presence), the phones' errors, each phone's app version (the deploy stamps the
commit into `src/ui/config.js` `APP_VERSION`) and its anonymous device id (the device log's hash,
shortened). The server writes what it sees itself: every online match's moves and refusals (`changeGame`,
`changeSc`: Find Match's and a friend room's alike), presence (`gamePresenceLog`). The phones send the rest through the device log (`devlog`): `error` (with its match),
`mlog` (only the phone knows it: a match against the computer's rounds and timeouts, a move the server
refused; kept for the match's log only) and `report`. Stored in `matchLogs/{key}` (events) and
`matchLogIndex/{key}` (the summary: mode, players, started, last, events, versions, devices, reported, note),
the admin alone may read them and nobody writes them but the server; capped at 3,000 events a match, and
deleted by the sweep 30 days after a match's last event. Keys: `m{game}` (every online match, Find Match's and a
friend room's), `l{id}` (a match on one phone). Rules: `functions/matchLogRules.js`; tests:
`tests/server/match-log.test.js`, and the server's in `tests/emulator/server.test.js`.

The admin dashboard's **Match inspector** lists the logged matches, reported ones first, filtered by player
(name, uid, device or room), mode or dates; a match's row opens its event timeline, and **Export** downloads
its log as JSON. In a match, the in-game menu's **Report a problem** takes an optional note (up to 140
characters), flags the match and stamps the moment in its log (`src/ui/report.js`).

## Tests

The rules of the game live in `src/core` (the main board, turns, the timer, randomness, win and draw)
and `src/games/<game>/` (each mini-game's rules, AI and meta): pure and deterministic (no clock, no
`Math.random`; every random choice comes from an rng passed in, `makeRng(seed)` for a seeded one),
imported by the page and required by the Cloud Functions (`src/core/engine.js` gathers them as one
namespace, E). The unit tests are filed by what they cover:

- `tests/games/<game>.test.js`: one mini-game's rules and AI;
- `tests/shared/<family>.test.js`: what a family of games shares (the runners, the attention games,
  the finger games, the physics games, the card games, the race tracks);
- `tests/core/`: setup, turns, the main board, the computer, timeouts, online records, release control,
  the admin page's copies of the engine's lists;
- `tests/server/`: the server's own rules (usernames and the word list, Elo, matchmaking, records),
  the stats, the bots and the alert's limits, the playtest numbers;
- `tests/page.test.js`: the page's modules link (every import exists) and keep their one-name rules.

They run in about ten seconds:

```sh
npm install
npm test
```

The slow simulations (the computer against itself over whole matches, balance and first-mover runs,
thousands of dealt boards) are in `tests/sim/` and run only when asked, one at a time or all:

```sh
npm run sim                 # the list
npm run sim -- districts    # one (a game, a family, or matches)
npm run sim -- all
```

`tests/emulator/server.test.js` runs the server on the Firebase Emulator Suite (Auth, Realtime Database,
Functions; it needs Java): usernames, the security rules refusing direct writes to ratings, records,
history and games, two (and six) players searching at once each paired exactly once in one queue
by wait time, every Find Match game at 1 minute a turn, a full match with hidden values unreadable
and illegal or out-of-turn moves refused, Find the Pair's two-step move, timeouts with both players away
played out by the sweep, resigning, no ratings or leaderboard entries while ratings are off, records
and mini-game counts after Find Match and friend games (credited by the seats the match was played
in), a friend match left under way recorded as a loss for the one who left, local matches recorded
once and privately (bad reports refused), the check of existing usernames running once and listing
them for the admin only, the bots (only for a lone searcher once their wait is over, an
ordinary-looking online account, thinking before each move, Find the Pair's two cards, never timing out,
the result recorded with the records switch, counted apart), the empty-queue alert (once per search,
the cooldown, the gap, the daily cap, never for the admin, before the bot) and its test, the back-fills from history running once (records; games by side and last activity), games by side after every kind of match, the playtest log (each event once, the first tester tag kept, nothing personal, the admin only), last activity, and the game stats (local matches reported by a
phone counted once and bad reports refused, logins and new accounts, Find Match and friend-code
matches counted by the server, and the stats readable only by the admin, with `make-admin.js` giving
and taking back the flag). The emulator tests:

```sh
npm install && npm install --prefix functions
npm run test:emulators
```

