import { OptimizationTarget, type ScenarioComparisonEntryDto, type ScenarioComparisonResponseDto } from "@repo/contracts";
import { MetricBarChart, OrderedInsightChart } from "@/components/analysis/chart-primitives";
import { formatMetricValue, getRelativePerformance, toMetricNumber } from "@/lib/analysis/metrics";
import { optimizationTargetLabels, strategyTypeLabels } from "@/lib/ui/enum-labels";

function getScenarioDetail(entry: ScenarioComparisonEntryDto) {
  return `${entry.parcel?.name ?? entry.parcel?.cadastralId ?? "Parcel missing"} / ${strategyTypeLabels[entry.scenario.strategyType]}`;
}

function getObjectiveDirection(comparison: ScenarioComparisonResponseDto): "higher" | "lower" {
  return comparison.objectiveDirection === "max" ? "higher" : "lower";
}

function buildMetricItems(
  entries: ScenarioComparisonEntryDto[],
  getValue: (entry: ScenarioComparisonEntryDto) => number | null,
  direction: "higher" | "lower",
  format: (value: number | null) => string,
) {
  const values = entries.map((entry) => getValue(entry));

  return entries.map((entry, index) => {
    const value = values[index];
    const isLeader = entry.rank === 1;

    return {
      label: entry.scenario.name,
      detail: getScenarioDetail(entry),
      valueLabel: format(value),
      ratio: getRelativePerformance(value, values, direction),
      tone: isLeader ? ("accent" as const) : ("surface" as const),
      badge: entry.rank ? `#${entry.rank}` : undefined,
    };
  });
}

function getThresholdTarget(comparison: ScenarioComparisonResponseDto) {
  if (comparison.rankingTarget === OptimizationTarget.MIN_BREAK_EVEN_SALES_PRICE) {
    return {
      title: "Break-even sales price",
      description: "Lower is better. Compare the sales threshold each case needs to clear.",
      getValue: (entry: ScenarioComparisonEntryDto) =>
        toMetricNumber(entry.latestRun?.financialResult?.breakEvenSalesPriceEurSqm ?? null),
    };
  }

  return {
    title: "Break-even rent",
    description: "Lower is better. Compare how much rent pressure each case is carrying.",
    getValue: (entry: ScenarioComparisonEntryDto) =>
      toMetricNumber(entry.latestRun?.financialResult?.breakEvenRentEurSqm ?? null),
  };
}

export function ComparisonAnalysisPanels({
  comparison,
}: {
  comparison: ScenarioComparisonResponseDto;
}) {
  const leader = comparison.entries.find((entry) => entry.scenario.id === comparison.leaderScenarioId) ?? null;
  const laggard = [...comparison.entries]
    .filter((entry) => entry.rank !== null)
    .sort((left, right) => (right.rank ?? 0) - (left.rank ?? 0))[0] ?? null;
  const threshold = getThresholdTarget(comparison);

  return (
    <div className="analysis-grid analysis-grid--comparison">
      <MetricBarChart
        eyebrow="Scenario ranking"
        title="Objective score"
        description={`Current ranking against ${optimizationTargetLabels[comparison.rankingTarget].toLowerCase()}.`}
        items={buildMetricItems(
          comparison.entries,
          (entry) => toMetricNumber(entry.objectiveValue),
          getObjectiveDirection(comparison),
          (value) => formatMetricValue(value),
        )}
        footer={comparison.mixedOptimizationTargets
          ? "Mixed optimization targets are being normalized to the selected ranking lens."
          : "All compared scenarios share the same optimization lens."}
      />

      <MetricBarChart
        eyebrow="Capital pressure"
        title="Required equity"
        description="Lower is better. Compare the equity burden each scenario leaves uncovered."
        items={buildMetricItems(
          comparison.entries,
          (entry) => toMetricNumber(entry.latestRun?.financialResult?.requiredEquity ?? null),
          "lower",
          (value) => formatMetricValue(value),
        )}
      />

      <MetricBarChart
        eyebrow="Revenue threshold"
        title={threshold.title}
        description={threshold.description}
        items={buildMetricItems(
          comparison.entries,
          threshold.getValue,
          "lower",
          (value) => formatMetricValue(value),
        )}
      />

      <MetricBarChart
        eyebrow="Signal quality"
        title="Output confidence"
        description="Higher is better. Compare how stable each latest run is as a directional decision signal."
        items={buildMetricItems(
          comparison.entries,
          (entry) => toMetricNumber(entry.latestRun?.confidence.outputConfidencePct ?? null),
          "higher",
          (value) => (value != null ? `${formatMetricValue(value)}%` : "n/a"),
        )}
      />

      <MetricBarChart
        eyebrow="Signal burden"
        title="Missing-data and warning burden"
        description="Lower is better. Compare blocker, warning, and missing-data drag per scenario."
        items={buildMetricItems(
          comparison.entries,
          (entry) => entry.blockerCount + entry.warningCount + entry.missingDataCount,
          "lower",
          (value) => `${value ?? 0} signals`,
        ).map((item, index) => ({
          ...item,
          detail: `${comparison.entries[index].blockerCount} blockers / ${comparison.entries[index].warningCount} warnings / ${comparison.entries[index].missingDataCount} missing`,
          tone: comparison.entries[index].blockerCount > 0
            ? ("danger" as const)
            : comparison.entries[index].missingDataCount > 0 || comparison.entries[index].warningCount > 0
              ? ("warning" as const)
              : ("success" as const),
        }))}
      />

      <OrderedInsightChart
        eyebrow="Leader readout"
        title="Why the current leader is ahead"
        description="Current leading scenario drivers under the selected comparison lens."
        items={leader?.topDrivers ?? []}
      />

      <OrderedInsightChart
        eyebrow="Trailing case readout"
        title="Why weaker cases trail"
        description="Use the weakest currently ranked case to understand what is dragging the comparison set."
        items={laggard?.latestRun?.financialResult?.explanation?.weakestLinks ?? [laggard?.recommendation ?? "No weaker-case explanation returned."]}
        tone="warning"
      />
    </div>
  );
}
