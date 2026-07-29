import { describe, expect, it } from "vitest";

import { createGameStore } from "./store.js";
import { completeThrowCycles } from "./test-helpers.js";

describe("the shell clock", () => {
  it("advances a freshly Thrown yoyo by elapsed wall-clock time", () => {
    let now = 1_000;
    const store = createGameStore({ now: () => now });

    expect(store.getState().phase).toBe("Sleeping");

    now = 2_000;
    store.tick();

    expect(store.getState().style).toBeCloseTo(0.9, 10);

    now = 5_000;
    store.tick();

    expect(store.getState().style).toBeCloseTo(2.4, 10);
  });

  it("accounts for a hidden tab as one ordinary tick when the player returns", () => {
    let now = 10_000;
    const store = createGameStore({ now: () => now });

    now = 16_000;
    store.tick();

    expect(store.getState().phase).toBe("Rewinding");
    expect(store.getState().style).toBeCloseTo(2.5, 10);
    const styleWhenTheSleeperDied = store.getState().style;

    now = 18_000;
    store.tick();

    expect(store.getState().phase).toBe("Ready");

    now = 60_000;
    store.tick();
    expect(store.getState().style).toBe(styleWhenTheSleeperDied);
  });
});

describe("a player Throw", () => {
  it("starts a full-Throw-Power Sleeper when the yoyo is back in hand", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    now = 8_000;
    store.tick();
    expect(store.getState().phase).toBe("Ready");

    store.throwYoyo();

    expect(store.getState()).toMatchObject({
      phase: "Sleeping",
      spin: 100,
    });
  });

  it("starts the new Throw Cycle when the player Throws after waiting with the yoyo in hand", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    now = 8_000;
    store.tick();
    expect(store.getState().phase).toBe("Ready");

    now = 60_000;
    store.throwYoyo();
    now = 61_000;
    store.tick();

    expect(store.getState().phase).toBe("Sleeping");
    expect(store.getState().style).toBeCloseTo(3.4, 10);
  });

  it("refuses early Throws and can keep consistent Throw Cycles going by hand", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    store.throwYoyo();
    expect(store.getState()).toMatchObject({ phase: "Sleeping", spin: 100, style: 0 });

    now = 6_000;
    store.tick();
    expect(store.getState().phase).toBe("Rewinding");

    store.throwYoyo();
    expect(store.getState()).toMatchObject({ phase: "Rewinding", spin: 0, style: 2.5 });

    now = 8_000;
    store.tick();
    expect(store.getState().phase).toBe("Ready");

    for (let manualThrows = 1; manualThrows <= 4; manualThrows++) {
      store.throwYoyo();
      expect(store.getState()).toMatchObject({ phase: "Sleeping", spin: 100 });

      now += 8_000;
      store.tick();
      expect(store.getState().phase).toBe("Ready");
      expect(store.getState().style).toBeCloseTo((manualThrows + 1) * 2.5, 10);
    }
  });
});

describe("the Gear shop", () => {
  it("quotes every opening purchase against Sustained Style even before it is affordable", () => {
    const store = createGameStore({ now: () => 0 });

    const shop = store.getGearShop();

    expect(shop.sustainedStyle).toBeCloseTo(0.3125, 10);
    expect(
      shop.offers.map(({ name, price, sustainedStyleAfterPurchase, affordable }) => ({
        name,
        price,
        sustainedStyleAfterPurchase,
        affordable,
      })),
    ).toEqual([
      {
        name: "Throw Power",
        price: 10,
        sustainedStyleAfterPurchase: expect.closeTo(0.4, 10),
        affordable: false,
      },
      {
        name: "Bearing",
        price: 25,
        sustainedStyleAfterPurchase: expect.closeTo(0.3221649485, 10),
        affordable: false,
      },
      {
        name: "Rewind Speed",
        price: 15,
        sustainedStyleAfterPurchase: expect.closeTo(0.3246753247, 10),
        affordable: false,
      },
    ]);
  });

  it("keeps Sustained Style still through time and refuses every unaffordable row", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });
    const openingSustainedStyle = store.getGearShop().sustainedStyle;

    for (const gear of ["throwPower", "bearing", "rewindSpeed"] as const) {
      store.buyGear(gear);
    }

    expect(store.getState().style).toBe(0);
    expect(store.getGearShop().offers.every(({ affordable }) => !affordable)).toBe(true);

    now = 4_000;
    store.tick();

    expect(store.getState().style).toBeCloseTo(2.4, 10);
    expect(store.getGearShop().sustainedStyle).toBe(openingSustainedStyle);
  });

  it("buys Throw Power without disturbing the Sleeper already on the string", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });
    const advanceClock = (milliseconds: number) => {
      now += milliseconds;
    };

    completeThrowCycles(store, advanceClock, 4);

    store.throwYoyo();
    now += 1_000;
    store.tick();
    expect(store.getState()).toMatchObject({ phase: "Sleeping", spin: 80 });
    expect(store.getState().style).toBeCloseTo(10.9, 10);

    store.buyGear("throwPower");

    expect(store.getState()).toMatchObject({ phase: "Sleeping", spin: 80 });
    expect(store.getState().style).toBeCloseTo(0.9, 10);
    expect(store.getGearShop().sustainedStyle).toBeCloseTo(0.4, 10);
    expect(store.getGearShop().offers[0]?.price).toBeCloseTo(11.5, 10);

    now += 7_000;
    store.tick();
    expect(store.getState().phase).toBe("Ready");
    store.throwYoyo();
    expect(store.getState()).toMatchObject({ phase: "Sleeping", spin: 120 });
  });
});

describe("the Kit shop", () => {
  it("sells the opening Auto-Thrower on what the same eight-hour night would earn", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });
    const advanceClock = (milliseconds: number) => {
      now += milliseconds;
    };

    expect(store.getAutoThrowerOffer()).toEqual({
      price: 250,
      affordable: false,
      owned: false,
    });
    const openingProjection = store.getProjectedNight();
    expect(openingProjection).toEqual({
      hours: 8,
      withAutoThrower: expect.closeTo(9_000, 10),
      withoutAutoThrower: expect.closeTo(2.5, 10),
    });

    completeThrowCycles(store, advanceClock, 4);
    store.buyGear("throwPower");
    store.throwYoyo();

    const upgradedProjection = store.getProjectedNight();
    expect(upgradedProjection.withAutoThrower).toBeGreaterThan(
      openingProjection.withAutoThrower,
    );
    expect(upgradedProjection.withoutAutoThrower).toBeGreaterThan(
      openingProjection.withoutAutoThrower,
    );
  });

  it("buys the Auto-Thrower once and keeps Throw Cycles turning without the player", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });
    const advanceClock = (milliseconds: number) => {
      now += milliseconds;
    };

    completeThrowCycles(store, advanceClock, 100);
    expect(store.getState()).toMatchObject({ phase: "Ready", style: 250 });
    expect(store.getAutoThrowerOffer().affordable).toBe(true);

    store.buyAutoThrower();

    expect(store.getState()).toMatchObject({ hasAutoThrower: true, style: 0 });
    expect(store.getAutoThrowerOffer()).toEqual({
      price: 250,
      affordable: false,
      owned: true,
    });

    const bought = store.getState();
    store.buyAutoThrower();
    expect(store.getState()).toBe(bought);

    advanceClock(8_000);
    store.tick();
    expect(store.getState()).toMatchObject({ phase: "Sleeping", spin: 100, style: 2.5 });
  });
});
