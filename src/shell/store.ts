import type { GameState } from "../core/simulation.js";
import {
  advance,
  autoThrowerCost,
  bearingCost,
  buyAutoThrower as buyAutoThrowerInCore,
  buyBearing,
  buyRewindSpeed,
  buyThrowPower,
  initialState,
  rewindSpeedCost,
  sustainedStyle,
  throwPowerCost,
  throwYoyo,
} from "../core/simulation.js";
import { PROVISIONAL_SHELL } from "./constants.js";

export type GameCheckpoint = {
  tickedAt: number;
  state: GameState;
};

type GameStoreOptions = {
  /** Milliseconds from the device wall clock. Injected so elapsed time is testable. */
  now: () => number;
  /** A restored state and the wall-clock instant from which its next ordinary tick continues. */
  restored?: GameCheckpoint;
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

export type AbsenceSummary = {
  seconds: number;
  styleEarned: number;
  outcome: "autoThrower" | "died" | "alreadyDead" | "stillSleeping";
};

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
  subscribeToPurchases: (listener: () => void) => () => void;
  getAutoThrowerOffer: () => AutoThrowerOffer;
  getProjectedNight: () => ProjectedNight;
  subscribeToAutoThrowerOffer: (listener: () => void) => () => void;
  buyAutoThrower: () => void;
  getGearShop: () => GearShop;
  subscribeToGearShop: (listener: () => void) => () => void;
  buyGear: (gear: GearId) => void;
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
  const absenceSummaryListeners = new Set<() => void>();
  const throwAvailabilityListeners = new Set<() => void>();
  const purchaseListeners = new Set<() => void>();
  const gearShopListeners = new Set<() => void>();
  const autoThrowerOfferListeners = new Set<() => void>();
  let currentGearShop = gearShop(state);
  let currentAutoThrowerOffer = autoThrowerOffer(state);

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

  const replaceState = (nextState: GameState) => {
    const availabilityChanged = (state.phase === "Ready") !== (nextState.phase === "Ready");
    const nextGearShop = gearShop(nextState);
    const shopChanged = !sameGearShop(nextGearShop);
    const nextAutoThrowerOffer = autoThrowerOffer(nextState);
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
  };

  const purchase = (nextState: GameState) => {
    if (nextState === state) return;
    replaceState(nextState);
    for (const listener of purchaseListeners) listener();
  };

  const tickAt = (tickedAt: number) => {
    const seconds = Math.max(0, (tickedAt - lastTick) / 1_000);
    const styleBeforeTick = state.style;
    const hadAutoThrower = state.hasAutoThrower;
    const phaseBeforeTick = state.phase;
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
      return { tickedAt, state };
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
    subscribeToPurchases: (listener) => {
      purchaseListeners.add(listener);
      return () => purchaseListeners.delete(listener);
    },
    getAutoThrowerOffer: () => currentAutoThrowerOffer,
    getProjectedNight: () => projectedNight(state),
    subscribeToAutoThrowerOffer: (listener) => {
      autoThrowerOfferListeners.add(listener);
      return () => autoThrowerOfferListeners.delete(listener);
    },
    buyAutoThrower: () => purchase(buyAutoThrowerInCore(state)),
    getGearShop: () => currentGearShop,
    subscribeToGearShop: (listener) => {
      gearShopListeners.add(listener);
      return () => gearShopListeners.delete(listener);
    },
    buyGear: (gearId) => {
      const gear = GEAR.find(({ id }) => id === gearId);
      if (gear) purchase(gear.buy(state));
    },
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
