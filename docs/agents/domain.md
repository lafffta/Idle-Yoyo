# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** One `CONTEXT.md` and one `docs/adr/` at the repo root. There is no `CONTEXT-MAP.md` and no per-package layout — this is a single package with one bounded context.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — the domain glossary.
- **`docs/adr/`** — read the ADRs that touch the area you are about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CLAUDE.md
├── CONTEXT.md                 ← the domain glossary
├── docs/
│   ├── adr/                   ← 0001–0008, the design decisions
│   ├── agents/                ← this file and its siblings
│   └── prototypes/            ← what a throwaway prototype settled
└── src/
    └── core/                  ← the pure simulation core (ADR 0008)
```

Should this repo ever grow a second bounded context, the multi-context form is a root `CONTEXT-MAP.md` pointing at one `CONTEXT.md` per context, with context-scoped ADRs under `src/<context>/docs/adr/`. Nothing here needs that today.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

This matters more than usual here. Every entry in `CONTEXT.md` carries an **_Avoid_** list of rejected synonyms, and they were chosen so that one idea has exactly one name — Spin is never "energy" or "RPM", Style is never "points" or "score", Retire is never "prestige" or "reset". Test names and issue titles are held to the same standard as code.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR 0003 (the Rewind period exists to keep Uptime meaningful) — but worth reopening because…_

Several ADRs here forbid things that would otherwise look like reasonable simplifications, and `CLAUDE.md` lists the ones most at risk. Removing one of those is never a cleanup; it is a decision to reopen an ADR, and it should be argued as one.
