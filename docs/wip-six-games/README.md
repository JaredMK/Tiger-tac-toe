# Work in progress: the six new games and Road Race's rework (saved 22 November 2026)

Saved here so it survives the cloud container; delete this folder once the games are merged, documented and deployed.

- `BRIEF.md`: the brief every builder followed.
- `<id>.md`: each builder's report (the CLAUDE.md paragraph, the SOUNDS.md row, the simulation figures, shared-file
  edits outside the slots, decisions and doubts). Tank Duel has no report yet: its builder stopped before writing it.
- Each game was built on its own branch (`g/<id>`) from the scaffold commit on `claude/six-games`; the commit that
  saved this folder merges all seven branches as they stood (the `WIP` commits on `g/tanks` and `g/rally` are the
  builders' uncommitted work, committed as found).

State when saved:
| Game | id | State |
|---|---|---|
| Split It | `pint` | done; report written |
| Letter Hive | `hive` | done; report written |
| Gem Swap | `gems` | done (stopped while writing the report, which is complete); first mover 60.5% at the defaults, an "Equal turns" switch (off) brings it to 48% |
| Castle Smash | `castle` | done as far as its report says; stopped during a last view pass (nothing uncommitted); 3 shared-file edits (physics-sim.js, match.js, think.js) |
| Puzzle Build | `jigsaw` | built and tested; first mover 72.6% and 58% draws at the defaults (the owner's 8-piece rule); suggests `centre` off |
| Road Race | `rally` | rework written, own tests pass; never committed by its builder (WIP commit); report written |
| Tank Duel | `tanks` | rules, AI, view, tests (8 pass) and sim written; never committed (WIP commit); no report, no browser check |

The mini-game review (`docs/mini-game-review.md`) was at Phase 1; the 300-square simulations of the 94 games already on
staging are in `docs/review-data/sim/` (Wall Race's run did not finish). Their first-mover figures come from
`scripts/audit/sim.js` and some disagree with the games' own simulations (e.g. Brick Break 82% here, 59% in its own
sim): check the harness against `tests/sim/<id>.sim.js` before trusting them.
