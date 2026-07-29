import { useEffect, useRef } from "react";

import { rewindDuration, throwPower } from "../core/simulation.js";
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
): void {
  context.clearRect(0, 0, size.width, size.height);

  const hand = { x: size.width / 2, y: 38 };
  const yoyo = yoyoPosition(state, size);
  const spinRatio =
    state.phase === "Sleeping" ? clamp(state.spin / Math.max(throwPower(state), 1), 0, 1) : 0;

  drawString(context, hand, yoyo);
  drawHand(context, hand);
  drawYoyo(context, yoyo, angle, spinRatio);
}

export function YoyoCanvas({ store }: YoyoCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;

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
      if (state.phase === "Sleeping") {
        angle = (angle + state.spin * SPIN_TO_RADIANS_PER_SECOND * drawStep) % (Math.PI * 2);
      }

      drawScene(context, prepareCanvas(element, context), state, angle);
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [store]);

  return (
    <canvas ref={canvas} className="yoyo-canvas" role="img" aria-label="A yoyo on its string">
      A yoyo whose motion follows the current Throw Cycle.
    </canvas>
  );
}
