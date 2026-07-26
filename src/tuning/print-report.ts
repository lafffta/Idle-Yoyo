import type { GearLevels, Report, SessionRecord } from "./simulate.js";
import { simulate } from "./simulate.js";
import type { Timeline } from "./timeline.js";
import { CANONICAL_TIMELINE, FIRST_SESSION_SECONDS } from "./timeline.js";

/**
 * Prints the Report for the canonical timeline. Run it with `npm run tune`.
 *
 * Deliberately thin, and the only part of the harness that touches the outside world:
 * `simulate` stays pure so that tests can assert on the Report rather than on anything printed
 * here. Nothing in this file decides anything — if a figure looks wrong, it is wrong in the
 * Report, or in the game.
 *
 * The layout is a table because the point of the exercise is to change a constant and compare
 * two runs by eye.
 */

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  const parts = [
    [Math.floor(whole / 86_400), "d"],
    [Math.floor((whole % 86_400) / 3600), "h"],
    [Math.floor((whole % 3600) / 60), "m"],
    [whole % 60, "s"],
  ] as const;

  const said = parts.filter(([amount]) => amount > 0).map(([amount, unit]) => `${amount}${unit}`);
  return said.length > 0 ? said.join(" ") : "0s";
}

function formatStyle(style: number): string {
  return style.toFixed(2);
}

function formatGear(gear: GearLevels): string {
  return `${gear.throwPower} / ${gear.bearing} / ${gear.rewindSpeed}`;
}

const COLUMNS: readonly {
  readonly heading: string;
  readonly width: number;
  readonly of: (record: SessionRecord) => string;
}[] = [
  { heading: "#", width: 3, of: (record) => String(record.session) },
  { heading: "Session", width: 9, of: (record) => formatDuration(record.seconds) },
  {
    heading: "Away before",
    width: 13,
    of: (record) =>
      record.precedingAbsenceSeconds > 0 ? formatDuration(record.precedingAbsenceSeconds) : "—",
  },
  {
    heading: "Style away",
    width: 12,
    of: (record) =>
      record.precedingAbsenceSeconds > 0
        ? formatStyle(record.styleEarnedDuringPrecedingAbsence)
        : "—",
  },
  { heading: "Style earned", width: 14, of: (record) => formatStyle(record.styleEarned) },
  { heading: "Throws", width: 8, of: (record) => String(record.manualThrows) },
  {
    heading: "Sustained Style",
    width: 17,
    of: (record) => record.sustainedStyleAtClose.toFixed(4),
  },
  { heading: "Gear", width: 13, of: (record) => formatGear(record.gearAtClose) },
];

const headingRow = COLUMNS.map((column) => column.heading.padStart(column.width)).join("");

function sessionRow(record: SessionRecord): string {
  return COLUMNS.map((column) => column.of(record).padStart(column.width)).join("");
}

function totalSeconds(timeline: Timeline): number {
  return timeline.reduce((total, period) => total + period.seconds, 0);
}

function describeTimeline(timeline: Timeline): string {
  const sessions = timeline.filter((period) => period.kind === "Session");
  const absences = timeline.filter((period) => period.kind === "Absence");
  const played = formatDuration(totalSeconds(sessions));
  const elapsed = formatDuration(totalSeconds(timeline));

  return `${sessions.length} Sessions and ${absences.length} Absences — ${played} of play across ${elapsed}.`;
}

function print(timeline: Timeline, report: Report): void {
  const lines = [
    "Idle Yoyo — tuning harness",
    "",
    "Every constant in the game is provisional, and this Report describes the game exactly as",
    "it is configured today (ADR 0009). This player buys nothing at all: they earn and never",
    "spend, so the Gear levels below stand still by construction.",
    "",
    describeTimeline(timeline),
    `The first Session is assumed to last ${formatDuration(FIRST_SESSION_SECONDS)}. That is a` +
      " product assumption about how long a new",
    "player gives the game before deciding, not a value derived from anything, and every",
    "'within the first Session' judgement is measured against it.",
    "",
    "Gear reads Throw Power / Bearing / Rewind Speed.",
    "",
    headingRow,
    ...report.sessions.map(sessionRow),
    "",
    `Final Sustained Style   ${report.finalSustainedStyle.toFixed(4)} Style/s`,
    `Final Gear              Throw Power ${report.finalGear.throwPower}, ` +
      `Bearing ${report.finalGear.bearing}, Rewind Speed ${report.finalGear.rewindSpeed}`,
  ];

  console.log(lines.join("\n"));
}

print(CANONICAL_TIMELINE, simulate(CANONICAL_TIMELINE));
