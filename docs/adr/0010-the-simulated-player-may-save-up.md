# The simulated player may save up

The tuning harness's player ranks every row in the shop, including the ones they cannot yet afford, and may decline a purchase they could make in order to bank Style towards a better one. A row they must save for is valued over what would be left of the run once the saving were done.

This is recorded because the obvious simplification — buy the best row you can afford, since Style in hand earns nothing — is what the harness did first, and it produced a wrong finding that read as a real one.

## Why

The player exists to answer questions about pacing, and the first question asked of it was ADR 0002's: does a player reach their first Auto-Thrower before their first Session ends? The harness answered that they reach it twenty hours in, in the fourth Session of six, and that answer was an artefact of the player rather than of the prices.

A player who spends at every opportunity never holds a large sum. The Auto-Thrower is the largest price in the game by a factor of twenty, and the ranking already valued it above everything else by a factor of tens — the player bought one at the first boundary they could afford it, and simply never had 500 Style in one hand before that. They earned nearly four times its price during the first Session alone, across thirty-nine purchases, the dearest of which was 123.75.

So the instrument reported the game's most retention-critical price as unreachable, for a reason that had nothing to do with the price. Any price would have been unreachable the same way, and cutting it in response would have moved a number that was not the problem. **A player who cannot save cannot measure whether a price is affordable — only whether it happens to be met in passing.**

Letting them save costs something real, and it is the honest cost rather than a fudge: banked Style earns nothing while it waits, so a purchase reached by saving is collected over a shorter run than one bought today. Charging exactly that — valuing a row over the run remaining after its wait — is what makes waiting a trade rather than a free option, and it is also what stops the player stalling. Save for longer than the run has left to give and there is nothing ahead to collect in, so the row is worth nothing and is declined by the same positivity rule that declines Rewind Speed at its floor. No row is special-cased, and no anti-stall guard is written.

An Absence passes without shortening a wait, because a player with no machine earns one last Sleeper when they close the tab and nothing after it. That is what makes a machine two nights' worth of saving away worth two fewer nights than one bought today, which the ranking has to see or it would recommend saving for a machine that arrives after everything it was going to earn in.

## What this player is not

It follows a good rule, not the best one. Buying a level of Throw Power now also shortens the wait for everything after it, and no rule that ranks one purchase at a time can weigh that; the best possible ordering of purchases is a search, and this is deliberately not one.

That is the right trade for what the instrument is for. ADR 0002's promise is a retention claim about ordinary behaviour, not about optimal play — a price reachable in the first Session only by a player who plays perfectly has failed the promise anyway. So a Report says when *this* player got somewhere, and says so in as many words, rather than implying a bound it has not computed.

## Considered Options

- **Buy the best affordable row, never save** — what the harness did first. Rejected: it cannot hold any price larger than a Session's spare change, so it reports large prices as unreachable regardless of what they are, which is the failure that produced this ADR.
- **Rank everything and simply wait for the best row** — no discount, no affordability check. Rejected because it deadlocks: a row that can never be afforded is always the best one, so the player buys nothing, never improves, and never affords it. It needs an anti-stall guard bolted on, which is an exception written about a case rather than a rule that covers it.
- **Save only for the Auto-Thrower** — the smallest change that fixes the known symptom. Rejected because the harness values Gear and Kit by one rule with nothing written about either in particular, and this would be the first exception in it. The Auto-Thrower is not the only price a player might reasonably save for, and a rule that only sees the one we already know about cannot surprise us with a second.
- **Save if the row is affordable within N seconds** — direct, and easy to explain. Rejected because N is a new unauthored constant of exactly the kind ADR 0005 asks to be derived rather than chosen, and it would sit in the instrument that exists to judge whether the game's numbers were chosen well.

## Consequences

A Report now distinguishes two kinds of time in which the player buys nothing, and they are opposite findings. Time with nothing affordable is a shop opening above what the game pays, which is a fault in the prices. Time spent saving is the player passing over what they can reach for something worth more, which is the shop working. A single figure covering both would report a well-paced run and a badly-priced one identically.

Every figure in the existing Report moves, because the purchase order moves. Reports from before this change are not comparable with reports after it, and the exact-figure tests in `simulate.test.ts` were re-derived rather than re-baselined.

This decision changed the instrument and not the game — no constant moved with it. What it changed was what the instrument could see: the re-read that followed put the machine 26m 40s of play away against a 20-minute first Session, which is a claim about the price rather than about the player, and `autoThrowerCost` was cut from 500 to 250 on the strength of it. That the price could then be argued about at all is what this ADR bought.

If this is ever simplified back to buying only what is affordable, expect the largest price in the game to be reported as reached late or not at all, and expect that to look like a pricing problem.
