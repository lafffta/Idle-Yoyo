# The Rewind period exists to keep uptime meaningful

After the yoyo dies, the string must be wound back up before the next Throw, and the player earns nothing during that Rewind. This dead time is deliberate and load-bearing: without it, the Bearing upgrade has no effect whatsoever on sustained earnings.

## Why

With an Auto-Thrower that rethrows the instant the yoyo dies, sustained earnings are yield per Throw divided by cycle time. Given the linear decay model in ADR 0001:

```
yield per Throw = k·S₀² / 2D        cycle time = S₀ / D

sustained rate  = (k·S₀² / 2D) × (D / S₀) = k·S₀ / 2
```

The decay rate `D` cancels. A better Bearing makes each Throw last longer and earn proportionally more, and you throw proportionally less often — exactly a wash. The Bearing would become a starter upgrade that silently stops working the moment the player buys an Auto-Thrower.

Introducing a Rewind of `R` seconds breaks the cancellation:

```
sustained rate = (k·S₀ / 2) × (S₀ / (S₀ + R·D))
                  ↑ cap         ↑ uptime
```

Sustained earnings become the cap multiplied by uptime. Throw Power sets the ceiling; time spent winding rather than spinning is what holds the player beneath it.

## Consequences

The game has **two** upgrade axes, not three. Uptime depends on the product `R·D`, so the Bearing (lowering `D`) and Rewind Speed (lowering `R`) push the same lever from opposite ends — they are different prices for the same effect, not independent stats.

- **Power** — Throw Power. Sets the ceiling, pays quadratically, unbounded.
- **Uptime** — Bearing and Rewind Speed. Bounded above by 100%, with naturally diminishing returns: 50%→90% uptime is a 1.8× gain, 90%→99% only 1.1×.

The uptime axis therefore retires itself gracefully as it saturates, with no artificial cap required.

The cost is dead air. The loop now contains a stretch where nothing earns, and some players will read the winding animation as the game wasting their time. Rewind Speed must be purchasable early and feel good to buy. Do not resolve that complaint by shortening Rewind to zero — that reintroduces the cancellation above and kills the Bearing.
