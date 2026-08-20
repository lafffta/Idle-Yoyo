# The simulation core keeps its constants module-level

`advance` and the derived readouts read the provisional constants from a module-level object. They do not take them as a parameter, and there is no mechanism for running the core against a different set of numbers in the same process. Anything that wants to know what a different Auto-Thrower price would do edits `constants.ts` and runs again.

This is recorded because the tuning harness is the first thing to want otherwise, and the reasoning is easy to lose.

## Why

ADR 0008 fixes the core's shape as `advance(state: GameState, seconds: number): GameState`. That signature is named in the ADR, in `AGENTS.md`, and in the core-loop spec, and every derived readout follows the same pattern of taking a state and nothing else.

Threading a constants argument through it is not a local change. It reaches every function in the core, every call site, and every test — and it puts a second parameter on the one signature the whole codebase is organised around, so that a development tool can sweep a value. That is a wide refactor bought for the convenience of a tool that does not exist yet.

There is a real cost to *not* doing it, and it should be stated plainly: exploring a curve means editing a tracked source file once per candidate value. Twenty prices is twenty edits. The harness reports a point, not a curve.

We are accepting that cost on the grounds that the first useful question is not "what does this curve look like" but "are these numbers even roughly right" — and a point answers that. If sweeping turns out to be the bottleneck, this is a well-understood expand–contract refactor: add the parameter with a default, migrate call sites in batches, remove the default.

## Considered Options

- **Thread constants through the core** — the core takes its numbers as an argument, so a harness can loop over candidates in one process and report a curve. Genuinely what tuning wants. Rejected for now as a wide refactor across the entire core and its tests, incurred before anyone has felt the pain it removes.
- **Have the harness rewrite `constants.ts` and re-invoke itself** — real sweeps with no change to the core's signature. Rejected because a development tool that mutates tracked source is a sharp edge: it dirties the working tree, races with anything else editing the file, and turns a failed run into a repository to clean up.
- **Move the constants into `GameState`** — they would travel with the save and could vary per run. Rejected outright: it contradicts the derived-not-stored rule that the same core-loop spec relies on, and it would let an old save pin itself to numbers a rebalance had already replaced.

## Consequences

The core keeps one parameter list and one way to call it, and the purity guard keeps a small surface to defend.

Constants cannot vary per save, which is correct — they are properties of the game's balance, not of a player.

The tuning harness reads whatever `constants.ts` currently says and reports against it. That makes its output a statement about the game as it is configured today, which is what makes the report readable, and it means any comparison between two configurations is a comparison between two runs rather than two rows.

If this is ever reversed, reverse it deliberately and all at once. A core where some functions take constants and others reach for the module would be worse than either arrangement.
