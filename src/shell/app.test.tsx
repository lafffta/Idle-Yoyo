import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./app.js";
import { createGameStore } from "./store.js";

describe("the Throw control", () => {
  it("explains when Throw is unavailable and enables it when the yoyo is back in hand", () => {
    let now = 0;
    const store = createGameStore({ now: () => now });

    const duringSleeper = renderToStaticMarkup(<App store={store} />);
    expect(duringSleeper).toMatch(/<button[^>]*disabled=""[^>]*>Throw<\/button>/);
    expect(duringSleeper).toContain("Available when the yoyo is back in hand.");

    now = 8_000;
    store.tick();

    const whenReady = renderToStaticMarkup(<App store={store} />);
    expect(whenReady).toMatch(/<button(?![^>]*disabled)[^>]*>Throw<\/button>/);
    expect(whenReady).toContain("Ready to Throw.");
  });
});
