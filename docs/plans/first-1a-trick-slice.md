# First 1A Trick slice

After the working shell, build one complete Trick vertical slice before Retire. Its purpose is to test whether informed risk, Gear thresholds and active Trick acquisition make the first 15–30 minutes engaging. Stop for playtesting and retuning after this slice rather than proceeding directly into twelve-tier progression.

## Player rules

- The 1A Division is a linear ladder. All three Tricks are visible, but only the next unlanded Trick can be Attempted.
- An Attempt may begin during any Sleeper, including one started by the Auto-Thrower. Only one Attempt may be active.
- An Attempt is irreversible. It continues earning Style normally while Spin drains according to ADR 0014.
- Before commitment, show the duration, permanent multiplier and exact predicted result: Spin remaining on landing or the time until the Yoyo dies.
- A predicted fatal Attempt remains enabled and is labelled **Attempt anyway**. It grants no progress, but can deliberately sacrifice the tail of a Sleeper to reach a fresh Throw sooner.
- Landing applies the fixed multiplier immediately. If enough Spin remains, the next Trick may be Attempted during the same Sleeper.
- Landed Tricks cannot be repeated in this slice.
- An active Attempt continues through hidden tabs, saving, loading and Absences. The return summary names the Trick that landed or the Attempt that killed the Yoyo.

## Ladder

| Trick | Duration | Provisional reward | Pacing role |
| --- | ---: | ---: | --- |
| Rock the Baby | 1.5 seconds | ×1.25 Style | Safely lands on the opening Throw before any Gear purchase |
| Man on the Flying Trapeze | 2.5 seconds | ×1.5 Style | Lands before the expected Auto-Thrower purchase |
| Brain Twister | 4 seconds | ×2 Style | Remains unsafe until after the expected Auto-Thrower purchase and lands within 30 minutes of engaged play |

The rewards are fixed and compound as a product. Their values and each Trick's Spin-decay multiplier are provisional inputs to the tuning harness, not final authored constants. Safety must emerge from current Spin and the active Bearing rather than explicit Gear-level requirements, so multiple Gear builds can cross each threshold.

## Shell experience

- Put a first-class **1A Division** section immediately below the live Throw Cycle and above the Gear and Kit shops.
- Keep all onboarding inline and non-blocking: “Attempts drain Spin. Land a Trick to multiply Style permanently. Run out of Spin and the Yoyo dies.”
- Give every Trick a distinct, stylized canvas animation. The animation need not simulate real yoyo physics, but it must preserve the Trick's defining motion and stay synchronized to core Attempt progress.
- Report landing or failure beside the live Throw Cycle without a modal. A landed row becomes a permanent completion record; a failed row remains available on the next Sleeper.
- Preserve accessibility, including a reduced-motion presentation that leaves timing and outcome legible.
- Do not display locked 2A–5A Divisions before their progression exists.

## Simulation and persistence

- Represent an Attempt as activity within `Sleeping`, not as a separate non-earning Throw Cycle phase.
- Compute its total Spin drain from the active Throw's decay rate, a per-Trick drain multiplier and the fixed duration.
- Resolve landing, death, automatic Rewind and automatic re-Throw inside `advance`, including when one large delta crosses several boundaries.
- Keep Trick definitions with the other provisional core constants; saves store facts such as landed Tricks and active Attempt progress, never derived multipliers or drain rates.
- Migrate current saves without resetting them. Preserve Style, Gear, Kit and the active Throw, and initialize the ladder as unlanded.

## Tuning contract

Extend the tuning harness with an engaged player that:

- values Gear for both immediate Sustained Style and progress toward the next Trick;
- Attempts the next Trick at the earliest useful opportunity;
- may choose a predicted fatal Attempt when sacrificing the current Sleeper reaches a safe fresh Throw sooner; and
- continues to evaluate the Auto-Thrower alongside Gear rather than buying it by script.

Guard product thresholds, not exact timestamps:

1. Rock the Baby lands on the opening Throw.
2. Man on the Flying Trapeze lands before the Auto-Thrower.
3. The Auto-Thrower still arrives within the first Session.
4. Brain Twister lands after the Auto-Thrower but within 30 minutes of engaged play.

## Playtest checkpoint

The slice is ready to precede Retire only when playtesting shows that:

- players notice and land Rock the Baby without external instruction;
- players understand why later Tricks are safe or fatal;
- at least some players recognize the sacrifice trade-off without mistaking failure for randomness; and
- the Auto-Thrower still feels like liberation while Brain Twister gives players a reason to remain engaged afterward.

Failure of the first three observations calls for an interaction redesign. If the interaction is understood but the sequence drags or races, retune constants against the harness.

## Deliberately deferred

- Retire and additional Yoyos
- 2A–5A Divisions and the remainder of 1A
- Structural Tricks
- repeating landed Tricks
- audio and its settings
- physically simulated Trick animation
