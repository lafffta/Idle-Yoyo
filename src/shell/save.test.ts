import { describe, expect, it } from "vitest";

import { initialState, throwYoyo } from "../core/simulation.js";
import {
  deserializeSave,
  SAVE_KEY,
  serializeSave,
  startSaving,
  type SaveHost,
} from "./save.js";
import { createGameStore, type GameStore } from "./store.js";

function inactiveHost(): SaveHost {
  return {
    isVisible: () => true,
    onVisibilityChange: () => () => undefined,
    every: () => () => undefined,
  };
}

describe("the saved game document", () => {
  it("round-trips the whole GameState with savedAt beside it", () => {
    const state = {
      ...throwYoyo(initialState()),
      style: 42.5,
      lifetimeStyle: 84.75,
      throwPowerLevel: 2,
      hasAutoThrower: true,
    };
    const saved = { savedAt: 12_345, state };

    const serialized = serializeSave(saved);

    expect(JSON.parse(serialized)).toEqual({
      savedAt: 12_345,
      state: expect.objectContaining({ version: 2 }),
    });
    expect(JSON.parse(serialized).state).not.toHaveProperty("savedAt");
    expect(deserializeSave(serialized)).toEqual(saved);
  });

  it("treats a missing save as an ordinary new game", () => {
    expect(deserializeSave(null)).toBeNull();
  });
});

describe("the save policy", () => {
  const purchases = [
    {
      name: "Gear",
      style: 10,
      buy: (store: GameStore) => store.buyGear("throwPower"),
    },
    {
      name: "Kit",
      style: 250,
      buy: (store: GameStore) => store.buyAutoThrower(),
    },
  ];

  it.each(purchases)(
    "writes a $name purchase immediately so a stale save cannot lose the decision",
    ({ style, buy }) => {
      let writtenKey: string | undefined;
      let writtenValue: string | undefined;
      const storage = {
        getItem: () => null,
        setItem: (key: string, value: string) => {
          writtenKey = key;
          writtenValue = value;
        },
      };
      const state = throwYoyo({ ...initialState(), style });
      const store = createGameStore({
        now: () => 7_000,
        restored: { tickedAt: 7_000, state },
      });
      startSaving({ store, storage, host: inactiveHost() });

      buy(store);

      expect(writtenKey).toBe(SAVE_KEY);
      expect(deserializeSave(writtenValue ?? null)).toEqual({
        savedAt: 7_000,
        state: store.getState(),
      });
    },
  );

  it("writes when the page becomes hidden", () => {
    let now = 0;
    let visible = true;
    let visibilityChanged: () => void = () => undefined;
    let writtenValue: string | undefined;
    const storage = {
      getItem: () => null,
      setItem: (_key: string, value: string) => {
        writtenValue = value;
      },
    };
    const host: SaveHost = {
      isVisible: () => visible,
      onVisibilityChange: (listener) => {
        visibilityChanged = listener;
        return () => undefined;
      },
      every: () => () => undefined,
    };
    const store = createGameStore({ now: () => now });
    startSaving({ store, storage, host });

    now = 5_000;
    visible = false;
    visibilityChanged();

    expect(deserializeSave(writtenValue ?? null)).toMatchObject({
      savedAt: 5_000,
      state: { phase: "Rewinding", style: 2.5 },
    });
  });

  it("backs up periodically while visible, but never from frames or while hidden", () => {
    let now = 0;
    let visible = true;
    let periodicWrite: () => void = () => undefined;
    let writes = 0;
    const storage = {
      getItem: () => null,
      setItem: () => {
        writes += 1;
      },
    };
    const host: SaveHost = {
      isVisible: () => visible,
      onVisibilityChange: () => () => undefined,
      every: (milliseconds, listener) => {
        expect(milliseconds).toBeGreaterThan(0);
        periodicWrite = listener;
        return () => undefined;
      },
    };
    const store = createGameStore({ now: () => now });
    startSaving({ store, storage, host });

    now = 1_000;
    store.tick();
    expect(writes).toBe(0);

    periodicWrite();
    expect(writes).toBe(1);

    visible = false;
    periodicWrite();
    expect(writes).toBe(1);
  });
});
