/**
 * The play pattern the harness assumes.
 *
 * Authored here and nowhere else, so that changing what a player's first few days look like is
 * a single edit rather than a search. The tests import the same timeline the printing script
 * does, for the same reason.
 */

/**
 * A stretch of the player's own time — a Session with the game open, or an Absence with it
 * closed.
 *
 * Not to be confused with Uptime, which is a fraction of a single Throw Cycle. The two never
 * appear in the same calculation, and `CONTEXT.md` keeps them apart deliberately.
 */
export type Period =
  | { readonly kind: "Session"; readonly seconds: number }
  | { readonly kind: "Absence"; readonly seconds: number };

/** An ordered list of Sessions and Absences. The harness's only input. */
export type Timeline = readonly Period[];

const minutes = (count: number): number => count * 60;
const hours = (count: number): number => count * 60 * 60;

/**
 * How long the first Session lasts.
 *
 * **A product assumption, not a derived value.** Nothing in the game produces this number: it is
 * our claim about how long a new player gives Idle Yoyo before deciding whether to come back.
 * It is a guess, and it is the assumption in this file most worth revisiting.
 *
 * It is called out on its own because every "within the first Session" judgement the harness
 * ever makes is measured against it — including ADR 0002's retention promise, which is the
 * reason the harness exists. If this is wrong, the pass/fail on that promise is wrong with it,
 * and that should be visible rather than buried in a list of durations.
 */
export const FIRST_SESSION_SECONDS = minutes(20);

/**
 * The canonical timeline: six Sessions and five Absences, three overnights among them, and
 * about an hour and a half of actual play.
 *
 * Every other duration here is ordinary scheduling — a night, an afternoon, a quarter of an
 * hour after work — and none carries the weight `FIRST_SESSION_SECONDS` does.
 */
export const CANONICAL_TIMELINE: Timeline = [
  { kind: "Session", seconds: FIRST_SESSION_SECONDS },
  { kind: "Absence", seconds: hours(8) },
  { kind: "Session", seconds: minutes(15) },
  { kind: "Absence", seconds: hours(4) },
  { kind: "Session", seconds: minutes(15) },
  { kind: "Absence", seconds: hours(8) },
  { kind: "Session", seconds: minutes(15) },
  { kind: "Absence", seconds: hours(4) },
  { kind: "Session", seconds: minutes(15) },
  { kind: "Absence", seconds: hours(8) },
  { kind: "Session", seconds: minutes(15) },
];
