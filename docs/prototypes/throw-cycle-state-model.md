# Prototype findings: the Throw Cycle state model

Findings only. The prototype itself is throwaway and deliberately not on `main` — it lives on
the branch `prototype/throw-cycle-state-model`, kept as a primary source:

```
git checkout prototype/throw-cycle-state-model
node --experimental-strip-types src/core/prototype-throw-cycle/tui.ts
```

`cycle.ts` there is the pure half — `advance` plus the sibling transitions and derived
readouts, at the seam ADR 0008 mandates. `tui.ts` is the terminal shell that drives it by hand.

## The question

The spec in #3 fixes a `GameState` shape and a three-phase machine before any of it has been
driven. This prototype existed to answer one question, ahead of #4 committing to it:

> Does the specified `GameState` — stored `spin` and `phaseElapsed`, everything else derived
> from levels — hold up when the Throw Cycle is pushed through its awkward cases by hand?

## Verdict: the shape holds, the derivation rule leaks

### What held

- Opening state lands exactly where #3 predicts — 5s Sleeper, 8s Throw Cycle, 2.5 Style per
  Throw, Uptime 62.5%, Sustained Style 0.3125/s, with both derivations of that figure agreeing
  to `0.0e+0`.
- **Split invariance holds across boundaries.** An hour as one call against 2,873 uneven
  splits spanning a Sleeper ending *and* a Rewind completing: Style drift `4.44e-16`, Spin
  drift 0, same phase. ADR 0002's parity claim survives contact with an implementation.
- **Time away is honest and cheap.** Eight hours with an Auto-Thrower gives lifetime Style
  `9000.0000` — exactly 0.3125 × 28,800 — in 10,800 segments, three per Throw Cycle. Thirty
  days resolves in 972,000 segments without a pause. Without an Auto-Thrower the same eight
  hours costs **3 segments**, ends `Ready`, and earns only the 2.5 the Sleeper still owed.
- Storing `spin` rather than deriving it is what keeps a mid-Sleeper Throw Power purchase off
  the Sleeper in progress, exactly as #6 asks.

### What leaked

Four findings, one root cause: effective stats are derived from levels, and `advance`
integrates against them live, so a purchase moves the ground under a phase already in flight.

1. **A Bearing bought mid-Sleeper rewrites the Sleeper on screen.** One second into a Throw,
   buying one Bearing level moves the yoyo's death from 4.000s away to 4.348s, and the
   projected remaining yield from 1.6000 to 1.7391. #8 calls that readout *exact* — "the
   Sleeper goes on to earn precisely that" — and #6 and #7 both want purchases to apply from
   the next Throw. Storing `spin` protects Throw Power and nothing else. Either the decay rate
   is snapshotted at Throw time, or the "applies from the next Throw" promise is narrowed in
   writing to Throw Power alone. *Affects #7, #8.*

2. **A Rewind Speed purchase mid-Rewind ends the Rewind early.** One second into a Rewind,
   buying down to the floor takes `R` to 0.25s while `phaseElapsed` is already 1.0s. The
   boundary clamps to zero rather than going negative, so nothing corrupts — but the player
   skips the rest of a Rewind they had already half-served. Same root cause: `phaseElapsed` is
   measured against a duration that can move underneath it. *Affects #7.*

3. **Rewind Speed stays purchasable after it stops doing anything.** At the floor the shop
   will sell level 25 for 796.64 Style for a Sustained Style delta of exactly `+0.000000`. The
   floor in #7 protects the *Bearing*; it does not stop the player buying the inert row. An
   affordance gap rather than a simulation bug, but #7 is where it should be closed.
   *Affects #7.*

4. **`Ready` is reachable with an Auto-Thrower owned.** A delta landing exactly on a Rewind
   boundary leaves the state `Ready` with an Auto-Thrower — a resting state a player of that
   save should never occupy. It resolves on the next `advance` with no Style lost, so it is
   harmless to earnings, but any shell code reading `phase === "Ready"` as "waiting for the
   player to Throw" will be wrong occasionally. *Affects #9.*

### On the ADR 0003 guard

It survives the floor, but only just. At `R = 0.25` the Bearing still moves Sustained Style
(`+0.001821`), so it has not stopped working and the regression guard #7 asks for will pass.
Per Style spent it is 137× worse than Throw Power there (`7.3e-5` against `9.98e-3`). The
floor keeps the lever alive; it does not keep it worth pulling. That is a tuning observation
for the harness #3 defers, not a design fault.

## Consequences for the tickets

Nothing here blocks #4 — the seam, the segment-based integrator and the phase machine all came
through clean. Findings 1 and 2 want settling before #7 is picked up.
