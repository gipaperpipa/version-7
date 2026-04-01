import Link from "next/link";
import type { ParcelDto, PlanningParameterDto, ScenarioDto, ScenarioRunDto } from "@repo/contracts";
import { ResultAnalysisPanels } from "@/components/analysis/result-analysis-panels";
import { ResultExplanationCard } from "@/components/scenarios/result-explanation-card";
import { RunDiagnosticsPanel } from "@/components/scenarios/run-diagnostics-panel";
import { buttonClasses } from "@/components/ui/button";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusBadge, getReadinessTone, getRunStatusTone } from "@/components/ui/status-badge";
import { VerdictPanel } from "@/components/ui/verdict-panel";
import { sprint1PlanningFieldDefinitions } from "@/lib/ui/planning-field-definitions";
import {
  acquisitionTypeLabels,
  assumptionProfileLabels,
  humanizeTokenLabel,
  optimizationTargetLabels,
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

function getNextActionCopy(runId: string, scenarioId: string, verdictTitle: string, hasPlanningLink: boolean) {
  if (verdictTitle === "Run failed") {
    return {
      title: "Return to the builder and fix the failing input path",
      description: `Run ${runId} surfaced a concrete failure. Review the diagnostics first, then return to scenario ${scenarioId} to correct the upstream issue before retrying.`,
    };
  }

  if (verdictTitle === "Needs planning refinement") {
    return {
      title: "Refine planning before trusting the result",
      description: hasPlanningLink
        ? "The output exists, but planning-critical buildability inputs are still too weak or too heuristic for a stronger directional decision."
        : "The output exists, but the planning context is still too thin for a stronger directional decision.",
    };
  }

  if (verdictTitle === "Not ready for decision") {
    return {
      title: "Tighten assumptions before treating this as a decision signal",
      description: "Use the diagnostics to improve planning, funding, or scenario assumptions before relying on the current output.",
    };
  }

  if (verdictTitle === "Run in progress") {
    return {
      title: "Wait for the engine to complete, then review the output",
      description: "This run is still moving through the queue or engine. Once it finishes, return here to review the decision summary and diagnostics.",
    };
  }

  return {
    title: "Use this result as a directional decision memo",
    description: "The output is still heuristic, but it is coherent enough to guide the next discussion about planning assumptions, funding structure, and viability.",
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
  const nextAction = getNextActionCopy(run.id, scenario.id, verdict.title, Boolean(planningHref));
  const filledPlanningItems = planningParameters.filter(hasPlanningValue);
  const readinessPlanningCount = planningParameters.filter((item) => {
    const definition = sprint1PlanningFieldDefinitions.find((candidate) => candidate.keySlug === item.keySlug);
    return Boolean(definition?.affectsReadiness && hasPlanningValue(item));
  }).length;
  const derivedPlanningCount = planningParameters.filter((item) => item.keySlug === "BUILDABLE_WINDOW").length;
  const planningHighlights = filledPlanningItems.slice(0, 4);
  const assumptionProfile = result.assumptions?.profileKey ?? scenario.assumptionSet?.profileKey ?? "BASELINE";

  return (
    <div className="workspace-page content-stack report-page">
      <PageHeader
        eyebrow="Scenario report"
        title={`${scenario.name} report`}
        description="Shareable scenario memo with verdict, KPI summary, planning context, confidence, and key drivers."
        meta={(
          <div className="action-row">
            <StatusBadge tone={getRunStatusTone(run.status)}>{humanizeTokenLabel(run.status)}</StatusBadge>
            {run.readinessStatus ? <StatusBadge tone={getReadinessTone(run.readinessStatus)}>{humanizeTokenLabel(run.readinessStatus)}</StatusBadge> : null}
            <span className="meta-chip">{strategyTypeLabels[scenario.strategyType]}</span>
            <span className="meta-chip">{optimizationTargetLabels[scenario.optimizationTarget]}</span>
            <span className="meta-chip">{assumptionProfileLabels[assumptionProfile]}</span>
            {run.engineVersion ? <span className="meta-chip">{run.engineVersion}</span> : null}
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

      <VerdictPanel
        className="dashboard-hero decision-hero result-hero"
        eyebrow="Decision verdict"
        title={verdict.title}
        summary={verdict.summary}
        tone={verdict.tone}
        context={(
          <div className="action-row">
            {parcel ? <StatusBadge tone="surface">{parcel.name ?? parcel.cadastralId ?? "Parcel linked"}</StatusBadge> : null}
            <StatusBadge tone="surface">{strategyTypeLabels[scenario.strategyType]}</StatusBadge>
            <StatusBadge tone="surface">{acquisitionTypeLabels[scenario.acquisitionType]}</StatusBadge>
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
                Parcel
              </Link>
            ) : null}
            <Link className={buttonClasses({ size: "sm" })} href={builderHref}>
              Refine scenario
            </Link>
          </>
        )}
      />

      <div className="report-grid">
        <SectionCard
          className="summary-band report-surface"
          eyebrow="Project summary"
          title="Parcel and scenario"
          description="Core parcel, strategy, and assumption posture for this memo."
          size="compact"
        >
          <div className="key-value-grid">
            <div className="key-value-card">
              <div className="key-value-card__label">Parcel</div>
              <div className="key-value-card__value">{parcel?.name ?? parcel?.cadastralId ?? "Parcel unavailable"}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Municipality</div>
              <div className="key-value-card__value">{parcel?.municipalityName ?? parcel?.city ?? "n/a"}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Land area</div>
              <div className="key-value-card__value">{parcel?.landAreaSqm ?? "n/a"}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Parcel source</div>
              <div className="key-value-card__value">{parcel?.sourceType ?? "n/a"}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Strategy</div>
              <div className="key-value-card__value">{strategyTypeLabels[scenario.strategyType]}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Optimization target</div>
              <div className="key-value-card__value">{optimizationTargetLabels[scenario.optimizationTarget]}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Acquisition</div>
              <div className="key-value-card__value">{acquisitionTypeLabels[scenario.acquisitionType]}</div>
            </div>
            <div className="key-value-card">
              <div className="key-value-card__label">Assumption set</div>
              <div className="key-value-card__value">{assumptionProfileLabels[assumptionProfile]}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="summary-band report-surface"
          eyebrow="Planning and signal summary"
          title="Planning readiness"
          description="Parcel interpretation coverage and signal quality attached to the current run."
          size="compact"
        >
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
              <div className="ops-summary-item__label">Derived values</div>
              <div className="ops-summary-item__value">{derivedPlanningCount}</div>
              <div className="ops-summary-item__detail">Source-backed or read-only planning values.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Output confidence</div>
              <div className="ops-summary-item__value">{run.confidence.outputConfidencePct ?? "n/a"}</div>
              <div className="ops-summary-item__detail">Directional confidence score returned by the run.</div>
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
        </SectionCard>
      </div>

      <SectionCard
        className="summary-band decision-summary report-surface"
        eyebrow="KPI summary"
        title="Headline metrics"
        description="Core feasibility signals to review before the chart layer."
        tone="accent"
        size="compact"
      >
        <div className="metrics-grid">
          <StatBlock label="Buildable BGF" value={result.buildableBgfSqm ?? "n/a"} caption="Estimated gross floor area" tone="accent" />
          <StatBlock label="Required equity" value={result.requiredEquity ?? "n/a"} caption="Residual equity after debt layers" tone="warning" />
          <StatBlock label="Break-even rent" value={result.breakEvenRentEurSqm ?? result.breakEvenSalesPriceEurSqm ?? "n/a"} caption="Primary threshold signal" tone="success" />
          <StatBlock
            label={result.netSalesRevenue ? "Net sales revenue" : "NOI annual"}
            value={result.netSalesRevenue ?? result.netOperatingIncomeAnnual ?? "n/a"}
            caption={result.netSalesRevenue ? "Net proceeds after closing costs" : "Annual operating income after opex"}
          />
        </div>
      </SectionCard>

      <ResultAnalysisPanels run={run} result={result} />

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
                Open parcel
              </Link>
            ) : null}
          </>
        )}
      />

      <ResultExplanationCard explanation={result.explanation ?? null} />
      <RunDiagnosticsPanel run={run} />
    </div>
  );
}
