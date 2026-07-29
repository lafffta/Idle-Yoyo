# The shell ticks from the wall clock

The shell records the device timestamp of its last tick and calls
\`advance(state, (now - lastTick) / 1000)\` on every animation frame. \`requestAnimationFrame\`
schedules work; its callback timestamp is never the source of elapsed game time.

## Why

The game must resolve a visible frame, a hidden tab, a sleeping laptop and eventually a reopened
save through the same path. A wall-clock delta makes those cases differ only in size. When frames
pause, the next tick naturally carries the whole gap into the ordinary simulation.

Frame deltas were rejected because they describe only time delivered by the rendering scheduler.
Browsers throttle or stop that scheduler while a page is hidden, which would make time disappear
and invite a separate catch-up implementation. ADR 0002 already forbids that divergence in the
core; the shell keeps the same promise.

The clock is injected into the store so this policy is testable without a browser. Negative clock
corrections remain harmless because \`advance\` clamps negative deltas to zero.

## Consequences

The live state and the last timestamp belong to a plain store outside React. A frame asks the store
to tick and then reads it directly. React never owns or subscribes to per-frame state.

The device clock can be changed by the player. ADR 0008 already accepts that tradeoff for a local,
single-player game.
