import Link from "next/link";
import { OptimizationTarget, type ScenarioComparisonEntryDto } from "@repo/contracts";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { ComparisonAnalysisPanels } from "@/components/analysis/comparison-analysis-panels";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, getReadinessTone, getScenarioStatusTone } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getScenarioComparison } from "@/lib/api/scenarios";
import {
  assumptionProfileLabels,
  humanizeTokenLabel,
  optimizationTargetLabels,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";

function toScenarioIdArray(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

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
      label: "Unit count",
      detail: "Current unit signal",
      values: entries.map((entry) => entry.latestRun?.financialResult?.estimatedUnitCount ?? null),
    },
    {
      label: "Adjusted BGF",
      detail: "Planning-buffered buildable area",
      values: entries.map((entry) => entry.latestRun?.financialResult?.planningAdjustedBgfSqm ?? null),
    },
    {
      label: "NOI annual",
      detail: "Net operating income after vacancy and opex",
      values: entries.map((entry) => entry.latestRun?.financialResult?.netOperatingIncomeAnnual ?? null),
    },
    {
      label: "Net sales revenue",
      detail: "Net sale proceeds after closing costs",
      values: entries.map((entry) => entry.latestRun?.financialResult?.netSalesRevenue ?? null),
    },
  ];
}

export default async function ScenarioComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ scenarioId?: string | string[]; rankingTarget?: OptimizationTarget }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const scenarioIds = toScenarioIdArray(resolvedSearchParams?.scenarioId);

  if (scenarioIds.length < 2) {
    return (
      <div className="workspace-page content-stack">
        <EmptyState
          eyebrow="Scenario comparison"
          title="Select at least two scenarios"
          description="Use the scenario board to choose multiple cases, then compare them side by side."
          actions={(
            <Link className={buttonClasses()} href={`/${orgSlug}/scenarios`}>
              Back to scenarios
            </Link>
          )}
        />
      </div>
    );
  }

  try {
    const comparison = await getScenarioComparison(orgSlug, scenarioIds, resolvedSearchParams?.rankingTarget);
    const leader = comparison.entries.find((entry) => entry.scenario.id === comparison.leaderScenarioId) ?? null;
    const metricRows = buildMetricRows(comparison.entries);
    const reportHref = `/${orgSlug}/scenarios/compare/report?${scenarioIds.map((scenarioId) => `scenarioId=${encodeURIComponent(scenarioId)}`).join("&")}${comparison.rankingTarget ? `&rankingTarget=${encodeURIComponent(comparison.rankingTarget)}` : ""}`;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario comparison"
          title="Scenario board compare"
          description="Rank by target, compare KPI deltas, and inspect warning and driver differences side by side."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{comparison.entries.length} scenarios</span>
              <span className="meta-chip">{optimizationTargetLabels[comparison.rankingTarget]}</span>
              {comparison.mixedOptimizationTargets ? <StatusBadge tone="warning">Mixed targets</StatusBadge> : <StatusBadge tone="success">Aligned targets</StatusBadge>}
            </div>
          )}
          actions={(
            <>
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                Back to scenarios
              </Link>
              <Link className={buttonClasses()} href={reportHref}>
                Open report
              </Link>
            </>
          )}
        />

        <SectionCard
          className="summary-band summary-band--ledger"
          eyebrow="Ranking lens"
          title="Comparison leader"
          description={leader
            ? `${leader.scenario.name} currently leads for ${optimizationTargetLabels[comparison.rankingTarget].toLowerCase()}.`
            : "No current leader because at least one scenario still lacks comparable run output."}
          tone="accent"
          size="compact"
          actions={leader ? <StatusBadge tone="accent">Leader: {leader.rank}</StatusBadge> : undefined}
        >
          <div className="comparison-toolbar">
            <div className="comparison-toolbar__summary">
              <div className="ops-summary-item__label">Current leader</div>
              <div className="ops-summary-item__value">{leader?.scenario.name ?? "No ranked leader"}</div>
              <div className="ops-summary-item__detail">
                {leader?.objectiveValue ? `Objective value ${formatMetric(leader.objectiveValue)}` : "Run the missing scenarios to unlock ranking."}
              </div>
            </div>

            <form action={`/${orgSlug}/scenarios/compare`} method="GET" className="comparison-toolbar__form">
              {scenarioIds.map((scenarioId) => (
                <input key={scenarioId} type="hidden" name="scenarioId" value={scenarioId} />
              ))}
              <label className="field-stack">
                <span className="field-help">Ranking target</span>
                <select name="rankingTarget" defaultValue={comparison.rankingTarget} className="ui-select">
                  {Object.values(OptimizationTarget).map((value) => (
                    <option key={value} value={value}>{optimizationTargetLabels[value]}</option>
                  ))}
                </select>
              </label>
              <button className={buttonClasses({ variant: "secondary" })} type="submit">
                Re-rank set
              </button>
            </form>
          </div>
        </SectionCard>

        <ComparisonAnalysisPanels comparison={comparison} />

        <SectionCard
          className="index-surface index-surface--ledger"
          eyebrow="Scenario set"
          title="Side-by-side cases"
          description="Status, parcel anchor, drivers, and current recommendation."
          size="compact"
        >
          <div className="comparison-deck">
            {comparison.entries.map((entry) => (
              <div key={entry.scenario.id} className="comparison-card">
                <div className="comparison-card__header">
                  <div>
                    <div className="comparison-card__title">{entry.scenario.name}</div>
                    <div className="comparison-card__meta">
                      {entry.parcel?.name ?? entry.parcel?.cadastralId ?? "Parcel missing"} / {strategyTypeLabels[entry.scenario.strategyType]}
                    </div>
                  </div>
                  <div className="comparison-card__signals">
                    {entry.rank ? <StatusBadge tone="accent">Rank {entry.rank}</StatusBadge> : <StatusBadge tone="warning">Unranked</StatusBadge>}
                    <StatusBadge tone={getScenarioStatusTone(entry.scenario.status)}>{humanizeTokenLabel(entry.scenario.status)}</StatusBadge>
                  </div>
                </div>

                <div className="comparison-card__stats">
                  <div className="comparison-stat">
                    <div className="comparison-stat__label">Objective</div>
                    <div className="comparison-stat__value">{formatMetric(entry.objectiveValue)}</div>
                    <div className="comparison-stat__detail">
                      {entry.deltaToLeader != null ? `${entry.deltaToLeader} from leader` : "No comparison yet"}
                    </div>
                  </div>
                  <div className="comparison-stat">
                    <div className="comparison-stat__label">Assumptions</div>
                    <div className="comparison-stat__value">
                      {assumptionProfileLabels[entry.scenario.assumptionSet?.profileKey ?? "BASELINE"]}
                    </div>
                    <div className="comparison-stat__detail">{entry.assumptionSummary}</div>
                  </div>
                  <div className="comparison-stat">
                    <div className="comparison-stat__label">Signals</div>
                    <div className="comparison-stat__value">
                      {entry.blockerCount}B / {entry.warningCount}W / {entry.missingDataCount}M
                    </div>
                    <div className="comparison-stat__detail">Blockers / warnings / missing data</div>
                  </div>
                </div>

                <div className="action-row">
                  <StatusBadge tone={getReadinessTone(entry.readiness.status)}>{humanizeTokenLabel(entry.readiness.status)}</StatusBadge>
                  {entry.parcel ? <StatusBadge tone="surface">{formatMetric(entry.parcel.landAreaSqm)} sqm</StatusBadge> : null}
                </div>

                <div className="comparison-card__drivers">
                  <div className="comparison-card__section-label">Top drivers</div>
                  {entry.topDrivers.length ? (
                    <ul className="comparison-list">
                      {entry.topDrivers.map((driver) => (
                        <li key={driver}>{driver}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="field-help">No driver summary yet. Run this scenario first.</div>
                  )}
                </div>

                <div className="comparison-card__drivers">
                  <div className="comparison-card__section-label">Recommendation</div>
                  <div className="comparison-card__recommendation">{entry.recommendation}</div>
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
            ))}
          </div>
        </SectionCard>

        <SectionCard
          className="index-surface index-surface--ledger"
          eyebrow="KPI deltas"
          title="Metric comparison"
          description="Scan the leaders and deltas row by row."
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
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Scenario comparison unavailable"
          description="The compare view could not load because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
