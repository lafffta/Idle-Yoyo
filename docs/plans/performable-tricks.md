# Performable Tricks

The interaction redesign #72 called for. The first 1A slice shipped a ladder of three Tricks, each landable once; the playtest found the manual opening boring and the harness found the ladder exhausted 7m 44s into a 1h 35m run. This slice makes a landed Trick performable forever, so that every Throw Cycle carries a live decision instead of a wait.

It is a redesign and not a retune. No constant reaches this: a spent ladder offers nothing at any drain multiplier, and making Tricks land later would empty the opening further rather than fill it. See ADR 0015 and ADR 0016 for the decisions; this plan is what building them looks like.

## What #72 found

- The manual opening before the Auto-Thrower is slow and boring — and was boring *while* two of the three Tricks were on offer throughout it.
- The Auto-Thrower reads as **relief from boredom**, not as liberation. ADR 0002 wants automation to feel like the game opening up.
- Deterministic fatality communicates correctly. A lost Throw was read as the player's own mistake, not as randomness. **This works and must not change.**
- Brain Twister cannot supply a reason to remain engaged after automation, because it is a one-shot that lands 1m 33s after the Auto-Thrower and is then gone.
- The pacing suite was green throughout. A threshold cannot see a ladder empty.

## Player rules

- A Trick is **learned** by Landing it for the first time, which multiplies Style permanently exactly as today. Every Land after that **Performs** it.
- Performing pays Style immediately, proportional to the Spin the Attempt drains, at a premium over the rate that Spin would have earned by decaying. Never a flat amount, and never a second currency.
- The premium rises with the Trick's duration, so that committing a large block of Spin to one long Performance stays competitive with slicing it thin.
- The player chooses which landed Trick to Perform. `nextTrick` is unchanged and governs the learning frontier alone.
- Several Attempts may run in sequence within one Sleeper, one at a time. Partitioning a Throw's Spin across them is the decision the loop is made of.
- A Performance is previewed exactly, like any Attempt (ADR 0014). A failed one pays nothing and ends the Sleeper early; it costs no progress, because nothing was being learned.
- Nothing ever Performs on the player's behalf (ADR 0016).

## Shell experience

- Add a **performance menu** beside the existing ladder: two surfaces, one linear ladder that teaches in order and one list of what is already known.
- Show the exact predicted result per row, as the ladder already does — Spin remaining on landing, or the time until the Yoyo dies.
- Reuse each Trick's existing canvas animation and its reduced-motion presentation. No Trick needs new art to become performable.
- **Open question, deliberately unresolved:** whether the menu lists every landed Trick or only those currently affordable. Showing only the affordable ones keeps it short and turns the shrinking list into a readout of dwindling Spin, which is appealing, but it is a shell decision and the grilling declined to settle it in advance. Decide it against a running build.

## Simulation and persistence

- A Performance is the same mechanism as a first Attempt. Nothing in ADR 0014 changes: the drain still scales from the active Throw's decay, still reads the Gear the Throw snapshotted (ADR 0013), still resolves through an Absence, still cannot be cancelled or rescued.
- Style paid by a Performance is earned inside `advance` at the moment of Landing, through the ordinary simulation and with no offline branch.
- The premium rate is a per-Trick provisional constant, in `constants.ts` with the rest of the ladder (ADR 0009). Nothing derived is ever stored.
- No save migration should be required: `landedTricks` already holds what Performing needs. Confirm this rather than assume it, and if a version bump is needed, migrate with Style, Gear, Kit, the Throw on the string and the landed ladder untouched.

## Tuning contract

**This is the largest piece of work and the largest risk in the plan.** The simulated player currently never Attempts anything and lands the ladder only as a side effect, so `npm run tune` reports the same figures it did before Tricks existed.

Extend the harness with a player who Performs, and who partitions a Throw's Spin across Performances. Per ADR 0015 there is no greedy rule that solves this well — the same admission the Report already makes about purchases. **Find out whether the instrument can answer the question before building the shell on the assumption that it can.** If it cannot, that is the finding, and it stops this plan rather than being worked around.

The premium is the design's **only** free parameter, so the sweep has one dimension to search. Sweep it as `autoThrowerCost` was swept in #29. Report the band, not a figure.

Guards remain thresholds and directions, never timestamps, and the four existing ones in `pacing.test.ts` continue to hold. Add:

1. The player Performs at all — a ladder nobody Performs is the failure this slice exists to prevent.
2. Performing never dominates to the point that the optimal play is a clicker.
3. An absent player is never behind where the passive baseline says they should be (ADR 0016).

## Playtest checkpoint

Mirrors #72, which is the gate this slice exists to pass, and closes it. The two observations #72 could not record should be targeted specifically:

- whether players notice and land Rock the Baby without external instruction;
- whether players can explain why a given Trick is safe or fatal.

And the new ones:

- whether the opening still drags once every Throw Cycle carries a choice;
- whether the Auto-Thrower now reads as liberation rather than as relief;
- whether the partition is understood as a choice, or experienced as a chore.

If the loop is understood but the pace is wrong, retune against the harness. If Performing is not understood, or is understood and unwanted, that is an interaction finding and it comes back here rather than going forward into Retire.

## Deliberately deferred

- Lengthening the 1A ladder. It remains worth doing and is now content rather than a fix — deferred so a re-playtest can tell which change worked.
- Retire and additional Yoyos
- 2A–5A Divisions
- Structural Tricks
- audio and its settings
- physically simulated Trick animation
