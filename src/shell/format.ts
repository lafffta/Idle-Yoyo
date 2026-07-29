const SUFFIXES = [
  { threshold: 1_000_000_000_000, suffix: "T" },
  { threshold: 1_000_000_000, suffix: "B" },
  { threshold: 1_000_000, suffix: "M" },
  { threshold: 10_000, suffix: "K" },
] as const;

function fractionDigits(value: number): number {
  if (value >= 100) return 0;
  if (value >= 10) return 1;
  return 2;
}

/** Shared player-facing number format: grouped small figures, then compact K/M/B/T figures. */
export function formatNumber(value: number): string {
  const magnitude = Math.abs(value);
  const compact = SUFFIXES.find(({ threshold }) => magnitude >= threshold);

  if (compact) {
    const scaled = value / compact.threshold;
    return (
      scaled.toLocaleString("en-US", {
        maximumFractionDigits: fractionDigits(Math.abs(scaled)),
      }) + compact.suffix
    );
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: fractionDigits(magnitude),
  });
}
