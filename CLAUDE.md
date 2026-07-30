# Idle Yoyo

An idle game in which the player throws a yoyo and earns Style while it spins at the end of the string. The theme is literal rather than decorative: a sleeping yoyo *is* the idle mechanic.

## Read these first

- **`CONTEXT.md`** — the domain glossary. Use its vocabulary in code, tests, commit messages and issues, and respect the _Avoid_ lists. They exist so that one idea has exactly one name.
- **`docs/adr/`** — fourteen architecture decision records. They record *why*, and several of them forbid things that would otherwise look like reasonable simplifications. Read the ones covering the area you are touching before you change it.

## Architecture

ADR 0008 is the shape of the whole codebase — a pure simulation core with a shell around it:

```
advance(state: GameState, seconds: number): GameState
```

The core has no dependencies, no DOM access and no clock of its own. Time is a parameter, never an ambient fact: nothing inside the core may call `Date.now()`. The same function is called every frame while the tab is open and once with a large delta when it is reopened. There is no third caller and no second implementation.

## Things that look like cleanups and are not

Each of these is load-bearing and defended by a test. If one looks redundant or arbitrary, read the ADR before removing it.

- **Segment-based integration, not fixed-step.** `advance` computes the time to the next phase boundary and jumps to it. A fixed-step integrator makes one long call disagree with many short ones, so time away and time watching silently diverge — exactly what ADR 0002 forecloses.
- **The Rewind period.** Dead time in the Throw Cycle is deliberate. Without it the decay rate cancels out of sustained earnings and the Bearing upgrade stops working entirely (ADR 0003).
- **The Rewind floor.** Rewind must never reach zero, for the same reason, and no permanent effect may touch the Uptime lever at all.
- **No offline branch.** There is no offline multiplier and no separate offline code path. Time away is the ordinary simulation run forward (ADR 0002).
- **Derived stats, never stored.** Effective Throw Power, decay rate and Rewind duration come from levels plus base constants. Storing them lets old saves drift out of sync with a rebalance.
- **Negative deltas clamp to zero.** Not anti-cheat — protection against clock corrections, timezone changes and daylight saving.

## Numbers

Every numeric constant in the game is currently a **placeholder**, not an authored value. ADR 0005 expects run length to emerge from the cost curves and be tuned against a simulated player rather than chosen by intention. Keep constants in one place and labelled as provisional.

## Working here

- Tickets live in GitHub Issues. `ready-for-agent` means grabbable; each ticket names what blocks it. Work the frontier — any ticket whose blockers are all closed.
- Branch off `main`.
- Tests go through the seam, not around it. Assert on behaviour a player could describe, never on internals. A test should survive the implementation being rewritten.
- **A caveat that names its own expiry belongs to a ticket.** Docblocks here are unusually honest about what was checked and when it stops being true — *"changes no figure at the constants as they stand"*, *"absolute for now because there is only one Yoyo"*. Keep writing them; that context is worth far more beside the code than in an issue. But a comment does not fail. When the trigger fires, nothing announces it, and the code goes quietly wrong in a way that still reads as considered. So if a comment names a condition under which it goes stale, cite the ticket that will catch it. #37 exists because one did not: it said it would bite as soon as the prices moved, the prices moved in #29, and only a code review noticed.
- Before filing an issue, search the tracker. Several sessions work this repo in parallel and will reach the same finding independently — six of eight open issues were once duplicates of two.
- Project skills live in `.claude/skills/` and load automatically — `/tdd`, `/codebase-design`, `/diagnosing-bugs` and others.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues on `lafffta/Idle-Yoyo`, reached with the `gh` CLI locally or the GitHub MCP tools in remote sessions. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` and one `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Current state

The game is playable. `advance` carries the yoyo through all three phases of the Throw Cycle, all three Gear stats are buyable, the readouts are derived from stats, and an Auto-Thrower re-Throws the instant the string is wound. Time away is the ordinary simulation run forward, and ADR 0002's parity claim is now an assertion rather than an intention. The shell spec (#45) and its nine tickets (#46–#54) are done: a canvas Throw Cycle, both shops, a save that survives the night and a save that cannot be read being kept rather than overwritten, and an Absence summary on return.

The core-loop spec (#3) and all six of its tickets (#4–#9) are done. The spec's own Out of Scope section is the list of what it deliberately left: the shell, save and load, Tricks and Retire.

The tuning harness spec (#18) is the one it recommended next, and all four of its tickets (#22–#25) are done: `simulate(timeline) → Report` in `src/tuning`, outside the core and outside the built output, driving a scripted player who buys whatever is worth the most Style per Style spent over the play they have left, and who will bank Style for a row they cannot yet afford (ADR 0010). The Auto-Thrower is one row of that shop like any other, so the player may decline it. `npm run tune` prints the Report, and `src/tuning/pacing.test.ts` holds the pacing guards — coarse, directional claims that fail if a later constant change quietly rots the opening.

**The first retune has happened, and it is the only constant in the game that is not a guess.** #29 asked first whether the finding — a first Auto-Thrower twenty hours into the run — was the price or the simulated player. It was the player: a policy that could not save never held the largest price in the game in one hand, so it measured whether 500 was met in passing rather than whether it could be reached. ADR 0010 fixed the instrument, which moved the figure to 26m 40s of play and made it a claim about the price. 500 was then 133% of everything a first Session can pay. `autoThrowerCost` was swept against the fixed harness and cut to 250: the machine now lands 13m 20s in, some 100 Throws by hand, with a third of the first Session to spare.

ADR 0002's promise is asserted rather than intended — `pacing.test.ts` guards that the machine is reached inside the first Session, as a threshold and never a figure. `FIRST_SESSION_SECONDS` is still an underived product assumption and every "within the first Session" judgement is measured against it.

**One finding is open and no ticket holds it yet.** At every price swept, from 500 down to 100, the player buys *nothing at all* before the machine — it is the best buy from the opening boundary and no price changes that, only how long the hoard lasts. So the manual opening ADR 0002 wants to protect is a stretch in which the shop goes untouched, and that is structural rather than a matter of tuning.

#34 has since found what that structure is. The harness values Gear over Session time only until an Auto-Thrower is owned, because nothing re-Throws the yoyo while the player is away — the honest model, and once recorded as changing no figure in any Report. It now decides the opening: with the condition removed the player buys seven levels of Throw Power before the machine and reaches it at 7m 48s instead of 13m 20s. So the untouched shop is a consequence of the model rather than of the price, which is why sweeping prices never moved it. What would fix it is untested — this ticket measured one deletion and no alternative.

**#34 asked the same question #29 did, and got the same answer: the player, not the price.** The check that found the condition inert ran at 500 *and* against a player who could not bank Style. Re-running it at 500 against the saving player shows the condition already deciding everything — the machine moves from 26m 40s of play to 11m 31s, and from the second Session into the first — so ADR 0010 is what made it bite and #29's price cut is incidental. It also means this condition is what #29 acted on: without it the harness would have reported a 500-Style machine inside the first Session and no retune would have been called for.

**Tricks have started arriving.** The first 1A slice (spec #66, plan `docs/plans/first-1a-trick-slice.md`) is the work between the shell and Retire, and #67 is its first ticket: Rock the Baby, landable on the opening Throw of a yoyo with nothing bought. An Attempt is activity inside the Sleeper and not a fourth phase (ADR 0014) — the yoyo goes on spinning and goes on earning, and the Trick multiplies the decay of the Throw already on the string for a fixed duration. Landing and fatal depletion are both segment boundaries, so ADR 0002's parity holds across them and a committed Attempt resolves through an Absence. Because the drain reads the Bearing the Throw captured (ADR 0013), Gear bought mid-Attempt is owned at once and cannot rescue the Attempt. The save is at version 3; every version 2 save migrates with Style, Gear, Kit and the Throw on the string untouched and the ladder unlanded.

All three rows of the ladder are defined, because the Division shows all three from the opening Throw, but only Rock the Baby's drain multiplier has been measured against anything: it costs 45 of an opening Throw's 100 Spin, so over half that Sleeper is safe. **The other two are guesses and the pacing contract is not yet guarded** — #68 and #69 land them, #70 names the resolved Trick in the Absence summary, and #71 is where the whole ladder meets the tuning harness. The simulated player still never Attempts anything, so `npm run tune` reports the same figures it did before Tricks existed.

#68 chains Man on the Flying Trapeze onto Rock the Baby. Nothing about the second row needed its own core mechanism — `nextTrick`, `attemptTrick`, `previewAttempt` and `advance` were already written generically over the whole ladder in #67, so the row was actionable, chained within the same Sleeper, and compounded its ×1.5 with Rock the Baby's ×1.25 without a line of core changing. What #68 added was its own authored motion: a bar overhead and one wide pendulum pass, distinct from Rock the Baby's cradle, drawn from the same `progress` core Attempt state and legible under reduced motion the same way. On the constants as they stand it stays a guess like Brain Twister — landing it needs Throw Power or the Bearing moved past the opening Throw's own Spin, which #71 is what will check against the tuning harness.
