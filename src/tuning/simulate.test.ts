import { describe, expect, it } from "vitest";

import { simulate } from "./simulate.js";
import type { Timeline } from "./timeline.js";
import { CANONICAL_TIMELINE } from "./timeline.js";

/**
 * Every figure asserted here was worked out by hand from the core's closed forms, which is what
 * makes these tests capable of disagreeing with the harness. At the current provisional constants
 * a Throw Cycle is a 5s Sleeper and a 3s Rewind, it earns `k·S₀²/2D = 2.5` Style, and Sustained
 * Style is `2.5/8 = 0.3125`.
 *
 * The exact figures live on short timelines. The cheapest thing in the shop is a level of Throw
 * Power at 10 Style, so a player has four Throw Cycles — 32 seconds — before there is any
 * decision to make, and inside that window the core pins every number down completely. Once the
 * shop opens the arithmetic compounds through purchases, and the claims worth asserting are
 * mostly directional: ADR 0005 expects these constants to be rewritten, and a test naming a
 * figure only this configuration produces would fail on every deliberate rebalance.
 *
 * `buys the row worth the most Style per Style spent` is the deliberate exception, and #23 asks
 * for it in as many words — a greedy policy over a horizon fails by producing a plausible number
 * rather than by crashing, so one run of it is worked through by hand in full. It will need
 * rewriting when the constants are, and that is the price of having checked.
 */

const STYLE_PER_THROW_CYCLE = 2.5;
const SUSTAINED_STYLE_AT_OPENING = 0.3125;

/** What the first level of each Gear stat costs, straight from the provisional constants. */
const FIRST_THROW_POWER_PRICE = 10;

const session = (seconds: number): Timeline[number] => ({ kind: "Session", seconds });
const absence = (seconds: number): Timeline[number] => ({ kind: "Absence", seconds });

/** When each Session in a timeline opened and closed, in seconds since the run began. */
function sessionWindows(timeline: Timeline): { opened: number; closed: number }[] {
  const windows: { opened: number; closed: number }[] = [];
  let at = 0;

  for (const period of timeline) {
    if (period.kind === "Session") windows.push({ opened: at, closed: at + period.seconds });
    at += period.seconds;
  }

  return windows;
}

describe("a Session before anything is affordable", () => {
  it("Throws once per Throw Cycle for as long as it lasts", () => {
    // 24s of Throw Cycles 8s long, the first Throw landing at the moment the Session opens.
    const report = simulate([session(24)]);

    expect(report.sessions[0]?.manualThrows).toBe(3);
  });

  it("earns exactly Sustained Style when it closes on a Throw Cycle boundary", () => {
    const report = simulate([session(24)]);

    expect(report.sessions[0]?.styleEarned).toBeCloseTo(SUSTAINED_STYLE_AT_OPENING * 24, 10);
  });

  it("earns better than Sustained Style when it closes part-way through a Sleeper", () => {
    // 20s is two whole Throw Cycles and then 4s of a third Sleeper. Those 4s are the front of
    // the Sleeper, where Spin and so the rate are highest, and none of the Rewind that would
    // have paid for them has been served yet — so the Session closes ahead of the average.
    const report = simulate([session(20)]);

    const wholeCycles = 2 * STYLE_PER_THROW_CYCLE;
    const openingOfTheSleeper = 2.4;

    expect(report.sessions[0]?.manualThrows).toBe(3);
    expect(report.sessions[0]?.styleEarned).toBeCloseTo(wholeCycles + openingOfTheSleeper, 10);
    expect(report.sessions[0]?.styleEarned).toBeGreaterThan(SUSTAINED_STYLE_AT_OPENING * 20);
  });

  it("leaves Sustained Style and the Gear exactly where they started", () => {
    // 7.5 Style banked by the close of the first Session and 10 by the close of the second —
    // and the second reaches that figure as it ends, with no boundary left to spend it at.
    const report = simulate([session(24), absence(28_800), session(8)]);

    for (const record of report.sessions) {
      expect(record.purchases).toEqual([]);
      expect(record.sustainedStyleAtClose).toBeCloseTo(SUSTAINED_STYLE_AT_OPENING, 10);
      expect(record.gearAtClose).toEqual({ throwPower: 0, bearing: 0, rewindSpeed: 0 });
    }
  });
});

describe("a player at the shop", () => {
  it("buys at the first Throw Cycle boundary it can afford anything", () => {
    // Four Throw Cycles earn 4 × 2.5 = 10 Style, which is exactly the price of the first level
    // of Throw Power — the cheapest row in the shop, and at 32s the only affordable one, since
    // Rewind Speed opens at 15 Style and the Bearing at 25.
    const report = simulate([session(40)]);

    expect(report.sessions[0]?.purchases).toEqual([
      { stat: "Throw Power", price: FIRST_THROW_POWER_PRICE, atSeconds: 32 },
    ]);
  });

  it("Throws harder from the moment it buys Throw Power", () => {
    // A level of Throw Power puts `S₀` at 120 Spin, so the Sleeper runs 6s rather than 5 and the
    // Throw Cycle 9s rather than 8. Sustained Style becomes `(k·S₀/2)·S₀/(S₀+R·D)`, or
    // `0.6 × 2/3 = 0.4`, and the Sleeper that follows the purchase yields `k·S₀²/2D = 3.6`.
    const report = simulate([session(40)]);

    expect(report.sessions[0]?.gearAtClose).toEqual({ throwPower: 1, bearing: 0, rewindSpeed: 0 });
    expect(report.sessions[0]?.sustainedStyleAtClose).toBeCloseTo(0.4, 10);
    // Ten Style from the four opening cycles and 3.6 from the harder Throw. The Session then
    // ends 2s into a Rewind, which earns nothing.
    expect(report.sessions[0]?.styleEarned).toBeCloseTo(10 + 3.6, 10);
    expect(report.sessions[0]?.manualThrows).toBe(5);
  });

  it("has stopped playing by the instant a Session closes, so a boundary there is not shopped at", () => {
    // 32s is exactly four Throw Cycles, so the Session ends at the very boundary the purchase
    // above was made at — and the player, who has closed the tab, neither buys nor Throws.
    const report = simulate([session(32)]);

    expect(report.sessions[0]?.purchases).toEqual([]);
    expect(report.finalGear).toEqual({ throwPower: 0, bearing: 0, rewindSpeed: 0 });
  });

  it("carries Style it could not spend through to the next Session it plays", () => {
    // The same closing boundary, but with an hour away and another quarter of an hour of play
    // after it. The 10 Style is still there when the player sits back down, and buys the same
    // level of Throw Power at the first boundary of the Session that follows — deferred by the
    // Absence, not forfeited to it.
    const report = simulate([session(32), absence(3_600), session(900)]);

    expect(report.sessions[0]?.purchases).toEqual([]);
    expect(report.sessions[1]?.purchases[0]).toEqual({
      stat: "Throw Power",
      price: FIRST_THROW_POWER_PRICE,
      atSeconds: 3_632,
    });
  });

  it("names the rows it never went near", () => {
    // Forty seconds is one purchase deep. Rewind Speed and the Bearing were never affordable.
    const report = simulate([session(40)]);

    expect([...report.gearNeverBought].sort()).toEqual(["Bearing", "Rewind Speed"]);
  });

  it("buys the row worth the most Style per Style spent, not the cheapest one on the shelf", () => {
    // **The hand-check the ticket asks for.** Every line below was worked out from the core's
    // closed forms before this test was run, and the two lines that matter are the last two.
    //
    // A Throw Cycle is `S₀/D + R` long and yields `k·S₀²/2D`, and a level of Throw Power adds
    // 20 to `S₀`, so the cycle lengthens from 8s to 9, 10, 11, 12, 13, 14, 15 as the player
    // buys — and each level costs 1.15 times the last. Working the boundaries through gives
    // seven straight levels of Throw Power, because nothing else is ever affordable at the
    // moment the player can afford anything at all.
    //
    // At 213s that breaks. The player holds 16.03 Style, an eighth level of Throw Power is
    // 26.60 and the Bearing 25 — both out of reach — and the only thing they can buy is the
    // first level of Rewind Speed at 15. So they buy it, poor value or not: declining would
    // bank Style against nothing.
    //
    // At 242.4s the player holds 29.83 and can afford both the eighth level of Throw Power at
    // 26.60 and a second of Rewind Speed at 17.70. Throw Power adds 0.0968 to Sustained Style
    // for its 26.60 and Rewind Speed 0.0183 for its 17.70 — 0.00364 per Style against 0.00104
    // — so the dearer row wins, and this is the moment that would go wrong if the harness
    // ranked by price or valued a candidate against the wrong span.
    const report = simulate([session(250)]);

    // Prices are the geometric ladders the shop is priced on — 10 × 1.15ⁿ for Throw Power, 15 ×
    // 1.18ⁿ for Rewind Speed — written out rather than recomputed, so that a change to either
    // ladder shows up here as a disagreement.
    const opening = [
      { stat: "Throw Power", price: 10, atSeconds: 32 },
      { stat: "Throw Power", price: 11.5, atSeconds: 68 },
      { stat: "Throw Power", price: 13.225, atSeconds: 98 },
      { stat: "Throw Power", price: 15.20875, atSeconds: 120 },
      { stat: "Throw Power", price: 17.4900625, atSeconds: 144 },
      { stat: "Throw Power", price: 20.113572, atSeconds: 170 },
      { stat: "Throw Power", price: 23.130608, atSeconds: 198 },
      { stat: "Rewind Speed", price: 15, atSeconds: 213 },
      { stat: "Throw Power", price: 26.600199, atSeconds: 242.4 },
    ];

    const purchases = report.sessions[0]?.purchases ?? [];

    expect(purchases).toHaveLength(opening.length);
    opening.forEach((expected, index) => {
      expect(purchases[index]?.stat).toBe(expected.stat);
      expect(purchases[index]?.price).toBeCloseTo(expected.price, 6);
      expect(purchases[index]?.atSeconds).toBeCloseTo(expected.atSeconds, 6);
    });
  });

  it("stops buying Rewind Speed once the Rewind can get no shorter", () => {
    // A day at the yoyo is long enough to buy Rewind Speed all the way down to ADR 0003's
    // floor. Past it a level buys nothing at all — the Rewind is already as short as it will
    // ever be — so its value is zero rather than merely poor, and the player declines it under
    // the same rule that buys everything else. They carry on shopping regardless: the two rows
    // that still pay are bought dozens more times.
    const report = simulate([session(86_400)]);

    const stats = report.sessions.flatMap((record) => record.purchases).map((buy) => buy.stat);
    const afterTheLastRewindSpeed = stats.length - 1 - stats.lastIndexOf("Rewind Speed");

    expect(report.rewindReachedFloor).toBe(true);
    expect(afterTheLastRewindSpeed).toBeGreaterThan(10);
  });
});

describe("an Absence", () => {
  it("earns nothing at all when the yoyo was left waiting in the hand", () => {
    // 24s divides exactly into Throw Cycles, so the Session closes with the string wound and
    // the yoyo Ready. With no Auto-Thrower nobody Throws it for eight hours.
    const report = simulate([session(24), absence(28_800), session(8)]);

    expect(report.sessions[1]?.styleEarnedDuringPrecedingAbsence).toBe(0);
    expect(report.sessions[1]?.precedingAbsenceSeconds).toBe(28_800);
  });

  it("earns only what is left of the Sleeper still on the string", () => {
    // The Session closes 4s into a Sleeper, so 20 Spin is still turning: one more second of it,
    // worth `k·Spin²/2D = 0.1` Style, and then four hours of nothing.
    const report = simulate([session(20), absence(14_400), session(8)]);

    expect(report.sessions[1]?.styleEarnedDuringPrecedingAbsence).toBeCloseTo(0.1, 10);
  });

  it("is reported against the Session that follows it, and never against the first", () => {
    const report = simulate([session(24), absence(28_800), session(8)]);

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

  it("has the player Throw the yoyo by hand far less often as the yoyo gets better", () => {
    // A level of Throw Power lengthens the Sleeper as well as enriching it, so the same
    // quarter of an hour holds fewer and fewer Throws. This is the stretch ADR 0002 says
    // teaches the core model, and the number worth looking at when judging whether it teaches
    // or merely tires.
    const report = simulate(CANONICAL_TIMELINE);

    const first = report.sessions.at(0)?.manualThrows ?? 0;
    const last = report.sessions.at(-1)?.manualThrows ?? 0;

    expect(last).toBeLessThan(first);
  });

  it("earns less across a whole Absence than in the Session that follows it", () => {
    // Nothing re-Throws the yoyo while the player is away, so an Absence earns only whatever
    // Sleeper was left on the string — worth more and more as the Bearing keeps the yoyo alive
    // longer, but never a night's worth of anything. This is the gap an Auto-Thrower closes.
    const report = simulate(CANONICAL_TIMELINE);

    for (const record of report.sessions) {
      expect(record.styleEarnedDuringPrecedingAbsence).toBeLessThan(record.styleEarned);
    }
  });

  it("shops only while the player is there, never while they are away", () => {
    // The shop is shut for three overnights and two afternoons, which between them are most of
    // the run. Every purchase should fall inside the Session it is reported against.
    const report = simulate(CANONICAL_TIMELINE);

    const windows = sessionWindows(CANONICAL_TIMELINE);
    expect(windows).toHaveLength(report.sessions.length);

    windows.forEach((window, index) => {
      for (const purchase of report.sessions[index]?.purchases ?? []) {
        expect(purchase.atSeconds).toBeGreaterThanOrEqual(window.opened);
        expect(purchase.atSeconds).toBeLessThan(window.closed);
      }
    });
  });

  it("closes on a yoyo far better than the one the player started with", () => {
    // Whether every shop row stayed worth buying is the dead-row guard, and belongs to #25.
    const report = simulate(CANONICAL_TIMELINE);

    expect(report.finalSustainedStyle).toBeGreaterThan(SUSTAINED_STYLE_AT_OPENING);
  });

  it("is identical every time the same timeline is run", () => {
    expect(simulate(CANONICAL_TIMELINE)).toEqual(simulate(CANONICAL_TIMELINE));
  });
});
