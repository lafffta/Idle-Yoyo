import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app.js";
import { createGameStore } from "./store.js";
import "./styles.css";

const root = document.querySelector<HTMLElement>("#root");

if (!root) throw new Error("Idle Yoyo could not find its page root.");

// The live GameState is deliberately created outside React and never enters component state.
const store = createGameStore({ now: Date.now });

createRoot(root).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
