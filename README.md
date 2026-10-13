# Tic Tac Chaos

Play it: https://jaredmk.github.io/Tiger-tac-toe/

A two-player, pass-and-play game for one phone, against the computer, or online, drawn in a
1930s rubber-hose cartoon style: thick wobbly ink lines, flat colours on cream paper, an X and an O
with faces, and a squash-and-stretch stamp with comic-book bursts when a square is won. The
fonts (Luckiest Guy, Patrick Hand) are embedded, so the look survives offline. The game is
`index.html` (inline CSS and the UI) plus `engine.js` (every rule of the game, shared with the
server); no build step, and the local modes work offline. Online play uses Firebase: the Realtime
Database, Authentication, and Cloud Functions for accounts, matchmaking, records and history (see
"Setting up Firebase").

Open `index.html` in a browser (or serve the folder with any static server) and play.

A main menu comes first: "Play Local" or "Play Online". Play Local opens one setup screen with two
player slots. Player 1 is always a person: a name and a side, X, O or Random. Player 2 is Human or
Computer and gets the other side (a computer slot shows a little computer above it). A blank name is
the side's letter, and the computer's is "Computer". So it is two people passing one phone, or a
person against the computer on either side; the computer no longer plays itself. X moves first.
A rematch keeps the choice: X or O stay, and Random is drawn again for every match. Under "Advanced"
are the mini-games in the mix (all on by default, at
least one must stay on), with a "Select all" button at the top. Ticking a game or Select all changes
the list in place: it stays exactly where it was scrolled, Advanced stays open, and the choice is
saved for the next match. Computer players carry the computer icon next to their name in the game: in
the turn indicator, on the square they are about to play, and in the results.

During a match a "Menu" button sits in the top corner: it pauses the game with "Resume" and
"Main menu"; the latter asks "Leave this match?" and, on Yes, ends the match and returns to the main
menu. Nothing moves while the menu is open, the computer included. When a square is won, the owner's
mark squashes in with two comic-book bursts, once: first on the result card (just the bursts and the
winner's character, no words), then around the square on the board. Each burst's word is
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
  Wordle and Hangman words, the Higher/lower number, the Battleship ship, all Memory cards). Looking
  never costs a turn.
- Every mini-game has a "?" in the top-right corner of its full view: a short card with how to play
  and how to win. It never uses a turn, and a tap anywhere closes it; it covers the whole screen, so
  nothing underneath takes that tap, and going to another screen closes it too. The same "?" sits on each game in the
  Advanced checklist, and "How to Play" on the main menu shows the core rules with the list of
  mini-games, each opening its card.

Each square is assigned one of these at random when the match starts (duplicates are fine):

| Mini-game | How to win |
| --- | --- |
| Tic-tac-toe | 3×3, three in a row |
| Connect 4 | The standard 7 columns × 6 rows, pieces drop to the lowest open cell, four in a row in any direction |
| Battleship | 4×4 sea with one hidden ship shared by both players: 1 to 4 cells long (Patrol Boat, Destroyer, Submarine, Battleship), across or down, placed at random. Its name and a silhouette of its parts show under the grid. A move fires at one cell: a hit shows a burst, a miss a splash, and the ship's direction is never shown. Whoever hits its last part sinks it (the whole ship shows and goes under) and wins |
| Wordle | One hidden common 5-letter word shared by both players; a move is a guess with green/yellow/grey feedback, no guess limit. Guesses must be real words (checked against an embedded list of about 15,000); a non-word shows "Not a word" and does not use the turn |
| Hangman | Hidden 5–7 letter word; guess a letter. A right letter is revealed and you guess again at once; a wrong letter ends your turn. Revealing the last letter wins. The miniature on the board shows the wrong letters themselves, crossed out in red as in the full view, wrapping onto more lines as they add up |
| Hex | 4×4 hex grid; X connects left to right, O connects top to bottom |
| Higher/lower | The computer picks 1–20; each guess is answered higher or lower. Guessing it wins |
| Snakes and Ladders | 20 spaces in 4 rows of 5, numbered from the bottom; the path starts at the bottom left (both pieces wait on Start, before space 1) and winds upward with the race tracks' curved turns, space 20 at the top. Every board gets 2 ladders and 2 snakes placed at random: no two share an end, none starts on space 1 or touches space 20, none starts where another ends, each spans at least 3 spaces and crosses rows. A move rolls a die; the piece hops up space by space, then climbs the ladder or slides down the snake whose start it landed on. Reaching or passing space 20 wins. (It replaced the Dice race: an older match's Dice race square plays to the end, and its history and stats keep that name) |
| Memory | 3×3 face-down cards with exactly one matching pair; a move flips two cards for 2 seconds. Flipping the pair wins |
| Bump | A race track of 9 spaces and a Finish; both pieces start at Home, before space 1. A move spins a 1-2-3 spinner (equal odds) and the piece hops that far. Landing exactly on the other piece knocks it back Home. Reaching or passing the Finish wins |
| Candy race | A winding path of 12 randomly coloured spaces (any three in a row are all different colours) from Start to a Finish shown in all four colours; a spin of the colour wheel hops your token to the next space of that colour. No such space ahead means you reach the Finish and win |
| Coin flip | Five coins: two X, two O and one mystery coin (?) that belongs to nobody, in random places. Flip turns up to 3 coins that aren't yours, the other side's and the mystery coin (all of them if there are 3 or fewer, otherwise 3 picked at random). The coins are picked as each turn starts and ringed in the player's colour before Flip is tapped, and exactly those flip; skipping the square and coming back a later turn may show a new set. Each lands X or O at random, the mystery coin too. All five the same wins for that symbol's player (so with no coin of your own left, a flip can hand the square to the other side) |
| Pig | Each player has a banked score. A move is a whole push-your-luck turn: roll a die, and a number not yet rolled this turn joins the points at risk (a small +N by your score, with this turn's dice in a row); then roll again or bank. Banking moves them into your score and ends the move; a repeated number busts, losing them (at most six rolls). Once your score and the points at risk reach 21, only Bank is left. First to a banked 21 wins. A bust turns red only once the die has landed; after a winning bank the die keeps the last number rolled |
| Treasure hunt | 5×5 grid with one hidden treasure. A move digs a cell: the treasure wins, otherwise the cell shows its distance to the treasure in steps up, down, left or right, coloured hot to cold. Everything dug stays visible |
| Hexapawn | 3 columns × 4 rows; each side has 3 pawns on its home row (X on the bottom, O on the top). A move is one pawn stepping one square straight forward into an empty square, or capturing an opposing pawn one square diagonally forward. Tap a pawn to see its moves; the pawn slides over and a captured pawn is knocked off the board. You win the square by moving a pawn onto the other side's home row, or by making a move after which the other side has no legal move there (capturing all their pawns included). A player with no move in this square just plays elsewhere: they only lose it when the other side moves and leaves them stuck |
| Mastermind | One hidden code shared by both players: 4 pegs from 6 colours, no colour twice, picked by the computer. A move is one guess of 4 different colours (tap a slot, then a colour; tap a filled slot to clear it). Feedback is a solid marker for each right colour in the right spot and a hollow marker for each right colour in the wrong spot, always solid first, so the order says nothing about which peg is which. Every guess and its markers stay on show, no guess limit; guessing the exact code wins. Each colour also carries a symbol (circle, square, triangle, diamond, star, plus) |

Hidden information (the Wordle and Hangman words, the Higher/lower number, the Memory cards, the
Battleship ship, the Mastermind code) is never shown on the board or in a mini-game before it is revealed.

## Playing online

"Play Online" offers "Host game" and "Join game". The host gets a five-letter room code (no look-alike
letters) and a Share button that sends a link to the game with the code filled in; "Waiting for
friend…" shows until the guest joins. The guest enters a name and the code, or opens the shared link.
The host picks a side (X, O or Random), the mini-games and the time per turn, and starts once the
guest is in; both phones then show the same board. A rematch keeps the same choice: X or O stay as
picked, and with Random the sides are drawn again for every match, rematches included (the guest's
lobby says "sides drawn at random for every match"). Who played which side is stored with the match
itself, so the result is credited to the right players even when the next match swaps the seats.

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

The web config in `index.html` (`FIREBASE_CONFIG`) is not a secret: it identifies the project, and
the security rules decide what anyone can do with it. The Firebase SDK (about 400 KB) is fetched
from Google's CDN only when something online is used (or at start for a player who logged in
before); local modes stay offline-capable.

## Accounts, Find Match, records and history

**Logging in.** The main menu has **Log in** at the top right (with **My Stats** at the top left once
logged in).
A player logs in with Google or with an email and a password (**Create account** the first time,
**Forgot password?** emails a reset link). On first login they pick a username: 3 to 16 letters,
numbers or underscores, unique whatever the capitals, checked by a basic profanity filter, and
permanent. The menu then shows the username instead of Log in; tapping it (or **My Stats**) opens
the player's stats, which have **Log out**. Playing locally, against the computer or with a friend's
code needs no account (a friend game without one uses an anonymous session, as before).

**Find Match** (needs an account) pairs strangers in a single queue: every mini-game on and always
1 minute a turn, with no options to pick. The screen shows "Searching…" (X and O hopping on one
looping CSS animation, O half a hop behind by its delay) with the time waited and **Cancel**. The
server pairs players by how long they have waited, longest first. Sides are drawn at random. Two
players who search at the same moment are paired once: the queue is changed in one database
transaction. A player can be in only one matchmaking game at a time; with one in progress, Find
Match reads **Back to your match**. When a match starts, a vs card shows both usernames with their
records for about 3 seconds (or until tapped); the server's turn clock allows for it.

**The server runs these games.** A move goes to a Cloud Function, which checks that it is that
player's turn and that the move is legal with the same engine the page uses (`engine.js`), makes
every random choice itself (dice, coins, spins, cards, words, codes, timeout moves), applies the
move and writes the public state. The phones never write a matchmaking game; they read its public
state and play every move back exactly as in a friend game (the square lit up on the board, the
zoom, the animation), including the moves missed while away. Hidden values (words, numbers, codes,
cards, the treasure, the ship) are stored where no phone can read them, and appear in the public
state only when the game reveals them. The turn deadline is a server time. When it passes, either
phone asks the server for the timeout move and the server checks the deadline first; a scheduled
function does the same every minute for games nobody is watching. Two timeouts in a row lose the
match. Leaving a Find Match game through the menu is a resignation, which loses it ("Leaving
will count as a loss" in the confirmation).

**Records.** A player's record is wins-losses-draws (3-5-1). The main record counts Find Match
games only; friend-code games go on a separate "vs friends" record (for a player who is logged in).
The server also counts, per mini-game, the squares each player won and lost in every online game
(Find Match and friends). When a match ends, a Cloud Function writes both records, both players'
mini-game counts and both histories in one atomic update, once per game; phones cannot write any
of it. The record shows next to the usernames on the vs card, on the results screen ("Your record
1-0-0", and the opponent's, whose name opens their profile) and on profiles.

**My Stats** (from the main menu, once logged in): the Find Match record, the win rate (wins over
all games, draws included, so 3-5-1 is 33%) and the vs-friends record, then a table of every
mini-game played online with squares won, squares lost and win rate, most won first, and a link to
the game history. Another player's profile (tap their name) shows the same.

**History.** Every online game, newest first, marked Find Match or Friend, with the opponent, the
date, the result and how it ended (three in a row, most squares, timeout or resignation). Tapping a
game opens the read-only review board with everything that was hidden revealed.

**Ratings and the leaderboard are switched off for now.** One flag, `RATINGS_ENABLED = false`, in
`index.html` and in `functions/serverRules.js`, turns them off: no rating is calculated, changed or
shown anywhere, the leaderboard is gone from the menu, and matchmaking pairs by wait time only. The
Elo, rating-range pairing and leaderboard code is all still there; setting both flags to `true`
brings back ranked play with ratings (everyone starts at 1200, standard Elo with K = 32) and the
top-100 leaderboard.

**Back-fill.** Records and mini-game counts were added after people had already played, so the
deploy workflow runs `scripts/backfill-records.js` once after deploying: it recounts every
player's records and mini-game counts from their game history (older ranked and casual games count
as Find Match) and leaves a marker so it never runs twice. It prints only counts.

**Security rules** (`database.rules.json`): phones may read profiles, records and histories, and
their own matchmaking game's public state; only Cloud Functions write ratings, records, mini-game
counts, usernames, the leaderboard, histories, queues and game state. A game's hidden values have no
read rule at all.

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
Battleship fires where the ship can still fit given every hit and miss (around a hit once there is
one), and between equals at the cell most likely to sink it; Treasure hunt digs only cells consistent with every clue, the
one that best narrows the rest; Higher/lower guesses the midpoint; Wordle keeps the words consistent
with all feedback and guesses the one that splits them best; Mastermind keeps the list of codes
consistent with every guess so far and plays the guess (any of the 360 codes) whose worst-case
answer leaves the fewest, which cracks any code in at most 5 guesses; Hangman takes the letter most common in
the words still consistent with the pattern; Memory remembers every card shown and flips a known
pair, else unseen cards; Coin flip reads its exact chances from the marked coins (and the small
chance of handing the square over when none of its own are left); Snakes and Ladders works out the
expected rolls to the top with the ladders and snakes in; Bump and the races count the moves left; Pig keeps rolling while the bust risk
is acceptable and banks around 8 to 10, bolder when behind and safer when ahead, always when the bank
would reach 21. On the board, a Hexapawn square is weighed by how close each side's leading pawn is to
the far row (one move away when a win is on), since nobody has to move in a square and minimax lines
that rely on the other side being forced to move do not apply there.

## Deploying

The game is served by GitHub Pages from the `main` branch of the `Tiger-tac-toe` repository, at
https://jaredmk.github.io/Tiger-tac-toe/. After a change, publish it with one command:

```sh
./deploy.sh "what changed"
```

It commits everything and pushes `main`. Two GitHub Actions workflows take it from there:

- `pages.yml` publishes the site (only the web files: `index.html`, `admin.html`, `engine.js`, `styles.html`)
  within a minute or so, on every push.
- `firebase.yml` runs when the server changed (`functions/`, `engine.js`, `database.rules.json`,
  `firebase.json`): it runs the engine tests and the server tests on the Firebase Emulator Suite,
  and only if they pass deploys the Cloud Functions and the database rules with the
  `FIREBASE_SERVICE_ACCOUNT` secret. `deploy.sh` says when it will run. To deploy those from your
  own computer instead: `DEPLOY_FIREBASE=local ./deploy.sh "message"` (after `firebase login`).

First-time setup: create an empty public repository called `Tiger-tac-toe` on GitHub, then push
`main` to it. The Pages workflow switches Pages on and publishes the site on that first push.

```sh
git checkout -B main
git remote add origin https://github.com/JaredMK/Tiger-tac-toe.git
git push -u origin main
```

## Game stats and the admin dashboard

Every match in every mode is counted, anonymously: two players on one phone, against the computer,
computer against computer (before it was taken out), friend code and Find Match (casual and ranked
before it was one queue). Snakes and Ladders and Bump are counted like every mini-game; the Dice race
keeps its own row for the matches it was played in.
Phones report their local matches to the
`track` Cloud Function (a guest's with a random id the browser made up, never a name); the server
counts online matches itself, where it runs or saves them. Nobody can write the stats directly, and
only the admin can read them. Stats start from the first deploy with this feature (older matches were
never counted).

Per mini-game: times played; how each one ended (won, draw that reset the square, or left open when
the match ended); average moves the winner made in it, the loser, and in total; X and O win rates.
"Moves" are the turns a side spent in that square (a Pig roll or a Hangman letter that earns another go
is part of the same turn). Overall: logins and active players per day, week and month (UTC; a login is
an account signing in or coming back to the game); new accounts; matches started and finished by mode;
average match length in turns and minutes; abandon, resign and timeout rates; how often X, who moves
first, wins.

The dashboard is https://jaredmk.github.io/Tiger-tac-toe/admin.html: tables and charts, with the
mini-game table sortable (by average winner moves to find games that are too fast or too slow) and
filterable by mode. It opens only for the account with the admin flag; the database rules refuse the
stats to everyone else.

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

## Tests

The rules of the game live in `engine.js`: pure and deterministic (no clock, no `Math.random`;
every random choice comes from an rng passed in, `makeRng(seed)` for a seeded one), loaded by the
page as a plain script and by the Cloud Functions with `require`. `test/logic.test.js` covers it
(every mini-game's win and draw logic, the main board, random and timed-out moves, the computer
player, the online match records with hidden values kept apart, resigning, the turn clock, and that
the same seed plays the same match). `test/server-rules.test.js` covers the server's own rules
(usernames and the profanity filter, Elo, matchmaking pairs, records recounted from history). Both run with Node's test runner:

```sh
npm install
node --test
```

`test/server.test.js` runs the server on the Firebase Emulator Suite (Auth, Realtime Database,
Functions; it needs Java): usernames, the security rules refusing direct writes to ratings, records,
history and games, two (and six) players searching at once each paired exactly once in one queue
by wait time, every Find Match game at 1 minute a turn, a full match with hidden values unreadable
and illegal or out-of-turn moves refused, Memory's two-step move, timeouts with both players away
played out by the sweep, resigning, no ratings or leaderboard entries while ratings are off, records
and mini-game counts after Find Match and friend games (credited by the seats the match was played
in), the back-fill from history running once, and the game stats (local matches reported by a
phone counted once and bad reports refused, logins and new accounts, Find Match and friend-code
matches counted by the server, and the stats readable only by the admin, with `make-admin.js` giving
and taking back the flag). `test/stats-rules.test.js` covers what each event adds to the stats:

```sh
npm install && npm install --prefix functions
npm run test:emulators
```

