import type { GameStore } from "./store.js";

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
