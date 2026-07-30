import {
  autoThrowerCost,
  buyAutoThrower,
  buyThrowPower,
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

/** A fresh Sleeper thrown with `throwPowerLevels` of Throw Power already bought and paid for. */
export function gearedFreshSleeper(throwPowerLevels: number): GameState {
  let state = { ...initialState(), style: 1e6 };
  for (let level = 0; level < throwPowerLevels; level++) state = buyThrowPower(state);
  return throwYoyo({ ...state, style: 0 });
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
