import type { GameState } from "../core/simulation.js";
import {
  advance,
  autoThrowerCost,
  bearingCost,
  buyAutoThrower,
  buyBearing,
  buyRewindSpeed,
  buyThrowPower,
  decayRate,
  initialState,
  projectedYield,
  rewindDuration,
  rewindSpeedCost,
  sustainedStyle,
  throwPowerCost,
  throwYoyo,
} from "../core/simulation.js";
import type { Timeline } from "./timeline.js";

/**
 * The tuning harness: a scripted player driven through the real simulation core, reporting how
 * the opening of the game actually paces.
 *
 * It lives outside `src/core` on purpose. ADR 0008 asks that the core move to a native client
 * unchanged, and a development instrument is not part of what ships; keeping it out also leaves
 * the core's purity guard defending a small, stable surface. It is excluded from the built
 * output in `tsconfig.build.json`, which is the other half of the same decision.
 *
 * ADR 0009 stands: the harness reads whatever `constants.ts` currently says and makes no attempt
 * to vary it. A Report is a statement about the game as it is configured today.
 *
 * It reimplements none of the game's earning arithmetic. Every figure in a Report comes out of
 * the core, through the same public transitions and derived readouts a shell would use, and
 * where the harness and the game disagree the game wins. `secondsToNextPhase` is the one place
 * that claim needs qualifying, and it says so itself.
 *
 * **This player improves their yoyo, and buys a machine to Throw it when that is the better
 * buy.** At every Throw Cycle boundary they rank everything on sale by the Style it earns them
 * over the play they have left, per Style it costs, and buy the best of it while anything is
 * worth buying. The Auto-Thrower sits in that ranking as one more row: they are free to decline
 * it forever, and a refusal is a finding rather than a failure.
 */

/** The three Gear stats, at whatever levels they stand. */
export type GearLevels = {
  readonly throwPower: number;
  readonly bearing: number;
  readonly rewindSpeed: number;
};

/** A Gear stat, named as `CONTEXT.md` names it so the Report reads as the game reads. */
export type GearStat = "Throw Power" | "Bearing" | "Rewind Speed";

/** Everything the shop sells: three rows of Gear, and the one piece of Kit that exists. */
export type Purchasable = GearStat | "Auto-Thrower";

/** One thing bought, at the price it cost and the moment the player bought it. */
export type Purchase = {
  readonly item: Purchasable;
  readonly price: number;
  /** Seconds since the start of the timeline, so that a purchase can be placed in the run. */
  readonly atSeconds: number;
};

/** What happened across one Session, and across the Absence that led into it. */
export type SessionRecord = {
  /** Which Session this is, counting the first as 1. */
  readonly session: number;
  readonly seconds: number;
  /** Style earned during the Session itself. */
  readonly styleEarned: number;
  /** How long the player was away immediately beforehand. Zero before the first Session. */
  readonly precedingAbsenceSeconds: number;
  /** Style earned during that Absence — the size of what an Auto-Thrower would be buying. */
  readonly styleEarnedDuringPrecedingAbsence: number;
  /** Whether a machine was Throwing through that Absence, or the yoyo lay where it fell. */
  readonly autoThrowerDuringPrecedingAbsence: boolean;
  readonly sustainedStyleAtClose: number;
  readonly gearAtClose: GearLevels;
  /** Throws the player made by hand. An Auto-Thrower's own Throws are not counted here. */
  readonly manualThrows: number;
  /** What was bought during this Session, in the order it was bought. */
  readonly purchases: readonly Purchase[];
  /**
   * Session time with nothing in the shop the player could afford — a dead stretch, in which
   * there was no decision for them to make and nothing to do but watch.
   */
  readonly secondsWithNothingAffordable: number;
};

/**
 * What became of the Auto-Thrower — the question ADR 0002 calls retention-critical, as figures a
 * designer can read.
 *
 * A refusal is a shape of its own rather than a purchase with its fields blanked out. If the
 * price exceeds what the nights ahead are worth, declining is the right answer, and an
 * instrument that could not say so plainly would be no use for judging the price.
 */
export type AutoThrower =
  | {
      readonly bought: false;
      /** Every Throw in the run, since the player made all of them themselves. */
      readonly manualThrows: number;
      /** What it cost, restated so a Report can be read without the constants beside it. */
      readonly price: number;
    }
  | {
      readonly bought: true;
      /** Seconds since the run began. */
      readonly atSeconds: number;
      /** Which Session it fell in, counting the first as 1. */
      readonly session: number;
      /**
       * ADR 0002's promise: that the player sees the game become idle before they first put it
       * down. It restates `session === 1` because that promise is the thing being judged, and a
       * Report should not make its reader do the comparison.
       */
      readonly inFirstSession: boolean;
      /** Throws the player made by hand before the machine took over. */
      readonly manualThrowsBefore: number;
      readonly price: number;
    };

/** A stretch of Absences and what they were worth, before the per-hour figure is worked out. */
type AbsenceTotals = { absences: number; seconds: number; style: number };

/**
 * What Absences earned, gathered by whether a machine was Throwing through them.
 *
 * The Auto-Thrower moves Sustained Style not at all — `hasAutoThrower` appears nowhere in it —
 * so the headline figure the whole shop is read through cannot show what one is worth. ADR 0007
 * makes every other purchase legible that way and this purchase silently. These figures are what
 * quantify the difference, and the reason they are reported side by side rather than buried among
 * the Sessions.
 */
export type AbsenceEarnings = AbsenceTotals & {
  /**
   * Style per hour away — the comparable figure, since the two groups differ in length.
   *
   * Read it beside `seconds`. A minute-long Absence holding a whole Sleeper extrapolates to a
   * fine-looking hourly rate it could never sustain, and the total is what says so.
   */
  readonly stylePerHour: number;
};

export type Report = {
  readonly sessions: readonly SessionRecord[];
  readonly finalSustainedStyle: number;
  readonly finalGear: GearLevels;
  /**
   * Gear stats the player never bought once across the whole timeline — a dead shop row, and
   * the thing ADR 0003 is built to prevent for the Bearing.
   */
  readonly gearNeverBought: readonly GearStat[];
  /**
   * Whether Rewind Speed was bought far enough that the Rewind stopped getting shorter.
   *
   * ADR 0003 puts a floor under the Rewind because at a Rewind of zero the decay rate cancels
   * out of sustained earnings and the Bearing stops working altogether. Whether a player can
   * actually reach that floor in three days decides whether the floor is load-bearing in
   * practice or only in principle, and nobody has known which.
   */
  readonly rewindReachedFloor: boolean;
  readonly autoThrower: AutoThrower;
  readonly absencesWithAutoThrower: AbsenceEarnings;
  readonly absencesWithoutAutoThrower: AbsenceEarnings;
  /**
   * What the Absences the player spent with no machine would have earned had they owned one.
   *
   * The counterfactual, and the figure that makes a refusal readable. On a run where the player
   * declines the Auto-Thrower there are no Absences with a machine to compare against, so
   * without this the most valuable result the instrument can produce would print as a blank —
   * a designer judging the price would be told nothing at all.
   */
  readonly styleAMachineWouldHaveEarned: number;
  /** Session time across the whole run in which the player could afford nothing at all. */
  readonly secondsWithNothingAffordable: number;
};

/**
 * The play still ahead of the player at the moment they are deciding — what a purchase is valued
 * over, and the reason the same purchase is worth different amounts at different times.
 *
 * Sessions and Absences are held apart rather than summed because a purchase does not
 * necessarily collect across both. Without an Auto-Thrower nothing re-Throws the yoyo while the
 * player is away, so better Gear earns nothing there; with one it earns throughout.
 */
type Horizon = {
  /** Seconds of Session still to come, including the rest of the one being played. */
  readonly sessionSeconds: number;
  readonly absenceSeconds: number;
  /** How many separate Absences those seconds fall into. */
  readonly absences: number;
};

/**
 * Run the scripted player through `timeline` and report what happened.
 *
 * Pure and deterministic: no clock, no I/O, and the same timeline returns the same Report every
 * time. Printing it is a separate script's job, so that tests can assert on the Report itself
 * rather than on captured output.
 */
export function simulate(timeline: Timeline): Report {
  let state = initialState();
  const sessions: SessionRecord[] = [];

  // Carried forward rather than looked up, because an Absence is only interesting next to the
  // Session it precedes: it is the stretch the player was away *before* sitting down again.
  // Accumulated, so that two Absences in a row read as the one gap they are.
  let absenceSeconds = 0;
  let styleEarnedWhileAway = 0;
  let machineWhileAway = false;

  const withAutoThrower: AbsenceTotals = { absences: 0, seconds: 0, style: 0 };
  const withoutAutoThrower: AbsenceTotals = { absences: 0, seconds: 0, style: 0 };
  let styleAMachineWouldHaveEarned = 0;

  let elapsed = 0;
  // What is still to come once the current period is over — the other half of the horizon a
  // purchase is valued across; see `playSession`.
  let sessionSecondsToCome = secondsOf(timeline, "Session");
  let absenceSecondsToCome = secondsOf(timeline, "Absence");
  let absencesToCome = timeline.filter((period) => period.kind === "Absence").length;

  let machine: { readonly atSeconds: number; readonly session: number } | null = null;
  let manualThrowsBefore = 0;
  let secondsWithNothingAffordable = 0;

  for (const period of timeline) {
    // Style banked, not Style held: `style` is what the purchases below spend down, and this has
    // to keep meaning "earned" now that they do.
    const earnedBefore = state.lifetimeStyle;

    if (period.kind === "Absence") {
      absenceSecondsToCome -= period.seconds;
      absencesToCome -= 1;

      // No purchase, no manual Throw — the game simply runs forward, exactly as it would with
      // the tab closed. ADR 0002: there is no offline branch to take. The shop is shut because
      // the player is not there, and whether anything is earned at all comes down to whether
      // they left a machine behind to keep Throwing.
      const throwing = state.hasAutoThrower;
      // Asked before the game runs forward, because nothing is bought while the player is away:
      // the rate they left at is the rate a machine would have held all night.
      if (!throwing) styleAMachineWouldHaveEarned += sustainedStyle(state) * period.seconds;

      state = advance(state, period.seconds);
      const earned = state.lifetimeStyle - earnedBefore;

      const totals = throwing ? withAutoThrower : withoutAutoThrower;
      totals.absences += 1;
      totals.seconds += period.seconds;
      totals.style += earned;

      absenceSeconds += period.seconds;
      styleEarnedWhileAway += earned;
      machineWhileAway = throwing;
      elapsed += period.seconds;
      continue;
    }

    sessionSecondsToCome -= period.seconds;
    const played = playSession(state, period.seconds, elapsed, {
      sessionSeconds: sessionSecondsToCome,
      absenceSeconds: absenceSecondsToCome,
      absences: absencesToCome,
    });
    state = played.state;

    const session = sessions.length + 1;
    // Until the machine takes over, every Throw in the Session was made by hand; in the Session
    // it takes over in, only the ones before the moment it did.
    if (machine === null) {
      const bought = played.boughtAutoThrower;
      machine = bought === null ? null : { atSeconds: bought.atSeconds, session };
      manualThrowsBefore += bought?.manualThrowsBefore ?? played.manualThrows;
    }

    sessions.push({
      session,
      seconds: period.seconds,
      styleEarned: state.lifetimeStyle - earnedBefore,
      precedingAbsenceSeconds: absenceSeconds,
      styleEarnedDuringPrecedingAbsence: styleEarnedWhileAway,
      autoThrowerDuringPrecedingAbsence: machineWhileAway,
      sustainedStyleAtClose: sustainedStyle(state),
      gearAtClose: gearOf(state),
      manualThrows: played.manualThrows,
      purchases: played.purchases,
      secondsWithNothingAffordable: played.secondsWithNothingAffordable,
    });

    secondsWithNothingAffordable += played.secondsWithNothingAffordable;
    absenceSeconds = 0;
    styleEarnedWhileAway = 0;
    machineWhileAway = false;
    elapsed += period.seconds;
  }

  return {
    sessions,
    finalSustainedStyle: sustainedStyle(state),
    finalGear: gearOf(state),
    gearNeverBought: GEAR.filter((row) => row.level(state) === 0).map((row) => row.item),
    // Read off the end of the run rather than watched throughout, and that is the same fact:
    // Gear levels only ever go up and a level of Rewind Speed only ever shortens the Rewind, so
    // the Rewind is at its shortest when the timeline runs out. If it ever reached the floor, it
    // is at the floor here.
    rewindReachedFloor: rewindIsAtFloor(state),
    autoThrower:
      machine === null
        ? { bought: false, manualThrows: manualThrowsBefore, price: autoThrowerCost() }
        : {
            bought: true,
            atSeconds: machine.atSeconds,
            session: machine.session,
            inFirstSession: machine.session === 1,
            manualThrowsBefore,
            price: autoThrowerCost(),
          },
    absencesWithAutoThrower: earningsOf(withAutoThrower),
    absencesWithoutAutoThrower: earningsOf(withoutAutoThrower),
    styleAMachineWouldHaveEarned,
    secondsWithNothingAffordable,
  };
}

function secondsOf(timeline: Timeline, kind: "Session" | "Absence"): number {
  return timeline.reduce(
    (total, period) => (period.kind === kind ? total + period.seconds : total),
    0,
  );
}

function earningsOf(totals: AbsenceTotals): AbsenceEarnings {
  return {
    ...totals,
    stylePerHour: totals.seconds > 0 ? (totals.style * 3600) / totals.seconds : 0,
  };
}

/**
 * The player, watching: at the top of every Throw Cycle they shop, Throw if the yoyo is still
 * theirs to Throw, and wait out the cycle they just paid for.
 *
 * Time moves in jumps from one phase boundary to the next rather than in fixed steps. That is
 * not an optimisation. A polling player would find the yoyo Ready some fraction of a step after
 * it actually was, and would hand that fraction back at the end of every Throw Cycle — a
 * steady, invisible tax on the very pacing the harness exists to measure.
 *
 * `startedAt` and `ahead` are the player's place in the timeline: where in the run this Session
 * sits, and what is still to come once it ends. Both exist so that a purchase can be valued over
 * the time it will actually be collected across, and so the Report can say when each one
 * happened.
 */
function playSession(
  state: GameState,
  seconds: number,
  startedAt: number,
  ahead: Horizon,
): {
  readonly state: GameState;
  readonly manualThrows: number;
  readonly purchases: readonly Purchase[];
  readonly secondsWithNothingAffordable: number;
  /** Set if the player bought their first Auto-Thrower during this Session. */
  readonly boughtAutoThrower: {
    readonly atSeconds: number;
    readonly manualThrowsBefore: number;
  } | null;
} {
  let current = state;
  let remaining = seconds;
  let manualThrows = 0;
  let secondsWithNothingAffordable = 0;
  const purchases: Purchase[] = [];
  let boughtAutoThrower: { atSeconds: number; manualThrowsBefore: number } | null = null;

  // Whether the player is standing at the top of a Throw Cycle: the string wound, nothing in
  // flight, and the shop open. Without an Auto-Thrower that is the yoyo sitting `Ready` in the
  // hand. With one there is no such instant to observe — `advance` re-Throws the moment the
  // string finishes winding — so the top of the cycle is the first instant of the fresh Sleeper
  // instead. The same moment in the game either way; only the phase it is visible in changes,
  // and a machine's Throw landing before its owner can shop is what really happens to a player
  // who owns one.
  let atCycleTop = current.phase === "Ready";
  // Whether the player came to the shop with nothing they could buy, which makes the Throw
  // Cycle that follows a dead one: they have already looked, and there is nothing to do but
  // watch until the next boundary.
  //
  // Read on arriving rather than on leaving, because leaving the shop broke is what buying
  // something *is*. A player who spends everything at every boundary has a decision at every
  // boundary, and reading the wallet on the way out would report their busiest run as an empty
  // one. Set here too, for a Session resumed part-way through a cycle the player cannot act in.
  let affordsNothing = !canAffordSomething(current);

  // Half-open: the player acts across `[opened, closed)` and not at the closing instant itself,
  // which belongs to whatever comes next. A Throw Cycle boundary landing exactly as a Session
  // ends is therefore not shopped at and not Thrown from — the player has already stopped
  // playing, and one rule governs both rather than the Throw and the purchase disagreeing about
  // when the Session ended. Style they were holding is not lost; they spend it at the first
  // boundary of the Session after next. Nothing in the canonical timeline lands on that instant.
  while (remaining > 0) {
    if (atCycleTop) {
      affordsNothing = !canAffordSomething(current);

      const boundaryAt = startedAt + seconds - remaining;
      // The horizon is every second still ahead of the player: what is left of this Session,
      // the Sessions after it, and the Absences between them. What a given purchase actually
      // collects across is a narrower question, and `secondsGearIsCollectedOver` asks it.
      const horizon = { ...ahead, sessionSeconds: remaining + ahead.sessionSeconds };
      const shopped = shop(current, horizon, boundaryAt);

      if (!current.hasAutoThrower && shopped.state.hasAutoThrower) {
        boughtAutoThrower = { atSeconds: boundaryAt, manualThrowsBefore: manualThrows };
      }

      current = shopped.state;
      purchases.push(...shopped.purchases);

      if (current.phase === "Ready") {
        // Whose Throw this is depends on whether the player owns a machine to make it. Buying
        // one while the yoyo rests in the hand hands over the very next Throw: `advance` would
        // have made it itself had the purchase come a moment earlier.
        if (!current.hasAutoThrower) manualThrows += 1;
        current = throwYoyo(current);
      }

      atCycleTop = false;
    }

    // Always positive: a Sleeper is only ever mid-flight with Spin left to lose, and a Rewind
    // only ever mid-wind. The core never leaves the yoyo sitting in a finished phase, and the
    // one phase with no time in it at all — `Ready` — has just been Thrown out of above.
    const untilNextPhase = secondsToNextPhase(current);
    const finishes = remaining >= untilNextPhase;
    const step = finishes ? untilNextPhase : remaining;
    const winding = current.phase === "Rewinding";

    current = advance(current, step);
    remaining -= step;
    if (affordsNothing) secondsWithNothingAffordable += step;
    // A wound string is the top of the next cycle, whether the yoyo is now waiting in the hand
    // or already back down on a fresh Sleeper.
    atCycleTop = winding && finishes;
  }

  return {
    state: current,
    manualThrows,
    purchases,
    secondsWithNothingAffordable,
    boughtAutoThrower,
  };
}

/**
 * Everything the player buys at one Throw Cycle boundary.
 *
 * Buy the best candidate, then ask again, and keep asking until nothing is worth buying. The
 * re-evaluation is the whole policy rather than a refinement of it: a purchase changes what every
 * other purchase is worth, so a single pass down a ranked list would spend the same Style on a
 * worse yoyo. It is also where the Gear and the Auto-Thrower come to price each other without
 * either being special-cased — better Gear raises Sustained Style, which is exactly what an
 * Auto-Thrower would be collecting overnight, and owning one puts every night ahead into the span
 * the next piece of Gear is valued over.
 *
 * Terminates because every purchase costs Style at a strictly positive price, so the player's
 * balance falls at each turn of the loop while nothing here adds to it.
 */
function shop(
  state: GameState,
  horizon: Horizon,
  atSeconds: number,
): { readonly state: GameState; readonly purchases: readonly Purchase[] } {
  let current = state;
  const purchases: Purchase[] = [];

  for (;;) {
    const best = bestPurchase(current, horizon);
    if (best === null) return { state: current, purchases };

    current = best.state;
    purchases.push({ item: best.item, price: best.price, atSeconds });
  }
}

/**
 * The candidate worth the most Style per Style spent, or `null` when nothing is.
 *
 * Every row is valued the same way — the Style it earns the player over what is left of the run,
 * divided by what it costs — so Gear and the Auto-Thrower are ranked against each other by one
 * rule rather than by a rule each. A row whose worth falls short of its own price scores below
 * one Style per Style spent, which is how a mispriced Auto-Thrower loses to Gear without anything
 * being written about the Auto-Thrower in particular.
 *
 * Buying only on positive worth is what stops the player pouring Style into a row that has
 * stopped paying. It bites in two places: at the Rewind floor, where a further level of Rewind
 * Speed shortens the Rewind not at all, and on an Auto-Thrower with no Absence left ahead of it
 * to earn in. Both are declined by the rule that buys everything else rather than by a rule
 * written about them.
 *
 * Ties go to the earlier row, which never happens at the current constants and keeps the Report
 * deterministic if it ever does.
 */
function bestPurchase(
  state: GameState,
  horizon: Horizon,
): {
  readonly item: Purchasable;
  readonly price: number;
  /** The state the player would be in having bought it — the core's own transition applied. */
  readonly state: GameState;
  readonly value: number;
} | null {
  let best: { item: Purchasable; price: number; state: GameState; value: number } | null = null;

  for (const row of SHOP) {
    if (!row.onSale(state)) continue;

    const price = row.price(state);
    if (state.style < price) continue;

    const value = row.worth(state, horizon) / price;
    if (value <= 0) continue;

    if (best === null || value > best.value) {
      best = { item: row.item, price, state: row.buy(state), value };
    }
  }

  return best;
}

/** Whether the player could buy anything at all, however poor a buy it would be. */
function canAffordSomething(state: GameState): boolean {
  return SHOP.some((row) => row.onSale(state) && state.style >= row.price(state));
}

/**
 * One row of the shop, as the harness needs to see it.
 *
 * `worth` is the Style the row earns its owner over the rest of the run; `bestPurchase` divides
 * by the price. Gear and Kit differ only in what they earn and over what, which is the whole of
 * the difference between them as far as a buying decision goes — so they are one type, ranked in
 * one pass, with nothing written about either in particular.
 */
type ShopRow = {
  readonly item: Purchasable;
  readonly price: (state: GameState) => number;
  readonly buy: (state: GameState) => GameState;
  /** Whether the shop still sells it — Gear always, the Auto-Thrower until one is owned. */
  readonly onSale: (state: GameState) => boolean;
  readonly worth: (state: GameState, horizon: Horizon) => number;
};

/** A Gear row also has a level, which the Report reads to name the rows never bought. */
type GearRow = ShopRow & { readonly item: GearStat; readonly level: (state: GameState) => number };

/**
 * A Gear row, which differs from the next only in which stat it moves.
 *
 * **The rise in Sustained Style is asked of the core rather than worked out here** — the harness
 * applies the game's own purchase transition to a hypothetical state and reads the game's own
 * headline figure back. That is what keeps the Report describing the game that ships: a
 * rebalance, or a change to what a level does, reaches the simulated player without anyone
 * remembering to update them.
 */
function gearRow(
  item: GearStat,
  level: (state: GameState) => number,
  price: (state: GameState) => number,
  buy: (state: GameState) => GameState,
): GearRow {
  return {
    item,
    level,
    price,
    buy,
    onSale: () => true,
    worth: (state, horizon) =>
      (sustainedStyle(buy(state)) - sustainedStyle(state)) *
      secondsGearIsCollectedOver(state, horizon),
  };
}

/**
 * The three Gear rows. One table rather than three variables, so that a fourth Gear stat is one
 * entry and not a search. Every function in it is the core's own — the harness holds the list,
 * never the arithmetic.
 */
const GEAR: readonly GearRow[] = [
  gearRow("Throw Power", (state) => state.throwPowerLevel, throwPowerCost, buyThrowPower),
  gearRow("Bearing", (state) => state.bearingLevel, bearingCost, buyBearing),
  gearRow("Rewind Speed", (state) => state.rewindSpeedLevel, rewindSpeedCost, buyRewindSpeed),
];

/** The one piece of Kit that exists, sold alongside the Gear and ranked against it. */
const AUTO_THROWER: ShopRow = {
  item: "Auto-Thrower",
  price: autoThrowerCost,
  buy: buyAutoThrower,
  onSale: (state) => !state.hasAutoThrower,
  // What the nights ahead would earn with a machine Throwing through them, less the little they
  // earn without one. Sustained Style is what a Throw Cycle repeating indefinitely pays, which is
  // precisely what an Auto-Thrower turns an Absence into; the subtraction is what stops the
  // player being charged twice for Style they would have had anyway.
  worth: (state, horizon) =>
    sustainedStyle(state) * horizon.absenceSeconds -
    styleAnUnattendedAbsenceEarns(state) * horizon.absences,
};

/** Everything on sale, as one list the player ranks in one pass. */
const SHOP: readonly ShopRow[] = [...GEAR, AUTO_THROWER];

/**
 * The span a piece of Gear's improved rate is actually collected over.
 *
 * Session time always, and Absence time only once an Auto-Thrower is owned: before that, nothing
 * re-Throws the yoyo while the player is away, so crediting Gear with rate it will never collect
 * would make the Report plausible and wrong.
 *
 * **It changes no decision at the constants as they stand, and no test guards it, which is worth
 * saying rather than leaving to be rediscovered.** Every Gear row is valued over the same span,
 * so widening it multiplies them all alike and cannot reorder them; the only ranking it could
 * move is Gear against the Auto-Thrower, and whenever the Auto-Thrower is affordable at all it
 * wins by a factor of tens. Deleting the condition here leaves every figure in every Report
 * unchanged — that was checked, not assumed.
 *
 * It stays because it is the honest model rather than because it currently bites, and it will
 * bite as soon as the prices move or a second piece of Kit exists. A test for it would have to
 * reach past the seam into a value nothing reports, which is the kind of test CLAUDE.md asks us
 * not to write.
 */
function secondsGearIsCollectedOver(state: GameState, horizon: Horizon): number {
  return horizon.sessionSeconds + (state.hasAutoThrower ? horizon.absenceSeconds : 0);
}

/**
 * The Style an Absence earns with no machine to Throw: whatever is left of the Sleeper on the
 * string, and nothing at all after it dies.
 *
 * Valued at a whole Sleeper, which is the most it could ever be — the player is standing at the
 * top of a Throw Cycle when they ask, so the Throw they are about to make is the one that would
 * be left spinning. Closing the tab any later leaves less. Erring high here makes the
 * Auto-Thrower's worth an under-estimate, which is the safe direction for a purchase whose price
 * is the thing under examination.
 *
 * The figure is the core's own projection of that Throw rather than the same arithmetic written
 * out again, and ADR 0001's linear decay is what makes it exact rather than an estimate.
 *
 * The wound string is the only thing invented, and inventing it is what makes the question
 * askable from anywhere: a Throw is legal only from `Ready`, and asking a mid-Sleeper yoyo what
 * a Throw would be worth would otherwise quietly answer nothing at all.
 */
function styleAnUnattendedAbsenceEarns(state: GameState): number {
  return projectedYield(throwYoyo({ ...state, phase: "Ready" }));
}

/**
 * Whether the Rewind has stopped getting shorter — asked exactly as the player's own policy asks
 * it, by handing the core the price of another level of Rewind Speed and seeing whether Sustained
 * Style moves at all.
 *
 * The wallet is the only thing invented, and inventing it is the question: *if* they could afford
 * one, would it buy them anything? At the floor it would not, and that is the same zero that
 * makes `bestPurchase` decline the row — so the fact the Report states and the rule the player
 * follows are one question asked once, rather than two descriptions of the floor that could drift
 * apart. Reading the levels and working the Rewind out here would be the second description.
 */
function rewindIsAtFloor(state: GameState): boolean {
  const affordable = { ...state, style: rewindSpeedCost(state) };
  return sustainedStyle(buyRewindSpeed(affordable)) === sustainedStyle(affordable);
}

/**
 * How long until the yoyo next changes phase.
 *
 * **A known duplication, recorded here rather than quietly taken.** These are `advance`'s own
 * two boundary expressions — its `untilDead` and its `untilWound` — written a second time. The
 * harness has to know where the Throw Cycle's boundaries fall, because the player shops at
 * those boundaries and `advance` finds them without reporting them.
 *
 * Both ways of avoiding it are worse. Exporting a boundary readout from the core would widen
 * the core's surface for a development tool, which #22 rules out in as many words — it asks
 * that the harness drive the core "through its existing public transitions and derived
 * readouts". Inferring the boundary instead, by advancing the whole remaining stretch and
 * reading back how long the yoyo then sat Ready, depends on `advance`'s Ready branch absorbing
 * the rest of a delta into `phaseElapsed` — a deeper coupling to the core's internals than two
 * formulas, and one that stops working entirely once an Auto-Thrower is owned and the yoyo
 * never rests Ready at all.
 *
 * What it does not do is copy the constants: the decay rate and the Rewind duration are asked
 * for, not recomputed, so a rebalance still reaches the harness. And the duplication is
 * guarded rather than merely noted — if these boundaries drift from the core's, the yoyo is
 * left idle in the hand for part of every Throw Cycle, and `earns exactly Sustained Style when
 * it closes on a Throw Cycle boundary` fails.
 */
function secondsToNextPhase(state: GameState): number {
  if (state.phase === "Ready") return 0;
  if (state.phase === "Sleeping") return state.spin / decayRate(state);
  return Math.max(rewindDuration(state) - state.phaseElapsed, 0);
}

function gearOf(state: GameState): GearLevels {
  return {
    throwPower: state.throwPowerLevel,
    bearing: state.bearingLevel,
    rewindSpeed: state.rewindSpeedLevel,
  };
}
