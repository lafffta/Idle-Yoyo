# Idle Yoyo

An idle game in which the player throws a yoyo and earns Style while it spins at the end of the string. The theme is literal rather than decorative: a sleeping yoyo *is* the idle mechanic.

## Read these first

- **`CONTEXT.md`** — the domain glossary. Use its vocabulary in code, tests, commit messages and issues, and respect the _Avoid_ lists. They exist so that one idea has exactly one name.
- **`docs/adr/`** — eight architecture decision records. They record *why*, and several of them forbid things that would otherwise look like reasonable simplifications. Read the ones covering the area you are touching before you change it.

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
- Project skills live in `.claude/skills/` and load automatically — `/tdd`, `/codebase-design`, `/diagnosing-bugs` and others.

## Current state

The simulation core runs and is under test, headless — there is no shell yet. `advance` carries the yoyo through all three phases of the Throw Cycle, all three Gear stats are buyable, the readouts are derived from stats, and an Auto-Thrower re-Throws the instant the string is wound. Time away is the ordinary simulation run forward, and ADR 0002's parity claim is now an assertion rather than an intention.

The core-loop spec (#3) and all six of its tickets (#4–#9) are done, and nothing is ticketed after them. The spec names two candidates for what comes next: the tuning harness — every number in `constants.ts` is still a guess, and ADR 0005 wants run length measured against a simulated player rather than chosen — and the React and canvas shell, which carries its own hazard, namely that per-frame simulation state must never enter React state.
