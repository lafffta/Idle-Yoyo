# Attempts scale from the active Throw's decay

An Attempt remains part of the current Sleeper: Style keeps accruing while a fixed-duration, Trick-specific multiplier increases the active Throw's Spin decay. This makes both Throw Power and the Bearing viable ways to make a Trick safe; a fixed extra Spin fee would make the Bearing incidental, while a separate non-earning phase would punish active play.

The outcome is deterministic when the Attempt begins and can therefore be previewed exactly. An Attempt cannot be cancelled, survives saving and loading, and resolves through an Absence using the ordinary simulation. Because it reads the timing Gear snapshotted by the Throw (ADR 0013), buying Gear during an Attempt cannot rescue it.

Mach 5 adds the one Rewind exception anticipated by ADR 0003. It allows the player to commit an Attempt while the string is winding, but the Attempt waits without progress, Spin drain or Style until the next Sleeper begins. Its exact preview therefore describes that next Throw, and from the first instant of its Sleeper onward every rule in this decision applies unchanged. The commitment carries the raw Gear inputs needed to rederive its promised outcome until it resolves, so a later purchase cannot rescue it; derived Spin and decay remain unstored and respond to a rebalance. The actual Throw still captures the Gear then owned under ADR 0013, so those purchases affect its Throw Cycle without changing the commitment. The permission is derived from the landed Mach 5 fact; it stores no second effect or Uptime state.

## Consequences

- Landing requires Spin to remain when the Attempt duration ends; reaching zero first produces a Dead Yoyo and teaches nothing.
- A player may knowingly choose a fatal Attempt, sacrificing the current Sleeper's remaining earnings to reach a fresh Throw sooner.
- Attempt progress belongs to the pure simulation core. The shell renders that state and never runs a second timer for it.
