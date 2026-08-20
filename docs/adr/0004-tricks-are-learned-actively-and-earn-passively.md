# Tricks are learned actively and earn passively

A Trick is unlocked by attempting it on a live Sleeper, and once landed it multiplies Style forever — while the player watches, and while they sleep. Earning never requires attention; only *acquiring new content* does. This keeps ADR 0002's promise that online and offline obey identical rules, while giving the game something to ask of the player.

Tricks form a third upgrade axis, and it is deliberately a different *kind* of axis from the two in ADR 0003. Throw Power and the Bearing set a rate; Tricks multiply whatever that rate turns out to be. A multiplier composes cleanly with both and needs no coordination with either.

## The Attempt

An Attempt drains Spin at a high rate for the Trick's duration. Survive to the end and the Trick is landed permanently; run out of Spin partway and the yoyo dies early, having taught the player nothing and forfeited the rest of the Throw Cycle.

There is no purchase price and no dice roll. The outcome is a function of current Spin, the Bearing, and the Trick's cost — all of it known at the moment of the Attempt, all of it displayable. A player who attempts a Trick they cannot sustain has chosen to gamble the tail of a Sleeper, not been unlucky.

This makes the access gate implicit rather than declared: harder Tricks simply cost more Spin than a weak Throw can supply. Throw Power therefore does double duty — it sets the earning ceiling *and* it makes more Tricks reachable. That second job is what justifies its unbounded curve, which otherwise buys nothing but a bigger number.

## Considered Options

- **Tricks as shop unlocks** — a purchased ladder of multipliers with no input beyond clicking buy. Simplest to build and tune, and zero attention tax. Rejected because it reduces the word "Trick" to flavour text on a shop row, and because the game would then never ask the player for anything.
- **Tricks performed for Style directly** — active input during a Sleeper pays out, so playing actively out-earns idling. The most yoyo-faithful reading and the only one with real skill expression. Rejected because it breaks ADR 0002's parity outright: an absent player would be earning under different rules than a present one, which is precisely the divergence that ADR forecloses.
- **Probabilistic Attempts**, with odds scaling from the Spin headroom. Adds tension and a natural difficulty ramp. Rejected because the reward is *permanent progression*, and randomising permanent progression is the thing idle-game players resent most. It would also make offline reasoning murky for no gain.
- **No Tricks at all** — the yoyo as pure machine, Power and Uptime and nothing else. Rejected because the Uptime axis retires itself by design (ADR 0003) and Power alone is one number buying itself faster. There would be nothing for the prestige layer to carry.

## Consequences

The pre-Auto-Thrower stretch of the game gains a reason to exist beyond tutorial. ADR 0002 already argues that manually throwing is what teaches the core model; Attempts give that stretch an actual decision to make, which makes the retention-critical first Auto-Thrower price easier to set generously.

Tricks are permanent and Gear is not (ADR 0005), which creates a hazard: any Trick that neutralises a Gear axis kills that axis on every subsequent run, not just the current one. ADR 0003 carries the resulting constraint on Structural Tricks.

The cost is that a player can stall by never attempting anything. Someone who buys Gear forever and never risks a Sleeper will watch their Sustained Style flatten with no visible explanation, because the missing multiplier is not in the shop they are looking at. The Division must be as prominent as the shop, and the first Attempt must be nearly free to reach.
