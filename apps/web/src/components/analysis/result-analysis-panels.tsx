import type { FinancialResultDto, ScenarioRunDto } from "@repo/contracts";
import { MetricBarChart, OrderedInsightChart, StackedCompositionChart } from "@/components/analysis/chart-primitives";
import { formatMetricValue, toMetricNumber } from "@/lib/analysis/metrics";
import { humanizeTokenLabel } from "@/lib/ui/enum-labels";
import { getConfidenceBand } from "@/lib/ui/provenance";

function getConfidenceTone(band: string): "success" | "warning" | "danger" | "surface" {
  if (band === "High") return "success";
  if (band === "Medium") return "warning";
  if (band === "Low") return "danger";
  return "surface";
}

function buildCapitalStackSegments(result: FinancialResultDto) {
  return [
    { label: "State subsidy", value: toMetricNumber(result.stateSubsidyAmount), tone: "success" as const },
    { label: "Grant", value: toMetricNumber(result.grantAmount), tone: "accent" as const },
    { label: "KfW", value: toMetricNumber(result.kfwAmount), tone: "surface" as const },
    { label: "Free financing", value: toMetricNumber(result.freeFinancingAmount), tone: "warning" as const },
    { label: "Equity", value: toMetricNumber(result.equityAmount ?? result.requiredEquity), tone: "danger" as const },
  ];
}

function buildUsesOfFundsSegments(result: FinancialResultDto) {
  return [
    { label: "Acquisition", value: toMetricNumber(result.acquisitionCost), tone: "accent" as const },
    { label: "Hard cost", value: toMetricNumber(result.hardCost), tone: "surface" as const },
    { label: "Soft cost", value: toMetricNumber(result.softCost), tone: "warning" as const },
    { label: "Parking", value: toMetricNumber(result.parkingCost), tone: "surface" as const },
    { label: "Contingency", value: toMetricNumber(result.contingencyCost), tone: "danger" as const },
    { label: "Developer fee", value: toMetricNumber(result.developerFee), tone: "success" as const },
  ];
}

function buildRevenueItems(result: FinancialResultDto) {
  const grossSalesRevenue = toMetricNumber(result.grossSalesRevenue);
  const netSalesRevenue = toMetricNumber(result.netSalesRevenue);
  const parkingSalesRevenue = toMetricNumber(result.parkingSalesRevenue);
  const grossResidentialRevenue = toMetricNumber(result.grossResidentialRevenueAnnual);
  const parkingRevenueAnnual = toMetricNumber(result.parkingRevenueAnnual);
  const vacancyAdjustedRevenueAnnual = toMetricNumber(result.vacancyAdjustedRevenueAnnual);
  const operatingCostAnnual = toMetricNumber(result.operatingCostAnnual);
  const netOperatingIncomeAnnual = toMetricNumber(result.netOperatingIncomeAnnual);
  const totalCapitalizedUses = toMetricNumber(result.totalCapitalizedUses ?? result.totalDevelopmentCost);
  const salesCloseoutDrag =
    grossSalesRevenue != null && netSalesRevenue != null ? Math.max(0, grossSalesRevenue - netSalesRevenue) : null;

  if (grossSalesRevenue != null || netSalesRevenue != null) {
    const values = [grossSalesRevenue, parkingSalesRevenue, netSalesRevenue, salesCloseoutDrag, totalCapitalizedUses]
      .filter((value): value is number => value != null)
      .map((value) => Math.abs(value));
    const max = values.length ? Math.max(...values) : 1;

    return {
      title: "Sales and capital check",
      description: "Compare gross proceeds, closing drag, and the capital base the exit has to clear.",
      items: [
        {
          label: "Gross sales",
          detail: "Before closing drag",
          valueLabel: formatMetricValue(grossSalesRevenue),
          ratio: grossSalesRevenue != null ? Math.abs(grossSalesRevenue) / max : 0,
          tone: "accent" as const,
        },
        {
          label: "Parking sales",
          detail: "Optional disposal from parking stock",
          valueLabel: formatMetricValue(parkingSalesRevenue),
          ratio: parkingSalesRevenue != null ? Math.abs(parkingSalesRevenue) / max : 0,
          tone: "surface" as const,
        },
        {
          label: "Net sales",
          detail: "After sales closing costs",
          valueLabel: formatMetricValue(netSalesRevenue),
          ratio: netSalesRevenue != null ? Math.abs(netSalesRevenue) / max : 0,
          tone: "success" as const,
        },
        {
          label: "Closing drag",
          detail: "Gross-to-net reduction",
          valueLabel: formatMetricValue(salesCloseoutDrag),
          ratio: salesCloseoutDrag != null ? Math.abs(salesCloseoutDrag) / max : 0,
          tone: "warning" as const,
        },
        {
          label: "Capitalized uses",
          detail: "Total uses the exit has to support",
          valueLabel: formatMetricValue(totalCapitalizedUses),
          ratio: totalCapitalizedUses != null ? Math.abs(totalCapitalizedUses) / max : 0,
          tone: "danger" as const,
        },
      ],
    };
  }

  const values = [grossResidentialRevenue, parkingRevenueAnnual, vacancyAdjustedRevenueAnnual, operatingCostAnnual, netOperatingIncomeAnnual]
    .filter((value): value is number => value != null)
    .map((value) => Math.abs(value));
  const max = values.length ? Math.max(...values) : 1;

  return {
    title: "Revenue and NOI",
    description: "Show rent-side revenue, cost drag, and the annual operating signal that survives.",
    items: [
      {
        label: "Gross residential revenue",
        detail: "Before vacancy and opex",
        valueLabel: formatMetricValue(grossResidentialRevenue),
        ratio: grossResidentialRevenue != null ? Math.abs(grossResidentialRevenue) / max : 0,
        tone: "accent" as const,
      },
      {
        label: "Parking revenue",
        detail: "Optional annual parking income",
        valueLabel: formatMetricValue(parkingRevenueAnnual),
        ratio: parkingRevenueAnnual != null ? Math.abs(parkingRevenueAnnual) / max : 0,
        tone: "surface" as const,
      },
      {
        label: "Vacancy-adjusted revenue",
        detail: "After vacancy assumption",
        valueLabel: formatMetricValue(vacancyAdjustedRevenueAnnual),
        ratio: vacancyAdjustedRevenueAnnual != null ? Math.abs(vacancyAdjustedRevenueAnnual) / max : 0,
        tone: "success" as const,
      },
      {
        label: "Operating cost",
        detail: "Annual opex drag",
        valueLabel: formatMetricValue(operatingCostAnnual),
        ratio: operatingCostAnnual != null ? Math.abs(operatingCostAnnual) / max : 0,
        tone: "warning" as const,
      },
      {
        label: "NOI",
        detail: "Directionally investable annual income",
        valueLabel: formatMetricValue(netOperatingIncomeAnnual),
        ratio: netOperatingIncomeAnnual != null ? Math.abs(netOperatingIncomeAnnual) / max : 0,
        tone: "danger" as const,
      },
    ],
  };
}

export function ResultAnalysisPanels({
  run,
  result,
}: {
  run: ScenarioRunDto;
  result: FinancialResultDto;
}) {
  const confidence = run.confidence ?? {
    inputConfidencePct: null,
    outputConfidencePct: null,
    reasons: [],
  };
  const readinessIssues = run.readinessIssues ?? [];
  const warningsList = run.warnings ?? [];
  const missingDataFlags = run.missingDataFlags ?? [];
  const capitalSegments = buildCapitalStackSegments(result);
  const usesSegments = buildUsesOfFundsSegments(result);
  const revenueChart = buildRevenueItems(result);
  const inputBand = getConfidenceBand(confidence.inputConfidencePct);
  const outputBand = getConfidenceBand(confidence.outputConfidencePct);
  const blockers = readinessIssues.filter((issue) => issue.severity === "BLOCKING");
  const warnings = readinessIssues.filter((issue) => issue.severity === "WARNING").length + warningsList.length;
  const heuristicCaveats = warningsList.filter((warning) => warning.code.startsWith("HEURISTIC_"));
  const tradeoffItems = [...(result.explanation?.tradeoffs ?? []), ...(result.explanation?.weakestLinks ?? [])];

  return (
    <div className="analysis-grid analysis-grid--result">
      <StackedCompositionChart
        eyebrow="Capital structure"
        title="Capital stack"
        description="See which layers are carrying the case and where equity pressure remains."
        segments={capitalSegments}
        footer="Directional only. Equity falls back to required equity if the explicit equity layer is not returned."
      />

      <StackedCompositionChart
        eyebrow="Uses of funds"
        title="Uses composition"
        description="Show where the capital base is concentrated before the run is interpreted."
        segments={usesSegments}
        footer="Use this to spot whether acquisition, hard cost, parking, or contingency is dominating the stack."
      />

      <MetricBarChart
        eyebrow="Operating economics"
        title={revenueChart.title}
        description={revenueChart.description}
        items={revenueChart.items}
      />

      <MetricBarChart
        eyebrow="Signal quality"
        title="Confidence summary"
        description="Separate input quality from engine output confidence before trusting the direction."
        items={[
          {
            label: "Input confidence",
            detail: "How stable the scenario inputs were",
            valueLabel: confidence.inputConfidencePct != null ? `${formatMetricValue(confidence.inputConfidencePct)}%` : "n/a",
            ratio: Math.max(0, Math.min(1, (confidence.inputConfidencePct ?? 0) / 100)),
            tone: getConfidenceTone(inputBand),
            badge: inputBand,
          },
          {
            label: "Output confidence",
            detail: "How much of the output can be treated directionally",
            valueLabel: confidence.outputConfidencePct != null ? `${formatMetricValue(confidence.outputConfidencePct)}%` : "n/a",
            ratio: Math.max(0, Math.min(1, (confidence.outputConfidencePct ?? 0) / 100)),
            tone: getConfidenceTone(outputBand),
            badge: outputBand,
          },
        ]}
        footer="Confidence stays heuristic. Use it with missing-data burden and blocker counts, not in isolation."
      />

      <StackedCompositionChart
        eyebrow="Readiness burden"
        title="Signal burden"
        description="Compare how much of the current result still depends on blockers, warnings, missing data, or heuristic caveats."
        segments={[
          { label: "Blockers", value: blockers.length, tone: "danger" },
          { label: "Warnings", value: warnings, tone: "warning" },
          { label: "Missing data", value: missingDataFlags.length, tone: "surface" },
          { label: "Heuristic caveats", value: heuristicCaveats.length, tone: "accent" },
        ]}
        footer={`Readiness ${run.readinessStatus ? humanizeTokenLabel(run.readinessStatus) : "not returned"}.`}
      />

      <OrderedInsightChart
        eyebrow="Driver view"
        title="Dominant drivers"
        description="The main reasons the current scenario outcome moves the way it does."
        items={result.explanation?.dominantDrivers ?? []}
      />

      <OrderedInsightChart
        eyebrow="Tradeoff view"
        title="Tradeoffs and weakest links"
        description="What is currently weakening trust, margin, or execution posture."
        items={tradeoffItems}
        tone="warning"
      />
    </div>
  );
}
