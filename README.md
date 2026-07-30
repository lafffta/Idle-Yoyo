# Idle-Yoyo

An idle game in which the player throws a yoyo and earns Style while it spins at the end of
the string. `CONTEXT.md` is the domain glossary; `docs/adr/` records why the design is
shaped the way it is.

## Running it

```sh
npm install
npm run dev    # starts the game shell
npm test        # the test suite
npm run typecheck
npm run build   # builds the production app in dist/
```

The React shell in `src/shell/` runs the game in the browser. Its simulation core in
`src/core/` remains headless and is driven independently from its tests. Everything the
game does with time goes through one function:

```ts
advance(state: GameState, seconds: number): GameState
```

It is pure, has no dependencies, and has no clock of its own. The same call runs a frame
and resolves an overnight absence, because time is a parameter rather than an ambient fact
(ADR 0002, ADR 0008).
