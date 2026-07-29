import type { GameState } from "../core/simulation.js";
import { advance, initialState, throwYoyo } from "../core/simulation.js";

type GameStoreOptions = {
  /** Milliseconds from the device wall clock. Injected so elapsed time is testable. */
  now: () => number;
};

export type GameStore = {
  getState: () => GameState;
  tick: () => void;
};

/**
 * Owns the live state outside React. A frame asks it to tick, but the wall clock alone decides
 * how much time passes; requestAnimationFrame is only the scheduler (ADR 0011).
 */
export function createGameStore({ now }: GameStoreOptions): GameStore {
  let state = throwYoyo(initialState());
  let lastTick = now();

  return {
    getState: () => state,
    tick: () => {
      const tickedAt = now();
      state = advance(state, (tickedAt - lastTick) / 1_000);
      lastTick = tickedAt;
    },
  };
}
