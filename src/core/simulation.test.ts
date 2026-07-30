import { describe, expect, it } from "vitest";

import type { GameState } from "./simulation.js";
import {
  activeAttempt,
  advance,
  attemptTrick,
  autoThrowerCost,
  bearingCost,
  buyAutoThrower,
  buyBearing,
  buyRewindSpeed,
  buyThrowPower,
  currentStyleRate,
  initialState,
  nextTrick,
  previewAttempt,
  projectedYield,
  rewindSpeedCost,
  sustainedStyle,
  throwPowerCost,
  throwYoyo,
  TRICKS_1A,
} from "./simulation.js";

/** A Sleeper in progress, one Throw old, with the provisional opening stats. */
function freshSleeper() {
  return throwYoyo(initialState());
}

/** The same Sleeper with an Auto-Thrower owned, so the cycle turns without a player. */
function automaticSleeper(): GameState {
  return throwYoyo(buyAutoThrower(withStyle(autoThrowerCost())));
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
    // Nobody re-Throws it: an hour after a single Throw the yoyo is back in the hand with only
    // the one Sleeper's earnings. Buying an Auto-Thrower is what changes this, and until the
    // player does, the pre-idle stretch is what teaches them the model (ADR 0002).
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

    // Nothing re-Throws this yoyo, so a day away is worth the one Sleeper it owed.
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
    expect(initialState().version).toBe(3);
    expect(advance(freshSleeper(), 3.7).version).toBe(3);
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

/**
 * The Style a Sleeper already on the string goes on to bank between here and the Dead Yoyo,
 * measured by playing it out.
 *
 * The sibling of `yieldOfOneThrow`, and deliberately not the same measurement: that one starts
 * from a yoyo at rest and measures a whole Throw, this one starts wherever the Sleeper has got
 * to. A Rewinding or Ready yoyo earns nothing, so overshooting the death costs nothing and this
 * needs no notion of when the yoyo is due to die.
 */
function styleEarnedBeforeDying(state: GameState): number {
  return advance(state, 10_000).style - state.style;
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

  it("leaves the Sleeper on the string alone and applies from the next Throw", () => {
    // A second into a Sleeper the yoyo has 80 Spin, four seconds of life and 1.6 Style left.
    // Buying a Bearing moves the owned level immediately, but the active Throw keeps the
    // Bearing it began with. Once wound, the next Throw uses the newly owned level.
    const midSleeper = midSleeperWithStyle(1);

    const bought = buyBearing(midSleeper);

    expect(bought.spin).toBe(midSleeper.spin);
    expect(bought.lifetimeStyle).toBe(midSleeper.lifetimeStyle);
    expect(bought.style).toBeCloseTo(midSleeper.style - 25, 10);
    expect(advance(bought, 4).style - bought.style).toBeCloseTo(1.6, 10);
    expect(advance(bought, 4).phase).toBe("Rewinding");

    const wound = advance(bought, 7);
    expect(wound.phase).toBe("Ready");
    expect(sleeperLength(wound)).toBeCloseTo(5.434783, 5);
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

  it("leaves the current Rewind alone and shortens the next Throw Cycle", () => {
    // 2.9s into a 3s Rewind, one level of Rewind Speed would make a new Rewind 2.7s. The
    // string already winding still gets its last 0.1s; the next Throw owns the shorter Rewind.
    const midRewind = advance({ ...freshSleeper(), style: 1000 }, 7.9);
    expect(midRewind.phase).toBe("Rewinding");

    const bought = buyRewindSpeed(midRewind);

    expect(advance(bought, 0.05).phase).toBe("Rewinding");
    const wound = advance(bought, 0.1);
    expect(wound.phase).toBe("Ready");
    expect(throwCycleLength(wound)).toBeCloseTo(7.7, 6);
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

describe("buying the Auto-Thrower", () => {
  it("spends Style and leaves the player owning the Auto-Thrower", () => {
    const saved = withStyle(autoThrowerCost());

    const bought = buyAutoThrower(saved);

    expect(bought.style).toBeCloseTo(0, 10);
    expect(bought.hasAutoThrower).toBe(true);
  });

  it("quotes its price before the player commits to it", () => {
    expect(autoThrowerCost()).toBeCloseTo(250, 10);
  });

  it("is refused when the player is a fraction short, leaving the state untouched", () => {
    const nearlyEnough = withStyle(autoThrowerCost() - 0.01);

    expect(buyAutoThrower(nearlyEnough)).toEqual(nearlyEnough);
  });

  /**
   * The Auto-Thrower is Kit, and Kit is owned rather than levelled: there is no second one to
   * buy and no rising price to quote for it. A player who clicks twice has spent the price once,
   * not twice.
   */
  it("is bought once and not again, however many times a rich player asks", () => {
    const deepPockets = 20 * autoThrowerCost();
    let state = withStyle(deepPockets);

    for (let click = 0; click < 5; click++) state = buyAutoThrower(state);

    expect(state.hasAutoThrower).toBe(true);
    expect(state.style).toBeCloseTo(deepPockets - autoThrowerCost(), 10);
  });

  it("survives a day of running, and nothing in the game takes it back", () => {
    const bought = buyAutoThrower(withStyle(autoThrowerCost()));

    const aDayLater = advance(throwYoyo(bought), 24 * 60 * 60);

    expect(aDayLater.hasAutoThrower).toBe(true);
  });

  /**
   * The Auto-Thrower waits out the same Rewind a player does, so it earns an attentive player
   * nothing at all — it buys absence, not speed. The spec flags this as something the shop will
   * have to communicate differently, since Sustained Style is the figure every other purchase is
   * read through and this one does not touch it. Pinned here so the shop's problem stays a shop
   * problem: a core that quietly sped the machine up would make the readout lie about a player
   * sitting and watching.
   */
  it("does not move Sustained Style, which is what makes it a shop problem", () => {
    const saved = withStyle(autoThrowerCost());

    expect(sustainedStyle(buyAutoThrower(saved))).toBe(sustainedStyle(saved));
  });

  it("is a purchase and not a tick: buying moves no time and earns nothing", () => {
    const midSleeper = advance({ ...freshSleeper(), style: autoThrowerCost() }, 2);

    const bought = buyAutoThrower(midSleeper);

    expect(bought.phase).toBe("Sleeping");
    expect(bought.spin).toBeCloseTo(midSleeper.spin, 10);
    expect(bought.phaseElapsed).toBeCloseTo(midSleeper.phaseElapsed, 10);
    expect(bought.style).toBeCloseTo(midSleeper.style - autoThrowerCost(), 10);
    expect(bought.lifetimeStyle).toBeCloseTo(midSleeper.lifetimeStyle, 10);
  });
});

describe("the Auto-Thrower keeping the loop turning", () => {
  it("throws again the instant the string is wound, spending no time at Ready", () => {
    // The Throw Cycle turns over at 8s: the yoyo is found spinning again at that exact moment,
    // not waiting in the hand for a Throw nobody is there to make. Walked cycle by cycle,
    // landing on the boundary every time, since the moment the string finishes winding is the
    // only moment at which a machine that re-Threw a fraction late would show.
    let state = automaticSleeper();

    for (let cycle = 0; cycle < 20; cycle++) {
      state = advance(state, 8);

      expect(state.phase).toBe("Sleeping");
      expect(state.spin).toBeCloseTo(100, 10);
      expect(state.phaseElapsed).toBeCloseTo(0, 10);
    }
  });

  it("is never found waiting in the hand, at any moment of any cycle", () => {
    let state = automaticSleeper();

    for (let step = 0; step < 400; step++) {
      state = advance(state, 0.1);
      expect(state.phase).not.toBe("Ready");
    }
  });

  it("keeps the cycle turning with no manual Throw, five cycles running", () => {
    // Five whole Throw Cycles at 2.5 Style each, and nobody touched it.
    const fortySecondsOn = advance(automaticSleeper(), 40);

    expect(fortySecondsOn.style).toBeCloseTo(12.5, 10);
  });

  it("still winds the string first, earning nothing during the Rewind it waits out", () => {
    // The Auto-Thrower buys absence, not speed: it waits out the same Rewind a player does, so
    // a cycle is worth no more to it than to somebody watching.
    const midRewind = advance(automaticSleeper(), 6.5);
    const laterInTheSameRewind = advance(midRewind, 1);

    expect(midRewind.phase).toBe("Rewinding");
    expect(laterInTheSameRewind.phase).toBe("Rewinding");
    expect(laterInTheSameRewind.style).toBeCloseTo(midRewind.style, 10);
  });

  it("captures Gear bought mid-cycle when it re-Throws inside one advance", () => {
    const oneSecondIn = advance({ ...automaticSleeper(), style: 1_000 }, 1);
    const bought = buyBearing(oneSecondIn);

    // The current opening Throw still takes its original remaining 4s plus 3s Rewind. At that
    // internal boundary the machine re-Throws and captures the Bearing bought while it slept.
    const nextThrow = advance(bought, 7);
    expect(nextThrow.phase).toBe("Sleeping");
    expect(nextThrow.spin).toBeCloseTo(100, 10);
    expect(nextThrow.activeThrowGear.bearingLevel).toBe(1);

    // Five seconds would kill an opening Sleeper; the newly captured Bearing leaves Spin.
    expect(advance(nextThrow, 5).phase).toBe("Sleeping");
  });

  it("throws at the Throw Power the player owns, not the one they had when they bought it", () => {
    const owned = buyAutoThrower(withStyle(autoThrowerCost()));
    const stronger = { ...buyThrowPower({ ...owned, style: 10 }), style: 0 };

    // One whole cycle on: 120 Spin lasts 6s, so at 7s the string is still winding.
    const nextThrow = advance(throwYoyo(stronger), 6 + 3);

    expect(nextThrow.phase).toBe("Sleeping");
    expect(nextThrow.spin).toBeCloseTo(120, 10);
  });

  it("starts throwing the moment it is bought, with the yoyo already back in the hand", () => {
    const inTheHand = advance(throwYoyo(withStyle(autoThrowerCost())), 8);
    expect(inTheHand.phase).toBe("Ready");

    const bought = advance(buyAutoThrower(inTheHand), 1);

    expect(bought.phase).toBe("Sleeping");
    expect(bought.spin).toBeCloseTo(80, 10);
  });
});

/** A player who has been shopping, owns an Auto-Thrower, and has just thrown. */
function automaticAfterShopping(...trolley: Trolley[]): GameState {
  const shopped = afterShopping(...trolley);
  return throwYoyo(buyAutoThrower({ ...shopped, style: autoThrowerCost() }));
}

const EIGHT_HOURS = 8 * 60 * 60;

/**
 * Time away, which ADR 0002 insists is not a thing the core knows about: an absence is the
 * ordinary simulation run forward, so these tests are the same `advance` every frame calls,
 * handed a bigger number.
 */
describe("coming back from eight hours away with an Auto-Thrower", () => {
  it("is worth Sustained Style for every second of it", () => {
    const returned = advance(automaticSleeper(), EIGHT_HOURS);

    // 0.3125 Style a second across 28,800 of them, worked out by hand in the spec, and 3,600
    // whole Throw Cycles that the machine turned over unattended.
    expect(returned.style).toBeCloseTo(9000, 6);
    expect(returned.style).toBeCloseTo(sustainedStyle(returned) * EIGHT_HOURS, 6);
    expect(returned.lifetimeStyle).toBeCloseTo(9000, 6);
  });

  it("is worth Sustained Style for every second of it under any Gear", () => {
    const shoppingTrips: Trolley[][] = [
      [[buyThrowPower, 6]],
      [[buyBearing, 5]],
      [[buyRewindSpeed, 7]],
      [
        [buyThrowPower, 9],
        [buyBearing, 4],
        [buyRewindSpeed, 3],
      ],
      // At the Rewind floor, where the cycle is at its shortest and there are most of them.
      [
        [buyRewindSpeed, 30],
        [buyThrowPower, 12],
      ],
    ];

    for (const trolley of shoppingTrips) {
      const returned = advance(automaticAfterShopping(...trolley), EIGHT_HOURS);
      const expected = sustainedStyle(returned) * EIGHT_HOURS;
      // Measured on a player with the same Gear throwing by hand, since the cycle-length
      // helpers wait for a yoyo back in the hand and an Auto-Thrower never leaves one there.
      const oneThrow = yieldOfOneThrow(afterShopping(...trolley));

      // Eight hours is not a whole number of Throw Cycles under most Gear, so the player comes
      // back mid-cycle with part of one still on the string. That partial cycle is the whole of
      // the difference: nothing else may go missing over 28,800 seconds.
      expect(returned.style).toBeLessThan(expected + oneThrow);
      // Never behind the average, either. An absence that opens with a Throw collects the
      // Sleeper before waiting out the Rewind that pays for it, so an unfinished cycle can only
      // leave the player ahead.
      expect(returned.style).toBeGreaterThanOrEqual(expected);
    }
  });

  /**
   * ADR 0002's central promise, as an assertion: the rules while the player is away are the
   * rules they already learned. There is no offline multiplier and no offline branch to carry
   * one, so an absence resolved in a single call cannot come out ahead of — or behind — the
   * same period watched a second at a time.
   */
  it("resolves the same in one call as in twenty-eight thousand", () => {
    const inOneCall = advance(automaticSleeper(), EIGHT_HOURS);

    let secondBySecond = automaticSleeper();
    for (let second = 0; second < EIGHT_HOURS; second++) {
      secondBySecond = advance(secondBySecond, 1);
    }

    expect(secondBySecond.phase).toBe(inOneCall.phase);
    expect(secondBySecond.style).toBeCloseTo(inOneCall.style, 6);
    expect(secondBySecond.spin).toBeCloseTo(inOneCall.spin, 6);
    expect(secondBySecond.phaseElapsed).toBeCloseTo(inOneCall.phaseElapsed, 6);
  });

  /**
   * Deliberately not a whole number of Throw Cycles. Eight hours to the second is exactly 3,600
   * of them, and a split into five thousand uneven pieces sums to 28,800 only to within
   * floating-point error — so it lands a fraction of a nanosecond short of a boundary the single
   * call lands exactly on, and reads a winding string where the other has already re-Thrown. The
   * earnings agree regardless, which is the claim; where the yoyo is at a boundary crossed in
   * one case and not quite in the other is the one question a split like this cannot be asked.
   */
  it("resolves the same however unevenly the time is split up", () => {
    const spanning = EIGHT_HOURS + 1.7;
    const inOneCall = advance(automaticSleeper(), spanning);

    let inPieces = automaticSleeper();
    for (const piece of unevenSplits(spanning, 5000)) inPieces = advance(inPieces, piece);

    expect(inPieces.phase).toBe(inOneCall.phase);
    expect(inPieces.style).toBeCloseTo(inOneCall.style, 6);
    expect(inPieces.spin).toBeCloseTo(inOneCall.spin, 6);
    expect(inPieces.phaseElapsed).toBeCloseTo(inOneCall.phaseElapsed, 6);
  });

  it("earns no more for having been away than for having been watched", () => {
    // The same eight hours, one played out in frame-sized steps by a player who never looked
    // away. ADR 0002 rejects the genre's reduced offline rate in both directions: no bonus and
    // no penalty, so these are the same number rather than merely close.
    const away = advance(automaticSleeper(), EIGHT_HOURS);

    let watched = automaticSleeper();
    for (let frame = 0; frame < EIGHT_HOURS * 60; frame++) watched = advance(watched, 1 / 60);

    expect(watched.style).toBeCloseTo(away.style, 6);
  });

  /**
   * A month is 324,000 Throw Cycles, and segment-based integration costs one step each — a few
   * hundred thousand, which resolves in about a tenth of a second. The timeout is the assertion
   * here, generous enough not to be a benchmark and tight enough to catch the regression it
   * exists for: a fixed-step integrator would take a step per tick instead, and 2.6 million
   * seconds of ticks would take long enough to freeze the tab a player reopened.
   */
  it(
    "resolves a month away promptly rather than hanging",
    () => {
      const aMonth = 30 * 24 * 60 * 60;

      const returned = advance(automaticSleeper(), aMonth);

      expect(returned.style).toBeCloseTo(sustainedStyle(returned) * aMonth, 4);
    },
    2_000,
  );

  it("mints nothing from a device clock that corrected backwards", () => {
    const running = advance(automaticSleeper(), 20);

    const clockCorrectedBackwards = advance(running, -EIGHT_HOURS);

    expect(clockCorrectedBackwards).toEqual(running);
  });
});

describe("coming back from eight hours away without an Auto-Thrower", () => {
  it("is worth the Sleeper that was in progress and nothing after it", () => {
    // Two seconds into a Sleeper when the tab closed: the yoyo died three seconds later,
    // whether or not anyone was watching, and has been in the hand ever since.
    const leftMidSleeper = advance(freshSleeper(), 2);
    const earnedSoFar = leftMidSleeper.style;

    const returned = advance(leftMidSleeper, EIGHT_HOURS);

    expect(returned.phase).toBe("Ready");
    expect(earnedSoFar).toBeCloseTo(1.6, 10);
    expect(returned.style).toBeCloseTo(2.5, 10);
  });

  it("is worth nothing at all when the yoyo was already back in the hand", () => {
    const inTheHand = advance(freshSleeper(), 8);

    const returned = advance(inTheHand, EIGHT_HOURS);

    expect(returned.phase).toBe("Ready");
    expect(returned.style).toBeCloseTo(inTheHand.style, 10);
  });
});

/**
 * ADR 0004: a Trick is learned actively and earns passively. The Attempt is the only thing the
 * game ever asks the player to do with their hands, and it is a decision rather than a purchase
 * — no price, no dice, and a consequence known in full before it is taken.
 *
 * Rock the Baby is the first row of 1A and the tutorial for the whole mechanic, so what these
 * assert is mostly that it is reachable at all: the plan asks for it to land on the opening
 * Throw, from a yoyo with nothing bought.
 */
describe("Attempting a Trick", () => {
  it("lands Rock the Baby on the opening Throw of a yoyo with no Gear at all", () => {
    const landed = advance(attemptTrick(freshSleeper()), 1.5);

    expect(landed.landedTricks).toEqual(["rock-the-baby"]);
    expect(landed.phase).toBe("Sleeping");
    expect(landed.attempt).toBe(null);
  });

  /**
   * The margin, rather than the landing — a Trick that lands only when Attempted in the first
   * instant of a Sleeper is not the "nearly free to reach" first Attempt ADR 0004 asks for, and
   * it would be a tutorial most players failed by hesitating.
   *
   * This is what makes Rock the Baby's provisional drain multiplier the one figure on the ladder
   * checked against anything, and it is a claim about the constants as they stand: at 45 Spin of
   * an opening Throw's 100, more than half the Sleeper is safe. #71 carries the same guarantee
   * to the tuning harness, where the whole ladder is measured.
   */
  it("lands from anywhere in the first half of that Sleeper, not only from its first instant", () => {
    for (const attemptedAt of [0, 0.5, 1.5, 2.5]) {
      const landed = advance(attemptTrick(advance(freshSleeper(), attemptedAt)), 1.5);

      expect(landed.landedTricks).toEqual(["rock-the-baby"]);
    }
  });

  it("goes on earning Style throughout, rather than pausing the Sleeper to perform", () => {
    const attempting = attemptTrick(freshSleeper());

    const halfwayThrough = advance(attempting, 0.75);

    expect(halfwayThrough.phase).toBe("Sleeping");
    // 100 Spin draining at 30/s for 0.75s: the area under it, at a penny a Spin-second.
    expect(halfwayThrough.style).toBeCloseTo(0.01 * (100 * 0.75 - (30 * 0.75 ** 2) / 2), 10);
  });

  it("drives the Sleeper harder while it runs, so the Throw it was learned on is worth less", () => {
    const undisturbed = advance(freshSleeper(), 8);
    const learnedOn = advance(attemptTrick(freshSleeper()), 8);

    // 1.5s at triple the usual drain costs 45 Spin, and the ×1.25 does not buy back all of it.
    expect(undisturbed.style).toBeCloseTo(2.5, 10);
    expect(learnedOn.style).toBeCloseTo(2.1078125, 10);
    expect(learnedOn.style).toBeLessThan(undisturbed.style);
  });

  it("is refused while the yoyo waits in the hand, where there is no Sleeper to perform on", () => {
    const ready = initialState();

    expect(attemptTrick(ready)).toEqual(ready);
  });

  it("is refused while the string is still winding back up", () => {
    const winding = advance(freshSleeper(), 6);

    expect(winding.phase).toBe("Rewinding");
    expect(attemptTrick(winding)).toEqual(winding);
  });

  /** An Attempt cannot be cancelled, restarted or swapped: there is one way out and it is time. */
  it("is refused while another Attempt is already in progress, leaving it untouched", () => {
    const halfwayThrough = advance(attemptTrick(freshSleeper()), 0.75);

    expect(attemptTrick(halfwayThrough)).toEqual(halfwayThrough);
  });

  it("is a commitment and not a tick: beginning one moves no time and earns nothing", () => {
    const sleeper = advance(freshSleeper(), 1);

    const attempting = attemptTrick(sleeper);

    expect(attempting.style).toBe(sleeper.style);
    expect(attempting.spin).toBe(sleeper.spin);
    expect(attempting.phaseElapsed).toBe(sleeper.phaseElapsed);
  });

  it("moves on to the next Trick once one is landed, rather than offering it again", () => {
    const landed = advance(attemptTrick(freshSleeper()), 1.5);

    expect(nextTrick(freshSleeper())?.name).toBe("Rock the Baby");
    expect(nextTrick(landed)?.name).toBe("Man on the Flying Trapeze");
  });

  it("shows the 1A Division as three Tricks in the order they must be landed in", () => {
    expect(TRICKS_1A.map((trick) => trick.name)).toEqual([
      "Rock the Baby",
      "Man on the Flying Trapeze",
      "Brain Twister",
    ]);
  });
});

/**
 * ADR 0004 again: an Attempt the Sleeper cannot sustain kills the yoyo early, teaches nothing
 * and forfeits the rest of the Throw Cycle. It is never refused and never random — the player
 * has been shown the outcome and has chosen to gamble the tail of a Throw.
 */
describe("an Attempt the Sleeper cannot sustain", () => {
  it("kills the yoyo at the exact second the Spin runs out, mid-Trick", () => {
    // 3.5s into a 5s Sleeper: 30 Spin left, and Rock the Baby drains it at 30 a second.
    const nearlySpent = attemptTrick(advance(freshSleeper(), 3.5));

    const justAlive = advance(nearlySpent, 0.999);
    const dead = advance(nearlySpent, 1);

    expect(justAlive.phase).toBe("Sleeping");
    expect(dead.phase).toBe("Rewinding");
    expect(dead.spin).toBe(0);
  });

  /**
   * The boundary case, and the one a player would argue about: landing wants Spin *left over*,
   * so a Trick that empties the Sleeper at the very instant it finishes has killed the yoyo.
   * Exactly 45 Spin is exactly what Rock the Baby costs.
   */
  it("teaches nothing when the Spin runs out at the very instant the Trick completes", () => {
    const exactlyEnough = attemptTrick(advance(freshSleeper(), 2.75));

    expect(exactlyEnough.spin).toBeCloseTo(45, 10);
    const resolved = advance(exactlyEnough, 1.5);

    expect(resolved.landedTricks).toEqual([]);
    expect(resolved.phase).toBe("Rewinding");
  });

  it("is not refused: the player may gamble the tail of a Throw, having been shown the cost", () => {
    const nearlySpent = advance(freshSleeper(), 3.5);

    const gambling = attemptTrick(nearlySpent);

    // Accepted, and the yoyo dies half a second sooner for it: the Trick drains what was left of
    // a Sleeper that still had 1.5 seconds to run.
    expect(gambling).not.toEqual(nearlySpent);
    expect(advance(gambling, 1).phase).toBe("Rewinding");
    expect(advance(nearlySpent, 1).phase).toBe("Sleeping");
  });

  it("keeps everything the Sleeper had already banked before the Trick was begun", () => {
    const nearlySpent = advance(freshSleeper(), 3.5);

    const dead = advance(attemptTrick(nearlySpent), 1);

    expect(dead.style).toBeGreaterThan(nearlySpent.style);
    expect(dead.lifetimeStyle).toBeCloseTo(dead.style, 10);
  });

  it("leaves the Trick on the ladder to be attempted again on the next Throw", () => {
    const dead = advance(attemptTrick(advance(freshSleeper(), 3.5)), 1);

    const thrownAgain = throwYoyo(advance(dead, 3));

    expect(nextTrick(thrownAgain)?.name).toBe("Rock the Baby");
    expect(advance(attemptTrick(thrownAgain), 1.5).landedTricks).toEqual(["rock-the-baby"]);
  });

  it("winds the string back up on the ordinary Rewind, with no penalty of its own", () => {
    const dead = advance(attemptTrick(advance(freshSleeper(), 3.5)), 1);

    const stillWinding = advance(dead, 2.999);
    const wound = advance(dead, 3);

    expect(stillWinding.phase).toBe("Rewinding");
    expect(wound.phase).toBe("Ready");
  });
});

describe("what landing a Trick is worth", () => {
  it("multiplies Sustained Style by exactly the Trick's reward, the instant it lands", () => {
    const before = sustainedStyle(freshSleeper());

    const landed = advance(attemptTrick(freshSleeper()), 1.5);

    expect(before).toBeCloseTo(0.3125, 10);
    expect(sustainedStyle(landed)).toBeCloseTo(0.390625, 10);
    expect(sustainedStyle(landed)).toBeCloseTo(before * 1.25, 10);
  });

  it("multiplies what the rest of that same Sleeper earns, not merely the next Throw", () => {
    const landed = advance(attemptTrick(freshSleeper()), 1.5);

    const spent = advance(landed, 3);

    // 55 Spin left, worth 0.75625 undisturbed, and 1.25 times that with the Trick in hand.
    expect(landed.spin).toBeCloseTo(55, 10);
    expect(spent.style - landed.style).toBeCloseTo(0.9453125, 10);
  });

  it("multiplies the Style rate the player is watching, immediately", () => {
    const attempting = attemptTrick(freshSleeper());

    const justBefore = advance(attempting, 1.4999);
    const justAfter = advance(attempting, 1.5);

    expect(currentStyleRate(justAfter) / currentStyleRate(justBefore)).toBeCloseTo(1.25, 3);
  });

  it("is permanent: every later Throw earns under it, and nothing takes it back", () => {
    const landed = advance(attemptTrick(freshSleeper()), 1.5);
    const backInTheHand = advance(landed, 8);

    const nextThrow = advance(throwYoyo(backInTheHand), 8);

    expect(nextThrow.style - backInTheHand.style).toBeCloseTo(2.5 * 1.25, 10);
  });

  it("earns while the player is away exactly as it earns while they watch", () => {
    const landed = advance(attemptTrick(automaticSleeper()), 1.5);

    const away = advance(landed, EIGHT_HOURS);

    expect(away.style - landed.style).toBeCloseTo(sustainedStyle(landed) * EIGHT_HOURS, 0);
  });
});

/**
 * ADR 0007 asks for the projection to be shown at full confidence with no hedging language, and
 * ADR 0001's linear decay is what earns that: the whole future of a Throw is known the instant it
 * is thrown, and an Attempt is part of that future rather than an interruption to it.
 *
 * So these check the quoted figures against the yoyo actually playing them out, rather than
 * against the arithmetic that produced them.
 */
describe("previewing an Attempt before committing to it", () => {
  it("names the Trick, how long it takes and what landing it pays, before it is begun", () => {
    const preview = previewAttempt(freshSleeper());

    expect(preview?.trick.name).toBe("Rock the Baby");
    expect(preview?.trick.durationSeconds).toBe(1.5);
    expect(preview?.trick.styleMultiplier).toBe(1.25);
  });

  it("quotes the exact Spin the yoyo will be left holding, and it is left holding it", () => {
    const sleeper = advance(freshSleeper(), 1);

    const preview = previewAttempt(sleeper);
    const landed = advance(attemptTrick(sleeper), 1.5);

    expect(preview?.outcome).toEqual({ lands: true, spinOnLanding: 35 });
    expect(landed.spin).toBeCloseTo(35, 10);
    expect(landed.landedTricks).toEqual(["rock-the-baby"]);
  });

  it("quotes the exact second the yoyo will die, and it dies then", () => {
    const nearlySpent = advance(freshSleeper(), 3.5);

    const preview = previewAttempt(nearlySpent);
    const attempting = attemptTrick(nearlySpent);

    expect(preview?.outcome).toEqual({ lands: false, secondsUntilDeath: 1 });
    expect(advance(attempting, 0.999).phase).toBe("Sleeping");
    expect(advance(attempting, 1).phase).toBe("Rewinding");
  });

  it("calls the exact-zero Attempt a death rather than a landing", () => {
    const exactlyEnough = advance(freshSleeper(), 2.75);

    expect(previewAttempt(exactlyEnough)?.outcome).toEqual({
      lands: false,
      secondsUntilDeath: 1.5,
    });
  });

  /**
   * ADR 0004 declares no Gear requirement anywhere: a Trick is out of reach because a weak Throw
   * cannot supply the Spin it costs, which is what puts Throw Power on the content ladder as well
   * as the earning curve. ADR 0014 asks that the Bearing reach the same gate, and it does so
   * without any Trick knowing the Bearing exists — an Attempt drains a multiple of whatever the
   * Sleeper's own decay is.
   */
  it("moves from fatal to safe on either Gear stat that reaches the Sleeper", () => {
    // 3.5 seconds into an opening Sleeper there are 30 Spin left and Rock the Baby wants 45.
    const nearlySpent = advance(freshSleeper(), 3.5);
    const strongerThrow = advance(throwYoyo(afterBuyingThrowPower(3)), 3.5);
    const betterBearing = advance(throwYoyo(afterBuyingBearing(8)), 3.5);

    expect(previewAttempt(nearlySpent)?.outcome.lands).toBe(false);
    for (const geared of [strongerThrow, betterBearing]) {
      expect(previewAttempt(geared)?.outcome.lands).toBe(true);
      expect(advance(attemptTrick(geared), 1.5).landedTricks).toEqual(["rock-the-baby"]);
    }
  });

  /**
   * ADR 0014 closes the door ADR 0013 opened for the Bearing: an Attempt reads the decay rate the
   * Throw captured, so buying a Bearing after committing cannot rescue an Attempt the player was
   * told would be fatal. The purchase still happens, and Sustained Style still moves for it.
   */
  it("is not rescued by a Bearing bought after the Attempt was committed to", () => {
    const doomed = attemptTrick({ ...advance(freshSleeper(), 3.5), style: 1_000 });

    const shopping = buyBearing(buyBearing(buyBearing(doomed)));

    expect(shopping.bearingLevel).toBe(3);
    expect(sustainedStyle(shopping)).toBeGreaterThan(sustainedStyle(doomed));
    expect(advance(shopping, 1).phase).toBe("Rewinding");
    expect(advance(shopping, 1).landedTricks).toEqual([]);
  });

  it("offers nothing to preview when there is no Sleeper to perform on", () => {
    expect(previewAttempt(initialState())).toBe(null);
    expect(previewAttempt(advance(freshSleeper(), 6))).toBe(null);
  });

  it("offers nothing to preview while a Trick is already being performed", () => {
    expect(previewAttempt(attemptTrick(freshSleeper()))).toBe(null);
  });

  it("projects the Throw in progress through the Attempt it is carrying", () => {
    const attempting = attemptTrick(freshSleeper());

    // The Attempt shortens the Sleeper and multiplies what is left of it, and the projection says
    // so: what it quotes is what the Throw goes on to earn, to the last decimal.
    expect(projectedYield(attempting)).toBeCloseTo(styleEarnedBeforeDying(attempting), 8);
    expect(projectedYield(attempting)).toBeCloseTo(2.1078125, 10);
  });

  it("projects a fatal Attempt as the shortened Sleeper it is", () => {
    const doomed = attemptTrick(advance(freshSleeper(), 3.5));

    expect(projectedYield(doomed)).toBeCloseTo(styleEarnedBeforeDying(doomed), 8);
    // 30 Spin drained at 30 a second is one second and 0.15 Style, not 0.225 over 1.5 seconds.
    expect(projectedYield(doomed)).toBeCloseTo(0.15, 10);
  });
});

/**
 * ADR 0014 puts Attempt progress in the core so that a shell can draw the Trick without running a
 * second timer beside the simulation. What it draws from therefore has to be a plain function of
 * the state in hand, like every other readout (#8).
 */
describe("the Attempt in progress, as something to draw", () => {
  it("runs from nothing done to the whole Trick done, over exactly its duration", () => {
    const attempting = attemptTrick(freshSleeper());

    expect(activeAttempt(attempting)?.trick.name).toBe("Rock the Baby");
    expect(activeAttempt(attempting)?.progress).toBeCloseTo(0, 10);
    expect(activeAttempt(advance(attempting, 0.75))?.progress).toBeCloseTo(0.5, 10);
    expect(activeAttempt(advance(attempting, 1.4999))?.progress).toBeCloseTo(1, 3);
  });

  it("has nothing to draw before an Attempt, after one lands, or after one kills the yoyo", () => {
    const attempting = attemptTrick(freshSleeper());

    expect(activeAttempt(freshSleeper())).toBe(null);
    expect(activeAttempt(advance(attempting, 1.5))).toBe(null);
    expect(activeAttempt(advance(attemptTrick(advance(freshSleeper(), 3.5)), 1))).toBe(null);
  });
});

/**
 * ADR 0002's parity claim, carried across the two boundaries an Attempt adds. A committed Attempt
 * is not a thing the player has to be present for: it resolves through a hidden tab and through
 * an Absence, under the same `advance` and the same rules.
 */
describe("an Attempt resolving whether or not anyone is watching", () => {
  it.each([
    { name: "landing", attemptedAt: 0 },
    { name: "killing the yoyo", attemptedAt: 3.5 },
  ])("agrees on an Attempt $name however the time is split", ({ attemptedAt }) => {
    const attempting = attemptTrick(advance(freshSleeper(), attemptedAt));

    const inOneCall = advance(attempting, 12);

    let inPieces = attempting;
    for (const piece of unevenSplits(12, 331)) inPieces = advance(inPieces, piece);

    let inHalfSeconds = attempting;
    for (let i = 0; i < 24; i++) inHalfSeconds = advance(inHalfSeconds, 0.5);

    for (const split of [inPieces, inHalfSeconds]) {
      expect(split.style).toBeCloseTo(inOneCall.style, 10);
      expect(split.phase).toBe(inOneCall.phase);
      expect(split.landedTricks).toEqual(inOneCall.landedTricks);
    }
  });

  it("resolves a Trick committed to just before the tab was closed", () => {
    const attempting = attemptTrick(automaticSleeper());

    const returned = advance(attempting, EIGHT_HOURS);

    expect(returned.landedTricks).toEqual(["rock-the-baby"]);
    expect(returned.attempt).toBe(null);
  });

  /**
   * A fatal Attempt crossing an Absence has three boundaries in one delta — the death, the
   * Rewind, and the automatic re-Throw after it — and the Auto-Thrower carries on from there as
   * though the yoyo had died of old age, because as far as the Rewind is concerned it has.
   */
  it("carries a fatal Attempt through the Rewind and back into an automatic Throw", () => {
    const doomed = attemptTrick(advance(automaticSleeper(), 3.5));

    const returned = advance(doomed, EIGHT_HOURS);
    const undisturbed = advance(automaticSleeper(), EIGHT_HOURS);

    expect(returned.landedTricks).toEqual([]);
    expect(returned.attempt).toBe(null);
    expect(returned.phase).toBe("Sleeping");
    // Eight hours on, the whole cost of the gamble is still the tail of the one Throw it was
    // taken on: less than a single Throw between this yoyo and one that never attempted anything.
    expect(Math.abs(returned.style - undisturbed.style)).toBeLessThan(2.5);
    expect(returned.style).toBeGreaterThan(8_000);
  });
});

describe("the Sustained Style readout", () => {
  it("is 0.3125 Style a second for an opening Throw", () => {
    // The figure the spec derives by hand for the opening state: 2.5 Style per Throw over an
    // eight-second Throw Cycle.
    expect(sustainedStyle(initialState())).toBeCloseTo(0.3125, 10);
  });

  /**
   * The readout against the Style a player would actually collect, for a spread of Gear.
   *
   * `measuredSustainedStyle` plays a whole Throw Cycle through `advance` and divides what it
   * earned by how long it took, so it is the yield-per-Throw-over-cycle-length derivation
   * arrived at independently — the readout computes neither of those quantities. #8 asks for
   * both derivations to agree, and this is the pair of them meeting.
   */
  it("agrees with what a player re-Throwing on time actually earns per second", () => {
    const shoppingTrips = [
      initialState(),
      afterBuyingThrowPower(5),
      afterBuyingBearing(3),
      afterBuyingRewindSpeed(4),
      afterShopping([buyThrowPower, 7], [buyBearing, 5], [buyRewindSpeed, 9]),
      // Past the Rewind floor, where the two derivations are least likely to agree by luck.
      afterShopping([buyRewindSpeed, 300], [buyBearing, 6]),
    ];

    for (const shopped of shoppingTrips) {
      expect(sustainedStyle(shopped)).toBeCloseTo(measuredSustainedStyle(shopped), 6);
    }
  });

  it("is right during the very first Throw Cycle, before any cycle has completed", () => {
    // Read off a save that has never thrown, then checked against ten cycles of a player
    // re-Throwing on time. The figure quoted before anything has happened is the rate the
    // game goes on to deliver — which is what makes it honest to show immediately, with no
    // history to average and nothing to warm up.
    const neverThrown = initialState();
    const quoted = sustainedStyle(neverThrown);

    const cycle = throwCycleLength(neverThrown);
    let state = neverThrown;
    for (let cycles = 0; cycles < 10; cycles++) state = advance(throwYoyo(state), cycle);

    expect(quoted).toBeCloseTo(state.style / (10 * cycle), 6);
  });

  it("holds still while the yoyo slows and while the string winds back up", () => {
    // ADR 0007 asks for the one figure in the game that does not move: it changes when the
    // player buys something and otherwise not at all. Sampled right through a Throw Cycle —
    // a fast fresh Sleeper, a nearly dead one, the Rewind, the yoyo back in the hand.
    const thrown = freshSleeper();
    const readings = [0, 1, 4.9, 5, 6, 7.9, 8].map((seconds) => {
      return sustainedStyle(advance(thrown, seconds));
    });

    for (const reading of readings) expect(reading).toBeCloseTo(0.3125, 10);
  });

  it("does not dip during the Rewind, when the yoyo is earning nothing at all", () => {
    // The specific complaint ADR 0003 raised: players read the winding animation as wasted
    // time. Style really does stop coming in here, and the headline figure still does not
    // flinch, because it is an average over the cycle the Rewind is part of.
    const dead = advance(freshSleeper(), 5);
    const midRewind = advance(dead, 1.5);

    expect(midRewind.phase).toBe("Rewinding");
    expect(midRewind.style).toBeCloseTo(dead.style, 10);
    expect(sustainedStyle(midRewind)).toBeCloseTo(sustainedStyle(dead), 10);
    expect(sustainedStyle(midRewind)).toBeCloseTo(sustainedStyle(freshSleeper()), 10);
  });

  it("moves the instant a Gear purchase is made, not a Throw Cycle later", () => {
    // The failure mode ADR 0007 names outright: a figure measured over recent cycles lags
    // every purchase by a full cycle, so the player buys something, watches the number sit
    // still, and concludes it did nothing. Bought mid-Sleeper, with the yoyo still on the
    // string and this cycle's earnings already part-banked, all three rows move at once.
    const midSleeper = midSleeperWithStyle(1);
    const before = sustainedStyle(midSleeper);

    for (const buy of [buyThrowPower, buyBearing, buyRewindSpeed]) {
      const bought = buy(midSleeper);

      expect(bought.phase).toBe("Sleeping");
      expect(sustainedStyle(bought)).toBeGreaterThan(before);
      // And the figure it jumps to is the one the game goes on to pay, not a guess at it.
      // Measured from the yoyo back in the hand, since a Throw is what a cycle is measured
      // from — the reading itself does not move over those twenty seconds.
      const wound = advance(bought, 20);
      expect(wound.phase).toBe("Ready");
      expect(sustainedStyle(bought)).toBeCloseTo(measuredSustainedStyle(wound), 6);
    }
  });

  /**
   * The other derivation #8 asks about: `(k·S₀/2) × Uptime`, the form ADR 0003 works in.
   *
   * Both halves come from somewhere other than the readout under test. The ceiling is the peak
   * Style rate a player can watch on the counter at the moment of the Throw, halved because
   * Spin falls in a straight line from there to zero. Uptime is measured by bisecting the
   * phases the yoyo actually passes through. So this is the ADR's formula assembled from
   * observations and checked against the readout, rather than the readout checked against
   * itself.
   */
  it("is the ceiling Throw Power sets, collected at the fraction of the cycle spent spinning", () => {
    for (const shopped of [initialState(), afterBuyingBearing(3), afterBuyingRewindSpeed(6)]) {
      const peak = currentStyleRate(throwYoyo(shopped));

      expect(sustainedStyle(shopped)).toBeCloseTo((peak / 2) * uptime(shopped), 6);
      // Uptime is a fraction, so the ceiling is a ceiling: only Throw Power raises it.
      expect(sustainedStyle(shopped)).toBeLessThan(peak / 2);
    }
  });

  it("is raised by each of the three Gear stats, and by buying more of any of them", () => {
    // Levels chosen to sit above the Rewind floor, which the twenty-fourth level of Rewind
    // Speed reaches — see the test below for what happens past it.
    for (const buy of [afterBuyingThrowPower, afterBuyingBearing, afterBuyingRewindSpeed]) {
      const climbing = [0, 1, 4, 9].map((levels) => sustainedStyle(buy(levels)));

      for (const [index, figure] of climbing.entries()) {
        if (index > 0) expect(figure).toBeGreaterThan(climbing[index - 1] as number);
      }
    }
  });

  /**
   * Rewind Speed is the one Gear stat whose effect on this figure runs out, and the readout has
   * to be honest about it rather than keep implying a gain.
   *
   * At the Rewind floor `R` is pinned, so a further level moves Sustained Style by exactly
   * nothing — the prototype on #3 priced level 25 at 796.64 Style for a delta of `+0.000000`
   * and filed it as an affordance gap for the shop. It is not a fault in the floor: ADR 0003's
   * floor exists to keep the *Bearing* working, which the guard further down proves it still
   * does. What it means is that a shop row reading its before-and-after off this number will
   * find no difference to show, and should say so.
   */
  it("stops responding to Rewind Speed once the Rewind is on its floor", () => {
    const atTheFloor = afterBuyingRewindSpeed(24);
    const wellPastIt = afterBuyingRewindSpeed(60);

    // Still climbing on the way down to the floor, and flat from the floor onwards.
    expect(sustainedStyle(atTheFloor)).toBeGreaterThan(sustainedStyle(afterBuyingRewindSpeed(23)));
    expect(sustainedStyle(wellPastIt)).toBe(sustainedStyle(atTheFloor));
    expect(sustainedStyle(afterBuyingRewindSpeed(200))).toBe(sustainedStyle(atTheFloor));

    // The Bearing, meanwhile, keeps working down there — which is the whole point of the floor.
    expect(sustainedStyle(afterShopping([buyRewindSpeed, 60], [buyBearing, 9]))).toBeGreaterThan(
      sustainedStyle(wellPastIt),
    );
  });
});

describe("the current Style rate readout", () => {
  it("opens at 1 Style a second and falls with the Spin the yoyo has left", () => {
    // k is 0.01 Style per unit of Spin per second, so a fresh 100-Spin Sleeper earns at 1/s
    // and a Sleeper down to 80 Spin earns at 0.8/s. ADR 0007 keeps this off the screen as a
    // digit and shows it as motion instead; the shell still needs the quantity to animate.
    const thrown = freshSleeper();

    expect(currentStyleRate(thrown)).toBeCloseTo(1, 10);
    expect(currentStyleRate(advance(thrown, 1))).toBeCloseTo(0.8, 10);
    expect(currentStyleRate(advance(thrown, 4))).toBeCloseTo(0.2, 10);
  });

  it("is the rate the Sleeper is really earning at, instant by instant", () => {
    // Checked against Style actually banked rather than against the formula: a tenth of a
    // second of earnings, divided by the tenth of a second it took.
    //
    // Read at the *midpoint* of that tenth of a second, where the comparison is exact rather
    // than approximate — Spin falls in a straight line (ADR 0001), so a slice pays its
    // midpoint rate exactly. Reading at the near edge instead would sit a predictable
    // k·D·dt/2 above the average and turn this into a test about the size of the window.
    const thrown = freshSleeper();
    const slice = 0.1;

    for (const seconds of [0, 1, 2.5, 4.9]) {
      const at = advance(thrown, seconds);
      const aSliceLater = advance(at, slice);
      const paid = (aSliceLater.style - at.style) / slice;

      expect(currentStyleRate(advance(at, slice / 2))).toBeCloseTo(paid, 10);
    }
  });

  it("is nothing for a Dead Yoyo, a winding string, or a yoyo waiting in the hand", () => {
    const dead = advance(freshSleeper(), 5);

    // The instant of death, mid-Rewind, wound and Ready, and a save that has never thrown.
    expect(dead.phase).toBe("Rewinding");
    expect(currentStyleRate(dead)).toBe(0);
    expect(currentStyleRate(advance(dead, 1.5))).toBe(0);
    expect(currentStyleRate(advance(dead, 3))).toBe(0);
    expect(currentStyleRate(initialState())).toBe(0);
  });

  it("opens higher when Throw Power is bought, since a harder Throw earns faster", () => {
    const harder = throwYoyo(afterBuyingThrowPower(5));

    expect(currentStyleRate(harder)).toBeCloseTo(2, 10);
  });
});

describe("the projected yield of the Throw in progress", () => {
  it("says 2.5 Style at the moment of an opening Throw, and is not an estimate", () => {
    // ADR 0007: linear decay makes the whole future of a Throw known the instant it is thrown,
    // so this is a fact to be stated at full confidence rather than a forecast to hedge. The
    // second assertion is the one that earns the word: the Sleeper goes on to earn precisely
    // what was quoted.
    const thrown = freshSleeper();

    expect(projectedYield(thrown)).toBeCloseTo(2.5, 10);
    expect(styleEarnedBeforeDying(thrown)).toBeCloseTo(2.5, 10);
  });

  it("counts only what is still to come, falling as the Sleeper is spent", () => {
    // A second in, the yoyo has banked 0.9 and has 1.6 left to earn on its remaining 80 Spin.
    const thrown = freshSleeper();
    const oneSecondIn = advance(thrown, 1);

    expect(oneSecondIn.style).toBeCloseTo(0.9, 10);
    expect(projectedYield(oneSecondIn)).toBeCloseTo(1.6, 10);
    expect(projectedYield(advance(thrown, 4))).toBeCloseTo(0.1, 10);
  });

  it("is exact at every moment of a Sleeper, under every combination of Gear", () => {
    const shoppingTrips = [
      initialState(),
      afterBuyingThrowPower(6),
      afterBuyingBearing(4),
      afterShopping([buyThrowPower, 3], [buyBearing, 7], [buyRewindSpeed, 5]),
    ];

    for (const shopped of shoppingTrips) {
      const thrown = throwYoyo(shopped);

      for (const fraction of [0, 0.1, 0.5, 0.9, 0.99]) {
        const partWay = advance(thrown, sleeperLength(shopped) * fraction);
        expect(partWay.phase).toBe("Sleeping");

        expect(projectedYield(partWay)).toBeCloseTo(styleEarnedBeforeDying(partWay), 8);
      }
    }
  });

  it("is nothing once the yoyo is dead, with no Throw in progress to project", () => {
    const dead = advance(freshSleeper(), 5);

    expect(projectedYield(dead)).toBe(0);
    expect(projectedYield(advance(dead, 1.5))).toBe(0);
    expect(projectedYield(advance(dead, 3))).toBe(0);
    expect(projectedYield(initialState())).toBe(0);
  });

  /**
   * ADR 0013 makes the projection a promise about the Sleeper the player can see. Buying a
   * Bearing changes the next Throw and Sustained Style immediately, but it cannot move the
   * death or remaining yield of the Throw already on the string.
   */
  it("stays exact when a Bearing is bought mid-Sleeper", () => {
    const midSleeper = midSleeperWithStyle(1);
    const quotedBefore = projectedYield(midSleeper);

    const bought = buyBearing(midSleeper);

    // The current 80 Spin keeps draining at 20/s and is still worth exactly 1.6 Style.
    expect(quotedBefore).toBeCloseTo(1.6, 10);
    expect(projectedYield(bought)).toBe(quotedBefore);
    expect(projectedYield(bought)).toBeCloseTo(styleEarnedBeforeDying(bought), 8);
    expect(bought.lifetimeStyle).toBeCloseTo(0.9, 10);
    expect(bought.lifetimeStyle).toBe(midSleeper.lifetimeStyle);
  });
});

/**
 * #8 asks that no readout measure or accumulate history — all three are to be functions of the
 * state in hand and nothing else. That is the property ADR 0007 says a measured average would
 * break, and it is not visible in any single reading: a readout keeping a running average, or
 * quietly warming up over the first few cycles, reads perfectly plausibly at any one moment.
 *
 * So it is tested by reading the same yoyo twice — once on a save that has played for hours,
 * once on a save that has just bought the same Gear and done nothing at all.
 */
describe("the readouts as functions of the state in hand", () => {
  it("reads a well-played save exactly as it reads a fresh one with the same Gear", () => {
    const shopping: Trolley[] = [
      [buyThrowPower, 4],
      [buyBearing, 2],
      [buyRewindSpeed, 3],
    ];
    const fresh = afterShopping(...shopping);

    let played = afterShopping(...shopping);
    const cycle = throwCycleLength(fresh);
    for (let cycles = 0; cycles < 500; cycles++) played = advance(throwYoyo(played), cycle);

    // Thousands of seconds and hundreds of Style apart, and identical Gear.
    expect(played.style).toBeGreaterThan(500);
    expect(fresh.style).toBe(0);
    expect(played.phase).toBe("Ready");

    // Exact equality rather than approximate: these are the same function of the same Gear, so
    // any drift at all would be history leaking in.
    expect(sustainedStyle(played)).toBe(sustainedStyle(fresh));

    for (const seconds of [0, 1.5, 3]) {
      const playedSleeper = advance(throwYoyo(played), seconds);
      const freshSleeperAgain = advance(throwYoyo(fresh), seconds);

      expect(playedSleeper.phase).toBe("Sleeping");
      expect(currentStyleRate(playedSleeper)).toBe(currentStyleRate(freshSleeperAgain));
      expect(projectedYield(playedSleeper)).toBe(projectedYield(freshSleeperAgain));
      expect(sustainedStyle(playedSleeper)).toBe(sustainedStyle(fresh));
    }
  });
});

/**
 * `GameState` declares `spin` "meaningful only while `Sleeping`", so both live readouts decide on
 * the phase rather than on Spin having reached zero. Nothing the core does today tells those two
 * apart — `advance` zeroes Spin at the Dead Yoyo — so this constructs a state directly, in the
 * same spirit as the save-shape test below: a rule that behavioural tests cannot see, pinned
 * where the thought is wanted.
 *
 * It is worth pinning because the licence is real and something will eventually use it. ADR 0003
 * lists carrying leftover Spin into the next Throw among the Structural Tricks still open, and a
 * migration or an older save can carry stale Spin regardless. A readout trusting Spin over the
 * phase would have a winding string earning Style.
 */
describe("a save carrying Spin the yoyo is no longer spinning on", () => {
  it("earns nothing and projects nothing while the string is winding back up", () => {
    const winding: GameState = { ...advance(freshSleeper(), 5), spin: 80 };

    expect(winding.phase).toBe("Rewinding");
    expect(currentStyleRate(winding)).toBe(0);
    expect(projectedYield(winding)).toBe(0);
  });

  it("earns nothing and projects nothing while the yoyo waits in the hand", () => {
    const ready: GameState = { ...initialState(), spin: 80 };

    expect(ready.phase).toBe("Ready");
    expect(currentStyleRate(ready)).toBe(0);
    expect(projectedYield(ready)).toBe(0);
  });
});

/**
 * ADR 0008 makes `GameState` the save-compatibility surface, and says effective stats are
 * derived rather than stored: were effective Throw Power, decay or Rewind duration written into
 * a save, a rebalance would leave old saves disagreeing with the constants they were built from.
 * ADR 0013 adds the active Throw's raw Gear levels, which retain the boundary without pinning an
 * effective stat to old tuning.
 *
 * That is a claim about the shape of a save rather than about anything a player can see, so
 * it needs an assertion of the kind the rest of this file avoids — as with the clock guard
 * in `core-is-pure.test.ts`, the rule is invisible to behavioural tests, since a stored stat
 * and a derived one agree right up until the rebalance. It is deliberately brittle: a field
 * added here is a migration to think about, and this test is where that thought is asked
 * for.
 */
describe("the shape a save has to carry", () => {
  it("stores owned and active Throw Gear as levels, never derived rates", () => {
    const shopped = afterShopping(
      [buyThrowPower, 1],
      [buyBearing, 1],
      [buyRewindSpeed, 1],
    );
    const played = advance(throwYoyo(shopped), 2);

    expect(Object.keys(played).sort()).toEqual([
      "activeThrowGear",
      "attempt",
      "bearingLevel",
      "hasAutoThrower",
      "landedTricks",
      "lifetimeStyle",
      "phase",
      "phaseElapsed",
      "rewindSpeedLevel",
      "spin",
      "style",
      "throwPowerLevel",
      "version",
    ]);
    expect(played.activeThrowGear).toEqual({ bearingLevel: 1, rewindSpeedLevel: 1 });
  });

  /**
   * The Trick ladder is the first content to arrive since this rule was written down, and it is
   * the case the rule was written for: a save records that Rock the Baby was landed, never the
   * ×1.25 that landing it is currently worth. Rebalancing the reward then reprices every save
   * holding the Trick, rather than leaving old players on the old figure and new players on the
   * new one with nothing in the game able to tell which is which.
   *
   * Sits with the field set above rather than among the behavioural tests for the same reason
   * that does: a stored multiplier and a derived one agree exactly until the day the constant
   * moves, so no test of what a player sees can tell them apart.
   */
  it("records which Tricks were landed and not what landing them is worth", () => {
    const landed = advance(attemptTrick(freshSleeper()), 2);

    expect(landed.landedTricks).toEqual(["rock-the-baby"]);
    expect(sustainedStyle(landed)).toBeCloseTo(sustainedStyle(freshSleeper()) * 1.25, 10);
  });

  /**
   * An Attempt is progress through a Trick and not the Spin that progress costs. The drain is the
   * active Throw's decay rate times the Trick's, and a rebalance moves both — a save holding the
   * product would come back quoting a difficulty from the game it was written in. It would also
   * be the one way a Bearing could reach an Attempt already committed to, which ADR 0014 forbids.
   */
  it("records how much of a Trick is left to perform and not what performing it drains", () => {
    const halfway = advance(attemptTrick(freshSleeper()), 0.5);

    expect(halfway.attempt).toEqual({ trickId: "rock-the-baby", remaining: 1 });
  });

  /**
   * `phaseElapsed` is held at zero throughout `Ready` — `advance` records the reasoning. What
   * belongs here is that the rule is part of the save surface rather than part of the game: it
   * is unobservable by definition, since a field nothing reads is a field nothing can show, so
   * it needs the same brittle assertion the field set above gets.
   *
   * Making the field phase-specific in shape would say the same thing in the type rather than as
   * an invariant, and was weighed. It costs a discriminated union across the save surface and
   * every migration after it, to delete one number that is now always zero — more churn than one
   * quiet phase justifies.
   *
   * A month resolves in one step, as it must: the O(1) short-circuit is what keeps a long Absence
   * cheap, and this would not return at all if the wait were walked second by second.
   */
  it("counts no time against a yoyo that is only waiting to be Thrown", () => {
    const wound = advance(freshSleeper(), 8);
    expect(wound.phase).toBe("Ready");

    const aMonthLater = advance(wound, 30 * 24 * 60 * 60);

    expect(aMonthLater.phase).toBe("Ready");
    expect(aMonthLater.phaseElapsed).toBe(0);
  });

  /**
   * The rule above is a claim about every `Ready` state, not only the ones this version of
   * `advance` produced. A save written before the counter was held at zero carries whatever it
   * had already banked, and loading it must not leave the field disagreeing with what its own
   * type says it holds. So the wait clears it rather than merely declining to add to it, and an
   * old save heals on the first frame after it is loaded.
   */
  it("clears time an older save had already recorded against a waiting yoyo", () => {
    const writtenBeforeTheRule: GameState = { ...initialState(), phaseElapsed: 2_592_000 };

    const afterOneFrame = advance(writtenBeforeTheRule, 1 / 60);

    expect(afterOneFrame.phase).toBe("Ready");
    expect(afterOneFrame.phaseElapsed).toBe(0);
  });

  /**
   * ADR 0006 splits the purchasables in two, and the split is the whole decision rather than a
   * label on it: Retire clears Gear eleven times over the life of the game and must never take
   * the Auto-Thrower with it, or the game un-idles itself every time it rewards the player.
   *
   * There is no Retire yet to demonstrate that against, so this pins what a save records
   * instead. Gear is levels, which a reset can zero; Kit is a thing owned. A save that filed
   * the Auto-Thrower as an `autoThrowerLevel` alongside the other three would be one reset
   * away from selling it back.
   */
  it("records the Auto-Thrower as Kit the player owns, not as a fourth Gear level", () => {
    const owned = buyAutoThrower(withStyle(autoThrowerCost()));

    expect(owned.hasAutoThrower).toBe(true);
    const levels = Object.keys(owned).filter((field) => field.endsWith("Level"));
    expect(levels.sort()).toEqual(["bearingLevel", "rewindSpeedLevel", "throwPowerLevel"]);
  });
});
