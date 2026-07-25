# Retiring the Yoyo is the only prestige layer

The player Retires their Yoyo for the next one up a ladder of twelve tiers, from a fixed-axle wooden yoyo to a signature model. Retiring clears Style and Gear and keeps Tricks and Kit. There is one such layer and there will not be a second.

Crucially, there is **no prestige currency**. Tricks are the permanent progression, and they are earned by playing rather than converted from a balance. This is the decision that keeps the game to a single economy: one currency, one shop, one ladder of things to learn.

## The reward for Retiring

Two components, deliberately of different kinds.

**Fixed by tier**: the new Yoyo's base Throw Power and base Bearing, and — at tiers 1, 4, 7 and 10 — a newly opened Division. Content lands on a schedule rather than at the mercy of tuning.

**Scaled by the run**: a permanent Style multiplier derived sub-linearly (√-shaped) from lifetime Style earned during that run. Pushing further pays, with diminishing returns, so the player has a genuine question to answer every run — Retire now, or stay for one more Trick?

Fixed-only rewards would make Retiring correct the instant it unlocks, deleting the decision and punishing long runs. Scaled-only rewards would put content pacing at the mercy of the curve. The pair gives a legible schedule *and* a live decision.

## Pacing

Twelve tiers, with a Division opening roughly every third. The first run is long — four to six hours, most of an evening — because the player is still learning the model and has no Tricks carrying them. Later runs compress toward an hour as persistent Tricks do more of the work. That yields around twelve prestige beats across a week or two, with a rhythm in which every third Retire is a content event and the others are power steps.

## Considered Options

- **A classic prestige currency** — lifetime Style converts into a second resource spent in a second shop on permanent boosts, with Tricks resetting alongside everything else. Genre-standard, maximally tunable, instantly legible to anyone who has played an idler. Rejected because it demands an entire parallel economy and shop, and because it demotes Tricks from *the thing you are playing for* to disposable per-run content.
- **Inverting it** — Gear persists and Tricks reset each run, so every run replays the active content. Rejected because re-landing the same Tricks twelve times is the single most common complaint about idle games, and it contradicts ADR 0004's "landed permanently".
- **One tier per Division, five runs total** — every Retire a major content event. Rejected because five rewards across the whole game is too few, and multi-day stretches with no structural change ask for too much faith.
- **Twenty-five tiers, Retiring every half hour** — a fast, sticky cadence, and forgiving of mistuning since a bad run ends soon. Rejected because it makes the Retire ritual routine rather than an event, and a manual ritual repeated that often creates pressure for an automated Retire — which is the second prestige layer we are declining to build.

## Consequences

Run length is the primary pacing dial and it is not directly authored; it emerges from the Gear cost curve, the Trick multipliers carried in, and the Retire multiplier. Expect to tune it against a simulated player rather than by intention.

Because Tricks persist and Gear does not, later runs are asymmetric: the player begins with a large Style multiplier and no Gear at all. The opening minutes of run eight are therefore very unlike the opening minutes of run one, and the shop's early rows must not feel insulting when a player with a ×10⁶ multiplier looks at them. Gear costs should scale against the current Yoyo tier, not sit at absolute prices.

Twelve is a commitment. Because there is no second layer and no procedural extension, tier twelve is the end of the game, and it needs an ending rather than a wall.
