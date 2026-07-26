# PROTOTYPE — the Throw Cycle state model

**Throwaway.** Not production code. Nothing outside this directory may import it.

Run it:

```
node --experimental-strip-types src/core/prototype-throw-cycle/tui.ts
```

(Node 22.6+ strips the types natively; the repo has no task runner yet, so there is no
`pnpm <name>` to hang this off. When #4 stands the project up, that scaffold is the real
home for a run script — not this directory.)

## The question

The spec in #3 fixes a `GameState` shape and a three-phase machine before any of it has been
driven by hand. This prototype exists to answer one question:

> **Does the specified `GameState` — stored `spin` and `phaseElapsed`, everything else derived
> from levels — hold up when you push the Throw Cycle through its awkward cases by hand?**

Specifically the cases that are hard to reason about on paper, all of which arise from the
decision that effective stats are *derived, never stored*:

1. **A purchase mid-phase.** #6 wants purchases to apply from the next Throw, not
   retroactively. Storing `spin` gets that right for Throw Power. But the Bearing changes
   the *derived* decay rate `D`, and the Sleeper in progress is integrated against `D` —
   so does buying a Bearing mid-Sleeper move the death of the yoyo the player is watching?
   Same for Rewind Speed during a Rewind: `phaseElapsed` may already exceed the new,
   shorter `R`.
2. **Split invariance across boundaries.** ADR 0002 lives or dies on one long call agreeing
   with many short ones, including a delta that spans a Sleeper ending *and* a Rewind
   completing.
3. **The Rewind floor.** ADR 0003 claims the Bearing stops working at `R = 0`. At the floor
   it should still work. The prototype shows both deltas live, so the claim is watchable
   rather than algebraic.
4. **Ready as a sink.** Without an Auto-Thrower a long delta must cost O(1), not an hour of
   iteration. The segment counter on screen makes that visible.

## Shape

- `cycle.ts` — the pure bit. `advance` plus the sibling transitions and derived readouts,
  at exactly the seam ADR 0008 mandates. No I/O, no terminal escapes, no `Date.now()`.
  This is the part worth lifting into the real module once the question is settled.
- `tui.ts` — throwaway shell. Renders state, reads a keystroke, dispatches, re-renders.

`g` grants Style so purchases can be reached without grinding. That cheat belongs to the
shell, not to `cycle.ts` — there is no `grantStyle` transition in the pure module.

## Verdict

**The shape holds. The derivation rule leaks.**

What the specified `GameState` gets right, confirmed by driving it:

- Opening state comes out exactly as #3 predicts — 5s Sleeper, 8s Throw Cycle, 2.5 Style per
  Throw, Uptime 62.5%, Sustained Style 0.3125/s, and both derivations of that figure agree to
  0.0e+0.
- **Split invariance holds across boundaries.** An hour as one call against 2,873 uneven
  splits spanning a death and a Rewind: Style drift 4.44e-16, Spin drift 0, same phase.
- **Time away is honest and cheap.** Eight hours with an Auto-Thrower lands on
  lifetime Style 9000.0000 — exactly 0.3125 × 28,800 — in 10,800 segments (three per cycle).
  Thirty days resolves in 972,000 segments without a pause. Without an Auto-Thrower the same
  eight hours costs **3 segments**, ends `Ready`, and earns only the 2.5 the Sleeper in
  progress still owed.
- Storing `spin` rather than deriving it is what makes a mid-Sleeper Throw Power purchase
  non-retroactive, exactly as #6 wants.

Four things the model does *not* handle, all of them consequences of deriving effective
stats while `advance` integrates against them live:

1. **A Bearing bought mid-Sleeper rewrites the Sleeper on screen.** One second into a Throw,
   buying one Bearing level moves the yoyo's death from 4.000s away to 4.348s, and the
   "this Throw still owes" readout from 1.6000 to 1.7391. #8 calls that readout *exact* —
   "the Sleeper goes on to earn precisely that" — and #6/#7 both want purchases to apply from
   the next Throw. Storing `spin` protects Throw Power and nothing else. Either `D` is
   snapshotted at Throw time, or the "applies from the next Throw" promise is narrowed in
   writing to Throw Power alone.
2. **A Rewind Speed purchase mid-Rewind ends the Rewind early.** One second into a Rewind,
   buying down to the floor takes `R` to 0.25s while `phaseElapsed` is already 1.0s. The
   boundary clamps to zero rather than going negative, so nothing corrupts — but the player
   skips the rest of a Rewind they had already half-served. Same root cause: `phaseElapsed`
   is measured against a duration that can move underneath it.
3. **Rewind Speed stays purchasable after it stops doing anything.** At the floor the shop
   will sell level 25 for 796.64 Style for a Sustained Style delta of exactly +0.000000. The
   floor in #7 protects the *Bearing*; it does not stop the player buying the inert row. That
   is a shop-affordance gap, not a simulation bug, but #7 is where it should be closed.
4. **`Ready` is reachable with an Auto-Thrower owned.** A delta that ends exactly on a Rewind
   boundary leaves the state `Ready` with an Auto-Thrower — a resting state a player of that
   save should never occupy. It resolves on the next `advance` with no Style lost, so it is
   harmless to earnings, but any shell code reading `phase === "Ready"` as "waiting for the
   player to Throw" will be wrong occasionally.

ADR 0003's guard survives the floor, but only just: at `R = 0.25` the Bearing still moves
Sustained Style (+0.001821), so it has not stopped working. Per Style spent it is 137× worse
than Throw Power (7.3e-5 vs 9.98e-3). The floor keeps the lever alive; it does not keep it
worth pulling. That is a tuning observation for the harness #3 defers, not a design fault.
