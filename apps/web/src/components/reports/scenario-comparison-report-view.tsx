import Link from "next/link";
import { type ScenarioComparisonEntryDto, type ScenarioComparisonResponseDto } from "@repo/contracts";
import { ComparisonAnalysisPanels } from "@/components/analysis/comparison-analysis-panels";
import { buttonClasses } from "@/components/ui/button";
import { DiagnosticGroup } from "@/components/ui/diagnostic-group";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, getReadinessTone, getRunStatusTone, getScenarioGovernanceTone, getScenarioStatusTone } from "@/components/ui/status-badge";
import { buildComparisonDecisionMemo } from "@/lib/scenarios/report-recommendations";
import {
  humanizeTokenLabel,
  optimizationTargetLabels,
  scenarioGovernanceStatusLabels,
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

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
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

function buildAssumptionDiffRows(entries: ScenarioComparisonEntryDto[]) {
  const first = entries[0];
  if (!first) return [];

  return Object.entries(first.scenario.assumptionSummary.details)
    .filter(([key]) => {
      const values = entries.map((entry) => String(entry.scenario.assumptionSummary.details[key]?.effectiveValue ?? "n/a"));
      return new Set(values).size > 1;
    })
    .map(([key, detail]) => ({
      key,
      label: detail.label,
      values: entries.map((entry) => entry.scenario.assumptionSummary.details[key]),
    }));
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
  const assumptionDiffRows = buildAssumptionDiffRows(comparison.entries);
  const compareHref = `/${orgSlug}/scenarios/compare?${scenarioIds.map((scenarioId) => `scenarioId=${encodeURIComponent(scenarioId)}`).join("&")}${comparison.rankingTarget ? `&rankingTarget=${encodeURIComponent(comparison.rankingTarget)}` : ""}`;
  const generatedAt = formatTimestamp(new Date().toISOString());
  const familyCount = new Set(comparison.entries.map((entry) => entry.scenario.familyKey)).size;
  const rankedEntries = comparison.entries.filter((entry) => entry.rank !== null);
  const trailingEntries = rankedEntries.filter((entry) => (entry.rank ?? 0) > 1).slice(0, 2);
  const recommendationMemo = buildComparisonDecisionMemo({
    comparison,
    assumptionDiffLabels: assumptionDiffRows.map((row) => row.label),
  });

  return (
    <div className="workspace-page content-stack report-page">
      <PageHeader
        eyebrow="Comparison report"
        title="Scenario comparison memo"
        description="Memo-style readout for ranking, KPI deltas, readiness burden, assumption differences, and recommendation framing across governed scenarios."
        meta={(
          <div className="action-row">
            <span className="meta-chip">{comparison.entries.length} scenarios</span>
            <span className="meta-chip">{familyCount} families</span>
            <span className="meta-chip">{optimizationTargetLabels[comparison.rankingTarget]}</span>
            <span className="meta-chip">Compared {generatedAt}</span>
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

      <div className="report-print-meta report-print-only">
        <div className="report-print-meta__title">Feasibility OS comparison memo</div>
        <div className="report-print-meta__row">
          <span>Prepared {generatedAt}</span>
          <span>{comparison.entries.length} scenarios</span>
          <span>{familyCount} families</span>
          <span>{optimizationTargetLabels[comparison.rankingTarget]}</span>
        </div>
        <div className="report-print-meta__row">
          <span>{leader ? `${leader.scenario.name} currently leads` : "No current leader"}</span>
          <span>{comparison.mixedOptimizationTargets ? "Mixed optimization targets" : "Aligned optimization targets"}</span>
        </div>
        <div className="report-print-meta__note">
          Internal comparison memo. Ranking remains heuristic and should be read together with readiness burden, trust posture, and assumption differences.
        </div>
      </div>

      <SectionCard
        className="summary-band decision-summary report-surface"
        eyebrow="Comparison verdict"
        title={leader ? `${leader.scenario.name} currently leads` : "No current leader"}
        description={leader
          ? `${leader.scenario.name} is leading for ${optimizationTargetLabels[comparison.rankingTarget].toLowerCase()}. The sections below explain whether that lead is driven by economics, cleaner readiness, better assumptions, or lower signal burden.`
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
            <div className="ops-summary-item__label">Leader anchor</div>
            <div className="ops-summary-item__value">{leader?.parcel?.name ?? leader?.parcel?.cadastralId ?? "n/a"}</div>
            <div className="ops-summary-item__detail">Current site/parcel anchor for the leading case.</div>
          </div>
          <div className="ops-summary-item">
            <div className="ops-summary-item__label">Leader lifecycle</div>
            <div className="ops-summary-item__value">{leader ? scenarioGovernanceStatusLabels[leader.scenario.governanceStatus] : "n/a"}</div>
            <div className="ops-summary-item__detail">{leader?.scenario.isCurrentBest ? "Marked current lead in its family." : "Not marked current lead."}</div>
          </div>
          <div className="ops-summary-item">
            <div className="ops-summary-item__label">Leader recommendation</div>
            <div className="ops-summary-item__value">{leader?.recommendation ?? "Need more comparable runs"}</div>
            <div className="ops-summary-item__detail">Use this with the lagging-case notes below.</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        className="index-surface report-surface"
        eyebrow="Decision call"
        title={recommendationMemo.headline}
        description={recommendationMemo.summary}
        tone={recommendationMemo.cardTone}
        size="compact"
        actions={<StatusBadge tone={recommendationMemo.postureTone}>{recommendationMemo.postureLabel}</StatusBadge>}
      >
        <div className="content-stack">
          <div className="key-value-grid">
            <div className="key-value-card">
              <div className="key-value-card__label">Current call</div>
              <div className="key-value-card__value">{recommendationMemo.decisionCall}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Leader context</div>
              <div className="key-value-card__value">{recommendationMemo.leaderContext}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Closest challenger</div>
              <div className="key-value-card__value">{recommendationMemo.challengerContext}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Confidence gate</div>
              <div className="key-value-card__value">{recommendationMemo.confidenceGate}</div>
            </div>
          </div>

          <div className="diagnostic-grid">
            <DiagnosticGroup title="Why the leader is still ahead" emptyLabel="No leader-support reasons were synthesized.">
              {recommendationMemo.whyLeader.length ? (
                <div className="signal-list">
                  {recommendationMemo.whyLeader.map((item) => (
                    <div key={item} className="signal-row">
                      <div className="signal-row__badges">
                        <StatusBadge tone="accent">Support</StatusBadge>
                      </div>
                      <div className="signal-row__text">{item}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </DiagnosticGroup>

            <DiagnosticGroup title="What could change the call" emptyLabel="No recommendation-change risks were synthesized.">
              {recommendationMemo.changeRisks.length ? (
                <div className="signal-list">
                  {recommendationMemo.changeRisks.map((item) => (
                    <div key={item} className="signal-row">
                      <div className="signal-row__badges">
                        <StatusBadge tone="warning">Watch</StatusBadge>
                      </div>
                      <div className="signal-row__text">{item}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </DiagnosticGroup>
          </div>

          <DiagnosticGroup title="Recommended next comparison moves" emptyLabel="No additional comparison follow-ups were synthesized.">
            {recommendationMemo.nextMoves.length ? (
              <div className="signal-list">
                {recommendationMemo.nextMoves.map((item) => (
                  <div key={item} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="accent">Next</StatusBadge>
                    </div>
                    <div className="signal-row__text">{item}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>
        </div>
      </SectionCard>

      <SectionCard
        className="index-surface report-surface"
        eyebrow="Recommendation framing"
        title="Why the leader leads and why others trail"
        description="Use this as the decision narrative before dropping into tables and charts."
        size="compact"
      >
        <div className="diagnostic-grid">
          <DiagnosticGroup title="Current leader" emptyLabel="No leader recommendation available.">
            {leader ? (
              <div className="signal-list">
                <div className="signal-row">
                  <div className="signal-row__badges">
                    <StatusBadge tone="accent">Leader</StatusBadge>
                    <StatusBadge tone={getScenarioGovernanceTone(leader.scenario.governanceStatus)}>
                      {scenarioGovernanceStatusLabels[leader.scenario.governanceStatus]}
                    </StatusBadge>
                    {leader.scenario.isCurrentBest ? <StatusBadge tone="accent">Current lead</StatusBadge> : null}
                  </div>
                  <div className="signal-row__text">{leader.recommendation}</div>
                </div>
                {leader.topDrivers.map((driver) => (
                  <div key={driver} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="accent">Driver</StatusBadge>
                    </div>
                    <div className="signal-row__text">{driver}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>

          <DiagnosticGroup title="Trailing scenarios" emptyLabel="No trailing scenarios were ranked.">
            {trailingEntries.length ? (
              <div className="signal-list">
                {trailingEntries.map((entry) => (
                  <div key={entry.scenario.id} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="warning">Rank {entry.rank}</StatusBadge>
                      <StatusBadge tone={getScenarioGovernanceTone(entry.scenario.governanceStatus)}>
                        {scenarioGovernanceStatusLabels[entry.scenario.governanceStatus]}
                      </StatusBadge>
                    </div>
                    <div className="signal-row__text">
                      {entry.scenario.name}: {entry.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>
        </div>
      </SectionCard>

      <SectionCard
        className="index-surface index-surface--ledger report-surface"
        eyebrow="Scenario set"
        title="Scenario summary rows"
        description="Compare family, lifecycle, assumption posture, readiness, and recommendation without leaving the memo."
        size="compact"
      >
        <div className="report-table">
          <div className="report-table__header report-table__header--scenario">
            <div>Scenario</div>
            <div>Site and strategy</div>
            <div>Lifecycle and signal</div>
            <div>Assumptions</div>
            <div>Recommendation</div>
          </div>

          {comparison.entries.map((entry) => {
            const explanation = entry.latestRun?.financialResult?.explanation ?? null;
            const weakestLink = explanation?.weakestLinks?.[0] ?? explanation?.tradeoffs?.[0] ?? "No explicit weakest link returned.";
            const fundingCount = entry.scenario.fundingVariants.filter((item) => item.isEnabled).length;

            return (
              <div key={entry.scenario.id} className="report-table__row report-table__row--scenario">
                <div className="report-table__cell">
                  <div className="report-table__title">{entry.scenario.name}</div>
                  <div className="report-table__meta-row">
                    <StatusBadge tone={entry.rank === 1 ? "accent" : "surface"}>{entry.rank ? `Rank ${entry.rank}` : "Unranked"}</StatusBadge>
                    <StatusBadge tone={getScenarioGovernanceTone(entry.scenario.governanceStatus)}>
                      {scenarioGovernanceStatusLabels[entry.scenario.governanceStatus]}
                    </StatusBadge>
                    <StatusBadge tone={getScenarioStatusTone(entry.scenario.status)}>{humanizeTokenLabel(entry.scenario.status)}</StatusBadge>
                    {entry.scenario.isCurrentBest ? <StatusBadge tone="accent">Current lead</StatusBadge> : null}
                  </div>
                  <div className="report-table__detail">Family v{entry.scenario.familyVersion}</div>
                </div>

                <div className="report-table__cell">
                  <div className="report-table__value">{entry.parcel?.name ?? entry.parcel?.cadastralId ?? "Parcel missing"}</div>
                  <div className="report-table__detail">{strategyTypeLabels[entry.scenario.strategyType]}</div>
                  <div className="report-table__detail">
                    {entry.parcel?.landAreaSqm ?? "n/a"} sqm / source {entry.parcel?.sourceType ?? "n/a"}
                  </div>
                </div>

                <div className="report-table__cell">
                  <div className="report-table__meta-row">
                    <StatusBadge tone={getReadinessTone(entry.readiness.status)}>{humanizeTokenLabel(entry.readiness.status)}</StatusBadge>
                    {entry.latestRun ? <StatusBadge tone={getRunStatusTone(entry.latestRun.status)}>{humanizeTokenLabel(entry.latestRun.status)}</StatusBadge> : null}
                  </div>
                  <div className="report-table__detail">
                    {entry.blockerCount} blockers / {entry.warningCount} warnings / {entry.missingDataCount} missing / {fundingCount} funding lane{fundingCount === 1 ? "" : "s"}
                  </div>
                </div>

                <div className="report-table__cell">
                  <div className="report-table__value">{entry.scenario.assumptionSummary.templateName ?? humanizeTokenLabel(entry.scenario.assumptionSummary.profileKey)}</div>
                  <div className="report-table__detail">
                    {entry.scenario.assumptionSummary.overrideCount} override{entry.scenario.assumptionSummary.overrideCount === 1 ? "" : "s"}
                    {entry.scenario.assumptionSummary.isWorkspaceDefault ? " / workspace default" : ""}
                  </div>
                </div>

                <div className="report-table__cell">
                  <div className="report-table__value">{entry.recommendation}</div>
                  <div className="report-table__detail">{weakestLink}</div>
                  <div className="action-row action-row--compact">
                    <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/scenarios/${entry.scenario.id}/builder`}>
                      Builder
                    </Link>
                    {entry.latestRun ? (
                      <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={`/${orgSlug}/scenarios/${entry.scenario.id}/results/${entry.latestRun.id}/report`}>
                        Scenario report
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
        eyebrow="Readiness and confidence"
        title="Signal-burden comparison"
        description="Use this section to compare blocker load, warning load, missing-data burden, and output trust before treating rank as decision-grade."
        size="compact"
      >
        <div className="comparison-table">
          <div className="comparison-table__header">
            <div>Signal</div>
            {comparison.entries.map((entry) => (
              <div key={entry.scenario.id}>{entry.scenario.name}</div>
            ))}
          </div>

          {[
            {
              label: "Readiness status",
              detail: "Scenario readiness posture carried into comparison",
              values: comparison.entries.map((entry) => humanizeTokenLabel(entry.readiness.status)),
            },
            {
              label: "Execution blockers",
              detail: "Blocking issues still attached to the scenario",
              values: comparison.entries.map((entry) => entry.blockerCount),
            },
            {
              label: "Warnings",
              detail: "Non-blocking warning count",
              values: comparison.entries.map((entry) => entry.warningCount),
            },
            {
              label: "Missing data",
              detail: "Fallback or missing-data burden",
              values: comparison.entries.map((entry) => entry.missingDataCount),
            },
            {
              label: "Output confidence",
              detail: "Directional trust in the latest run",
              values: comparison.entries.map((entry) => entry.latestRun?.confidence.outputConfidencePct ?? null),
            },
          ].map((row) => (
            <div key={row.label} className="comparison-table__row">
              <div className="comparison-table__metric">
                <div className="comparison-table__metric-label">{row.label}</div>
                <div className="comparison-table__metric-detail">{row.detail}</div>
              </div>
              {row.values.map((value, index) => (
                <div key={`${row.label}-${comparison.entries[index].scenario.id}`} className="comparison-table__value">
                  <div className="comparison-table__value-main">{formatMetric(value)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        className="index-surface index-surface--ledger report-surface"
        eyebrow="Assumption comparison"
        title="Effective assumption differences"
        description="Use this to see which assumption posture differences most likely explain why one case beats another."
        size="compact"
      >
        {assumptionDiffRows.length ? (
          <div className="comparison-table">
            <div className="comparison-table__header">
              <div>Assumption</div>
              {comparison.entries.map((entry) => (
                <div key={entry.scenario.id}>{entry.scenario.name}</div>
              ))}
            </div>

            {assumptionDiffRows.map((row) => (
              <div key={row.key} className="comparison-table__row">
                <div className="comparison-table__metric">
                  <div className="comparison-table__metric-label">{row.label}</div>
                  <div className="comparison-table__metric-detail">Only fields with actual effective-value differences are shown.</div>
                </div>
                {row.values.map((detail, index) => (
                  <div key={`${row.key}-${comparison.entries[index].scenario.id}`} className="comparison-table__value">
                    <div className="comparison-table__value-main">{formatMetric(detail?.effectiveValue ?? null)}</div>
                    <div className="comparison-table__value-detail">
                      {detail?.isOverridden ? "Override" : "Template"}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="field-help">The compared scenarios are carrying the same effective assumption posture.</div>
        )}
      </SectionCard>

      <SectionCard
        className="index-surface index-surface--ledger report-surface"
        eyebrow="KPI delta summary"
        title="Metric comparison table"
        description="Exact KPI readout behind the ranking and chart layer."
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

      <SectionCard
        className="index-surface report-surface report-section--appendix"
        eyebrow="Decision-useful charts"
        title="Chart appendix"
        description="These visuals help compare rank, capital pressure, threshold pressure, output confidence, and burden. They support the memo above rather than replacing it."
        size="compact"
      >
        <div className="field-help">
          Review the charts below after reading the ranking summary, readiness comparison, and assumption differences.
        </div>
      </SectionCard>

      <ComparisonAnalysisPanels comparison={comparison} />

      <div className="report-footnote">
        Internal memo only. Use the current leader recommendation together with blocker load, missing-data burden, and assumption-difference evidence before treating the ranking as decision-grade.
      </div>
    </div>
  );
}
