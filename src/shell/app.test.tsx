import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  initialState,
  throwYoyo,
} from "../core/simulation.js";
import { App } from "./app.js";
import { createGameStore, type GameStore } from "./store.js";
import {
  completeThrowCycles,
  gearedFreshSleeper,
  restoreAfterAbsence,
  sleeperWithAutoThrower,
} from "./test-helpers.js";

describe("the Throw control", () => {
  it("explains when Throw is unavailable and enables it when the yoyo is back in hand", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    const duringSleeper = renderToStaticMarkup(<App store={store} />);
    expect(duringSleeper).toMatch(/<button[^>]*disabled=""[^>]*>Throw<\/button>/);
    expect(duringSleeper).toContain("Available when the yoyo is back in hand.");

    now = 8_000;
    store.tick();

    const whenReady = renderToStaticMarkup(<App store={store} />);
    expect(whenReady).toMatch(/<button(?![^>]*disabled)[^>]*>Throw<\/button>/);
    expect(whenReady).toContain("Ready to Throw.");
  });
});

describe("an unreadable save", () => {
  it("plainly tells the player a fresh game started and their original was kept", () => {
    const store = createGameStore({ now: () => 0 });

    const warned = renderToStaticMarkup(<App store={store} saveWasUnreadable />);
    expect(warned).toContain("We couldn&#x27;t read your save.");
    expect(warned).toContain("A fresh game was started");
    expect(warned).toContain("the original save was kept safely on this device");

    const ordinaryNewGame = renderToStaticMarkup(<App store={store} />);
    expect(ordinaryNewGame).not.toContain("We couldn&#x27;t read your save.");
  });
});

describe("the first Throw Cycle explanation", () => {
  it("shows the falling live Style rate and still Sustained Style average together", () => {
    const store = createGameStore({ now: () => 0 });

    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).toContain('aria-label="Understanding Sustained Style"');
    expect(markup).toContain("Why Sustained Style holds still");
    expect(markup).toContain("As the yoyo slows");
    expect(markup).toContain('role="img"');
    expect(markup).toContain("Live Style rate falls through a Throw Cycle");
    expect(markup).toContain("Live Style rate");
    expect(markup).toContain("Sustained Style average");
    expect(markup).toContain("Sleeper");
    expect(markup).toContain("Rewind earns no Style");
    expect(markup).toContain("The average does not dip during Rewind");
    expect(markup).toContain("Got it");
  });

  it("removes the explanation after the player dismisses it", () => {
    const store = createGameStore({ now: () => 0 });

    store.dismissSustainedStyleGuide();
    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).not.toContain("Understanding Sustained Style");
    expect(markup).not.toContain("Why Sustained Style holds still");
  });
});

describe("returning from an Absence", () => {
  it("reports what the Auto-Thrower earned while the player was away", () => {
    const store = restoreAfterAbsence(sleeperWithAutoThrower(), 8 * 60 * 60);

    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).toContain("Welcome back");
    expect(markup).toContain("You were away for 8 hours.");
    expect(markup).toContain("Your Auto-Thrower kept every Throw Cycle moving");
    expect(markup).toContain("earned 9,000 Style while you were away");
    expect(markup).toMatch(new RegExp(`<button[^>]*>Dismiss</button>`));
  });

  it("explains why a yoyo without an Auto-Thrower earned nothing after it died", () => {
    const store = restoreAfterAbsence(throwYoyo(initialState()), 8 * 60 * 60);

    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).toContain("Your yoyo died when its Spin ran out.");
    expect(markup).toContain("It earned 2.5 Style while you were away");
    expect(markup).toContain("then nothing further without an Auto-Thrower");
  });

});

describe("the Gear shop", () => {
  it("leads with Sustained Style and keeps every unaffordable Gear row visible", () => {
    const store = createGameStore({ now: () => 0 });

    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).toMatch(/<h1[^>]*>Sustained Style<\/h1>/);
    expect(markup).toMatch(
      /<output[^>]*aria-label="Sustained Style"[^>]*>0.31<\/output>/,
    );
    expect(markup).toMatch(/<output[^>]*aria-label="Current Style"[^>]*>0<\/output>/);

    for (const [name, price, afterPurchase] of [
      ["Throw Power", "10 Style", "0.4 Sustained Style"],
      ["Bearing", "25 Style", "0.32 Sustained Style"],
      ["Rewind Speed", "15 Style", "0.32 Sustained Style"],
    ]) {
      expect(markup).toMatch(new RegExp(`<h3[^>]*>${name}</h3>`));
      expect(markup).toContain(price);
      expect(markup).toContain(afterPurchase);
      expect(markup).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*>Buy ${name}</button>`));
    }
  });

  it("updates the headline, balance, next price and affordability on purchase", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });
    const advanceClock = (milliseconds: number) => {
      now += milliseconds;
    };

    completeThrowCycles(store, advanceClock, 4);
    store.throwYoyo();
    now += 1_000;
    store.tick();

    const affordable = renderToStaticMarkup(<App store={store} />);
    expect(affordable).toMatch(
      /<button(?![^>]*disabled)[^>]*>Buy Throw Power<\/button>/,
    );

    store.buyGear("throwPower");

    const bought = renderToStaticMarkup(<App store={store} />);
    expect(bought).toMatch(
      /<output[^>]*aria-label="Sustained Style"[^>]*>0.4<\/output>/,
    );
    expect(bought).toMatch(/<output[^>]*aria-label="Current Style"[^>]*>0.9<\/output>/);
    expect(bought).toContain("11.5 Style");
    expect(bought).toMatch(/<button[^>]*disabled=""[^>]*>Buy Throw Power<\/button>/);
  });
});

/** The 1A Division, as a player meets it on their opening Throw. */
function trickLadderMarkup(store: GameStore): string {
  const markup = renderToStaticMarkup(<App store={store} />);
  const ladder = markup.match(
    /<section[^>]*aria-labelledby="trick-ladder-heading"[^>]*>[\s\S]*?<\/section>/,
  )?.[0];

  if (ladder === undefined) throw new Error("expected a 1A Division on the page");
  return ladder;
}

describe("the 1A Division", () => {
  it("shows the whole ladder in order, with only the first Trick actionable", () => {
    const store = createGameStore({ now: () => 0 });

    const ladder = trickLadderMarkup(store);

    expect(ladder).toContain("1A Division");
    expect(ladder).toContain(
      "Attempts drain Spin. Land a Trick to multiply Style permanently. Run out of Spin and the Yoyo dies.",
    );
    expect(ladder.indexOf("Rock the Baby")).toBeLessThan(
      ladder.indexOf("Man on the Flying Trapeze"),
    );
    expect(ladder.indexOf("Man on the Flying Trapeze")).toBeLessThan(
      ladder.indexOf("Brain Twister"),
    );

    // The later rows say what opens them rather than offering an action that would be refused.
    expect(ladder).toContain("Land Rock the Baby first");
    expect(ladder).toContain("Land Man on the Flying Trapeze first");
    expect(ladder.match(/<button/g)).toHaveLength(1);
    expect(ladder).toMatch(
      /<button(?![^>]*disabled)[^>]*>Attempt Rock the Baby<\/button>/,
    );
  });

  it("does not advertise Divisions whose progression does not exist", () => {
    const markup = renderToStaticMarkup(<App store={createGameStore({ now: () => 0 })} />);

    for (const division of ["2A", "3A", "4A", "5A"]) expect(markup).not.toContain(division);
  });

  it("quotes the duration, the permanent reward and the exact Spin a landing leaves", () => {
    const store = createGameStore({ now: () => 0 });

    const ladder = trickLadderMarkup(store);

    // An opening Throw has 100 Spin and Rock the Baby costs 45 of it.
    expect(ladder).toContain("1.5s · ×1.25 Style");
    expect(ladder).toContain("Lands with 55 Spin still turning.");
  });

  it("says exactly when a late Attempt would kill the yoyo, and still offers it", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    // 3.5 seconds into a 5-second Sleeper: 30 Spin left, and the Trick drains 30 a second.
    now = 3_500;
    store.tick();

    const ladder = trickLadderMarkup(store);

    expect(ladder).toContain("Runs out of Spin after 1s, and the Yoyo dies.");
    expect(ladder).toMatch(/<button(?![^>]*disabled)[^>]*>Attempt anyway<\/button>/);
  });

  it("cannot be Attempted while the yoyo is not a Sleeper", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    now = 6_000;
    store.tick();

    const ladder = trickLadderMarkup(store);

    expect(ladder).toMatch(/<button[^>]*disabled=""[^>]*>Attempt Rock the Baby<\/button>/);
    expect(ladder).toContain("Available while the yoyo is a Sleeper.");
  });

  it("shows the committed Attempt as uncancellable while it runs", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    store.attemptTrick();
    now = 500;
    store.tick();

    const ladder = trickLadderMarkup(store);

    expect(ladder).toContain("Rock the Baby in progress. An Attempt cannot be cancelled.");
    expect(ladder).toMatch(/<button[^>]*disabled=""[^>]*>Attempt Rock the Baby<\/button>/);
  });

  it("records a landed Trick permanently and opens the next row on the same Sleeper", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    store.attemptTrick();
    now = 1_500;
    store.tick();

    const ladder = trickLadderMarkup(store);

    expect(ladder).toContain("Landed");
    expect(ladder).not.toContain("Attempt Rock the Baby");
    // 55 Spin is not enough for a 100-Spin Trick, so the row opens fatal rather than closed.
    expect(ladder).toMatch(/<button(?![^>]*disabled)[^>]*>Attempt anyway<\/button>/);
    expect(ladder).not.toContain("Land Rock the Baby first");
  });

  it("multiplies the headline Sustained Style the instant the Trick lands", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    expect(renderToStaticMarkup(<App store={store} />)).toMatch(
      /<output[^>]*aria-label="Sustained Style"[^>]*>0.31<\/output>/,
    );

    store.attemptTrick();
    now = 1_500;
    store.tick();

    expect(renderToStaticMarkup(<App store={store} />)).toMatch(
      /<output[^>]*aria-label="Sustained Style"[^>]*>0.39<\/output>/,
    );
  });

  /**
   * The Trick's motion is a readout rather than decoration, so it has to be legible to a player
   * who cannot see it — and under reduced motion, where the swing across the cradle is exactly
   * what is dropped, the words are what is left. Asserted as an accessible name, never as
   * drawing commands: what the canvas paints is not the contract.
   */
  it("names the Trick being performed on the live Throw Cycle", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    expect(renderToStaticMarkup(<App store={store} />)).toContain(
      'aria-label="A yoyo on its string"',
    );

    store.attemptTrick();
    now = 500;
    store.tick();

    expect(renderToStaticMarkup(<App store={store} />)).toContain(
      'aria-label="Rock the Baby: an Attempt in progress on the Sleeper"',
    );
  });

  /**
   * #68: a strong enough Throw carries a player through both rows of the same Sleeper, and the
   * plan asks that landing compounds rewards, shows Man on the Flying Trapeze's own motion while
   * it runs, and opens Brain Twister the instant it lands.
   */
  it("lands Man on the Flying Trapeze on the same Sleeper once Gear makes it survivable, and opens Brain Twister", () => {
    let now = 0;
    const store = createGameStore({
      now: () => now,
      restored: { tickedAt: now, state: gearedFreshSleeper(5) },
    });

    store.attemptTrick();
    now = 1_500;
    store.tick();

    // Between the two landings: Man on the Flying Trapeze is the only actionable row, and
    // Brain Twister still explains what it is waiting on rather than offering an action.
    const afterRockTheBaby = trickLadderMarkup(store);
    expect(afterRockTheBaby).toContain("Land Man on the Flying Trapeze first");
    expect(afterRockTheBaby).not.toContain("Land Rock the Baby first");
    expect(afterRockTheBaby.match(/<button/g)).toHaveLength(1);

    store.attemptTrick();

    now = 2_500;
    store.tick();
    expect(renderToStaticMarkup(<App store={store} />)).toContain(
      'aria-label="Man on the Flying Trapeze: an Attempt in progress on the Sleeper"',
    );

    now = 4_000;
    store.tick();

    const ladder = trickLadderMarkup(store);
    expect(ladder.match(/Landed/g)).toHaveLength(2);
    expect(ladder).not.toContain("Land Man on the Flying Trapeze first");
    expect(ladder).not.toContain("Land Brain Twister first");
    // 55 Spin left is not enough for Brain Twister's 200-Spin cost, so it opens fatal rather
    // than closed.
    expect(ladder).toMatch(/<button(?![^>]*disabled)[^>]*>Attempt anyway<\/button>/);

    expect(renderToStaticMarkup(<App store={store} />)).toMatch(
      /<output[^>]*aria-label="Sustained Style"[^>]*>1.44<\/output>/,
    );
  });

  /**
   * #69: Brain Twister completes the Division. A Throw strong enough to survive all three costs
   * — 400 Spin against 45, 100 and 200 — carries every landing onto one Sleeper, same as #68's
   * test does for the first two.
   */
  it("lands Brain Twister after the first two, completing the ladder with its own motion and no row left to act on", () => {
    let now = 0;
    const store = createGameStore({
      now: () => now,
      restored: { tickedAt: now, state: gearedFreshSleeper(15) },
    });

    store.attemptTrick();
    now = 1_500;
    store.tick();
    store.attemptTrick();
    now = 4_000;
    store.tick();

    // Between the second landing and the third: Brain Twister is the only actionable row.
    const beforeBrainTwister = trickLadderMarkup(store);
    expect(beforeBrainTwister.match(/<button/g)).toHaveLength(1);
    expect(beforeBrainTwister).toMatch(
      /<button(?![^>]*disabled)[^>]*>Attempt Brain Twister<\/button>/,
    );

    store.attemptTrick();
    now = 4_500;
    store.tick();
    expect(renderToStaticMarkup(<App store={store} />)).toContain(
      'aria-label="Brain Twister: an Attempt in progress on the Sleeper"',
    );

    now = 8_000;
    store.tick();

    const ladder = trickLadderMarkup(store);
    expect(ladder.match(/Landed/g)).toHaveLength(3);
    // Every row says Landed; nothing on the ladder is next any longer.
    expect(ladder).not.toMatch(/<button/);

    expect(renderToStaticMarkup(<App store={store} />)).toMatch(
      /<output[^>]*aria-label="Sustained Style"[^>]*>6\.52<\/output>/,
    );
  });

  /**
   * The row a weak Throw cannot survive: Brain Twister costs 200 Spin and this Sleeper has 55,
   * so Attempting it anyway kills the yoyo — and the row is exactly where it was afterwards,
   * waiting for a Sleeper rather than lost.
   */
  it("kills the yoyo when Brain Twister is Attempted anyway, and leaves the row to try again on the next Sleeper", () => {
    let now = 0;
    const store = createGameStore({
      now: () => now,
      restored: { tickedAt: now, state: gearedFreshSleeper(5) },
    });

    store.attemptTrick();
    now = 1_500;
    store.tick();
    store.attemptTrick();
    now = 4_000;
    store.tick();

    store.attemptTrick();
    // 55 Spin at Brain Twister's 50-a-second drain: dead 1.1s in, well inside its 4-second Attempt.
    now = 5_100;
    store.tick();

    const ladder = trickLadderMarkup(store);
    expect(ladder.match(/Landed/g)).toHaveLength(2);
    expect(ladder).not.toContain("Land Brain Twister first");
    expect(ladder).toMatch(/<button[^>]*disabled=""[^>]*>Attempt Brain Twister<\/button>/);
    expect(ladder).toContain("Available while the yoyo is a Sleeper.");

    // The ordinary Rewind, then a fresh Throw with no Auto-Thrower to do it automatically.
    now = 5_100 + 3_000;
    store.tick();
    store.throwYoyo();

    const freshLadder = trickLadderMarkup(store);
    expect(freshLadder).not.toContain("Land Brain Twister first");
    // Back to a fresh 200-Spin Throw: lands exactly on empty against a 200-Spin cost, which is
    // a death rather than a landing — the boundary this file elsewhere calls "the exact second".
    expect(freshLadder).toMatch(/<button(?![^>]*disabled)[^>]*>Attempt anyway<\/button>/);
  });
});

describe("the Kit shop", () => {
  it("presents the Auto-Thrower separately through an eight-hour night projection", () => {
    const store = createGameStore({ now: () => 0 });

    const markup = renderToStaticMarkup(<App store={store} />);
    const kit = markup.match(
      /<section[^>]*aria-label="Kit"[^>]*>[\s\S]*?<\/section>/,
    )?.[0];

    expect(kit).toBeDefined();
    expect(kit).toContain("Kit");
    expect(kit).toMatch(/<h3[^>]*>Auto-Thrower<\/h3>/);
    expect(kit).toContain("Projected 8-hour night");
    expect(kit).toContain("With Auto-Thrower");
    expect(kit).toContain("9,000 Style");
    expect(kit).toContain("Without Auto-Thrower");
    expect(kit).toContain("2.5 Style");
    expect(kit).toContain("250 Style");
    expect(kit).toMatch(/<button[^>]*disabled=""[^>]*>Buy Auto-Thrower<\/button>/);
    expect(kit).not.toContain("Sustained Style");
  });

  it("marks the one-time Auto-Thrower purchase as owned", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });
    const advanceClock = (milliseconds: number) => {
      now += milliseconds;
    };

    completeThrowCycles(store, advanceClock, 100);
    const affordable = renderToStaticMarkup(<App store={store} />);
    expect(affordable).toMatch(
      /<button(?![^>]*disabled)[^>]*>Buy Auto-Thrower<\/button>/,
    );

    store.buyAutoThrower();

    const owned = renderToStaticMarkup(<App store={store} />);
    expect(owned).toMatch(/<button[^>]*disabled=""[^>]*>Owned<\/button>/);
    expect(owned).not.toContain("Buy Auto-Thrower");
  });
});
