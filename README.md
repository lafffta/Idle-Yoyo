# Idle-Yoyo

An idle game in which the player throws a yoyo and earns Style while it spins at the end of
the string. `CONTEXT.md` is the domain glossary; `docs/adr/` records why the design is
shaped the way it is.

## Running it

```sh
npm install
npm test        # the test suite
npm run typecheck
npm run build   # compiles the core to dist/
```

There is no shell yet — the simulation core in `src/core/` is headless and driven from its
tests. Everything the game does with time goes through one function:

```ts
advance(state: GameState, seconds: number): GameState
```

It is pure, has no dependencies, and has no clock of its own. The same call runs a frame
and resolves an overnight absence, because time is a parameter rather than an ambient fact
(ADR 0002, ADR 0008).
