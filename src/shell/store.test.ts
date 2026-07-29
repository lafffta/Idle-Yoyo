import { describe, expect, it } from "vitest";

import { createGameStore } from "./store.js";

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
