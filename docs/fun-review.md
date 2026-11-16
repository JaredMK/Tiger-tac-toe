# Tic Tac Chaos: fun review

November 2026. A review only: nothing in the game was changed, committed to `staging` or deployed.
Mock-ups for the recommendations: `docs/fun-review-mockups.html` (standalone, not deployed; screens A1 to C4 are referred to below).

Contents: [Top 10](#top-10-overall) · [Evidence and limits](#evidence-and-its-limits) · [Part 1: Super Chaos](#part-1-super-chaos) · [Part 2: Classic](#part-2-classic) · [Part 3: Pre-launch checklist](#part-3-pre-launch-checklist) · [Appendix: numbers](#appendix-the-numbers)

Keys used in every table:
- **Effort**: S = up to 2 days, M = 3 to 8 days, L = 2 weeks or more.
- **Impact**: High / Med / Low, on fun, retention or launch risk.
- **Cheap test?**: "Switch today" = an admin setting that already exists; "New switch" = needs a small flag added first; "No" = has to be built to be judged.

---

## Top 10 overall

| # | Change | Why | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| 1 | **A guided first match**: one Play button on a first visit, a starter board against Easy, the player moves first, each game's "?" card shown once (mock-ups B1 to B4) | There is no onboarding at all today. A new player meets 9 unfamiliar games, a setup screen, and half the time watches the computer move first. My first test match was lost 0–3 in 96 seconds, with the computer claiming a square on its first move | M | High | New switch |
| 2 | **Clear the App Store blockers**: Continue with Apple is switched off in both projects, Apple token revocation on account deletion is not built, there is no way to report a player or contact support, the privacy mailbox is a placeholder | Each of these is a likely rejection or a legal gap, and none is large | M | High (launch) | No |
| 3 | **Measure, then fix, the first load**: about 390 requests and 4.8 MB (about 1.6 MB compressed) before the menu, everything served `no-cache`, no error catcher, no warm server instance on production | A slow first screen loses players before any design work can help; a cold server start is 3.4 to 5 s on the first online tap | M | High | No |
| 4 | **Launch analytics**: a first-run funnel, D1/D7/D30 by cohort, rematch, share and invite events; raise the 500-new-devices-a-day cap | Without these the launch cannot be read, and the cap silently drops devices on a good day | M | High | No |
| 5 | **Cut the watching**: 56 to 62% of a match against the computer is spent watching its turn (about 5 s each). Shorten its think and glow, allow skip sooner, offer Speed after match one | The single biggest feel problem I measured | S | High | Switch today (`config/anim`) for the pace; S of code for the rest |
| 6 | **Release some skill games**: 0 of the 19 released games are skill games; 14 are luck. Start with Cup Pong, Bullseye, Mini Golf, Bowling (Equal rolls on), Claw Machine, plus Trivia and Patterns | The lineup undersells "every square is a mini-game", and luck-only boards make Hard only 61% against Normal | S each | High | Switch today (release switches, staging first) |
| 7 | **Fix the instant squares**: Coin Flip, Five Letters, Treasure Hunt, Codebreaker, Sea Battle and Higher/Lower are won on the winner's first move there 17 to 29% of the time. Coin Flip: 2 flips. The others: Race mode | Breaks the game's own "4 to 6 moves, no instant wins" target; whoever touches the square last wins it | S | Med–High | Switch today (TUNE, Mode) |
| 8 | **Show the drama**: a match-point glow, who is ahead in each square, and a best-of-3 score on Rematch (mock-ups C1, C4) | The first claim comes around turn 11 and the board never says when a match is about to end | S–M | High | New switch |
| 9 | **A reason to come back**: Daily Board and a mini-game passport (mock-ups C3, B5) | Nothing exists beyond the current match: no streaks, goals or collection | M | High | New switch |
| 10 | **Super Chaos: keep it off for launch, rework it as a Chaos Round inside Classic**, then a short standalone format run as a weekend event (mock-ups A1 to A5, C2) | The current mode is not a switch-flip away from fun: a median 29 rounds, 77% of rounds change nothing, and its one special moment punishes success. The simultaneous pick-and-clash kernel is worth keeping | M then L | High, later | New switch |

---

## Evidence and its limits

What I did:
- **Read** the Super Chaos rules and code (`core/chaos.js`, `scgame.js`, `ui/chaos.js`, the explainers), the Classic turn flow, the menu, setup and results screens, and had the repository audited for launch readiness (analytics, iOS, legal, reliability).
- **Played five whole matches in the real page** at phone size (390 × 844, Chromium): Classic against Easy, Normal and Hard, and Super Chaos against Normal and Easy. Super Chaos was switched on in the browser only (the served `core/config.js` rewritten in flight; no file changed). The board taps were real taps; each mini-game move was chosen by the Normal-level computer and sent through the page's own move function. Every phase was timed and screenshotted.
- **Simulated 1,620 whole matches** in the engine, computer against computer, on the released lineup (19 games): Classic at three level pairings, Classic with Race mode on, Classic with a Coin Flip change, and Super Chaos twice.

What I could not do, and what it means:
- **The admin stats were out of reach.** This session's network policy blocks both tictacchaos.com and staging, and there are no credentials here. So there are **no real-player numbers in this review**: no completion rates, return rates or most/least played games. Every number below is from simulation or my scripted play, and is marked so. Part 2 lists exactly which admin figures to pull and how each would change the advice.
- **A friend match from both seats was not played.** It needs the Firebase emulators, which are not installed here. I read the online flow instead and relied on the measurements already in the project notes.
- **Scripted play is not a human feel test.** It measures pacing, waiting and outcomes well. It cannot tell you whether a clash is exciting. The Super Chaos proposals in particular need a handful of real people before they are trusted.
- Simulated players pick squares the way the computer does, so "same square" rates are probably higher than between two humans.
- "The 19 released games" means the 17 released by default plus Krabs and Risky Spins, which a release switch turns on. The live switches may differ; I could not read them.
- While this review was being written, an iOS 1.20.0 commit landed on the branch. Part 3 was re-checked against its notes: Continue with Apple is still hidden, `APP_STORE_ID` is still empty, token revocation is still to do.

---

## Part 1: Super Chaos

### 1.1 What it is today

Each round both players secretly pick any open square and make one move there. When both are in (or 60 s pass online) a recap plays: the other player's square lights up, their move replays at 2× in a pop-up, then claims stamp one by one. A square both players win in the same round resets. A line each in the same round is a draw. Miss two rounds running and you lose.

Bringing it back is not one switch. `SUPER_CHAOS_ENABLED` is a code constant, and the redesigned Play Computer screen has no mode row: `playComputer()` forces Classic. With the constant flipped, my first "Super Chaos" run silently played Classic.

### 1.2 What I measured

| | Classic | Super Chaos |
|---|---|---|
| Length (simulated, Normal v Normal) | median 50 turns (25 each) | median 29 rounds, 10% run past 46 |
| Rounds where nothing is claimed or reset | n/a | **77%** |
| Loser ends with no squares | 14% | **26%** |
| Winner was behind at some point | 52% | 41% |
| Both in the same square | n/a | 48% of rounds |
| "Both won it" resets | n/a | 1.5 per match |
| Time spent waiting or watching (my play) | 56–62% | **about 80%** (waiting 32–34%, replays 45–47%) |
| Presentation time alone | about 9 s per pair of turns | 7 to 8 s per round |

Which squares end in a "both won it" reset in Super Chaos (simulated): Five Letters **66%**, Treasure Hunt 47%, Codebreaker 45%, Higher/Lower 37%, Hangman 37%, Sea Battle 31%. For games where each player has their own progress it is 3 to 17% (Little Wheel 3%, Risky Spins 3%, Ride the Bus 8%, Krabs 8%, Bump 9%, Candy Race 11%, 21 12%, Snakes and Ladders 14%, Risky Rolls 17%).

### 1.3 What is confusing, slow or flat

1. **A round looks exactly like a Classic turn.** The header says "Round 1", the hint says "Round 1 · tap any open square". Nothing shows that the other player is choosing right now. Against the computer there is no clock at all.
2. **After your move you wait, with nothing to watch.** "Round 1 · waiting", either on the board under a band or sitting in your own square. A third of the match.
3. **Then you must watch.** The other player's whole move replays every round, whether or not it matters to you. Nearly half the match.
4. **Most rounds change nothing.** 77% end with no claim and no reset, so the round's "results" step is usually an empty beat.
5. **The one special moment is a punishment.** Picking the same square is only visible when you *both win it*, and then it resets: you solved the word and got nothing. Testers calling results "random" is the natural reading of this.
6. **Shared-information games break.** In Five Letters, Codebreaker, Treasure Hunt and Higher/Lower both players see the same clues, so both find the answer in the same round. Two in three Five Letters squares reset.
7. **Some moves have no result until the round ends.** A Little Wheel spin, a Bump spin or a Mini Golf shot is "locked in" and you sit looking at a disabled button.
8. **The rules text is five sentences with three exceptions** (reset, miss, two misses), no picture, and 15 games carry their own "Super Chaos" rule changes on top.
9. **It is not faster.** A 60-second round clock and a median 29 rounds make it about as long as Classic.

### 1.4 Diagnosis: the simultaneity has no stakes

The fantasy should be **both**, in two beats: a **mind game** when you pick (where will they go?) and a **frantic race** when you play (we are both at it right now).

Today neither beat exists:
- **No mind game.** Your move in one square never affects their move in another. So it does not matter where they go, and there is nothing to outguess. The only interaction is the reset, which hurts both.
- **No race.** You never see the other player play. You take your turn alone, wait, then watch a recording. It is turn-based play with the other turn hidden.

The check that confirms this: I re-ran Super Chaos with only the "own progress" games (no shared-information games). Resets fell from 1.5 to 0.6 a match, as expected. But empty rounds stayed at 82%, the length barely moved (median 24 rounds), and the loser ended with **no squares in 41% of matches**. Two players progressing in parallel with no way to interfere just means whoever gets ahead stays ahead. Removing the broken games does not make the mode fun. It needs interaction.

What already delivers the fantasy, and should be kept:
- the secret simultaneous pick;
- the clash animation (both marks colliding);
- the joint replays where both played one square;
- the live layer built for Classic online (the other player's open square and long attempts streamed as they happen): this is exactly the "see them play" piece Super Chaos lacks.

### 1.5 The reworked round: Pick, Reveal, Play

One loop, the same every round (mock-ups A1 to A5):

1. **Pick** (about 5 s, shared countdown). Both tap a square in secret. The rival's ghost hovers with a "?"; a "locked" tag appears when they are in. No pick means no move that round (the existing no-automatic-moves rule).
2. **Reveal.** Both tokens land on the board in the same instant.
   - **Split** (different squares): both play at once.
   - **Clash** (same square): a 2-second duel, then the winner's move counts and the other's bounces off.
3. **Play** (up to 20 s, a burning fuse). One move each, at the same time. A "rival cam" strip shows their square live.
4. **Round card** (about 1.5 s). Both outcomes side by side, stamps land, on to the next round. The replay becomes an optional "Watch".

Why the clash should cancel a move rather than only reset a win: it gives the pick real stakes every round. You can block a winning move by guessing where it will be played, and the leader has to decide between the obvious square and a feint. That is the mind game.

### 1.6 Ideas

**Onboarding (15 to 30 seconds)**

| ID | Idea | Why it helps | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| SC-1 | A scripted intro round on first play: three beats, one tap each (A1, A2/A3, A4), about 25 s, skippable | Teaches by doing; the three beats are the whole mode | M | High | No |
| SC-2 | The rival's ghost on the board while picking, and "picking… / locked" under both names | The one fact testers were missing: the other player is moving now | S | High | No |
| SC-3 | Rewrite the explainer to three short lines: "Both pick a square in secret. Different squares: you both play. Same square: clash!" | Five sentences and three exceptions become three beats | S | Med | Help-text import |
| SC-4 | Drop the per-game Super Chaos rule changes where possible (deal each game's normal or Race form) | 15 games currently ask to be relearned | M | Med | No |

**Presentation**

| ID | Idea | Why it helps | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| SC-5 | Simultaneous reveal of both picks on the board (A2) | Answers "what did they do?" before play, not after | S–M | High | No |
| SC-6 | Rival cam: their square's miniature, live, while you play (A3), reusing `net/live.js` | The frantic half of the fantasy; removes the dead wait | M | High | No |
| SC-7 | One shared countdown: 5 s to pick, 20 s to play, shown as a fuse; "Sam's done!" when the rival finishes first | Pace and urgency from the game's own clock, never from nagging | S | High | New switch (round seconds) |
| SC-8 | Replace the forced replay with a 1.5 s round card and an optional Watch (A5) | Removes about 45% of the match's time | M | High | No |
| SC-9 | Clash as the signature moment: burst, haptic, both characters colliding (A4) | The mode's one unique beat should be its loudest, and positive | S (art exists) | High | No |

**Rules**

| ID | Idea | Why it helps | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| SC-10 | Clash rule: same square means a quick duel; the winner's move counts, the loser's bounces. Never a reset for winning | Turns the punishment into the mind game | M | High | New switch (`bounce` / `bonus move` / today's reset) |
| SC-11 | The duel: stop a sweeping needle nearest the middle (the Bullseye and Bowling meters already do this). Alternative to test: Rock Paper Scissors, which already exists as a game | One tap, 2 seconds, skill not luck. Each phone times its own tap, so latency does not decide it (the same accepted risk as Bullseye online) | M | High | New switch |
| SC-12 | Game pool: own-progress games (Risky Rolls, Risky Spins, Krabs, 21, Ride the Bus, Candy Race, Snakes and Ladders, Peg Drop, Cup Pong, Bullseye, Bowling), same-question games (Trivia, Patterns, Odd One Out, Flash, Headcount), and the **Race form** of the shared-information games | Race mode already gives each player their own target, which removes the both-solve reset | S–M | High | Partly switch today (the match's game checklist) |
| SC-13 | Shorter squares in this mode: about half the usual targets | A claim in most rounds instead of fewer than one round in four | S per game | High | Switch today on staging (TUNE), but it also changes Classic there |
| SC-14 | A round cap: three in a row, or most squares after round 15; level means one final clash for the match | A 3 to 4 minute match with an ending you can see coming; no flat draws | S–M | High | New switch |
| SC-15 | Comebacks: a drawn duel goes to the player with fewer squares; a square that would complete a line glows for both players | Small, visible, never a handout. The defender can see where to block | S | Med | New switch |
| SC-16 | A line each in the same round: final clash instead of a draw | A draw after a long match is the flattest ending | S | Low–Med | No |

**Variants worth testing**

| ID | Variant | What it is | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| SC-17 | **Chaos Round inside Classic** (C2) | A meter fills as turns pass; when full, one Pick-Reveal-Play round is played, then turns resume. About 3 to 5 a match | M against the computer, L online | High | New switch (on/off, how often) |
| SC-18 | **Chaos Blitz**, a faster best-of | No board: best of 5 squares, both playing the *same* mini-game at the same time, first to 3. The purest race, taught in one line | M–L | High | No |
| SC-19 | **Chaos Weekend** | The standalone mode open Friday to Sunday, announced on the menu. It simply comes back each week; nothing is earned only then and nothing is lost by missing it | S once the mode exists | Med | New switch (dates) |
| SC-20 | Special squares and events, sparingly | A golden square (winning a clash there also gives a bonus move); a "fog" round (miniatures hidden while picking); a "double" round (two picks each) | M each | Low–Med | New switch |

**Social and replay hooks**

| ID | Idea | Why it helps | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| SC-21 | A clash record against each friend ("Clashes won 7–4") beside Top opponents | A rivalry stat only this mode can produce | S | Med | No |
| SC-22 | A "moment" share card: the round where a clash blocked a winning move | The best story the mode tells, ready to send | M | Med | No |
| SC-23 | Rematch as a best-of-3 (C4) | Short matches invite a series | S | Med | No |
| SC-24 | One-tap reactions on the round card | The existing six emotes, at the moment people want them | S | Low–Med | No |

### 1.7 Recommendation

**Rework it. Do not relaunch the current mode, and do not retire the idea.**

| Step | What | Effort | Decide by |
|---|---|---|---|
| 0 | Keep Super Chaos off for launch (it is). Nothing to do | none | n/a |
| 1 | **Chaos Round inside Classic, against the computer, behind an admin switch** (SC-17 with SC-2, SC-5, SC-10, SC-11). The engine already computes a hidden computer move and resolves a round | M | Five to ten people play it. Can they explain it afterwards? Do they smile at a clash? |
| 2 | Add the rival cam and take it online (SC-6, SC-7, SC-8) | L | Rematch rate and match completion against plain Classic |
| 3 | The standalone mode on the same loop, as a Chaos Weekend (SC-12 to SC-15, SC-19) | L | Only if step 1 and 2 are clearly liked |
| 4 | Chaos Blitz (SC-18) as the alternative if the board version still feels slow | M–L | After step 2 |

Retire, from the current build: the forced replay, the 60-second round, "both won it: reset", and the shared-information games in their shared form.

Why a twist first: it reaches every Classic player without a mode choice, the match teaches it, and it costs a fraction of the standalone rebuild. If the clash is not fun as a twist, it will not carry a mode, and you will have found out cheaply.

---

## Part 2: Classic

### 2.1 The core loop, measured

Simulated, Normal against Normal, the 19 released games (500 matches across two runs):

| Measure | Value | Reading |
|---|---|---|
| Match length | median 48–50 turns (24–25 each); 10% under 31, 10% over 67–74, longest 126 | About 5 to 6 minutes for a human; a long tail near 9 |
| First square claimed | turn 11–12 | For the first minute or more the main board does not change |
| Squares claimed by the end | 5.7–6.0 | |
| Draws (no line left) | 3.5–7% | Fine |
| First mover (X) wins | 52.7% | Fair |
| Winner was behind at some point | 50–52% | Comebacks are real |
| Winner was 2 squares behind | 16–17% | Big comebacks happen, sometimes |
| Loser also one square from a line at the end | 13–18% | **Most endings are not a race** |
| Loser ends with no squares | 14–19% | One match in six is a shut-out |
| Lead changes | 0.6 a match | |
| Hard beats Normal | 61% | Skill counts for little on a luck-heavy board |
| Normal beats Easy | 75% | Easy is a fair first opponent |

My three scripted matches in the page:

| Level | Result | Turns each | Time (no thinking time) | Watching the computer | Own animations |
|---|---|---|---|---|---|
| Easy | won | 16 | 159 s | 56% | 32% |
| Normal | lost 0–3 | 11 | 96 s | 62% | 25% |
| Hard | lost | 25 | 215 s | 61% | 26% |

A computer turn takes about 5 seconds: think, the square glows, zoom in, the move replays, zoom out.

What the loop does well: the idea is instantly appealing, the claim stamp is a great moment, the miniatures tell the story of each square, the Comic Chaos look is strong and consistent, and the match is fair between seats.

Where it sags:

1. **A slow first act.** Nothing happens on the main board for about 11 turns.
2. **A quiet ending.** In five matches out of six the loser has no live threat when the match ends, and the board never signals that the end is near.
3. **Too much watching against the computer.** About 60% of the match.
4. **Instant squares.** In shared-information games the last guess wins, not the most work:

   | Game | Won on the winner's first move there | Won in 2 moves or fewer | Winner moved less than the loser |
   |---|---|---|---|
   | Five Letters | 29% | 77% | 19% |
   | Treasure Hunt | 27% | 72% | 21% |
   | Coin Flip | 23% | 58% | 4% |
   | Sea Battle | 21% | 52% | 34% |
   | Higher/Lower | 17% | 43% | 35% |
   | Codebreaker | 17% | 53% | 22% |
   | Find the Pair | 14% | 28% | 28% |

   The project's own targets are "4 to 6 of a player's own moves" and "every move should help the mover more than the opponent". These seven miss both. In my first match the computer claimed Coin Flip on its opening move.
5. **A luck-heavy lineup.** 14 of the 19 released games are luck, 5 are brain, none are skill. All 18 skill games are Admin only.
6. **Tic-Tac-Toe draws 44 to 56% of the time** and resets. Harmless, but it is the most common reset by far.
7. **Long squares**: Four in a Row takes the winner 8 moves, Ride the Bus 7. They are rarely finished (33 and 38 wins against Coin Flip's 98).

### 2.2 Core loop and pace

| ID | Idea | Why it helps | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| CL-1 | Faster computer turns: think 0.7 → 0.4 s, glow 0.6 → 0.4 s, Skip after 0.8 s instead of 2 s, tap anywhere to finish the replay | Removes roughly a third of the watching | S | High | Switch today for overall pace (`config/anim` speed 1.25 on staging); S of code for the split |
| CL-2 | Offer Speed once, after the first match ("Too slow? Try Speed") | Speed exists but lives in Settings, where new players will not find it | S | Med | New switch |
| CL-3 | Match-point glow and caption on a square that would finish a line; "ahead / behind" pips on every miniature (C1) | Makes the ending a visible race and tells new players which squares matter | S–M | High | New switch |
| CL-4 | A faster first act: deal 2 or 3 of the 9 squares part-played (each side equally far in), or open with a Chaos Round | The first claim arrives sooner without shortening any game | M | Med | New switch |
| CL-5 | A long-match rule: after turn 60, squares need one move less (announced with a burst) | Trims the 9-minute tail; symmetric, so fair | M | Low–Med | New switch |
| CL-6 | A blocked board ends in a showdown (one shared mini-game for the match) instead of a draw | A draw is the flattest ending | M | Low–Med | New switch |
| CL-7 | Coin Flip: 2 coins a flip instead of 3 | First-move wins fall from 23% to 3%, winner's moves rise from 2.6 to 3.5 (simulated) | S | Med | Switch today (TUNE `flips`) |
| CL-8 | Race mode for Higher/Lower, Codebreaker, Five Letters, Treasure Hunt, Sea Battle | First-move wins fall to 0–11%; the winner does the work (3 to 5 moves). Trade-off seen in simulation: fewer steals, so big comebacks fell from 17% to 7% and shut-outs rose slightly. Try it on staging before deciding | S | Med–High | Switch today (each game's Mode) |

### 2.3 Board-level twists

Rule for all of them: symmetric (both players get the same chance), announced loudly, rare, and each behind its own switch.

| ID | Twist | What happens | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| CL-9 | **Chaos Round** | See SC-17 and mock-up C2. The best twist, because it is also Super Chaos's way back | M / L | High | New switch |
| CL-10 | **Golden square** | One square a match is gold: winning it gives one extra move straight away | S–M | Med | New switch |
| CL-11 | **Shuffle!** | Once a match, a square nobody has touched re-deals to a new game, with the draw's existing shuffle animation | S | Low–Med | New switch |
| CL-12 | **Double time** | For one round of turns, each player makes two moves | M | Med | New switch |
| CL-13 | **Spotlight** | A random open square glows for two turns: a move there goes again | M | Med | New switch |
| CL-14 | **Mystery square** | One square's game is hidden until someone opens it | S | Low | New switch |

Start with CL-10 and CL-11: small, clear, and enough to learn whether players like surprises on the board. I would not add stealing claimed squares: it undoes the one permanent thing in the match.

### 2.4 The mini-game lineup

From simulation and play. The admin's Mini-games table should overrule any of this (see 2.9).

| Decision | Games | Reason |
|---|---|---|
| **Feature** (first-match board, screenshots) | Risky Rolls, Candy Race, Snakes and Ladders, 21, Find the Pair, Four in a Row | Instantly readable, 4 to 6 moves, a clear picture on the board |
| **Tune** | Coin Flip (CL-7); Higher/Lower, Codebreaker, Five Letters, Treasure Hunt, Sea Battle (CL-8) | Instant squares, above |
| **Watch** | Tic-Tac-Toe (half its squares draw), Ride the Bus (7 moves), Four in a Row (8 moves, rarely finished) | Check their "left open" and reset counts in the admin table |
| **Add first** (currently Admin only, balanced in the project's own simulations) | Cup Pong (first mover 55%), Bullseye (58%), Mini Golf (54%), Bowling with Equal rolls on (50%), Claw Machine (56%), Snake (56%); Trivia, Patterns; Peg Drop, Hook-a-Duck (54%), Bingo (53–55%) | Brings skill and brain into a lineup that has neither in quantity |
| **Add later** | The runners (Dash, Flap, Lane Rush, Chopper), Sky Hop, Scoop Stack, Pinball, Muncher, Star Swarm, Brick Break | Great variety, but 60-second turns: add once pace is fixed, a few at a time |
| **Keep back** | Coin Pusher (first mover 64%), Districts (81%), Shelves (over 90%), Hex, Pool (second mover 65%), Word Tiles (Hard wins in 2 turns), Dice Combo (57–59%), Thirty-One (58%) | Outside the project's own 60% rule or close to it |
| **Decide deliberately** | 21, Little Wheel, Krabs, Ride the Bus, Risky Rolls; later Poker Hands, War, Scratch & Match, Coin Pusher | Casino-flavoured. They affect the App Store age rating and how family-friendly the game reads (Part 3) |

Two lineup ideas:

| ID | Idea | Why it helps | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| CL-15 | Boards dealt with a mix rule: at least 2 skill and 2 brain games in every 9 | Every match shows the range; skill starts to matter | S | High | New switch |
| CL-16 | "New this week": release one or two games a week from the bench, badged on the board and menu | About 50 built games are waiting. A steady drip is free content and a reason to return | S a week | High | Switch today |

### 2.5 Progression and goals

All earned by playing. Nothing bought, nothing random, nothing lost by taking a day off.

| ID | Idea | Why it helps | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| CL-17 | **Mini-game passport** (B5): one stamp per game for winning a square in it, three tiers (1, 5, 25 wins) | A collection that rewards trying every game; grows with each release | M | High | New switch |
| CL-18 | **Daily Board** (C3): one seeded board a day against the computer, one counted try, a spoiler-free share grid | A reason for a second session and something to compare. The engine already deals a whole match from a seed | M | High | New switch |
| CL-19 | A kind streak: days played, with one free rest day a week; it rests instead of resetting | A habit without the guilt | S on top of CL-18 | Med | With CL-18 |
| CL-20 | Level badges: beat Easy, Normal, Hard; win streak against each | A ladder for solo players | S | Med | No |
| CL-21 | Cosmetics earned from the passport and badges: stamp styles for a claim, expressions and hats for X and O, board ink colours | Self-expression, and the two characters are the game's face. Art-heavy | L | Med | No |
| CL-22 | Seasons: a themed look and a featured pack of games for a few weeks | Later, once the basics are measured | L | Med | No |

Not recommended: loot boxes or any random reward, energy or wait timers, paid boosts, streaks that shame, countdown offers.

### 2.6 Social

Today: rematch, a share card, invites by code and link, the top three opponents, six emotes, and Watch (your own opponent's square, live).

| ID | Idea | Why it helps | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| CL-23 | Rematch as a best-of-3 with the score carried (C4) | Makes game two and three matter | S | High | No |
| CL-24 | A rivals page: every opponent with a username, head-to-head record, last result, and "Challenge again" (opens a room and shares the invite) | The server already tallies this for Top opponents | M | High | No |
| CL-25 | Moment share cards: a comeback from 0–2, a shut-out, a match-point steal | A story is shared more than a scoreline | S–M | Med | No |
| CL-26 | "gg" and "rematch?" emotes on the results screen | The moment people want to say something | S | Low–Med | No |
| CL-27 | Play at your own pace with a friend: a no-clock room that sends a notification when it is your turn | The best retention feature for pairs of friends. Needs push notifications, which do not exist yet | L | High | No |
| CL-28 | Spectator link for a friend room | Fun for groups; later | L | Low–Med | No |

### 2.7 Onboarding: the first 60 seconds

Today, verified in the page: no tutorial, no first-run flag, no coach marks. Four taps to a first move (Play Computer, Start, tap the side reveal, tap a square). The side is Random, so half the time the computer moves first: 6.5 seconds pass after Start before the player can do anything. The first opponent is Normal. Rules are only behind "?" and How to Play.

| ID | Idea | Why it helps | Effort | Impact | Cheap test? |
|---|---|---|---|---|---|
| CL-29 | First visit: one big Play button straight into a match (B1) | One tap to a board | S | High | New switch |
| CL-30 | First match: the player moves first, against Easy | Never open by watching; a fair chance of a first win (Normal beats Easy 75%) | S | High | New switch |
| CL-31 | A starter board of nine quick, familiar games (B2) | Removes "nine unknown games at once" | S | High | New switch (a fixed list) |
| CL-32 | Each game's "?" card opens once, the first time that game is opened (B3) | Fixes "I opened a square and do not know what the buttons do", and keeps the no-help-text-in-games rule | S | High | New switch |
| CL-33 | Three coach bubbles only: "tap a square", "square claimed, three in a row wins", then silence (B2, B4) | Teaches the goal at the moment it becomes real | S–M | High | With CL-29 |
| CL-34 | A first result with a next step: Play again, the passport, tomorrow's Daily Board (B5) | The second session starts on the first results screen | S on top of CL-17/18 | High | No |
| CL-35 | Ask for an account only when it gives something (after a win: "save your stamps") | Login stays optional, as now, but has a reason | S | Med | No |

### 2.8 Feel and polish

| ID | Observation | Suggestion | Effort | Impact |
|---|---|---|---|---|
| CL-36 | At 390 × 844 the board sits low with about 230 px of empty paper above it | Use it: a score strip, the match-point line, or a larger board | S–M | Med |
| CL-37 | "Find Match · soon" is a dashed tag on the main menu | For launch, either switch Find Match on or hide the tag. "Soon" on a launch build reads as unfinished | S | Med |
| CL-38 | Find Match bots are not disclosed (the admin note says the player is not told) | Say so, at least on the results screen ("You played a practice rival"). It is the kind thing and avoids a trust problem later | S | Med |
| CL-39 | Moves that only show a pressed button until the server answers (dice, spins, hidden draws) | Start the wind-up animation at the tap and land it when the record arrives | M | Med |
| CL-40 | A shut-out happens about one match in six | After a 0–3 loss, lead with "Rematch" and a one-line encouragement, and (first matches only) quietly keep the player on Easy | S | Med |
| CL-41 | Zoom is disabled (`user-scalable=no`) and some labels are 9 to 11 px | A larger-text option, or raise the smallest sizes | S–M | Low–Med |

### 2.9 Admin stats to pull (I could not)

| Figure (where) | If you see this | Then |
|---|---|---|
| Abandon rate by mode (Overview, Stats) | Play Computer above 30% | Onboarding and pace first (CL-1, CL-29 to 33) |
| Average turns and minutes, finished matches | Over 7 minutes | CL-4, CL-5 |
| Funnel: opened → started → finished → started another (Playtest) | Big drop at "started another" | CL-23, CL-34, CL-18 |
| Came back next day / within 7 days (Playtest) | D1 under 20% | CL-17 to CL-19 before more games |
| Mini-games table: Completed, Resets, Left open, winner's moves | A game with high "left open" | Players avoid it: tune or pull it |
| Same table, winner's moves under 3 | Confirms the instant squares | CL-7, CL-8 |
| Same table, X% against O% per game | Outside 40–60% | Tune that game |
| Matches by timer | Many clock losses at 3 minutes | Make 5 the only short option |

The table cannot tell you true first-mover rates per square (it knows X and O, not who moved first in that square); see the analytics list in Part 3.

---

## Part 3: Pre-launch checklist

Must = do before launch. Should = within the first weeks. Nice = when there is time.
Legal items are flagged from the code and Apple's published rules as I understand them. Please confirm them with someone qualified before submitting.

### Gameplay

| Priority | Item | State today | Effort |
|---|---|---|---|
| Must | Super Chaos stays off | It is off in code. Nothing to do | none |
| Must | Fix or pull the instant squares (CL-7, CL-8) | 17–29% first-move wins in six games | S |
| Must | Decide the casino-flavoured games per platform | 5 of 19 released games; a per-platform iOS switch already exists | S (a decision) |
| Must | Find Match: on with bots, or hidden | A "soon" tag on the menu | S |
| Should | At least 4 skill or brain games added to the release (CL-15, CL-16) | 0 skill games released | S each |
| Should | Disclose bots (CL-38) | Not disclosed | S |
| Nice | Board twists (CL-10, CL-11) | None | S–M |

### First-time experience

| Priority | Item | State today | Effort |
|---|---|---|---|
| Must | Guided first match (CL-29 to CL-33) | No onboarding of any kind | M |
| Must | Test with 5 people who have never seen the game, on their own phones, saying nothing | Not done as far as the repository shows | S |
| Should | Speed prompt after match one (CL-2); first result with a next step (CL-34) | None | S |
| Nice | A 15-second trailer loop on the menu's first visit | None | M |

### Performance and reliability

| Priority | Item | State today | Effort |
|---|---|---|---|
| Must | Measure the first load on a mid-range phone on slow 4G (Lighthouse against staging). If the menu takes over 4 seconds: bundle and minify in `scripts/build-site.js`, hashed file names with long caching, and load mini-game views on demand | About 390 requests and 4.8 MB uncompressed before the menu (measured locally); `Cache-Control: no-cache` on every file, so each visit revalidates all of them; every game's view is imported at boot | M |
| Must | A global error catcher (`error` and `unhandledrejection` → `devError`) | Only hand-placed error logs; no error rate anywhere | S |
| Must | A warm instance on production for the calls players wait on | `TTC_WARM=0` on production (1 on staging); a cold start is 3.4 to 5 s. About $8 a month for the three functions | S |
| Must | Scheduled database backups | Only inside the manual reset workflow | S |
| Must | Raise the 500-new-devices-a-day cap, or make it alert | Devices past the cap are never logged | S |
| Should | App Check on (web and iOS) | Off; keys not created | M |
| Should | Alerts for error spikes, reports and spend | The only alert is "someone is alone in Find Match" | S–M |
| Should | The admin Playtest page stops loading the whole device log into the browser | Will not survive real traffic | M |
| Should | Move the alert keys to Secret Manager | Read from the database until `TTC_SECRETS=on` | S |
| Nice | A service worker so the web game opens offline and repeat visits are instant | None; no web manifest | M |

### Online play

| Priority | Item | State today | Effort |
|---|---|---|---|
| Must | Filter guest names typed when joining a room | Usernames are filtered; guest names are only trimmed, and are shown to the host and kept in their history | S |
| Must | Two real phones on mobile data: a full friend match, a rematch, a mid-match tunnel or lock screen, a rejoin | The emulator and live smoke tests cover the happy path | S |
| Should | A soak test of Find Match with bots on (20 to 50 simulated searchers) | Functions capped at 10 instances | M |
| Should | A "report this player" action on the results screen and profile | None; only a per-match emote mute | S–M |
| Nice | Reconnect that resumes straight into the match after an app restart | A "Resume match" button on the menu | M |

### Analytics you will need

| Priority | Item | State today | Effort |
|---|---|---|---|
| Must | First-run funnel: opened → first tap → first move → first claim → match finished → second match | Device funnel exists (open, start, finish, another) but not the first-match steps | S–M |
| Must | Retention by install cohort: D1, D7, D30 | Next-day and 7-day by device, from a log pruned at 90 days; no cohorts, no D30 | M |
| Must | Platform and client version on the dashboard | Recorded, not shown | S |
| Should | Rematch taps and matches started from a rematch | Not tracked | S |
| Should | Share taps (result, invite) and invite sent → joined | Not tracked | S |
| Should | Find Match wait time and how often a bot fills in | Not tracked | S |
| Should | True first-mover win rate per mini-game square | Only X against O | S |
| Should | Error rate per session and per version | None | S |
| Nice | Local Race-mode squares flagged correctly (`checkEnd` drops the flag from phone reports) | Counted as Shared | S |

### Store listing

| Priority | Item | State today | Effort |
|---|---|---|---|
| Must | Continue with Apple switched on | `apple: false` for both projects, so the button is hidden. Apple's rules ask for an equivalent privacy-focused sign-in (Sign in with Apple is the usual answer) wherever a third-party one such as Google is offered | S–M |
| Must | App Store screenshots | A script exists (`npm run app-shots`); none captured | S |
| Must | Name, subtitle, description, keywords, support URL | Nothing drafted; see below | S |
| Must | Age rating questionnaire answered on purpose | Open; the project notes already flag simulated gambling | S |
| Must | App Privacy labels refreshed | The draft is stale in two places: it says deletion is not built and devices are not swept; both now are | S |
| Must | `APP_STORE_ID` set | Empty, so "Please update" opens the App Store's front page | S |
| Must | TestFlight checklist in `docs/ios-plan.md` worked through (section 5; section 8 now has the 1.20.0 steps and the phone checklist) | Boxes unchecked; the 1.20.0 audit ran in Chromium only, so WebKit, the native sheets and real haptics are still to check on a phone | M |
| Should | A privacy manifest (`PrivacyInfo.xcprivacy`) | Absent | S |
| Should | iPad checks (all orientations, Split View) | Not recorded | S |
| Nice | A 20-second App Preview video | None | M |

Draft listing text, to edit:
- **Name**: Tic Tac Chaos
- **Subtitle** (30 characters or fewer): Every square is a mini-game
- **Promotional line**: Tic-tac-toe got out of hand. Win a mini-game to claim a square. Three in a row wins.
- **Description**: Tic Tac Chaos is tic-tac-toe where every square is its own mini-game. Roll, race, guess, aim and bluff your way to three in a row. Play the computer, pass the phone, or send a friend a code and play online in seconds. Quick matches. No ads. Dozens of mini-games, with more arriving.
- **Keywords** (100 characters or fewer): tic tac toe,mini games,two player,party,friends,versus,noughts,crosses,quick,casual,board,puzzle
- **Screenshots, in order**: the board mid-match ("Every square is a mini-game"); a mini-game in play; the KAPOW claim stamp; Play a Friend with a code; a grid of game icons; the win screen and share card.

### Legal and privacy

| Priority | Item | State today | Effort |
|---|---|---|---|
| Must | Revoke the Sign in with Apple token when an account is deleted | Marked "still to do" in the project notes; not in `deleteAccount` | S–M |
| Must | A real, monitored privacy and support mailbox | `privacy@tictacchaos.com` is a placeholder | S |
| Must | Privacy policy matches what is collected | It omits the "Report a problem" note, reactions, guest names and the tester tag; deletion leaves device logs until they age out at 90 days, which should be said | S |
| Must | Report and block for user-made content (usernames, guest names) plus a contact route | Apple asks for filtering, reporting, blocking and contact details where users can see each other's content. Filtering exists for usernames only | M |
| Should | Terms of Service | None | S |
| Should | A position on children: the policy says "not for children under 13" but there is no age question | Needs advice, especially with a low age rating | S (a decision) |
| Should | A position on consent for the anonymous device ID in the EU and UK | No banner or choice today | S (a decision) |
| Nice | Fix the stale line in `docs/ios-plan.md` section 2 (it still says the privacy policy page "doesn't exist yet") | Stale | S |

### Support

| Priority | Item | State today | Effort |
|---|---|---|---|
| Must | A feedback or contact link in Settings and on the store page | None in the game; a support URL is required for the listing | S |
| Must | "Report a problem" available outside a match | Only while a match is on screen | S |
| Should | The report dialog tells the truth | Says "Thanks" whether or not the send worked | S |
| Should | Reports reach a person: an email or alert on each | Flagged in the admin inspector only; nobody is told | S |
| Nice | A short known-issues and "what's new" page | None | S |

---

## Appendix: the numbers

All simulated figures: computer against computer, Normal against Normal unless stated, the 19 released games (`ttt c4 bs wordle hangman hilo snakes memory candy bump coins pig hunt mastermind bj bus rl craps wheels`).

**Classic, whole matches**

| Run | Matches | Turns: median (10%–90%) | X wins (decided) | Draws | Winner trailed | Trailed by 2 | Loser also threatening | Loser shut out | First claim (median turn) |
|---|---|---|---|---|---|---|---|---|---|
| Normal v Normal | 300 | 50 (31–74) | 52.7% | 7.0% | 52% | 16% | 18% | 14% | 11 |
| Normal v Normal (second run) | 200 | 48 (30–67) | 52.8% | 3.5% | 50% | 17% | 14% | 19% | 12 |
| Hard (X) v Normal | 150 | 51 (30–73) | 61.2% | 10.7% | 52% | 20% | 22% | 16% | 11 |
| Normal (X) v Easy | 150 | 39 (26–59) | 75.3% | 2.7% | 51% | 17% | 8% | 19% | 8 |
| Normal v Normal, Race mode on | 200 | 44 (27–66) | 54.5% | 4.5% | 46% | 7% | 6% | 23% | 11 |

**Classic, per game** (200 matches; winner's own moves in the square)

| Game | Squares won | Winner's moves | Won on first move | Won in ≤ 2 | With Race on: moves / first move / ≤ 2 |
|---|---|---|---|---|---|
| Coin Flip | 98 | 2.6 | 23% | 58% | (2 flips: 3.5 / 3% / 34%) |
| Treasure Hunt | 81 | 2.0 | 27% | 72% | 3.0 / 6% / 23% |
| Five Letters | 73 | 2.0 | 29% | 77% | 2.8 / 0% / 32% |
| Candy Race | 73 | 4.9 | 0% | 1% | |
| Higher/Lower | 72 | 2.9 | 17% | 43% | 3.6 / 11% / 20% |
| Snakes and Ladders | 72 | 4.8 | 0% | 8% | |
| Hangman | 70 | 3.3 | 0% | 26% | 6.0 / 0% / 0% |
| Bump | 70 | 5.5 | 0% | 0% | |
| Krabs | 65 | 5.0 | 0% | 0% | |
| Little Wheel | 65 | 4.6 | 0% | 20% | |
| Codebreaker | 64 | 2.5 | 17% | 53% | 3.7 / 0% / 4% |
| 21 | 61 | 4.8 | 0% | 0% | |
| Risky Rolls | 57 | 5.5 | 0% | 0% | |
| Risky Spins | 46 | 5.7 | 0% | 2% | |
| Ride the Bus | 38 | 6.9 | 0% | 0% | |
| Tic-Tac-Toe | 37 (48 drawn) | 3.2 | 0% | 0% | |
| Find the Pair | 36 | 4.1 | 14% | 28% | 3.7 / 13% / 20% |
| Four in a Row | 33 | 8.2 | 0% | 0% | |
| Sea Battle | 29 | 2.7 | 21% | 52% | 4.8 / 0% / 0% |

**Super Chaos, whole matches**

| Run | Matches | Rounds: median (10%–90%) | Empty rounds | Same square | Both-won resets per match | Loser shut out | Winner trailed | Line-each draws |
|---|---|---|---|---|---|---|---|---|
| Released Super Chaos games | 300 | 29 (16–46) | 77% | 48% | 1.54 | 26% | 41% | 2 |
| Own-progress games only | 200 | 24 (16–42) | 82% | 60% | 0.56 | 41% | 37% | 3 |

**Scripted play in the page** (the script acts instantly, so times are presentation only)

| Match | Result | Turns or rounds | Time | Where the time went |
|---|---|---|---|---|
| Classic v Easy | won | 16 turns each | 159 s | computer's turn 56%, own animations 32%, choosing 12% |
| Classic v Normal | lost 0–3 | 11 | 96 s | 62%, 25%, 14% |
| Classic v Hard | lost | 25 | 215 s | 61%, 26%, 13% |
| Super Chaos v Normal | won | 40 rounds | 286 s | waiting 34%, replays 45%, results 5%, own animation 3%, choosing 12% |
| Super Chaos v Easy | won | 25 rounds | 209 s | waiting 32%, replays 47%, results 2%, own animation 7%, choosing 12% |

First-run path, measured: menu ready 1.3 s after load on a local server (392 requests, 4,849 KB uncompressed); 4 taps to a first move; 6.5 s from Start to the first possible move when the computer goes first; the side reveal closes itself after 2.9 s.
