import { useEffect, useRef, useSyncExternalStore } from "react";

import { activeAttempt, rewindDuration, throwPower } from "../core/simulation.js";
import type { GameState } from "../core/simulation.js";
import type { GameStore } from "./store.js";

type YoyoCanvasProps = {
  store: GameStore;
};

type CanvasSize = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

const YOYO_RADIUS = 38;
const SPIN_TO_RADIANS_PER_SECOND = 0.16;
const MAX_DRAW_STEP_SECONDS = 0.05;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function prepareCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): CanvasSize {
  const width = Math.max(canvas.clientWidth, 1);
  const height = Math.max(canvas.clientHeight, 1);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { width, height };
}

function drawHand(context: CanvasRenderingContext2D, position: Point): void {
  const { x, y } = position;
  context.save();
  context.fillStyle = "#81796b";
  context.strokeStyle = "#b0a797";
  context.lineWidth = 1.5;

  context.beginPath();
  context.ellipse(x, y, 27, 20, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.beginPath();
  context.ellipse(x + 25, y + 10, 13, 8, Math.PI / 5, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawString(
  context: CanvasRenderingContext2D,
  hand: Point,
  yoyo: Point,
): void {
  context.save();
  context.strokeStyle = "#c7bfae";
  context.lineWidth = 1.4;
  context.beginPath();
  context.moveTo(hand.x, hand.y + 14);
  context.lineTo(yoyo.x, yoyo.y - YOYO_RADIUS + 3);
  context.stroke();
  context.restore();
}

function drawSpeedArcs(
  context: CanvasRenderingContext2D,
  position: Point,
  spinRatio: number,
  angle: number,
): void {
  if (spinRatio <= 0) return;

  context.save();
  context.translate(position.x, position.y);
  context.rotate(angle * 0.35);
  context.strokeStyle = `rgba(222, 118, 75, ${0.14 + spinRatio * 0.48})`;
  context.lineWidth = 2;
  context.lineCap = "round";

  for (const offset of [0, Math.PI]) {
    context.beginPath();
    context.arc(0, 0, YOYO_RADIUS + 9, offset - 0.48, offset + 0.48);
    context.stroke();
  }

  context.restore();
}

function drawYoyo(
  context: CanvasRenderingContext2D,
  position: Point,
  angle: number,
  spinRatio: number,
): void {
  drawSpeedArcs(context, position, spinRatio, angle);

  context.save();
  context.translate(position.x, position.y);

  context.beginPath();
  context.arc(0, 0, YOYO_RADIUS + 7, 0, Math.PI * 2);
  context.fillStyle = "rgba(0, 0, 0, 0.18)";
  context.fill();

  context.rotate(angle);
  context.beginPath();
  context.arc(0, 0, YOYO_RADIUS, 0, Math.PI * 2);
  context.clip();

  const body = context.createRadialGradient(-12, -15, 2, 0, 0, YOYO_RADIUS);
  body.addColorStop(0, "#fff8e9");
  body.addColorStop(0.62, "#e9dfca");
  body.addColorStop(1, "#9d927f");
  context.fillStyle = body;
  context.fillRect(-YOYO_RADIUS, -YOYO_RADIUS, YOYO_RADIUS * 2, YOYO_RADIUS * 2);

  context.fillStyle = "#d6683e";
  context.fillRect(-YOYO_RADIUS, -7, YOYO_RADIUS * 2, 14);
  context.fillStyle = "rgba(39, 36, 31, 0.7)";
  context.fillRect(-4, -YOYO_RADIUS, 8, YOYO_RADIUS * 2);
  context.restore();

  context.save();
  context.translate(position.x, position.y);
  context.strokeStyle = "#f4f0e6";
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(0, 0, YOYO_RADIUS, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#2b2823";
  context.beginPath();
  context.arc(0, 0, 7, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#d3c9b6";
  context.lineWidth = 1;
  context.stroke();
  context.restore();
}

/**
 * Rock the Baby: the string is pinched into a triangular cradle and the yoyo swings inside it.
 *
 * Stylised rather than simulated, but the defining motion is kept — a cradle, and a yoyo rocking
 * across it — so that learning this Trick does not look like filling a progress bar. Every figure
 * it draws comes from `progress`, which is core Attempt state (ADR 0014): the shell runs no
 * second timer, so the picture cannot drift from the simulation resolving it.
 *
 * Drawn for Rock the Baby and for nothing else. Landing it opens the next row on the same
 * Sleeper, so a Trapeze Attempt is already reachable, and drawing a cradle for one would be the
 * wrong Trick performed convincingly — worse than no motion at all. The others fall back to the
 * plain string until #68 and #69 give them the distinct motions the plan asks for.
 */
function drawCradle(
  context: CanvasRenderingContext2D,
  hand: Point,
  yoyo: Point,
  progress: number,
): void {
  const apex = { x: hand.x, y: hand.y + 16 };
  const spread = 46 + 10 * Math.sin(progress * Math.PI);
  const base = yoyo.y + YOYO_RADIUS * 0.5;

  context.save();
  context.strokeStyle = "#c7bfae";
  context.lineWidth = 1.4;
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(apex.x, apex.y);
  context.lineTo(apex.x - spread, base);
  context.lineTo(apex.x + spread, base);
  context.closePath();
  context.stroke();
  context.restore();
}

/**
 * How far the yoyo has swung across the cradle, from one side to the other and back.
 *
 * Under reduced motion it does not swing at all: the yoyo holds the middle of the cradle and
 * the Attempt's progress is read from the arc drawn over it instead. The timing and the state
 * stay legible — what goes is the travel across the screen, which is the part that provokes.
 */
function swingOffset(progress: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.sin(progress * Math.PI * 3) * 34 * (1 - progress * 0.35);
}

function drawAttemptProgress(
  context: CanvasRenderingContext2D,
  position: Point,
  progress: number,
): void {
  context.save();
  context.translate(position.x, position.y);
  context.strokeStyle = "rgba(222, 118, 75, 0.85)";
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.arc(0, 0, YOYO_RADIUS + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  context.stroke();
  context.restore();
}

function rewindProgress(state: GameState): number {
  if (state.phase !== "Rewinding") return 0;
  return clamp(state.phaseElapsed / rewindDuration(state), 0, 1);
}

function yoyoPosition(state: GameState, { width, height }: CanvasSize): Point {
  const x = width / 2;
  const sleeperY = height - YOYO_RADIUS - 34;
  const readyY = 82;

  if (state.phase === "Sleeping") return { x, y: sleeperY };
  if (state.phase === "Ready") return { x, y: readyY };

  const progress = rewindProgress(state);
  const eased = 1 - (1 - progress) ** 3;
  const sway = Math.sin(progress * Math.PI * 4) * 12 * (1 - progress);
  return { x: x + sway, y: sleeperY + (readyY - sleeperY) * eased };
}

function drawScene(
  context: CanvasRenderingContext2D,
  size: CanvasSize,
  state: GameState,
  angle: number,
  reducedMotion: boolean,
): void {
  context.clearRect(0, 0, size.width, size.height);

  const hand = { x: size.width / 2, y: 38 };
  const resting = yoyoPosition(state, size);
  const attempt = activeAttempt(state);
  const rocking = attempt?.trick.id === "rock-the-baby";
  const yoyo =
    attempt !== null && rocking
      ? { x: resting.x + swingOffset(attempt.progress, reducedMotion), y: resting.y }
      : resting;
  const spinRatio =
    state.phase === "Sleeping" ? clamp(state.spin / Math.max(throwPower(state), 1), 0, 1) : 0;

  if (attempt !== null && rocking) drawCradle(context, hand, yoyo, attempt.progress);
  else drawString(context, hand, yoyo);

  drawHand(context, hand);
  drawYoyo(context, yoyo, angle, spinRatio);
  if (attempt !== null) drawAttemptProgress(context, yoyo, attempt.progress);
}

/**
 * What the canvas is showing, in words. The picture is the readout, so this is how it reads to
 * anyone not looking at it — and under reduced motion it is doing more of the work.
 */
function sceneDescription(attempting: string | null): string {
  if (attempting === null) return "A yoyo on its string";
  return `${attempting}: an Attempt in progress on the Sleeper`;
}

export function YoyoCanvas({ store }: YoyoCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ladder = useSyncExternalStore(
    store.subscribeToTrickLadder,
    store.getTrickLadder,
    store.getTrickLadder,
  );

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;

    // Read per frame rather than captured once, so that a player turning the preference on mid
    // Attempt gets the calmer picture immediately rather than at the next Throw.
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame: number;
    let angle = 0;
    let lastDrawnAt: number | undefined;

    const draw = (drawnAt: number) => {
      const state = store.getState();
      const drawStep =
        lastDrawnAt === undefined
          ? 0
          : Math.min((drawnAt - lastDrawnAt) / 1_000, MAX_DRAW_STEP_SECONDS);
      lastDrawnAt = drawnAt;

      // The frame timestamp controls the drawn angle only. Game time still comes exclusively
      // from the store's wall clock; pausing this loop cannot change simulation results.
      //
      // The spin is left turning under reduced motion: it is a readout rather than decoration —
      // ADR 0007 keeps the live Style rate off the screen as a digit and shows it as this motion
      // — and it neither travels nor scrolls. What the preference drops is the swing across the
      // cradle, which does.
      if (state.phase === "Sleeping") {
        angle = (angle + state.spin * SPIN_TO_RADIANS_PER_SECOND * drawStep) % (Math.PI * 2);
      }

      drawScene(context, prepareCanvas(element, context), state, angle, motionPreference.matches);
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [store]);

  return (
    <canvas
      ref={canvas}
      className="yoyo-canvas"
      role="img"
      aria-label={sceneDescription(ladder.attempting)}
    >
      A yoyo whose motion follows the current Throw Cycle.
    </canvas>
  );
}
