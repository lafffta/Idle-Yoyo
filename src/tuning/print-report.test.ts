import { beforeAll, describe, expect, it, vi } from "vitest";

import { simulate } from "./simulate.js";
import type { Timeline } from "./timeline.js";
import { CANONICAL_TIMELINE } from "./timeline.js";

let renderReport: typeof import("./print-report.js").renderReport;

beforeAll(async () => {
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

  try {
    ({ renderReport } = await import("./print-report.js"));
  } finally {
    consoleLogSpy.mockRestore();
  }
});

const session = (seconds: number): Timeline[number] => ({ kind: "Session", seconds });
const absence = (seconds: number): Timeline[number] => ({ kind: "Absence", seconds });

describe("the printed Report", () => {
  it("says an unattended Absence earned nothing without denying that it happened", () => {
    // Exactly the third Throw Cycle boundary — the opening cycle plus two ordinary ones — so
    // the Session closes with the yoyo Ready and no Sleeper left on the string to earn from
    // during the Absence that follows. Any longer and #71's engaged player reaches the
    // Auto-Thrower's price before this Session ends, leaving no unattended Absence to print.
    const timeline: Timeline = [
      session(23.25),
      absence(28_800),
      session(1_800),
      absence(28_800),
      session(900),
    ];

    const report = renderReport(timeline, simulate(timeline));

    expect(report).toContain(
      "the player was away without an Auto-Thrower and earned no Style",
    );
    expect(report).toContain("improvement over that Absence is unbounded");
    expect(report).not.toContain("Never away without one");
  });

  it("says the player was never away without one when the Auto-Thrower came first", () => {
    const report = renderReport(CANONICAL_TIMELINE, simulate(CANONICAL_TIMELINE));

    expect(report).toContain("the Auto-Thrower was bought before the player was first away");
    expect(report).toContain("there is no unattended night in this run to price it against");
  });
});
