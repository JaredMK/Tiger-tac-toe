# Insane-Tac-Toe

A two-player, pass-and-play game for one phone. The whole game is `index.html`:
inline CSS and JS, no dependencies, no build step, works offline.

Open `index.html` in a browser (or serve the folder with any static server) and play.

## Rules

- The main board is a 3×3 tic-tac-toe grid. Every square holds its own mini-game.
- To claim a square, win the mini-game inside it. Three claimed squares in a row wins the match.
- X and O alternate. A turn is exactly one move in one unclaimed mini-game of your choice.
- All mini-games run in parallel and persist between turns. There is no alternation inside a
  mini-game: you may move in the same mini-game on consecutive turns of yours, so piece counts
  can be lopsided.
- If a mini-game ends with no winner (full board), that square resets with a newly randomised mini-game.
- If the main board fills with no three in a row, the player with more squares wins.

Each square is assigned one of these at random when the match starts (duplicates are fine):

| Mini-game | How to win |
| --- | --- |
| Tic-tac-toe | 3×3, three in a row |
| Connect 4 | 5 columns × 6 rows, pieces drop to the lowest open cell, four in a row in any direction |
| Battleship | 3×3, one hidden cell chosen by the computer; whoever reveals it wins, misses stay marked |
| Nim | 10 stones, take 1 to 3 per move, whoever takes the last stone wins |
| Wordle | One hidden 5-letter word shared by both players; a move is any 5-letter guess with green/yellow/grey feedback, no guess limit |
| Hangman | Hidden 5–7 letter word; guess a letter. A right letter is revealed and you guess again at once; a wrong letter ends your turn. Revealing the last letter wins |
| Tug of war | 7-position track, the knot starts in the middle; each pull moves it one step toward your end |
| Hex | 4×4 hex grid; X connects left to right, O connects top to bottom |
| Chomp | 4×5 bar with a poisoned bottom-left cell; a move eats a cell plus everything above and to its right. Eating the last safe cell wins |
| Obstruction | 4×4 grid; a mark blocks all 8 neighbours. Whoever makes the last possible move wins |
| Higher/lower | The computer picks 1–20; each guess is answered higher or lower. Guessing it wins |
| Dice race | Roll a die and add it to your total; first to 15 wins |
| Memory | 3×3 face-down cards with exactly one matching pair; a move flips two cards for 2 seconds. Flipping the pair wins |

Hidden information (the Wordle and Hangman words, the Higher/lower number, the Memory cards, the
Battleship cell) is never shown on the board or in a mini-game before it is revealed.

## Tests

The game logic lives in the `<script id="logic">` block of `index.html` and is covered by
`test/logic.test.js` (every mini-game's win and draw logic including Hex path-finding and
lopsided-move cases, the Hangman bonus guess, draw resets, main-board three-in-a-row and majority
wins, and random full matches). It uses Node's built-in test runner:

```sh
node --test
```
