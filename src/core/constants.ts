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
   * The most load-bearing number in this file, and the one to attack first once a tuning
   * harness exists. ADR 0002 calls it retention-critical: until the player owns one, closing
   * the game earns them almost nothing, so a price beyond the first session loses players
   * before they ever see the game become idle. 500 is a guess aimed at ten to fifteen minutes
   * in — around 200 Throws by hand at the opening rate, less as Gear is bought.
   */
  autoThrowerCost: 500,
} as const;
