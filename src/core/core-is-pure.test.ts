import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * ADR 0008 puts the simulation core behind `advance(state, seconds)` and says nothing
 * inside it may read a clock or reach for the outside world: time is a parameter, never an
 * ambient fact, and the core must be able to move to a native client unchanged.
 *
 * That rule is invisible in ordinary tests — a `Date.now()` slipped into the core would
 * still pass every behavioural test in the suite, because two calls in the same run agree
 * with each other. So this reads the core's own source and fails on the ways it could stop
 * being pure. It exists specifically to fail if someone reaches for the wall clock, and it
 * is not an arbitrary lint rule.
 */

const coreDirectory = dirname(fileURLToPath(import.meta.url));

const sourceFiles = readdirSync(coreDirectory)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
  .map((name) => ({ name, source: readFileSync(join(coreDirectory, name), "utf8") }));

/** Ways of asking the outside world what time it is, or what it feels like. */
const ambient = [/\bDate\s*\./, /\bnew\s+Date\b/, /\bperformance\s*\./, /\bMath\s*\.\s*random\b/];

/** Ways of scheduling, fetching, or touching a document instead of returning a state. */
const outsideWorld = [
  /\bsetTimeout\b/,
  /\bsetInterval\b/,
  /\bfetch\s*\(/,
  /\bdocument\b/,
  /\bwindow\b/,
];

describe("the simulation core", () => {
  it("has source files to check", () => {
    expect(sourceFiles.map((file) => file.name)).toContain("simulation.ts");
  });

  it.each(sourceFiles)("keeps no clock of its own in $name", ({ source }) => {
    for (const pattern of ambient) expect(source).not.toMatch(pattern);
  });

  it.each(sourceFiles)("reaches for nothing outside itself in $name", ({ source }) => {
    for (const pattern of outsideWorld) expect(source).not.toMatch(pattern);
  });

  it.each(sourceFiles)("imports nothing but its own modules in $name", ({ source }) => {
    const specifiers = [...source.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+["']([^"']+)["']/g)];

    for (const [, specifier] of specifiers) expect(specifier).toMatch(/^\.{1,2}\//);
  });
});
