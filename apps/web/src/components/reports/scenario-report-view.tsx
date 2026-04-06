import Link from "next/link";
import type { ParcelDto, PlanningParameterDto, ScenarioDto, ScenarioRunDto } from "@repo/contracts";
import { ResultAnalysisPanels } from "@/components/analysis/result-analysis-panels";
import { ResultExplanationCard } from "@/components/scenarios/result-explanation-card";
import { RunDiagnosticsPanel } from "@/components/scenarios/run-diagnostics-panel";
import { buttonClasses } from "@/components/ui/button";
import { DiagnosticGroup } from "@/components/ui/diagnostic-group";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusBadge, getReadinessTone, getRunStatusTone } from "@/components/ui/status-badge";
import { VerdictPanel } from "@/components/ui/verdict-panel";
import { buildScenarioDecisionMemo } from "@/lib/scenarios/report-recommendations";
import { buildParcelCompletenessSummary } from "@/lib/ui/parcel-completeness";
import { sprint1PlanningFieldDefinitions } from "@/lib/ui/planning-field-definitions";
import { getConfidenceBand } from "@/lib/ui/provenance";
import {
  acquisitionTypeLabels,
  humanizeTokenLabel,
  optimizationTargetLabels,
  scenarioGovernanceStatusLabels,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";
import { getRunVerdict } from "@/lib/ui/verdicts";
import { PrintReportButton } from "./print-report-button";

function hasPlanningValue(item: PlanningParameterDto) {
  return item.valueNumber !== null || item.valueBoolean !== null || item.valueText !== null || item.geom !== null;
}

function formatPlanningValue(item: PlanningParameterDto) {
  if (item.valueNumber !== null) return item.unit ? `${item.valueNumber} ${item.unit}` : item.valueNumber;
  if (item.valueBoolean !== null) return item.valueBoolean ? "Yes" : "No";
  if (item.valueText) return item.valueText;
  if (item.geom) return "Geometry attached";
  return "Not set";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not yet run";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatAssumptionValue(value: string | number | null | undefined) {
  if (value == null || value === "") return "n/a";
  return String(value);
}

function getConfidenceStatTone(band: string) {
  if (band === "High") return "success";
  if (band === "Medium") return "warning";
  if (band === "Low") return "danger";
  return "neutral";
}

function getNextActionCopy(verdictTitle: string, hasPlanningLink: boolean) {
  if (verdictTitle === "Run failed") {
    return {
      title: "Return to the builder and fix the failing path",
      description: "Review diagnostics first, then correct the upstream issue before retrying this governed scenario.",
    };
  }

  if (verdictTitle === "Needs planning refinement") {
    return {
      title: "Strengthen planning context before trusting this memo",
      description: hasPlanningLink
        ? "The scenario can be discussed directionally, but planning-critical inputs are still too thin for a stronger decision posture."
        : "The scenario can be discussed directionally, but planning context is still too thin for a stronger decision posture.",
    };
  }

  if (verdictTitle === "Not ready for decision") {
    return {
      title: "Tighten assumptions and trust before relying on this case",
      description: "Use the caveats, weakest links, and missing-data burden below to decide what to improve next.",
    };
  }

  if (verdictTitle === "Run in progress") {
    return {
      title: "Wait for the engine to complete before sharing this memo",
      description: "This scenario has not finished running yet, so the memo should remain provisional until the final result is available.",
    };
  }

  return {
    title: "Use this as a directional feasibility memo",
    description: "The case is still heuristic, but the current evidence is coherent enough to support internal review and next-step decisions.",
  };
}

export function ScenarioReportView({
  orgSlug,
  scenario,
  run,
  parcel,
  planningParameters,
}: {
  orgSlug: string;
  scenario: ScenarioDto;
  run: ScenarioRunDto;
  parcel: ParcelDto | null;
  planningParameters: PlanningParameterDto[];
}) {
  const result = run.financialResult;
  if (!result) return null;

  const verdict = getRunVerdict(run);
  const builderHref = `/${orgSlug}/scenarios/${scenario.id}/builder`;
  const resultHref = `/${orgSlug}/scenarios/${scenario.id}/results/${run.id}`;
  const parcelHref = scenario.parcelId ? `/${orgSlug}/parcels/${scenario.parcelId}` : null;
  const planningHref = scenario.parcelId ? `/${orgSlug}/parcels/${scenario.parcelId}/planning` : null;
  const nextAction = getNextActionCopy(verdict.title, Boolean(planningHref));
  const filledPlanningItems = planningParameters.filter(hasPlanningValue);
  const readinessPlanningCount = planningParameters.filter((item) => {
    const definition = sprint1PlanningFieldDefinitions.find((candidate) => candidate.keySlug === item.keySlug);
    return Boolean(definition?.affectsReadiness && hasPlanningValue(item));
  }).length;
  const planningHighlights = filledPlanningItems.slice(0, 4);
  const explanation = result.explanation ?? null;
  const completenessSummary = parcel
    ? buildParcelCompletenessSummary({
        parcel,
        planningItems: planningParameters,
        linkedScenarios: [scenario],
      })
    : null;
  const assumptionRows = Object.values(scenario.assumptionSummary.details);
  const overriddenRows = assumptionRows.filter((item) => item.isOverridden);
  const effectiveAssumptionRows = overriddenRows.length
    ? [...overriddenRows, ...assumptionRows.filter((item) => !item.isOverridden).slice(0, Math.max(0, 6 - overriddenRows.length))].slice(0, 6)
    : assumptionRows.slice(0, 6);
  const blockers = run.readinessIssues.filter((issue) => issue.severity === "BLOCKING");
  const readinessWarnings = run.readinessIssues.filter((issue) => issue.severity === "WARNING");
  const missingDataFlags = run.missingDataFlags ?? [];
  const heuristicWarnings = run.warnings ?? [];
  const confidenceReasons = run.confidence?.reasons ?? [];
  const outputConfidenceBand = getConfidenceBand(run.confidence?.outputConfidencePct);
  const latestRunLabel = formatTimestamp(run.finishedAt ?? run.startedAt ?? run.requestedAt);
  const preparedAtLabel = formatTimestamp(new Date().toISOString());
  const groupedSiteLabel = parcel?.isGroupSite
    ? `Grouped site / ${parcel.parcelGroup?.memberCount ?? parcel.constituentParcels.length} parcel members`
    : "Standalone parcel anchor";
  const keyCaveat = blockers[0]?.message
    ?? readinessWarnings[0]?.message
    ?? heuristicWarnings[0]?.message
    ?? explanation?.weakestLinks?.[0]
    ?? (missingDataFlags[0] ? `Missing data burden: ${humanizeTokenLabel(missingDataFlags[0])}` : "No major caveat line surfaced.");
  const decisionMemo = buildScenarioDecisionMemo({
    scenario,
    run,
    parcel,
    planningParameters,
  });

  return (
    <div className="workspace-page content-stack report-page">
      <PageHeader
        eyebrow="Scenario report"
        title={scenario.name}
        description="Memo-style review of one governed scenario, including verdict, KPI summary, site context, effective assumptions, caveats, and decision-useful charts."
        meta={(
          <div className="action-row">
            <StatusBadge tone={getRunStatusTone(run.status)}>{humanizeTokenLabel(run.status)}</StatusBadge>
            {scenario.readinessSnapshot || run.readinessStatus ? (
              <StatusBadge tone={getReadinessTone(scenario.readinessSnapshot?.status ?? run.readinessStatus ?? null)}>
                {scenario.readinessSnapshot ? humanizeTokenLabel(scenario.readinessSnapshot.status) : humanizeTokenLabel(run.readinessStatus!)}
              </StatusBadge>
            ) : null}
            <StatusBadge tone="surface">{scenarioGovernanceStatusLabels[scenario.governanceStatus]}</StatusBadge>
            {scenario.isCurrentBest ? <StatusBadge tone="accent">Current lead</StatusBadge> : null}
            <span className="meta-chip">Family v{scenario.familyVersion}</span>
            <span className="meta-chip">Latest run {latestRunLabel}</span>
          </div>
        )}
        actions={(
          <div className="report-print-actions">
            <Link className={buttonClasses({ variant: "secondary" })} href={resultHref}>
              Result view
            </Link>
            <Link className={buttonClasses()} href={builderHref}>
              Builder
            </Link>
            <PrintReportButton />
          </div>
        )}
      />

      <div className="report-print-meta report-print-only">
        <div className="report-print-meta__title">Feasibility OS scenario memo</div>
        <div className="report-print-meta__row">
          <span>Prepared {preparedAtLabel}</span>
          <span>Latest run {latestRunLabel}</span>
          <span>{strategyTypeLabels[scenario.strategyType]}</span>
          <span>{optimizationTargetLabels[scenario.optimizationTarget]}</span>
        </div>
        <div className="report-print-meta__row">
          <span>{parcel?.name ?? parcel?.cadastralId ?? "Parcel/site unavailable"}</span>
          <span>{groupedSiteLabel}</span>
          <span>{scenarioGovernanceStatusLabels[scenario.governanceStatus]}</span>
          {scenario.isCurrentBest ? <span>Current lead</span> : null}
        </div>
        <div className="report-print-meta__note">
          Internal feasibility memo. Heuristic confidence, source trust posture, and readiness caveats remain part of the recommendation.
        </div>
      </div>

      <VerdictPanel
        className="dashboard-hero decision-hero result-hero"
        eyebrow="Decision verdict"
        title={verdict.title}
        summary={verdict.summary}
        tone={verdict.tone}
        context={(
          <div className="action-row">
            {parcel ? <StatusBadge tone="surface">{parcel.name ?? parcel.cadastralId ?? "Linked site"}</StatusBadge> : null}
            <StatusBadge tone="surface">{groupedSiteLabel}</StatusBadge>
            <StatusBadge tone="surface">{strategyTypeLabels[scenario.strategyType]}</StatusBadge>
            <StatusBadge tone="surface">{acquisitionTypeLabels[scenario.acquisitionType]}</StatusBadge>
            <StatusBadge tone="surface">{optimizationTargetLabels[scenario.optimizationTarget]}</StatusBadge>
          </div>
        )}
        actions={(
          <>
            {planningHref ? (
              <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={planningHref}>
                Planning
              </Link>
            ) : null}
            {parcelHref ? (
              <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={parcelHref}>
                Parcel/site
              </Link>
            ) : null}
            <Link className={buttonClasses({ size: "sm" })} href={builderHref}>
              Refine scenario
            </Link>
          </>
        )}
      />

      <div className="detail-grid detail-grid--decision">
        <SectionCard
          className="summary-band report-surface"
          eyebrow="Verdict summary"
          title="Feasibility memo"
          description="The core decision posture, key caveat, and recommendation from the latest governed run."
          tone="accent"
          size="compact"
        >
          <div className="content-stack">
            <div className="key-value-grid">
              <div className="key-value-card">
                <div className="key-value-card__label">Lifecycle</div>
                <div className="key-value-card__value">{scenarioGovernanceStatusLabels[scenario.governanceStatus]}</div>
              </div>
              <div className="key-value-card">
                <div className="key-value-card__label">Family</div>
                <div className="key-value-card__value">v{scenario.familyVersion} / {strategyTypeLabels[scenario.strategyType]}</div>
              </div>
              <div className="key-value-card">
                <div className="key-value-card__label">Latest run</div>
                <div className="key-value-card__value">{latestRunLabel}</div>
              </div>
              <div className="key-value-card">
                <div className="key-value-card__label">Key caveat</div>
                <div className="key-value-card__value">{keyCaveat}</div>
              </div>
            </div>
            <div className="signal-list">
              <div className="signal-row">
                <div className="signal-row__badges">
                  <StatusBadge tone={verdict.tone}>{verdict.title}</StatusBadge>
                  {scenario.isCurrentBest ? <StatusBadge tone="accent">Current lead</StatusBadge> : null}
                </div>
                <div className="signal-row__text">{verdict.summary}</div>
              </div>
              <div className="signal-row">
                <div className="signal-row__badges">
                  <StatusBadge tone={decisionMemo.postureTone}>Decision call</StatusBadge>
                </div>
                <div className="signal-row__text">{decisionMemo.decisionCall}</div>
              </div>
            </div>
          </div>
        </SectionCard>

        <NextStepPanel
          className="rail-panel rail-panel--action"
          title={nextAction.title}
          description={nextAction.description}
          tone={verdict.tone === "success" ? "accent" : "muted"}
          size="compact"
          actions={(
            <>
              <Link className={buttonClasses()} href={builderHref}>
                Refine scenario
              </Link>
              {planningHref ? (
                <Link className={buttonClasses({ variant: "secondary" })} href={planningHref}>
                  Improve planning
                </Link>
              ) : null}
              {parcelHref ? (
                <Link className={buttonClasses({ variant: "ghost" })} href={parcelHref}>
                  Open parcel/site
                </Link>
              ) : null}
            </>
          )}
        />
      </div>

      <SectionCard
        className="summary-band decision-summary report-surface"
        eyebrow="KPI summary"
        title="Headline economics"
        description="The core feasibility signals to review before moving into caveats, assumptions, and charts."
        tone="accent"
        size="compact"
      >
        <div className="metrics-grid">
          <StatBlock label="Buildable BGF" value={result.buildableBgfSqm ?? "n/a"} caption="Estimated total gross floor area" tone="accent" />
          <StatBlock label="Required equity" value={result.requiredEquity ?? "n/a"} caption="Residual capital after debt layers" tone="warning" />
          <StatBlock label="Break-even rent" value={result.breakEvenRentEurSqm ?? "n/a"} caption="Primary rent-side threshold signal" tone="success" />
          <StatBlock label="Break-even sales" value={result.breakEvenSalesPriceEurSqm ?? "n/a"} caption="Primary sale-side threshold signal" />
          <StatBlock
            label={result.netSalesRevenue ? "Net sales revenue" : "NOI annual"}
            value={result.netSalesRevenue ?? result.netOperatingIncomeAnnual ?? "n/a"}
            caption={result.netSalesRevenue ? "Sale-side proceeds after closing costs" : "Operating signal after vacancy and opex"}
          />
          <StatBlock label="Output confidence" value={run.confidence?.outputConfidencePct ?? "n/a"} caption="Directional trust score returned by the run" tone={getConfidenceStatTone(outputConfidenceBand)} />
        </div>
      </SectionCard>

      <SectionCard
        className="index-surface report-surface"
        eyebrow="Recommendation path"
        title={decisionMemo.headline}
        description={decisionMemo.summary}
        tone={decisionMemo.cardTone}
        size="compact"
        actions={(
          <div className="action-row action-row--compact">
            <StatusBadge tone={decisionMemo.postureTone}>{decisionMemo.postureLabel}</StatusBadge>
            {scenario.isCurrentBest ? <StatusBadge tone="accent">Current lead</StatusBadge> : null}
          </div>
        )}
      >
        <div className="content-stack">
          <div className="key-value-grid">
            <div className="key-value-card">
              <div className="key-value-card__label">Decision call</div>
              <div className="key-value-card__value">{decisionMemo.decisionCall}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Use in review</div>
              <div className="key-value-card__value">{decisionMemo.reviewUse}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Confidence gate</div>
              <div className="key-value-card__value">{decisionMemo.confidenceGate}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">What upgrades this</div>
              <div className="key-value-card__value">{decisionMemo.upgradeLine}</div>
            </div>
          </div>

          <div className="diagnostic-grid">
            <DiagnosticGroup title="Why this is the call" emptyLabel="No supporting reasons were synthesized beyond the core verdict.">
              {decisionMemo.whyNow.length ? (
                <div className="signal-list">
                  {decisionMemo.whyNow.map((item) => (
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

            <DiagnosticGroup title="What could change the call" emptyLabel="No major recommendation-change triggers were synthesized.">
              {decisionMemo.watchItems.length ? (
                <div className="signal-list">
                  {decisionMemo.watchItems.map((item) => (
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

          <DiagnosticGroup title="Recommended next moves" emptyLabel="No additional next-step recommendations were synthesized.">
            {decisionMemo.nextMoves.length ? (
              <div className="signal-list">
                {decisionMemo.nextMoves.map((item) => (
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

      <div className="report-grid">
        <SectionCard
          className="summary-band report-surface"
          eyebrow="Parcel and planning context"
          title="Site identity and readiness footing"
          description="Source posture, grouped-site context, and planning completeness carried into this memo."
          size="compact"
        >
          <div className="content-stack">
            <div className="key-value-grid">
              <div className="key-value-card">
                <div className="key-value-card__label">Site anchor</div>
                <div className="key-value-card__value">{parcel?.name ?? parcel?.cadastralId ?? "Parcel unavailable"}</div>
              </div>
              <div className="key-value-card">
                <div className="key-value-card__label">Source posture</div>
                <div className="key-value-card__value">{parcel?.sourceType ?? "n/a"}</div>
              </div>
              <div className="key-value-card">
                <div className="key-value-card__label">Municipality</div>
                <div className="key-value-card__value">{parcel?.municipalityName ?? parcel?.city ?? "n/a"}</div>
              </div>
              <div className="key-value-card">
                <div className="key-value-card__label">Land area</div>
                <div className="key-value-card__value">{parcel?.landAreaSqm ?? "n/a"}</div>
              </div>
            </div>

            {parcel ? (
              <ProvenanceConfidence
                sourceType={parcel.sourceType}
                confidenceScore={parcel.confidenceScore}
                sourceReference={parcel.sourceReference}
                provenance={parcel.provenance}
                providerName={parcel.sourceProviderName}
                providerParcelId={parcel.sourceProviderParcelId}
                showDerivedFlags
              />
            ) : null}

            {completenessSummary ? (
              <div className="action-row">
                <StatusBadge tone={completenessSummary.sourceStatus.tone}>{completenessSummary.sourceStatus.label}</StatusBadge>
                <StatusBadge tone={completenessSummary.planningCompleteness.tone}>{completenessSummary.planningCompleteness.label}</StatusBadge>
                <StatusBadge tone={completenessSummary.scenarioContinuity.tone}>{completenessSummary.scenarioContinuity.label}</StatusBadge>
              </div>
            ) : null}

            <div className="ops-summary-grid ops-summary-grid--report">
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Planning fields saved</div>
                <div className="ops-summary-item__value">{filledPlanningItems.length}</div>
                <div className="ops-summary-item__detail">Current non-empty planning inputs.</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Readiness fields</div>
                <div className="ops-summary-item__value">{readinessPlanningCount}</div>
                <div className="ops-summary-item__detail">Planning items already affecting readiness.</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Scenario status</div>
                <div className="ops-summary-item__value">{humanizeTokenLabel(scenario.status)}</div>
                <div className="ops-summary-item__detail">Operational scenario state attached to this memo.</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Readiness snapshot</div>
                <div className="ops-summary-item__value">{scenario.readinessSnapshot ? humanizeTokenLabel(scenario.readinessSnapshot.status) : "n/a"}</div>
                <div className="ops-summary-item__detail">Governed scenario readiness posture before the run.</div>
              </div>
            </div>

            {planningHighlights.length ? (
              <div className="report-inline-list">
                {planningHighlights.map((item) => (
                  <div key={item.id} className="report-inline-list__item">
                    <span className="report-inline-list__label">{item.label}</span>
                    <span className="report-inline-list__value">{formatPlanningValue(item)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="field-help">No planning highlights yet. The scenario is still carrying a thin planning context.</div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          className="summary-band report-surface"
          eyebrow="Effective assumptions"
          title="Template, overrides, and effective values"
          description="The governed assumption posture that actually drove the run."
          size="compact"
          actions={(
            <div className="action-row action-row--compact">
              <StatusBadge tone="accent">{scenario.assumptionSummary.templateName ?? humanizeTokenLabel(scenario.assumptionSummary.profileKey)}</StatusBadge>
              {scenario.assumptionSummary.isWorkspaceDefault ? <StatusBadge tone="surface">Workspace default</StatusBadge> : null}
              <StatusBadge tone="surface">{scenario.assumptionSummary.overrideCount} override{scenario.assumptionSummary.overrideCount === 1 ? "" : "s"}</StatusBadge>
            </div>
          )}
        >
          <div className="content-stack">
            <div className="report-table">
              <div className="report-table__header report-table__header--scenario">
                <div>Assumption</div>
                <div>Template value</div>
                <div>Override</div>
                <div>Effective value</div>
              </div>
              {effectiveAssumptionRows.map((detail) => (
                <div key={detail.label} className="report-table__row report-table__row--scenario">
                  <div className="report-table__cell">
                    <div className="report-table__title">{detail.label}</div>
                  </div>
                  <div className="report-table__cell">
                    <div className="report-table__value">{formatAssumptionValue(detail.templateValue)}</div>
                  </div>
                  <div className="report-table__cell">
                    <div className="report-table__value">{detail.isOverridden ? formatAssumptionValue(detail.overrideValue) : "Not overridden"}</div>
                  </div>
                  <div className="report-table__cell">
                    <div className="report-table__value">{formatAssumptionValue(detail.effectiveValue)}</div>
                    <div className="report-table__detail">{detail.isOverridden ? "Scenario-specific override" : "Inherited from template"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        className="index-surface report-surface"
        eyebrow="Interpretation"
        title="Key drivers, weakest links, and next moves"
        description="This section explains what is helping the case, what is weakening it, and what should change next."
        size="compact"
      >
        <div className="diagnostic-grid">
          <DiagnosticGroup title="What helps the case" emptyLabel="No dominant drivers were returned.">
            {explanation?.dominantDrivers?.length ? (
              <div className="signal-list">
                {explanation.dominantDrivers.map((item) => (
                  <div key={item} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="accent">Driver</StatusBadge>
                    </div>
                    <div className="signal-row__text">{item}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>

          <DiagnosticGroup title="What weakens trust or margin" emptyLabel="No weakest links were returned.">
            {explanation?.weakestLinks?.length ? (
              <div className="signal-list">
                {explanation.weakestLinks.map((item) => (
                  <div key={item} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="warning">Weakest link</StatusBadge>
                    </div>
                    <div className="signal-row__text">{item}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>
        </div>

        <div className="diagnostic-grid">
          <DiagnosticGroup title="Tradeoffs" emptyLabel="No tradeoff commentary was returned.">
            {explanation?.tradeoffs?.length ? (
              <div className="signal-list">
                {explanation.tradeoffs.map((item) => (
                  <div key={item} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="surface">Tradeoff</StatusBadge>
                    </div>
                    <div className="signal-row__text">{item}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>

          <DiagnosticGroup title="Recommended next steps" emptyLabel="No explicit next-step recommendations were returned.">
            {explanation?.nextActions?.length ? (
              <div className="signal-list">
                {explanation.nextActions.map((item) => (
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
        eyebrow="Confidence and caveats"
        title="Missing data, confidence drag, and heuristic burden"
        description="Use this section to judge how much of the memo is still directional rather than decision-grade."
        size="compact"
      >
        <div className="content-stack">
          <div className="metrics-grid">
            <StatBlock label="Execution blockers" value={blockers.length} caption={blockers.length ? "Issues that weakened readiness before the run" : "No execution blockers carried into the run"} tone={blockers.length ? "danger" : "success"} />
            <StatBlock label="Warnings" value={readinessWarnings.length + heuristicWarnings.length} caption="Readiness and heuristic warning load" tone={readinessWarnings.length + heuristicWarnings.length ? "warning" : "success"} />
            <StatBlock label="Missing data" value={missingDataFlags.length} caption="Inputs still relying on fallback or missing data" tone={missingDataFlags.length ? "warning" : "success"} />
            <StatBlock label="Output confidence" value={run.confidence?.outputConfidencePct ?? "n/a"} caption={`Band ${outputConfidenceBand}`} tone={getConfidenceStatTone(outputConfidenceBand)} />
          </div>

          <div className="diagnostic-grid">
            <DiagnosticGroup title="Confidence-reducing issues" emptyLabel="No explicit blockers or warnings were carried into this run.">
              {[...blockers, ...readinessWarnings].length ? (
                <div className="signal-list">
                  {[...blockers, ...readinessWarnings].map((issue) => (
                    <div key={`${issue.code}-${issue.field ?? "global"}`} className="signal-row">
                      <div className="signal-row__badges">
                        <StatusBadge tone={issue.severity === "BLOCKING" ? "danger" : "warning"}>{humanizeTokenLabel(issue.code)}</StatusBadge>
                        {issue.field ? <StatusBadge tone="info">{issue.field}</StatusBadge> : null}
                      </div>
                      <div className="signal-row__text">{issue.message}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </DiagnosticGroup>

            <DiagnosticGroup title="Missing-data burden" emptyLabel="No missing-data flags were raised.">
              {missingDataFlags.length ? (
                <div className="chip-row">
                  {missingDataFlags.map((flag) => (
                    <StatusBadge key={flag} tone="warning">{humanizeTokenLabel(flag)}</StatusBadge>
                  ))}
                </div>
              ) : null}
            </DiagnosticGroup>
          </div>

          <div className="diagnostic-grid">
            <DiagnosticGroup title="Heuristic caveats" emptyLabel="No heuristic caveats were returned.">
              {heuristicWarnings.length ? (
                <div className="signal-list">
                  {heuristicWarnings.map((warning) => (
                    <div key={warning.code} className="signal-row">
                      <div className="signal-row__badges">
                        <StatusBadge tone="surface">{humanizeTokenLabel(warning.code)}</StatusBadge>
                      </div>
                      <div className="signal-row__text">{warning.message}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </DiagnosticGroup>

            <DiagnosticGroup title="Confidence notes" emptyLabel="No confidence notes were returned.">
              {confidenceReasons.length ? (
                <div className="signal-list">
                  {confidenceReasons.map((reason) => (
                    <div key={reason} className="signal-row">
                      <div className="signal-row__badges">
                        <StatusBadge tone="surface">Confidence</StatusBadge>
                      </div>
                      <div className="signal-row__text">{reason}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </DiagnosticGroup>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        className="index-surface report-surface report-section--appendix"
        eyebrow="Decision-useful charts"
        title="Chart appendix"
        description="These visuals support composition, comparison, and diagnosis. They are evidence for the memo above, not the memo itself."
        size="compact"
      >
        <div className="field-help">
          Review capital structure, uses, revenue composition, confidence, and signal burden here after reading the verdict, assumptions, and caveats.
        </div>
      </SectionCard>

      <ResultAnalysisPanels run={run} result={result} />
      <ResultExplanationCard explanation={explanation} />
      <RunDiagnosticsPanel run={run} />

      <div className="report-footnote">
        Internal memo only. Treat the recommendation together with source authority, missing-data burden, and heuristic caveats before relying on the scenario as decision-grade.
      </div>
    </div>
  );
}
