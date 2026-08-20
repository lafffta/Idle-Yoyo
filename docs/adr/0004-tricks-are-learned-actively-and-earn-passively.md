# Tricks are learned actively and earn passively

A Trick is unlocked by attempting it on a live Sleeper, and once landed it multiplies Style forever — while the player watches, and while they sleep. Earning never requires attention; only *acquiring new content* does. This keeps ADR 0002's promise that online and offline obey identical rules, while giving the game something to ask of the player.

Tricks form a third upgrade axis, and it is deliberately a different *kind* of axis from the two in ADR 0003. Throw Power and the Bearing set a rate; Tricks multiply whatever that rate turns out to be. A multiplier composes cleanly with both and needs no coordination with either.

## The Attempt

An Attempt drains Spin at a high rate for the Trick's duration. Survive to the end and the Trick is landed permanently; run out of Spin partway and the yoyo dies early, having taught the player nothing and forfeited the rest of the Throw Cycle.

There is no purchase price and no dice roll. The outcome is a function of current Spin, the Bearing, and the Trick's cost — all of it known at the moment of the Attempt, all of it displayable. A player who attempts a Trick they cannot sustain has chosen to gamble the tail of a Sleeper, not been unlucky.

This makes the access gate implicit rather than declared: harder Tricks simply cost more Spin than a weak Throw can supply. Throw Power therefore does double duty — it sets the earning ceiling *and* it makes more Tricks reachable. That second job is what justifies its unbounded curve, which otherwise buys nothing but a bigger number.

## Considered Options

- **Tricks as shop unlocks** — a purchased ladder of multipliers with no input beyond clicking buy. Simplest to build and tune, and zero attention tax. Rejected because it reduces the word "Trick" to flavour text on a shop row, and because the game would then never ask the player for anything.
- **Tricks performed for Style directly** — active input during a Sleeper pays out, so playing actively out-earns idling. The most yoyo-faithful reading and the only one with real skill expression. Rejected because it breaks ADR 0002's parity outright: an absent player would be earning under different rules than a present one, which is precisely the divergence that ADR forecloses. **This rejection was too broad and has been amended — see below.**
- **Probabilistic Attempts**, with odds scaling from the Spin headroom. Adds tension and a natural difficulty ramp. Rejected because the reward is *permanent progression*, and randomising permanent progression is the thing idle-game players resent most. It would also make offline reasoning murky for no gain.
- **No Tricks at all** — the yoyo as pure machine, Power and Uptime and nothing else. Rejected because the Uptime axis retires itself by design (ADR 0003) and Power alone is one number buying itself faster. There would be nothing for the prestige layer to carry.

## Consequences

The pre-Auto-Thrower stretch of the game gains a reason to exist beyond tutorial. ADR 0002 already argues that manually throwing is what teaches the core model; Attempts give that stretch an actual decision to make, which makes the retention-critical first Auto-Thrower price easier to set generously.

Tricks are permanent and Gear is not (ADR 0005), which creates a hazard: any Trick that neutralises a Gear axis kills that axis on every subsequent run, not just the current one. ADR 0003 carries the resulting constraint on Structural Tricks.

The cost is that a player can stall by never attempting anything. Someone who buys Gear forever and never risks a Sleeper will watch their Sustained Style flatten with no visible explanation, because the missing multiplier is not in the shop they are looking at. The Division must be as prominent as the shop, and the first Attempt must be nearly free to reach.

## Amendment: the parity rejection was too broad

Two claims in this ADR did not survive contact with a played game. Both are corrected by ADR 0015; the rest of this ADR stands, and its title still describes what a *first* Land does.

**The rejection of "Tricks performed for Style directly" over-read ADR 0002.** That ADR forbids two rule sets — "online and offline obey identical rules, so there is no second set of rules to keep in sync and no divergence for players to discover and exploit". It does not require that a present and an absent player earn the same amount, and this game has always had a present-only action that changes earnings: buying Gear. The shop has never been thought to break parity, because the rules are identical and an absent player is simply not taking actions. A Performance is an action of that same kind, running through the ordinary `advance` with no offline branch.

What this rejection was really reaching for was *magnitude* — whether the game stays an idle game — which is a genuine concern that deserved its own argument rather than borrowing parity's authority. ADR 0016 makes it, and bounds the active layer to a bonus for presence rather than a penalty for absence.

**The claim in Consequences that Attempts give the pre-Auto-Thrower stretch "an actual decision to make" was falsified.** The human playtest at #72 found that stretch boring, and found it boring *while two of the three Tricks were on offer throughout it*. One-shot Attempts are two events in forty-five Throw Cycles, which is not a decision the loop is made of. The hazard this ADR names two paragraphs above — that a player can stall by never attempting anything — turned out to have a companion it did not anticipate: a player who attempts everything available also runs out, and does so 7m 44s into a 1h 35m run.

The mechanism this ADR built was sound; what was wrong was believing three of them were enough. Nothing in the deterministic, previewable, non-random Attempt needed changing, and #72 confirmed players read it exactly as intended — a lost Throw was reported as the player's own mistake rather than as bad luck. ADR 0015 keeps all of that and makes it repeatable.

## Amendment: Mounts replace Performances

The Performance answer in the previous amendment did not survive the design work recorded in #79. ADR 0017 supersedes ADR 0015: landed Tricks remain permanent, non-repeatable content, while Mounts open the Division so that several unlanded Tricks can be reachable at once.

The earlier diagnosis still stands. A linear ladder combined with an exact preview offers no choice, and a short ladder empties too early. What changes is the answer: attention continues to acquire content rather than rate, and successive runs Land different Tricks instead of repeating the same ones for Style.
