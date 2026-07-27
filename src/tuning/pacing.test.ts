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
 * to be rewritten, so a test asserting that the Auto-Thrower lands at thirteen minutes and twenty
 * seconds would fail on the first deliberate rebalance — precisely backwards, since surviving that
 * rebalance is the whole reason these exist. A guard that fails when the game is improved on
 * purpose teaches everyone to delete guards. That the machine lands inside the first Session is a
 * threshold and belongs here; where inside it lands is a figure and does not.
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
   * **ADR 0002's promise, asserted at last.**
   *
   * The spec asked for a test that fails if the Auto-Thrower stops being reachable within the
   * first Session. It stood weakened for a while — to the bare claim that a machine was reached
   * at all — because at the constants of the time it was not reachable within the first Session,
   * and a guard asserting the negation would have been a guard that the game stayed broken.
   *
   * Both halves of that gap have since been closed, and in the order that mattered. #29 asked
   * first whether the finding was the price or the player, and it was the player: the twenty
   * hours the harness first reported were an artefact of a policy that could not save, so it was
   * measuring whether 500 was ever met in passing rather than whether it could be reached. ADR
   * 0010 fixed the instrument, which moved the figure to 26m 40s of play and made it a claim
   * about the price — and 500 was then 133% of everything a first Session can pay. The price was
   * swept against the fixed harness and cut to 250.
   *
   * A threshold and not a figure, in keeping with the rest of this file: the guard is that the
   * machine lands inside the first Session, not that it lands at 13m 20s. What it forbids is a
   * later rebalance quietly pushing the machine back out of reach, which is the failure ADR 0002
   * says costs players before they ever see the game become idle.
   */
  it("is reached within the player's first Session", () => {
    const report = simulate(CANONICAL_TIMELINE);

    expect(report.autoThrower).toMatchObject({ bought: true, inFirstSession: true });
  });

  /**
   * The consequence of the promise, and the reason the machine's worth is no longer measurable
   * here. Every Absence in the canonical run now has a machine working through it, so the Report
   * has no machine-less night to compare one against — `absencesWithoutAutoThrower` is empty by
   * design rather than by omission.
   *
   * That comparison still matters, and a price change that quietly made the machine pointless
   * still has to fail something. It lives in `simulate.test.ts` now, on a run built to be away
   * once before a machine is affordable and once after. This file keeps to the canonical timeline
   * throughout, so the claim it can still make is this one: the player is never away without a
   * machine at all.
   */
  it("is owned before the player is ever first away", () => {
    const report = simulate(CANONICAL_TIMELINE);

    expect(report.absencesWithAutoThrower.absences).toBeGreaterThan(0);
    expect(report.absencesWithoutAutoThrower.absences).toBe(0);
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
