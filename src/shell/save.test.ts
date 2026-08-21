import { describe, expect, it } from "vitest";

import {
  advance,
  attemptTrick,
  buyAutoThrower,
  buyThrowPower,
  initialState,
  throwYoyo,
} from "../core/simulation.js";
import {
  deserializeSave,
  loadSave,
  SAVE_KEY,
  serializeSave,
  startSaving,
  type SaveHost,
} from "./save.js";
import { createGameStore, type GameStore } from "./store.js";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

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
      state: expect.objectContaining({ version: 3 }),
    });
    expect(JSON.parse(serialized).state).not.toHaveProperty("savedAt");
    expect(deserializeSave(serialized)).toEqual(saved);
    expect(
      loadSave({
        storage: memoryStorage({ [SAVE_KEY]: serialized }),
        now: () => 12_345,
      }),
    ).toEqual({ status: "loaded", saved });
  });

  it("treats a missing save as an ordinary new game", () => {
    expect(deserializeSave(null)).toBeNull();
    expect(loadSave({ storage: memoryStorage(), now: () => 12_345 })).toEqual({
      status: "missing",
      saved: null,
    });
  });

  it("fails if unreadable-save preservation is removed, because autosave would erase the player's original", () => {
    const original = '{"savedAt":';
    const storage = memoryStorage({ [SAVE_KEY]: original });

    const loaded = loadSave({ storage, now: () => 12_345 });

    expect(loaded.status).toBe("unreadable");
    if (loaded.status !== "unreadable") throw new Error("expected an unreadable save");
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(storage.getItem(loaded.preservedKey)).toBe(original);

    const state = throwYoyo({ ...initialState(), style: 10 });
    const store = createGameStore({
      now: () => 12_345,
      restored: { tickedAt: 12_345, state },
    });
    startSaving({ store, storage, host: inactiveHost() });
    store.buyGear("throwPower");

    expect(storage.getItem(loaded.preservedKey)).toBe(original);
    expect(storage.getItem(SAVE_KEY)).not.toBe(original);
  });

  it("preserves a save whose version this code does not understand", () => {
    const original = serializeSave({
      savedAt: 8_000,
      state: { ...initialState(), version: 999 },
    });
    const storage = memoryStorage({ [SAVE_KEY]: original });

    const loaded = loadSave({ storage, now: () => 12_345 });

    expect(loaded.status).toBe("unreadable");
    if (loaded.status !== "unreadable") throw new Error("expected an unreadable save");
    expect(storage.getItem(loaded.preservedKey)).toBe(original);
  });

  it("preserves a parseable current-version document whose GameState is incomplete", () => {
    const original = JSON.stringify({ savedAt: 8_000, state: { version: 3 } });
    const storage = memoryStorage({ [SAVE_KEY]: original });

    const loaded = loadSave({ storage, now: () => 12_345 });

    expect(loaded.status).toBe("unreadable");
    if (loaded.status !== "unreadable") throw new Error("expected an unreadable save");
    expect(storage.getItem(loaded.preservedKey)).toBe(original);
  });
});

/**
 * Version 2 is every save written before the 1A Division existed — which, on the day this
 * shipped, is every save any player has. Losing one to the new content would be worse than never
 * shipping it, so the migration is tested as what a returning player would describe: their game,
 * exactly as they left it, with a ladder they have not started.
 */
describe("a save written before there were any Tricks", () => {
  /** A version 2 document: mid-Sleeper, with Style banked, Gear bought and an Auto-Thrower. */
  function version2Document(): string {
    const played = advance(
      throwYoyo(buyAutoThrower(buyThrowPower({ ...initialState(), style: 1_000 }))),
      2,
    );
    const { landedTricks, attempt, ...version2State } = played;

    return JSON.stringify({ savedAt: 8_000, state: { ...version2State, version: 2 } });
  }

  it("keeps every fact it was written with", () => {
    const before = JSON.parse(version2Document()).state;

    const loaded = deserializeSave(version2Document());

    expect(loaded?.state.style).toBe(before.style);
    expect(loaded?.state.lifetimeStyle).toBe(before.lifetimeStyle);
    expect(loaded?.state.throwPowerLevel).toBe(before.throwPowerLevel);
    expect(loaded?.state.hasAutoThrower).toBe(true);
    expect(loaded?.state.phase).toBe("Sleeping");
    expect(loaded?.state.spin).toBe(before.spin);
    expect(loaded?.state.phaseElapsed).toBe(before.phaseElapsed);
    expect(loaded?.state.activeThrowGear).toEqual(before.activeThrowGear);
  });

  it("arrives at the new ladder with none of it landed and no Trick in progress", () => {
    const loaded = deserializeSave(version2Document());

    expect(loaded?.state.version).toBe(3);
    expect(loaded?.state.landedTricks).toEqual([]);
    expect(loaded?.state.attempt).toBe(null);
  });

  it("goes on playing the Sleeper it was saved during, and can Attempt a Trick on it", () => {
    const loaded = deserializeSave(version2Document());
    if (!loaded) throw new Error("expected the version 2 save to load");

    const landed = advance(attemptTrick(loaded.state, "rock-the-baby"), 1.5);

    expect(landed.landedTricks).toEqual(["rock-the-baby"]);
    expect(landed.style).toBeGreaterThan(loaded.state.style);
  });
});

describe("a saved Trick", () => {
  it("round-trips a landed ladder and an Attempt in progress", () => {
    const attempting = advance(attemptTrick(throwYoyo(initialState()), "rock-the-baby"), 1.7);
    const saved = { savedAt: 12_345, state: attempting };

    expect(attempting.landedTricks).toEqual(["rock-the-baby"]);
    expect(attempting.attempt).toBe(null);
    expect(deserializeSave(serializeSave(saved))).toEqual(saved);

    // A second Trick, committed to and half performed, which is the state a tab closed mid
    // Attempt writes out.
    const midAttempt = advance(
      attemptTrick({ ...attempting, spin: 400 }, "man-on-the-flying-trapeze"),
      1,
    );
    expect(midAttempt.attempt).not.toBe(null);
    expect(deserializeSave(serializeSave({ savedAt: 12_345, state: midAttempt }))).toEqual({
      savedAt: 12_345,
      state: midAttempt,
    });
  });

  /**
   * A document naming a Trick this build does not ship would reach `trickMultiplier`, which
   * throws on one. Turned away here so that it becomes the preserved-and-restarted path the
   * player is warned about, rather than a crash on the first frame after loading.
   */
  it("refuses a document naming a Trick this game does not have", () => {
    const document = JSON.stringify({
      savedAt: 8_000,
      state: { ...throwYoyo(initialState()), landedTricks: ["walk-the-dog"] },
    });

    expect(() => deserializeSave(document)).toThrow();
  });

  it("refuses a Trick being performed on a yoyo that is not spinning", () => {
    const winding = advance(throwYoyo(initialState()), 6);
    const document = JSON.stringify({
      savedAt: 8_000,
      state: { ...winding, attempt: { trickId: "rock-the-baby", remaining: 1 } },
    });

    expect(winding.phase).toBe("Rewinding");
    expect(() => deserializeSave(document)).toThrow();
  });

  it("refuses an Attempt with more of a Trick left to perform than the Trick takes", () => {
    const document = JSON.stringify({
      savedAt: 8_000,
      state: {
        ...throwYoyo(initialState()),
        attempt: { trickId: "rock-the-baby", remaining: 900 },
      },
    });

    expect(() => deserializeSave(document)).toThrow();
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
        sustainedStyleGuideWasDismissed: false,
      });
    },
  );

  it("keeps the Sustained Style guide dismissed through the existing save", () => {
    let writtenValue: string | undefined;
    const storage = {
      getItem: () => null,
      setItem: (_key: string, value: string) => {
        writtenValue = value;
      },
    };
    const store = createGameStore({ now: () => 7_000 });
    startSaving({ store, storage, host: inactiveHost() });

    store.dismissSustainedStyleGuide();

    const saved = deserializeSave(writtenValue ?? null);
    if (saved === null) throw new Error("expected the dismissal to be saved");
    expect(saved.sustainedStyleGuideWasDismissed).toBe(true);

    const restored = createGameStore({
      now: () => 7_000,
      restored: {
        tickedAt: saved.savedAt,
        state: saved.state,
        sustainedStyleGuideWasDismissed: saved.sustainedStyleGuideWasDismissed,
      },
    });
    expect(restored.isSustainedStyleGuideVisible()).toBe(false);
  });

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
