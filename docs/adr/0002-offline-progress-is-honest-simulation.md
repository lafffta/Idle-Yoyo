# Offline progress is the same simulation, run forward

Time away is resolved by running the ordinary Sleeper simulation forward from the moment the player left — the yoyo really does die when its Spin runs out, whether or not anyone is watching. There is no offline multiplier, no suspended physics, and no separate offline code path. Players who cannot yet cover an absence buy an Auto-Thrower, a machine that rethrows the moment the yoyo dies, rather than being handed offline earnings by the rules.

## Considered Options

- **Reduced offline rate** (the genre convention, e.g. 50%) — rejected because it is an arbitrary fudge that quietly concedes the core model does not survive the player being away. We would rather the model survive.
- **Spin freezes while the game is closed** — rejected as incoherent (closing the app should not suspend physics) and because it makes the Spin model irrelevant during exactly the hours an idle game does its real work.
- **No Auto-Thrower at all** — the purest reading, but it makes an active clicker rather than an idle game.

## Consequences

Online and offline obey identical rules, so there is no second set of rules to keep in sync and no divergence for players to discover and exploit.

The cost lands entirely on the price of the first Auto-Thrower. Until a player owns one, closing the game earns them close to nothing, so a first Auto-Thrower priced beyond the first session will lose players before they ever see the game become idle. Treat that price as a retention-critical number.

Buying the first Auto-Thrower is therefore the moment the game stops being a clicker and becomes an idler. That transition is deliberate and worth protecting: before it, manually throwing and watching Spin decay is what teaches the player the core model.
