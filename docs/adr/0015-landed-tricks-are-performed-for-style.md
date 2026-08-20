---
status: superseded by ADR 0017
---

# Landed Tricks are performed for Style

A Trick is learned once and performed forever. The first Land teaches it and multiplies Style permanently, exactly as ADR 0004 describes. Every Land after that is a **Performance**: it teaches nothing and pays Style immediately, converting the Spin it drains at a better rate than letting that Spin decay on its own.

This exists because the ladder ran out. The first 1A slice shipped three Tricks, each landable once, and the tuning harness plays all three inside 7m 44s of a 1h 35m run — 92% of engaged play with no Attempt available at all, because `nextTrick` returns `null` once the ladder is spent. The human playtest at #72 found the earlier half of the same problem: the manual opening before the Auto-Thrower is boring, and it was boring even though two of the three Tricks were on offer throughout it. Three one-shot events were never going to carry forty-five Throw Cycles. The playtester's own reading — "the core loop is boring playing actively until the Auto-Thrower, which relieves that" — is the finding this ADR answers.

The target is **one real decision per Throw Cycle**, and no more than that. An idle game does not need continuous input; it needs the player to be choosing rather than waiting. A performable ladder makes every Sleeper a live question and leaves declining it a legitimate answer, which is what an idle player does.

## Parity permits this

ADR 0004 considered and rejected "Tricks performed for Style directly", on the grounds that it "breaks ADR 0002's parity outright: an absent player would be earning under different rules than a present one."

That rejection was too broad, and it is amended in place. ADR 0002 forbids two *rule sets* — "online and offline obey identical rules, so there is no second set of rules to keep in sync and no divergence for players to discover and exploit". It does not require that a present and an absent player earn the same amount. The game already has a present-only action that changes earnings, and has since the first slice: **buying Gear**. Nobody has ever thought the shop breaks parity, because the rules are identical and the absent player is simply not taking actions.

A Performance is an action of that same kind. It runs through the ordinary `advance` with no offline branch and no second implementation, so ADR 0002 is untouched. What ADR 0004 actually caught was a concern about *magnitude* — whether the game stays an idle game — and that is a real concern which deserves to be fought on its own terms rather than smuggled in as a parity argument. ADR 0016 is where it is fought.

## What a Performance pays

Style, proportional to the Spin it consumes, at a premium over the rate that Spin would have earned by decaying normally. Never a flat amount.

The economy is exponential and this is tier one of twelve. A flat reward — say ten Style for Rock the Baby — is worth about a third of a second of passive income by the end of the first day and is worth nothing whatever by the third Yoyo. The active layer would quietly die of old age and the menu would become decoration. A proportional reward needs no separate curve to keep it alive: it scales with Throw Power because bigger Throws convert more, and with the Bearing because a better Bearing leaves more Spin to convert, and there is no tier at which it falls behind.

This is the same argument ADR 0014 already made and won, applied to the other half of the same Attempt. That ADR chose a decay multiplier over a fixed Spin fee because "a fixed extra Spin fee would make the Bearing incidental". A flat Style reward makes Throw Power and the Bearing incidental to the *reward* for precisely the same reason, in precisely the same place. One idea keeps one shape.

It also keeps the per-cycle question legible forever. Performing always converts Spin at a premium, so the player is always asking "do I have the Spin to finish?" and never "is this still worth anything?". The first is the deterministic safety judgement ADR 0014 built and #72 confirmed players read correctly. The second is arithmetic nobody wants to redo every tier.

There is no second currency. Style is the only one, and a Performance pays it.

## The decision is the partition, not the Trick

An Attempt is exactly previewable (ADR 0014), and Performances are freely repeatable. On their own those two facts would make each cycle a computation rather than a decision: perform the largest Trick that currently fits, which the interface already knows. That would be a busier game than the one #72 called boring without being a more interesting one.

What rescues it is that **several Performances may run in sequence within one Sleeper**, one at a time. The question each Throw is therefore how to partition that Throw's Spin — one Brain Twister, or three Rock the Babys — which has no obvious answer, moves as Gear changes, and is not solved by any rule that ranks one Performance at a time. It is the same shape of problem the tuning harness already admits to in its own Report about purchases: "buying now also shortens the wait for everything after it, which no rule ranking one purchase at a time can weigh."

This puts a hard constraint on the constants: **the premium must rise with a Trick's duration.** If a long Performance pays the same rate as a short one, slicing Spin as thin as possible always wins, the partition collapses, and the loop is solved again with extra clicking. If no premium band satisfies this, the design does not work and that should be discovered against the harness before the shell is built.

## Considered Options

- **A longer ladder instead** — the deferred remainder of 1A, fifteen Tricks rather than three. Directly targets what the playtester felt, costs no ADR and needs no reward redesign. Rejected as *the* answer, not as an answer: a finite ladder always empties, and with twelve Retire tiers ahead, "add more content" is a treadmill the game would be committing to permanently. It remains worth doing as content, and is deliberately deferred so that a re-playtest can tell which change worked.
- **A temporary buff instead of immediate Style** — a multiplier for the rest of the Sleeper. Rejected on ADR 0007: Sustained Style is "the headline figure on screen, and the number every purchase decision turns on", and today it moves only when something is bought. A buff makes the game's one honest number flicker, so the player can no longer read it to judge a purchase — a real cost for no structural gain over paying Style directly.
- **A separate progression track** — Performances feed a meter that pays out on some other schedule. Held in reserve; more machinery than the problem currently justifies.
- **Auto-selecting the best affordable Trick** — one button, no menu, a much simpler shell. Rejected because it removes the decision this ADR exists to create. It is automation wearing the costume of a choice, and ADR 0016 rules it out anyway.
- **Retuning the existing constants** — the other branch #72 was allowed to take. Rejected because no constant reaches this. A spent ladder offers nothing at any drain multiplier, and making Tricks land later would empty the opening further rather than fill it. Worth recording that the pacing suite was **green throughout**: `pacing.test.ts` guards that Brain Twister "lands after the Auto-Thrower and within 30 minutes of engaged play" as the stated reason automation does not end active play outright, and it passes with 28 minutes to spare while the intent behind it goes unmet. That is a limitation of a threshold, not a fault in the guard — a threshold cannot see a ladder empty.

## Consequences

The premium rate is the single most sensitive number in the active layer and is deliberately the design's **only** free parameter, so that the sweep has one dimension to search. Set it high and Attempting constantly dominates, which is the clicker ADR 0002 protects the game from becoming. Set it low and nobody ever Performs. It is chosen by sweeping it against the tuning harness in the manner of `autoThrowerCost` in #29, never by intention — ADR 0005 asks that pacing emerge from the curves.

The tuning harness must learn to Perform. Its simulated player currently never Attempts anything and lands the ladder only as a side effect, so `npm run tune` reports the same figures it did before Tricks existed. Teaching that player to partition Spin across Performances is a genuine piece of engineering with no greedy solution, and it is the largest risk in this design: the instrument may not be able to answer the question. That is worth discovering first rather than after a shell is built on the assumption that it can.

`nextTrick` keeps its present meaning and governs the learning frontier alone. The linear ladder still teaches in order; the performance menu is a second surface listing what is already known.

A fatal Attempt now costs only the tail of a Sleeper rather than a learning opportunity, so mistakes become cheap and frequent. This is intended — a cheap mistake made often is a loop that teaches, which is the opposite of the current arrangement where a rare mistake is expensive and the loop teaches nothing. ADR 0014's deliberate sacrifice, spending a Sleeper's tail to reach a fresh Throw sooner, is unaffected.
