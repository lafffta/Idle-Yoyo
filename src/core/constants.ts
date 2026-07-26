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
} as const;
