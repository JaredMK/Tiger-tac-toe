# Tic Tac Chaos

Play it: https://jaredmk.github.io/Tiger-tac-toe/

A two-player, pass-and-play game for one phone, against the computer, or online, drawn in a
1930s rubber-hose cartoon style: thick wobbly ink lines, flat colours on cream paper, an X and an O
with faces, and a squash-and-stretch stamp with comic-book bursts when a square is won. The
fonts (Luckiest Guy, Patrick Hand) are embedded, so the look survives offline. The whole game is
`index.html`: inline CSS and JS, no build step; the local modes work offline. Online play uses a
Firebase Realtime Database (see "Setting up Firebase").

Open `index.html` in a browser (or serve the folder with any static server) and play.

A main menu comes first: "Play Local" or "Play Online". Play Local opens one setup screen with two
player slots, X and O; each is Human or Computer and has a name (a human slot defaults to "X" or "O",
a computer slot to "Computer" and shows a little computer above it). Any pairing works: two people
passing one phone, a person against the computer on either side, or the computer against itself
while you watch. X moves first. Under "Advanced" are the mini-games in the mix (all on by default, at
least one must stay on), with a "Select all" button at the top. Ticking a game or Select all changes
the list in place: it stays exactly where it was scrolled, Advanced stays open, and the choice is
saved for the next match. Computer players carry the computer icon next to their name in the game: in
the turn indicator, on the square they are about to play, and in the results.

During a match a "Menu" button sits in the top corner: it pauses the game with "Resume" and
"Main menu"; the latter asks "Leave this match?" and, on Yes, ends the match and returns to the main
menu. Nothing moves while the menu is open, the computer included (so it also pauses a computer
against computer match). When a square is won, the owner's mark squashes in with two comic-book
bursts, once: first on the result card, then around the square on the board. Each burst's word is
picked at random from POW!, BAM!, CHAOS!, BOOM!, KAPOW!, WHAM!, ZAP!, SMASH!, CRUNCH!, YOINK!,
SNATCHED!, MINE!, CLAIMED!, GOTCHA!, KABLAM! and BOP!, never one shown the time before. A burst pops
in, stays about a second and pops out; it never stays on screen (with reduced motion it does not
animate, and still goes after a second).

Every screen outside a match (Play Local, Play Online, Host game, Join game and its waiting screen)
has its back button in the top-left corner, in the same style as the Board button inside a
mini-game, and it goes back one screen.

The results screen shows a message picked at random for the match: a win message for a person who
beat the computer, a loss message when the computer won, the winner's name with a win message when
two people played on one phone or the computer played itself, and online each phone shows its own
player's win or loss. (The tie messages are there for a drawn match, which the current rules cannot
produce: nine squares always give someone three in a row or the majority.) "View board" shows the
final main board; every square, claimed or not, opens read-only with everything hidden revealed, and
a button returns to the results with "Rematch" (the same settings and opponent again) and "Main menu".

## Rules

- The main board is a 3×3 tic-tac-toe grid. Every square holds its own mini-game.
- To claim a square, win the mini-game inside it. Three claimed squares in a row wins the match.
- X and O alternate. A turn is exactly one move in one unclaimed mini-game of your choice.
- Every move animates and its result stays on screen for about a second, with input locked. Then the
  board comes back on its own and the turn passes to the other player.
- All mini-games run in parallel and persist between turns. There is no alternation inside a
  mini-game: you may move in the same mini-game on consecutive turns of yours, so piece counts
  can be lopsided.
- If a mini-game ends with no winner (full board), that square resets with a newly randomised mini-game.
- If neither player has a legal move in a mini-game, that square resets the same way. A player who has
  no legal move in one square simply plays another; a player with no legal move anywhere is skipped.
- If the main board fills with no three in a row, the player with more squares wins.
- Claimed squares stay on view: the board shows the owner's mark over the mini-game's final state, and
  tapping one opens that final state read-only with a "Won by" banner and every secret revealed (the
  Wordle and Hangman words, the Higher/lower number, the Battleship cell, all Memory cards). Looking
  never costs a turn.

Each square is assigned one of these at random when the match starts (duplicates are fine):

| Mini-game | How to win |
| --- | --- |
| Tic-tac-toe | 3×3, three in a row |
| Connect 4 | The standard 7 columns × 6 rows, pieces drop to the lowest open cell, four in a row in any direction |
| Battleship | 3×3, one hidden cell chosen by the computer; whoever reveals it wins, misses stay marked |
| Wordle | One hidden common 5-letter word shared by both players; a move is a guess with green/yellow/grey feedback, no guess limit. Guesses must be real words (checked against an embedded list of about 15,000); a non-word shows "Not a word" and does not use the turn |
| Hangman | Hidden 5–7 letter word; guess a letter. A right letter is revealed and you guess again at once; a wrong letter ends your turn. Revealing the last letter wins. The miniature on the board shows the wrong letters themselves, crossed out in red as in the full view, wrapping onto more lines as they add up |
| Hex | 4×4 hex grid; X connects left to right, O connects top to bottom |
| Higher/lower | The computer picks 1–20; each guess is answered higher or lower. Guessing it wins |
| Dice race | A winding path of 15 numbered spaces and a Finish. Roll a die and your piece hops that many spaces; reaching or passing the Finish wins |
| Memory | 3×3 face-down cards with exactly one matching pair; a move flips two cards for 2 seconds. Flipping the pair wins |
| Candy race | A winding path of 12 randomly coloured spaces (any three in a row are all different colours) from Start to a Finish shown in all four colours; a spin of the colour wheel hops your token to the next space of that colour. No such space ahead means you reach the Finish and win |
| Coin flip | Six coins showing X or O, three of each to start. Flip turns up to 3 of the other side's coins (all of them if they have 3 or fewer, otherwise 3 picked at random); each lands X or O at random. All six the same wins for that symbol's player |
| Pig | Each player has a banked score. A move is a whole push-your-luck turn: roll a die, and a number not yet rolled this turn joins the pot; then roll again or bank. Banking adds the pot to your score and ends the move; a repeated number busts, losing the pot (at most six rolls). First to a banked 20 wins |
| Treasure hunt | 5×5 grid with one hidden treasure. A move digs a cell: the treasure wins, otherwise the cell shows its distance to the treasure in steps up, down, left or right, coloured hot to cold. Everything dug stays visible |
| Hexapawn | 3 columns × 4 rows; each side has 3 pawns on its home row (X on the bottom, O on the top). A move is one pawn stepping one square straight forward into an empty square, or capturing an opposing pawn one square diagonally forward. Tap a pawn to see its moves; the pawn slides over and a captured pawn is knocked off the board. You win the square by moving a pawn onto the other side's home row, or by making a move after which the other side has no legal move there (capturing all their pawns included). A player with no move in this square just plays elsewhere: they only lose it when the other side moves and leaves them stuck |
| Mastermind | One hidden code shared by both players: 4 pegs from 6 colours, no colour twice, picked by the computer. A move is one guess of 4 different colours (tap a slot, then a colour; tap a filled slot to clear it). Feedback is a solid marker for each right colour in the right spot and a hollow marker for each right colour in the wrong spot, always solid first, so the order says nothing about which peg is which. Every guess and its markers stay on show, no guess limit; guessing the exact code wins. Each colour also carries a symbol (circle, square, triangle, diamond, star, plus) |

Hidden information (the Wordle and Hangman words, the Higher/lower number, the Memory cards, the
Battleship cell, the Mastermind code) is never shown on the board or in a mini-game before it is revealed.

## Playing online

"Play Online" offers "Host game" and "Join game". The host gets a five-letter room code (no look-alike
letters) and a Share button that sends a link to the game with the code filled in; "Waiting for
friend…" shows until the guest joins. The guest enters a name and the code, or opens the shared link.
The host picks a side, the mini-games and the time per turn, and starts once the guest is in; both
phones then show the same board.

Backing out of a lobby leaves it cleanly. The host's Back closes the room: it is deleted from the
database with its presence entries, the code stops working, a guest already in it is sent to the main
menu with "The room was closed.", and the host returns to Play Online. The guest's Back gives up the
seat, so the host's room stays open (it shows "Waiting for friend…" again), and returns to the join
form with the name and code still filled in. A room still being opened, or a seat still being taken,
when Back is tapped is let go as soon as the database answers.

Only the player on the move can act; the other can still open squares to look, and sees "Waiting
for [name]…". Each player's moves play on the other phone the way computer moves do: the chosen
square glows on the main board for about a second with a "[name] plays here" label, then a zoom into
the square, the animation, a short hold, back to the board, Pig rolls one by one (a follow-up move in
a square you are already looking at plays right there). "Rematch" on the win screen, from either
player, starts again in the same room with the same settings. Leaving through the menu tells the
other player ("[name] left the match") and sends them back to the main menu too.

Leaving the app does not end a match. Lock the phone, answer a call, switch apps: the other player
sees "[name] is away", the match waits (or the clock runs, if one is set), and when you come back,
or open the page or the link again, you are back in your seat and every move you missed plays back
with the usual highlight-and-animate sequence, in order.

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
- Hidden values (the Wordle and Hangman words, the Higher/lower number, the Memory cards, the
  Battleship cell, the treasure, the Mastermind code) are generated when the match starts and kept in a separate node of
  the room, `match/secrets`; the state the phones render never contains them before they are
  revealed.
- The record keeps the last few moves, so a phone that was away plays back what it missed. Presence
  is tracked with `onDisconnect` and the page's visibility: "[name] is away" shows while the other
  player is out of the app or offline.
- The turn deadline is stored in server time and both phones use the server clock offset, so the
  countdown is the same on both screens. When it passes, either phone applies the random timeout
  move in a transaction, so it happens exactly once. The clock keeps running while a player is away;
  that is the point of the clock.
- Rooms older than 24 hours are deleted whenever a new room is created.

### Time per turn

The host's lobby offers a time per turn: 30s, 1 min, 3 min, or No limit (the default). The guest sees
the setting in the lobby. With a limit on, a countdown shows in the header on both phones; it starts
when a turn begins (once the previous move has finished playing), turns red and pulses in the last ten
seconds, and keeps running while the in-game menu is open or while a player is away.

When the clock runs out, a random legal move is made for that player and shown on both screens with
"[name] ran out of time — random move": a random open square, then a random legal action in it (Pig:
one roll, then a bank if it did not bust; Hangman: one random letter, and the turn ends even if it
hits; Wordle: a random dictionary word). The turn then passes. Timeouts are counted per player, and
a player's second timeout in a row loses the match at once: the win screen reads "[name] wins —
[other] timed out twice".

### Setting up Firebase

Online play needs a Firebase project. The free Spark plan is enough; nothing here needs billing or
Cloud Functions. Once, from a computer:

1. Go to https://console.firebase.google.com and sign in with a Google account. Click **Create a
   project** (or **Add project**), name it (for example `tiger-tac-toe`), and continue. Google
   Analytics is not needed: turn it off when asked. Wait for the project to be ready and click
   **Continue**.
2. In the left menu open **Build → Realtime Database** and click **Create Database**. Pick the
   location closest to you and choose **Start in locked mode**, then **Enable**.
3. Still in Realtime Database, open the **Rules** tab, replace everything with the contents of
   `database.rules.json` from this repository, and click **Publish**. These rules let only signed-in
   users read, let only the two players of a room write to it (a free seat can be taken by a joiner),
   and let anyone delete a room older than a day.
4. Open **Build → Authentication**, click **Get started**, then under **Sign-in method** choose
   **Anonymous**, switch **Enable** on and **Save**.
5. Open the project's settings (the gear next to **Project Overview** → **Project settings**). Under
   **Your apps** click the web icon (`</>`), give the app a nickname (for example `web`), leave
   Firebase Hosting unticked, and click **Register app**. The page shows a `firebaseConfig` object
   with `apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId` and
   `appId`. (If `databaseURL` is missing, it is shown on the Realtime Database page, in the form
   `https://<project>-default-rtdb.<region>.firebasedatabase.app`.)
6. Open `index.html`, find `const FIREBASE_CONFIG = {` near the start of the online-play section, and
   replace the `PASTE_…` values with `apiKey`, `authDomain`, `databaseURL`, `projectId` and `appId`
   from that object (the other two fields are not needed). Then run `./deploy.sh "Add the Firebase
   config"`.

The config is not a secret: it identifies the project, and the database rules decide what anyone can
do with it. The Firebase SDK (about 300 KB) is fetched from Google's CDN only when online play is
chosen; local modes stay offline-capable.

## Playing against the computer

The computer takes its turn in the open: a short pause to think, then the square it chose lights up
on the main board for about a second (a pulsing glow in its colour and a "Computer plays here" label),
then it zooms into that square, makes its move with the usual animation (its chosen cards, coins or
word are shown first), and the board returns. Opening the menu holds it wherever it is.

It plays fairly. Every decision starts from a public view of each mini-game that leaves out the hidden
word, number, ship, treasure, face-down cards and the dice or coins still to come: it knows exactly
what a person looking at the screen knows.

Each turn it scores the best move in every open square as *the square's value on the main board*
times *how much the move shifts the chance of claiming that square*, and plays the highest. A square
that wins the match is taken at once; one the opponent is about to win is worth defending, by
blocking in interactive games or racing in the luck games; squares on lines still open for the
computer, or open for the opponent, come next; squares on no open line are worth almost nothing,
beyond a little towards the majority rule. The chance of claiming a square comes from how many moves
each side still needs there, with the odds built in for the luck games; a guess in a shared-clue game
(Wordle, Hangman, Higher/lower, Battleship, Treasure hunt, Memory, Mastermind) counts for less because the clue
helps the other player too.

Inside a square: Tic-tac-toe and Hexapawn play full minimax; Connect 4 searches five moves ahead with alpha-beta
and a threat count; Hex spots wins and blocks through shortest-connection distances, one reply ahead;
Battleship takes any unrevealed cell; Treasure hunt digs only cells consistent with every clue, the
one that best narrows the rest; Higher/lower guesses the midpoint; Wordle keeps the words consistent
with all feedback and guesses the one that splits them best; Mastermind keeps the list of codes
consistent with every guess so far and plays the guess (any of the 360 codes) whose worst-case
answer leaves the fewest, which cracks any code in at most 5 guesses; Hangman takes the letter most common in
the words still consistent with the pattern; Memory remembers every card shown and flips a known
pair, else unseen cards; Coin flip flips the most coins allowed; Pig keeps rolling while the bust risk
is acceptable and banks around 8 to 10, bolder when behind and safer when ahead, always when the bank
would reach 20. On the board, a Hexapawn square is weighed by how close each side's leading pawn is to
the far row (one move away when a win is on), since nobody has to move in a square and minimax lines
that rely on the other side being forced to move do not apply there.

## Deploying

The game is served by GitHub Pages from the `main` branch of the `Tiger-tac-toe` repository, root
folder, at https://jaredmk.github.io/Tiger-tac-toe/. After a change, publish it with one command:

```sh
./deploy.sh "what changed"
```

It commits everything, pushes `main`, and the site updates within a minute or so.

First-time setup: create an empty public repository called `Tiger-tac-toe` on GitHub, then push
`main` to it. The workflow in `.github/workflows/pages.yml` switches Pages on and publishes the site
on that first push, and again after every later push to `main` (which is what `deploy.sh` does).

```sh
git checkout -B main
git remote add origin https://github.com/JaredMK/Tiger-tac-toe.git
git push -u origin main
```

## Tests

The game logic lives in the `<script id="logic">` block of `index.html` and is covered by
`test/logic.test.js` (the online match records: secrets kept apart from the public state, moves and
timeouts applied as transactions would apply them, picks, rematches; every mini-game's win and draw logic including Hex path-finding and
lopsided-move cases, the Hangman bonus guess, draw resets, the return to the board after each move,
main-board three-in-a-row and majority wins, random full matches, and the computer player: legal
moves only, decisions that cannot see hidden information, match-winning squares taken and defended,
each game's tactics, and computer-versus-computer matches that finish; and the turn clock: a legal
random move in every mini-game on a timeout, the Pig roll-then-bank, no bonus move for a lucky
Hangman letter, timeouts counted per player and the second in a row losing the match). It uses Node's
built-in test runner:

```sh
node --test
```
