import { OptimizationTarget } from "@repo/contracts";

export function toMetricNumber(value: string | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMetricValue(value: string | number | null | undefined, options?: { percent?: boolean }) {
  if (value == null) return "n/a";
  const numeric = toMetricNumber(value);
  if (numeric == null) return typeof value === "string" ? value : "n/a";

  const decimals = options?.percent
    ? 2
    : Math.abs(numeric) >= 100
      ? 0
      : Math.abs(numeric) >= 10
        ? 1
        : 2;

  const formatted = new Intl.NumberFormat("en", { maximumFractionDigits: decimals }).format(numeric);
  return options?.percent ? `${formatted}%` : formatted;
}

export function getOptimizationDirection(target: OptimizationTarget): "higher" | "lower" {
  return target === OptimizationTarget.MAX_SUBSIDY_ADJUSTED_IRR || target === OptimizationTarget.MAX_UNIT_COUNT
    ? "higher"
    : "lower";
}

export function getRelativePerformance(
  value: number | null,
  values: Array<number | null>,
  direction: "higher" | "lower",
) {
  if (value == null) return 0;

  const valid = values.filter((item): item is number => item != null && Number.isFinite(item));
  if (!valid.length) return 0;

  if (direction === "higher") {
    const max = Math.max(...valid);
    return max > 0 ? value / max : 0;
  }

  const positive = valid.filter((item) => item > 0);
  const min = positive.length ? Math.min(...positive) : Math.min(...valid);
  if (value <= 0 || min <= 0) {
    const max = Math.max(...valid);
    return max !== 0 ? 1 - value / max : 0;
  }

  return min / value;
}

export function getOrdinalWeight(index: number, count: number) {
  if (count <= 1) return 1;
  return Math.max(0.28, 1 - index / Math.max(1, count + 0.6));
}
