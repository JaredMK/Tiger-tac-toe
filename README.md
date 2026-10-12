# Tiger-Tac-Toe

Play it: https://jaredmk.github.io/Tiger-tac-toe/

A two-player, pass-and-play game for one phone. The whole game is `index.html`:
inline CSS and JS, no dependencies, no build step, works offline.

Open `index.html` in a browser (or serve the folder with any static server) and play.

A main menu comes first: "Play vs Computer" or "2 Players". The setup screen that follows takes the
names (defaults X and O; the computer is called "Computer"), against the computer which side you play
(X goes first), and under "Advanced" the mini-games in the mix (all on by default, at least one must
stay on). "New match" after a game brings you back to setup with everything kept, and "Main menu" is a
tap away from the setup and win screens.

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
| Connect 4 | 5 columns × 6 rows, pieces drop to the lowest open cell, four in a row in any direction |
| Battleship | 3×3, one hidden cell chosen by the computer; whoever reveals it wins, misses stay marked |
| Wordle | One hidden common 5-letter word shared by both players; a move is a guess with green/yellow/grey feedback, no guess limit. Guesses must be real words (checked against an embedded list of about 15,000); a non-word shows "Not a word" and does not use the turn |
| Hangman | Hidden 5–7 letter word; guess a letter. A right letter is revealed and you guess again at once; a wrong letter ends your turn. Revealing the last letter wins |
| Hex | 4×4 hex grid; X connects left to right, O connects top to bottom |
| Higher/lower | The computer picks 1–20; each guess is answered higher or lower. Guessing it wins |
| Dice race | A winding path of 15 numbered spaces and a Finish. Roll a die and your piece hops that many spaces; reaching or passing the Finish wins |
| Memory | 3×3 face-down cards with exactly one matching pair; a move flips two cards for 2 seconds. Flipping the pair wins |
| Candy race | A winding path of 12 randomly coloured spaces (any three in a row are all different colours) from Start to a Finish shown in all four colours; a spin of the colour wheel hops your token to the next space of that colour. No such space ahead means you reach the Finish and win |
| Coin flip | Six coins showing X or O, three of each to start. Flip turns up to 3 of the other side's coins (all of them if they have 3 or fewer, otherwise 3 picked at random); each lands X or O at random. All six the same wins for that symbol's player |
| Pig | Each player has a banked score. A move is a whole push-your-luck turn: roll a die, and a number not yet rolled this turn joins the pot; then roll again or bank. Banking adds the pot to your score and ends the move; a repeated number busts, losing the pot (at most six rolls). First to a banked 20 wins |
| Treasure hunt | 5×5 grid with one hidden treasure. A move digs a cell: the treasure wins, otherwise the cell shows its distance to the treasure in steps up, down, left or right, coloured hot to cold. Everything dug stays visible |

Hidden information (the Wordle and Hangman words, the Higher/lower number, the Memory cards, the
Battleship cell) is never shown on the board or in a mini-game before it is revealed.

## Playing against the computer

The computer takes its turn in the open: a short pause to think, then it zooms into the square it
chose, makes its move with the usual animation (its chosen cards, coins or word are shown first), and
the board returns.

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
(Wordle, Hangman, Higher/lower, Battleship, Treasure hunt, Memory) counts for less because the clue
helps the other player too.

Inside a square: Tic-tac-toe plays full minimax; Connect 4 searches six moves ahead with alpha-beta
and a threat count; Hex spots wins and blocks through shortest-connection distances, one reply ahead;
Battleship takes any unrevealed cell; Treasure hunt digs only cells consistent with every clue, the
one that best narrows the rest; Higher/lower guesses the midpoint; Wordle keeps the words consistent
with all feedback and guesses the one that splits them best; Hangman takes the letter most common in
the words still consistent with the pattern; Memory remembers every card shown and flips a known
pair, else unseen cards; Coin flip flips the most coins allowed; Pig keeps rolling while the bust risk
is acceptable and banks around 8 to 10, bolder when behind and safer when ahead, always when the bank
would reach 20.

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
`test/logic.test.js` (every mini-game's win and draw logic including Hex path-finding and
lopsided-move cases, the Hangman bonus guess, draw resets, the return to the board after each move,
main-board three-in-a-row and majority wins, random full matches, and the computer player: legal
moves only, decisions that cannot see hidden information, match-winning squares taken and defended,
each game's tactics, and computer-versus-computer matches that finish). It uses Node's built-in test runner:

```sh
node --test
```
