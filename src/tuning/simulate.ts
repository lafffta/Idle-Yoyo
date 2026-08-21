import type { Attempt, GameState, TrickId } from "../core/simulation.js";
import {
  advance,
  attemptableTricks,
  attemptTrick,
  autoThrowerCost,
  bearingCost,
  buyAutoThrower,
  buyBearing,
  buyRewindSpeed,
  buyThrowPower,
  decayRate,
  initialState,
  previewAttempt,
  projectedYield,
  rewindDuration,
  rewindSpeedCost,
  sustainedStyle,
  throwPowerCost,
  throwYoyo,
  trickById,
  TRICKS_1A,
} from "../core/simulation.js";
import type { Period, Timeline } from "./timeline.js";

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
 *
 * **They will also bank Style for something they cannot yet afford**, which ADR 0010 records and
 * defends. A row they are saving for is ranked over what would be left of the run once the saving
 * were done, so waiting costs a purchase exactly the earnings the wait gives up, and a row that
 * could not be reached before the run ends is worth nothing and declines itself.
 *
 * They follow a good rule and not the best one. Buying a level of Throw Power now also shortens
 * the wait for everything after it, and no rule that ranks one purchase at a time can weigh that;
 * the best possible order of purchases is a search, and this is deliberately not one. Read a time
 * in the Report as when this player got there, not as the earliest anyone could.
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
  /** Session time spent banking Style towards a row the player could not yet afford. */
  readonly secondsSpentSaving: number;
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

/**
 * What became of one Trick in the 1A Division — landed or not, and if landed, when.
 *
 * Named and timed rather than merely counted, so a Report can place a Trick against the
 * Auto-Thrower and against `FIRST_SESSION_SECONDS` without a reader having to guess which row a
 * bare count refers to. The record order is authored display order; `atSeconds` carries the
 * actual landing order without pretending the spine and Mount are one linear ladder.
 */
export type TrickRecord =
  | { readonly id: TrickId; readonly name: string; readonly landed: false }
  | {
      readonly id: TrickId;
      readonly name: string;
      readonly landed: true;
      /** Seconds since the run began. */
      readonly atSeconds: number;
      /** Which Session it fell in, counting the first as 1. */
      readonly session: number;
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
  /** The 1A Division in authored display order, and what became of each Trick. */
  readonly tricks: readonly TrickRecord[];
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
  readonly styleAnAutoThrowerWouldHaveEarned: number;
  /** Session time across the whole run in which the player could afford nothing at all. */
  readonly secondsWithNothingAffordable: number;
  /**
   * Session time across the whole run spent holding Style the player chose not to spend, banking
   * towards a row they could not yet afford.
   *
   * Reported apart from `secondsWithNothingAffordable` because the two are opposite findings about
   * the shop, and the figures are never both counting the same second. Nothing affordable is a
   * stretch with no decision in it at all: the shop opens above what the game pays, which is a
   * fault in the prices. Saving is a decision — the player passing over what they can reach for
   * something they judge worth more — and it is the game working as designed. A single figure
   * covering both would report a well-paced run and a badly-priced one identically.
   */
  readonly secondsSpentSaving: number;
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
 * The run still ahead of the player, period by period, the first being the rest of the Session
 * they are sitting in.
 *
 * Kept in its original shape rather than summed into a `Horizon` straight away, because a purchase
 * the player has to save for is not collected over the whole of what is ahead — it is collected
 * over what is left once the saving is done, and only the periods themselves say which Absences
 * that is. Summing first would throw away exactly the detail `afterSaving` needs.
 */
type Ahead = readonly Period[];

/** What a stretch of run adds up to, which is what a purchase is valued across. */
function horizonOf(ahead: Ahead): Horizon {
  let sessionSeconds = 0;
  let absenceSeconds = 0;
  let absences = 0;

  for (const period of ahead) {
    if (period.kind === "Session") {
      sessionSeconds += period.seconds;
    } else {
      absenceSeconds += period.seconds;
      absences += 1;
    }
  }

  return { sessionSeconds, absenceSeconds, absences };
}

/**
 * What is left of the run once the player has spent `seconds` of play banking Style for something.
 *
 * Saving costs Session time and only Session time. A player without a machine earns one last
 * Sleeper when they close the tab and nothing at all thereafter, so an Absence spent saving brings
 * them no closer to affording anything — it passes, and it is gone.
 *
 * **That an Absence passes is the point rather than a detail.** The Auto-Thrower is worth the
 * nights it Throws through, so a machine that takes two nights' worth of saving to reach is worth
 * two fewer nights than one bought today, and the ranking has to see that or it would recommend
 * saving for a machine that arrives after everything it was going to earn in. It is also what
 * stops the player stalling: save for longer than the run has left to give and there is nothing
 * ahead to collect in, so the row is worth nothing and is declined by the same positivity rule
 * that declines Rewind Speed at its floor.
 */
function afterSaving(ahead: Ahead, seconds: number): Ahead {
  let unsaved = seconds;
  const left: Period[] = [];

  for (const period of ahead) {
    if (unsaved <= 0) {
      left.push(period);
      continue;
    }

    if (period.kind === "Absence") continue;

    if (period.seconds <= unsaved) {
      unsaved -= period.seconds;
      continue;
    }

    left.push({ kind: "Session", seconds: period.seconds - unsaved });
    unsaved = 0;
  }

  return left;
}

/**
 * How long the player must play before they can afford `price`, at the rate they are earning now.
 *
 * Sustained Style is what a Throw Cycle repeating pays, which is exactly what the player is about
 * to do while they wait — and it holds still throughout, because saving is precisely the decision
 * to buy nothing. Zero when they can already afford it.
 */
function secondsToAfford(state: GameState, price: number): number {
  if (state.style >= price) return 0;
  return (price - state.style) / sustainedStyle(state);
}

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
  let autoThrowerWhileAway = false;

  const withAutoThrower: AbsenceTotals = { absences: 0, seconds: 0, style: 0 };
  const withoutAutoThrower: AbsenceTotals = { absences: 0, seconds: 0, style: 0 };
  let styleAnAutoThrowerWouldHaveEarned = 0;

  let elapsed = 0;

  let firstAutoThrower: { readonly atSeconds: number; readonly session: number } | null = null;
  let manualThrowsBefore = 0;
  let secondsWithNothingAffordable = 0;
  let secondsSpentSaving = 0;
  // Recorded once per Trick and never overwritten, since a landed Trick cannot be landed twice.
  const landed: Partial<Record<TrickId, { readonly atSeconds: number; readonly session: number }>> =
    {};

  for (const [index, period] of timeline.entries()) {
    // Style banked, not Style held: `style` is what the purchases below spend down, and this has
    // to keep meaning "earned" now that they do.
    const earnedBefore = state.lifetimeStyle;

    if (period.kind === "Absence") {
      // No purchase, no manual Throw — the game simply runs forward, exactly as it would with
      // the tab closed. ADR 0002: there is no offline branch to take. The shop is shut because
      // the player is not there, and whether anything is earned at all comes down to whether
      // they left a machine behind to keep Throwing.
      const throwing = state.hasAutoThrower;
      // Asked before the game runs forward, because nothing is bought while the player is away:
      // the rate they left at is the rate a machine would have held all night.
      if (!throwing) styleAnAutoThrowerWouldHaveEarned += sustainedStyle(state) * period.seconds;

      // Nobody Attempts anything while the player is away — that decision belongs to
      // `playSession` and only runs where someone is there to make it. But an Attempt already
      // committed to when the tab closed goes on running under the same ordinary simulation, so
      // it can still land, or still kill the yoyo, somewhere inside this Absence.
      const landedBefore = state.landedTricks.length;
      state = advance(state, period.seconds);
      const earned = state.lifetimeStyle - earnedBefore;

      // `atSeconds` is the Absence's own opening rather than the instant within it the Trick
      // actually resolved — the harness steps through a Session boundary by boundary but runs an
      // Absence in the one call above, so no finer instant is on hand. Conservative in the same
      // direction the rest of this figure already is: it never claims a Trick landed later than
      // it truly could have.
      for (const id of state.landedTricks.slice(landedBefore)) {
        landed[id] ??= { atSeconds: elapsed, session: sessions.length + 1 };
      }

      const totals = throwing ? withAutoThrower : withoutAutoThrower;
      totals.absences += 1;
      totals.seconds += period.seconds;
      totals.style += earned;

      absenceSeconds += period.seconds;
      styleEarnedWhileAway += earned;
      autoThrowerWhileAway = throwing;
      elapsed += period.seconds;
      continue;
    }

    const played = playSession(state, period.seconds, elapsed, timeline.slice(index + 1));
    state = played.state;

    const session = sessions.length + 1;
    // Until the machine takes over, every Throw in the Session was made by hand; in the Session
    // it takes over in, only the ones before the moment it did.
    if (firstAutoThrower === null) {
      const bought = played.boughtAutoThrower;
      firstAutoThrower = bought === null ? null : { atSeconds: bought.atSeconds, session };
      manualThrowsBefore += bought?.manualThrowsBefore ?? played.manualThrows;
    }

    for (const landing of played.trickLandings) {
      landed[landing.id] ??= { atSeconds: landing.atSeconds, session };
    }

    sessions.push({
      session,
      seconds: period.seconds,
      styleEarned: state.lifetimeStyle - earnedBefore,
      precedingAbsenceSeconds: absenceSeconds,
      styleEarnedDuringPrecedingAbsence: styleEarnedWhileAway,
      autoThrowerDuringPrecedingAbsence: autoThrowerWhileAway,
      sustainedStyleAtClose: sustainedStyle(state),
      gearAtClose: gearOf(state),
      manualThrows: played.manualThrows,
      purchases: played.purchases,
      secondsWithNothingAffordable: played.secondsWithNothingAffordable,
      secondsSpentSaving: played.secondsSpentSaving,
    });

    secondsWithNothingAffordable += played.secondsWithNothingAffordable;
    secondsSpentSaving += played.secondsSpentSaving;
    absenceSeconds = 0;
    styleEarnedWhileAway = 0;
    autoThrowerWhileAway = false;
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
    tricks: TRICKS_1A.map((trick) => {
      const record = landed[trick.id];
      return record === undefined
        ? { id: trick.id, name: trick.name, landed: false }
        : { id: trick.id, name: trick.name, landed: true, ...record };
    }),
    autoThrower:
      firstAutoThrower === null
        ? { bought: false, manualThrows: manualThrowsBefore, price: autoThrowerCost() }
        : {
            bought: true,
            atSeconds: firstAutoThrower.atSeconds,
            session: firstAutoThrower.session,
            inFirstSession: firstAutoThrower.session === 1,
            manualThrowsBefore,
            price: autoThrowerCost(),
          },
    absencesWithAutoThrower: earningsOf(withAutoThrower),
    absencesWithoutAutoThrower: earningsOf(withoutAutoThrower),
    styleAnAutoThrowerWouldHaveEarned,
    secondsWithNothingAffordable,
    secondsSpentSaving,
  };
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
  ahead: Ahead,
): {
  readonly state: GameState;
  readonly manualThrows: number;
  readonly purchases: readonly Purchase[];
  readonly secondsWithNothingAffordable: number;
  readonly secondsSpentSaving: number;
  /** Set if the player bought their first Auto-Thrower during this Session. */
  readonly boughtAutoThrower: {
    readonly atSeconds: number;
    readonly manualThrowsBefore: number;
  } | null;
  /** Every Trick landed during this Session, in the order it happened. */
  readonly trickLandings: readonly { readonly id: TrickId; readonly atSeconds: number }[];
} {
  let current = maybeAttempt(state);
  let remaining = seconds;
  let manualThrows = 0;
  let secondsWithNothingAffordable = 0;
  let secondsSpentSaving = 0;
  const purchases: Purchase[] = [];
  let boughtAutoThrower: { atSeconds: number; manualThrowsBefore: number } | null = null;
  const trickLandings: { readonly id: TrickId; readonly atSeconds: number }[] = [];

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
  // Whether the player left the shop holding Style they chose not to spend, banking towards
  // something dearer. The opposite finding to `affordsNothing` and never true alongside it: one
  // is a shop with nothing on the shelves the player can reach, the other a player reaching past
  // what is on them. Merged into a single figure they would report a game pacing well and a game
  // pricing its opening out of reach identically.
  //
  // Unlike `affordsNothing` it starts false rather than being read from the state, so a Session
  // resumed part-way through a Throw Cycle does not count that cycle as saving. The decision it
  // records was taken at a boundary in the Session before, and a player who has closed the game
  // and come back is not obviously still keeping to it. At most one cycle a Session, and only
  // where a Session ends mid-flight.
  let saving = false;

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
      // Everything still ahead of the player: what is left of this Session, then the run as the
      // timeline has it. What a given purchase actually collects across is a narrower question,
      // asked by `secondsGearIsCollectedOver` and by `afterSaving` for a row worth waiting for.
      const shopped = shop(current, [{ kind: "Session", seconds: remaining }, ...ahead], boundaryAt);
      // Banking, rather than merely poor. A player who has just spent everything is also left
      // wanting something they cannot afford, and counting that would make this figure mean
      // "time not buying" — which is most of any run, and tells a designer nothing. What is
      // being counted is a decision: a row they could have bought, passed over for a better one.
      saving = shopped.saving && canAffordSomething(shopped.state);

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

      // The instant the string wound and a fresh Sleeper began — with an Auto-Thrower the Throw
      // above never ran, because `advance` already made it itself, but the decision is the same
      // decision at the same moment either way.
      current = maybeAttempt(current);

      atCycleTop = false;
    }

    // Always positive: a Sleeper is only ever mid-flight with Spin left to lose, and a Rewind
    // only ever mid-wind. The core never leaves the yoyo sitting in a finished phase, and the
    // one phase with no time in it at all — `Ready` — has just been Thrown out of above.
    const untilNextPhase = secondsToNextPhase(current);
    const finishes = remaining >= untilNextPhase;
    const step = finishes ? untilNextPhase : remaining;
    const winding = current.phase === "Rewinding";
    const landedBefore = current.landedTricks.length;

    current = advance(current, step);
    remaining -= step;
    if (affordsNothing) secondsWithNothingAffordable += step;
    if (saving) secondsSpentSaving += step;

    // A Trick landing is a boundary within the same Sleeper, not a Throw Cycle boundary — the
    // string is still wound, so `atCycleTop` stays false and the loop would otherwise carry on
    // decaying a fresh, attempt-free Sleeper without ever asking whether the next Trick in the
    // chain is worth taking.
    for (const id of current.landedTricks.slice(landedBefore)) {
      trickLandings.push({ id, atSeconds: startedAt + seconds - remaining });
    }
    // A no-op unless a Trick just landed with Spin — and so a chance to chain — left on the
    // string: `maybeAttempt` itself declines everywhere else there is nothing new to decide.
    current = maybeAttempt(current);

    // A wound string is the top of the next cycle, whether the yoyo is now waiting in the hand
    // or already back down on a fresh Sleeper.
    atCycleTop = winding && finishes;
  }

  return {
    state: current,
    manualThrows,
    purchases,
    secondsWithNothingAffordable,
    secondsSpentSaving,
    boughtAutoThrower,
    trickLandings,
  };
}

/**
 * Everything the player buys at one Throw Cycle boundary.
 *
 * Buy the best candidate, then ask again, and keep asking until nothing is worth buying — or until
 * the best of what is left is something the player would rather save for, which ends the visit
 * just as firmly. The re-evaluation is the whole policy rather than a refinement of it: a purchase
 * changes what every other purchase is worth, so a single pass down a ranked list would spend the
 * same Style on a worse yoyo. It is also where the Gear and the Auto-Thrower come to price each
 * other without either being special-cased — better Gear raises Sustained Style, which is exactly
 * what an Auto-Thrower would be collecting overnight, and owning one puts every night ahead into
 * the span the next piece of Gear is valued over.
 *
 * Terminates because every purchase costs Style at a strictly positive price, so the player's
 * balance falls at each turn of the loop while nothing here adds to it — and a loop that stops
 * buying stops outright, since the row it is saving for only gets dearer to reach as the Style in
 * hand stays put.
 */
function shop(
  state: GameState,
  ahead: Ahead,
  atSeconds: number,
): {
  readonly state: GameState;
  readonly purchases: readonly Purchase[];
  /** Whether the player left the shop still wanting a row they will have to bank Style for. */
  readonly saving: boolean;
} {
  let current = state;
  const purchases: Purchase[] = [];

  for (;;) {
    const best = bestPurchase(current, ahead);
    if (best === null) return { state: current, purchases, saving: false };
    if (best.saveFor > 0) return { state: current, purchases, saving: true };

    current = best.row.buy(current);
    purchases.push({ item: best.row.item, price: best.price, atSeconds });
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
 * **A row the player cannot yet afford is ranked all the same, valued over what would be left of
 * the run once they had saved for it.** A wait costs a purchase the Style it would have earned
 * during that wait, so the discount is the honest price of banking rather than a penalty invented
 * to discourage it, and a row that cannot be reached before the run ends is valued over nothing at
 * all and declines itself. ADR 0010 has the whole of why the player is allowed to wait; the short
 * version is that a player who must spend everything at every boundary can never hold a large
 * price, and reports the largest price in the game unreachable however cheap it is made.
 *
 * Buying only on positive worth is what stops the player pouring Style into a row that has
 * stopped paying. It bites in three places: at the Rewind floor, where a further level of Rewind
 * Speed shortens the Rewind not at all, on an Auto-Thrower with no Absence left ahead of it to
 * earn in, and on anything priced beyond what the rest of the run could bank for it. All three
 * are declined by the rule that buys everything else rather than by a rule written about them.
 *
 * Ties go to the earlier row, which never happens at the current constants and keeps the Report
 * deterministic if it ever does.
 */
function bestPurchase(
  state: GameState,
  ahead: Ahead,
): {
  readonly row: ShopRow;
  readonly price: number;
  /** Seconds of play the player must bank before they can afford it. Zero if they already can. */
  readonly saveFor: number;
  readonly value: number;
} | null {
  let best: { row: ShopRow; price: number; saveFor: number; value: number } | null = null;

  for (const row of SHOP) {
    if (!row.onSale(state)) continue;

    const price = row.price(state);
    const saveFor = secondsToAfford(state, price);

    const value = row.worth(state, horizonOf(afterSaving(ahead, saveFor))) / price;
    if (value <= 0) continue;

    if (best === null || value > best.value) {
      best = { row, price, saveFor, value };
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
 *
 * **The wallet is invented, and inventing it is the question** — the same trick `rewindIsAtFloor`
 * plays, for the same reason. The core refuses a purchase the player cannot afford and returns the
 * state untouched, so asking what a row would be worth out of an empty pocket answers that it
 * would be worth nothing whatever it does. That is the wrong answer to "what is this worth?" and
 * the right one to "may I have it?", and now that the player ranks rows they are saving up for,
 * only the first question is being asked here.
 *
 * **Sustained Style is credited with the next Trick's landed effect the moment this purchase would
 * put it in reach**, through `sustainedStyleCreditingNextTrick` rather than `sustainedStyle`
 * itself. Both Throw Power and the Bearing improve Attempt safety (the plan asks for both to),
 * and without this a level that finally clears a Trick's threshold would be valued no differently
 * to one that leaves it exactly out of reach — the earning-rate rise `sustainedStyle` already
 * prices is real, but it is not the whole of what the purchase buys.
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
    worth: (state, horizon) => {
      const affordable = { ...state, style: price(state) };
      return (
        (sustainedStyleCreditingNextTrick(buy(affordable)) -
          sustainedStyleCreditingNextTrick(affordable)) *
        secondsGearIsCollectedOver(state, horizon)
      );
    },
  };
}

/**
 * Sustained Style, credited with the policy's next Trick effect the instant a fresh Throw at the
 * Gear this state owns would land it.
 *
 * The engaged player Attempts that Trick the moment it is safe (`maybeAttempt` asks the same
 * `wouldLandFresh` question of the Sleeper they are actually holding), so a Gear purchase that
 * clears the threshold is worth crediting with the landing it is about to cause. The current
 * policy takes the first authored Attemptable choice, spine before Mount; #85 replaces that
 * placeholder with a player model that partitions Spin across simultaneous choices.
 */
function sustainedStyleCreditingNextTrick(state: GameState): number {
  const [trick] = attemptableTricks(freshThrow(state));
  if (trick === undefined || !wouldLandFresh(state, trick.id)) return sustainedStyle(state);
  return sustainedStyle({ ...state, landedTricks: [...state.landedTricks, trick.id] });
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
 * **It is load-bearing, and the whole opening of the run rests on it.** Checked against an
 * `autoThrowerCost` of 250 and the saving player of ADR 0010. Deleting the condition moves the
 * machine to 7m 48s rather than 13m 20s, after 37 Throws by hand rather than 100, and opens the run
 * with seven levels of Throw Power instead of nothing at all; the purchase order, the final Gear
 * and Sustained Style all move with it. Four tests fail with it gone, `pacing.test.ts`'s Sustained
 * Style guard among them. What survives unchanged is only what is coarse enough not to notice —
 * the machine still lands inside the first Session, every Gear row is still bought, the Rewind
 * still reaches its floor.
 *
 * **What made it bite was the player, not the price** — worth stating plainly, because the obvious
 * suspect is the wrong one and #34 was raised expecting the other answer. Two things changed
 * between the check that found it inert and this one: ADR 0010 taught the player to bank Style, and
 * #29 halved the machine. Re-running the comparison at the old price of 500 against the saving
 * player separates them, and the price is not the culprit: at 500 the condition already decides
 * everything, moving the machine from 26m 40s of play to 11m 31s and from the second Session into
 * the first. That is the same question #29 asked about its own finding, with the same answer.
 *
 * It also means this condition is what #29 acted on. Without it the harness would have reported a
 * 500-Style machine landing comfortably inside the first Session, ADR 0002's promise would have
 * looked kept, and no retune would have been called for.
 *
 * The argument that once said it could not matter is kept here, because knowing where it broke is
 * what says when to check again. It ran: every Gear row is valued over the same span, so widening
 * it multiplies them all alike and cannot reorder them, and the one ranking it could move — Gear
 * against the Auto-Thrower — is settled by the machine winning by a factor of tens whenever it is
 * affordable at all. *Whenever it is affordable* is the clause that failed, and a player who could
 * not save was what kept it true: such a player only ever meets the machine at a boundary where
 * they can already pay for it. Let them bank, and the ranking that decides the opening becomes Gear
 * against a machine being saved for — where widening the span multiplies Gear while leaving the
 * machine's own worth, already Absence-only, exactly where it was. Ten Style of Throw Power then
 * outscores it per Style spent and the hoard never starts.
 *
 * Which makes this the reason the shop goes untouched before the machine, and not a fact about the
 * price: the machine is the best buy from the opening boundary under the honest model, and under
 * the dishonest one it is not.
 *
 * It stays because it is the honest model, which is the only reason it ever needed.
 *
 * **It is still not guarded, and the obvious guard would be worse than none.** Those four failures
 * are incidental — none of the four was written with this in mind, so any of them could be
 * rewritten for unrelated reasons and take the notice with it. The tempting fix is a
 * `pacing.test.ts` claim that the shop goes untouched before the machine: it is player-describable,
 * it stays the right side of the seam, and it would fail the moment this condition went. It is
 * refused because that shape of opening is an open finding rather than a decision — a stretch with
 * the shop untouched is a thing we may well want to fix — and a guard asserting it would fail on
 * the deliberate improvement, which is exactly the guard `pacing.test.ts` warns turns everyone into
 * a deleter of guards. Asserting a finding freezes it.
 *
 * So the honest position is that the safety net is still a sentence, now a sentence that has been
 * wrong once. What would make it cheap to notice is a second Report to diff against, which is a
 * bigger thing than this function and belongs to whoever wants it.
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
 * never rests Ready at all. #21 has since closed that route off outright: `Ready` holds
 * `phaseElapsed` at zero, so there is no longer any record of how long the yoyo waited.
 *
 * What it does not do is copy the constants: the decay rate and the Rewind duration are asked
 * for, not recomputed, so a rebalance still reaches the harness. And the duplication is
 * guarded rather than merely noted — if these boundaries drift from the core's, the yoyo is
 * left idle in the hand for part of every Throw Cycle, and `earns exactly Sustained Style when
 * it closes on a Throw Cycle boundary` fails.
 */
function secondsToNextPhase(state: GameState): number {
  if (state.phase === "Ready") return 0;
  if (state.phase === "Sleeping") {
    return state.attempt === null
      ? state.spin / decayRate(state)
      : attemptBoundarySeconds(state, state.attempt);
  }
  return Math.max(rewindDuration(state) - state.phaseElapsed, 0);
}

/**
 * How long until an active Attempt resolves — landing or a Dead Yoyo — reimplementing the core's
 * own `attemptOutcome` from its exported pieces, for the same reason `secondsToNextPhase` already
 * duplicates the core's other phase-boundary arithmetic: #22 asks that the harness drive the core
 * through its existing public transitions and derived readouts rather than through a widened
 * surface built for a development tool. `decayRate` and `trick.spinDrainMultiplier` are the same
 * two figures the core multiplies together; if either moves, this moves with it.
 */
function attemptBoundarySeconds(state: GameState, attempt: Attempt): number {
  const trick = trickById(attempt.trickId);
  const drain = decayRate(state) * trick.spinDrainMultiplier;
  const spinOnLanding = state.spin - drain * attempt.remaining;
  return spinOnLanding > 0 ? attempt.remaining : state.spin / drain;
}

/**
 * What the engaged player does with a Sleeper that is free to Attempt something: take the first
 * authored choice the instant it is safe, sacrifice the Sleeper on a fatal Attempt anyway when a
 * fresh Throw would land it and this one will not, or leave it alone. This spine-before-Mount
 * choice is intentionally temporary; #85 replaces it with explicit Spin partitioning.
 *
 * Called wherever a live Sleeper has nothing already committed — the instant a Throw begins one,
 * and again the instant an earlier Trick in the same Sleeper lands and frees it for another — so
 * a chain is the same decision asked twice rather than a second policy layered over the first.
 *
 * A safe Attempt is never declined: it costs nothing but the Sleeper's tail, which keeps earning
 * at the Trick's own (higher) drain throughout, and it buys a multiplier that is permanent from
 * the instant it lands. There is no version of "wait" that beats taking it.
 */
function maybeAttempt(state: GameState): GameState {
  if (state.phase !== "Sleeping" || state.attempt !== null) return state;

  const [trick] = attemptableTricks(state);
  if (trick === undefined) return state;

  const preview = previewAttempt(state, trick.id);
  if (preview === null) return state;
  if (preview.outcome.lands) return attemptTrick(state, trick.id);

  return wouldLandFresh(state, trick.id) ? attemptTrick(state, trick.id) : state;
}

/**
 * Whether a Throw made right now, at the Gear currently owned, would land the next Trick.
 *
 * This is what a fatal Attempt is weighed against: Gear bought mid-Sleeper cannot rescue the
 * Attempt already committed (ADR 0013), because the Sleeper is still decaying at the rate its own
 * Throw captured — but it can make the very next Throw safe, and sacrificing the Sleeper in hand
 * is only worth anything if reaching that Throw sooner actually lands somewhere. A Sleeper that
 * has already spent some of its Spin — chaining onto a second Trick, say — can fail here purely
 * for want of the headroom a fresh one starts with, which a fresh Throw does not lack.
 */
function freshThrow(state: GameState): GameState {
  return throwYoyo({ ...state, phase: "Ready" });
}

function wouldLandFresh(state: GameState, trickId: TrickId): boolean {
  const preview = previewAttempt(freshThrow(state), trickId);
  return preview !== null && preview.outcome.lands;
}

function gearOf(state: GameState): GearLevels {
  return {
    throwPower: state.throwPowerLevel,
    bearing: state.bearingLevel,
    rewindSpeed: state.rewindSpeedLevel,
  };
}
