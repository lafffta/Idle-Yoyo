# Attempts scale from the active Throw's decay

An Attempt remains part of the current Sleeper: Style keeps accruing while a fixed-duration, Trick-specific multiplier increases the active Throw's Spin decay. This makes both Throw Power and the Bearing viable ways to make a Trick safe; a fixed extra Spin fee would make the Bearing incidental, while a separate non-earning phase would punish active play.

The outcome is deterministic when the Attempt begins and can therefore be previewed exactly. An Attempt cannot be cancelled, survives saving and loading, and resolves through an Absence using the ordinary simulation. Because it reads the timing Gear snapshotted by the Throw (ADR 0013), buying Gear during an Attempt cannot rescue it.

## Consequences

- Landing requires Spin to remain when the Attempt duration ends; reaching zero first produces a Dead Yoyo and teaches nothing.
- A player may knowingly choose a fatal Attempt, sacrificing the current Sleeper's remaining earnings to reach a fresh Throw sooner.
- Attempt progress belongs to the pure simulation core. The shell renders that state and never runs a second timer for it.
