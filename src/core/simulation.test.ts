import { describe, expect, it } from "vitest";

import type { GameState } from "./simulation.js";
import {
  advance,
  bearingCost,
  buyBearing,
  buyRewindSpeed,
  buyThrowPower,
  initialState,
  rewindSpeedCost,
  throwPowerCost,
  throwYoyo,
} from "./simulation.js";

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

/** A yoyo at rest in the hand, with `style` Style saved up and nothing bought yet. */
function withStyle(style: number): GameState {
  return { ...initialState(), style };
}

/** One line of a shopping trip: a Gear purchase, and how many levels of it to buy. */
type Trolley = [buy: (state: GameState) => GameState, levels: number];

/**
 * A player who has been shopping, and has not thrown since.
 *
 * They start rich enough to afford every level asked for and end with nothing, so that the
 * Style their next Throw earns is measured up from zero. Sitting on the fortune instead would
 * lose it: a balance of 1e30 is far too coarse to add 2.5 Style to, and the earnings these
 * tests measure would round away to nothing.
 *
 * A refused purchase is a thrown error rather than a quietly shorter shopping list, because
 * the cost curves are steep enough to outrun any balance eventually — and a fixture that
 * silently bought fewer levels than it claims would weaken the test that depends on it
 * without ever going red.
 */
function afterShopping(...trolley: Trolley[]): GameState {
  let state = withStyle(1e30);

  for (const [buy, levels] of trolley) {
    for (let level = 1; level <= levels; level++) {
      const bought = buy(state);
      if (bought === state) throw new Error(`the player could not afford level ${level}`);
      state = bought;
    }
  }
  return { ...state, style: 0 };
}

/** A player who has saved up and bought `levels` of Throw Power, and not thrown since. */
function afterBuyingThrowPower(levels: number): GameState {
  return afterShopping([buyThrowPower, levels]);
}

/** A Sleeper `seconds` old, with Style saved up to spend while it is still on the string. */
function midSleeperWithStyle(seconds: number): GameState {
  return advance({ ...freshSleeper(), style: 100 }, seconds);
}

/**
 * The earliest moment after a Throw at which `reached` holds, to floating-point precision.
 *
 * Found by asking the simulation rather than by recomputing the timings from the constants:
 * a test that worked out when the yoyo ought to die would agree with a broken core that made
 * the same mistake. Bisection only ever looks at what a player can see — the phase the yoyo
 * is in after a given number of seconds.
 */
function secondsUntil(thrown: GameState, reached: (state: GameState) => boolean): number {
  let notYet = 0;
  let by = 1;
  while (!reached(advance(thrown, by))) {
    by *= 2;
    if (by > 2 ** 24) throw new Error("the yoyo never got there");
  }

  for (let halving = 0; halving < 60; halving++) {
    const midpoint = (notYet + by) / 2;
    if (reached(advance(thrown, midpoint))) by = midpoint;
    else notYet = midpoint;
  }
  return by;
}

/** How long the Sleeper lasts, from the Throw to the Dead Yoyo. */
function sleeperLength(atRest: GameState): number {
  return secondsUntil(throwYoyo(atRest), (state) => state.phase !== "Sleeping");
}

/** How long a whole Throw Cycle takes, from a Throw to the yoyo being back in the hand. */
function throwCycleLength(atRest: GameState): number {
  return secondsUntil(throwYoyo(atRest), (state) => state.phase === "Ready");
}

/** The fraction of a Throw Cycle the yoyo spends spinning rather than winding. */
function uptime(atRest: GameState): number {
  return sleeperLength(atRest) / throwCycleLength(atRest);
}

/** The Style one whole Sleeper earns, thrown from a yoyo at rest. */
function yieldOfOneThrow(state: GameState): number {
  const thrown = throwYoyo(state);
  // A whole Throw Cycle: the Sleeper plus a Rewind that earns nothing, so this is the
  // Sleeper's yield however long a better Bearing has made it.
  return advance(thrown, throwCycleLength(state)).style - thrown.style;
}

/**
 * Sustained Style for an attentive player who re-Throws the moment the yoyo is back in the
 * hand: Style per second averaged over a whole Throw Cycle.
 *
 * Measured by playing a cycle rather than read off the formula, so it cannot agree with a
 * core that has the formula wrong. #8 adds the figure as a readout derived from stats; this
 * stays the independent check on it.
 */
function measuredSustainedStyle(atRest: GameState): number {
  return yieldOfOneThrow(atRest) / throwCycleLength(atRest);
}

/** A player who has bought `levels` of the Bearing, and not thrown since. */
function afterBuyingBearing(levels: number): GameState {
  return afterShopping([buyBearing, levels]);
}

/** A player who has bought `levels` of Rewind Speed, and not thrown since. */
function afterBuyingRewindSpeed(levels: number): GameState {
  return afterShopping([buyRewindSpeed, levels]);
}

describe("buying Throw Power", () => {
  it("spends Style and makes the next Throw start with more Spin", () => {
    // The opening Throw Power level costs 10 Style, exactly. A Throw is worth 2.5, so four
    // Sleepers by hand pays for it and leaves nothing over.
    const saved = withStyle(10);

    const bought = buyThrowPower(saved);

    expect(bought.style).toBeCloseTo(0, 10);
    expect(throwYoyo(bought).spin).toBe(120);
  });

  it("costs more every level, so the tenth is not priced like the first", () => {
    // 10 Style, then ×1.15 per level owned: 10, 11.5, 13.225, and 35.1788 for the tenth.
    let state = withStyle(1000);
    const paid: number[] = [];

    for (let purchase = 0; purchase < 10; purchase++) {
      const before = state.style;
      state = buyThrowPower(state);
      paid.push(before - state.style);
    }

    expect(paid[0]).toBeCloseTo(10, 10);
    expect(paid[1]).toBeCloseTo(11.5, 10);
    expect(paid[2]).toBeCloseTo(13.225, 10);
    expect(paid[9]).toBeCloseTo(35.1788, 4);
  });

  it("quotes the price of the next level before the player commits to it", () => {
    const saved = withStyle(1000);

    expect(throwPowerCost(saved)).toBeCloseTo(10, 10);
    expect(throwPowerCost(buyThrowPower(saved))).toBeCloseTo(11.5, 10);
  });

  it("is refused when the player is a fraction short, leaving the state untouched", () => {
    const nearlyEnough = withStyle(9.999);

    expect(buyThrowPower(nearlyEnough)).toEqual(nearlyEnough);
  });

  it("goes through on exactly the asking price, at a level the price is not a round number", () => {
    // The second level costs 11.5: a player who saved precisely that is owed the purchase.
    const exactlyEnough = buyThrowPower(withStyle(10 + 11.5));

    const bought = buyThrowPower(exactlyEnough);

    expect(bought.style).toBeCloseTo(0, 10);
    expect(throwYoyo(bought).spin).toBe(140);
  });

  it("never runs the balance negative, however many times a broke player asks", () => {
    let broke = withStyle(10);

    for (let attempt = 0; attempt < 5; attempt++) broke = buyThrowPower(broke);

    // The first purchase clears the balance; the second level costs 11.5 and is refused.
    expect(broke.style).toBeCloseTo(0, 10);
    expect(throwYoyo(broke).spin).toBe(120);
  });

  it("pays twice over: a Throw twice as hard is worth four times as much", () => {
    // ADR 0001 chose linear decay for exactly this. A harder Throw earns faster *and* keeps
    // the yoyo alive longer, so yield goes with the square: 100 Spin is worth 2.5 Style,
    // 200 is worth 10, 300 is worth 22.5.
    expect(throwYoyo(afterBuyingThrowPower(5)).spin).toBe(200);
    expect(throwYoyo(afterBuyingThrowPower(10)).spin).toBe(300);

    expect(yieldOfOneThrow(afterBuyingThrowPower(0))).toBeCloseTo(2.5, 10);
    expect(yieldOfOneThrow(afterBuyingThrowPower(5))).toBeCloseTo(10, 10);
    expect(yieldOfOneThrow(afterBuyingThrowPower(10))).toBeCloseTo(22.5, 10);
  });

  it("leaves the Sleeper on the string playing out as the player saw it thrown", () => {
    const midSleeper = midSleeperWithStyle(1);

    const bought = buyThrowPower(midSleeper);

    // Same Spin, and the same four seconds of life and 1.6 Style still to come.
    expect(bought.spin).toBe(midSleeper.spin);
    expect(advance(bought, 4).style - bought.style).toBeCloseTo(1.6, 10);
    expect(advance(bought, 4).phase).toBe("Rewinding");
  });

  it("shows up on the next Throw, once the yoyo is back in the hand", () => {
    const midSleeper = midSleeperWithStyle(1);

    const wound = advance(buyThrowPower(midSleeper), 10);

    expect(throwYoyo(wound).spin).toBe(120);
  });

  it("is a purchase and not a tick: buying moves no time and earns nothing", () => {
    const midSleeper = midSleeperWithStyle(1.4);

    const bought = buyThrowPower(midSleeper);

    expect(bought.phase).toBe(midSleeper.phase);
    expect(bought.phaseElapsed).toBe(midSleeper.phaseElapsed);
    expect(bought.spin).toBe(midSleeper.spin);
    // Spending is not un-earning: the lifetime figure ADR 0005 will read never falls.
    expect(bought.lifetimeStyle).toBe(midSleeper.lifetimeStyle);
    expect(bought.style).toBeCloseTo(midSleeper.style - 10, 10);
  });

  it("survives a day away, and nothing in the game takes the level back", () => {
    const bought = buyThrowPower(withStyle(10));

    const aDayLater = advance(throwYoyo(bought), 24 * 60 * 60);

    expect(throwYoyo(aDayLater).spin).toBe(120);
  });
});

describe("buying the Bearing", () => {
  it("spends Style and keeps the yoyo alive longer, so the Throw is worth more", () => {
    // A level of the Bearing costs 25 Style and drains Spin 8% slower: 20 Spin/s becomes
    // 18.4, so 100 Spin lasts 5.4348s instead of 5 and yields k·S₀²/2D = 2.7174 Style.
    const saved = withStyle(25);

    const bought = buyBearing(saved);

    expect(bought.style).toBeCloseTo(0, 10);
    expect(sleeperLength(bought)).toBeCloseTo(5.434783, 5);
    expect(yieldOfOneThrow(bought)).toBeCloseTo(2.717391, 5);
    expect(sleeperLength(bought)).toBeGreaterThan(sleeperLength(saved));
  });

  it("costs more every level, so the tenth is not priced like the first", () => {
    // 25 Style, then ×1.18 per level owned: 25, 29.5, 34.81, and 110.886 for the tenth.
    let state = withStyle(10_000);
    const paid: number[] = [];

    for (let purchase = 0; purchase < 10; purchase++) {
      const before = state.style;
      state = buyBearing(state);
      paid.push(before - state.style);
    }

    expect(paid[0]).toBeCloseTo(25, 10);
    expect(paid[1]).toBeCloseTo(29.5, 10);
    expect(paid[2]).toBeCloseTo(34.81, 10);
    expect(paid[9]).toBeCloseTo(110.886, 3);
  });

  it("quotes the price of the next level before the player commits to it", () => {
    const saved = withStyle(10_000);

    expect(bearingCost(saved)).toBeCloseTo(25, 10);
    expect(bearingCost(buyBearing(saved))).toBeCloseTo(29.5, 10);
  });

  it("is refused when the player is a fraction short, leaving the state untouched", () => {
    const nearlyEnough = withStyle(24.999);

    expect(buyBearing(nearlyEnough)).toEqual(nearlyEnough);
  });

  it("goes through on exactly the asking price, at a level the price is not a round number", () => {
    // The second level costs 29.5: a player who saved precisely 25 + 29.5 is owed both.
    const exactlyEnough = buyBearing(withStyle(54.5));

    const bought = buyBearing(exactlyEnough);

    expect(bought.style).toBeCloseTo(0, 10);
    // Two levels drain Spin at 0.92² of the base rate — 16.928/s — so 100 Spin lasts 5.9073s.
    expect(sleeperLength(bought)).toBeCloseTo(5.907372, 5);
  });

  it("never runs the balance negative, however many times a broke player asks", () => {
    let broke = withStyle(25);

    for (let attempt = 0; attempt < 5; attempt++) broke = buyBearing(broke);

    // The first purchase clears the balance; the second level costs 29.5 and is refused, so
    // the yoyo is left with exactly one level's worth of a slower drain.
    expect(broke.style).toBeCloseTo(0, 10);
    expect(sleeperLength(broke)).toBeCloseTo(5.434783, 5);
  });

  it("keeps paying: nine levels roughly double both the Sleeper and what it earns", () => {
    // Nine levels drain Spin at 0.92⁹ = 0.47216 of the base rate — 9.44323 Spin/s — so the
    // same 100 Spin lasts 10.5896s and earns 5.2948 Style. Life and yield both go as 1/D.
    const wellBought = afterBuyingBearing(9);

    expect(sleeperLength(wellBought)).toBeCloseTo(10.5896, 4);
    expect(yieldOfOneThrow(wellBought)).toBeCloseTo(5.2948, 4);
  });

  it("slows the Sleeper on the string without rewriting what it has already banked", () => {
    // A second into a Sleeper the yoyo has 80 Spin and 0.9 Style banked. The Bearing is
    // derived from the level rather than snapshotted at the Throw (ADR 0008), so it slows
    // the yoyo in hand — but it does not un-earn the 0.9 or alter the Spin still on the
    // string. The remaining 80 Spin now drains at 18.4/s: 4.3478s and 1.7391 Style to come.
    const midSleeper = midSleeperWithStyle(1);

    const bought = buyBearing(midSleeper);

    expect(bought.spin).toBe(midSleeper.spin);
    expect(bought.lifetimeStyle).toBe(midSleeper.lifetimeStyle);
    expect(bought.style).toBeCloseTo(midSleeper.style - 25, 10);
    expect(advance(bought, 4.3478).style - bought.style).toBeCloseTo(1.7391, 4);
    expect(advance(bought, 4.3479).phase).toBe("Rewinding");
  });

  it("is a purchase and not a tick: buying moves no time and earns nothing", () => {
    const midSleeper = midSleeperWithStyle(1.4);

    const bought = buyBearing(midSleeper);

    expect(bought.phase).toBe(midSleeper.phase);
    expect(bought.phaseElapsed).toBe(midSleeper.phaseElapsed);
    expect(bought.lifetimeStyle).toBe(midSleeper.lifetimeStyle);
  });
});

describe("buying Rewind Speed", () => {
  it("spends Style and winds the string back up sooner, so less of the cycle is dead", () => {
    // A level of Rewind Speed costs 15 Style and winds 10% faster: a 3s Rewind becomes 2.7s,
    // so the Throw Cycle is 7.7s rather than 8 and Uptime rises from 62.5% to 64.9%.
    const saved = withStyle(15);

    const bought = buyRewindSpeed(saved);

    expect(bought.style).toBeCloseTo(0, 10);
    expect(throwCycleLength(bought)).toBeCloseTo(7.7, 6);
    expect(uptime(saved)).toBeCloseTo(0.625, 6);
    expect(uptime(bought)).toBeCloseTo(0.649351, 5);
  });

  it("finishes a Rewind it has already outlasted at once, without the clock jumping", () => {
    // 2.9s into a 3s Rewind, one level of Rewind Speed makes the Rewind 2.7s — a Rewind the
    // string has already spent longer on than it now takes. It ends immediately, and the
    // 0.2s of overshoot is not handed back as extra time: half a second given is half a
    // second passed. Left uncorrected that surplus becomes minted Style the moment an
    // Auto-Thrower re-Throws into it.
    const midRewind = advance({ ...freshSleeper(), style: 1000 }, 7.9);
    expect(midRewind.phase).toBe("Rewinding");

    const afterHalfASecond = advance(buyRewindSpeed(midRewind), 0.5);

    expect(afterHalfASecond.phase).toBe("Ready");
    expect(afterHalfASecond.phaseElapsed).toBeCloseTo(0.5, 10);
  });

  it("leaves the Sleeper alone: it is dead time it buys back, not spinning time", () => {
    const saved = withStyle(15);

    expect(sleeperLength(buyRewindSpeed(saved))).toBeCloseTo(sleeperLength(saved), 6);
    expect(yieldOfOneThrow(buyRewindSpeed(saved))).toBeCloseTo(yieldOfOneThrow(saved), 10);
  });

  it("costs more every level, so the tenth is not priced like the first", () => {
    // 15 Style, then ×1.18 per level owned: 15, 17.7, 20.886, and 66.5318 for the tenth.
    let state = withStyle(10_000);
    const paid: number[] = [];

    for (let purchase = 0; purchase < 10; purchase++) {
      const before = state.style;
      state = buyRewindSpeed(state);
      paid.push(before - state.style);
    }

    expect(paid[0]).toBeCloseTo(15, 10);
    expect(paid[1]).toBeCloseTo(17.7, 10);
    expect(paid[2]).toBeCloseTo(20.886, 10);
    expect(paid[9]).toBeCloseTo(66.5318, 4);
  });

  it("quotes the price of the next level before the player commits to it", () => {
    const saved = withStyle(10_000);

    expect(rewindSpeedCost(saved)).toBeCloseTo(15, 10);
    expect(rewindSpeedCost(buyRewindSpeed(saved))).toBeCloseTo(17.7, 10);
  });

  it("is refused when the player is a fraction short, leaving the state untouched", () => {
    const nearlyEnough = withStyle(14.999);

    expect(buyRewindSpeed(nearlyEnough)).toEqual(nearlyEnough);
  });

  it("goes through on exactly the asking price, at a level the price is not a round number", () => {
    // The second level costs 17.7: a player who saved precisely 15 + 17.7 is owed both.
    const exactlyEnough = buyRewindSpeed(withStyle(32.7));

    const bought = buyRewindSpeed(exactlyEnough);

    expect(bought.style).toBeCloseTo(0, 10);
    // Two levels wind in 3 × 0.9² = 2.43s, so the Throw Cycle is 5 + 2.43.
    expect(throwCycleLength(bought)).toBeCloseTo(7.43, 6);
  });

  it("never runs the balance negative, however many times a broke player asks", () => {
    let broke = withStyle(15);

    for (let attempt = 0; attempt < 5; attempt++) broke = buyRewindSpeed(broke);

    // The first purchase clears the balance; the second level costs 17.7 and is refused.
    expect(broke.style).toBeCloseTo(0, 10);
    expect(throwCycleLength(broke)).toBeCloseTo(7.7, 6);
  });

  it("is a purchase and not a tick: buying moves no time and earns nothing", () => {
    const midRewind = advance({ ...freshSleeper(), style: 100 }, 6);

    const bought = buyRewindSpeed(midRewind);

    expect(bought.phase).toBe(midRewind.phase);
    expect(bought.phaseElapsed).toBe(midRewind.phaseElapsed);
    expect(bought.lifetimeStyle).toBe(midRewind.lifetimeStyle);
    expect(bought.style).toBeCloseTo(midRewind.style - 15, 10);
  });
});

describe("the floor under the Rewind", () => {
  it("stops shortening the Rewind once it reaches the floor, however much is bought", () => {
    // The figures here follow the provisional floor of 0.25s and move if it is retuned; the
    // guard below is written to survive that, but these three are deliberately concrete.
    // 3s × 0.9 per level crosses the floor at the twenty-fourth level. From there the Throw
    // Cycle is the 5s Sleeper plus the floor, and no further purchase moves it.
    expect(throwCycleLength(afterBuyingRewindSpeed(24))).toBeCloseTo(5.25, 6);
    expect(throwCycleLength(afterBuyingRewindSpeed(100))).toBeCloseTo(5.25, 6);
    expect(throwCycleLength(afterBuyingRewindSpeed(200))).toBeCloseTo(5.25, 6);
  });

  it("does not clamp a Rewind that is still above the floor", () => {
    // The twenty-third level leaves a Rewind of 3 × 0.9²³ = 0.2659s, which is above the
    // floor and must be left alone: a floor that rounded early would be a silent price rise.
    expect(throwCycleLength(afterBuyingRewindSpeed(23))).toBeCloseTo(5.265888, 5);
  });

  it("never lets the Rewind reach zero, so the yoyo is never in two places at once", () => {
    for (const levels of [24, 60, 200]) {
      expect(throwCycleLength(afterBuyingRewindSpeed(levels))).toBeGreaterThan(
        sleeperLength(afterBuyingRewindSpeed(levels)),
      );
    }
  });
});

/**
 * **Regression guard for ADR 0003. This test exists to fail if the Rewind floor is removed.**
 *
 * The floor looks like an arbitrary constant, and it is not. Sustained earnings are
 * `(k·S₀/2) × S₀/(S₀ + R·D)`. Send `R` to zero and the whole right-hand factor goes to 1: the
 * decay rate `D` disappears from the expression, and the Bearing — a shop row the player goes
 * on paying an ever-steeper price for — stops doing anything whatsoever. Not "less". Nothing.
 *
 * So the floor is what keeps the Bearing a real purchase at the bottom of Rewind Speed's
 * range, and this test is the thing standing between it and a future tidy-up. If you have
 * arrived here because you deleted `rewindFloor` and this went red: that is the test working.
 * Read ADR 0003 rather than adjusting the numbers below.
 */
describe("the Bearing at the very bottom of Rewind Speed's range", () => {
  /**
   * A player who has bought Rewind Speed so far past the floor that nothing but the floor is
   * holding the Rewind up, plus `levels` of the Bearing.
   *
   * Three hundred levels is deliberately absurd, and the absurdity is the point: 3 × 0.9³⁰⁰
   * is 6e-14, so without the floor this player's Rewind would not be merely short but
   * arithmetically zero. That makes the guard below a test of the mechanism rather than of a
   * threshold — it stays red however the floor's value is retuned, and goes red the moment
   * the floor stops existing.
   */
  function atTheRewindFloor(levels: number): GameState {
    return afterShopping([buyRewindSpeed, 300], [buyBearing, levels]);
  }

  it("still earns more when the Bearing is bought, which a Rewind of zero would not", () => {
    // At the 0.25s floor, nine levels of Bearing take Sustained Style from 0.5 × 100/105 to
    // 0.5 × 100/102.36081 — a gain of 2.6%. Were the Rewind zero, both figures would be
    // exactly 0.5 and the gain would be nothing at all, which is what this is here to catch.
    // The ratio is asserted first because it is the claim: the absolute figures below move
    // with the provisional constants, but the Bearing has to keep paying whatever they are.
    const beforeTheBearing = measuredSustainedStyle(atTheRewindFloor(0));
    const afterTheBearing = measuredSustainedStyle(atTheRewindFloor(9));

    expect(afterTheBearing / beforeTheBearing - 1).toBeGreaterThan(0.01);
    expect(beforeTheBearing).toBeCloseTo(0.476190, 5);
    expect(afterTheBearing).toBeCloseTo(0.488468, 5);
  });

  it("keeps earning more for every further Bearing bought at the floor", () => {
    // One purchase working is not enough: the row has to stay alive all the way down.
    const sustained = [0, 5, 10, 20, 40].map((levels) => {
      return measuredSustainedStyle(atTheRewindFloor(levels));
    });

    for (const [index, figure] of sustained.entries()) {
      if (index > 0) expect(figure).toBeGreaterThan(sustained[index - 1] as number);
    }
  });

  it("stays under the ceiling Throw Power sets, however good the Bearing gets", () => {
    // The Bearing buys Uptime, and Uptime is a fraction: it can approach `k·S₀/2` = 0.5 for
    // an opening Throw but never pass it. Only Throw Power raises that ceiling. Forty levels
    // drain Spin at 0.712/s, so the Sleeper runs 140s against a quarter-second Rewind.
    expect(measuredSustainedStyle(atTheRewindFloor(40))).toBeLessThan(0.5);
    expect(measuredSustainedStyle(atTheRewindFloor(40))).toBeGreaterThan(0.499);
  });
});

describe("Uptime as it saturates", () => {
  it("pays less for each level of Rewind Speed than for the one before", () => {
    // ADR 0003: the Uptime axis retires itself gracefully, so nothing needs to cap it.
    const gains = Array.from({ length: 8 }, (_, level) => {
      return uptime(afterBuyingRewindSpeed(level + 1)) - uptime(afterBuyingRewindSpeed(level));
    });

    expect(uptime(afterBuyingRewindSpeed(0))).toBeCloseTo(0.625, 6);
    for (const [index, gain] of gains.entries()) {
      expect(gain).toBeGreaterThan(0);
      if (index > 0) expect(gain).toBeLessThan(gains[index - 1] as number);
    }
  });

  it("comes arbitrarily close to a whole Throw Cycle spinning without ever reaching it", () => {
    // A hard Throw at the Rewind floor: 500 Spin lasts 25s against a quarter-second Rewind.
    const state = afterShopping([buyRewindSpeed, 24], [buyThrowPower, 20]);

    expect(uptime(state)).toBeGreaterThan(0.99);
    expect(uptime(state)).toBeLessThan(1);
  });
});

/**
 * ADR 0008 makes `GameState` the save-compatibility surface, and says effective stats are
 * derived rather than stored: were effective Throw Power written into a save, changing the
 * step size or the base Throw Power in a rebalance would leave every existing save
 * disagreeing with the constants it was built from.
 *
 * That is a claim about the shape of a save rather than about anything a player can see, so
 * it needs an assertion of the kind the rest of this file avoids — as with the clock guard
 * in `core-is-pure.test.ts`, the rule is invisible to behavioural tests, since a stored stat
 * and a derived one agree right up until the rebalance. It is deliberately brittle: a field
 * added here is a migration to think about, and this test is where that thought is asked
 * for.
 */
describe("the shape a save has to carry", () => {
  it("keeps the Gear level and not the Spin it buys", () => {
    const played = advance(throwYoyo(buyThrowPower(withStyle(10))), 2);

    expect(Object.keys(played).sort()).toEqual([
      "bearingLevel",
      "lifetimeStyle",
      "phase",
      "phaseElapsed",
      "rewindSpeedLevel",
      "spin",
      "style",
      "throwPowerLevel",
      "version",
    ]);
  });
});
