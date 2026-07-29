import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { formatNumber } from "./format.js";
import type {
  AbsenceSummary as AbsenceSummaryState,
  AutoThrowerOffer,
  GameStore,
  GearOffer,
  GearShop as GearShopState,
} from "./store.js";
import { YoyoCanvas } from "./yoyo-canvas.js";

type AppProps = {
  store: GameStore;
  saveWasUnreadable?: boolean;
};

const THROW_READY_COPY = "Ready to Throw.";
const THROW_WAITING_COPY = "Available when the yoyo is back in hand.";

function UnreadableSaveWarning() {
  return (
    <aside className="save-warning" role="alert">
      <strong>We couldn't read your save.</strong>
      <span>
        A fresh game was started, and the original save was kept safely on this device.
      </span>
    </aside>
  );
}

function formatAbsenceDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  if (remainingMinutes === 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${hours} ${hours === 1 ? "hour" : "hours"} and ${remainingMinutes} ${
    remainingMinutes === 1 ? "minute" : "minutes"
  }`;
}

function absenceExplanation(summary: AbsenceSummaryState): string {
  const earned = `${formatNumber(summary.styleEarned)} Style`;

  switch (summary.outcome) {
    case "autoThrower":
      return `Your Auto-Thrower kept every Throw Cycle moving and earned ${earned} while you were away.`;
    case "died":
      return `Your yoyo died when its Spin ran out. It earned ${earned} while you were away, then nothing further without an Auto-Thrower.`;
    case "alreadyDead":
      return `Your yoyo had already died when its Spin ran out. It earned ${earned} while you were away, then nothing further without an Auto-Thrower.`;
    case "stillSleeping":
      return `Your yoyo stayed a Sleeper and earned ${earned} while you were away. Without an Auto-Thrower, it will earn nothing further after its Spin runs out.`;
  }
}

function AbsenceSummary({ store }: AppProps) {
  const summary = useSyncExternalStore(
    store.subscribeToAbsenceSummary,
    store.getAbsenceSummary,
    store.getAbsenceSummary,
  );

  if (summary === null) return null;

  return (
    <aside className="absence-summary" aria-labelledby="absence-summary-heading">
      <div>
        <p className="eyebrow">Welcome back</p>
        <h2 id="absence-summary-heading">
          You were away for {formatAbsenceDuration(summary.seconds)}.
        </h2>
        <p>{absenceExplanation(summary)}</p>
      </div>
      <button className="action-button" type="button" onClick={store.dismissAbsenceSummary}>
        Dismiss
      </button>
    </aside>
  );
}

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

function ProjectedNight({ store }: AppProps) {
  const [projection, setProjection] = useState(() => store.getProjectedNight());

  useEffect(() => {
    const interval = window.setInterval(() => setProjection(store.getProjectedNight()), 1_000);
    return () => window.clearInterval(interval);
  }, [store]);

  return (
    <div className="night-projection" aria-label={`Projected ${projection.hours}-hour night`}>
      <p>Projected {projection.hours}-hour night</p>
      <div className="night-comparison">
        <div>
          <span>With Auto-Thrower</span>
          <output aria-label="Projected night with Auto-Thrower">
            {formatNumber(projection.withAutoThrower)} Style
          </output>
        </div>
        <div>
          <span>Without Auto-Thrower</span>
          <output aria-label="Projected night without Auto-Thrower">
            {formatNumber(projection.withoutAutoThrower)} Style
          </output>
        </div>
      </div>
    </div>
  );
}

function KitShop({ offer, store }: { offer: AutoThrowerOffer; store: GameStore }) {
  return (
    <section className="kit-shop" aria-label="Kit">
      <div className="kit-shop-heading">
        <div>
          <p className="eyebrow">Kit</p>
          <h2>Keep every Yoyo moving</h2>
        </div>
        <p>Kit stays with the player when Gear does not.</p>
      </div>
      <article className={`kit-row${offer.affordable || offer.owned ? "" : " is-unaffordable"}`}>
        <div className="kit-copy">
          <h3>Auto-Thrower</h3>
          <p>Throws again the instant each Rewind finishes.</p>
          <ProjectedNight store={store} />
        </div>
        <div className="kit-purchase">
          <span className="kit-price">{formatNumber(offer.price)} Style</span>
          <button
            className="action-button kit-buy-button"
            type="button"
            disabled={!offer.affordable}
            onClick={store.buyAutoThrower}
          >
            {offer.owned ? "Owned" : "Buy Auto-Thrower"}
          </button>
        </div>
      </article>
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

export function App({ store, saveWasUnreadable = false }: AppProps) {
  const shop = useSyncExternalStore(
    store.subscribeToGearShop,
    store.getGearShop,
    store.getGearShop,
  );
  const autoThrowerOffer = useSyncExternalStore(
    store.subscribeToAutoThrowerOffer,
    store.getAutoThrowerOffer,
    store.getAutoThrowerOffer,
  );

  return (
    <main className="shell">
      <header className="brand" aria-label="Idle Yoyo">
        <span className="brand-mark" aria-hidden="true">
          O
        </span>
        <span>IDLE YOYO</span>
      </header>

      {saveWasUnreadable ? <UnreadableSaveWarning /> : null}

      <AbsenceSummary store={store} />

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

      <KitShop offer={autoThrowerOffer} store={store} />

      <p className="footnote">Throw again when the yoyo returns to your hand.</p>
    </main>
  );
}
