// Hot Potato: the computer's play. Nothing to choose in the square itself: the one move is the toss, and only the
// holder (or anyone before the first toss) may make it. The choice is on the main board, where the computer, holding
// the bomb, tosses it on its first turn unless it can win the match outright that turn (core/ai.js cpuMove, bombHeld).
// needs: the moves before this square is decided by playing it are not a race (it ends by a roll): a long way off
// for both, so the search treats it as a square nobody is close to.
import { canMove } from './rules.js';

export function needs() { return 8; }
export function best(pm, me) { return { move: canMove(pm, me) ? 'toss' : null, q: 0 }; }
