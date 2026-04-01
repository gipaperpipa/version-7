import Link from "next/link";
import { type ScenarioComparisonEntryDto, type ScenarioComparisonResponseDto } from "@repo/contracts";
import { ComparisonAnalysisPanels } from "@/components/analysis/comparison-analysis-panels";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, getReadinessTone, getRunStatusTone, getScenarioStatusTone } from "@/components/ui/status-badge";
import {
  assumptionProfileLabels,
  humanizeTokenLabel,
  optimizationTargetLabels,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";
import { PrintReportButton } from "./print-report-button";

function formatMetric(value: string | number | null | undefined) {
  if (value == null) return "n/a";
  if (typeof value === "number") return new Intl.NumberFormat("en").format(value);

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    const decimals = Math.abs(parsed) >= 100 ? 0 : 2;
    return new Intl.NumberFormat("en", { maximumFractionDigits: decimals }).format(parsed);
  }

  return value;
}

function buildMetricRows(entries: ScenarioComparisonEntryDto[]) {
  return [
    {
      label: "Ranked objective",
      detail: "Current ranking metric value",
      values: entries.map((entry) => entry.objectiveValue),
    },
    {
      label: "Required equity",
      detail: "Residual equity after debt layers",
      values: entries.map((entry) => entry.latestRun?.financialResult?.requiredEquity ?? null),
    },
    {
      label: "Break-even rent",
      detail: "Directional rent threshold",
      values: entries.map((entry) => entry.latestRun?.financialResult?.breakEvenRentEurSqm ?? null),
    },
    {
      label: "Break-even sales price",
      detail: "Directional sales threshold",
      values: entries.map((entry) => entry.latestRun?.financialResult?.breakEvenSalesPriceEurSqm ?? null),
    },
    {
      label: "Subsidy-adjusted IRR",
      detail: "Directional return signal",
      values: entries.map((entry) => entry.latestRun?.financialResult?.subsidyAdjustedIrrPct ?? null),
    },
    {
      label: "Output confidence",
      detail: "Directional confidence score",
      values: entries.map((entry) => entry.latestRun?.confidence.outputConfidencePct ?? null),
    },
  ];
}

export function ScenarioComparisonReportView({
  orgSlug,
  comparison,
  scenarioIds,
}: {
  orgSlug: string;
  comparison: ScenarioComparisonResponseDto;
  scenarioIds: string[];
}) {
  const leader = comparison.entries.find((entry) => entry.scenario.id === comparison.leaderScenarioId) ?? null;
  const metricRows = buildMetricRows(comparison.entries);
  const compareHref = `/${orgSlug}/scenarios/compare?${scenarioIds.map((scenarioId) => `scenarioId=${encodeURIComponent(scenarioId)}`).join("&")}${comparison.rankingTarget ? `&rankingTarget=${encodeURIComponent(comparison.rankingTarget)}` : ""}`;

  return (
    <div className="workspace-page content-stack report-page">
      <PageHeader
        eyebrow="Comparison report"
        title="Scenario comparison report"
        description="Decision memo for ranking, KPI deltas, confidence, signal burden, and recommendation differences across the selected scenarios."
        meta={(
          <div className="action-row">
            <span className="meta-chip">{comparison.entries.length} scenarios</span>
            <span className="meta-chip">{optimizationTargetLabels[comparison.rankingTarget]}</span>
            {comparison.mixedOptimizationTargets ? <StatusBadge tone="warning">Mixed targets</StatusBadge> : <StatusBadge tone="success">Aligned targets</StatusBadge>}
          </div>
        )}
        actions={(
          <div className="report-print-actions">
            <Link className={buttonClasses({ variant: "secondary" })} href={compareHref}>
              Compare view
            </Link>
            <Link className={buttonClasses()} href={`/${orgSlug}/scenarios`}>
              Scenario board
            </Link>
            <PrintReportButton />
          </div>
        )}
      />

      <SectionCard
        className="summary-band decision-summary report-surface"
        eyebrow="Comparison verdict"
        title={leader ? `${leader.scenario.name} currently leads` : "No current leader"}
        description={leader
          ? `${leader.scenario.name} is currently leading for ${optimizationTargetLabels[comparison.rankingTarget].toLowerCase()}. Use the charts and scenario rows below to understand what is supporting or weakening that lead.`
          : "At least one scenario is still missing a comparable latest run or objective value."}
        tone="accent"
        size="compact"
        actions={leader ? <StatusBadge tone="accent">Leader #{leader.rank}</StatusBadge> : undefined}
      >
        <div className="ops-summary-grid ops-summary-grid--report">
          <div className="ops-summary-item">
            <div className="ops-summary-item__label">Leader objective</div>
            <div className="ops-summary-item__value">{formatMetric(leader?.objectiveValue)}</div>
            <div className="ops-summary-item__detail">Current best-ranked value under the selected lens.</div>
          </div>
          <div className="ops-summary-item">
            <div className="ops-summary-item__label">Leader parcel</div>
            <div className="ops-summary-item__value">{leader?.parcel?.name ?? leader?.parcel?.cadastralId ?? "n/a"}</div>
            <div className="ops-summary-item__detail">Current linked site anchor.</div>
          </div>
          <div className="ops-summary-item">
            <div className="ops-summary-item__label">Leader confidence</div>
            <div className="ops-summary-item__value">{leader?.latestRun?.confidence.outputConfidencePct ?? "n/a"}</div>
            <div className="ops-summary-item__detail">Output confidence for the latest run.</div>
          </div>
          <div className="ops-summary-item">
            <div className="ops-summary-item__label">Current recommendation</div>
            <div className="ops-summary-item__value">{leader?.recommendation ?? "Need more comparable runs"}</div>
            <div className="ops-summary-item__detail">Use this with the driver and burden differences below.</div>
          </div>
        </div>
      </SectionCard>

      <ComparisonAnalysisPanels comparison={comparison} />

      <SectionCard
        className="index-surface index-surface--ledger report-surface"
        eyebrow="Scenario set"
        title="Scenario summary rows"
        description="Compare parcel anchor, strategy, readiness, confidence, and recommendation without leaving the report."
        size="compact"
      >
        <div className="report-table">
          <div className="report-table__header report-table__header--scenario">
            <div>Scenario</div>
            <div>Parcel + strategy</div>
            <div>Signal quality</div>
            <div>Planning + output</div>
            <div>Recommendation</div>
          </div>
          {comparison.entries.map((entry) => {
            const explanation = entry.latestRun?.financialResult?.explanation ?? null;
            const tradeoff = explanation?.weakestLinks?.[0] ?? explanation?.tradeoffs?.[0] ?? "No explicit weakest link returned.";

            return (
              <div key={entry.scenario.id} className="report-table__row report-table__row--scenario">
                <div className="report-table__cell">
                  <div className="report-table__title">{entry.scenario.name}</div>
                  <div className="report-table__meta-row">
                    <StatusBadge tone={entry.rank === 1 ? "accent" : "surface"}>{entry.rank ? `Rank ${entry.rank}` : "Unranked"}</StatusBadge>
                    <StatusBadge tone={getScenarioStatusTone(entry.scenario.status)}>{humanizeTokenLabel(entry.scenario.status)}</StatusBadge>
                    <span className="meta-chip">{assumptionProfileLabels[entry.scenario.assumptionSet?.profileKey ?? "BASELINE"]}</span>
                  </div>
                </div>
                <div className="report-table__cell">
                  <div className="report-table__value">{entry.parcel?.name ?? entry.parcel?.cadastralId ?? "Parcel missing"}</div>
                  <div className="report-table__detail">{strategyTypeLabels[entry.scenario.strategyType]}</div>
                  <div className="report-table__detail">{entry.parcel?.landAreaSqm ?? "n/a"} sqm / source {entry.parcel?.sourceType ?? "n/a"}</div>
                </div>
                <div className="report-table__cell">
                  <div className="report-table__meta-row">
                    <StatusBadge tone={getReadinessTone(entry.readiness.status)}>{humanizeTokenLabel(entry.readiness.status)}</StatusBadge>
                    {entry.latestRun ? <StatusBadge tone={getRunStatusTone(entry.latestRun.status)}>{humanizeTokenLabel(entry.latestRun.status)}</StatusBadge> : null}
                  </div>
                  <div className="report-table__detail">
                    Output confidence {entry.latestRun?.confidence.outputConfidencePct ?? "n/a"} / {entry.blockerCount} blockers / {entry.warningCount} warnings / {entry.missingDataCount} missing
                  </div>
                </div>
                <div className="report-table__cell">
                  <div className="report-table__value">{formatMetric(entry.latestRun?.financialResult?.planningAdjustedBgfSqm ?? entry.latestRun?.financialResult?.buildableBgfSqm ?? null)}</div>
                  <div className="report-table__detail">
                    Objective {formatMetric(entry.objectiveValue)} {entry.deltaToLeader != null ? `/ delta ${entry.deltaToLeader}` : ""}
                  </div>
                  <div className="report-table__detail">{tradeoff}</div>
                </div>
                <div className="report-table__cell">
                  <div className="report-table__value">{entry.recommendation}</div>
                  <div className="report-table__detail">
                    {entry.topDrivers[0] ?? "Run or rerun this scenario to surface comparable driver commentary."}
                  </div>
                  <div className="action-row action-row--compact">
                    <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/scenarios/${entry.scenario.id}/builder`}>
                      Builder
                    </Link>
                    {entry.latestRun ? (
                      <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={`/${orgSlug}/scenarios/${entry.scenario.id}/results/${entry.latestRun.id}`}>
                        Result
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        className="index-surface index-surface--ledger report-surface"
        eyebrow="KPI comparison"
        title="Metric comparison table"
        description="Use this section for the exact row-by-row KPI scan that sits behind the charts."
        size="compact"
      >
        <div className="comparison-table">
          <div className="comparison-table__header">
            <div>Metric</div>
            {comparison.entries.map((entry) => (
              <div key={entry.scenario.id}>{entry.scenario.name}</div>
            ))}
          </div>

          {metricRows.map((row) => (
            <div key={row.label} className="comparison-table__row">
              <div className="comparison-table__metric">
                <div className="comparison-table__metric-label">{row.label}</div>
                <div className="comparison-table__metric-detail">{row.detail}</div>
              </div>
              {row.values.map((value, index) => (
                <div key={`${row.label}-${comparison.entries[index].scenario.id}`} className="comparison-table__value">
                  <div className="comparison-table__value-main">{formatMetric(value)}</div>
                  {row.label === "Ranked objective" && comparison.entries[index].deltaToLeader != null ? (
                    <div className="comparison-table__value-detail">
                      {comparison.entries[index].deltaToLeader === "0" ? "Leader" : `${comparison.entries[index].deltaToLeader} behind`}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
