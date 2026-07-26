// PROTOTYPE — throwaway shell. See README.md in this directory.
//
// Renders the whole frame, reads one keystroke, dispatches, re-renders. All the logic
// lives in cycle.ts; this file exists to be driven by hand and then thrown away.

import {
  CONSTANTS,
  type GameState,
  advance,
  advanceWithSegments,
  bearingPrice,
  buyAutoThrower,
  buyBearing,
  buyRewindSpeed,
  buyThrowPower,
  currentStyleRate,
  decayRate,
  initialState,
  projectedRemainingYield,
  rewindDuration,
  rewindSpeedPrice,
  sustainedStyle,
  sustainedStyleViaYield,
  throwCycleLength,
  throwPower,
  throwPowerPrice,
  throwYoyo,
  timeToBoundary,
  uptime,
  yieldPerThrow,
} from "./cycle.ts";

const B = "\x1b[1m";
const D = "\x1b[2m";
const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const X = "\x1b[0m";

let state: GameState = initialState();
let message = "Throw the yoyo to start.";
let lastSegments = 0;

const n = (v: number, dp = 4) => (Number.isFinite(v) ? v.toFixed(dp) : "∞");
const secs = (v: number) => (Number.isFinite(v) ? `${v.toFixed(3)}s` : "never");

/** What Sustained Style would become after one more level of something. */
function probe(after: GameState): string {
  const before = sustainedStyle(state);
  const delta = sustainedStyle(after) - before;
  const colour = delta > 1e-12 ? G : R; // a lever that has stopped moving should look wrong
  return `${colour}${delta >= 0 ? "+" : ""}${delta.toFixed(6)}${X}`;
}

function withStyle(s: GameState, amount: number): GameState {
  return { ...s, style: s.style + amount };
}

/** ADR 0002's promise, checked by hand: one long call against many uneven short ones. */
function splitInvariance(seconds: number): string {
  const one = advance(state, seconds);
  let many = state;
  let left = seconds;
  let splits = 0;
  while (left > 1e-9) {
    const chunk = Math.min(left, 0.01 + Math.random() * 2.5);
    many = advance(many, chunk);
    left -= chunk;
    splits += 1;
  }
  const drift = Math.abs(one.style - many.style);
  const phaseAgrees = one.phase === many.phase;
  const spinDrift = Math.abs(one.spin - many.spin);
  const ok = drift < 1e-6 && phaseAgrees && spinDrift < 1e-6;
  return (
    `${ok ? `${G}AGREE` : `${R}DIVERGE`}${X} over ${seconds}s in ${splits} uneven splits: ` +
    `Style drift ${drift.toExponential(2)}, Spin drift ${spinDrift.toExponential(2)}, ` +
    `phase ${one.phase}/${many.phase}`
  );
}

function step(seconds: number, label: string) {
  const result = advanceWithSegments(state, seconds);
  state = result.state;
  lastSegments = result.segments;
  message =
    `advance(state, ${seconds}) — ${label}, ${result.segments} segment(s)` +
    (result.hitCap ? ` ${R}HIT ITERATION CAP${X}` : "");
}

function render() {
  const unflooredRewind =
    CONSTANTS.baseRewind * Math.pow(CONSTANTS.rewindPerLevel, state.rewindSpeedLevel);
  const floored = unflooredRewind < CONSTANTS.rewindFloor;
  const sustained = sustainedStyle(state);
  const viaYield = sustainedStyleViaYield(state);

  const phaseColour =
    state.phase === "Sleeping" ? G : state.phase === "Rewinding" ? Y : D;

  const lines = [
    `${B}PROTOTYPE — Throw Cycle state model${X} ${D}(throwaway; not production)${X}`,
    "",
    `${B}Phase${X}            ${phaseColour}${state.phase}${X} ${D}for ${state.phaseElapsed.toFixed(3)}s, next boundary in ${secs(timeToBoundary(state))}${X}`,
    `${B}Spin${X}             ${n(state.spin, 3)} ${D}(stored)${X}`,
    `${B}Style${X}            ${n(state.style, 4)}   ${D}lifetime ${n(state.lifetimeStyle, 4)}${X}`,
    `${B}Kit${X}              Auto-Thrower: ${state.hasAutoThrower ? `${G}owned${X}` : `${D}none${X}`}`,
    `${B}Gear levels${X}      Throw Power ${state.throwPowerLevel}  Bearing ${state.bearingLevel}  Rewind Speed ${state.rewindSpeedLevel}`,
    "",
    `${B}Derived${X} ${D}(from levels, never stored)${X}`,
    `  Throw Power S₀   ${n(throwPower(state), 2)} Spin`,
    `  Decay D          ${n(decayRate(state), 4)} Spin/s`,
    `  Rewind R         ${n(rewindDuration(state), 4)}s ${floored ? `${Y}AT FLOOR${X} ${D}(unfloored ${unflooredRewind.toFixed(4)}s)${X}` : ""}`,
    `  Throw Cycle      ${n(throwCycleLength(state), 4)}s   ${D}Uptime ${(uptime(state) * 100).toFixed(2)}%${X}`,
    "",
    `${B}Readouts${X} ${D}(functions of state alone — nothing measures history)${X}`,
    `  ${B}Sustained Style  ${n(sustained, 6)}/s${X} ${D}via yield/cycle ${n(viaYield, 6)} — drift ${Math.abs(sustained - viaYield).toExponential(1)}${X}`,
    `  Current rate     ${n(currentStyleRate(state), 4)}/s`,
    `  Yield per Throw  ${n(yieldPerThrow(state), 4)}   ${D}this Throw still owes ${n(projectedRemainingYield(state), 4)}${X}`,
    "",
    `${B}Next purchase moves Sustained Style by${X} ${D}(ADR 0003's claim, live)${X}`,
    `  Throw Power  ${probe(buyThrowPower(withStyle(state, 1e12)))}   ${D}costs ${throwPowerPrice(state).toFixed(2)}${X}`,
    `  Bearing      ${probe(buyBearing(withStyle(state, 1e12)))}   ${D}costs ${bearingPrice(state).toFixed(2)}${X}`,
    `  Rewind Speed ${probe(buyRewindSpeed(withStyle(state, 1e12)))}   ${D}costs ${rewindSpeedPrice(state).toFixed(2)}${X}`,
    `  Auto-Thrower ${D}buys absence, not speed — costs ${CONSTANTS.autoThrowerCost}${X}`,
    "",
    `${B}›${X} ${message} ${D}[${lastSegments} segments]${X}`,
    "",
    `${D}[t]${X} Throw  ${D}[1]${X} +0.1s  ${D}[2]${X} +1s  ${D}[3]${X} +10s  ${D}[8]${X} +8h  ${D}[m]${X} +30d  ${D}[n]${X} −60s`,
    `${D}[p]${X} buy Power  ${D}[b]${X} buy Bearing  ${D}[r]${X} buy Rewind  ${D}[a]${X} buy Auto-Thrower`,
    `${D}[s]${X} split-invariance check  ${D}[f]${X} floor the Rewind  ${D}[g]${X} +10,000 Style  ${D}[x]${X} reset  ${D}[q]${X} quit`,
  ];

  console.clear();
  console.log(lines.join("\n"));
}

const actions: Record<string, () => void> = {
  t: () => {
    const next = throwYoyo(state);
    message = next === state ? `${R}Throw rejected${X} — legal only from Ready` : "Thrown.";
    state = next;
  },
  "1": () => step(0.1, "a tenth of a second"),
  "2": () => step(1, "one second"),
  "3": () => step(10, "ten seconds"),
  "8": () => step(8 * 3600, "eight hours away"),
  m: () => step(30 * 24 * 3600, "thirty days away"),
  n: () => step(-60, "a clock correcting backwards"),
  p: () => {
    const next = buyThrowPower(state);
    message = next === state ? `${R}Cannot afford Throw Power${X}` : "Bought Throw Power.";
    state = next;
  },
  b: () => {
    const next = buyBearing(state);
    message = next === state ? `${R}Cannot afford the Bearing${X}` : "Bought the Bearing.";
    state = next;
  },
  r: () => {
    const next = buyRewindSpeed(state);
    message = next === state ? `${R}Cannot afford Rewind Speed${X}` : "Bought Rewind Speed.";
    state = next;
  },
  a: () => {
    const next = buyAutoThrower(state);
    message =
      next === state
        ? state.hasAutoThrower
          ? `${D}Already owned — Kit, not a level${X}`
          : `${R}Cannot afford the Auto-Thrower${X}`
        : "Bought the Auto-Thrower. The game is now idle.";
    state = next;
  },
  s: () => {
    message = splitInvariance(3600);
  },
  f: () => {
    let s = withStyle(state, 1e12);
    let levels = 0;
    while (rewindDuration(s) > CONSTANTS.rewindFloor) {
      s = buyRewindSpeed(s);
      levels += 1;
    }
    state = { ...s, style: state.style };
    message = `Bought ${levels} levels of Rewind Speed (free). Rewind is at its floor — the Bearing must still work.`;
  },
  g: () => {
    state = withStyle(state, 10000);
    message = "Granted 10,000 Style (prototype cheat, lives in the shell).";
  },
  x: () => {
    state = initialState();
    lastSegments = 0;
    message = "Reset.";
  },
};

process.stdin.setRawMode?.(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
render();

const CTRL_C = String.fromCharCode(3);

// One character at a time, so a piped string drives it exactly as a keyboard does.
process.stdin.on("data", (chunk: string) => {
  for (const key of chunk) {
    if (key === "q" || key === CTRL_C) {
      console.clear();
      process.exit(0);
    }
    actions[key]?.();
    render();
  }
});
