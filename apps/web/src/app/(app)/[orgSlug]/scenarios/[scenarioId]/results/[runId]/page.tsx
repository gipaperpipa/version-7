import Link from "next/link";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getScenario, getScenarioRun } from "@/lib/api/scenarios";
import { humanizeTokenLabel } from "@/lib/ui/enum-labels";
import { getRunVerdict } from "@/lib/ui/verdicts";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ResultExplanationCard } from "@/components/scenarios/result-explanation-card";
import { RunDiagnosticsPanel } from "@/components/scenarios/run-diagnostics-panel";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusBadge, getRunStatusTone } from "@/components/ui/status-badge";
import { VerdictPanel } from "@/components/ui/verdict-panel";

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
    title: "Use this result as a directional decision page",
    description: "The output is still heuristic, but it is coherent enough to guide the next discussion about planning assumptions, funding structure, and viability.",
  };
}

export default async function ScenarioResultPage({
  params,
}: {
  params: Promise<{ orgSlug: string; scenarioId: string; runId: string }>;
}) {
  const { orgSlug, scenarioId, runId } = await params;

  try {
    const [run, scenario] = await Promise.all([
      getScenarioRun(orgSlug, runId),
      getScenario(orgSlug, scenarioId),
    ]);

    const result = run.financialResult;
    const verdict = getRunVerdict(run);
    const builderHref = `/${orgSlug}/scenarios/${scenarioId}/builder`;
    const parcelHref = scenario.parcelId ? `/${orgSlug}/parcels/${scenario.parcelId}` : null;
    const planningHref = scenario.parcelId ? `/${orgSlug}/parcels/${scenario.parcelId}/planning` : null;
    const nextAction = getNextActionCopy(runId, scenarioId, verdict.title, Boolean(planningHref));

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Feasibility result"
          title={scenario.name}
          description="Verdict first. Weaknesses, next move, and diagnostics right after."
          meta={(
            <div className="action-row">
              <StatusBadge tone={getRunStatusTone(run.status)}>{humanizeTokenLabel(run.status)}</StatusBadge>
              {run.readinessStatus ? <StatusBadge tone="surface">Readiness {humanizeTokenLabel(run.readinessStatus)}</StatusBadge> : null}
              {run.engineVersion ? <span className="meta-chip">{run.engineVersion}</span> : null}
            </div>
          )}
          actions={(
            <>
              <Link className={buttonClasses({ variant: "secondary" })} href={builderHref}>
                Back to builder
              </Link>
            </>
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
              <StatusBadge tone={getRunStatusTone(run.status)}>Run {humanizeTokenLabel(run.status)}</StatusBadge>
              {run.readinessStatus ? <StatusBadge tone="surface">Readiness {humanizeTokenLabel(run.readinessStatus)}</StatusBadge> : null}
              {run.engineVersion ? <StatusBadge tone="surface">{run.engineVersion}</StatusBadge> : null}
            </div>
          )}
          actions={(
            <>
              {planningHref ? (
                <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={planningHref}>
                  Review planning
                </Link>
              ) : null}
              <Link className={buttonClasses({ size: "sm" })} href={builderHref}>
                Refine scenario
              </Link>
            </>
          )}
        />

        {result ? (
          <>
            <div className="detail-grid detail-grid--decision">
              <SectionCard
                className="summary-band decision-summary"
                eyebrow="Headline metrics"
                title="Decision summary"
                description="Scan these first."
                tone="accent"
                size="compact"
              >
                <div className="metrics-grid">
                  <StatBlock label="Buildable BGF" value={result.buildableBgfSqm ?? "n/a"} caption="Estimated total gross floor area" tone="accent" />
                  <StatBlock label="Required equity" value={result.requiredEquity ?? "n/a"} caption="Residual capital after debt layers" tone="warning" />
                  <StatBlock label="Break-even rent" value={result.breakEvenRentEurSqm ?? "n/a"} caption="EUR/sqm equivalent" tone="success" />
                  <StatBlock label="Estimated units" value={result.estimatedUnitCount ?? "n/a"} caption="Current unit-count signal from the v0 engine" />
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
                        Open parcel
                      </Link>
                    ) : null}
                  </>
                )}
              />
            </div>

            <RunDiagnosticsPanel run={run} />
            <ResultExplanationCard explanation={result.explanation ?? null} />

            <SectionCard
              className="index-surface"
              eyebrow="Capital and cost context"
              title="Capital context"
              description="Supporting figures behind equity and break-even."
              size="compact"
            >
              <div className="key-value-grid">
                <div className="key-value-card">
                  <div className="key-value-card__label">Total development cost</div>
                  <div className="key-value-card__value">{result.totalDevelopmentCost ?? "n/a"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">State subsidy</div>
                  <div className="key-value-card__value">{result.stateSubsidyAmount ?? "n/a"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">KfW amount</div>
                  <div className="key-value-card__value">{result.kfwAmount ?? "n/a"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Free financing</div>
                  <div className="key-value-card__value">{result.freeFinancingAmount ?? "n/a"}</div>
                </div>
              </div>
            </SectionCard>
          </>
        ) : (
          <>
            <NextStepPanel
              title={nextAction.title}
              description={nextAction.description}
              size="compact"
              actions={(
                <>
                  <Link className={buttonClasses()} href={builderHref}>
                    Back to builder
                  </Link>
                  {planningHref ? (
                    <Link className={buttonClasses({ variant: "secondary" })} href={planningHref}>
                      Review planning
                    </Link>
                  ) : null}
                </>
              )}
            />

            <RunDiagnosticsPanel run={run} />

            <EmptyState
              eyebrow="No financial result yet"
              title="This run has not produced a result payload"
              description="Use diagnostics above to see whether the run is queued, processing, or blocked."
              actions={(
                <>
                  <Link className={buttonClasses()} href={builderHref}>
                    Back to builder
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                    Scenario list
                  </Link>
                </>
              )}
            />
          </>
        )}
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Result view unavailable"
          description="The result page could not load because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
