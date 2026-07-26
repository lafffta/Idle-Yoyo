// PROTOTYPE — throwaway. See README.md in this directory.
//
// The pure half: `advance` and its sibling transitions, at the seam ADR 0008 mandates.
// No I/O, no terminal escapes, no Date.now(). The TUI imports this; nothing flows back.

/** PROVISIONAL — every number here is a placeholder from #3, not an authored value. */
export const CONSTANTS = {
  stylePerSpinPerSecond: 0.01, // k
  baseThrowPower: 100, // S0, Spin
  throwPowerPerLevel: 20, // Spin
  baseDecay: 20, // D, Spin/s
  decayPerLevel: 0.92, // multiplicative
  baseRewind: 3.0, // R, seconds
  rewindPerLevel: 0.9, // multiplicative
  rewindFloor: 0.25, // seconds — NOT a tuning preference, see ADR 0003
  throwPowerCost: 10,
  throwPowerCostGrowth: 1.15,
  bearingCost: 25,
  bearingCostGrowth: 1.18,
  rewindSpeedCost: 15,
  rewindSpeedCostGrowth: 1.18,
  autoThrowerCost: 500,
};

export type Phase = "Sleeping" | "Rewinding" | "Ready";

export type GameState = {
  version: number;
  style: number;
  lifetimeStyle: number;
  phase: Phase;
  spin: number;
  phaseElapsed: number;
  throwPowerLevel: number;
  bearingLevel: number;
  rewindSpeedLevel: number;
  hasAutoThrower: boolean;
};

export function initialState(): GameState {
  return {
    version: 1,
    style: 0,
    lifetimeStyle: 0,
    phase: "Ready",
    spin: 0,
    phaseElapsed: 0,
    throwPowerLevel: 0,
    bearingLevel: 0,
    rewindSpeedLevel: 0,
    hasAutoThrower: false,
  };
}

// --- Derived stats. Never stored, always recomputed from levels. ---

export function throwPower(s: GameState): number {
  return CONSTANTS.baseThrowPower + CONSTANTS.throwPowerPerLevel * s.throwPowerLevel;
}

export function decayRate(s: GameState): number {
  return CONSTANTS.baseDecay * Math.pow(CONSTANTS.decayPerLevel, s.bearingLevel);
}

export function rewindDuration(s: GameState): number {
  const unfloored = CONSTANTS.baseRewind * Math.pow(CONSTANTS.rewindPerLevel, s.rewindSpeedLevel);
  return Math.max(unfloored, CONSTANTS.rewindFloor);
}

// --- Derived readouts. Functions of state alone; nothing measures history. ---

export function throwCycleLength(s: GameState): number {
  return throwPower(s) / decayRate(s) + rewindDuration(s);
}

export function uptime(s: GameState): number {
  const p = throwPower(s);
  return p / (p + rewindDuration(s) * decayRate(s));
}

/** (k·S0 / 2) × uptime — the headline figure, computed from stats, never averaged. */
export function sustainedStyle(s: GameState): number {
  return (CONSTANTS.stylePerSpinPerSecond * throwPower(s)) / 2 * uptime(s);
}

/** The same figure the other way round: yield per Throw over cycle length. */
export function sustainedStyleViaYield(s: GameState): number {
  return yieldPerThrow(s) / throwCycleLength(s);
}

export function yieldPerThrow(s: GameState): number {
  const p = throwPower(s);
  return (CONSTANTS.stylePerSpinPerSecond * p * p) / (2 * decayRate(s));
}

export function currentStyleRate(s: GameState): number {
  return s.phase === "Sleeping" ? CONSTANTS.stylePerSpinPerSecond * s.spin : 0;
}

/** Exact, not an estimate: the whole future of a Sleeper is known the instant it is thrown. */
export function projectedRemainingYield(s: GameState): number {
  if (s.phase !== "Sleeping") return 0;
  return (CONSTANTS.stylePerSpinPerSecond * s.spin * s.spin) / (2 * decayRate(s));
}

/** Seconds until the current phase ends. Infinite at Ready without an Auto-Thrower. */
export function timeToBoundary(s: GameState): number {
  if (s.phase === "Sleeping") return s.spin / decayRate(s);
  if (s.phase === "Rewinding") return Math.max(rewindDuration(s) - s.phaseElapsed, 0);
  return s.hasAutoThrower ? 0 : Infinity;
}

// --- Costs ---

export function throwPowerPrice(s: GameState): number {
  return CONSTANTS.throwPowerCost * Math.pow(CONSTANTS.throwPowerCostGrowth, s.throwPowerLevel);
}

export function bearingPrice(s: GameState): number {
  return CONSTANTS.bearingCost * Math.pow(CONSTANTS.bearingCostGrowth, s.bearingLevel);
}

export function rewindSpeedPrice(s: GameState): number {
  return CONSTANTS.rewindSpeedCost * Math.pow(CONSTANTS.rewindSpeedCostGrowth, s.rewindSpeedLevel);
}

// --- Transitions. Pure; none of them advance time. ---

/** Legal only from Ready. Anything else leaves state untouched. */
export function throwYoyo(s: GameState): GameState {
  if (s.phase !== "Ready") return s;
  return { ...s, phase: "Sleeping", spin: throwPower(s), phaseElapsed: 0 };
}

function buy(s: GameState, price: number, apply: (s: GameState) => GameState): GameState {
  if (s.style < price) return s;
  return apply({ ...s, style: s.style - price });
}

export function buyThrowPower(s: GameState): GameState {
  return buy(s, throwPowerPrice(s), (n) => ({ ...n, throwPowerLevel: n.throwPowerLevel + 1 }));
}

export function buyBearing(s: GameState): GameState {
  return buy(s, bearingPrice(s), (n) => ({ ...n, bearingLevel: n.bearingLevel + 1 }));
}

export function buyRewindSpeed(s: GameState): GameState {
  return buy(s, rewindSpeedPrice(s), (n) => ({ ...n, rewindSpeedLevel: n.rewindSpeedLevel + 1 }));
}

export function buyAutoThrower(s: GameState): GameState {
  if (s.hasAutoThrower) return s;
  return buy(s, CONSTANTS.autoThrowerCost, (n) => ({ ...n, hasAutoThrower: true }));
}

// --- The integrator ---

/**
 * Segment-based, not fixed-step: jump to the next phase boundary, never tick.
 * A fixed-step integrator makes one long call disagree with many short ones,
 * which is the divergence ADR 0002 forecloses.
 */
export function advance(state: GameState, seconds: number): GameState {
  return advanceWithSegments(state, seconds).state;
}

/**
 * Same integrator, reporting how many segments it took. The count is for the prototype's
 * benefit only — it makes "a long absence costs one iteration per Throw Cycle" watchable.
 * Tests would assert on behaviour, never on this.
 */
export function advanceWithSegments(
  state: GameState,
  seconds: number,
): { state: GameState; segments: number; hitCap: boolean } {
  // Not anti-cheat: a clock correction, timezone change or DST must never run time backwards.
  let remaining = Math.max(seconds, 0);
  let s = state;
  let segments = 0;
  const cap = 5_000_000;

  while (remaining > 0) {
    if (segments >= cap) return { state: s, segments, hitCap: true };
    segments += 1;

    if (s.phase === "Ready") {
      if (s.hasAutoThrower) {
        s = throwYoyo(s); // zero-time transition; no time is spent at Ready
        continue;
      }
      // Nothing will ever happen here on its own. Swallow the rest in one step.
      s = { ...s, phaseElapsed: s.phaseElapsed + remaining };
      remaining = 0;
      continue;
    }

    if (s.phase === "Sleeping") {
      const decay = decayRate(s);
      const toDeath = s.spin / decay;
      if (remaining < toDeath) {
        const dt = remaining;
        const earned = CONSTANTS.stylePerSpinPerSecond * (s.spin * dt - (decay * dt * dt) / 2);
        s = {
          ...s,
          spin: s.spin - decay * dt,
          phaseElapsed: s.phaseElapsed + dt,
          style: s.style + earned,
          lifetimeStyle: s.lifetimeStyle + earned,
        };
        remaining = 0;
      } else {
        // The Dead Yoyo: an instant of transition, not a phase to sit in.
        const earned = (CONSTANTS.stylePerSpinPerSecond * s.spin * s.spin) / (2 * decay);
        s = {
          ...s,
          spin: 0,
          phase: "Rewinding",
          phaseElapsed: 0,
          style: s.style + earned,
          lifetimeStyle: s.lifetimeStyle + earned,
        };
        remaining -= toDeath;
      }
      continue;
    }

    // Rewinding. Earns nothing — that dead time is what keeps Uptime meaningful.
    const toWound = Math.max(rewindDuration(s) - s.phaseElapsed, 0);
    if (remaining < toWound) {
      s = { ...s, phaseElapsed: s.phaseElapsed + remaining };
      remaining = 0;
    } else {
      s = { ...s, phase: "Ready", phaseElapsed: 0 };
      remaining -= toWound;
    }
  }

  return { state: s, segments, hitCap: false };
}
