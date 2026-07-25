# A static web app around a pure simulation core

Idle Yoyo ships as a static single-page web app with no backend, saving to localStorage. Inside it sits a simulation core with no dependencies, no DOM access, and no clock of its own:

```ts
advance(state: GameState, seconds: number): GameState
```

Everything else in the codebase is a shell around that function.

## Why the core is pure

ADR 0002 commits to offline progress being the ordinary simulation run forward, with no second code path. That commitment is only credible if there is literally one implementation, and it is only *verifiable* if that implementation can be driven from a test without a browser, a frame loop, or a wall clock.

A pure `advance` gives both. A unit test can fast-forward eight hours in a millisecond and assert on the result, which is the only practical way to check that a player's overnight absence resolves the way we think it does. The same function is called every frame while the tab is open and once with a large delta when it is reopened, and there is no third caller.

The core owns time as a parameter, never as an ambient fact. Nothing inside it may call `Date.now()`.

## The shell

**Vite and React** for the shop, the Division ladders, the Retire screen and modals — list-and-state UI, which is what React is for, and there are five parallel Trick ladders' worth of repetitive rows to render.

**Two things escape React deliberately.** The Style ticker updates through a ref rather than component state, and the yoyo is a canvas driven by its own `requestAnimationFrame` loop reading simulation state directly. Per-frame simulation state must never enter React state — that is the specific failure mode this stack invites, and naming it here is most of the defence against it.

A rendering engine (PixiJS, Phaser) was considered and rejected: roughly four-fifths of the screen is a shop and numbers, which engines are bad at, and that is a large dependency to carry for one animated object.

## Numbers

Plain `float64`, with a display formatter (K/M/B/T, then scientific). One prestige layer over twelve tiers puts the endgame somewhere around 1e25–1e40, comfortably inside float64's ~1e308, and precision loss above 2^53 is irrelevant when Style renders to three significant figures.

This is safe *because* of ADR 0005's single prestige layer, and it is the one decision here that a later change of heart would invalidate. A `break_infinity.js`-style decimal was rejected for making every arithmetic operation a method call — which would cost the pure core its ability to just use `*` and `+`, and buy headroom we have deliberately designed away. `BigInt` was rejected because Style accrues fractionally by design.

## Time and the device clock

Offline resolution reads the device clock, so a player can set it forward and mint Style. We do not defend against this. The game is single-player, has no leaderboard and sells nothing; a player who skips ahead is skipping their own game, and any defence would mean either a network dependency on a deliberately offline-capable app or an offline-specific rule of the kind ADR 0002 forecloses.

One guard exists, and it is not anti-cheat: **negative deltas clamp to zero**. A clock moving backwards — timezone changes, NTP corrections, daylight saving — must never feed `advance` a negative time step and corrupt state.

## Considered Options

- **Native mobile** — where idle games actually earn, with push notifications for a dead yoyo and real background handling. Rejected for now as store friction, a build toolchain and device testing, all incurred before the core loop has been played by anyone.
- **Desktop or Steam** — a premium purchase with no monetization compromises. Rejected as the smallest audience for an idler, and offline simulation is least interesting when the app is a window left open.
- **Vanilla TypeScript, no framework** — no reconciler between us and a per-frame loop, and immune to the re-render trap above. A close call, rejected because hand-rolling roughly fifty Trick rows and every shop item is exactly the work components exist to remove.

## Consequences

The core is testable, deterministic and portable. If a native client is ever built, `advance` moves across unchanged and only the shell is rewritten — which is the strongest argument for the split and worth protecting even when a shortcut through it looks cheap.

Save format is a serialisation of `GameState` plus a timestamp, so the shape of that type is a compatibility surface from the first save onwards. It needs a version field before anyone else plays it, not after.

Twelve tiers of persistent Tricks means `GameState` accumulates a lot of small permanent facts. Returning a fresh state object every frame from `advance` will allocate heavily; expect to mutate in place behind the pure signature, or to split per-frame state from permanent state, once the frame budget says so.
