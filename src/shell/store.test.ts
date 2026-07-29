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
