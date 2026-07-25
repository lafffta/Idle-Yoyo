# Spin decays linearly, not exponentially

A Throw sets Spin to a starting value and Spin falls by a constant amount per second, while the player earns at a rate proportional to current Spin. We chose linear decay over the genre-standard exponential decay because it is physically truthful (bearing friction applies roughly constant torque, so real yoyo RPM decays close to linearly), because it makes total yield per Throw scale with the *square* of Throw Power — a harder throw both earns faster and lasts longer, so one purchase pays twice — and because Spin reaches exactly zero at a known moment, giving us a crisp Dead Yoyo instead of an arbitrary cutoff threshold.

## Considered Options

- **Exponential decay** — the conventional idle-game choice. Rejected because total yield becomes merely linear in Throw Power, losing the quadratic upgrade hook, and because Spin never mathematically reaches zero, so death becomes an arbitrary threshold.
- **Flat rate on a timer** — a Throw grants a fixed rate for a fixed duration. Simpler, and trivially easy to compute offline. Rejected because it decouples power from duration into two unrelated knobs and discards the wind-down taper, which is most of what carries the theme.

## Consequences

Total yield per Throw is quadratic in Throw Power and inversely proportional to the decay rate. This gives two upgrade axes with genuinely different shapes: Throw Power pays quadratically, while the Bearing pays linearly but extends the Sleeper's life proportionally — making the Bearing the lever against a yoyo dying unattended.

The cost is legibility. Neither the total yield nor the current earn rate is something a player can compute mentally, and the earn rate is never still on screen. This is a UI problem to solve, not a reason to revisit the model.
