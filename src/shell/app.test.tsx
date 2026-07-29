import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./app.js";
import { createGameStore } from "./store.js";
import { completeThrowCycles } from "./test-helpers.js";

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
