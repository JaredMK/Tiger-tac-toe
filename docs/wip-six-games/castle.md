# Castle Smash (`castle`): the builder's report

Branch `g/castle`, worktree `/home/user/g-castle`.

## 1. CLAUDE.md paragraph

- Castle Smash (`castle`, December 2026, Admin only, skill, `realTime`; `CLIENT_VERSION` and its `minVersion` 1.30.0): each player has a castle (stone bricks and cubes, timber posts and a roof beam, round a crystal on a stone perch) and a catapult standing before it. The two castles of a square are dealt as one and the same (`castle/sim.js` `castleDeal`: three plans, the keep, the hall and the bastion, on a grid of 16 over a footprint of eight columns, `layers` 4 high, stone on the timber roof over the crystal always) and each is kept as its ATTACKER sees it (the shooter throws to the right, `CS`: the scene 520 wide, the catapult's release point, the castle's `foot`, its `yard`; O's shot is the same picture turned round by the view): `mini.c[p]` is the castle p DEFENDS, a list of blocks `[kind, x, h, angle(, hits)]` (`KINDS`/`K`: brick, cube, post, beam, core; tenths of a unit, thousandths of a radian, the hard hits a cracked stone has taken), `n[p]` the shots thrown, `last` the shot and what came of it (`kind` 'hit' | 'short' | 'long', `core`, `broke`, `off`, `cracked`, `moved`, `ms`). A move is one shot `{ aim, power }` (`castleMove`: the elevation 0.12 to 1.45 rad, the power 0 to 1, three decimals; anything else refused), played out by the rules themselves on Matter.js (`castleShot`: the server's online, so it is NOT held out of Find Match; the library is the physics games' own, `PHYSICS.lib.Matter`, which `physics-sim.js` `makePhysics` now hands back, and without it Castle Smash is not dealt, `core/match.js` `dealable`, as Pool is not): the flight is plain arithmetic a step at a time (`CS.hz` 120 steps a second: a stack sags four times less than at 60) until the boulder comes within reach of the castle or lands in its yard (`CS.zone`), a boulder that lands short or flies past being a dud that simulates and moves nothing; then a world of the ground, the TARGET castle's blocks as they lie and the boulder (the shooter's own castle is scenery), stepped until all is at rest (the boulder crumbles `CS.life` steps after its first knock; `CS.cap` at most; Matter's resting threshold set for this world and the other tables' put back after). A knock's punch is the speed two bodies close at times the weight of the one that strikes (the boulder 1.5, a brick 1, a cube 0.5): timber breaks at `woodTough` 5 from anything; stone is cracked by the boulder alone at `stoneTough` 4.5 (one hard hit a shot for a block) and crumbles at its `stoneHits` 2nd; a block whose centre leaves the yard is gone. The crystal ends when the boulder ('hit') or a block ('crush') strikes it with a punch of `coreTough` 5.5 or more, when it has dropped `CS.drop` 9 below where it stood, off its perch ('fell'), or leaves the yard: the first to end the other's takes the square. A castle only ever loses blocks, so a player shooting alone always wins; a block that ends within `CS.eps` of where it lay keeps its place exactly (a miss leaves a castle as it was, a standing wall never creeps). Go again on success (off by default): a shot that breaks a block or knocks one out of the yard shoots again. Nothing is hidden and nothing is by chance. The recording never rides the square (a WeakMap beside `last` until `moveFlash`): the flash carries it as `phys` (`rec`: 30 frames a second, the boulder's place in every frame and each knocked block's poses from the frame before it moved to its rest, as differences packed into text, `pack`/`unpack`, 1 to 3 KB; `ev` the events hit, knock, crack, break, off, core, end, thud; `was` the castle before), and `core/records.js` already keeps only the latest entry's `phys.rec`. The view (`castle/view.js`, a canvas on `ui/stage.js`; `CSV`, `rules.js` `CST`: pull 520, swing 140, hold 450, win 700, burst 620): one scene, X's castle at the left and O's at the right, a banner in its owner's colour behind each, the catapults between (an arm on a wheeled frame, a spoon at its long end, a weight box in its owner's colour at the short one); a phone too narrow for the scene looks from the shooter's catapult to the castle it throws at (`CSV.win` 362 units, the camera easing across as the turn passes), a wide one sees it all. A drag back from anywhere on the scene draws the arm back (power by the pull's length, `CSV.pull` 0.36 of the scene's smaller side for all of it) and shows the first `CSV.arc` 27 steps of the flight as dots in the shooter's colour, never the landing; letting go flings. Online the mover's phone runs the same simulation at once on the castle as it has it and plays that (`pend.ph`), and the server's flash carries on from the same moment (`leadOf`: this phone's own shot is ahead of its flash's clock by the pull it never shows and by the record's lag; the flash is ended as its picture ends, `skipFlash`); the result is the server's alone. Someone else's shot first draws the catapult back, then plays the same from the flash (`replay.synth` gives none). The dust, the splinters, the rubble, a crack's flash and the crystal's burst are pictures of the time since their events; a cracked stone shows its cracks from its moment on; words only in the reserved `.csline` (`ownLine`); each tally a count of shots that turns over as the boulder leaves. Sounds, each once from the simulation's events: `csPull`, `csFling`, `csWhoosh`, `csKnock` / `csWood` / `csThump` by what was struck (played faster the harder), `csCrack`, `csBreak`, `csCrumble`, `csOff`, `csSmash`, `csDud`. The miniature: both castles block for block as they lie, the crystals, a drawn mark by each (`.tcs`). The computer (`castle/ai.js`): throws through the core, the roof over it and the facing wall at a spread of elevations (`castleCands`), each run through the simulation in coarser steps (`quick`: 60 a second, no recording: a third of the work, the same verdict 97 times in 100) and scored by the shield it takes from the core (`castleShield`), the blocks it breaks, cracks or knocks out; the scores kept while a castle lies unchanged (`KEPT`: a board of castles costs only the one just struck); then its hand's error in aim and power (Normal `aiAim` 40 mrad, `aiPow` 4%; Easy 80, 8% and three of the candidates; Hard 20, 2%, a look a little flatter, steeper, softer and harder about its best, and the best of `aiTries` 4 unsteady throws, inside `ctx.until`); worked out on the page's thread (`ui/think.js`, as the physics games': the worker has no Matter). Numbers (`tests/sim/castle.sim.js`): SEE SECTION 3. `tests/games/castle.test.js` (the deal, the move's validation, the flight, a fresh castle standing, the same shot twice, the castle saved against the simulation's end and the recording, the packing, the crystal's three ends, timber, cracks and the yard, Go again, the flash and the online record, the computer, winnable alone, whole squares), `tests/ui/castle.test.mjs` (the screen's rows, the miniature, a recorded pose, the sounds).

## 2. SOUNDS.md row

| Castle Smash (December 2026) | `csPull` / `csFling` / `csWhoosh` / `csKnock` / `csWood` / `csThump` / `csCrack` / `csBreak` / `csCrumble` / `csOff` / `csSmash` / `csDud` | All new, synthesised, each once from the shot's own events (`castle/sim.js`): the rope drawn back (a low sawtooth creak 92→132 Hz under a narrow band of rising noise; as the drag begins here, at the move's start for someone else's shot), the fling (a wooden thwack, a triangle 210→120 Hz with a tick, into a rising rush of noise; played faster for a harder throw) and the flight's whoosh (a band of noise falling 1500→520 Hz); then a knock for each of the boulder's hits and the blocks' own by what was struck, faster the harder: stone (a sine 170→95 Hz with a click of noise), timber (a triangle 330→210 Hz), the ground (a low thump 105→58 Hz under lowpassed noise); a stone cracking (three quick ticks of falling noise over a low thud), timber breaking (a snap of noise, a square blip 420→180 Hz, a falling triangle and a rattle), stone crumbling (a rumble of lowpassed noise 520→180 Hz with four falling thumps), a block knocked out of the yard (a short rising puff), the crystal's end (a bright crack of noise and a low boom under six falling triangle chimes and a fizz) and a dud (a dull thump with a low falling note; the error buzz) |

## 3. Sim numbers

`npm run sim -- castle` (`tests/sim/castle.sim.js`; the machine was shared with six other builders, so the variants were run
at 40 squares each, `CASTLE_SIM_N=40`: a rough picture, the first mover's share good to about 10 points there; the file's
own figure is 80).

| | turns each (mean / median) | the winner's (mean / median) | first mover | draws |
|---|---|---|---|---|
| **Normal v Normal, the defaults, 500 squares (asserted)** | **4.90 / 4.5** | **5.18 / 5** | **55.2%** | none (a square is never level) |
| a hand alone, 300 castles (Normal, Easy and Hard mixed; asserted) | 6.45 throws to smash a castle, the most 14 | | at the first throw 0.0%, within two 1.3% | |
| 3 layers | 4.41 / 4.5 | 4.72 / 5 | 62.5% | |
| 5 layers | 4.83 / 5 | 5.05 / 5 | 45.0% | |
| stone crumbles at its first hard hit | 2.64 / 2.5 | 2.95 / 3 | 62.5% | |
| stone takes three | 7.76 / 7.5 | 8.05 / 8 | 57.5% | |
| softer stone (cracked at 3.5) | 4.50 / 4.25 | 4.80 / 4.5 | 60.0% | |
| harder stone (6) | 5.88 / 5.5 | 6.10 / 6 | 45.0% | |
| tougher timber (8) | 6.29 / 6 | 6.53 / 6 | 47.5% | |
| a softer crystal (3.5) | 4.40 / 4.25 | 4.65 / 4.5 | 50.0% | |
| a heavier boulder (150%) | 2.67 / 2.5 | 3.02 / 3 | 70.0% | |
| a lighter boulder (70%) | 7.54 / 7 | 7.85 / 7 | 62.5% | |
| heavier stone (150%) | 6.05 / 5.75 | 6.35 / 6 | 60.0% | |
| a looser hand (70 mrad, 7%) | 5.92 / 4.75 | 6.28 / 5 | 70.0% | |
| Go again on success | 2.24 / 2 | 2.52 / 2 | 57.5% | |
| Hard v Hard | 4.42 / 4 | 4.67 / 4 | 50.0% | |
| Easy v Easy | 6.71 / 6.5 | 6.95 / 7 | 47.5% | |
| Hard v Normal (Hard first) | 4.01 / 3.75 | 4.40 / 4 | 77.5% | |
| Normal v Hard (Normal first) | 4.79 / 4.25 | 5.00 / 4.5 | 42.5% | |

Each castle is shot at by one hand alone, so the same question was also measured more cheaply while tuning: every layout
shot at alone by two hands, the pair compared (the first mover wins a tie). At the defaults, 150 layouts: 4.84 turns each
(median 4.5), the first mover 53.3%, the two hands level in 13.3% of squares; a Normal hand alone 6.2 throws (sd 2.3), no
castle at the first throw, 4 of 150 squares won at the second. Hard alone 4.8 throws (sd 1.5, 65 layouts: the two level in
23%, so about 61% for the first mover over many squares), Easy alone 8.0 (sd 2.8).

Targets: mean and median turns each within 3 to 6 (4.9 and 4.5), first mover within 45 to 60% (55.2% over 500), no win at a
first throw in any measured square at the defaults. Met.

`npm test`: every failure in my run was another game's wall-clock assertion ("under 60 ms", "Hard within its time":
bglite, connect 4, clash, districts, hangman, hex, hilo, mastermind, Risky Rolls, plinko) with the machine's load average
at 30 to 38; none involves Castle Smash, and its own tests (`tests/games/castle.test.js`, `tests/ui/castle.test.mjs`: 18)
pass. `node scripts/check-headers.js 360,390 cpu ttt,castle`: 0 problems. `node scripts/check-miniature-text.js
360x640,430x932 ttt,castle`: OK. `FLOW_GAMES=castle npm run test:flows`: 8 passed, 3 skipped, 1 failed
(`board-titles.test.mjs`, a page error from Pool; see section 5).

## 4. Shared-file edits outside the slots

Three one-line edits (plus the three slots: sounds, haptics, styles). Without them the game cannot run on Matter.js at all:

1. `src/games/shared/physics-sim.js`, the last line of `makePhysics`: the returned library now starts `{ Matter, GOLF, POOL, …`
   (one word). Castle Smash's own simulation (`src/games/castle/sim.js`) needs the Matter.js module itself, on the page, in
   Node's tests and in `functions/`, and the library the physics games register (`setPhysics`) was the only thing all three
   already hold; it did not hand Matter on.
2. `src/core/match.js` `dealable`: `… : t === 'castle' ? physicsReady() && !!PHYSICS.lib.Matter : true)`. A castle dealt before
   Matter.js has loaded (or offline with no copy) could never be shot at; it is now held back exactly as Pool is.
3. `src/ui/think.js` (the line that works the physics squares' tactics out on the page's thread before the worker is asked):
   `|| sq.mini.type === 'castle'` added to its condition. The worker has no Matter.js, so without this the computer would throw
   by geometry alone on the page (the fallback in `ai.js`), never by simulation.

Nothing else outside `src/games/castle/`, the tests and the slots. Not touched and worth a look when merging:
`scripts/help-text.js` / `docs/help-text.md` (the explainer and `goAgainText` are in `meta.js`), `CLAUDE.md`, `SOUNDS.md`.
The Online standing rule's "Physics games" sentence could name Castle Smash as the fourth game the server simulates.

## 5. Decisions and doubts

- **The online path: this phone's own prediction, then the flash (not the family's predict/join/settle).** `net/moves.js`
  `shotPredict` and `ui/physics.js` `physLaunch`/`physJoin`/`physSettle` are built round `PHYS_TYPES`, one canvas and
  `phys.rec.frames` of balls; joining them would have meant changes all through shared files. Instead the view itself runs
  the same `castleShot` on the castle as the phone has it the moment the finger lets go and plays that recording at once
  (`pend.ph`); when the server's flash arrives it carries on from the same moment (`leadOf`). The flight before the first
  knock is exact arithmetic on every engine, and the record normally lands during it, so the hand-over is not seen; if
  the server's simulation ever differs after that (another JavaScript engine's sin/cos in a chaotic pile), the picture
  jumps to the server's recording at that moment: there is no easing like `physSettle`'s. The result, the words, the
  count and the claim are the server's alone. A move the server refuses leaves the predicted picture on show until
  `pend` runs out (its length plus 6 s) and then the castle is drawn as the record has it: rare, but not pretty.
- **Stone has strength (a setting), not only weight.** With blocks that only move, the Normal hand's throws to win ran
  from 1 to 27 with a long tail (rubble round the crystal could shield it for a dozen throws) and one square in eight
  was won at the first throw. Now the boulder cracks a stone at a hard hit and crumbles it at the second (`stoneHits`),
  timber breaks at once, so every solid hit is progress: the tail went and so did the first-throw wins.
- **A knock's punch is closing speed times the striker's weight** (not the reduced mass, which made a thin post harder
  to break than a long beam). Stone is cracked by the boulder alone: a falling brick never cracks another.
- **The crystal is not ended by a mere touch.** It takes a punch of `coreTough` (a boulder at about a third of its top
  speed; a brick falling from five layers; never a cube), or dropping off its perch. A boulder that dribbles onto it, or
  a cube that settles on it, leaves it. It can be knocked askew and stay propped on rubble at its old height: it lives
  until struck or until it drops 9 units (seen in the screenshots: it reads a little oddly, but the rule is exact).
- **120 steps a second, coarser for the computer.** At 60 a stack of four stones sagged 2.5 units in Matter and every
  fresh castle "moved"; at 120 with 16 position iterations it sags under half a unit and a block within `CS.eps` (1
  unit) of where it lay keeps its place exactly. The computer's candidates run at 60 (`quick`), a third of the cost,
  the same verdict as the real run 97 times in 100 when measured: its choice is a little rougher than the truth, which
  suits a hand that is off anyway.
- **Cost.** A real shot is about 10 ms of CPU on this machine, a candidate 4 to 6; Normal weighs about 11 candidates
  once per castle state (kept after that), Hard 4 + 4 more runs each decision. On a phone the first decision about a
  fresh castle may take 150 to 300 ms on the page's thread (as Pool's does); a board of nine castles (Practice) pays
  that nine times on the computer's first turn, then only for the castle just struck.
- **The scene is narrower than first sketched** (520 units, the catapults 72 apart in the middle, each 138 from the
  castle it throws at) so that a 360 px phone shows the shooter's catapult and the whole target castle at about one
  pixel a unit. The shooter's own castle is off screen on a phone while aiming; the camera slides to it when the other
  side shoots. A screen 500 px wide or more shows the whole scene.
- **The tallies show shots thrown**, nothing else: a castle's state is the picture.
- **First mover.** Each castle is shot at by one player alone, so a square is two hands racing at the same job; the
  first to move wins the ties (the two needing the same number of throws, about one square in seven at Normal), which
  is its whole edge: 53 to 57% measured. No equal-turns rule was added (the owner's "first to destroy wins" stands).
  Hard against Hard is steadier (most castles fall in 3 or 4 throws), so ties are commoner there and the first mover's
  share higher: see section 3.
- **Tests' size.** "Winnable alone over a few hundred squares" is in the simulation file (300 castles, every one must
  fall), not in `npm test`: there 18 castles are shot at alone (every level, some 5 layers high) and 6 whole squares
  are played with random throws, because each computer decision costs dozens of simulations. `castle.test.js` takes
  about 8 s on a quiet machine.
- **`tests/flows/board-titles.test.mjs` is load-sensitive, and not through this game.** It failed once in the flows run
  here with a page error from Pool (`Cannot read properties of null (reading 'POOL')`), then passed three times in a
  row in this worktree; on the scaffold commit (no Castle Smash) it passed twice and failed once the same way
  (`… reading 'HOLES'`, Mini Golf). The test lays physics games on the board of a live Play Computer match on a page
  that has no Matter.js; when the computer is to move first and its worker has not answered within 2.5 s (a loaded
  machine), `ui/think.js` falls back to `cpuMove` on the thread with the board the test has since laid, and Pool's or
  Mini Golf's computer reads the missing library. Worth a guard in the test or in `physAi`, by the lead.
- **Not done / weak spots**: no easing when a prediction and the server's recording differ (above); no reduced-motion
  variant of the canvas (the flash still ends on time); the camera's slide between turns is not timed by the pace
  setting; the crystal propped on rubble (above); the dotted arc is the only read-out of the pull (no power meter);
  Easy differs from Normal mostly by its hand's error; the explainer and `goAgainText` are not yet in
  `scripts/help-text.js`.

## 6. Screenshots

All in `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/`:

- `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/castle-360-01-board.png` (the board, nine miniatures)
- `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/castle-360-02-open.png` (the square opened, 360x640)
- `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/castle-360-03a-aim.png` (a drag: the arm back, the dotted arc)
- `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/castle-390-03f0.png`, `castle-390-03f1.png`, `castle-390-03f3.png` (390x844: the boulder in flight, the roof coming down, at rest)
- `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/castle-360-03e-rest.png` (the computer's shot at X's castle: the camera on the other side)
- `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/castle-360-wood-01.png` (a beam broken, a cracked stone down)
- `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/castle-360-core-02.png` (the crystal's burst)
- `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/castle-360-core-zz.png` (the won square on the board)
- `/tmp/claude-0/-home-user/db029781-0ca4-5bc8-b932-a2903bf87bd8/scratchpad/shots/castle-360-08-explainer.png` (the "?" card; its words and icon were tightened after this shot)
