import { PROVISIONAL } from "./constants.js";

/**
 * The simulation core (ADR 0008). Everything here is a pure function of the state it is given.
 *
 * **Time is a parameter, never an ambient fact: nothing in this module may call Date.now().**
 * Neither may it reach for `performance`, `Math.random`, a timer, a `document` or a `window`.
 * The same `advance` runs a frame while the tab is open and an overnight Absence when it is
 * reopened, and ADR 0002's promise that those obey identical rules only holds while there is
 * one implementation with no clock inside it. A wall clock here would pass every behavioural
 * test in the suite, because two calls in the same run agree with each other — so the rule is
 * enforced by `core-is-pure.test.ts`, which reads this file and fails on the ways it could
 * stop being true.
 */

/**
 * The phase the yoyo is in. It is in exactly one of them at a time.
 *
 * A Dead Yoyo is the instant Spin reaches zero — the transition out of `Sleeping` — and
 * not a phase the yoyo sits in.
 */
export type Phase = "Sleeping" | "Rewinding" | "Ready";

/** The timing Gear a Throw began with, kept until that Throw Cycle is complete. */
export type ActiveThrowGear = {
  bearingLevel: number;
  rewindSpeedLevel: number;
};

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
  /**
   * Seconds spent in the current phase. Drives the Rewind to completion, and counts the age of
   * the Sleeper on the string.
   *
   * Always zero while `Ready`, which is the one phase with nothing to measure — see `advance`.
   */
  phaseElapsed: number;
  /** Gear. Retire will clear these later; nothing in the game resets them yet. */
  throwPowerLevel: number;
  bearingLevel: number;
  rewindSpeedLevel: number;
  /**
   * The Bearing and Rewind Speed captured by the last Throw. Purchases change owned Gear and
   * readouts immediately, but `advance` uses these levels until the next Throw (ADR 0013).
   */
  activeThrowGear: ActiveThrowGear;
  /**
   * Kit, and the only member of it — owned rather than levelled, and permanent (ADR 0006).
   *
   * Sits apart from the Gear levels above deliberately. Retire clears Gear eleven times over
   * the life of the game and must leave this alone: a player who Retired before bed and woke
   * to a yoyo that died minutes after they closed the tab would have been robbed by the very
   * thing meant to reward them. Nothing resets anything yet, so the distinction lives in the
   * shape of the save until there is a Retire to honour it.
   */
  hasAutoThrower: boolean;
};

export const SCHEMA_VERSION = 2;

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
    activeThrowGear: { bearingLevel: 0, rewindSpeedLevel: 0 },
    hasAutoThrower: false,
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

function decayRateAtLevel(level: number): number {
  return PROVISIONAL.baseDecay * PROVISIONAL.bearingDecayPerLevel ** level;
}

/** The decay rate of the Sleeper currently on the string. */
export function decayRate(state: GameState): number {
  return decayRateAtLevel(state.activeThrowGear.bearingLevel);
}

/** The decay rate the next Throw will capture from the Bearing the player owns. */
function ownedDecayRate(state: GameState): number {
  return decayRateAtLevel(state.bearingLevel);
}

/** What the next level of the Bearing costs. Geometric in the levels already owned. */
export function bearingCost(state: GameState): number {
  return PROVISIONAL.bearingBaseCost * PROVISIONAL.bearingCostGrowth ** state.bearingLevel;
}

/**
 * Buy a level of the Bearing, so the Sleeper drains more slowly and lasts longer.
 *
 * The owned level moves immediately, so its next price and Sustained Style do too. The active
 * Throw keeps the level captured in `activeThrowGear` until the yoyo is Thrown again (ADR 0013).
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
function rewindDurationAtLevel(level: number): number {
  const wound = PROVISIONAL.baseRewind * PROVISIONAL.rewindPerLevel ** level;
  return Math.max(wound, PROVISIONAL.rewindFloor);
}

/** The Rewind duration belonging to the Throw Cycle currently in progress. */
export function rewindDuration(state: GameState): number {
  return rewindDurationAtLevel(state.activeThrowGear.rewindSpeedLevel);
}

/** The Rewind duration the next Throw will capture from the Gear the player owns. */
function ownedRewindDuration(state: GameState): number {
  return rewindDurationAtLevel(state.rewindSpeedLevel);
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
 * The owned level and its readouts move immediately. A Rewind already in progress keeps the
 * duration captured when its Throw began; the shorter duration starts next Throw (ADR 0013).
 */
export function buyRewindSpeed(state: GameState): GameState {
  const cost = rewindSpeedCost(state);
  if (state.style < cost) return state;

  return { ...state, style: state.style - cost, rewindSpeedLevel: state.rewindSpeedLevel + 1 };
}

/**
 * What the Auto-Thrower costs.
 *
 * Takes no state, unlike every Gear price: Kit is owned rather than levelled, so there is no
 * level to price the next one against and no second one to sell.
 */
export function autoThrowerCost(): number {
  return PROVISIONAL.autoThrowerCost;
}

/**
 * Buy the Auto-Thrower — the moment the game stops being a clicker and becomes an idler
 * (ADR 0002).
 *
 * A one-time purchase and not a level: a player who clicks twice has spent its price once. The
 * second click is refused for the same reason an unaffordable one is, and by the same rule —
 * the state comes back exactly as it went in.
 */
export function buyAutoThrower(state: GameState): GameState {
  if (state.hasAutoThrower) return state;

  const cost = autoThrowerCost();
  if (state.style < cost) return state;

  return { ...state, style: state.style - cost, hasAutoThrower: true };
}

/** A Throw is legal only from `Ready`. */
export function throwYoyo(state: GameState): GameState {
  if (state.phase !== "Ready") return state;
  return {
    ...state,
    phase: "Sleeping",
    spin: throwPower(state),
    phaseElapsed: 0,
    activeThrowGear: {
      bearingLevel: state.bearingLevel,
      rewindSpeedLevel: state.rewindSpeedLevel,
    },
  };
}

/**
 * The Auto-Thrower's entire behaviour: a yoyo back in the hand is Thrown again at once.
 *
 * It re-Throws rather than shortcutting anything — the string still winds, the Rewind is still
 * waited out, and the Throw it makes is the same `throwYoyo` a player makes, at whatever Throw
 * Power they own now. It buys the player's absence, not speed, which is why it moves Sustained
 * Style not at all (ADR 0002).
 */
function reThrowIfAutomatic(state: GameState): GameState {
  return state.hasAutoThrower ? throwYoyo(state) : state;
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
      if (current.hasAutoThrower) {
        // Bought while the yoyo sat in the hand: the machine takes over without waiting for
        // the cycle to come round. Costs no time, so the Throw lands at the top of this delta
        // rather than a moment into it.
        current = throwYoyo(current);
        continue;
      }

      // Nothing happens here on its own, so the rest of the delta costs one step however long it
      // is — and the time is consumed rather than recorded. `phaseElapsed` measures the phase it
      // is in, and `Ready` has nothing to measure: nothing reads it here, and the only boundary
      // ahead is a Throw, which no amount of waiting brings closer. Left to accumulate it would
      // climb for as long as the yoyo sat in the hand, banking a month of meaningless seconds in
      // a field ADR 0008 makes a compatibility surface.
      //
      // Cleared rather than merely left alone, so that the field is zero for every `Ready` state
      // and not just the ones reached from here — a save written before this rule heals on the
      // first frame after it loads. Guarded so that the ordinary wait still allocates nothing.
      if (current.phaseElapsed !== 0) current = { ...current, phaseElapsed: 0 };
      remaining = 0;
      continue;
    }

    if (current.phase === "Rewinding") {
      // Earns nothing. ADR 0003: this dead time is what makes Uptime a quantity worth
      // improving, so the Bearing keeps working once an Auto-Thrower is in play.
      // Clamped at zero so that no call can advance further than the delta it was given. A
      // migrated or malformed save may carry more phase time than its captured Gear permits;
      // subtracting that negative remainder would hand the overshoot back as newly minted time.
      const untilWound = Math.max(rewindDuration(current) - current.phaseElapsed, 0);
      const winds = remaining >= untilWound;
      const dt = winds ? untilWound : remaining;

      // Re-Thrown here rather than on the next pass of the loop, so that a delta ending exactly
      // as the string finishes winding still finds the yoyo spinning: with an Auto-Thrower there
      // is no instant at which it waits in the hand.
      current = winds
        ? reThrowIfAutomatic({ ...current, phase: "Ready", phaseElapsed: 0 })
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
  const sleeperLength = throwPower(state) / ownedDecayRate(state);
  return sleeperLength / (sleeperLength + ownedRewindDuration(state));
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
 * ADR 0013 makes that exactness stable for the life of the Sleeper: a Bearing bought mid-Throw
 * changes owned Gear and Sustained Style immediately, while this projection keeps using the
 * active Throw's captured decay rate. The death and remaining yield the player was shown do not
 * move under the yoyo already on the string.
 *
 * Counts only what is still to come, so it falls as the Sleeper is spent and is zero whenever
 * there is no Throw in progress to project.
 */
export function projectedYield(state: GameState): number {
  if (state.phase !== "Sleeping") return 0;
  return (PROVISIONAL.stylePerSpinPerSecond * state.spin ** 2) / (2 * decayRate(state));
}
