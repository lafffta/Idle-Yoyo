import { PROVISIONAL } from "./constants.js";

/**
 * The phase the yoyo is in. It is in exactly one of them at a time.
 *
 * A Dead Yoyo is the instant Spin reaches zero — the transition out of `Sleeping` — and
 * not a phase the yoyo sits in.
 */
export type Phase = "Sleeping" | "Rewinding" | "Ready";

/**
 * The save-compatibility surface (ADR 0008). Effective stats are never stored here: they
 * are derived from levels and the provisional constants, so that a rebalance cannot leave
 * an old save disagreeing with the numbers it was built from.
 */
export type GameState = {
  /** Schema version, present from the first save so the format can migrate later. */
  version: number;
  style: number;
  /** Everything ever earned. Nothing reads it yet; ADR 0005's Retire multiplier will. */
  lifetimeStyle: number;
  phase: Phase;
  /** Meaningful only while `Sleeping`. */
  spin: number;
  /** Seconds spent in the current phase. */
  phaseElapsed: number;
  /** Gear. Retire will clear this later; nothing in the game resets it yet. */
  throwPowerLevel: number;
};

export const SCHEMA_VERSION = 1;

export function initialState(): GameState {
  return {
    version: SCHEMA_VERSION,
    style: 0,
    lifetimeStyle: 0,
    phase: "Ready",
    spin: 0,
    phaseElapsed: 0,
    throwPowerLevel: 0,
  };
}

/** Derived from the Gear level, never stored. */
export function throwPower(state: GameState): number {
  return PROVISIONAL.baseThrowPower + PROVISIONAL.throwPowerPerLevel * state.throwPowerLevel;
}

/** What the next level of Throw Power costs. Geometric in the levels already owned. */
export function throwPowerCost(state: GameState): number {
  return PROVISIONAL.throwPowerBaseCost * PROVISIONAL.throwPowerCostGrowth ** state.throwPowerLevel;
}

/**
 * Buy a level of Throw Power. A pure transition like `throwYoyo`: it moves Style into Gear
 * and no time passes.
 *
 * The purchase applies to the *next* Throw. Spin is stored rather than derived, so a Sleeper
 * already on the string keeps the Spin it was thrown with and plays out as the player saw it
 * begin.
 */
export function buyThrowPower(state: GameState): GameState {
  const cost = throwPowerCost(state);
  // Refused rather than clamped: an unaffordable purchase leaves the state exactly as it was.
  if (state.style < cost) return state;

  return { ...state, style: state.style - cost, throwPowerLevel: state.throwPowerLevel + 1 };
}

/** Derived, never stored. The Bearing will feed into this from #7 onwards. */
export function decayRate(_state: GameState): number {
  return PROVISIONAL.baseDecay;
}

/** Derived, never stored. Rewind Speed will feed into this from #7 onwards. */
export function rewindDuration(_state: GameState): number {
  return PROVISIONAL.baseRewind;
}

/** A Throw is legal only from `Ready`. */
export function throwYoyo(state: GameState): GameState {
  if (state.phase !== "Ready") return state;
  return { ...state, phase: "Sleeping", spin: throwPower(state), phaseElapsed: 0 };
}

/**
 * Move the game forward by `seconds`. The only way time passes, and the same call whether
 * the tab has been open for a frame or closed overnight (ADR 0002).
 *
 * Integration is segment-based, not fixed-step: each pass jumps straight to the next phase
 * boundary, or consumes the rest of the delta when no boundary falls inside it. A
 * fixed-step integrator would land partial steps differently for one long call than for
 * many short ones, so time away and time watching would quietly disagree — exactly the
 * divergence ADR 0002 forecloses.
 */
export function advance(state: GameState, seconds: number): GameState {
  // Not anti-cheat: a clock correction, timezone change or DST must never run time backwards.
  let remaining = Math.max(seconds, 0);
  let current = state;

  while (remaining > 0) {
    if (current.phase === "Ready") {
      // Nothing happens here on its own, so the rest of the delta costs one step however
      // long it is.
      current = { ...current, phaseElapsed: current.phaseElapsed + remaining };
      remaining = 0;
      continue;
    }

    if (current.phase === "Rewinding") {
      // Earns nothing. ADR 0003: this dead time is what makes Uptime a quantity worth
      // improving, so the Bearing keeps working once an Auto-Thrower is in play.
      const untilWound = rewindDuration(current) - current.phaseElapsed;
      const winds = remaining >= untilWound;
      const dt = winds ? untilWound : remaining;

      current = winds
        ? { ...current, phase: "Ready", phaseElapsed: 0 }
        : { ...current, phaseElapsed: current.phaseElapsed + dt };
      remaining -= dt;
      continue;
    }

    const decay = decayRate(current);
    const untilDead = current.spin / decay;
    const dies = remaining >= untilDead;
    const dt = dies ? untilDead : remaining;

    // The integral of k × Spin across the segment: Spin falls linearly over it, so the
    // Style earned is the area under that line, not the rate at either end of it.
    const earned = PROVISIONAL.stylePerSpinPerSecond * (current.spin * dt - (decay * dt * dt) / 2);

    current = {
      ...current,
      style: current.style + earned,
      lifetimeStyle: current.lifetimeStyle + earned,
      // The Dead Yoyo is the instant Spin reaches zero, not a phase to sit in.
      ...(dies
        ? { spin: 0, phase: "Rewinding" as const, phaseElapsed: 0 }
        : { spin: current.spin - decay * dt, phaseElapsed: current.phaseElapsed + dt }),
    };
    remaining -= dt;
  }

  return current;
}
