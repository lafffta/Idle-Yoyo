# Kit persists across Retires, Gear does not

Purchasables are split in two. **Gear** — Throw Power, the Bearing, Rewind Speed — belongs to the current Yoyo and is cleared on Retire. **Kit** — the Auto-Thrower, and later quality-of-life purchases — belongs to the player and survives forever.

The Auto-Thrower moving from Gear to Kit is the whole point of this decision. Everything else follows.

## Why

ADR 0002 identifies the first Auto-Thrower as the moment the game stops being a clicker and becomes an idler, and calls its price retention-critical. ADR 0005 then introduced a reset that clears Gear eleven times over the life of the game.

Composed naively, those two decisions produce a game that un-idles itself every time it rewards you. A player who Retires before bed would return to a yoyo that died minutes after they closed the tab, having earned nothing overnight, because the machine that rethrows it was sold with the old yoyo. The reset lands hardest at precisely the moment the player is meant to feel they have levelled up.

Making automation Kit makes it a one-way door. Once the game is idle, no action the player takes can make it not idle.

## Considered Options

- **Auto-Thrower resets, but is cheap to re-buy** — the fiction stays pure (a new yoyo really does start bare) and the core loop is re-taught each tier. Rejected because it converts a reward into a chore, and because "cheap" is doing a lot of work: any price above trivial makes Retiring something to avoid before bed, and a trivial price is a click for no decision.
- **Automation persists but degrades** — carries over at reduced effectiveness, say open-tab-only, until re-upgraded. Threads the fictional needle. Rejected as fiddly: "a worse copy of a thing you own" needs its own UI state and its own explanation, to buy back a nuance nobody asked for.
- **No split; Retire clears everything** — one simple rule. Rejected for the reason above.

## Consequences

The vocabulary gains a distinction the player must actually learn, and the shop must teach it without a tooltip essay. Gear and Kit should not share a list.

Kit is now a category with exactly one member, which is an invitation to fill it. Resist: Kit is permanent and therefore un-rebalanceable in practice, so anything placed there is a decision that can never be walked back. Convenience purchases (offline reports, notation preferences, an Attempt confirmation toggle) belong here. Anything that touches the earning rate does not.

In particular, no Kit item may improve Uptime, for the same reason no Structural Trick may — see ADR 0003. Permanent purchases and resettable purchases must not compete for the same lever.
