import {
  MOUNT_TRICKS_1A,
  PROVISIONAL,
  SPINE_TRICKS_1A,
  TRICK_GROUPS_1A,
  TRICKS_1A,
} from "./constants.js";

/**
 * The 1A content, re-exported so that everything outside the core reaches it through the one
 * module ADR 0008 puts the simulation behind. A shell reads the authored groups for structure;
 * save and tuning code read the flat collection when they need to validate every Trick.
 */
export { TRICK_GROUPS_1A, TRICKS_1A };

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
 * One row of a Division: a name, how long performing it takes, its permanent landed effect,
 * and how much harder it drives the Sleeper while it runs.
 *
 * The shape is read off the content rather than declared over it, so `constants.ts` stays the one
 * place a figure can be changed and there is no second declaration to drift from it.
 */
export type Trick = (typeof TRICKS_1A)[number];

/** How a landed Trick is named in a save. Ids rather than positions: the ladder may grow. */
export type TrickId = Trick["id"];

type PromisedThrow = {
  throwPowerLevel: number;
  bearingLevel: number;
};

/**
 * A Trick committed by the player.
 *
 * Once it is performing, it carries what is left to do and not what it costs. A commitment made
 * during Rewind also carries the Gear levels its exact next-Throw preview used, until the Attempt
 * resolves. Levels rather than derived Spin or decay keep a saved promise responsive to a
 * rebalance (ADR 0008), while keeping later Gear purchases from rescuing the commitment through
 * the back door ADR 0014 closes.
 */
export type Attempt = {
  trickId: TrickId;
  /** Seconds of the Trick still to perform. The Trick lands when this reaches zero. */
  remaining: number;
  /** Present from a Rewind commitment until its promised outcome resolves. */
  promisedThrow?: PromisedThrow;
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
  /**
   * The Tricks landed, in the order they were landed. Permanent facts, kept through every Retire
   * (ADR 0004), and named rather than counted so that the ladder can grow past them.
   *
   * The multiplier they are worth is derived from them — see `trickMultiplier`. Storing the
   * product instead would be storing a stat, which ADR 0008 bars for the same reason it bars a
   * stored Throw Power: a rebalanced reward would leave every old save richer or poorer than the
   * game it is loaded into, with nothing able to tell which figure was meant.
   */
  landedTricks: TrickId[];
  /** The committed Trick, or `null`; during Rewind it waits for the next Sleeper. */
  attempt: Attempt | null;
};

export const SCHEMA_VERSION = 3;

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
    landedTricks: [],
    attempt: null,
  };
}

/** Derived from the Gear level and landed Trick facts, never stored. */
export function throwPower(state: GameState): number {
  const ordinary =
    PROVISIONAL.baseThrowPower + PROVISIONAL.throwPowerPerLevel * state.throwPowerLevel;
  return ordinary * throwPowerSpinMultiplier(state);
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

function decayRateAtLevel(level: number, state: GameState): number {
  // A Structural Trick packs more Spin into each unit of Throw Power, so that denser Spin is
  // spent at the same proportionally denser rate. Sleeper length and therefore Uptime stay put;
  // the conversion raises the Power ceiling without becoming a second Bearing effect (ADR 0003).
  return (
    PROVISIONAL.baseDecay *
    PROVISIONAL.bearingDecayPerLevel ** level *
    throwPowerSpinMultiplier(state)
  );
}

/** The decay rate of the Sleeper currently on the string. */
export function decayRate(state: GameState): number {
  return decayRateAtLevel(state.activeThrowGear.bearingLevel, state);
}

/** The decay rate the next Throw will capture from the Bearing the player owns. */
function ownedDecayRate(state: GameState): number {
  return decayRateAtLevel(state.bearingLevel, state);
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

/**
 * A Throw is legal only from `Ready`.
 *
 * Ordinarily a fresh Sleeper starts with no Trick in progress. Mach 5 is the exception: it lets
 * the player commit an Attempt during Rewind, and that waiting Attempt crosses `Ready` untouched
 * so its ordinary Spin drain begins on this Sleeper rather than during the dead time.
 */
export function throwYoyo(state: GameState): GameState {
  if (state.phase !== "Ready") return state;
  const waitingAttempt =
    state.attempt?.promisedThrow !== undefined && allowsAttemptDuringRewind(state)
      ? state.attempt
      : null;
  return {
    ...state,
    phase: "Sleeping",
    spin: throwPower(state),
    phaseElapsed: 0,
    activeThrowGear: {
      bearingLevel: state.bearingLevel,
      rewindSpeedLevel: state.rewindSpeedLevel,
    },
    attempt: waitingAttempt,
  };
}

/**
 * The Trick of that name, or `undefined` if this build has no such Trick.
 *
 * Takes a bare `string` because its caller is the save layer, which is holding a document it has
 * not yet decided to trust — a stored id is only a `TrickId` once something has checked, and this
 * is the check. The ladder is code and a save is not, so the two can disagree.
 */
export function findTrick(id: string): Trick | undefined {
  return TRICKS_1A.find((candidate) => candidate.id === id);
}

/**
 * The Trick a validated `TrickId` names — every id that reaches this build's state, whether from
 * a fresh `attemptTrick` or a save the load layer has already accepted.
 *
 * Unreachable through the type: a save can only name a Trick this build still ships, because
 * the save layer turns away a document naming anything else. Thrown rather than defaulted so
 * that removing a row from the ladder is a loud change, not a Trick that stops draining Spin.
 */
export function trickById(id: TrickId): Trick {
  const trick = findTrick(id);
  if (trick === undefined) throw new Error(`no such Trick: ${id}`);
  return trick;
}

/**
 * Every Trick the player's landed facts make reachable, whether or not one can be Attempted this
 * instant. The spine contributes its first unlanded row while each Mount contributes its own
 * unlanded rows, so independent groups can be offered together.
 */
export function reachableTricks(state: GameState): Trick[] {
  const nextSpineTrick =
    SPINE_TRICKS_1A.find((trick) => !state.landedTricks.includes(trick.id)) ?? null;
  const mountTricks = MOUNT_TRICKS_1A.filter(
    (trick) =>
      !state.landedTricks.includes(trick.id) &&
      (!trick.requiresAutoThrower || state.hasAutoThrower),
  );

  return nextSpineTrick === null ? [...mountTricks] : [nextSpineTrick, ...mountTricks];
}

/** Whether the player's landed facts grant permission to commit an Attempt during Rewind. */
function allowsAttemptDuringRewind(state: GameState): boolean {
  return state.landedTricks.some((id) => trickById(id).allowsAttemptDuringRewind);
}

/**
 * Every Trick the player may Attempt this instant.
 *
 * ADR 0004 has no declared Gear requirement: a reachable Trick remains Attemptable even when the
 * preview says the Sleeper cannot sustain it. Action state is also part of the answer, so there is
 * nothing Attemptable off a live Sleeper (except through Mach 5) or while another Attempt runs.
 */
export function attemptableTricks(state: GameState): Trick[] {
  const mayBegin =
    state.phase === "Sleeping" ||
    (state.phase === "Rewinding" && allowsAttemptDuringRewind(state));
  if (!mayBegin || state.attempt !== null) return [];
  return reachableTricks(state);
}

/**
 * What every Trick landed so far multiplies Style by, together — the product of their fixed
 * rewards, and 1 until the first one lands.
 *
 * Derived from the landed facts every time it is asked for, so a rebalanced reward reprices a
 * save that already holds the Trick rather than leaving it on the old figure (ADR 0008).
 *
 * Not exported: it reaches the player through the readouts that already carry it, and a second
 * way to ask would be a second figure to keep in step with them.
 */
function trickMultiplier(state: GameState): number {
  return state.landedTricks.reduce((product, id) => product * trickById(id).styleMultiplier, 1);
}

/** How densely the player's Throw Power is packed into Spin, derived only from landed Tricks. */
function throwPowerSpinMultiplier(state: GameState): number {
  return state.landedTricks.reduce(
    (product, id) => product * trickById(id).throwPowerSpinMultiplier,
    1,
  );
}

/** How landing this Trick repacks the Spin left on its current Sleeper. */
function landingSpinPacking(state: GameState, trick: Trick): number {
  const afterLanding = { ...state, landedTricks: [...state.landedTricks, trick.id] };
  return throwPowerSpinMultiplier(afterLanding) / throwPowerSpinMultiplier(state);
}

/** The headroom bonus rate the player's landed facts currently grant, never stored in a save. */
function landingStylePerSpinHeadroom(state: GameState): number {
  return state.landedTricks.reduce(
    (sum, id) => sum + trickById(id).landingStylePerSpinHeadroom,
    0,
  );
}

/** The new bonus rate this landing adds, applied to the Spin left above the Attempt's cost. */
function landingStyleBonus(state: GameState, trick: Trick, spinHeadroom: number): number {
  const afterLanding = { ...state, landedTricks: [...state.landedTricks, trick.id] };
  const addedRate =
    landingStylePerSpinHeadroom(afterLanding) - landingStylePerSpinHeadroom(state);
  return spinHeadroom * addedRate;
}

/**
 * The Trick the player may begin this instant, or `null` when they may begin none — there is no
 * live Sleeper, a Trick is already being performed, or every reachable Trick has landed.
 *
 * One rule, read by both the action and its preview, so that what the player is shown and what
 * the game will accept cannot come apart: a preview exists exactly when `attemptTrick` goes
 * through.
 */
function attemptableNow(state: GameState, trickId: TrickId): Trick | null {
  return attemptableTricks(state).find((trick) => trick.id === trickId) ?? null;
}

/**
 * The Spin an Attempt drains per second: the decay of the Throw already on the string, driven at
 * the Trick's rate.
 *
 * `decayRate` reads the Bearing the Throw captured rather than the one the player owns (ADR
 * 0013), which is what makes ADR 0014's promise hold without an Attempt having to remember
 * anything: Gear bought mid-Attempt is owned at once, moves Sustained Style at once, and cannot
 * reach back into the Attempt the player has already committed to.
 */
function attemptDrain(state: GameState, trick: Trick): number {
  return decayRate(state) * trick.spinDrainMultiplier;
}

/**
 * What an Attempt with `remaining` seconds still to perform does to the Sleeper it is on.
 *
 * The one place the landing rule lives. Landing wants Spin *left over* — a Trick that empties
 * the Sleeper at the very instant it finishes has killed the yoyo rather than taught it anything
 * — and that boundary is quoted to the player before they commit, integrated by `advance` when
 * they do, and projected by `projectedYield` while it runs. Three readings of one rule would be
 * three chances for the preview to promise a landing the simulation then refuses, so all three
 * ask here.
 */
function attemptOutcome(state: GameState, trick: Trick, remaining: number): AttemptOutcome {
  const drain = attemptDrain(state, trick);
  const spinBeforeLanding = state.spin - drain * remaining;

  return spinBeforeLanding > 0
    ? {
        lands: true,
        spinOnLanding: spinBeforeLanding * landingSpinPacking(state, trick),
        styleBonus: landingStyleBonus(state, trick, spinBeforeLanding),
      }
    : { lands: false, secondsUntilDeath: state.spin / drain };
}

/**
 * Commit to the named Trick. Ordinarily it begins on the Sleeper on the string; Mach 5 also lets
 * it be committed during Rewind, where it waits for the next Sleeper. This is the one action
 * Tricks have, and the only thing the game ever asks the player to do with their hands (ADR 0004).
 *
 * Refused off a live Sleeper without that permission, and refused while another Attempt is
 * committed: an Attempt cannot be cancelled, restarted or swapped, so there is no way to spend
 * the commitment twice.
 *
 * **A fatal Attempt is not refused.** The outcome is known exactly before the player commits —
 * `previewAttempt` says so in Spin or in seconds — so attempting a Trick the Sleeper cannot
 * sustain is a choice to gamble the tail of a Throw, not an accident to be protected from. ADR
 * 0004 rests on that: the alternative is a dice roll, and a refusal would delete the trade along
 * with the risk. Costs nothing and moves no time; only `advance` resolves it.
 */
export function attemptTrick(state: GameState, trickId: TrickId): GameState {
  const trick = attemptableNow(state, trickId);
  if (trick === null) return state;

  const attempt: Attempt =
    state.phase === "Rewinding"
      ? {
          trickId: trick.id,
          remaining: trick.durationSeconds,
          promisedThrow: {
            throwPowerLevel: state.throwPowerLevel,
            bearingLevel: state.bearingLevel,
          },
        }
      : { trickId: trick.id, remaining: trick.durationSeconds };
  return { ...state, attempt };
}

/** The immutable outcome quoted when this Attempt was committed during Rewind, if it was. */
function promisedAttemptOutcome(
  state: GameState,
  trick: Trick,
  attempt: Attempt,
): AttemptOutcome | null {
  const promised = attempt.promisedThrow;
  if (promised === undefined) return null;

  const promisedState: GameState = {
    ...state,
    throwPowerLevel: promised.throwPowerLevel,
    activeThrowGear: {
      bearingLevel: promised.bearingLevel,
      // Rewind Speed is not an Attempt input. This value is unused by the promised outcome and
      // stays current only so the synthetic state remains a coherent GameState.
      rewindSpeedLevel: state.activeThrowGear.rewindSpeedLevel,
    },
  };
  return attemptOutcome(
    { ...promisedState, spin: throwPower(promisedState) },
    trick,
    trick.durationSeconds,
  );
}

/**
 * What an Attempt does when it ends, quoted exactly and for the same reason `projectedYield` is:
 * linear decay makes the whole Attempt knowable at the instant it starts (ADR 0001), so ADR 0007
 * asks for it stated at full confidence. A landing quotes the Spin the yoyo will be left
 * holding; a fatal Attempt quotes how many seconds it survives. Neither hedges, and both are
 * what the yoyo actually does — the tests measure them by playing the Attempt out.
 */
export type AttemptOutcome =
  | { readonly lands: true; readonly spinOnLanding: number; readonly styleBonus: number }
  | { readonly lands: false; readonly secondsUntilDeath: number };

/**
 * Everything the player needs before committing: which Trick is on offer, how long it takes,
 * what landing it pays, and what it would do to the Sleeper they have.
 *
 * The Trick travels with the outcome rather than being fetched beside it, so a shell cannot show
 * one row's reward against another row's landing Spin.
 */
export type AttemptPreview = {
  readonly trick: Trick;
  readonly outcome: AttemptOutcome;
};

/**
 * What beginning an Attempt on the named Trick right now would do, in full, or `null` when that
 * Trick is not Attemptable — including without a live Sleeper or Rewind permission, or while
 * another Attempt runs.
 */
export function previewAttempt(state: GameState, trickId: TrickId): AttemptPreview | null {
  const trick = attemptableNow(state, trickId);
  if (trick === null) return null;

  const previewState =
    state.phase === "Rewinding"
      ? throwYoyo({ ...state, phase: "Ready", phaseElapsed: 0, attempt: null })
      : state;
  return { trick, outcome: attemptOutcome(previewState, trick, trick.durationSeconds) };
}

/**
 * The Trick committed and how far through its performance it is, from 0 as it begins to 1 as it
 * resolves. A commitment waiting during Rewind reports 0 until the next Sleeper begins.
 *
 * ADR 0014 puts Attempt progress in the core and says the shell "renders that state and never
 * runs a second timer for it". This is that state: an animation reads it every frame and stays
 * synchronised to the simulation by construction, rather than by two clocks agreeing.
 */
export type ActiveAttempt = {
  readonly trick: Trick;
  readonly progress: number;
};

export function activeAttempt(state: GameState): ActiveAttempt | null {
  const attempt = state.attempt;
  if (attempt === null) return null;

  const trick = trickById(attempt.trickId);
  const progress = state.phase === "Sleeping" ? 1 - attempt.remaining / trick.durationSeconds : 0;
  return { trick, progress };
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

    // An Attempt is activity inside the Sleeper and not a fourth phase (ADR 0014): the yoyo goes
    // on spinning and goes on earning, and all the Trick changes is how hard it is driven.
    const attempt = current.attempt;
    const trick = attempt === null ? null : trickById(attempt.trickId);
    const decay = trick === null ? decayRate(current) : attemptDrain(current, trick);
    const promisedOutcome =
      attempt === null || trick === null ? null : promisedAttemptOutcome(current, trick, attempt);
    const promisedElapsed =
      attempt === null || trick === null ? 0 : trick.durationSeconds - attempt.remaining;
    const untilDead =
      promisedOutcome !== null && !promisedOutcome.lands
        ? Math.max(promisedOutcome.secondsUntilDeath - promisedElapsed, 0)
        : current.spin / decay;

    // Two boundaries can end this segment and only the nearer one is reached. Whether the Trick
    // gets there first is `attemptOutcome`'s rule to state, not one to restate here.
    const currentOutcome =
      attempt === null || trick === null
        ? null
        : (promisedOutcome ?? attemptOutcome(current, trick, attempt.remaining));
    const landsAt = currentOutcome?.lands ? attempt?.remaining ?? null : null;
    const untilBoundary = landsAt ?? untilDead;
    const reaches = remaining >= untilBoundary;
    const dt = reaches ? untilBoundary : remaining;

    // The integral of k × Spin across the segment: Spin falls linearly over it, so the
    // Style earned is the area under that line, not the rate at either end of it. A landing is a
    // boundary partly for this reason — the multiplier changes there, and a segment straddling it
    // would earn the whole of itself at one rate or the other.
    const earned =
      PROVISIONAL.stylePerSpinPerSecond *
      trickMultiplier(current) *
      (current.spin * dt - (decay * dt * dt) / 2);

    const banked = {
      ...current,
      style: current.style + earned,
      lifetimeStyle: current.lifetimeStyle + earned,
    };

    if (!reaches) {
      current = {
        ...banked,
        spin: current.spin - decay * dt,
        phaseElapsed: current.phaseElapsed + dt,
        attempt: attempt === null ? null : { ...attempt, remaining: attempt.remaining - dt },
      };
    } else if (attempt !== null && landsAt !== null) {
      // Landed, and the Sleeper it was landed on carries on with the Spin it has left. The Trick
      // is a permanent fact from this instant: everything the rest of this Throw earns is already
      // changed by it, and any newly reachable rows may be Attempted straight away.
      const landedTricks = [...current.landedTricks, attempt.trickId];
      const landingTrick = trickById(attempt.trickId);
      const spinPacking = landingSpinPacking(current, landingTrick);
      const outcome =
        currentOutcome ?? attemptOutcome(current, landingTrick, attempt.remaining);
      const styleBonus = outcome.lands ? outcome.styleBonus : 0;
      current = {
        ...banked,
        style: banked.style + styleBonus,
        lifetimeStyle: banked.lifetimeStyle + styleBonus,
        spin:
          promisedOutcome?.lands === true
            ? promisedOutcome.spinOnLanding
            : (current.spin - decay * dt) * spinPacking,
        phaseElapsed: current.phaseElapsed + dt,
        attempt: null,
        landedTricks,
      };
    } else {
      // The Dead Yoyo is the instant Spin reaches zero, not a phase to sit in. An Attempt that
      // brought the yoyo here forfeits the rest of the Throw Cycle and teaches nothing; the Trick
      // is left on the ladder for the next Throw to try again (ADR 0004).
      current = { ...banked, spin: 0, phase: "Rewinding", phaseElapsed: 0, attempt: null };
    }
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
  return ceiling * uptime(state) * trickMultiplier(state);
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
  return PROVISIONAL.stylePerSpinPerSecond * state.spin * trickMultiplier(state);
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
 *
 * An Attempt in progress is part of what is still to come, and it is projected rather than
 * ignored: the Sleeper drains at the Trick's rate until it lands, and everything after it lands
 * is worth the Trick's multiplier more. A projection quoting the undisturbed decay would be
 * wrong in both directions at once — too long a Sleeper and too small a reward — and would be
 * wrong precisely while the player watched the Attempt they had just committed to. A fatal
 * Attempt is projected as the shortened Sleeper it is.
 */
export function projectedYield(state: GameState): number {
  if (state.phase !== "Sleeping") return 0;

  const perSpin = PROVISIONAL.stylePerSpinPerSecond * trickMultiplier(state);
  const decay = decayRate(state);
  const attempt = state.attempt;
  if (attempt === null) return (perSpin * state.spin ** 2) / (2 * decay);

  const trick = trickById(attempt.trickId);
  const drain = attemptDrain(state, trick);
  const promisedOutcome = promisedAttemptOutcome(state, trick, attempt);
  const outcome = promisedOutcome ?? attemptOutcome(state, trick, attempt.remaining);
  if (!outcome.lands) {
    if (promisedOutcome === null) return (perSpin * state.spin ** 2) / (2 * drain);

    const elapsed = trick.durationSeconds - attempt.remaining;
    const untilDeath = Math.max(outcome.secondsUntilDeath - elapsed, 0);
    return perSpin * (state.spin * untilDeath - (drain * untilDeath ** 2) / 2);
  }

  const untilItLands =
    perSpin * (state.spin * attempt.remaining - (drain * attempt.remaining ** 2) / 2);
  const spinPacking = landingSpinPacking(state, trick);
  const afterItLands =
    (perSpin * trick.styleMultiplier * outcome.spinOnLanding ** 2) / (2 * decay * spinPacking);
  return untilItLands + outcome.styleBonus + afterItLands;
}
