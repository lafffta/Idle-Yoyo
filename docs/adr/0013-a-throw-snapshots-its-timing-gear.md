# A Throw snapshots its timing Gear

Gear is owned immediately, but the Throw Cycle already in progress plays out with the Gear it
began with. `GameState.activeThrowGear` records the Bearing and Rewind Speed levels captured by
`throwYoyo`; `advance` reads those levels until the next manual or automatic Throw captures the
owned levels again.

## Why

Throw Power already had this property because a Throw stores its starting Spin. Bearing and
Rewind Speed did not: their effective decay rate and Rewind duration were derived from the owned
levels on every call to `advance`. Buying either one mid-cycle therefore changed the Sleeper or
Rewind the player was already watching.

Issue #49 makes the boundary explicit. A purchase must update the balance, next price and
Sustained Style immediately while leaving the current Throw coherent. The next Throw—not the
purchase—is when the physical cycle changes.

This rule belongs in the pure core. Holding pending Gear or repairing levels in the React shell
would create a second simulation authority, contradicting ADR 0008 and breaking long advances
that cross an Auto-Thrower's internal Throw boundary.

## Save contract

The active snapshot is part of `GameState` because an app can close mid-Sleeper or mid-Rewind.
Saving only owned levels would make loading retroactively apply purchases that had not affected
the Throw before the app closed.

The snapshot stores raw Gear levels, not effective decay rates or durations. Rebalances therefore
still reach every save through the module-level constants, preserving ADRs 0008 and 0009.

Adding `activeThrowGear` raises the schema version to 2. No save reader has shipped yet. If a
version-1 migration is ever needed, it should initialise both active levels from the corresponding
owned levels, which preserves the simulation semantics version 1 actually used.

## Consequences

- Buying any Gear during a Throw leaves that Throw Cycle unchanged.
- Sustained Style still derives from owned Gear and moves on the purchase itself.
- The projected yield and Rewind animation describe the active Throw, so neither jumps on a buy.
- An Auto-Thrower captures newly owned Gear when it re-Throws, including inside one long
  `advance` call used for an Absence.

Refusing purchases outside `Ready` was rejected because the shop is meant to remain usable while
the yoyo is on the string. A shell-side queue was rejected because it would split authoritative
state and simulation rules across two modules.
