import type { GameState } from "../core/simulation.js";
import {
  advance,
  decayRate,
  initialState,
  rewindDuration,
  sustainedStyle,
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
 * It reimplements none of the game's arithmetic. Every number below comes out of the core,
 * through the same public transitions and derived readouts a shell would use. Where the harness
 * and the game disagree, the game wins.
 *
 * **This player buys nothing.** They earn and never spend, which is the one configuration the
 * core's closed forms pin down completely — so the instrument can be checked by hand before any
 * purchase policy is built on top of it. The policy is the next ticket.
 */

/** The three Gear stats, at whatever levels they stand. */
export type GearLevels = {
  readonly throwPower: number;
  readonly bearing: number;
  readonly rewindSpeed: number;
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
};

export type Report = {
  readonly sessions: readonly SessionRecord[];
  readonly finalSustainedStyle: number;
  readonly finalGear: GearLevels;
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

  for (const period of timeline) {
    // Style banked, not Style held: `style` is what a later ticket's purchases will spend down,
    // and this has to keep meaning "earned" once they do.
    const earnedBefore = state.lifetimeStyle;

    if (period.kind === "Absence") {
      // No purchase, no manual Throw — the game simply runs forward, exactly as it would with
      // the tab closed. ADR 0002: there is no offline branch to take.
      state = advance(state, period.seconds);
      absenceSeconds += period.seconds;
      styleEarnedWhileAway += state.lifetimeStyle - earnedBefore;
      continue;
    }

    const played = playSession(state, period.seconds);
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
    });

    absenceSeconds = 0;
    styleEarnedWhileAway = 0;
  }

  return {
    sessions,
    finalSustainedStyle: sustainedStyle(state),
    finalGear: gearOf(state),
  };
}

/**
 * The player, watching: they Throw the yoyo whenever it is Ready, and otherwise wait.
 *
 * Time moves in jumps from one phase boundary to the next rather than in fixed steps. That is
 * not an optimisation. A polling player would find the yoyo Ready some fraction of a step after
 * it actually was, and would hand that fraction back at the end of every Throw Cycle — a
 * steady, invisible tax on the very pacing the harness exists to measure.
 */
function playSession(
  state: GameState,
  seconds: number,
): { readonly state: GameState; readonly manualThrows: number } {
  let current = state;
  let remaining = seconds;
  let manualThrows = 0;

  while (remaining > 0) {
    if (current.phase === "Ready") {
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

  return { state: current, manualThrows };
}

/**
 * How long until the yoyo next changes phase.
 *
 * The one question the harness asks about the core's state that the core does not already
 * answer for itself, and it asks with the core's own exported readouts — the same two derived
 * numbers `advance` reaches for, never a copy of the constants behind them. Landing exactly on
 * the boundary is what lets a Session that divides into whole Throw Cycles earn precisely
 * Sustained Style, which is the check the tests make against the core's closed forms.
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
