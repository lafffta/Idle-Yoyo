import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { formatNumber } from "./format.js";
import type {
  AbsenceSummary as AbsenceSummaryState,
  AttemptResolution,
  AutoThrowerOffer,
  GameStore,
  GearOffer,
  GearShop as GearShopState,
  TrickLadder as TrickLadderState,
  TrickRow as TrickRowState,
} from "./store.js";
import { YoyoCanvas } from "./yoyo-canvas.js";

type AppProps = {
  store: GameStore;
  saveWasUnreadable?: boolean;
};

const THROW_READY_COPY = "Ready to Throw.";
const THROW_WAITING_COPY = "Available when the yoyo is back in hand.";

/** The plan's onboarding line, kept inline and non-blocking rather than behind a second modal. */
const TRICK_LADDER_COPY =
  "Attempts drain Spin. Land a Trick to multiply Style permanently. Run out of Spin and the Yoyo dies.";
const ATTEMPT_WAITING_COPY = "Available while the yoyo is a Sleeper.";

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

function SustainedStyleGuide({ store }: AppProps) {
  const isVisible = useSyncExternalStore(
    store.subscribeToSustainedStyleGuide,
    store.isSustainedStyleGuideVisible,
    store.isSustainedStyleGuideVisible,
  );

  if (!isVisible) return null;

  return (
    <section className="style-guide" aria-label="Understanding Sustained Style">
      <div className="style-guide-copy">
        <p className="eyebrow">Your first Throw Cycle</p>
        <h2>Why Sustained Style holds still</h2>
        <p>
          As the yoyo slows, the live Style rate falls with its Spin. Sustained Style is the
          average across the whole Throw Cycle, so it stays useful when you compare Gear.
        </p>
      </div>

      <figure className="style-guide-figure">
        <svg
          className="style-guide-chart"
          viewBox="0 0 366 190"
          role="img"
          aria-labelledby="style-guide-chart-title style-guide-chart-description"
        >
          <title id="style-guide-chart-title">
            Live Style rate falls through a Throw Cycle while Sustained Style stays level
          </title>
          <desc id="style-guide-chart-description">
            The live Style rate slopes down to zero during the Sleeper and remains at zero during
            Rewind. The Sustained Style average is one level line across both phases.
          </desc>
          <rect className="style-guide-sleeper" x="32" y="22" width="213" height="124" />
          <rect className="style-guide-rewind" x="245" y="22" width="89" height="124" />
          <line className="style-guide-axis" x1="32" y1="146" x2="334" y2="146" />
          <polyline className="style-guide-live-rate" points="32,34 245,146 334,146" />
          <line className="style-guide-average" x1="32" y1="107" x2="334" y2="107" />
          <text className="style-guide-live-label" x="42" y="42">
            Live Style rate
          </text>
          <text className="style-guide-average-label" x="168" y="99">
            Sustained Style average
          </text>
          <text className="style-guide-phase-label" x="118" y="167">
            Sleeper
          </text>
          <text className="style-guide-phase-label" x="262" y="167">
            Rewind
          </text>
        </svg>
        <figcaption>
          Rewind earns no Style. The average does not dip during Rewind because it already includes
          that quiet part of every Throw Cycle.
        </figcaption>
      </figure>

      <button
        className="action-button"
        type="button"
        onClick={store.dismissSustainedStyleGuide}
      >
        Got it
      </button>
    </section>
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

function outcomeExplanation(summary: AbsenceSummaryState): string {
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

function attemptResolutionExplanation(resolution: AttemptResolution): string {
  return resolution.landed
    ? `It also landed ${resolution.trickName} while you were away.`
    : `Its Attempt at ${resolution.trickName} killed the Yoyo while you were away.`;
}

function absenceExplanation(summary: AbsenceSummaryState): string {
  return summary.attemptResolution === null
    ? outcomeExplanation(summary)
    : `${outcomeExplanation(summary)} ${attemptResolutionExplanation(summary.attemptResolution)}`;
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

function attemptForecastCopy(store: GameStore, trickId: TrickRowState["id"]): string {
  const forecast = store.getAttemptForecast(trickId);
  if (forecast === null) return ATTEMPT_WAITING_COPY;

  // Exact, never hedged: linear decay makes the whole Attempt knowable before it begins, and
  // ADR 0007 asks for a figure like this to be stated at full confidence (ADR 0001, ADR 0014).
  return forecast.outcome.lands
    ? `Lands with ${formatNumber(forecast.outcome.spinOnLanding)} Spin still turning.`
    : `Runs out of Spin after ${formatNumber(forecast.outcome.secondsUntilDeath)}s, and the Yoyo dies.`;
}

/**
 * The forecast falls with the Sleeper, so it is written straight to the DOM each frame rather
 * than re-rendering the ladder sixty times a second — the Style balance is kept live the same
 * way. The frame loop reads the simulation; it never advances it.
 */
function AttemptForecast({ store, trickId }: AppProps & { trickId: TrickRowState["id"] }) {
  const forecast = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let frame: number;

    const redraw = () => {
      if (forecast.current) forecast.current.textContent = attemptForecastCopy(store, trickId);
      frame = requestAnimationFrame(redraw);
    };

    frame = requestAnimationFrame(redraw);
    return () => cancelAnimationFrame(frame);
  }, [store, trickId]);

  return (
    <p ref={forecast} className="trick-forecast">
      {attemptForecastCopy(store, trickId)}
    </p>
  );
}

function TrickRow({
  row,
  ladder,
  store,
}: {
  row: TrickRowState;
  ladder: TrickLadderState;
  store: GameStore;
}) {
  const isNext = row.status === "next";

  return (
    <article className={`trick-row is-${row.status}`}>
      <div className="trick-copy">
        <h3>{row.name}</h3>
        <span className="trick-terms">
          {formatNumber(row.durationSeconds)}s · ×{formatNumber(row.styleMultiplier)} Style
        </span>
        {isNext && ladder.attempting !== null ? (
          <p className="trick-forecast" aria-live="polite">
            {ladder.attempting} in progress. An Attempt cannot be cancelled.
          </p>
        ) : null}
        {isNext && ladder.attempting === null ? (
          <AttemptForecast store={store} trickId={row.id} />
        ) : null}
      </div>

      {isNext ? (
        <div className="trick-purchase">
          <button
            className="action-button trick-attempt-button"
            type="button"
            disabled={!ladder.attemptable}
            onClick={() => store.attemptTrick(row.id)}
          >
            {/* Never refused for being fatal: the player has been shown the cost (ADR 0004). */}
            {ladder.lands === false ? "Attempt anyway" : `Attempt ${row.name}`}
          </button>
        </div>
      ) : (
        <span className="trick-state">
          {row.status === "landed" ? "Landed" : `Land ${row.requires} first`}
        </span>
      )}
    </article>
  );
}

/**
 * The 1A Division: every Trick the slice ships, in the order they must be landed. No 2A–5A rows
 * — the plan asks that locked Divisions are not advertised before their progression exists.
 */
function TrickLadder({ store }: AppProps) {
  const ladder = useSyncExternalStore(
    store.subscribeToTrickLadder,
    store.getTrickLadder,
    store.getTrickLadder,
  );

  return (
    <section className="trick-ladder" aria-labelledby="trick-ladder-heading">
      <div className="trick-ladder-heading">
        <div>
          <p className="eyebrow">1A Division</p>
          <h2 id="trick-ladder-heading">Learn a Trick</h2>
        </div>
        <p>{TRICK_LADDER_COPY}</p>
      </div>
      <div className="trick-list">
        {ladder.rows.map((row) => (
          <TrickRow key={row.id} row={row} ladder={ladder} store={store} />
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

      <SustainedStyleGuide store={store} />

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

      <TrickLadder store={store} />

      <GearShop shop={shop} store={store} />

      <KitShop offer={autoThrowerOffer} store={store} />

      <p className="footnote">Throw again when the yoyo returns to your hand.</p>
    </main>
  );
}
