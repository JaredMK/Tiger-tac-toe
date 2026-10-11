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

Each square is assigned one of these at random when the match starts:

| Mini-game | How to win |
| --- | --- |
| Tic-tac-toe | 3×3, three in a row |
| Connect 3 | 5 columns × 6 rows, pieces drop to the lowest open cell, three in a row in any direction |
| Battleship | 3×3, one hidden cell chosen by the computer; whoever reveals it wins, misses stay marked |
| Nim | 10 stones, take 1 to 3 per move, whoever takes the last stone wins |

## Tests

The game logic lives in the `<script id="logic">` block of `index.html` and is covered by
`test/logic.test.js` (mini-game wins, draws, lopsided-move cases, draw resets, main-board
three-in-a-row and majority wins). It uses Node's built-in test runner:

```sh
node --test
```
