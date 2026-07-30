/**
 * PROVISIONAL — every number here is a placeholder, not an authored value.
 *
 * These were chosen in the core-loop spec to make a first session behave sensibly, and
 * none of them has been tuned. ADR 0005 expects run length to emerge from the cost curves
 * and be tuned against a simulated player rather than chosen by intention, so a later
 * ticket will rewrite these against a harness. They live in one place so that rewrite is
 * a single edit, and so no save ever stores a value derived from them.
 */
export const PROVISIONAL = {
  /** `k` — Style earned per unit of Spin per second. Opening peak rate of 1.0 Style/s. */
  stylePerSpinPerSecond: 0.01,
  /** `S₀` — the Spin a Throw starts with, before any Gear. */
  baseThrowPower: 100,
  /** `D` — Spin lost per second during a Sleeper, before any Gear. */
  baseDecay: 20,
  /**
   * `R` — seconds spent winding the string back up after a Dead Yoyo, before any Gear.
   * With the values above this is an opening Uptime of 62.5%, leaving headroom to buy.
   *
   * Provisional like everything else here, but not optional: ADR 0003 shows that at `R = 0`
   * the decay rate cancels out of sustained earnings and the Bearing stops working
   * altogether. The Rewind is dead time on purpose.
   */
  baseRewind: 3.0,
  /** Spin added to `S₀` by each level of Throw Power. */
  throwPowerPerLevel: 20,
  /**
   * Style cost of the first level of Throw Power.
   *
   * Absolute for now because there is only one Yoyo. ADR 0005 asks that Gear costs scale
   * against the current Yoyo tier rather than sitting at absolute prices, so that the shop's
   * early rows do not insult a player opening their eighth run — but tiers arrive with
   * Retire, and this constant becomes a per-tier base then.
   */
  throwPowerBaseCost: 10,
  /** What each level owned multiplies the cost of the next one by. */
  throwPowerCostGrowth: 1.15,
  /** What each level of the Bearing multiplies `D` by. Below 1: Spin drains more slowly. */
  bearingDecayPerLevel: 0.92,
  /** Style cost of the first level of the Bearing. Per-tier once Retire arrives, as above. */
  bearingBaseCost: 25,
  /** What each level owned multiplies the cost of the next one by. */
  bearingCostGrowth: 1.18,
  /** What each level of Rewind Speed multiplies `R` by. Below 1: the string winds faster. */
  rewindPerLevel: 0.9,
  /**
   * The shortest the Rewind can ever be, however much Rewind Speed is bought.
   *
   * Provisional in its value and not at all in its existence. At `R = 0` the decay rate
   * cancels out of sustained earnings — `(k·S₀²/2D) × (D/S₀) = k·S₀/2` — and the Bearing
   * stops working outright, not merely working less. Rewind Speed could then be bought until
   * every further Bearing purchase bought nothing. ADR 0003 bars permanent effects from
   * the Uptime lever; this guards the same lever from resettable Gear at the bottom of its
   * range. See the regression guard in simulation.test.ts before touching it.
   */
  rewindFloor: 0.25,
  /** Style cost of the first level of Rewind Speed. Per-tier once Retire arrives, as above. */
  rewindSpeedBaseCost: 15,
  /** What each level owned multiplies the cost of the next one by. */
  rewindSpeedCostGrowth: 1.18,
  /**
   * Style cost of the Auto-Thrower, bought once and owned forever.
   *
   * The most load-bearing number in this file, and the only one here that has been measured
   * rather than guessed. ADR 0002 calls it retention-critical: until the player owns one,
   * closing the game earns them almost nothing, so a price beyond the first Session loses
   * players before they ever see the game become idle.
   *
   * It opened at 500, which was a guess, and the tuning harness found that guess wrong — a
   * first Session yields 375 Style to a player who banks every last one of them, so 500 was
   * 133% of everything the opening could pay and no play could reach it (#29). The price was
   * swept against the harness and 250 chosen from what came back: the machine lands 13m 20s
   * in, some 100 Throws by hand, with a third of the first Session still to spare so that a
   * later rebalance does not quietly push it back out. 350 also lands inside the Session, with
   * eighty seconds to spare, which is not margin enough to rely on.
   *
   * Where in the 200–300 band it sits is a judgement the harness cannot make: every value in
   * it keeps ADR 0002's promise, and they differ only in how long the manual opening lasts.
   * The band is the measured part; 250 within it is a choice, taken to match the ten to fifteen
   * minutes the core-loop spec asked for.
   */
  autoThrowerCost: 250,
} as const;

/**
 * PROVISIONAL — the 1A Division, in the only order its Tricks may be landed in. Every figure
 * below is a placeholder under exactly the rule the file opens with, and the ladder lives here
 * rather than beside the simulation so that the balance stays in one file (ADR 0009).
 *
 * A row is three numbers and no derived rate. `spinDrainMultiplier` multiplies the decay rate
 * of the Throw already on the string for `durationSeconds`, which is ADR 0014's whole decision:
 * an Attempt costs `durationSeconds × spinDrainMultiplier × D`, so a better Bearing makes every
 * Trick safer without any Trick knowing the Bearing exists, and a flat Spin fee would have made
 * the Bearing incidental to the content ladder. Nothing stores that product — the Bearing moves
 * `D`, and a save holding the answer would come back quoting a difficulty from before a
 * rebalance.
 *
 * The durations and the Style multipliers are the plan's (`docs/plans/first-1a-trick-slice.md`).
 * The drain multipliers are not: they are the first guess at the difficulty curve, and only Rock
 * the Baby's has been checked against anything. At the constants as they stand it costs 45 of an
 * opening Throw's 100 Spin, so it lands from any moment before 2.75s of a 5s Sleeper — at 2.75s
 * exactly the Spin runs out as the Trick finishes, which is a death — leaving over half the
 * opening Sleeper safe, which is the "safely lands on the opening Throw before any Gear
 * purchase" the plan asks of this row. `simulation.test.ts` holds that as a behavioural guard.
 * #71 is where the whole ladder meets the tuning harness and the other two rows are measured;
 * until then their multipliers are unverified against the pacing contract.
 */
export const TRICKS_1A = [
  {
    id: "rock-the-baby",
    name: "Rock the Baby",
    durationSeconds: 1.5,
    styleMultiplier: 1.25,
    spinDrainMultiplier: 1.5,
  },
  {
    id: "man-on-the-flying-trapeze",
    name: "Man on the Flying Trapeze",
    durationSeconds: 2.5,
    styleMultiplier: 1.5,
    spinDrainMultiplier: 2,
  },
  {
    id: "brain-twister",
    name: "Brain Twister",
    durationSeconds: 4,
    styleMultiplier: 2,
    spinDrainMultiplier: 2.5,
  },
] as const;
