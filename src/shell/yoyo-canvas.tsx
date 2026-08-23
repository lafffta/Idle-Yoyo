import { useEffect, useRef, useSyncExternalStore } from "react";

import { activeAttempt, rewindDuration, throwPower } from "../core/simulation.js";
import type { ActiveAttempt, GameState } from "../core/simulation.js";
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
 * Drawn for Rock the Baby and for nothing else: landing it opens Man on the Flying Trapeze, which
 * has its own motion below rather than borrowing this one, and drawing a cradle for it would be
 * the wrong Trick performed convincingly — worse than no motion at all.
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

/**
 * Man on the Flying Trapeze: the string is pinched into a bar overhead and the yoyo swings
 * beneath it in one wide pendulum pass, rather than the cradle's three quick rocks before it — a
 * different shape and a different rhythm, so the two Tricks read apart even side by side. Every
 * figure it draws comes from `progress`, the same core Attempt state the cradle reads (ADR 0014).
 *
 * Drawn for Man on the Flying Trapeze and for nothing else.
 */
function drawTrapezeBar(context: CanvasRenderingContext2D, hand: Point, yoyo: Point): void {
  const barY = hand.y + 30;
  const barHalfWidth = 30;

  context.save();
  context.strokeStyle = "#c7bfae";
  context.lineWidth = 1.4;
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(hand.x, hand.y + 14);
  context.lineTo(hand.x - barHalfWidth, barY);
  context.moveTo(hand.x, hand.y + 14);
  context.lineTo(hand.x + barHalfWidth, barY);
  context.moveTo(hand.x - barHalfWidth, barY);
  context.lineTo(hand.x + barHalfWidth, barY);
  context.moveTo(hand.x, barY);
  context.lineTo(yoyo.x, yoyo.y - YOYO_RADIUS + 3);
  context.stroke();
  context.restore();
}

/**
 * How far the yoyo has swung beneath the bar: one wide pass from side to side, lowest at the
 * centre of its arc and highest at either end — a pendulum on a fixed string, and a different
 * shape from the cradle's three quick rocks.
 *
 * Under reduced motion it holds the middle of its arc, the cradle's rule again: what goes is the
 * travel across the screen, not the state the Attempt is in.
 */
function trapezeOffset(progress: number, reducedMotion: boolean): Point {
  if (reducedMotion) return { x: 0, y: 0 };

  const lean = Math.sin(progress * Math.PI * 2);
  return { x: lean * 52, y: (1 - lean * lean) * 18 };
}

/**
 * Brain Twister: the string doubles over on itself and the crossing point slides down from the
 * hand toward the yoyo as the Attempt proceeds — the rig itself changes shape over the Attempt,
 * where the cradle only pulses a fixed triangle and the trapeze bar never moves at all. That
 * descent is drawn straight from `progress`, the same core Attempt state the other two read
 * (ADR 0014), so a twist that looks half-done is a Trick that is half-done.
 *
 * Drawn for Brain Twister and for nothing else, for the same reason the cradle and the bar are:
 * the earlier two Tricks get their own rig, and a twisted string standing in for either would be
 * the wrong Trick performed convincingly.
 */
function drawTwistedString(
  context: CanvasRenderingContext2D,
  hand: Point,
  yoyo: Point,
  progress: number,
): void {
  const start = { x: hand.x, y: hand.y + 14 };
  const end = { x: yoyo.x, y: yoyo.y - YOYO_RADIUS + 3 };
  const cross = { x: start.x, y: start.y + (end.y - start.y) * progress };
  const spread = 11;

  context.save();
  context.strokeStyle = "#c7bfae";
  context.lineWidth = 1.4;
  context.lineJoin = "round";

  context.beginPath();
  context.moveTo(start.x - spread, start.y);
  context.lineTo(cross.x + spread, cross.y);
  context.lineTo(end.x - spread * 0.4, end.y);
  context.stroke();

  context.beginPath();
  context.moveTo(start.x + spread, start.y);
  context.lineTo(cross.x - spread, cross.y);
  context.lineTo(end.x + spread * 0.4, end.y);
  context.stroke();

  context.restore();
}

/**
 * How the yoyo shivers as the twist tightens around it: a fast, small oscillation rather than a
 * wide swing, since a Brain Twister is worked in place while the string above it does the
 * travelling — a different shape of motion from the cradle's three rocks and the trapeze's one
 * wide pass, not just a faster or slower version of either.
 *
 * Under reduced motion it holds still, the same rule as the swing and the pendulum: what goes is
 * the travel across the screen, and the progress ring left behind still carries the timing.
 */
function twistShiver(progress: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.sin(progress * Math.PI * 9) * 9 * (1 - progress * 0.4);
}

/**
 * Eli Hops: the yoyo begins mounted between two hands, rises as the hands come together, and
 * returns to the mounted string as they spread. Two clear hops make this read apart from the
 * one-pass trapeze swing even though both begin from a Trapeze Mount.
 *
 * Reduced motion holds the mounted pose. The progress ring still shows the Attempt resolving,
 * without either the yoyo or the hands travelling across the canvas.
 */
function eliHopsPose(
  centre: Point,
  progress: number,
  reducedMotion: boolean,
): { yoyo: Point; leftHand: Point; rightHand: Point } {
  const hop = reducedMotion ? 0 : Math.sin(progress * Math.PI * 2) ** 2;
  const handSpread = 82 - hop * 34;

  return {
    yoyo: {
      x: centre.x + (reducedMotion ? 0 : Math.sin(progress * Math.PI * 4) * 8),
      y: centre.y - hop * 118,
    },
    leftHand: { x: centre.x - handSpread, y: 38 + hop * 10 },
    rightHand: { x: centre.x + handSpread, y: 38 + hop * 10 },
  };
}

/** The mounted string between the two hands used for Eli Hops. */
function drawEliHopsMount(
  context: CanvasRenderingContext2D,
  leftHand: Point,
  rightHand: Point,
  yoyo: Point,
): void {
  const yoyoTop = yoyo.y - YOYO_RADIUS + 3;

  context.save();
  context.strokeStyle = "#c7bfae";
  context.lineWidth = 1.4;
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(leftHand.x, leftHand.y + 14);
  context.lineTo(yoyo.x, yoyoTop);
  context.lineTo(rightHand.x, rightHand.y + 14);
  context.stroke();
  context.restore();
}

/**
 * Cold Fusion: the hands trade height while the yoyo rolls across a double-or-nothing rig. The
 * crossed strings distinguish it from Eli Hops' open V even at the instant both yoyos are still.
 *
 * Reduced motion holds the hands apart and the yoyo beneath the crossing. The authored double
 * wrap remains visible while the progress ring carries timing, with no travel across the canvas.
 */
function coldFusionPose(
  centre: Point,
  progress: number,
  reducedMotion: boolean,
): { yoyo: Point; leftHand: Point; rightHand: Point } {
  if (reducedMotion) {
    return {
      yoyo: centre,
      leftHand: { x: centre.x - 76, y: 48 },
      rightHand: { x: centre.x + 76, y: 72 },
    };
  }

  const turn = progress * Math.PI * 2;
  const exchange = Math.sin(turn);
  return {
    yoyo: {
      x: centre.x + Math.sin(turn * 2) * 44,
      y: centre.y - Math.sin(turn) ** 2 * 72,
    },
    leftHand: { x: centre.x - 76 + exchange * 38, y: 48 + exchange * 24 },
    rightHand: { x: centre.x + 76 - exchange * 38, y: 72 - exchange * 24 },
  };
}

/** The crossing double wrap Cold Fusion rolls through. */
function drawColdFusionMount(
  context: CanvasRenderingContext2D,
  leftHand: Point,
  rightHand: Point,
  yoyo: Point,
): void {
  const yoyoTop = yoyo.y - YOYO_RADIUS + 3;
  const crossing = {
    x: (leftHand.x + rightHand.x + yoyo.x) / 3,
    y: Math.min(yoyoTop - 24, (leftHand.y + rightHand.y) / 2 + 54),
  };

  context.save();
  context.strokeStyle = "#c7bfae";
  context.lineWidth = 1.4;
  context.lineJoin = "round";

  context.beginPath();
  context.moveTo(leftHand.x, leftHand.y + 14);
  context.lineTo(crossing.x + 11, crossing.y);
  context.lineTo(yoyo.x, yoyoTop);
  context.lineTo(rightHand.x, rightHand.y + 14);
  context.stroke();

  context.beginPath();
  context.moveTo(rightHand.x, rightHand.y + 14);
  context.lineTo(crossing.x - 11, crossing.y);
  context.lineTo(yoyo.x - 7, yoyoTop + 2);
  context.stroke();
  context.restore();
}

/**
 * Mach 5: the yoyo stays mounted while both hands orbit it in opposite directions. The circular
 * hand path and fixed yoyo make it read apart from Cold Fusion's rolling yoyo and trading hands.
 * Reduced motion holds the hands on opposite diagonals, leaving the split-bottom rig visible
 * while the progress ring carries the timing.
 */
function mach5Pose(
  centre: Point,
  progress: number,
  reducedMotion: boolean,
): { yoyo: Point; leftHand: Point; rightHand: Point } {
  const turn = reducedMotion ? Math.PI / 4 : progress * Math.PI * 4;
  const orbit = { x: Math.cos(turn) * 94, y: Math.sin(turn) * 64 };

  return {
    yoyo: centre,
    leftHand: { x: centre.x - orbit.x, y: centre.y - 76 - orbit.y },
    rightHand: { x: centre.x + orbit.x, y: centre.y - 76 + orbit.y },
  };
}

/** The crossed split-bottom rig held while the hands circle the mounted yoyo. */
function drawMach5Mount(
  context: CanvasRenderingContext2D,
  leftHand: Point,
  rightHand: Point,
  yoyo: Point,
): void {
  const yoyoTop = yoyo.y - YOYO_RADIUS + 3;

  context.save();
  context.strokeStyle = "#c7bfae";
  context.lineWidth = 1.4;
  context.lineJoin = "round";

  context.beginPath();
  context.moveTo(leftHand.x, leftHand.y + 14);
  context.lineTo(yoyo.x + 9, yoyoTop);
  context.lineTo(rightHand.x, rightHand.y + 14);
  context.stroke();

  context.beginPath();
  context.moveTo(rightHand.x, rightHand.y + 14);
  context.lineTo(yoyo.x - 9, yoyoTop + 3);
  context.lineTo(leftHand.x, leftHand.y + 14);
  context.stroke();
  context.restore();
}

/**
 * Spirit Bomb: crossed wrists hold a dense mount while the yoyo bursts up through it and drops
 * back underneath. The sharp vertical burst and crossed hands keep Wrist Mount distinct from
 * Mach 5's circular hand orbit and the open rise-and-fall of Eli Hops.
 *
 * Reduced motion holds the crossed Wrist Mount in its settled pose. Attempt progress remains
 * legible in the ring, so removing the burst removes travel rather than timing or state.
 */
function spiritBombPose(
  centre: Point,
  progress: number,
  reducedMotion: boolean,
): { yoyo: Point; leftHand: Point; rightHand: Point } {
  const burst = reducedMotion ? 0 : Math.sin(progress * Math.PI * 3) ** 2;
  const sway = reducedMotion ? 0 : Math.sin(progress * Math.PI * 6) * 24 * (1 - burst * 0.5);

  return {
    yoyo: { x: centre.x + sway, y: centre.y - burst * 132 },
    leftHand: { x: centre.x + 30, y: 52 + burst * 16 },
    rightHand: { x: centre.x - 30, y: 72 - burst * 16 },
  };
}

/** The crossed Wrist Mount Spirit Bomb bursts through. */
function drawSpiritBombMount(
  context: CanvasRenderingContext2D,
  leftHand: Point,
  rightHand: Point,
  yoyo: Point,
): void {
  const yoyoTop = yoyo.y - YOYO_RADIUS + 3;
  const wrist = {
    x: (leftHand.x + rightHand.x) / 2,
    y: Math.max(leftHand.y, rightHand.y) + 42,
  };

  context.save();
  context.strokeStyle = "#c7bfae";
  context.lineWidth = 1.4;
  context.lineJoin = "round";

  context.beginPath();
  context.moveTo(leftHand.x, leftHand.y + 14);
  context.lineTo(wrist.x - 14, wrist.y);
  context.lineTo(yoyo.x + 10, yoyoTop);
  context.lineTo(rightHand.x, rightHand.y + 14);
  context.stroke();

  context.beginPath();
  context.moveTo(rightHand.x, rightHand.y + 14);
  context.lineTo(wrist.x + 14, wrist.y - 8);
  context.lineTo(yoyo.x - 10, yoyoTop + 3);
  context.lineTo(leftHand.x, leftHand.y + 14);
  context.stroke();
  context.restore();
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

type AttemptScene = {
  readonly yoyo: Point;
  readonly hands: readonly Point[];
  readonly drawRig: (context: CanvasRenderingContext2D) => void;
};

/** One authored visual plan per Trick, so adding a Trick extends one exhaustive choice. */
function sceneForAttempt(
  hand: Point,
  resting: Point,
  attempt: ActiveAttempt | null,
  reducedMotion: boolean,
): AttemptScene {
  if (attempt === null) {
    return {
      yoyo: resting,
      hands: [hand],
      drawRig: (context) => drawString(context, hand, resting),
    };
  }

  const trickId = attempt.trick.id;
  switch (trickId) {
    case "rock-the-baby": {
      const yoyo = {
        x: resting.x + swingOffset(attempt.progress, reducedMotion),
        y: resting.y,
      };
      return {
        yoyo,
        hands: [hand],
        drawRig: (context) => drawCradle(context, hand, yoyo, attempt.progress),
      };
    }
    case "man-on-the-flying-trapeze": {
      const offset = trapezeOffset(attempt.progress, reducedMotion);
      const yoyo = { x: resting.x + offset.x, y: resting.y + offset.y };
      return {
        yoyo,
        hands: [hand],
        drawRig: (context) => drawTrapezeBar(context, hand, yoyo),
      };
    }
    case "brain-twister": {
      const yoyo = {
        x: resting.x + twistShiver(attempt.progress, reducedMotion),
        y: resting.y,
      };
      return {
        yoyo,
        hands: [hand],
        drawRig: (context) => drawTwistedString(context, hand, yoyo, attempt.progress),
      };
    }
    case "eli-hops": {
      const pose = eliHopsPose(resting, attempt.progress, reducedMotion);
      return {
        yoyo: pose.yoyo,
        hands: [pose.leftHand, pose.rightHand],
        drawRig: (context) =>
          drawEliHopsMount(context, pose.leftHand, pose.rightHand, pose.yoyo),
      };
    }
    case "cold-fusion": {
      const pose = coldFusionPose(resting, attempt.progress, reducedMotion);
      return {
        yoyo: pose.yoyo,
        hands: [pose.leftHand, pose.rightHand],
        drawRig: (context) =>
          drawColdFusionMount(context, pose.leftHand, pose.rightHand, pose.yoyo),
      };
    }
    case "mach-5": {
      const pose = mach5Pose(resting, attempt.progress, reducedMotion);
      return {
        yoyo: pose.yoyo,
        hands: [pose.leftHand, pose.rightHand],
        drawRig: (context) => drawMach5Mount(context, pose.leftHand, pose.rightHand, pose.yoyo),
      };
    }
    case "spirit-bomb": {
      const pose = spiritBombPose(resting, attempt.progress, reducedMotion);
      return {
        yoyo: pose.yoyo,
        hands: [pose.leftHand, pose.rightHand],
        drawRig: (context) =>
          drawSpiritBombMount(context, pose.leftHand, pose.rightHand, pose.yoyo),
      };
    }
    default: {
      const unhandled: never = trickId;
      return unhandled;
    }
  }
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
  // A Rewind commitment is waiting for a Sleeper, so the canvas keeps showing the physical
  // Rewind until the Attempt actually begins to drain Spin.
  const attempt = state.phase === "Sleeping" ? activeAttempt(state) : null;
  const scene = sceneForAttempt(hand, resting, attempt, reducedMotion);
  const spinRatio =
    state.phase === "Sleeping" ? clamp(state.spin / Math.max(throwPower(state), 1), 0, 1) : 0;

  scene.drawRig(context);
  for (const sceneHand of scene.hands) drawHand(context, sceneHand);
  drawYoyo(context, scene.yoyo, angle, spinRatio);
  if (attempt !== null) drawAttemptProgress(context, scene.yoyo, attempt.progress);
}

/**
 * What the canvas is showing, in words. The picture is the readout, so this is how it reads to
 * anyone not looking at it — and under reduced motion it is doing more of the work.
 */
function sceneDescription(
  attempting: string | null,
  attemptPhase: GameState["phase"] | null,
): string {
  if (attempting === null) return "A yoyo on its string";
  if (attemptPhase === "Rewinding") {
    return `${attempting}: an Attempt committed during Rewind for the next Sleeper`;
  }
  return `${attempting}: an Attempt in progress on the Sleeper`;
}

export function YoyoCanvas({ store }: YoyoCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const division = useSyncExternalStore(
    store.subscribeToTrickDivision,
    store.getTrickDivision,
    store.getTrickDivision,
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
      aria-label={sceneDescription(division.attempting, division.attemptPhase)}
    >
      A yoyo whose motion follows the current Throw Cycle.
    </canvas>
  );
}
