import type { GearLevels, Purchase, Report, SessionRecord } from "./simulate.js";
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

/** One column of a right-aligned fixed-width table. Both tables below are described this way. */
type Column<Row> = {
  readonly heading: string;
  readonly width: number;
  readonly of: (row: Row) => string;
};

function headingRowOf<Row>(columns: readonly Column<Row>[]): string {
  return columns.map((column) => column.heading.padStart(column.width)).join("");
}

function rowOf<Row>(columns: readonly Column<Row>[], row: Row): string {
  return columns.map((column) => column.of(row).padStart(column.width)).join("");
}

const SESSION_COLUMNS: readonly Column<SessionRecord>[] = [
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
  {
    heading: "Auto-Thrower",
    width: 14,
    of: (record) => {
      if (record.precedingAbsenceSeconds === 0) return "—";
      return record.autoThrowerDuringPrecedingAbsence ? "throwing" : "none";
    },
  },
  { heading: "Style earned", width: 14, of: (record) => formatStyle(record.styleEarned) },
  { heading: "By hand", width: 9, of: (record) => String(record.manualThrows) },
  {
    heading: "Nothing affordable",
    width: 20,
    of: (record) => formatDuration(record.secondsWithNothingAffordable),
  },
  { heading: "Saving", width: 8, of: (record) => formatDuration(record.secondsSpentSaving) },
  {
    heading: "Sustained Style",
    width: 17,
    of: (record) => record.sustainedStyleAtClose.toFixed(4),
  },
  { heading: "Bought", width: 8, of: (record) => String(record.purchases.length) },
  { heading: "Gear", width: 16, of: (record) => formatGear(record.gearAtClose) },
];

/**
 * Every purchase in the run, one to a line.
 *
 * Long rather than summarised on purpose: user story 7 asks that a bad pace be traceable to a
 * specific purchase, and a count per Session cannot do that. The table above is what two runs are
 * compared by; this is what a surprise in the table is read against.
 */
type PurchaseRow = { readonly session: number; readonly purchase: Purchase };

const PURCHASE_COLUMNS: readonly Column<PurchaseRow>[] = [
  { heading: "#", width: 3, of: (row) => String(row.session) },
  { heading: "At", width: 15, of: (row) => formatDuration(row.purchase.atSeconds) },
  { heading: "Bought", width: 15, of: (row) => row.purchase.item },
  { heading: "Price", width: 12, of: (row) => formatStyle(row.purchase.price) },
];

function purchaseRows(report: Report): PurchaseRow[] {
  return report.sessions.flatMap((record) =>
    record.purchases.map((purchase) => ({ session: record.session, purchase })),
  );
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

function describeUnboughtGear(report: Report): string {
  if (report.gearNeverBought.length === 0) return "none — every Gear row was bought at least once";
  return report.gearNeverBought.join(", ");
}

/**
 * The Auto-Thrower's own block, printed apart from the tables because it is the question the
 * harness was built to answer: ADR 0002 calls the price retention-critical and promises the
 * player reaches one before their first Session ends.
 *
 * A refusal is stated as plainly as a purchase. If the price exceeds what the nights ahead are
 * worth then declining is the right decision and this has to be able to say so — a Report that
 * could only describe a purchase could never tell anyone the price was wrong.
 */
function describeAutoThrower(report: Report): string[] {
  const autoThrower = report.autoThrower;
  const price = `Price                    ${formatStyle(autoThrower.price)} Style`;

  if (!autoThrower.bought) {
    return [
      "Bought                   no — the player declined it every time they could have bought it",
      "                         The Absences ahead were never worth its price, which is a finding",
      "                         about the price rather than a failure to find one.",
      `Throws made by hand      ${autoThrower.manualThrows}, all of them`,
      price,
    ];
  }

  const sessions = report.sessions.length;

  return [
    `Bought                   yes, ${formatDuration(autoThrower.atSeconds)} in, ` +
      `during Session ${autoThrower.session} of ${sessions}`,
    `Within the first Session ${autoThrower.inFirstSession ? "yes" : "no"} — ADR 0002 asks ` +
      `that it be, and the first Session ends at ${formatDuration(FIRST_SESSION_SECONDS)}`,
    `Throws made by hand      ${autoThrower.manualThrowsBefore} before it took over`,
    price,
  ];
}

/**
 * What an Absence earns with a machine working and what one earns without.
 *
 * The figures that quantify what the shop cannot show. Sustained Style does not move when an
 * Auto-Thrower is bought — `hasAutoThrower` appears nowhere in it — so the headline readout ADR
 * 0007 makes every other purchase legible through says nothing at all about this one.
 *
 * The counterfactual line is here for the run that matters most: a player who declines the
 * machine has no Absence with one working to compare against, and without it the most valuable
 * result the instrument can produce would print as a row of zeroes.
 *
 * Both a total and a rate, because either alone misleads. The rate is what makes two groups of
 * different length comparable; the total is what stops a one-minute Absence holding a whole
 * Sleeper from reading as a fine hourly income it could never sustain.
 */
function describeAbsences(report: Report): string[] {
  const working = report.absencesWithAutoThrower;
  const alone = report.absencesWithoutAutoThrower;
  const counterfactual =
    alone.seconds > 0 ? (report.styleAnAutoThrowerWouldHaveEarned * 3600) / alone.seconds : 0;
  const ratio = alone.style > 0 ? report.styleAnAutoThrowerWouldHaveEarned / alone.style : 0;

  const said: string[] = [];

  if (alone.absences > 0) {
    said.push(
      `Unattended Absences      ${formatStyle(alone.style)} Style across ${alone.absences} ` +
        `Absences (${formatStyle(alone.stylePerHour)} per hour away)`,
      `Those same Absences      ${formatStyle(report.styleAnAutoThrowerWouldHaveEarned)} Style ` +
        `had an Auto-Thrower been throwing (${formatStyle(counterfactual)} per hour)`,
    );
  }

  if (working.absences > 0) {
    said.push(
      `With an Auto-Thrower     ${formatStyle(working.style)} Style across ` +
        `${working.absences} Absences (${formatStyle(working.stylePerHour)} per hour away)`,
    );
  }

  if (ratio > 0) {
    said.push(`An Auto-Thrower is worth ${Math.round(ratio)}× the Style of an Absence without one`);
  } else if (alone.absences > 0) {
    said.push(
      "Unbounded comparison     the player was away without an Auto-Thrower and earned no Style,",
      "                         so the Auto-Thrower's improvement over that Absence is unbounded",
    );
  } else if (working.absences > 0) {
    // The comparison is missing because the game is doing what ADR 0002 asks, and a reader owed
    // the machine's worth should be told that rather than left looking for a line that is not
    // there. It is the one absence in this Report worth narrating.
    said.push(
      "Never away without one   the Auto-Thrower was bought before the player was first away,",
      "                         so there is no unattended night in this run to price it against",
    );
  }

  return said.length > 0
    ? said
    : ["The player was never away, so an Auto-Thrower could earn nothing."];
}

/**
 * The designer-facing Report is a testing seam: its claims are the behaviour this development
 * tool exposes, while the formatting helpers that assemble them remain private implementation.
 */
export function renderReport(timeline: Timeline, report: Report): string {
  const played = totalSeconds(timeline.filter((period) => period.kind === "Session"));

  const lines = [
    "Idle Yoyo — tuning harness",
    "",
    "Every constant in the game is provisional, and this Report describes the game exactly as",
    "it is configured today (ADR 0009). At every Throw Cycle boundary the player buys whatever",
    "is worth the most Style per Style spent over the play they have left, and keeps buying",
    "while anything is. The Auto-Thrower is one more row in that ranking, worth the Style the",
    "Absences ahead would earn with it less the little they earn without one, so the player is",
    "free to decline it forever.",
    "",
    "They will bank Style for a row they cannot yet afford, ranking it over what would be left",
    "of the run once they had saved for it — so a wait costs a purchase the earnings it gives",
    "up, and anything out of reach of the whole run is worth nothing and declines itself.",
    "",
    "It is a good rule and not the best one: buying now also shortens the wait for everything",
    "after it, which no rule ranking one purchase at a time can weigh. Read a time below as",
    "when this player got there, not as the earliest anyone could.",
    "",
    describeTimeline(timeline),
    `The first Session is assumed to last ${formatDuration(FIRST_SESSION_SECONDS)}. That is a` +
      " product assumption about how long a new",
    "player gives the game before deciding, not a value derived from anything, and every",
    "'within the first Session' judgement is measured against it.",
    "",
    "Gear reads Throw Power / Bearing / Rewind Speed.",
    "",
    headingRowOf(SESSION_COLUMNS),
    ...report.sessions.map((record) => rowOf(SESSION_COLUMNS, record)),
    "",
    "Purchases",
    headingRowOf(PURCHASE_COLUMNS),
    ...purchaseRows(report).map((row) => rowOf(PURCHASE_COLUMNS, row)),
    "",
    "The Auto-Thrower",
    ...describeAutoThrower(report),
    "",
    "What an Absence is worth",
    ...describeAbsences(report),
    "",
    `Final Sustained Style    ${report.finalSustainedStyle.toFixed(4)} Style/s`,
    `Final Gear               Throw Power ${report.finalGear.throwPower}, ` +
      `Bearing ${report.finalGear.bearing}, Rewind Speed ${report.finalGear.rewindSpeed}`,
    `Gear never bought        ${describeUnboughtGear(report)}`,
    // ADR 0003 puts a floor under the Rewind because the Bearing stops working without one.
    // Whether a player can actually reach it in three days is the question that decides whether
    // the floor is load-bearing in practice or only in principle.
    `Rewind at its floor      ${report.rewindReachedFloor ? "yes" : "no"}`,
    // Stretches with nothing in the shop the player could afford: they have already looked, and
    // there is nothing to do but watch until the next boundary. Affordability, not worth — a row
    // they can afford and decline is still a decision they got to make.
    `Nothing affordable       ${formatDuration(report.secondsWithNothingAffordable)} of ` +
      `${formatDuration(played)} played`,
    // The opposite finding, and never the same seconds: time the player spent holding Style they
    // could have spent, banking towards something dearer. Dead time means the shop opens above
    // what the game pays and the prices are wrong; this is the shop working.
    `Spent saving             ${formatDuration(report.secondsSpentSaving)} of ` +
      `${formatDuration(played)} played`,
  ];

  return lines.join("\n");
}

function print(timeline: Timeline, report: Report): void {
  console.log(renderReport(timeline, report));
}

print(CANONICAL_TIMELINE, simulate(CANONICAL_TIMELINE));
