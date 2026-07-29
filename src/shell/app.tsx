import { useEffect, useRef, useSyncExternalStore } from "react";

import { formatNumber } from "./format.js";
import type { GameStore, GearOffer, GearShop as GearShopState } from "./store.js";
import { YoyoCanvas } from "./yoyo-canvas.js";

type AppProps = {
  store: GameStore;
};

const THROW_READY_COPY = "Ready to Throw.";
const THROW_WAITING_COPY = "Available when the yoyo is back in hand.";

function StyleTicker({ store }: AppProps) {
  const output = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    let frame: number;

    const tick = () => {
      store.tick();
      if (output.current) output.current.textContent = formatNumber(store.getState().style);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [store]);

  return (
    <output ref={output} className="style-balance-value" aria-label="Current Style">
      {formatNumber(store.getState().style)}
    </output>
  );
}

function GearRow({ offer, store }: { offer: GearOffer; store: GameStore }) {
  return (
    <article className={`gear-row${offer.affordable ? "" : " is-unaffordable"}`}>
      <div className="gear-copy">
        <h3>{offer.name}</h3>
        <span className="gear-result">
          {formatNumber(offer.sustainedStyleAfterPurchase)} Sustained Style
        </span>
      </div>
      <div className="gear-purchase">
        <span className="gear-price">{formatNumber(offer.price)} Style</span>
        <button
          className="action-button gear-buy-button"
          type="button"
          disabled={!offer.affordable}
          onClick={() => store.buyGear(offer.id)}
        >
          Buy {offer.name}
        </button>
      </div>
    </article>
  );
}

function GearShop({ shop, store }: { shop: GearShopState; store: GameStore }) {
  return (
    <section className="gear-shop" aria-labelledby="gear-shop-heading">
      <div className="gear-shop-heading">
        <div>
          <p className="eyebrow">Gear</p>
          <h2 id="gear-shop-heading">Build this Yoyo</h2>
        </div>
        <p>Each purchase shows its next Sustained Style.</p>
      </div>
      <div className="gear-list">
        {shop.offers.map((offer) => (
          <GearRow key={offer.id} offer={offer} store={store} />
        ))}
      </div>
    </section>
  );
}

function ThrowControl({ store }: AppProps) {
  const isReady = useSyncExternalStore(
    store.subscribeToThrowAvailability,
    store.isThrowAvailable,
    store.isThrowAvailable,
  );

  return (
    <div className="throw-control">
      <button
        className="action-button throw-button"
        type="button"
        disabled={!isReady}
        aria-describedby="throw-status"
        onClick={store.throwYoyo}
      >
        Throw
      </button>
      <p id="throw-status" className="throw-status" aria-live="polite">
        {isReady ? THROW_READY_COPY : THROW_WAITING_COPY}
      </p>
    </div>
  );
}

export function App({ store }: AppProps) {
  const shop = useSyncExternalStore(
    store.subscribeToGearShop,
    store.getGearShop,
    store.getGearShop,
  );

  return (
    <main className="shell">
      <header className="brand" aria-label="Idle Yoyo">
        <span className="brand-mark" aria-hidden="true">
          O
        </span>
        <span>IDLE YOYO</span>
      </header>

      <section className="game-stage" aria-label="Throw Cycle">
        <div className="canvas-card">
          <p className="eyebrow">Live Throw Cycle</p>
          <YoyoCanvas store={store} />
        </div>

        <div className="style-card" aria-labelledby="sustained-style-heading">
          <p className="eyebrow">Opening Throw</p>
          <h1 id="sustained-style-heading">Sustained Style</h1>
          <output className="sustained-style-value" aria-label="Sustained Style">
            {formatNumber(shop.sustainedStyle)}
          </output>
          <p className="caption">Style per second across a full Throw Cycle.</p>
          <div className="style-balance">
            <span>Style</span>
            <StyleTicker store={store} />
          </div>
          <ThrowControl store={store} />
        </div>
      </section>

      <GearShop shop={shop} store={store} />

      <p className="footnote">Throw again when the yoyo returns to your hand.</p>
    </main>
  );
}
