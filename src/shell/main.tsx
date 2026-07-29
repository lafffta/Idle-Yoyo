import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app.js";
import {
  loadSave,
  startSaving,
  type SaveHost,
} from "./save.js";
import { createGameStore } from "./store.js";
import "./styles.css";

const root = document.querySelector<HTMLElement>("#root");

if (!root) throw new Error("Idle Yoyo could not find its page root.");

const loaded = loadSave({ storage: window.localStorage, now: Date.now });
const saved = loaded.saved;

// The live GameState and the save lifecycle stay outside React (ADRs 0008 and 0011).
const store = createGameStore({
  now: Date.now,
  ...(saved === null
    ? {}
    : { restored: { tickedAt: saved.savedAt, state: saved.state } }),
});
// Resolve a restored Absence through the ordinary tick before the first player-visible render.
store.tick();
const saveHost: SaveHost = {
  isVisible: () => document.visibilityState === "visible",
  onVisibilityChange: (listener) => {
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
  every: (milliseconds, listener) => {
    const interval = window.setInterval(listener, milliseconds);
    return () => window.clearInterval(interval);
  },
};

startSaving({
  store,
  storage: window.localStorage,
  host: saveHost,
});

createRoot(root).render(
  <StrictMode>
    <App store={store} saveWasUnreadable={loaded.status === "unreadable"} />
  </StrictMode>,
);
