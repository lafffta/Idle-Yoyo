import type { Attempt, AttemptPreview, GameState, TrickId } from "../core/simulation.js";
import {
  activeAttempt,
  advance,
  attemptTrick as attemptTrickInCore,
  autoThrowerCost,
  bearingCost,
  buyAutoThrower as buyAutoThrowerInCore,
  buyBearing,
  buyRewindSpeed,
  buyThrowPower,
  initialState,
  nextTrick,
  previewAttempt,
  rewindSpeedCost,
  sustainedStyle,
  throwPowerCost,
  throwYoyo,
  trickById,
  TRICKS_1A,
} from "../core/simulation.js";
import { PROVISIONAL_SHELL } from "./constants.js";

export type GameCheckpoint = {
  tickedAt: number;
  state: GameState;
  sustainedStyleGuideWasDismissed: boolean;
};

type RestoredGame = {
  tickedAt: number;
  state: GameState;
  sustainedStyleGuideWasDismissed?: boolean;
};

type GameStoreOptions = {
  /** Milliseconds from the device wall clock. Injected so elapsed time is testable. */
  now: () => number;
  /** A restored state and the wall-clock instant from which its next ordinary tick continues. */
  restored?: RestoredGame;
};

export type AutoThrowerOffer = {
  price: number;
  affordable: boolean;
  owned: boolean;
};

export type ProjectedNight = {
  hours: number;
  withAutoThrower: number;
  withoutAutoThrower: number;
};

/**
 * What became of an Attempt that was already in progress when the game was last saved, as the
 * one restored tick that can resolve it found it. `null` covers both "there was no Attempt to
 * resolve" and "it is still running" — the summary only ever speaks about a settled outcome.
 */
export type AttemptResolution = { trickName: string; landed: boolean };

export type AbsenceSummary = {
  seconds: number;
  styleEarned: number;
  outcome: "autoThrower" | "died" | "alreadyDead" | "stillSleeping";
  attemptResolution: AttemptResolution | null;
};

/**
 * Names what a restored Attempt did, by comparing the Attempt held before the resolving tick
 * against the landed facts and Attempt state it left behind. Reads only those two facts rather
 * than re-deriving an outcome, so this can never disagree with what `advance` actually decided.
 *
 * `before.trickId` is always a validated `TrickId` by the time it reaches here — either minted by
 * a fresh `attemptTrick` or accepted by the save layer — so this reads it with `trickById`, the
 * same trusted lookup `advance` itself uses, rather than the untrusted-string `findTrick`.
 */
function resolvedAttempt(before: Attempt | null, after: GameState): AttemptResolution | null {
  if (before === null) return null;

  const trick = trickById(before.trickId);
  if (after.landedTricks.includes(before.trickId)) return { trickName: trick.name, landed: true };
  if (after.attempt === null) return { trickName: trick.name, landed: false };
  return null;
}

export type GearId = "throwPower" | "bearing" | "rewindSpeed";

export type GearOffer = {
  id: GearId;
  name: string;
  price: number;
  sustainedStyleAfterPurchase: number;
  affordable: boolean;
};

export type GearShop = {
  sustainedStyle: number;
  offers: GearOffer[];
};

type GearDefinition = {
  id: GearId;
  name: string;
  price: (state: GameState) => number;
  buy: (state: GameState) => GameState;
};

const GEAR: GearDefinition[] = [
  { id: "throwPower", name: "Throw Power", price: throwPowerCost, buy: buyThrowPower },
  { id: "bearing", name: "Bearing", price: bearingCost, buy: buyBearing },
  { id: "rewindSpeed", name: "Rewind Speed", price: rewindSpeedCost, buy: buyRewindSpeed },
];

function gearShop(state: GameState): GearShop {
  return {
    sustainedStyle: sustainedStyle(state),
    offers: GEAR.map(({ id, name, price: priceOf, buy }) => {
      const price = priceOf(state);
      const funded = { ...state, style: Math.max(state.style, price) };

      return {
        id,
        name,
        price,
        sustainedStyleAfterPurchase: sustainedStyle(buy(funded)),
        affordable: state.style >= price,
      };
    }),
  };
}

export type TrickRowStatus = "landed" | "next" | "locked";

export type TrickRow = {
  id: TrickId;
  name: string;
  durationSeconds: number;
  styleMultiplier: number;
  status: TrickRowStatus;
  /** The Trick this row waits on. Only ever set on a locked row. */
  requires: string | null;
};

/**
 * The 1A Division as a shell renders it: every row in ladder order, and the coarse facts about
 * the Attempt on offer.
 *
 * What is deliberately *not* here is the exact Spin an Attempt would leave. That figure falls
 * with the Sleeper, so it changes every frame, and putting it in a subscribed snapshot would
 * re-render the ladder sixty times a second to move a decimal. It is read straight from the
 * core instead — see `getAttemptForecast` — exactly as the Style balance already is.
 */
export type TrickLadder = {
  rows: TrickRow[];
  /** Whether the next Trick can be begun this instant. */
  attemptable: boolean;
  /** Whether beginning it now would land it. `null` when there is nothing to begin. */
  lands: boolean | null;
  /** The Trick being performed right now, or `null`. */
  attempting: string | null;
};

function trickLadder(state: GameState): TrickLadder {
  const next = nextTrick(state);
  const preview = previewAttempt(state);
  const performing = activeAttempt(state);

  return {
    rows: TRICKS_1A.map((trick, index) => {
      const landed = state.landedTricks.includes(trick.id);
      const previous = TRICKS_1A[index - 1];

      return {
        id: trick.id,
        name: trick.name,
        durationSeconds: trick.durationSeconds,
        styleMultiplier: trick.styleMultiplier,
        status: landed ? "landed" : next?.id === trick.id ? "next" : "locked",
        requires: landed || next?.id === trick.id ? null : (previous?.name ?? null),
      };
    }),
    attemptable: preview !== null,
    lands: preview?.outcome.lands ?? null,
    attempting: performing?.trick.name ?? null,
  };
}

function autoThrowerOffer(state: GameState): AutoThrowerOffer {
  const price = autoThrowerCost();
  return {
    price,
    affordable: !state.hasAutoThrower && state.style >= price,
    owned: state.hasAutoThrower,
  };
}

function projectedNight(state: GameState): ProjectedNight {
  const withoutAutoThrower = {
    ...state,
    style: 0,
    lifetimeStyle: 0,
    hasAutoThrower: false,
  };
  const bought = buyAutoThrowerInCore({
    ...withoutAutoThrower,
    style: autoThrowerCost(),
  });
  const withAutoThrower = { ...bought, style: 0, lifetimeStyle: 0 };

  return {
    hours: PROVISIONAL_SHELL.projectedNightSeconds / (60 * 60),
    withAutoThrower: advance(withAutoThrower, PROVISIONAL_SHELL.projectedNightSeconds).style,
    withoutAutoThrower: advance(withoutAutoThrower, PROVISIONAL_SHELL.projectedNightSeconds).style,
  };
}

export type GameStore = {
  getState: () => GameState;
  checkpoint: () => GameCheckpoint;
  getAbsenceSummary: () => AbsenceSummary | null;
  subscribeToAbsenceSummary: (listener: () => void) => () => void;
  dismissAbsenceSummary: () => void;
  isSustainedStyleGuideVisible: () => boolean;
  subscribeToSustainedStyleGuide: (listener: () => void) => () => void;
  dismissSustainedStyleGuide: () => void;
  subscribeToPersistedChanges: (listener: () => void) => () => void;
  getAutoThrowerOffer: () => AutoThrowerOffer;
  getProjectedNight: () => ProjectedNight;
  subscribeToAutoThrowerOffer: (listener: () => void) => () => void;
  buyAutoThrower: () => void;
  getGearShop: () => GearShop;
  subscribeToGearShop: (listener: () => void) => () => void;
  buyGear: (gear: GearId) => void;
  getTrickLadder: () => TrickLadder;
  subscribeToTrickLadder: (listener: () => void) => () => void;
  /** The exact outcome of Attempting right now, read live rather than subscribed. */
  getAttemptForecast: () => AttemptPreview | null;
  attemptTrick: () => void;
  tick: () => void;
  throwYoyo: () => void;
  isThrowAvailable: () => boolean;
  subscribeToThrowAvailability: (listener: () => void) => () => void;
};

/**
 * Owns the live state outside React. A frame asks it to tick, but the wall clock alone decides
 * how much time passes; requestAnimationFrame is only the scheduler (ADR 0011).
 */
export function createGameStore({ now, restored }: GameStoreOptions): GameStore {
  let state = restored?.state ?? throwYoyo(initialState());
  let lastTick = restored?.tickedAt ?? now();
  let absenceSummary: AbsenceSummary | null = null;
  let hasPendingRestorationTick = restored !== undefined;
  let sustainedStyleGuideWasDismissed = restored?.sustainedStyleGuideWasDismissed ?? false;
  const absenceSummaryListeners = new Set<() => void>();
  const sustainedStyleGuideListeners = new Set<() => void>();
  const throwAvailabilityListeners = new Set<() => void>();
  const persistedChangeListeners = new Set<() => void>();
  const gearShopListeners = new Set<() => void>();
  const autoThrowerOfferListeners = new Set<() => void>();
  const trickLadderListeners = new Set<() => void>();
  let currentGearShop = gearShop(state);
  let currentAutoThrowerOffer = autoThrowerOffer(state);
  let currentTrickLadder = trickLadder(state);

  const sameGearShop = (nextShop: GearShop) =>
    currentGearShop.sustainedStyle === nextShop.sustainedStyle &&
    currentGearShop.offers.every((offer, index) => {
      const nextOffer = nextShop.offers[index];
      return (
        nextOffer !== undefined &&
        offer.id === nextOffer.id &&
        offer.price === nextOffer.price &&
        offer.sustainedStyleAfterPurchase === nextOffer.sustainedStyleAfterPurchase &&
        offer.affordable === nextOffer.affordable
      );
    });

  const sameTrickLadder = (nextLadder: TrickLadder) =>
    currentTrickLadder.attemptable === nextLadder.attemptable &&
    currentTrickLadder.lands === nextLadder.lands &&
    currentTrickLadder.attempting === nextLadder.attempting &&
    currentTrickLadder.rows.every((row, index) => {
      const nextRow = nextLadder.rows[index];
      return nextRow !== undefined && row.id === nextRow.id && row.status === nextRow.status;
    });

  const replaceState = (nextState: GameState) => {
    const availabilityChanged = (state.phase === "Ready") !== (nextState.phase === "Ready");
    const nextGearShop = gearShop(nextState);
    const shopChanged = !sameGearShop(nextGearShop);
    const nextAutoThrowerOffer = autoThrowerOffer(nextState);
    const nextTrickLadder = trickLadder(nextState);
    const autoThrowerOfferChanged =
      currentAutoThrowerOffer.price !== nextAutoThrowerOffer.price ||
      currentAutoThrowerOffer.affordable !== nextAutoThrowerOffer.affordable ||
      currentAutoThrowerOffer.owned !== nextAutoThrowerOffer.owned;
    state = nextState;
    if (availabilityChanged) {
      for (const listener of throwAvailabilityListeners) listener();
    }
    if (shopChanged) {
      currentGearShop = nextGearShop;
      for (const listener of gearShopListeners) listener();
    }
    if (autoThrowerOfferChanged) {
      currentAutoThrowerOffer = nextAutoThrowerOffer;
      for (const listener of autoThrowerOfferListeners) listener();
    }
    if (!sameTrickLadder(nextTrickLadder)) {
      currentTrickLadder = nextTrickLadder;
      for (const listener of trickLadderListeners) listener();
    }
  };

  /**
   * A move the player made, rather than time passing: it changes the save and is written out at
   * once. Beginning an Attempt belongs here for the same reason a purchase does — ADR 0014 makes
   * it irreversible, so a crash between the commitment and the next save must not undo it.
   */
  const commit = (nextState: GameState) => {
    if (nextState === state) return;
    replaceState(nextState);
    for (const listener of persistedChangeListeners) listener();
  };

  const tickAt = (tickedAt: number) => {
    const seconds = Math.max(0, (tickedAt - lastTick) / 1_000);
    const styleBeforeTick = state.style;
    const hadAutoThrower = state.hasAutoThrower;
    const phaseBeforeTick = state.phase;
    const attemptBeforeTick = state.attempt;
    replaceState(advance(state, seconds));
    if (hasPendingRestorationTick) {
      if (seconds >= PROVISIONAL_SHELL.meaningfulRestoredAbsenceSeconds) {
        const outcome = hadAutoThrower
          ? "autoThrower"
          : phaseBeforeTick !== "Sleeping"
            ? "alreadyDead"
            : state.phase === "Sleeping"
              ? "stillSleeping"
              : "died";
        absenceSummary = {
          seconds,
          styleEarned: state.style - styleBeforeTick,
          outcome,
          attemptResolution: resolvedAttempt(attemptBeforeTick, state),
        };
        for (const listener of absenceSummaryListeners) listener();
      }
      hasPendingRestorationTick = false;
    }
    lastTick = tickedAt;
  };

  return {
    getState: () => state,
    checkpoint: () => {
      const tickedAt = now();
      tickAt(tickedAt);
      return { tickedAt, state, sustainedStyleGuideWasDismissed };
    },
    getAbsenceSummary: () => absenceSummary,
    subscribeToAbsenceSummary: (listener) => {
      absenceSummaryListeners.add(listener);
      return () => absenceSummaryListeners.delete(listener);
    },
    dismissAbsenceSummary: () => {
      if (absenceSummary === null) return;
      absenceSummary = null;
      for (const listener of absenceSummaryListeners) listener();
    },
    isSustainedStyleGuideVisible: () => !sustainedStyleGuideWasDismissed,
    subscribeToSustainedStyleGuide: (listener) => {
      sustainedStyleGuideListeners.add(listener);
      return () => sustainedStyleGuideListeners.delete(listener);
    },
    dismissSustainedStyleGuide: () => {
      if (sustainedStyleGuideWasDismissed) return;
      sustainedStyleGuideWasDismissed = true;
      for (const listener of sustainedStyleGuideListeners) listener();
      for (const listener of persistedChangeListeners) listener();
    },
    subscribeToPersistedChanges: (listener) => {
      persistedChangeListeners.add(listener);
      return () => persistedChangeListeners.delete(listener);
    },
    getAutoThrowerOffer: () => currentAutoThrowerOffer,
    getProjectedNight: () => projectedNight(state),
    subscribeToAutoThrowerOffer: (listener) => {
      autoThrowerOfferListeners.add(listener);
      return () => autoThrowerOfferListeners.delete(listener);
    },
    buyAutoThrower: () => commit(buyAutoThrowerInCore(state)),
    getGearShop: () => currentGearShop,
    subscribeToGearShop: (listener) => {
      gearShopListeners.add(listener);
      return () => gearShopListeners.delete(listener);
    },
    buyGear: (gearId) => {
      const gear = GEAR.find(({ id }) => id === gearId);
      if (gear) commit(gear.buy(state));
    },
    getTrickLadder: () => currentTrickLadder,
    subscribeToTrickLadder: (listener) => {
      trickLadderListeners.add(listener);
      return () => trickLadderListeners.delete(listener);
    },
    getAttemptForecast: () => previewAttempt(state),
    attemptTrick: () => commit(attemptTrickInCore(state)),
    tick: () => {
      tickAt(now());
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
