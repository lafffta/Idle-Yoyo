# Idle Yoyo

An idle game in which the player throws a yoyo and earns Style while it spins at the end of the string. The theme is literal rather than decorative: a sleeping yoyo *is* the idle mechanic.

## Read these first

- **`CONTEXT.md`** — the domain glossary. Use its vocabulary in code, tests, commit messages and issues, and respect the _Avoid_ lists. They exist so that one idea has exactly one name.
- **`docs/adr/`** — architecture decision records. They record *why*, and several of them forbid things that would otherwise look like reasonable simplifications. Read the ones covering the area you are touching before you change it.

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
- Project skills live in `.agents/skills/` and load automatically. Invoke one explicitly as `$tdd`, `$codebase-design`, `$diagnosing-bugs`, and so on.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues on `lafffta/Idle-Yoyo`. Use the `gh` CLI when the shell provides it, or the connected GitHub tools when they are available. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` and one `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Current state

The game is playable: the pure core, shell, save migration, honest Absence resolution, Gear and Kit shops, tuning harness, and first three 1A Tricks are implemented and tested.

The active direction is the interaction redesign in `docs/plans/performable-tricks.md`, governed by ADRs 0015 and 0016. A landed Trick becomes performable for immediate Style; Attempts remain deterministic, player-initiated activity inside a Sleeper. The largest unresolved risk is whether the tuning harness can model a player partitioning Spin across Performances. Settle that before building the shell around the assumption that it can.

Do not proceed into Retire yet. #72's playtest found that the one-shot ladder empties too early and makes the Auto-Thrower feel like relief from boredom rather than liberation. Preserve the deterministic Attempt behavior that playtesters understood; redesign the repeatable interaction, then playtest again.
