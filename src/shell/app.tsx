import { useEffect, useRef } from "react";

import { formatNumber } from "./format.js";
import type { GameStore } from "./store.js";
import { YoyoCanvas } from "./yoyo-canvas.js";

type AppProps = {
  store: GameStore;
};

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
    <output ref={output} className="style-value" aria-label="Current Style">
      {formatNumber(store.getState().style)}
    </output>
  );
}

export function App({ store }: AppProps) {
  return (
    <main className="shell">
      <header className="brand" aria-label="Idle Yoyo">
        <span className="brand-mark" aria-hidden="true">
          O
        </span>
        <span>IDLE YOYO</span>
      </header>

      <section className="game-stage" aria-label="Opening Throw">
        <div className="canvas-card">
          <p className="eyebrow">Live Throw Cycle</p>
          <YoyoCanvas store={store} />
        </div>

        <div className="style-card" aria-labelledby="style-heading">
          <p className="eyebrow">Opening Throw</p>
          <h1 id="style-heading">Style</h1>
          <StyleTicker store={store} />
          <p className="caption">Earned by the Sleeper on the string.</p>
        </div>
      </section>

      <p className="footnote">One Throw. Watch the pace change as its Spin runs down.</p>
    </main>
  );
}
