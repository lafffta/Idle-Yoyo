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
  .map((name) => ({ name, code: codeIn(readFileSync(join(coreDirectory, name), "utf8")) }));

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

/**
 * The source with its comments removed, leaving only what executes.
 *
 * It walks the text rather than running a pair of regexes over it, because a regex cannot tell
 * a comment from a slash inside a string. Blanking too much is the dangerous direction: eating
 * the rest of a line that merely contained a URL would hide whatever followed, and the guard
 * would weaken silently instead of getting noisy. Newlines inside block comments are kept so
 * the result still lines up with the original.
 *
 * Known limit: a regex literal containing `//` or `/*` would be read as a comment. The core has
 * no regex literals, and erring here costs a confusing failure rather than a missed one.
 */
function codeIn(source: string): string {
  let code = "";
  let index = 0;

  while (index < source.length) {
    const character = source.charAt(index);
    const pair = source.substring(index, index + 2);

    if (pair === "//") {
      while (index < source.length && source.charAt(index) !== "\n") index++;
      continue;
    }

    if (pair === "/*") {
      const closes = source.indexOf("*/", index + 2);
      const after = closes === -1 ? source.length : closes + 2;

      for (let scan = index; scan < after; scan++) {
        if (source.charAt(scan) === "\n") code += "\n";
      }
      index = after;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      code += character;
      index++;

      while (index < source.length) {
        const inString = source.charAt(index);
        code += inString;
        index++;

        if (inString === "\\") {
          code += source.charAt(index);
          index++;
          continue;
        }
        if (inString === character) break;
      }
      continue;
    }

    code += character;
    index++;
  }

  return code;
}

describe("reading a source file for what it executes", () => {
  it("does not see a hazard named in a line comment", () => {
    const source = ["// Nothing in here may call Date.now().", "const spin = 100;"].join("\n");

    expect(codeIn(source)).not.toMatch(/\bDate\s*\./);
  });

  it("does not see a hazard named in a JSDoc block, which is where the rule belongs", () => {
    const source = [
      "/**",
      " * Time is a parameter, never an ambient fact: nothing here may call Date.now(),",
      " * and the core touches no document and no window.",
      " */",
      "export function advance() {}",
    ].join("\n");

    expect(codeIn(source)).not.toMatch(/\bDate\s*\./);
    expect(codeIn(source)).not.toMatch(/\bdocument\b/);
    expect(codeIn(source)).not.toMatch(/\bwindow\b/);
  });

  it("still sees a hazard that actually executes", () => {
    const source = ["// A clock is named here, and reached for below.", "const now = Date.now();"].join("\n");

    expect(codeIn(source)).toMatch(/\bDate\s*\./);
  });

  it("does not mistake a slash inside a string for the start of a comment", () => {
    // Over-blanking is the dangerous direction. A stripper that ate the rest of this line
    // would hide the clock behind it, and the guard would weaken silently rather than
    // getting noisy — the one failure mode a guard must not have.
    const source = 'const adr = "https://example.com/adr"; const now = Date.now();';

    expect(codeIn(source)).toMatch(/\bDate\s*\./);
  });
});

describe("the simulation core", () => {
  it("has source files to check", () => {
    expect(sourceFiles.map((file) => file.name)).toContain("simulation.ts");
  });

  it.each(sourceFiles)("keeps no clock of its own in $name", ({ code }) => {
    for (const pattern of ambient) expect(code).not.toMatch(pattern);
  });

  it.each(sourceFiles)("reaches for nothing outside itself in $name", ({ code }) => {
    for (const pattern of outsideWorld) expect(code).not.toMatch(pattern);
  });

  it.each(sourceFiles)("imports nothing but its own modules in $name", ({ code }) => {
    const specifiers = [...code.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+["']([^"']+)["']/g)];

    for (const [, specifier] of specifiers) expect(specifier).toMatch(/^\.{1,2}\//);
  });
});
