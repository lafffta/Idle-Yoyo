import type { GameState } from "../core/simulation.js";
import {
  advance,
  bearingCost,
  buyBearing,
  buyRewindSpeed,
  buyThrowPower,
  decayRate,
  initialState,
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
 * **This player improves their yoyo and never automates.** They buy Gear by horizon-aware greed
 * at every Throw Cycle boundary, and the Auto-Thrower is not yet a candidate, so an Absence still
 * earns them only whatever Sleeper was left on the string. Automation is the next ticket.
 */

/** The three Gear stats, at whatever levels they stand. */
export type GearLevels = {
  readonly throwPower: number;
  readonly bearing: number;
  readonly rewindSpeed: number;
};

/** A Gear stat, named as `CONTEXT.md` names it so the Report reads as the game reads. */
export type GearStat = "Throw Power" | "Bearing" | "Rewind Speed";

/** One thing bought, at the price it cost and the moment the player bought it. */
export type Purchase = {
  readonly stat: GearStat;
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
  readonly sustainedStyleAtClose: number;
  readonly gearAtClose: GearLevels;
  /** Throws the player made by hand. An Auto-Thrower's own Throws are not counted here. */
  readonly manualThrows: number;
  /** What was bought during this Session, in the order it was bought. */
  readonly purchases: readonly Purchase[];
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

  let elapsed = 0;
  // Session time the player has still to play once the current period is over. The other half of
  // the horizon a purchase is valued across; see `playSession`.
  let sessionSecondsToCome = totalSessionSeconds(timeline);

  for (const period of timeline) {
    // Style banked, not Style held: `style` is what the purchases below spend down, and this has
    // to keep meaning "earned" now that they do.
    const earnedBefore = state.lifetimeStyle;

    if (period.kind === "Absence") {
      // No purchase, no manual Throw — the game simply runs forward, exactly as it would with
      // the tab closed. ADR 0002: there is no offline branch to take. The shop is shut because
      // the player is not there, which is also why Absence time is no part of the horizon a
      // purchase is valued across while nothing re-Throws the yoyo.
      state = advance(state, period.seconds);
      absenceSeconds += period.seconds;
      styleEarnedWhileAway += state.lifetimeStyle - earnedBefore;
      elapsed += period.seconds;
      continue;
    }

    sessionSecondsToCome -= period.seconds;
    const played = playSession(state, period.seconds, elapsed, sessionSecondsToCome);
    state = played.state;

    sessions.push({
      session: sessions.length + 1,
      seconds: period.seconds,
      styleEarned: state.lifetimeStyle - earnedBefore,
      precedingAbsenceSeconds: absenceSeconds,
      styleEarnedDuringPrecedingAbsence: styleEarnedWhileAway,
      sustainedStyleAtClose: sustainedStyle(state),
      gearAtClose: gearOf(state),
      manualThrows: played.manualThrows,
      purchases: played.purchases,
    });

    absenceSeconds = 0;
    styleEarnedWhileAway = 0;
    elapsed += period.seconds;
  }

  return {
    sessions,
    finalSustainedStyle: sustainedStyle(state),
    finalGear: gearOf(state),
    gearNeverBought: GEAR.filter((row) => row.level(state) === 0).map((row) => row.stat),
    // Read off the end of the run rather than watched throughout, and that is the same fact:
    // Gear levels only ever go up and a level of Rewind Speed only ever shortens the Rewind, so
    // the Rewind is at its shortest when the timeline runs out. If it ever reached the floor, it
    // is at the floor here.
    rewindReachedFloor: rewindIsAtFloor(state),
  };
}

function totalSessionSeconds(timeline: Timeline): number {
  return timeline.reduce(
    (total, period) => (period.kind === "Session" ? total + period.seconds : total),
    0,
  );
}

/**
 * The player, watching: at every Throw Cycle boundary they shop, then Throw, then wait out the
 * cycle they just paid for.
 *
 * Time moves in jumps from one phase boundary to the next rather than in fixed steps. That is
 * not an optimisation. A polling player would find the yoyo Ready some fraction of a step after
 * it actually was, and would hand that fraction back at the end of every Throw Cycle — a
 * steady, invisible tax on the very pacing the harness exists to measure.
 *
 * `startedAt` and `sessionSecondsToCome` are the player's place in the timeline: where in the run
 * this Session sits, and how much play is still ahead of them once it ends. Both exist so that a
 * purchase can be valued over the time it will actually be collected across, and so the Report
 * can say when each one happened.
 */
function playSession(
  state: GameState,
  seconds: number,
  startedAt: number,
  sessionSecondsToCome: number,
): {
  readonly state: GameState;
  readonly manualThrows: number;
  readonly purchases: readonly Purchase[];
} {
  let current = state;
  let remaining = seconds;
  let manualThrows = 0;
  const purchases: Purchase[] = [];

  // Half-open: the player acts across `[opened, closed)` and not at the closing instant itself,
  // which belongs to whatever comes next. A Throw Cycle boundary landing exactly as a Session
  // ends is therefore not shopped at and not Thrown from — the player has already stopped
  // playing, and one rule governs both rather than the Throw and the purchase disagreeing about
  // when the Session ended. Style they were holding is not lost; they spend it at the first
  // boundary of the Session after next. Nothing in the canonical timeline lands on that instant.
  while (remaining > 0) {
    if (current.phase === "Ready") {
      // A Throw Cycle boundary: the string is wound, nothing is in flight, and the shop is open.
      //
      // The horizon is every second of play still ahead — what is left of this Session plus the
      // Sessions after it — and no more. Absence time is left out because with no Auto-Thrower
      // nothing re-Throws the yoyo while the player is away, so a better yoyo would earn nothing
      // there. Crediting a purchase with rate it will never collect is precisely the mistake
      // that would make the Report plausible and wrong.
      const horizon = remaining + sessionSecondsToCome;
      const boundaryAt = startedAt + seconds - remaining;
      const shopped = shop(current, horizon, boundaryAt);
      current = shopped.state;
      purchases.push(...shopped.purchases);

      current = throwYoyo(current);
      manualThrows += 1;
      continue;
    }

    // Always positive here: a Sleeper is only ever mid-flight with Spin left to lose, and a
    // Rewind only ever mid-wind. The core never leaves the yoyo sitting in a finished phase.
    const step = Math.min(secondsToNextPhase(current), remaining);
    current = advance(current, step);
    remaining -= step;
  }

  return { state: current, manualThrows, purchases };
}

/**
 * Everything the player buys at one Throw Cycle boundary.
 *
 * Buy the best candidate, then ask again, and keep asking until nothing is worth buying. The
 * re-evaluation is the whole policy rather than a refinement of it: a purchase changes what every
 * other purchase is worth, so a single pass down a ranked list would spend the same Style on a
 * worse yoyo. It is also what will let the Gear and the Auto-Thrower price each other in the next
 * ticket without either being special-cased.
 *
 * **At the constants as they stand today the loop never buys twice at one boundary**, and that is
 * a finding rather than dead code. This player buys at the first boundary they can afford
 * anything, so they never bank: what they hold at a boundary is a single Throw Cycle's earnings
 * plus whatever was too small to spend last time, and across the canonical timeline that never
 * covers two prices at once. Rebalancing the cost curves would change that, and so will the
 * Auto-Thrower, whose price is far beyond one cycle and after which every Gear row is worth more.
 *
 * Terminates because every purchase costs Style at a strictly positive price, so the player's
 * balance falls at each turn of the loop while nothing here adds to it.
 */
function shop(
  state: GameState,
  horizonSeconds: number,
  atSeconds: number,
): { readonly state: GameState; readonly purchases: readonly Purchase[] } {
  let current = state;
  const purchases: Purchase[] = [];

  for (;;) {
    const best = bestPurchase(current, horizonSeconds);
    if (best === null) return { state: current, purchases };

    current = best.state;
    purchases.push({ stat: best.stat, price: best.price, atSeconds });
  }
}

/**
 * The candidate worth the most Style per Style spent, or `null` when nothing is.
 *
 * A candidate is worth the Sustained Style it would add, multiplied by the seconds over which
 * that rate is actually collected, divided by what it costs. **The change in Sustained Style is
 * asked of the core rather than worked out here** — the harness applies the game's own purchase
 * transition to a hypothetical state and reads the game's own headline figure back. That is what
 * keeps the Report describing the game that ships: a rebalance, or a change to what a level does,
 * reaches the simulated player without anyone remembering to update them.
 *
 * Buying only on positive value is what stops the player pouring Style into a row that has
 * stopped paying. It bites at the Rewind floor, where a further level of Rewind Speed shortens
 * the Rewind not at all and so adds nothing to Sustained Style — ADR 0003's floor, declined by
 * the same rule that buys everything else rather than by a rule written about it.
 *
 * Ties go to the earlier row, which never happens at the current constants and keeps the Report
 * deterministic if it ever does.
 */
function bestPurchase(
  state: GameState,
  horizonSeconds: number,
): {
  readonly stat: GearStat;
  readonly price: number;
  /** The state the player would be in having bought it — the core's own transition applied. */
  readonly state: GameState;
  readonly value: number;
} | null {
  const now = sustainedStyle(state);
  let best: { stat: GearStat; price: number; state: GameState; value: number } | null = null;

  for (const row of GEAR) {
    const price = row.price(state);
    if (state.style < price) continue;

    const after = row.buy(state);
    const value = ((sustainedStyle(after) - now) * horizonSeconds) / price;
    if (value <= 0) continue;

    if (best === null || value > best.value) best = { stat: row.stat, price, state: after, value };
  }

  return best;
}

/**
 * The shop, as the harness needs to see it: each Gear row's name, its level, its price and the
 * core transition that buys it.
 *
 * One table rather than three, so that a fourth Gear stat is one entry and not a search. Every
 * function in it is the core's own — the harness holds the list, never the arithmetic.
 */
const GEAR: readonly {
  readonly stat: GearStat;
  readonly level: (state: GameState) => number;
  readonly price: (state: GameState) => number;
  readonly buy: (state: GameState) => GameState;
}[] = [
  {
    stat: "Throw Power",
    level: (state) => state.throwPowerLevel,
    price: throwPowerCost,
    buy: buyThrowPower,
  },
  { stat: "Bearing", level: (state) => state.bearingLevel, price: bearingCost, buy: buyBearing },
  {
    stat: "Rewind Speed",
    level: (state) => state.rewindSpeedLevel,
    price: rewindSpeedCost,
    buy: buyRewindSpeed,
  },
];

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
 * harness has to know where the Throw Cycle's boundaries fall, because "Throws whenever the
 * yoyo is Ready" means Throwing at the instant the string finishes winding, and `advance`
 * finds those boundaries without reporting them.
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
