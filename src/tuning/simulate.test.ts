import { describe, expect, it } from "vitest";

import {
  decayRate,
  initialState,
  rewindDuration,
  throwPower,
  throwYoyo,
  type GameState,
} from "../core/simulation.js";
import type { Report } from "./simulate.js";
import { simulate } from "./simulate.js";
import type { Timeline } from "./timeline.js";
import { CANONICAL_TIMELINE } from "./timeline.js";

/**
 * Every figure asserted here was worked out by hand from the core's closed forms, which is what
 * makes these tests capable of disagreeing with the harness. At the current provisional constants
 * an untouched Throw Cycle is a 5s Sleeper and a 3s Rewind, it earns `k·S₀²/2D = 2.5` Style, and
 * Sustained Style is `2.5/8 = 0.3125`.
 *
 * **The opening Throw Cycle is no longer that one.** #71 gives the player Rock the Baby to Attempt
 * the instant a fresh Throw is safe, and at the opening Gear it always is (`constants.ts` measures
 * the margin): the very first Sleeper spends 1.5s at the Trick's ×1.5 drain, lands with 55 Spin
 * left, and decays out naturally from there — 7.25s of Sleeper in total rather than 5, followed by
 * the same 3s Rewind. Every Throw Cycle after the first opens 1.25× richer, because the landed
 * Trick's multiplier is permanent from that instant on. `STYLE_PER_THROW_CYCLE_AT_RTB` is that
 * second and later cycle's yield; the first cycle is worked out on its own below wherever a test
 * needs it, since RTB's own Attempt is not the ordinary Sleeper formula this file otherwise reads
 * everything off.
 *
 * The exact figures still live on short timelines, though a shorter one than before: Man on the
 * Flying Trapeze cannot land on the Gear the opening Throw carries (`spinOnLanding` comes back
 * exactly zero, a death rather than a landing), so nothing beyond Rock the Baby disturbs the
 * arithmetic until the shop opens. Once it does, the claims worth asserting are mostly directional
 * — ADR 0005 expects these constants to be rewritten, and a test naming a figure only this
 * configuration produces would fail on every deliberate rebalance.
 *
 * `buys the row worth the most Style per Style spent` used to be the deliberate exception #23
 * asked for in as many words: one run worked through by hand in full, capable of disagreeing with
 * the harness rather than merely restating it. It no longer is. The engaged player of #71 credits
 * a Gear purchase with a Trick's whole remaining-horizon value the instant it clears that Trick's
 * threshold (`sustainedStyleCreditingNextTrick`), which is exactly as lumpy as it sounds — the run
 * that test used to trace goes from 9 purchases to 19, several sharing a timestamp, and the
 * dependency of each on the last no longer stays inside what is worth re-deriving by hand for a
 * claim `a player saving up` already makes with a shorter run. What replaces it below hand-checks
 * the two purchases the credit mechanism actually decides, and takes the rest of a longer run from
 * the harness itself, named as such rather than presented as a hand derivation it is not.
 */

const STYLE_PER_THROW_CYCLE_AT_RTB = 3.125;
const SUSTAINED_STYLE_AT_OPENING = 0.3125;

/** Shop prices, straight from the provisional constants. */
const FIRST_THROW_POWER_PRICE = 10;
const AUTO_THROWER_PRICE = 250;

const session = (seconds: number): Timeline[number] => ({ kind: "Session", seconds });
const absence = (seconds: number): Timeline[number] => ({ kind: "Absence", seconds });

/**
 * A run with the player away once before they can afford a machine and again after they own one,
 * so that both kinds of Absence appear in the same Report.
 *
 * The canonical timeline no longer offers one, and for a shorter reason than it used to be. At
 * the price the game now charges the machine is bought part-way through the first Session before
 * the player has ever been away — which is ADR 0002's promise being kept rather than a gap in the
 * Report — and #71's engaged player reaches it sooner still: crediting Gear with the Trick it
 * unlocks pulls Throw Power forward hard enough that even ten minutes now bank the machine's
 * price. The opening Session here is cut to three and a half, short enough that Rock the Baby has
 * landed and nothing else has: not the Auto-Thrower's 250, and not the Gear that would put Man on
 * the Flying Trapeze in reach either.
 */
const AWAY_BEFORE_AND_AFTER: Timeline = [
  session(200),
  absence(28_800),
  session(1_800),
  absence(28_800),
  session(900),
];

/**
 * The Auto-Thrower as the Report describes it once one has been bought.
 *
 * Fails the test outright if the player declined it, rather than handing back something
 * half-shaped for the assertions after it to paper over — a run where nothing was automated is a
 * different claim, and the tests above make it directly.
 */
function autoThrowerIn(report: Report) {
  const { autoThrower } = report;
  if (!autoThrower.bought) throw new Error("the player never bought an Auto-Thrower");
  return autoThrower;
}

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
  /**
   * The opening Throw Cycle worked out by hand, since it is no longer the ordinary formula the
   * rest of this file reads everything off. Rock the Baby is safe from the very first Throw at
   * these constants (`constants.ts` measures the margin), and the engaged player of #71 Attempts
   * it the instant that Throw lands, so this Sleeper is two segments rather than one:
   *
   * - 1.5s of the Attempt itself, draining at `D × 1.5 = 30` Spin/s: `k·(S₀·t − 30t²/2) =
   *   0.01·(150 − 33.75) = 1.1625` Style, landing with `100 − 45 = 55` Spin left.
   * - The remaining `55/20 = 2.75s` of ordinary decay on what Rock the Baby left behind, now
   *   earning under its permanent ×1.25: `0.01 × 1.25 × 55²/40 = 0.9453125` Style.
   *
   * Together, 4.25s of Sleeper — shorter than the untouched 5s, because the Attempt's own drain
   * outpaces ordinary decay — for `1.1625 + 0.9453125 = 2.1078125` Style, then the same 3s Rewind
   * as ever. **7.25s in total**, and every Throw Cycle after it is an ordinary one earning
   * `STYLE_PER_THROW_CYCLE_AT_RTB` under the multiplier this Sleeper just landed.
   */
  const STYLE_FROM_THE_ROCK_THE_BABY_CYCLE = 2.1078125;

  it("Throws once per Throw Cycle for as long as it lasts", () => {
    // 24s holds the 7.25s opening cycle and three ordinary 8s cycles after it, with boundaries
    // at 7.25s, 15.25s and 23.25s — all inside the Session, for a Throw at each and one more at
    // the Session's own opening.
    const report = simulate([session(24)]);

    expect(report.sessions[0]?.manualThrows).toBe(4);
  });

  it("earns exactly the closed-form total when it closes on a Throw Cycle boundary", () => {
    // 23.25s is the opening cycle plus two ordinary ones after it — the third Throw Cycle
    // boundary, and nothing partial left over. `sustainedStyle × time` no longer names this
    // total on its own: it is the *steady-state* rate under whatever is landed now, and the
    // opening cycle it is being asked to stand in for was not a steady-state cycle at all.
    const report = simulate([session(23.25)]);

    const total = STYLE_FROM_THE_ROCK_THE_BABY_CYCLE + 2 * STYLE_PER_THROW_CYCLE_AT_RTB;
    expect(report.sessions[0]?.styleEarned).toBeCloseTo(total, 10);
  });

  it("declines Man on the Flying Trapeze while even a fresh Throw could not land it", () => {
    // Its drain is 40 Spin/s for 2.5s — 100 Spin, exactly the whole of an opening Throw — so at
    // no Gear at all it is fatal from the very first instant of any Sleeper, freshly thrown or
    // not, and sacrificing one for it would reach nothing a later Sleeper could not reach anyway.
    // The engaged player of #71 declines it every cycle rather than take that loss for no
    // strategic benefit, which is exactly what the total above already proves: three ordinary
    // cycles earning precisely their untouched amount is the signature of a Trick never begun,
    // not one begun and cut short by a drain the ordinary formula does not know about.
    const report = simulate([session(23.25)]);

    const motft = report.tricks.find((trick) => trick.id === "man-on-the-flying-trapeze");
    expect(motft?.landed).toBe(false);
    expect(report.sessions[0]?.manualThrows).toBe(3);
  });

  it("earns better than Sustained Style when it closes part-way through a Sleeper", () => {
    // 20s is the opening cycle, one ordinary cycle after it, and then 4.75s of a third Sleeper —
    // the front of it, where Spin and so the rate are highest, and none of the Rewind that would
    // have paid for them has been served yet, so the Session closes ahead of the average.
    const report = simulate([session(20)]);

    const openingOfTheSleeper = 3.1171875;
    const total = STYLE_FROM_THE_ROCK_THE_BABY_CYCLE + STYLE_PER_THROW_CYCLE_AT_RTB + openingOfTheSleeper;

    expect(report.sessions[0]?.manualThrows).toBe(3);
    expect(report.sessions[0]?.styleEarned).toBeCloseTo(total, 10);
    expect(report.sessions[0]?.styleEarned).toBeGreaterThan(
      (report.sessions[0]?.sustainedStyleAtClose ?? 0) * 20,
    );
  });

  it("leaves Sustained Style and the Gear exactly where they started", () => {
    // Short enough, before and after a whole day away, that nothing is ever affordable — Rock
    // the Baby has landed by the end of the first Session (its own reward is permanent, not a
    // purchase), but nothing about the shop has moved.
    const report = simulate([session(16), absence(28_800), session(4)]);

    for (const record of report.sessions) {
      expect(record.purchases).toEqual([]);
      expect(record.sustainedStyleAtClose).toBeCloseTo(SUSTAINED_STYLE_AT_OPENING * 1.25, 10);
      expect(record.gearAtClose).toEqual({ throwPower: 0, bearing: 0, rewindSpeed: 0 });
    }
  });
});

describe("a player at the shop", () => {
  it("buys at the first Throw Cycle boundary it can afford anything", () => {
    // The opening cycle plus three ordinary ones earn `2.1078125 + 3 × 3.125 = 11.4828125` Style
    // by 31.25s — past the first level of Throw Power's 10, the cheapest row in the shop, and
    // the only affordable one: Rewind Speed opens at 15 and the Bearing at 25.
    const report = simulate([session(40)]);

    expect(report.sessions[0]?.purchases).toEqual([
      { item: "Throw Power", price: FIRST_THROW_POWER_PRICE, atSeconds: 31.25 },
    ]);
  });

  it("Throws harder after buying Throw Power but declines a spine Attempt the short run cannot repay", () => {
    // A level of Throw Power puts `S₀` at 120 — and 120 is exactly enough Spin for Man on the
    // Flying Trapeze's ×2 drain to land rather than kill: `120 − 20 × 2 × 2.5 = 20` left over,
    // but only 8.75 seconds of this short run remain when the purchase is made. The lasting ×1.5
    // cannot repay the Style the Attempt would consume before the Session closes, so the merit
    // policy leaves it for a longer run and takes the ordinary 4.5-Style Sleeper instead.
    const report = simulate([session(40)]);

    expect(report.sessions[0]?.gearAtClose).toEqual({ throwPower: 1, bearing: 0, rewindSpeed: 0 });
    expect(report.sessions[0]?.manualThrows).toBe(5);
    expect(report.sessions[0]?.styleEarned).toBeCloseTo(15.9828125, 10);
    expect(report.tricks.find((trick) => trick.id === "man-on-the-flying-trapeze")?.landed).toBe(
      false,
    );
    // Only Rock the Baby's ×1.25 is active at close.
    expect(report.sessions[0]?.sustainedStyleAtClose).toBeCloseTo(0.5, 10);
  });

  it("has stopped playing by the instant a Session closes, so a boundary there is not shopped at", () => {
    // 31.25s is exactly the fourth Throw Cycle boundary — the same instant the purchase above
    // was made at — so a Session ending there closes with the player having already stopped
    // playing: they neither buy nor Throw, and the Style they held stays held.
    const report = simulate([session(31.25)]);

    expect(report.sessions[0]?.purchases).toEqual([]);
    expect(report.finalGear).toEqual({ throwPower: 0, bearing: 0, rewindSpeed: 0 });
  });

  it("carries Style it could not spend through to the next Session it plays", () => {
    // The same closing boundary, but with an hour away and another quarter of an hour of play
    // after it. The 11.4828125 Style is still there when the player sits back down, and buys
    // the same level of Throw Power at the first boundary of the Session that follows —
    // deferred by the Absence, not forfeited to it.
    const report = simulate([session(31.25), absence(3_600), session(900)]);

    expect(report.sessions[0]?.purchases).toEqual([]);
    expect(report.sessions[1]?.purchases[0]).toEqual({
      item: "Throw Power",
      price: FIRST_THROW_POWER_PRICE,
      atSeconds: 3_631.25,
    });
  });

  it("names the rows it never went near", () => {
    // Forty seconds is one purchase deep. Rewind Speed and the Bearing were never affordable.
    const report = simulate([session(40)]);

    expect([...report.gearNeverBought].sort()).toEqual(["Bearing", "Rewind Speed"]);
  });

  it("buys a second level of Throw Power over a cheaper row it cannot yet use", () => {
    // **What is left of the hand-check the ticket asked for.** #71's engaged player credits a
    // Gear purchase with a Trick's whole remaining-horizon value the instant it clears that
    // Trick's threshold (`sustainedStyleCreditingNextTrick`), and that credit is exactly as lumpy
    // as it sounds: the run this test used to trace by hand end to end went from 9 purchases to
    // 19, several sharing a timestamp, once Tricks were in it. Re-deriving all nineteen by hand is
    // no longer proportionate to what the claim needs, and `a player saving up` already covers
    // "value over cheapest" with a shorter run — so what survives here is the two purchases the
    // credit mechanism actually decides, worked out in full.
    //
    // The first level of Throw Power (10 Style, at 31.25s as above) makes Man on the Flying
    // Trapeze landable and is Attempted and landed at once. That Sleeper, and the two ordinary
    // ones after it — Brain Twister stays fatal on this Gear even from a fresh Throw, so nothing
    // is Attempted in them — bank 17.3578125 Style by 55.75s, past the second level's 11.5 and
    // still short of Rewind Speed's 15 or the Bearing's 25. There is nothing to rank yet: Throw
    // Power is both the only affordable row and the one still owed credit toward Brain Twister.
    const report = simulate([session(60)]);

    expect(report.sessions[0]?.purchases).toEqual([
      { item: "Throw Power", price: 10, atSeconds: 31.25 },
      { item: "Throw Power", price: 11.5, atSeconds: 55.75 },
    ]);
  });

  it("eventually buys Rewind Speed rather than Throw Power alone", () => {
    // Left to run longer, the same credited ranking keeps buying Throw Power only until Brain
    // Twister's threshold is reached and the credit stops — at which point Rewind Speed, cheaper
    // and no longer competing with a Trick's whole remaining value, gets a look in too. This is
    // read off the harness rather than re-derived by hand, in keeping with this file's own rule
    // that the exact figures live on short timelines and the claims worth asserting once a run
    // runs long are directional.
    const report = simulate([session(250)]);

    const items = report.sessions[0]?.purchases.map((purchase) => purchase.item) ?? [];

    expect(items).toContain("Throw Power");
    expect(items).toContain("Rewind Speed");
    expect(report.sessions[0]?.gearAtClose.rewindSpeed).toBeGreaterThan(0);
  });

  it("stops buying Rewind Speed once the Rewind can get no shorter", () => {
    // A day at the yoyo is long enough to buy Rewind Speed all the way down to ADR 0003's
    // floor. Past it a level buys nothing at all — the Rewind is already as short as it will
    // ever be — so its value is zero rather than merely poor, and the player declines it under
    // the same rule that buys everything else. They carry on shopping regardless: the two rows
    // that still pay are bought dozens more times.
    const report = simulate([session(86_400)]);

    const items = report.sessions.flatMap((record) => record.purchases).map((buy) => buy.item);
    const afterTheLastRewindSpeed = items.length - 1 - items.lastIndexOf("Rewind Speed");

    expect(report.rewindReachedFloor).toBe(true);
    expect(afterTheLastRewindSpeed).toBeGreaterThan(10);
  });
});

describe("a player saving up", () => {
  it("declines a row it can afford when a better one is within saving distance", () => {
    // An hour of play with a whole day away after it. A level of Throw Power is affordable four
    // Throw Cycles in and adds 0.0875 to Sustained Style — 317 Style over the hour that remains,
    // for its 10, or 31.7 Style per Style spent. The Auto-Thrower is 500, which at the opening
    // rate is 1,600 seconds of saving, and it earns 0.3125/s right through the 86,400 seconds
    // away less the one Sleeper the player would have left spinning anyway: 26,997 Style for its
    // 500, or 54.0 per Style spent.
    //
    // So the machine is the better buy from the very first boundary, and the player who cannot
    // bank Style would never once hold its price — they would spend every Throw Cycle's earnings
    // on a row worth a third as much and reach the day away with no machine to work through it.
    const report = simulate([session(3_600), absence(86_400), session(60)]);

    expect(report.sessions[0]?.purchases[0]?.item).toBe("Auto-Thrower");
  });

  it("goes on buying when what it wants is out of reach of the whole run", () => {
    // The same day away, and the same Auto-Thrower worth a fortune to a player who could get one
    // — but only 180 seconds of play in the entire timeline. Saving for it would swallow the run
    // and leave the player holding the price with nothing ahead for the machine to earn in.
    //
    // A player who could only rank rows they could afford would be safe from this, and a player
    // who ranked everything and simply waited for the best would buy nothing for 260 seconds and
    // finish the run on the yoyo they started with. Neither is wanted: the row is valued over
    // what would be left after the saving, which here is nothing at all, so it declines itself
    // and the player spends the run improving the yoyo. The shorter opening reflects the Mount
    // policy's higher early earnings; at the old 240 seconds the machine is now honestly reachable.
    const report = simulate([session(120), absence(86_400), session(60)]);

    expect(report.autoThrower.bought).toBe(false);
    expect(report.sessions[0]?.purchases.length).toBeGreaterThan(0);
    expect(report.finalSustainedStyle).toBeGreaterThan(SUSTAINED_STYLE_AT_OPENING);
  });

  it("reports the stretch it spent banking Style", () => {
    // The saving run again. Its first 32 seconds are the four Throw Cycles before the cheapest
    // row in the shop is affordable at all, and nothing about them is a decision. Every second
    // from there to the machine is the opposite: the player can afford Throw Power at every
    // boundary and passes it over every time, which is what this figure counts.
    //
    // At least that stretch, rather than exactly it — banking is not something the player does
    // once. They go on doing it for Gear after the machine is bought, whenever the row worth the
    // most is a level or two out of reach, and those stretches are in the figure too.
    const report = simulate([session(3_600), absence(86_400), session(60)]);

    expect(report.secondsSpentSaving).toBeGreaterThanOrEqual(autoThrowerIn(report).atSeconds - 32);
  });

  it("counts a shop it cannot reach as dead time and not as saving", () => {
    // The two figures answer opposite questions and must never answer the same second. Here the
    // player holds under 10 Style for the whole Session and has nothing to decide about: that is
    // a dead shop, which is a fault in the prices, and not a player banking towards something.
    const report = simulate([session(24)]);

    expect(report.secondsWithNothingAffordable).toBeCloseTo(24, 10);
    expect(report.secondsSpentSaving).toBe(0);
  });
});

describe("a player choosing between Mounts", () => {
  it("leaves every Mount unchosen when the remaining play cannot repay its Spin", () => {
    const report = simulate([session(100)]);

    expect(report.tricks.some((trick) => trick.landed)).toBe(true);
    expect(report.mounts.every((mount) => !mount.reached)).toBe(true);
  });
});

describe("the Auto-Thrower", () => {
  it("is declined when there is no Absence ahead for it to earn in", () => {
    // An Auto-Thrower buys absence, not speed: it makes a Throw the player would have made
    // anyway, so a player who never closes the tab is no better off for owning one. With no
    // Absence in the timeline it is worth exactly nothing, and the same positivity rule that
    // declines Rewind Speed at its floor declines this.
    const report = simulate([session(3_600)]);

    expect(report.autoThrower.bought).toBe(false);
  });

  it("is declined when a moment away is worth less than the Sleeper already on the string", () => {
    // A second away earns a second of Sustained Style with a machine, against the whole of the
    // Sleeper the player would have left spinning without one. The machine is worth less than
    // nothing here, and refusing it is the right answer rather than a failure to find one.
    const report = simulate([session(3_600), absence(1), session(60)]);

    expect(report.autoThrower.bought).toBe(false);
  });

  it("is bought once the player can afford one and the nights ahead are worth more than Gear", () => {
    const report = simulate(CANONICAL_TIMELINE);

    expect(report.autoThrower.bought).toBe(true);
    expect(autoThrowerIn(report).atSeconds).toBeGreaterThan(0);
  });

  it("is bought once and never again", () => {
    const report = simulate(CANONICAL_TIMELINE);

    const autoThrowerPurchases = report.sessions
      .flatMap((record) => record.purchases)
      .filter((purchase) => purchase.item === "Auto-Thrower");

    expect(autoThrowerPurchases).toHaveLength(1);
  });

  it("takes over the Throwing, so the player never Throws by hand again", () => {
    const report = simulate(CANONICAL_TIMELINE);

    const afterwards = report.sessions.filter(
      (record) => record.session > autoThrowerIn(report).session,
    );

    expect(afterwards.length).toBeGreaterThan(0);
    for (const record of afterwards) expect(record.manualThrows).toBe(0);
  });

  it("earns Sustained Style right through the night once it is owned", () => {
    // The whole of ADR 0002's promise in one assertion: an Absence with a machine working is
    // the ordinary Throw Cycle repeating, so it earns the same rate the player watched. Within
    // a cycle's worth, because the night ends part-way through whatever Sleeper is in flight.
    const report = simulate(CANONICAL_TIMELINE);

    const nightsWithAnAutoThrower = report.sessions.filter(
      (record, index) => index > 0 && record.autoThrowerDuringPrecedingAbsence,
    );

    expect(nightsWithAnAutoThrower.length).toBeGreaterThan(0);
    const windows = sessionWindows(CANONICAL_TIMELINE);
    for (const record of nightsWithAnAutoThrower) {
      const previous = report.sessions[record.session - 2];
      if (previous === undefined) throw new Error("expected a Session before the Absence");

      // Nothing is bought while the player is away, so whole cycles earn at the rate the player
      // left behind. The partial cycle at either edge may differ by at most one whole cycle.
      const rate = previous.sustainedStyleAtClose;
      const night = rate * record.precedingAbsenceSeconds;
      const landedTricks = report.tricks.flatMap((trick) =>
        trick.landed && trick.atSeconds <= (windows[record.session - 2]?.closed ?? 0)
          ? [trick.id]
          : [],
      );
      const atRest: GameState = {
        ...initialState(),
        throwPowerLevel: previous.gearAtClose.throwPower,
        bearingLevel: previous.gearAtClose.bearing,
        rewindSpeedLevel: previous.gearAtClose.rewindSpeed,
        activeThrowGear: {
          bearingLevel: previous.gearAtClose.bearing,
          rewindSpeedLevel: previous.gearAtClose.rewindSpeed,
        },
        hasAutoThrower: true,
        landedTricks,
      };
      const thrown = throwYoyo(atRest);
      const cycleSeconds = throwPower(atRest) / decayRate(thrown) + rewindDuration(thrown);
      const oneCycle = rate * cycleSeconds;

      expect(record.styleEarnedDuringPrecedingAbsence).toBeGreaterThan(night - oneCycle);
      expect(record.styleEarnedDuringPrecedingAbsence).toBeLessThan(night + oneCycle);
    }
  });
});

describe("the Report's headline facts", () => {
  it("keeps every Mount visible when the player reached none of them", () => {
    const report = simulate([session(1)]);

    expect(report.mounts).toEqual([
      { id: "trapeze-mount", name: "Trapeze Mount", reached: false },
      { id: "double-or-nothing-mount", name: "Double-or-Nothing Mount", reached: false },
      { id: "split-bottom-mount", name: "Split Bottom Mount", reached: false },
      { id: "wrist-mount", name: "Wrist Mount", reached: false },
    ]);
  });

  it("places every reached Mount in a Session and in Session seconds", () => {
    const report = simulate(CANONICAL_TIMELINE);

    const reached = report.mounts.filter((mount) => mount.reached);
    expect(reached.length).toBeGreaterThan(0);
    for (const mount of reached) {
      expect(mount.session).toBeGreaterThan(0);
      expect(mount.atSessionSeconds).toBeGreaterThan(0);
    }
  });

  it("keeps a later-run Mount visible when the canonical player defers it", () => {
    const report = simulate(CANONICAL_TIMELINE);

    expect(report.mounts.find((mount) => mount.id === "wrist-mount")).toEqual({
      id: "wrist-mount",
      name: "Wrist Mount",
      reached: false,
    });
    expect(report.tricks.find((trick) => trick.id === "spirit-bomb")).toEqual({
      id: "spirit-bomb",
      name: "Spirit Bomb",
      landed: false,
    });
  });

  it("states the longest Session stretch with nothing Attemptable", () => {
    const report = simulate([session(1)]);

    // Rock the Baby remains mechanically available throughout this short Sleeper even though
    // the merit policy declines it because the Session ends before the Attempt could resolve.
    expect(report.longestSecondsWithNothingAttemptable).toBe(0);
  });

  it("does not call a declined but available Trick nothing Attemptable", () => {
    const report = simulate([session(100)]);

    expect(report.tricks.find((trick) => trick.id === "man-on-the-flying-trapeze")?.landed).toBe(
      true,
    );
    expect(report.tricks.find((trick) => trick.id === "brain-twister")?.landed).toBe(false);
    expect(report.longestSecondsWithNothingAttemptable).toBeLessThan(8);
  });

  it("says plainly that the player declined the Auto-Thrower when they did", () => {
    const report = simulate([session(3_600)]);

    expect(report.autoThrower).toEqual({
      bought: false,
      manualThrows: report.sessions[0]?.manualThrows,
      price: AUTO_THROWER_PRICE,
    });
  });

  it("places the first Auto-Thrower in the Session it was bought in", () => {
    const report = simulate(CANONICAL_TIMELINE);

    const autoThrower = autoThrowerIn(report);
    const window = sessionWindows(CANONICAL_TIMELINE)[autoThrower.session - 1];

    expect(window).toBeDefined();
    expect(autoThrower.atSeconds).toBeGreaterThanOrEqual(window?.opened ?? 0);
    expect(autoThrower.atSeconds).toBeLessThan(window?.closed ?? 0);
    expect(autoThrower.inFirstSession).toBe(autoThrower.session === 1);
  });

  it("counts the Throws the player made by hand before the Auto-Thrower took over", () => {
    const report = simulate(CANONICAL_TIMELINE);

    const autoThrower = autoThrowerIn(report);
    const byHand = report.sessions
      .filter((record) => record.session <= autoThrower.session)
      .reduce((total, record) => total + record.manualThrows, 0);

    expect(autoThrower.manualThrowsBefore).toBe(byHand);
    expect(autoThrower.manualThrowsBefore).toBeGreaterThan(0);
  });

  it("states what an Absence earns with an Auto-Thrower working and what one earns without", () => {
    // The figure that quantifies what the shop cannot show. Sustained Style does not move when
    // an Auto-Thrower is bought, so this comparison is the only place its value is legible.
    const report = simulate(AWAY_BEFORE_AND_AFTER);

    expect(report.absencesWithAutoThrower.absences).toBeGreaterThan(0);
    expect(report.absencesWithoutAutoThrower.absences).toBeGreaterThan(0);
    expect(report.absencesWithAutoThrower.stylePerHour).toBeGreaterThan(
      report.absencesWithoutAutoThrower.stylePerHour,
    );
  });

  it("says what time away would have been worth even when the player never automated", () => {
    // The case the instrument exists for. With no Absence a machine ever worked through there is
    // nothing measured to compare against, so a refusal would otherwise print as a blank — and a
    // designer asking whether 500 is the wrong price would be told nothing at all.
    const report = simulate([session(40), absence(3_600), session(60)]);

    expect(report.autoThrower.bought).toBe(false);
    expect(report.absencesWithAutoThrower.absences).toBe(0);
    expect(report.styleAnAutoThrowerWouldHaveEarned).toBeGreaterThan(
      report.absencesWithoutAutoThrower.style,
    );
  });

  it("states how long the player spent with nothing in the shop they could afford", () => {
    // Twenty-four seconds of Throw Cycles, all of them short of the cheapest row's 10 Style — so
    // the whole of it was a stretch with no decision in it.
    const report = simulate([session(24)]);

    expect(report.secondsWithNothingAffordable).toBeCloseTo(24, 10);
    expect(report.sessions[0]?.secondsWithNothingAffordable).toBeCloseTo(24, 10);
  });

  it("stops counting dead time once the player has something worth deciding about", () => {
    const report = simulate(CANONICAL_TIMELINE);

    const played = CANONICAL_TIMELINE.filter((period) => period.kind === "Session").reduce(
      (total, period) => total + period.seconds,
      0,
    );

    expect(report.secondsWithNothingAffordable).toBeGreaterThan(0);
    expect(report.secondsWithNothingAffordable).toBeLessThan(played);
  });
});

describe("an Absence", () => {
  it("earns nothing at all when the yoyo was left waiting in the hand", () => {
    // 31.25s is exactly the fourth Throw Cycle boundary (the opening cycle plus three ordinary
    // ones), so the Session closes with the string wound and the yoyo Ready. With no
    // Auto-Thrower nobody Throws it for eight hours.
    const report = simulate([session(31.25), absence(28_800), session(8)]);

    expect(report.sessions[1]?.styleEarnedDuringPrecedingAbsence).toBe(0);
    expect(report.sessions[1]?.precedingAbsenceSeconds).toBe(28_800);
  });

  it("earns only what is left of the Sleeper still on the string", () => {
    // The Session closes 20s in — the opening cycle, one ordinary cycle, and 4.75s into a third
    // Sleeper — with 5 Spin still turning: a quarter-second more of it at the ×1.25 Rock the
    // Baby has already landed, `k × 1.25 × (5×0.25 − 20×0.25²/2) = 0.0078125` Style, and then
    // four hours of nothing.
    const report = simulate([session(20), absence(14_400), session(8)]);

    expect(report.sessions[1]?.styleEarnedDuringPrecedingAbsence).toBeCloseTo(0.0078125, 10);
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

  it("earns less across a whole night than in the play that follows, while unattended", () => {
    // Nothing re-Throws the yoyo while the player is away, so an unattended Absence earns only
    // whatever Sleeper was left on the string — worth more and more as the Bearing keeps the
    // yoyo alive longer, but never a night's worth of anything. This is the gap the
    // Auto-Thrower closes, and the reason the run stops looking like this once one is bought.
    const report = simulate(AWAY_BEFORE_AND_AFTER);

    const unattended = report.sessions.filter(
      (record) => record.precedingAbsenceSeconds > 0 && !record.autoThrowerDuringPrecedingAbsence,
    );

    expect(unattended.length).toBeGreaterThan(0);
    for (const record of unattended) {
      expect(record.styleEarnedDuringPrecedingAbsence).toBeLessThan(record.styleEarned);
    }
  });

  it("earns more across a night than a whole day of play, once an Auto-Thrower works", () => {
    const report = simulate(CANONICAL_TIMELINE);

    const attended = report.sessions.filter((record) => record.autoThrowerDuringPrecedingAbsence);

    expect(attended.length).toBeGreaterThan(0);
    for (const record of attended) {
      expect(record.styleEarnedDuringPrecedingAbsence).toBeGreaterThan(record.styleEarned);
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
    // Whether every shop row stayed worth buying is the dead-row guard, and lives among the
    // pacing guards in `pacing.test.ts` — as does the claim that the same timeline reports the
    // same run twice, which is a guard against the instrument drifting rather than a description
    // of what it reports.
    const report = simulate(CANONICAL_TIMELINE);

    expect(report.finalSustainedStyle).toBeGreaterThan(SUSTAINED_STYLE_AT_OPENING);
  });
});
