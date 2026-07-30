import {
  findTrick,
  SCHEMA_VERSION,
  type Attempt,
  type GameState,
  type TrickId,
} from "../core/simulation.js";
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

/**
 * Landed Tricks, checked against the ladder this build ships rather than merely for being
 * strings. An unknown id would reach the core, which throws on one — the save layer is where a
 * document the game cannot play is turned away, so that a save naming a Trick this build does
 * not have becomes the preserved-and-restarted path the player is told about, not a crash on the
 * first frame after loading.
 */
function isLandedTricks(value: unknown): value is TrickId[] {
  return (
    Array.isArray(value) && value.every((id) => typeof id === "string" && findTrick(id) !== undefined)
  );
}

/**
 * An Attempt in progress, or none. `remaining` is seconds of a Trick still to perform, so it is
 * positive and no longer than the Trick itself; anything else describes a Sleeper this build
 * cannot resolve.
 */
function isAttempt(value: unknown): value is Attempt | null {
  if (value === null) return true;
  if (!isRecord(value) || typeof value.trickId !== "string") return false;

  const trick = findTrick(value.trickId);
  return (
    trick !== undefined &&
    isFiniteNumber(value.remaining) &&
    value.remaining > 0 &&
    value.remaining <= trick.durationSeconds
  );
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
    typeof value.hasAutoThrower === "boolean" &&
    isLandedTricks(value.landedTricks) &&
    isAttempt(value.attempt) &&
    // An Attempt is activity inside a Sleeper (ADR 0014), which `GameState` says by calling the
    // field meaningful only while `Sleeping`. A document claiming a Trick is being performed on a
    // winding string is describing a game that cannot happen, whatever its fields say separately.
    (value.attempt === null || value.phase === "Sleeping")
  );
}

/**
 * Migration boundary: apply version-specific transforms here before validation.
 *
 * Version 2 is every save written before the 1A Division existed. Nothing it holds has changed
 * meaning, so the step adds and rewrites nothing: Style, Gear, Kit and the Throw on the string
 * all arrive as they were written, and the player meets the ladder with none of it landed and no
 * Attempt in hand. A save mid-Sleeper goes on playing that Sleeper, and may Attempt on it.
 *
 * Deliberately does not touch a version it does not recognise. A save from a later build carries
 * fields this one has never seen, and stamping the current version on it would claim they had
 * been understood; validation then rejects it, and `loadSave` keeps it rather than overwriting
 * it. Whatever the version, an unrecognised document is preserved and never silently discarded.
 */
function migrateSave(parsed: unknown): unknown {
  if (!isRecord(parsed) || !isRecord(parsed.state)) return parsed;
  if (parsed.state.version !== 2) return parsed;

  return {
    ...parsed,
    state: { ...parsed.state, version: SCHEMA_VERSION, landedTricks: [], attempt: null },
  };
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
