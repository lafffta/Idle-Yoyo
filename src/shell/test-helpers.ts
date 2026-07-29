import {
  autoThrowerCost,
  buyAutoThrower,
  initialState,
  throwYoyo,
  type GameState,
} from "../core/simulation.js";
import { createGameStore, type GameStore } from "./store.js";

export function sleeperWithAutoThrower(): GameState {
  return throwYoyo(
    buyAutoThrower({ ...initialState(), style: autoThrowerCost() }),
  );
}

export function restoreAfterAbsence(state: GameState, seconds: number): GameStore {
  const savedAt = 1_000;
  const store = createGameStore({
    now: () => savedAt + seconds * 1_000,
    restored: { tickedAt: savedAt, state },
  });
  store.tick();
  return store;
}

export function completeThrowCycles(
  store: GameStore,
  advanceClock: (milliseconds: number) => void,
  cycles: number,
) {
  for (let completedCycles = 0; completedCycles < cycles; completedCycles++) {
    advanceClock(8_000);
    store.tick();
    if (completedCycles < cycles - 1) store.throwYoyo();
  }
}
