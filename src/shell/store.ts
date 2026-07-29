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

type GameStoreOptions = {
  /** Milliseconds from the device wall clock. Injected so elapsed time is testable. */
  now: () => number;
};

/** Product assumption: the shop's projected night is eight hours away. */
const PROJECTED_NIGHT_SECONDS = 8 * 60 * 60;

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
    hours: PROJECTED_NIGHT_SECONDS / (60 * 60),
    withAutoThrower: advance(withAutoThrower, PROJECTED_NIGHT_SECONDS).style,
    withoutAutoThrower: advance(withoutAutoThrower, PROJECTED_NIGHT_SECONDS).style,
  };
}

export type GameStore = {
  getState: () => GameState;
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
export function createGameStore({ now }: GameStoreOptions): GameStore {
  let state = throwYoyo(initialState());
  let lastTick = now();
  const throwAvailabilityListeners = new Set<() => void>();
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

  return {
    getState: () => state,
    getAutoThrowerOffer: () => currentAutoThrowerOffer,
    getProjectedNight: () => projectedNight(state),
    subscribeToAutoThrowerOffer: (listener) => {
      autoThrowerOfferListeners.add(listener);
      return () => autoThrowerOfferListeners.delete(listener);
    },
    buyAutoThrower: () => replaceState(buyAutoThrowerInCore(state)),
    getGearShop: () => currentGearShop,
    subscribeToGearShop: (listener) => {
      gearShopListeners.add(listener);
      return () => gearShopListeners.delete(listener);
    },
    buyGear: (gearId) => {
      const gear = GEAR.find(({ id }) => id === gearId);
      if (gear) replaceState(gear.buy(state));
    },
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
