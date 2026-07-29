# The shell and core have separate TypeScript configurations

\`tsconfig.json\` checks the simulation core and tuning harness with \`ES2022\` and Node types, but no
DOM library. \`tsconfig.app.json\` checks the browser shell separately and adds DOM, Vite and React
JSX types.

## Why

ADR 0008 prohibits the core from reading a clock or browser global. Leaving \`document\`, \`window\`
and browser timers out of its compiler environment turns that rule into a type error rather than
a convention. The shell genuinely needs those APIs, so adding DOM types to the one existing
configuration would quietly remove the stronger guard from every core and tuning source file.

The application configuration imports core modules to bundle them, so those modules are also seen
in a browser-aware compilation. That does not weaken the guard: the ordinary typecheck always runs
the DOM-free core configuration as an independent pass.

## Consequences

Every typecheck and production build runs both configurations. New core and tuning files belong in
the DOM-free configuration; new browser files belong under \`src/shell\` and are checked by the app
configuration.

There is some duplicated compiler work where the app imports the core. That small cost buys a
compile-time architecture boundary without introducing a package or build-workspace split.
