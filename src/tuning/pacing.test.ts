import { describe, expect, it } from "vitest";

import type { Purchasable, Report } from "./simulate.js";
import { simulate } from "./simulate.js";
import { CANONICAL_TIMELINE } from "./timeline.js";

/**
 * The pacing guards.
 *
 * Guards of the same kind as the core's purity guard in `core-is-pure.test.ts`: each exists to
 * fail if a specific decision is quietly undone. They are not a description of how the harness
 * works — `simulate.test.ts` does that, figure by figure — but a description of the game the
 * Report describes, which is the thing a change to `constants.ts` moves.
 *
 * **Every claim is a direction or a threshold, never a figure.** ADR 0005 expects these constants
 * to be rewritten, so a test asserting that the Auto-Thrower lands at twenty hours and fifty
 * minutes would fail on the first deliberate rebalance — precisely backwards, since surviving
 * that rebalance is the whole reason these exist. A guard that fails when the game is improved on
 * purpose teaches everyone to delete guards.
 *
 * They run against the canonical timeline throughout, because each is a claim about the pacing a
 * player actually meets rather than about some arrangement of Sessions chosen to make it true.
 */

/** Every purchase in the run, in the order the player made them. */
function purchasesIn(report: Report): Purchasable[] {
  return report.sessions.flatMap((record) => record.purchases).map((purchase) => purchase.item);
}

describe("the opening of the game", () => {
  it("keeps Sustained Style climbing from one Session to the next", () => {
    // A plateau is the failure this catches: a player whose headline figure has stopped moving
    // has nothing left to buy that changes anything, and ADR 0007 makes that readout the one
    // number every purchase is judged through. Session over Session rather than moment to
    // moment, because Sustained Style dips nowhere within a Session either — it only ever moves
    // when something is bought.
    const report = simulate(CANONICAL_TIMELINE);

    const closes = report.sessions.map((record) => record.sustainedStyleAtClose);

    expect(closes.length).toBeGreaterThan(1);
    closes.forEach((close, index) => {
      if (index === 0) return;
      expect(close).toBeGreaterThan(closes[index - 1] ?? Infinity);
    });
  });

  it("leaves no row of the shop dead", () => {
    // A Gear stat nobody ever buys is a row that should not be in the shop, and the observational
    // counterpart to ADR 0003's algebraic guarantee: that ADR is built entirely around keeping
    // the Bearing worth buying, and until this harness existed the guarantee was defended by
    // algebra and one regression test rather than by anybody watching a player shop.
    const report = simulate(CANONICAL_TIMELINE);

    expect(report.gearNeverBought).toEqual([]);
  });

  it("goes on paying for the Bearing once Rewind Speed has been bought several times over", () => {
    // The Uptime lever, watched in play rather than proved. ADR 0003's argument is that a Rewind
    // driven to zero cancels the decay rate out of sustained earnings and stops the Bearing
    // working at all; a player who buys Rewind Speed several times and then never touches the
    // Bearing again is the shape of that collapse, and this is what would see it happen.
    //
    // **It does not stand in for the core's algebraic guard, and deleting the floor does not fail
    // it** — that was checked rather than assumed. A level of Rewind Speed multiplies the Rewind
    // rather than subtracting from it, so with the floor removed the Rewind approaches zero
    // without ever arriving and the Bearing goes on paying something. The abrupt collapse lives
    // at exactly `R = 0`, which only the floor's own regression test in `simulation.test.ts`
    // reaches. What this catches is the observable half: a Bearing that has stopped being worth
    // buying alongside the row that competes with it.
    //
    // "Several" rather than "to the floor": whether three days is long enough to reach the floor
    // is itself a finding that a rebalance may move, and a guard should not depend on it.
    const several = 5;
    const report = simulate(CANONICAL_TIMELINE);

    const items = purchasesIn(report);
    const rewindSpeeds = items.flatMap((item, index) => (item === "Rewind Speed" ? [index] : []));
    // Where in the run several Rewind Speeds have been bought — the point after which the
    // Bearing has to still be worth something. `Infinity` rather than a fallback that widens the
    // slice: if the player never bought Rewind Speed several times the claim has nothing to
    // stand on, and it should fail rather than quietly search the whole run.
    const severalRewindSpeedsIn = rewindSpeeds[several - 1] ?? Infinity;

    expect(severalRewindSpeedsIn).toBeLessThan(items.length);
    expect(items.slice(severalRewindSpeedsIn + 1)).toContain("Bearing");
  });
});

describe("the Auto-Thrower", () => {
  /**
   * **ADR 0002's promise is not asserted here, and that is the finding rather than an oversight.**
   *
   * The spec asked for a test that fails if the Auto-Thrower stops being reachable within the
   * first Session. At the constants as they stand it is not reachable within the first Session:
   * this player reaches theirs some twenty hours in, in the fourth Session, and the Report says
   * so in as many words through `inFirstSession`. Asserting the promise would fail the suite on
   * landing; asserting its negation would be a guard that the game stays broken, and would fail
   * on the very change that fixes it.
   *
   * So the claim is weakened to what is true — that a machine is reached at all — and the gap
   * itself is raised against the constants as #29 rather than papered over here. #18 puts
   * retuning explicitly out of scope, and moving a constant to make a test pass on an
   * instrument's first run is what its Further Notes caution against in as many words.
   *
   * When the constants are retuned, the stronger claim belongs here.
   */
  it("is reached at all across the player's first three days", () => {
    const report = simulate(CANONICAL_TIMELINE);

    expect(report.autoThrower.bought).toBe(true);
  });

  it("makes a night away worth vastly more than the same night without one", () => {
    // What the shop cannot show. Sustained Style does not move when an Auto-Thrower is bought —
    // `hasAutoThrower` appears nowhere in it — so this comparison is the only place the purchase
    // is legible at all, and a price change that quietly made the machine pointless would show
    // up nowhere else.
    //
    // Per hour, because the two groups of Absences differ in length. The counterfactual is
    // asserted alongside because the measured comparison alone has a confound: the Absences with
    // a machine come later in the run, when the Gear is better anyway. `styleAMachineWouldHaveEarned`
    // is the same nights with the same Gear and only the machine differing.
    const substantially = 10;
    const report = simulate(CANONICAL_TIMELINE);

    const working = report.absencesWithAutoThrower;
    const alone = report.absencesWithoutAutoThrower;

    expect(working.absences).toBeGreaterThan(0);
    expect(alone.absences).toBeGreaterThan(0);
    expect(working.stylePerHour).toBeGreaterThan(substantially * alone.stylePerHour);
    expect(report.styleAMachineWouldHaveEarned).toBeGreaterThan(substantially * alone.style);
  });
});

describe("the instrument itself", () => {
  it("reports the same run every time it is asked", () => {
    // The guard that makes every other one worth reading: if the same timeline could produce two
    // Reports, a difference between two runs would say nothing about the constants that changed
    // between them, and the harness would be measuring itself.
    expect(simulate(CANONICAL_TIMELINE)).toEqual(simulate(CANONICAL_TIMELINE));
  });
});
