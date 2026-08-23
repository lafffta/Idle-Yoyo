import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  advance,
  attemptTrick,
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

  it("names the Trick a saved Attempt landed while the player was away", () => {
    const attempting = attemptTrick(throwYoyo(initialState()), "rock-the-baby");
    const store = restoreAfterAbsence(attempting, 8 * 60 * 60);

    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).toContain("It also landed Rock the Baby while you were away.");
  });

  it("names Eli Hops when the Trapeze Mount lands while the player is away", () => {
    const attempting = attemptTrick(gearedFreshSleeper(5), "eli-hops");
    const store = restoreAfterAbsence(attempting, 8 * 60 * 60);

    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).toContain("It also landed Eli Hops while you were away.");
  });

  it("names Cold Fusion when the Double-or-Nothing Mount lands while the player is away", () => {
    const attempting = attemptTrick(gearedFreshSleeper(7), "cold-fusion");
    const store = restoreAfterAbsence(attempting, 8 * 60 * 60);

    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).toContain("It also landed Cold Fusion while you were away.");
  });

  it("names Mach 5 when the Split Bottom Mount lands while the player is away", () => {
    const attempting = attemptTrick(
      { ...gearedFreshSleeper(12), hasAutoThrower: true },
      "mach-5",
    );
    const store = restoreAfterAbsence(attempting, 8 * 60 * 60);

    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).toContain("It also landed Mach 5 while you were away.");
  });

  it("names an Attempt committed during Rewind when it resolves through an Absence", () => {
    const rewinding = advance(
      { ...sleeperWithAutoThrower(), landedTricks: ["mach-5"] },
      6,
    );
    const committed = attemptTrick(rewinding, "rock-the-baby");
    const store = restoreAfterAbsence(committed, 8 * 60 * 60);

    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).toContain("It also landed Rock the Baby while you were away.");
  });

  it("names the Attempt that killed the Yoyo while the player was away", () => {
    const doomed = attemptTrick(advance(throwYoyo(initialState()), 3.5), "rock-the-baby");
    const store = restoreAfterAbsence(doomed, 8 * 60 * 60);

    const markup = renderToStaticMarkup(<App store={store} />);

    expect(markup).toContain("Its Attempt at Rock the Baby killed the Yoyo while you were away.");
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
function trickDivisionMarkup(store: GameStore): string {
  const markup = renderToStaticMarkup(<App store={store} />);
  const ladder = markup.match(
    /<section[^>]*aria-labelledby="trick-division-heading"[^>]*>[\s\S]*?<\/section>/,
  )?.[0];

  if (ladder === undefined) throw new Error("expected a 1A Division on the page");
  return ladder;
}

describe("the 1A Division", () => {
  it("shows the opening Mounts and holds Split Bottom Mount until the Auto-Thrower", () => {
    const store = createGameStore({ now: () => 0 });

    const ladder = trickDivisionMarkup(store);

    expect(ladder).toContain("1A Division");
    expect(ladder).toContain("Spine");
    expect(ladder).toContain("Trapeze Mount");
    expect(ladder).toContain("Double-or-Nothing Mount");
    expect(ladder).toContain("Split Bottom Mount");
    expect(ladder).toContain("Mach 5");
    expect(ladder).toContain(
      "Attempts drain Spin. Landing a Trick changes every Throw after it. Run out of Spin and the Yoyo dies.",
    );
    expect(ladder.indexOf("Rock the Baby")).toBeLessThan(
      ladder.indexOf("Man on the Flying Trapeze"),
    );
    expect(ladder.indexOf("Man on the Flying Trapeze")).toBeLessThan(
      ladder.indexOf("Brain Twister"),
    );
    expect(ladder.indexOf("Brain Twister")).toBeLessThan(ladder.indexOf("Eli Hops"));
    expect(ladder.indexOf("Eli Hops")).toBeLessThan(ladder.indexOf("Cold Fusion"));
    expect(ladder.indexOf("Cold Fusion")).toBeLessThan(ladder.indexOf("Mach 5"));

    // The later rows say what opens them rather than offering an action that would be refused.
    expect(ladder).toContain("Land Rock the Baby first");
    expect(ladder).toContain("Land Man on the Flying Trapeze first");
    expect(ladder).toContain("4s · Structural Trick");
    expect(ladder).toContain(
      "Throw Power packs more Spin into every Throw without making Sleepers longer.",
    );
    expect(ladder).toContain("Landing pays Style equal to the Spin left above Cold Fusion");
    expect(ladder).toContain("Own the Auto-Thrower first");
    expect(ladder.match(/<button/g)).toHaveLength(3);
    expect(ladder).toMatch(
      /<button(?![^>]*disabled)[^>]*>Attempt Rock the Baby<\/button>/,
    );
    expect(ladder).toMatch(/<button(?![^>]*disabled)[^>]*>Attempt anyway<\/button>/);
    expect(ladder).toContain("Runs out of Spin after 2.22s, and the Yoyo dies.");
  });

  it("makes Split Bottom Mount actionable on an automated Sleeper", () => {
    const store = createGameStore({
      now: () => 0,
      restored: { tickedAt: 0, state: sleeperWithAutoThrower() },
    });

    const ladder = trickDivisionMarkup(store);

    expect(ladder).not.toContain("Own the Auto-Thrower first");
    expect(ladder.match(/<button/g)).toHaveLength(4);
    expect(ladder).toMatch(/<button(?![^>]*disabled)[^>]*>Attempt anyway<\/button>/);
  });

  it("does not advertise Divisions whose progression does not exist", () => {
    const markup = renderToStaticMarkup(<App store={createGameStore({ now: () => 0 })} />);

    for (const division of ["2A", "3A", "4A", "5A"]) expect(markup).not.toContain(division);
  });

  it("quotes the duration, the permanent reward and the exact Spin a landing leaves", () => {
    const store = createGameStore({ now: () => 0 });

    const ladder = trickDivisionMarkup(store);

    // An opening Throw has 100 Spin and Rock the Baby costs 45 of it.
    expect(ladder).toContain("1.5s · ×1.25 Style");
    expect(ladder).toContain("Lands with 55 Spin still turning.");
    // Eli Hops is offered beside it, even though the opening Sleeper cannot sustain the Mount.
    expect(ladder).toContain("Runs out of Spin after 2.5s, and the Yoyo dies.");
  });

  it("lands Eli Hops with its exact preview and raises the headline through its Structural effect", () => {
    let now = 0;
    const store = createGameStore({
      now: () => now,
      restored: { tickedAt: now, state: gearedFreshSleeper(5) },
    });

    const before = renderToStaticMarkup(<App store={store} />);
    expect(before).toContain("Lands with 60 Spin still turning.");
    expect(before).toMatch(
      /<output[^>]*aria-label="Sustained Style"[^>]*>0.77<\/output>/,
    );

    store.attemptTrick("eli-hops");
    now = 4_000;
    store.tick();

    const after = renderToStaticMarkup(<App store={store} />);
    expect(after).toContain("Eli Hops");
    expect(after).toContain("Landed");
    expect(after).not.toContain("Attempt Eli Hops");
    expect(after).toMatch(
      /<output[^>]*aria-label="Sustained Style"[^>]*>1.15<\/output>/,
    );
  });

  it("quotes and pays Cold Fusion's exact headroom bonus", () => {
    let now = 0;
    const store = createGameStore({
      now: () => now,
      restored: { tickedAt: now, state: gearedFreshSleeper(7) },
    });

    const before = trickDivisionMarkup(store);
    expect(before).toContain("Lands with 15 Spin still turning and pays 15 Style.");

    store.attemptTrick("cold-fusion");
    now = 5_000;
    store.tick();

    const after = renderToStaticMarkup(<App store={store} />);
    expect(after).toContain("Cold Fusion");
    expect(after).toContain("Landed");
    expect(after).not.toContain("Attempt Cold Fusion");
    expect(after).toMatch(/<output[^>]*aria-label="Current Style"[^>]*>21.4<\/output>/);
  });

  it("says exactly when a late Attempt would kill the yoyo, and still offers it", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    // 3.5 seconds into a 5-second Sleeper: 30 Spin left, and the Trick drains 30 a second.
    now = 3_500;
    store.tick();

    const ladder = trickDivisionMarkup(store);

    expect(ladder).toContain("Runs out of Spin after 1s, and the Yoyo dies.");
    expect(ladder).toMatch(/<button(?![^>]*disabled)[^>]*>Attempt anyway<\/button>/);
  });

  it("cannot be Attempted while the yoyo is not a Sleeper", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    now = 6_000;
    store.tick();

    const ladder = trickDivisionMarkup(store);

    expect(ladder).toMatch(/<button[^>]*disabled=""[^>]*>Attempt Rock the Baby<\/button>/);
    expect(ladder).toContain("Available while the yoyo is a Sleeper.");
  });

  it("quotes and commits the next Attempt during Rewind after Mach 5 has landed", () => {
    const rewinding = advance(
      { ...sleeperWithAutoThrower(), landedTricks: ["mach-5"] },
      6,
    );
    const store = createGameStore({
      now: () => 0,
      restored: { tickedAt: 0, state: rewinding },
    });

    const before = trickDivisionMarkup(store);
    expect(before).toContain("Lands with 55 Spin still turning.");
    expect(before).toMatch(
      /<button(?![^>]*disabled)[^>]*>Attempt Rock the Baby<\/button>/,
    );

    store.attemptTrick("rock-the-baby");
    const after = renderToStaticMarkup(<App store={store} />);

    expect(after).toContain(
      "Rock the Baby committed during Rewind. It begins on the next Sleeper and cannot be cancelled.",
    );
    expect(after).toContain(
      'aria-label="Rock the Baby: an Attempt committed during Rewind for the next Sleeper"',
    );
  });

  it("shows the committed Attempt as uncancellable while it runs", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    store.attemptTrick("rock-the-baby");
    now = 500;
    store.tick();

    const ladder = trickDivisionMarkup(store);

    expect(ladder).toContain("Rock the Baby in progress. An Attempt cannot be cancelled.");
    expect(ladder).toMatch(/<button[^>]*disabled=""[^>]*>Attempt Rock the Baby<\/button>/);
  });

  it("records a landed Trick permanently and opens the next row on the same Sleeper", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    store.attemptTrick("rock-the-baby");
    now = 1_500;
    store.tick();

    const ladder = trickDivisionMarkup(store);

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

    store.attemptTrick("rock-the-baby");
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

    store.attemptTrick("rock-the-baby");
    now = 500;
    store.tick();

    expect(renderToStaticMarkup(<App store={store} />)).toContain(
      'aria-label="Rock the Baby: an Attempt in progress on the Sleeper"',
    );

    const mountStore = createGameStore({ now: () => now });
    mountStore.attemptTrick("eli-hops");

    expect(renderToStaticMarkup(<App store={mountStore} />)).toContain(
      'aria-label="Eli Hops: an Attempt in progress on the Sleeper"',
    );

    const secondMountStore = createGameStore({
      now: () => now,
      restored: { tickedAt: now, state: gearedFreshSleeper(7) },
    });
    secondMountStore.attemptTrick("cold-fusion");

    expect(renderToStaticMarkup(<App store={secondMountStore} />)).toContain(
      'aria-label="Cold Fusion: an Attempt in progress on the Sleeper"',
    );

    const splitBottomStore = createGameStore({
      now: () => now,
      restored: {
        tickedAt: now,
        state: { ...gearedFreshSleeper(12), hasAutoThrower: true },
      },
    });
    splitBottomStore.attemptTrick("mach-5");

    expect(renderToStaticMarkup(<App store={splitBottomStore} />)).toContain(
      'aria-label="Mach 5: an Attempt in progress on the Sleeper"',
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

    store.attemptTrick("rock-the-baby");
    now = 1_500;
    store.tick();

    // Between the two landings: the next spine row and the independent Mount remain actionable,
    // while Brain Twister still explains what it is waiting on.
    const afterRockTheBaby = trickDivisionMarkup(store);
    expect(afterRockTheBaby).toContain("Land Man on the Flying Trapeze first");
    expect(afterRockTheBaby).not.toContain("Land Rock the Baby first");
    expect(afterRockTheBaby.match(/<button/g)).toHaveLength(3);

    store.attemptTrick("man-on-the-flying-trapeze");

    now = 2_500;
    store.tick();
    expect(renderToStaticMarkup(<App store={store} />)).toContain(
      'aria-label="Man on the Flying Trapeze: an Attempt in progress on the Sleeper"',
    );

    now = 4_000;
    store.tick();

    const ladder = trickDivisionMarkup(store);
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
  it("lands Brain Twister after the first two, finishing the spine while the Mount remains open", () => {
    let now = 0;
    const store = createGameStore({
      now: () => now,
      restored: { tickedAt: now, state: gearedFreshSleeper(15) },
    });

    store.attemptTrick("rock-the-baby");
    now = 1_500;
    store.tick();
    store.attemptTrick("man-on-the-flying-trapeze");
    now = 4_000;
    store.tick();

    // Between the second landing and the third: Brain Twister and the independent Mount are open.
    const beforeBrainTwister = trickDivisionMarkup(store);
    expect(beforeBrainTwister.match(/<button/g)).toHaveLength(3);
    expect(beforeBrainTwister).toMatch(
      /<button(?![^>]*disabled)[^>]*>Attempt Brain Twister<\/button>/,
    );

    store.attemptTrick("brain-twister");
    now = 4_500;
    store.tick();
    expect(renderToStaticMarkup(<App store={store} />)).toContain(
      'aria-label="Brain Twister: an Attempt in progress on the Sleeper"',
    );

    now = 8_000;
    store.tick();

    const ladder = trickDivisionMarkup(store);
    expect(ladder.match(/Landed/g)).toHaveLength(3);
    expect(ladder).toMatch(/<button(?![^>]*disabled)[^>]*>Attempt anyway<\/button>/);

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

    store.attemptTrick("rock-the-baby");
    now = 1_500;
    store.tick();
    store.attemptTrick("man-on-the-flying-trapeze");
    now = 4_000;
    store.tick();

    store.attemptTrick("brain-twister");
    // 55 Spin at Brain Twister's 50-a-second drain: dead 1.1s in, well inside its 4-second Attempt.
    now = 5_100;
    store.tick();

    const ladder = trickDivisionMarkup(store);
    expect(ladder.match(/Landed/g)).toHaveLength(2);
    expect(ladder).not.toContain("Land Brain Twister first");
    expect(ladder).toMatch(/<button[^>]*disabled=""[^>]*>Attempt Brain Twister<\/button>/);
    expect(ladder).toContain("Available while the yoyo is a Sleeper.");

    // The ordinary Rewind, then a fresh Throw with no Auto-Thrower to do it automatically.
    now = 5_100 + 3_000;
    store.tick();
    store.throwYoyo();

    const freshDivision = trickDivisionMarkup(store);
    expect(freshDivision).not.toContain("Land Brain Twister first");
    // Back to a fresh 200-Spin Throw: lands exactly on empty against a 200-Spin cost, which is
    // a death rather than a landing — the boundary this file elsewhere calls "the exact second".
    expect(freshDivision).toMatch(/<button(?![^>]*disabled)[^>]*>Attempt anyway<\/button>/);
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
