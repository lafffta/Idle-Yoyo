import type { GameState } from "../core/simulation.js";
import type { GameStore } from "./store.js";

export const SAVE_KEY = "idle-yoyo.save";

/** Product policy: a visible game gets a crash-recovery backstop every thirty seconds. */
const SAVE_INTERVAL_MILLISECONDS = 30_000;

export type SaveDocument = {
  savedAt: number;
  state: GameState;
};

export function serializeSave(saved: SaveDocument): string {
  return JSON.stringify(saved);
}

export function deserializeSave(serialized: string | null): SaveDocument | null {
  if (serialized === null) return null;
  // Issue #52 owns unreadable and unknown-version saves as one complete preservation flow.
  return JSON.parse(serialized) as SaveDocument;
}

export type SaveStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type SaveHost = {
  isVisible: () => boolean;
  onVisibilityChange: (listener: () => void) => () => void;
  every: (milliseconds: number, listener: () => void) => () => void;
};

type StartSavingOptions = {
  store: GameStore;
  storage: SaveStorage;
  host: SaveHost;
};

export function startSaving({ store, storage, host }: StartSavingOptions): () => void {
  const write = () => {
    const checkpoint = store.checkpoint();
    storage.setItem(
      SAVE_KEY,
      serializeSave({ savedAt: checkpoint.tickedAt, state: checkpoint.state }),
    );
  };

  const stopPurchases = store.subscribeToPurchases(write);
  const stopVisibility = host.onVisibilityChange(() => {
    if (!host.isVisible()) write();
  });
  const stopInterval = host.every(SAVE_INTERVAL_MILLISECONDS, () => {
    if (host.isVisible()) write();
  });

  return () => {
    stopPurchases();
    stopVisibility();
    stopInterval();
  };
}
