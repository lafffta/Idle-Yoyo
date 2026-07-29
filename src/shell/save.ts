import { SCHEMA_VERSION, type GameState } from "../core/simulation.js";
import type { GameStore } from "./store.js";

export const SAVE_KEY = "idle-yoyo.save";

/** Product policy: a visible game gets a crash-recovery backstop every thirty seconds. */
const SAVE_INTERVAL_MILLISECONDS = 30_000;

export type SaveDocument = {
  savedAt: number;
  state: GameState;
  /** Missing in saves created before the first-run guide existed; missing means not dismissed. */
  sustainedStyleGuideWasDismissed?: boolean;
};

export function serializeSave(saved: SaveDocument): string {
  return JSON.stringify(saved);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLevel(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || !isRecord(value.activeThrowGear)) return false;

  return (
    value.version === SCHEMA_VERSION &&
    isFiniteNumber(value.style) &&
    isFiniteNumber(value.lifetimeStyle) &&
    (value.phase === "Sleeping" || value.phase === "Rewinding" || value.phase === "Ready") &&
    isFiniteNumber(value.spin) &&
    isFiniteNumber(value.phaseElapsed) &&
    isLevel(value.throwPowerLevel) &&
    isLevel(value.bearingLevel) &&
    isLevel(value.rewindSpeedLevel) &&
    isLevel(value.activeThrowGear.bearingLevel) &&
    isLevel(value.activeThrowGear.rewindSpeedLevel) &&
    typeof value.hasAutoThrower === "boolean"
  );
}

/** Migration boundary: apply version-specific transforms here before validation. */
function migrateSave(parsed: unknown): unknown {
  return parsed;
}

export function deserializeSave(serialized: string | null): SaveDocument | null {
  if (serialized === null) return null;
  const migrated = migrateSave(JSON.parse(serialized) as unknown);
  if (
    !isRecord(migrated) ||
    !isFiniteNumber(migrated.savedAt) ||
    !isGameState(migrated.state) ||
    (migrated.sustainedStyleGuideWasDismissed !== undefined &&
      typeof migrated.sustainedStyleGuideWasDismissed !== "boolean")
  ) {
    throw new Error("The saved game document is not a supported version.");
  }
  return migrated as SaveDocument;
}

export type SaveStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type SaveLoadResult =
  | { status: "missing"; saved: null }
  | { status: "loaded"; saved: SaveDocument }
  | { status: "unreadable"; saved: null; preservedKey: string };

type LoadSaveOptions = {
  storage: SaveStorage;
  now: () => number;
};

export function loadSave({ storage, now }: LoadSaveOptions): SaveLoadResult {
  const serialized = storage.getItem(SAVE_KEY);
  if (serialized === null) return { status: "missing", saved: null };

  try {
    const saved = deserializeSave(serialized);
    if (saved === null) return { status: "missing", saved: null };
    return { status: "loaded", saved };
  } catch {
    const preservedKey = `${SAVE_KEY}.unreadable.${now()}`;
    storage.setItem(preservedKey, serialized);
    storage.removeItem(SAVE_KEY);
    return { status: "unreadable", saved: null, preservedKey };
  }
}

export type SaveHost = {
  isVisible: () => boolean;
  onVisibilityChange: (listener: () => void) => () => void;
  every: (milliseconds: number, listener: () => void) => () => void;
};

type StartSavingOptions = {
  store: GameStore;
  storage: Pick<SaveStorage, "setItem">;
  host: SaveHost;
};

export function startSaving({ store, storage, host }: StartSavingOptions): () => void {
  const write = () => {
    const checkpoint = store.checkpoint();
    storage.setItem(
      SAVE_KEY,
      serializeSave({
        savedAt: checkpoint.tickedAt,
        state: checkpoint.state,
        sustainedStyleGuideWasDismissed: checkpoint.sustainedStyleGuideWasDismissed,
      }),
    );
  };

  const stopPersistedChanges = store.subscribeToPersistedChanges(write);
  const stopVisibility = host.onVisibilityChange(() => {
    if (!host.isVisible()) write();
  });
  const stopInterval = host.every(SAVE_INTERVAL_MILLISECONDS, () => {
    if (host.isVisible()) write();
  });

  return () => {
    stopPersistedChanges();
    stopVisibility();
    stopInterval();
  };
}
