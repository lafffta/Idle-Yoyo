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
  /** Gear. Retire will clear these later; nothing in the game resets them yet. */
  throwPowerLevel: number;
  bearingLevel: number;
  rewindSpeedLevel: number;
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
    bearingLevel: 0,
    rewindSpeedLevel: 0,
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

/** Derived from the Gear level, never stored. A better Bearing drains Spin more slowly. */
export function decayRate(state: GameState): number {
  return PROVISIONAL.baseDecay * PROVISIONAL.bearingDecayPerLevel ** state.bearingLevel;
}

/** What the next level of the Bearing costs. Geometric in the levels already owned. */
export function bearingCost(state: GameState): number {
  return PROVISIONAL.bearingBaseCost * PROVISIONAL.bearingCostGrowth ** state.bearingLevel;
}

/**
 * Buy a level of the Bearing, so the Sleeper drains more slowly and lasts longer.
 *
 * **A known deviation from the ticket, recorded here rather than quietly taken.** #7 asks that
 * purchases "apply from the next Throw, not retroactively". Throw Power manages that for
 * free, because the Spin a Throw starts with is stored on the state and the Sleeper in flight
 * keeps it. The Bearing has no such anchor: the decay rate is derived from this level every
 * time `advance` asks for it, so buying mid-Sleeper slows the yoyo already on the string.
 *
 * Honouring the ticket literally would mean either storing the level a Throw was made at —
 * widening the save surface ADR 0008 asks us to keep narrow, and which the core-loop spec
 * enumerates without such a field — or refusing purchases outside `Ready`, which nobody asked
 * for and which would stop a player shopping while the yoyo sleeps. Neither looked worth it
 * for an effect a player reads as the purchase working immediately.
 *
 * Nothing is rewritten either way: the Style already banked and the Spin the Throw started
 * with both stand. If the next Throw really must be the boundary, that is a design decision
 * for an ADR, not something to change here on its own.
 */
export function buyBearing(state: GameState): GameState {
  const cost = bearingCost(state);
  if (state.style < cost) return state;

  return { ...state, style: state.style - cost, bearingLevel: state.bearingLevel + 1 };
}

/**
 * Derived from the Gear level, never stored. Better Rewind Speed winds the string faster.
 *
 * Floored, and the floor is structural rather than a tuning preference: at a Rewind of zero
 * the decay rate cancels out of sustained earnings and the Bearing stops working at all
 * (ADR 0003). Removing it would quietly delete a shop row rather than merely rebalance one.
 */
export function rewindDuration(state: GameState): number {
  const wound = PROVISIONAL.baseRewind * PROVISIONAL.rewindPerLevel ** state.rewindSpeedLevel;
  return Math.max(wound, PROVISIONAL.rewindFloor);
}

/** What the next level of Rewind Speed costs. Geometric in the levels already owned. */
export function rewindSpeedCost(state: GameState): number {
  return PROVISIONAL.rewindSpeedBaseCost * PROVISIONAL.rewindSpeedCostGrowth ** state.rewindSpeedLevel;
}

/**
 * Buy a level of Rewind Speed, so less of each Throw Cycle is spent earning nothing.
 *
 * The Bearing's opposite number: both move Uptime, which depends on the product of the
 * Rewind duration and the decay rate, so these are two prices for one effect rather than
 * two effects (ADR 0003).
 *
 * Derived from the level for the same reason as the Bearing, and with the same deviation from
 * #7's "applies from the next Throw" — see `buyBearing`. A Rewind already longer than its new
 * duration simply finishes; `advance` clamps so that costs no time.
 */
export function buyRewindSpeed(state: GameState): GameState {
  const cost = rewindSpeedCost(state);
  if (state.style < cost) return state;

  return { ...state, style: state.style - cost, rewindSpeedLevel: state.rewindSpeedLevel + 1 };
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
      // Clamped at zero so that no call can advance further than the delta it was given.
      // The Rewind duration is derived, so buying Rewind Speed part-way through a Rewind can
      // shorten it to less than the string has already spent winding; a negative remainder
      // would then be subtracted from the delta, handing the overshoot back as extra time.
      const untilWound = Math.max(rewindDuration(current) - current.phaseElapsed, 0);
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

/**
 * The fraction of a Throw Cycle the yoyo spends spinning rather than winding — `S₀/(S₀ + R·D)`,
 * written here as the ratio it names.
 *
 * Not exported: nothing outside asks for it yet, and `GameState` plus the readouts below are
 * surface enough. The tests measure Uptime by playing a cycle instead, which is what lets them
 * disagree with this.
 */
function uptime(state: GameState): number {
  const spinning = throwPower(state) / decayRate(state);
  return spinning / (spinning + rewindDuration(state));
}

/**
 * **Sustained Style** — Style per second averaged over a whole Throw Cycle, and the figure the
 * whole game is read through (ADR 0007).
 *
 * A function of the Gear levels and nothing else, which is the point rather than an accident.
 * ADR 0007 names the alternative as a failure mode: an average *measured* over recent cycles
 * lags every purchase by a full cycle, so a player who buys something watches the number sit
 * still and concludes the purchase did nothing. Derived from current stats, it moves on the
 * purchase itself.
 *
 * Depending on no part of the state that time changes has two more consequences the ADRs ask
 * for. It is already right during the first Throw Cycle of a run, before any cycle has
 * completed and there is any history to average. And it does not dip during the Rewind — ADR
 * 0003 worried that players would read the winding animation as wasted time, and a headline
 * figure that does not flinch takes most of the force out of that.
 *
 * `(k·S₀/2)` is the ceiling only Throw Power raises; Uptime is the fraction of it actually
 * collected.
 */
export function sustainedStyle(state: GameState): number {
  const ceiling = (PROVISIONAL.stylePerSpinPerSecond * throwPower(state)) / 2;
  return ceiling * uptime(state);
}

/**
 * The Style the Sleeper is earning at this instant — `k × Spin`, and zero whenever the yoyo is
 * not spinning.
 *
 * ADR 0007 keeps this figure off the screen as a digit: it never stops moving, reads
 * differently at every glance, and cannot be compared against a shop price. It is shown as
 * *motion* instead — the yoyo visibly slowing, the Style counter visibly decelerating — which
 * is what makes the decay model legible without turning it into arithmetic. The quantity is
 * still needed, because that animation is a readout rather than garnish.
 *
 * The phase is what decides whether anything is earned, rather than Spin being zero: a Dead
 * Yoyo, a winding string and a yoyo waiting in the hand all earn nothing, and the readout
 * should not depend on a field `GameState` declares meaningless outside a Sleeper.
 */
export function currentStyleRate(state: GameState): number {
  if (state.phase !== "Sleeping") return 0;
  return PROVISIONAL.stylePerSpinPerSecond * state.spin;
}

/**
 * The Style the Sleeper on the string has left to earn: `k·Spin²/2D`, the area under the rest
 * of its decay.
 *
 * **Exact, not estimated.** Linear decay is deterministic, so the whole future of a Throw is
 * known the instant it is thrown, and ADR 0007 asks for this to be presented at full confidence
 * with no hedging language — the Sleeper goes on to earn precisely this. ADR 0007 also notes the
 * readout would not exist at all under exponential decay, where the yoyo never quite dies. It is
 * a genuine dividend of ADR 0001 rather than a convenience.
 *
 * What "exact" claims is worth stating precisely, because the prototype on #3 found the edge:
 * the decay rate is derived from the Bearing level rather than snapshotted at the Throw, so
 * buying a Bearing mid-Sleeper moves the death of the yoyo already on the string and re-quotes
 * this figure. The projection is exact about the yoyo as it stands; it is not a promise that no
 * purchase can move it. #7 settled that deliberately — see `buyBearing`.
 *
 * Counts only what is still to come, so it falls as the Sleeper is spent and is zero whenever
 * there is no Throw in progress to project.
 */
export function projectedYield(state: GameState): number {
  if (state.phase !== "Sleeping") return 0;
  return (PROVISIONAL.stylePerSpinPerSecond * state.spin ** 2) / (2 * decayRate(state));
}
