import type { GameState } from "../core/simulation.js";
import { advance, initialState, throwYoyo } from "../core/simulation.js";

type GameStoreOptions = {
  /** Milliseconds from the device wall clock. Injected so elapsed time is testable. */
  now: () => number;
};

export type GameStore = {
  getState: () => GameState;
  tick: () => void;
  throwYoyo: () => void;
  isThrowAvailable: () => boolean;
  subscribeToThrowAvailability: (listener: () => void) => () => void;
};

/**
 * Owns the live state outside React. A frame asks it to tick, but the wall clock alone decides
 * how much time passes; requestAnimationFrame is only the scheduler (ADR 0011).
 */
export function createGameStore({ now }: GameStoreOptions): GameStore {
  let state = throwYoyo(initialState());
  let lastTick = now();
  const throwAvailabilityListeners = new Set<() => void>();

  const replaceState = (nextState: GameState) => {
    const availabilityChanged = (state.phase === "Ready") !== (nextState.phase === "Ready");
    state = nextState;
    if (availabilityChanged) {
      for (const listener of throwAvailabilityListeners) listener();
    }
  };

  return {
    getState: () => state,
    tick: () => {
      const tickedAt = now();
      replaceState(advance(state, (tickedAt - lastTick) / 1_000));
      lastTick = tickedAt;
    },
    throwYoyo: () => {
      const thrown = throwYoyo(state);
      if (thrown === state) return;

      // A Ready yoyo may have waited through a paused frame loop. The new Throw starts now,
      // rather than inheriting time that passed before the player acted.
      lastTick = now();
      replaceState(thrown);
    },
    isThrowAvailable: () => state.phase === "Ready",
    subscribeToThrowAvailability: (listener) => {
      throwAvailabilityListeners.add(listener);
      return () => throwAvailabilityListeners.delete(listener);
    },
  };
}
