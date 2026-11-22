# Split It (`pint`) — builder's report

Branch `g/pint`, worktree `/home/user/g-pint`.

## 1. CLAUDE.md paragraph

- Split It (`pint`, December 2026, Admin only, skill, `realTime`; `CLIENT_VERSION` and its `minVersion` 1.30.0): each player their own pints. A full pint glass carries the mover's drawn X or O at a height of its own (`mark[p]`: a share of the glass from its base, public, kept to 3 places, drawn between `markLo` 35% and `markHi` 70% with the rng at the deal and again, with the move's rng, after each of that player's attempts); `pts`, `n` (attempts), `last` ({ by, n, lv, mark, d the level less the mark, pts, from, to, ms the hold the level took, next who drinks next }). A move is one hold, `{ lv }`: the level left when the finger let go (0 to 1, 3 places; anything else refused). The level by the hold's time is the rules' own (`rules.js` `pintLevel(c, t)`, `pintDrunk`, its inverse `pintTime(c, lv)`, `pintSpeed`: the flow comes up to `rate` 50% of the glass a second over `PINT.ease` 320 ms as the glass tips, then runs on `PINT.gain` 20% faster with each second; a whole pint in about 1.9 s), the one function for the view, the replays and the computer. Within `tol` 3.5% of the glass of the mark's middle is a split (1 point), within `perfect` 1% a perfect split (2; never wider than `tol`), else nothing (note `soon` or `far`; a glass drunk empty, `lv` 0, always a miss, `empty`: the view lets go by itself there); a fresh pint and mark after every attempt; first to `goal` 3 (the points never pass it; no square on a first turn). "Go again on success" (off by default): any split keeps the turn (`again`, the header's `heldSub` "[name] goes again"). Nothing hidden or drawn but the next mark, so the mover's phone waits for the record online (not `predictable`); where the drink stopped is the phone's word (the server cannot time a finger letting go), so it is **held out of Find Match** (`FIND_MATCH_HOLD` `'pint'`). A timeout plays nothing (`timeoutClose` null: a hold not let go is no attempt). The computer knows the hold for its mark and lets go early or late by its level's timing error (`aiMs` 120, `aiMsHard` 90, `aiMsEasy` 170 ms, a normal spread, never under 20: 39%, 50%, 29% of pints split, 12%, 16%, 8% perfectly); `needs` from a Normal hand's odds at a middling mark (`ai.js` `odds`). Normal v Normal 4.1 turns each over 500 squares (median 3.5; 4.3 and 4 over 6,000), the winner 4.4, first mover 54.6%, 15% of squares within the winner's two turns; Hard v Hard 3.3 (56%), Easy 5.8 (54%), Hard first against Normal 68% (`tests/sim/pint.sim.js`; 2 points: 2.6 turns; 4: 5.9; a split within 5%: 3.4, 57%; a drink at 70%: 5.5). The view (`pint/view.js`, a canvas the size of its box on `ui/stage.js`, the scene `PINV.w` 100 by `PINV.h` 92 stood on the box's foot): an original comic fellow in a bobble hat and a striped jumper, seen from the side, holding the glass out in front of him (`drawFellow`, `drawArm`, `drawHand`); the glass (`GLASS`: a plain tapered pint glass with a thick base, no logo; a dark drink under a pale head) is seen from a little above (`GLASS.k` 0.27: a level circle shows as a flat ellipse), its mark printed on its front on a thin ring. The drink is worked out, not faked: the glass's side view tipped by the angle between glass and drink keeps the drink's share under a level line (`surface(psi, L)`, bisection over the clipped shape), and the glass tips just as far as brings the drink to its lip (`pour(L)`: 24° at 90% left, 54° at 70%, 67° at half; no further than `GLASS.max`), so the surface stays level while the ring and the mark tip, and the level against the mark is honestly hard to read. The hold is the press and the release themselves (pointerdown on Hold to drink or anywhere on the scene, pointerup anywhere, Space or Enter on the button; `data-act="pint-hold"` does nothing), real time whatever the Animation setting; `aim` phases 0 ready, 1 holding, 4 sent (the glass held at the mouth until the record lands); the head goes back with the glass, a gulp every `PINV.gulp` 190 ms. From the release (`PINT`: `up` 300 the glass back upright, `settle` 700 the drink sloshing to rest (`PINV.swing`, `fade`, `wave`), `say` 400, `hold` 520, `next` 440): the verdict only once the drink is still: a pointer at the level against a bracket of what counted about the mark (white the split, green the perfect split), the level's front arc dashed across, a burst round the mark for a perfect split, the fellow's face (a foam moustache from the first sip), the words in the reserved line (`.pntline`: "Perfect split!", "Split!", "Too soon", "Too far"), the points' pips filling one after the other (`PINV.point`, `PINV.pip`); then the glass drops out of the scene and a fresh pint slides up with the mark of whoever drinks next (`last.next`; none on a won square, whose review shows the last glass and its verdict). This phone's flash starts at the release (its hold was live: `skipFlash` at its own end); someone else's plays their hold first for the move's `ms` (`pintPre`), `replay.synth` gives none, `ownLine`. Sounds `pnGulp`/`pnStop`/`pnSlosh`/`pnSplit`/`pnPerfect`/`pnMiss`/`pnSlide`; a tap buzz at the press and the release, the verdict's buzz from its sound (`pnSplit`, `pnPerfect` results; `pnMiss` bad). The words say pint, glass and drink alone: no drink, brand or alcohol is named (held by its test). The miniature: the glass as the last attempt left it (a full one before any) with the mover's mark on its ring, beside each player's points as pips (`.tpntw`, `.tpnt*`). `tests/games/pint.test.js`, `tests/ui/pint.test.mjs` (the drink's share kept at every tip, the pour at the lip; the screen's states, the sounds, the miniature), `tests/sim/pint.sim.js`.

Also for the lists in the notes: `FIND_MATCH_HOLD` already ends `… 'pint', 'jigsaw', 'hive'` (the scaffold); "Go again on success" now also covers Split It (its own test in `tests/games/pint.test.js`; `tests/core/go-again.test.js`'s list is untouched).

## 2. SOUNDS.md row

| Split It (December 2026) | `pnGulp` / `pnStop` / `pnSlosh` / `pnSplit` / `pnPerfect` / `pnMiss` / `pnSlide` | All new, synthesised. A gulp while the drink goes down (a sine dropping 210→120 Hz over a breath of filtered noise, its pitch varied; on this phone every 190 ms of the hold, a little higher as the glass empties; for someone else's attempt the same through the hold as it is shown) and the gasp as the glass comes away (a tick and a falling breath of noise; the hold's own sounds, never the interface's click); then, from the attempt's own moments (`pint/rules.js` `PINT`), once: the drink sloshing to rest as the glass comes upright (three swells of band-passed noise, each softer), the verdict as the drink settles: a split's chime (two triangle notes, 880 and 1320 Hz), a perfect split's run (four rising triangle notes with a high shimmer), or a miss's low note (a triangle falling 233→150 Hz over a low sine); and the fresh pint sliding up into the hand (a rising hiss and a glassy tick). `pnSplit` and `pnPerfect` are result sounds (the medium buzz), `pnMiss` a bad one (the error buzz), on this phone's own attempts alone. |

## 3. Sim numbers (`npm run sim -- pint`)

Defaults: 3 points, a split within 3.5% of the glass, a perfect split within 1%, 50% of the glass a second, marks 35–70%, timing errors 120 / 90 / 170 ms (Normal / Hard / Easy).

| | turns each (mean / median) | the winner's (mean / median) | first mover | draws |
|---|---|---|---|---|
| Normal v Normal, 500 squares (asserted) | 4.09 / 3.5 | 4.36 / 4 | 54.6% | 0 |
| Normal v Normal, 6,000 squares | 4.26 / 4 | 4.53 / 4 | 54.4% | 0 |
| Hard v Hard | 3.31 / 3 | 3.59 / 3 | 56.2% | 0 |
| Easy v Easy | 5.82 / 5.5 | 6.09 / 6 | 53.6% | 0 |
| Hard (first) v Normal | 3.62 / 3.5 | 3.96 / 4 | 68.1% | 0 |
| Normal (first) v Hard | 3.75 / 3.5 | 3.96 / 4 | 42.2% | 0 |
| Normal (first) v Easy | 4.83 / 4.5 | 5.17 / 5 | 68.9% | 0 |
| 2 points | 2.55 / 2 | 2.82 / 2 | 55.5% | |
| 4 points | 5.88 / 5.5 | 6.15 / 6 | 53.6% | |
| 5 points | 7.54 / 7 | 7.81 / 7 | 53.5% | |
| a split within 2.5% | 5.31 / 4.5 | 5.58 / 5 | 53.9% | |
| a split within 5% | 3.36 / 3 | 3.65 / 3 | 57.1% | |
| a perfect split within 0.5% | 4.76 / 4.5 | 5.04 / 5 | 54.6% | |
| a perfect split within 2% | 3.64 / 3.5 | 3.92 / 4 | 55.9% | |
| a slower drink (35% a second) | 3.28 / 3 | 3.57 / 3 | 56.4% | |
| a faster drink (70% a second) | 5.52 / 5 | 5.79 / 5 | 53.6% | |
| marks high (60–85%) | 4.00 / 3.5 | 4.27 / 4 | 54.6% | |
| marks low (30–45%) | 4.42 / 4 | 4.69 / 4 | 54.0% | |
| Go again on success | 2.90 / 2.5 | 3.17 / 3 | 54.5% | |

An attempt by level (20,000 each): Easy a perfect split 8.4%, a split 20.2%, 0.37 points; Normal 12.1%, 27.2%, 0.51 points; Hard 15.8%, 34.6%, 0.66 points. Misses fall evenly either side (too soon about half of them). No square is won on a first turn (3 points, 2 at most a pint); 15% are won within the winner's first two turns (a perfect split and any split).

Targets met at the defaults: mean 4.1–4.3, median 3.5–4, first mover 54–55%. Go again on (off by default) runs under 3 turns.

## 4. Shared-file edits outside my slots

None. (Inside the slots: `src/audio/sound.js` `[pint]` seven `def`s; `src/ui/haptics.js` the two `[pint]` lines; `src/ui/styles.css` `[pint]` block.)

## 5. Decisions and doubts

- **The level is the top of the drink** (the top of the pale head), a share of the glass's inside height; the mark's glyph sits on the front of its ring, and the verdict's pointer and bracket are drawn at the glass's side at those same heights. The head is a thin band (about 5% of the glass), so the dark line is always a little under the level: the verdict's pointer is what settles it.
- **The fall**: gentle for the first 320 ms (the glass on its way to the mouth), then steady and 20% faster a second, so low marks are a little harder than high ones (4.4 turns against 4.0 in the sim). `PINT.ease` and `PINT.gain` are constants in `rules.js`, not settings (the `rate` setting is the one speed knob); say if they should be.
- **Tolerances** are shares of the glass (settings in %): a split 3.5% either way, a perfect one 1%. On a 360 px phone the glass is about 165 px tall, so a split is about ±6 px and ±65 ms, a perfect one ±2 px and ±19 ms. Whether a person finds that fair is for real play: the computer's 120 ms stands in for a finger and an eye together, and the settings are there (a split within 5%: 3.4 turns each).
- **The settings' ranges**: marks between 30% and 85% of the glass (below 30% the fellow's hand would cover the mark); a range entered the wrong way round is swapped; a perfect tolerance wider than the split's is held to it; the computer's error is never under 20 ms.
- **An accidental tap is an attempt** ("Too soon"), as in Key Drop. A `pointercancel` or the window losing focus mid-hold lets go there, as in Key Drop.
- **Online**, between the release and the server's record the glass waits at the mouth (phase 4), then straightens: with a warm call about 70 ms, unnoticeable; on a slow connection the fellow holds his pose a moment.
- **"The points never pass the goal"**: a perfect split at 2 points shows 3, not 4.
- **Within two turns**: 15% of Normal v Normal squares end in the winner's first two pints (a perfect split, then any split). The brief says "no square won in a player's first turn or two as a rule"; none on a first turn, and I left the two-turn finish in rather than drop the 2-point perfect split the owner asked for. `goal` 4 removes most of it (5.9 turns each).
- **The miniature's mark** is the last drinker's (a full glass with a bare ring before any attempt): the miniature is not told whose turn it is.
- **`npm test` on the shared machine**: all of mine pass (`tests/games/pint.test.js` 8, `tests/ui/pint.test.mjs` 4, and every registry, miniature, replay, explainer and admin test that walks the games); the last full run: 1,619 tests, 1,612 pass, 6 fail, every one a wall-clock assert of another game's Hard computer (connect 4 "a Hard move in 309 ms", districts "under 60", hangman twice "never slow", plinko "under 150 ms", wordle "never slow"; an earlier run failed blackjack, districts, hangman, hilo and plinko the same way), with the machine's load average at 9 to 20 from the other builders: they pass or fail by load, not by this branch.
- **`FLOW_GAMES=pint npm run test:flows`**: the four flows that play pint pass (against the computer, Same phone, online with timer none and m5+5; the Race ones skip). `tests/flows/board-titles.test.mjs` (every game's title, not pint's flow) failed twice here with one page error, "Cannot read properties of null (reading 'HOLES')": Mini Golf's code reading the physics library before it is in (`PHYSICS.lib` null; that test's own server has no `/matter.min.js` in a plain checkout and it blocks the CDN). Nothing of pint's is in it; I did not chase it (not my files). Worth a look by the lead if it shows on the merged branch too.
- `node scripts/check-headers.js 360,390 cpu ttt,pint` and `node scripts/check-miniature-text.js 360x640,430x932 ttt,pint`: both clean. No scrolling at 360x640, 390x660, 390x844, 430x932; no page errors in any browser run.
- Not done: `docs/help-text.md` wants a fresh `npm run export:help` after the merge (the stand-in's explainer is gone); nothing in `CLAUDE.md`, `SOUNDS.md`, `docs/help-text.md` or `scripts/help-text.js` (the lead's): the explainer's text, `goAgainText.on` (" Split it? Go again.") and the result words ("Perfect split!", "Split!", "Too soon", "Too far", "Hold to drink") are in `meta.js` and `view.js`.

## 6. Screenshots

In `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/`:

- `pint-360-01-board.png`, `pint-390-01-board.png` (the miniatures, fresh), `pint-360-04-board-after.png`, `pint-360-09-board-won.png`
- `pint-360-02-a-fresh.png`, `-02-b-hold.png`, `-02-c-up.png`, `-02-d-slosh.png`, `-02-e-verdict.png`, `-02-f-next.png` (my attempt, stage by stage; the same for 390)
- `pint-360-03-cpu-a-hold.png`, `-b-hold.png`, `-c-verdict.png` (the computer's attempt replayed)
- `pint-360-05-*.png` (a miss), `pint-360-06-explainer.png`, `pint-360-07-*.png` and `pint-360-08-after-win.png`, `pint-360-10-won-square.png` (the winning pint, the won square reviewed)
- `pint-sizes-sheet.png` (390x660 and 430x932 beside each other: fresh, verdict, explainer, a hold, the winning verdict); every stage also as `pint-390x660-*.png` and `pint-430x932-*.png`
- `pint-low-sheet.png` (a whole attempt at a low mark frame by frame, Go again on, then a glass drunk empty), `pint-low-again.png` (Go again's header line)
- the scripts: `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/pint-shots.js`, `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/pint-low.js`
