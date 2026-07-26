import { describe, expect, it } from "vitest";

import { simulate } from "./simulate.js";
import type { Timeline } from "./timeline.js";
import { CANONICAL_TIMELINE } from "./timeline.js";

/**
 * Every figure asserted here was worked out by hand from the core's closed forms before the
 * harness existed, which is the point of doing the no-purchase run first (#22). At the current
 * provisional constants a Throw Cycle is a 5s Sleeper and a 3s Rewind, it earns
 * `k·S₀²/2D = 2.5` Style, and Sustained Style is `2.5/8 = 0.3125`.
 *
 * They are exact rather than directional because a player who buys nothing is the one
 * configuration whose numbers the core pins down completely. The coarse, rebalance-proof
 * assertions the spec asks for belong with the purchase policy, which is what a rebalance
 * actually moves.
 */

const STYLE_PER_THROW_CYCLE = 2.5;
const SUSTAINED_STYLE_AT_OPENING = 0.3125;

const session = (seconds: number): Timeline[number] => ({ kind: "Session", seconds });
const absence = (seconds: number): Timeline[number] => ({ kind: "Absence", seconds });

describe("a Session", () => {
  it("Throws once per Throw Cycle for as long as it lasts", () => {
    // 1200s of Throw Cycles 8s long, the first Throw landing at the moment the Session opens.
    const report = simulate([session(1200)]);

    expect(report.sessions[0]?.manualThrows).toBe(150);
  });

  it("earns exactly Sustained Style when it closes on a Throw Cycle boundary", () => {
    const report = simulate([session(1200)]);

    expect(report.sessions[0]?.styleEarned).toBeCloseTo(SUSTAINED_STYLE_AT_OPENING * 1200, 10);
  });

  it("earns better than Sustained Style when it closes part-way through a Sleeper", () => {
    // 900s is 112 whole Throw Cycles and then 4s of a 113th Sleeper. Those 4s are the front of
    // the Sleeper, where Spin and so the rate are highest, and none of the Rewind that would
    // have paid for them has been served yet — so the Session closes ahead of the average.
    const report = simulate([session(900)]);

    const wholeCycles = 112 * STYLE_PER_THROW_CYCLE;
    const openingOfTheSleeper = 2.4;

    expect(report.sessions[0]?.manualThrows).toBe(113);
    expect(report.sessions[0]?.styleEarned).toBeCloseTo(wholeCycles + openingOfTheSleeper, 10);
    expect(report.sessions[0]?.styleEarned).toBeGreaterThan(SUSTAINED_STYLE_AT_OPENING * 900);
  });

  it("leaves Sustained Style where it started, because the player buys nothing", () => {
    const report = simulate([session(1200), absence(28_800), session(900)]);

    for (const record of report.sessions) {
      expect(record.sustainedStyleAtClose).toBeCloseTo(SUSTAINED_STYLE_AT_OPENING, 10);
      expect(record.gearAtClose).toEqual({ throwPower: 0, bearing: 0, rewindSpeed: 0 });
    }
  });
});

describe("an Absence", () => {
  it("earns nothing at all when the yoyo was left waiting in the hand", () => {
    // The 20 minute Session divides exactly into Throw Cycles, so it closes with the string
    // wound and the yoyo Ready. With no Auto-Thrower nobody Throws it for eight hours.
    const report = simulate([session(1200), absence(28_800), session(60)]);

    expect(report.sessions[1]?.styleEarnedDuringPrecedingAbsence).toBe(0);
    expect(report.sessions[1]?.precedingAbsenceSeconds).toBe(28_800);
  });

  it("earns only what is left of the Sleeper still on the string", () => {
    // The 15 minute Session closes 4s into a Sleeper, so 20 Spin is still turning: one more
    // second of it, worth `k·Spin²/2D = 0.1` Style, and then four hours of nothing.
    const report = simulate([session(900), absence(14_400), session(60)]);

    expect(report.sessions[1]?.styleEarnedDuringPrecedingAbsence).toBeCloseTo(0.1, 10);
  });

  it("is reported against the Session that follows it, and never against the first", () => {
    const report = simulate([session(1200), absence(28_800), session(900)]);

    expect(report.sessions[0]?.precedingAbsenceSeconds).toBe(0);
    expect(report.sessions[0]?.styleEarnedDuringPrecedingAbsence).toBe(0);
    expect(report.sessions[1]?.precedingAbsenceSeconds).toBe(28_800);
  });
});

describe("the Report for the canonical timeline", () => {
  it("carries one record per Session, in the order they were played", () => {
    const report = simulate(CANONICAL_TIMELINE);

    expect(report.sessions.map((record) => record.session)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(report.sessions.map((record) => record.seconds)).toEqual([
      1200, 900, 900, 900, 900, 900,
    ]);
  });

  it("has the player Throw the yoyo by hand nearly seven hundred times across three days", () => {
    // 150 Throws in the opening Session and 113 in each of the five that follow. This is the
    // stretch ADR 0002 says teaches the core model, and the number worth looking at when
    // judging whether it teaches or merely tires.
    const report = simulate(CANONICAL_TIMELINE);

    const byHand = report.sessions.reduce((total, record) => total + record.manualThrows, 0);

    expect(byHand).toBe(150 + 5 * 113);
  });

  it("earns almost nothing while the player is away, because nothing re-Throws the yoyo", () => {
    const report = simulate(CANONICAL_TIMELINE);

    const whilePresent = report.sessions.reduce((total, record) => total + record.styleEarned, 0);
    const whileAway = report.sessions.reduce(
      (total, record) => total + record.styleEarnedDuringPrecedingAbsence,
      0,
    );

    // 375 in the opening Session and 282.4 in each of the five that follow, against 0.1 for
    // each of the four Absences that caught a Sleeper mid-flight and nothing for the first.
    expect(whilePresent).toBeCloseTo(375 + 5 * 282.4, 8);
    expect(whileAway).toBeCloseTo(0.4, 10);
  });

  it("closes on the Gear and the Sustained Style the player started with", () => {
    const report = simulate(CANONICAL_TIMELINE);

    expect(report.finalGear).toEqual({ throwPower: 0, bearing: 0, rewindSpeed: 0 });
    expect(report.finalSustainedStyle).toBeCloseTo(SUSTAINED_STYLE_AT_OPENING, 10);
  });

  it("is identical every time the same timeline is run", () => {
    expect(simulate(CANONICAL_TIMELINE)).toEqual(simulate(CANONICAL_TIMELINE));
  });
});
