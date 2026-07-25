# The headline readout is Sustained Style per second

ADR 0001 closed by naming a problem and deferring it: under linear decay, neither total yield nor current earn rate is mentally computable, and the earn rate is never still on screen. This is the answer.

The headline number is **Sustained Style** — Style per second averaged over a full Throw Cycle. From ADR 0003:

```
Sustained Style = (k·S₀ / 2) × S₀ / (S₀ + R·D)
                    ↑ cap        ↑ uptime
```

multiplied by the product of every landed Trick.

It is the right choice for one reason above all: it is the quantity every purchase decision actually turns on. Throw Power, the Bearing, Rewind Speed and Tricks all move exactly this number, which means every shop row can show an honest before-and-after against it. It is also, conveniently, the only figure in the game that holds still — it changes when the player buys something, and otherwise not at all.

## The instantaneous rate stops being a digit

The live earn rate is not shown as a number anywhere. It is shown as **motion**: the yoyo visibly slows as Spin decays, and the Style counter visibly decelerates with it. The player feels the decay continuously and never has to read it.

This is what makes the decay model legible without making it arithmetic. It also makes the canvas yoyo load-bearing rather than decorative — the animation is the readout for one of the game's two core quantities, not garnish on top of it.

## The secondary readout is exact, not estimated

Linear decay is deterministic, so the entire future of a Throw is known the instant it is thrown. "This Throw will yield X" is therefore a fact, not a forecast, and should be presented at full confidence with no hedging language. The same determinism lets an Attempt show, before the player commits, whether the Sleeper will survive it.

That is worth stating plainly because it is a genuine dividend of ADR 0001's decay choice. Under exponential decay this readout would not exist.

## Considered Options

- **Instantaneous Style per second** — the most honest account of what is happening right now, and it makes decay viscerally legible. Rejected because it is a number that never stops moving, reads differently at every glance, and cannot be compared against a shop price. That is precisely the complaint ADR 0001 recorded.
- **Balance only, with rates confined to the shop** — cleanest possible main screen, and it turns upgrade decisions into concrete before-and-after comparisons rather than mental arithmetic. Rejected because the player loses any felt sense of how fast they are earning, which is most of the pleasure of the genre. Its good idea is kept: shop rows still show deltas.

## Consequences

Sustained Style is a cycle average, so it is *wrong* during the first Throw Cycle after any purchase and during the very first Throw of a run. It must be computed from the current stats rather than measured from history, or it will lag every purchase by a full cycle and make upgrades feel inert.

Averaging over the cycle means the headline number does not drop during Rewind. This is a real benefit and ADR 0003 asked for it: that ADR worries players will read the winding animation as wasted time. If the number they are watching does not flinch, the complaint loses most of its force. The Rewind still needs to look purposeful, but it no longer looks like a loss.

A player who watches the yoyo slow to a stop while the headline figure sits perfectly still may reasonably conclude the number is broken. The relationship between the still average and the visibly decaying motion has to be taught once, early, and probably shown — a cycle-shaped graph with the average drawn across it would do it in one glance.
