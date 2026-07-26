import { describe, expect, it } from "vitest";

import { advance, initialState, throwYoyo } from "./simulation.js";

/** A Sleeper in progress, one Throw old, with the provisional opening stats. */
function freshSleeper() {
  return throwYoyo(initialState());
}

describe("a Throw", () => {
  it("starts a Sleeper with Spin equal to the current Throw Power", () => {
    const sleeper = freshSleeper();

    expect(sleeper.phase).toBe("Sleeping");
    expect(sleeper.spin).toBe(100);
  });

  it("is refused while the yoyo is already spinning, leaving the Sleeper untouched", () => {
    const halfwayThrough = advance(freshSleeper(), 2.5);

    expect(throwYoyo(halfwayThrough)).toEqual(halfwayThrough);
  });

  it("is refused while the string is still winding back up, leaving the Rewind untouched", () => {
    const halfwayWound = advance(freshSleeper(), 6.5);

    expect(halfwayWound.phase).toBe("Rewinding");
    expect(throwYoyo(halfwayWound)).toEqual(halfwayWound);
  });

  it("starts a fresh Sleeper at full Throw Power once the yoyo is back in the hand", () => {
    const wound = advance(freshSleeper(), 8);

    const thrownAgain = throwYoyo(wound);

    expect(thrownAgain.phase).toBe("Sleeping");
    expect(thrownAgain.spin).toBe(100);
  });
});

describe("a Sleeper losing Spin", () => {
  it("loses Spin at a constant rate", () => {
    const oneSecondIn = advance(freshSleeper(), 1);
    const twoSecondsIn = advance(freshSleeper(), 2);

    expect(oneSecondIn.spin).toBeCloseTo(80, 10);
    expect(twoSecondsIn.spin).toBeCloseTo(60, 10);
  });

  it("reaches exactly zero Spin five seconds after the Throw", () => {
    const justAlive = advance(freshSleeper(), 4.999);
    const dead = advance(freshSleeper(), 5);

    expect(justAlive.phase).toBe("Sleeping");
    expect(justAlive.spin).toBeGreaterThan(0);
    expect(dead.spin).toBe(0);
    expect(dead.phase).not.toBe("Sleeping");
  });
});

describe("the Rewind after a Dead Yoyo", () => {
  it("winds the string back up rather than coming straight to rest in the hand", () => {
    const dead = advance(freshSleeper(), 5);

    expect(dead.phase).toBe("Rewinding");
  });

  it("comes to rest Ready three seconds after the yoyo died, and not before", () => {
    // The Sleeper is 5s, so the Throw Cycle turns over at 8s.
    const stillWinding = advance(freshSleeper(), 7.999);
    const wound = advance(freshSleeper(), 8);

    expect(stillWinding.phase).toBe("Rewinding");
    expect(wound.phase).toBe("Ready");
  });

  it("earns no Style while the string is winding back up", () => {
    const dead = advance(freshSleeper(), 5);
    const halfwayWound = advance(dead, 1.5);
    const wound = advance(dead, 3);

    expect(halfwayWound.style).toBeCloseTo(dead.style, 10);
    expect(wound.style).toBeCloseTo(dead.style, 10);
  });
});

describe("a yoyo waiting Ready in the hand", () => {
  it("earns nothing, however long it is left there", () => {
    const wound = advance(freshSleeper(), 8);

    const anHourLater = advance(wound, 3600);

    expect(anHourLater.phase).toBe("Ready");
    expect(anHourLater.style).toBeCloseTo(wound.style, 10);
  });

  it("waits indefinitely for a Throw that only the player can make", () => {
    // Nobody re-Throws it: an hour after a single Throw the yoyo is back in the hand with
    // only the one Sleeper's earnings. The Auto-Thrower that would change this is #9.
    const anHourLater = advance(freshSleeper(), 3600);

    expect(anHourLater.phase).toBe("Ready");
    expect(anHourLater.style).toBeCloseTo(2.5, 10);
  });
});

describe("throwing the yoyo over and over by hand", () => {
  it("repeats an identical Throw Cycle every eight seconds", () => {
    let state = freshSleeper();
    const yieldPerCycle: number[] = [];

    for (let cycle = 0; cycle < 4; cycle++) {
      const before = state.style;
      // A Throw Cycle is 5s of Sleeper and 3s of Rewind, after which the yoyo is Ready.
      state = advance(state, 8);
      expect(state.phase).toBe("Ready");
      yieldPerCycle.push(state.style - before);
      state = throwYoyo(state);
    }

    for (const earned of yieldPerCycle) expect(earned).toBeCloseTo(2.5, 10);
    expect(yieldPerCycle).toHaveLength(4);
  });
});

/**
 * Uneven chunks summing to `total`, from a seeded generator so the split is different from
 * a regular one but identical on every run.
 */
function unevenSplits(total: number, count: number): number[] {
  let seed = 20260726;
  const weights = Array.from({ length: count }, () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 + 0.01;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / sum) * total);
}

describe("a Sleeper earning Style", () => {
  it("earns in proportion to the Spin it still has", () => {
    // One second of a fresh Sleeper: Spin falls 100 → 80, so 0.01 × 90 Style.
    const oneSecondIn = advance(freshSleeper(), 1);

    expect(oneSecondIn.style).toBeCloseTo(0.9, 10);
  });

  it("earns fractionally, so a brief Sleeper is not rounded away to nothing", () => {
    const aTenthOfASecondIn = advance(freshSleeper(), 0.1);

    expect(aTenthOfASecondIn.style).toBeCloseTo(0.099, 10);
  });

  it("earns measurably faster at the start of a Sleeper than at the end", () => {
    const firstSecond = advance(freshSleeper(), 1).style;
    const beforeLastSecond = advance(freshSleeper(), 4);
    const lastSecond = advance(beforeLastSecond, 1).style - beforeLastSecond.style;

    expect(firstSecond).toBeCloseTo(0.9, 10);
    expect(lastSecond).toBeCloseTo(0.1, 10);
    expect(firstSecond).toBeGreaterThan(lastSecond);
  });

  it("yields 2.5 Style over a whole Sleeper, and nothing after the yoyo is dead", () => {
    const dead = advance(freshSleeper(), 5);
    const anHourLater = advance(dead, 3600);

    expect(dead.style).toBeCloseTo(2.5, 10);
    expect(anHourLater.style).toBeCloseTo(2.5, 10);
  });

  it("records everything earned as lifetime Style as well as spendable Style", () => {
    const dead = advance(freshSleeper(), 5);

    expect(dead.lifetimeStyle).toBeCloseTo(2.5, 10);
  });
});

describe("time away and time watching", () => {
  it("resolves twelve seconds the same in one call as in twelve one-second calls", () => {
    const inOneCall = advance(freshSleeper(), 12);

    let secondBySecond = freshSleeper();
    for (let i = 0; i < 12; i++) secondBySecond = advance(secondBySecond, 1);

    expect(secondBySecond.style).toBeCloseTo(inOneCall.style, 10);
    expect(secondBySecond.spin).toBeCloseTo(inOneCall.spin, 10);
    expect(secondBySecond.phase).toBe(inOneCall.phase);
  });

  it("resolves twelve seconds the same however unevenly it is split up", () => {
    const inOneCall = advance(freshSleeper(), 12);

    let inPieces = freshSleeper();
    for (const piece of unevenSplits(12, 500)) inPieces = advance(inPieces, piece);

    expect(inPieces.style).toBeCloseTo(inOneCall.style, 10);
    expect(inPieces.spin).toBeCloseTo(inOneCall.spin, 10);
    expect(inPieces.phase).toBe(inOneCall.phase);
  });

  /** A Sleeper ends at 5s and the Rewind completes at 8s, so both fall inside 10.5s. */
  it.each([
    { name: "landing mid-Rewind, having crossed the yoyo's death", spanning: 7.5 },
    { name: "landing at Ready, having crossed both boundaries", spanning: 10.5 },
  ])("agrees on $name however the time is split", ({ spanning }) => {
    const inOneCall = advance(freshSleeper(), spanning);

    let inPieces = freshSleeper();
    for (const piece of unevenSplits(spanning, 331)) inPieces = advance(inPieces, piece);

    let inHalfSeconds = freshSleeper();
    for (let i = 0; i < spanning * 2; i++) inHalfSeconds = advance(inHalfSeconds, 0.5);

    for (const split of [inPieces, inHalfSeconds]) {
      expect(split.style).toBeCloseTo(inOneCall.style, 10);
      expect(split.phase).toBe(inOneCall.phase);
      expect(split.phaseElapsed).toBeCloseTo(inOneCall.phaseElapsed, 10);
    }
  });

  it("resolves a day away without hanging", () => {
    const aDay = 24 * 60 * 60;

    const returned = advance(freshSleeper(), aDay);

    // Nothing re-Throws the yoyo yet, so a day away is worth the one Sleeper it owed.
    expect(returned.style).toBeCloseTo(2.5, 10);
  });
});

describe("the simulation as a pure function of its inputs", () => {
  it("gives the same state every time for the same inputs", () => {
    const sleeper = freshSleeper();

    expect(advance(sleeper, 3.7)).toEqual(advance(sleeper, 3.7));
  });

  it("leaves the state it was given untouched", () => {
    const sleeper = freshSleeper();
    const before = { ...sleeper };

    advance(sleeper, 3.7);

    expect(sleeper).toEqual(before);
  });

  it("carries a schema version from the very first save", () => {
    expect(initialState().version).toBe(1);
    expect(advance(freshSleeper(), 3.7).version).toBe(1);
  });
});

describe("a delta the device clock got wrong", () => {
  it("treats a negative delta as zero rather than running the simulation backwards", () => {
    const oneSecondIn = advance(freshSleeper(), 1);

    const clockCorrectedBackwards = advance(oneSecondIn, -3600);

    expect(clockCorrectedBackwards).toEqual(oneSecondIn);
  });

  it("treats a zero delta as a no-op", () => {
    const oneSecondIn = advance(freshSleeper(), 1);

    expect(advance(oneSecondIn, 0)).toEqual(oneSecondIn);
  });
});
