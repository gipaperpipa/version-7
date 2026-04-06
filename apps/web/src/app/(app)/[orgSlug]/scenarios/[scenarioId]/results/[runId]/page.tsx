import Link from "next/link";
import { isApiUnavailableError } from "@/lib/api/errors";
import { isApiResponseError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getScenario, getScenarioRun, getScenarios } from "@/lib/api/scenarios";
import { buildScenarioFamilySummaries, getSuggestedLeadReasonLabel } from "@/lib/scenarios/family-governance";
import { assumptionProfileLabels, humanizeTokenLabel } from "@/lib/ui/enum-labels";
import { getRunVerdict } from "@/lib/ui/verdicts";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ResultAnalysisPanels } from "@/components/analysis/result-analysis-panels";
import { ResultExplanationCard } from "@/components/scenarios/result-explanation-card";
import { RunDiagnosticsPanel } from "@/components/scenarios/run-diagnostics-panel";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusBadge, getRunStatusTone, getScenarioGovernanceTone } from "@/components/ui/status-badge";
import { VerdictPanel } from "@/components/ui/verdict-panel";
import {
  archiveScenarioVariantsAction,
  resolveScenarioFamilyAction,
  setScenarioCurrentBestAction,
} from "@/app/(app)/[orgSlug]/scenarios/actions";

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
    const [run, scenario, scenarios, parcels] = await Promise.all([
      getScenarioRun(orgSlug, runId),
      getScenario(orgSlug, scenarioId),
      getScenarios(orgSlug),
      getParcels(orgSlug),
    ]);

    const result = run.financialResult;
    const verdict = getRunVerdict(run);
    const builderHref = `/${orgSlug}/scenarios/${scenarioId}/builder`;
    const reportHref = `/${orgSlug}/scenarios/${scenarioId}/results/${runId}/report`;
    const parcelHref = scenario.parcelId ? `/${orgSlug}/parcels/${scenario.parcelId}` : null;
    const planningHref = scenario.parcelId ? `/${orgSlug}/parcels/${scenario.parcelId}/planning` : null;
    const nextAction = getNextActionCopy(runId, scenarioId, verdict.title, Boolean(planningHref));
    const parcelById = new Map(parcels.items.map((parcel) => [parcel.id, parcel]));
    const familySummaries = buildScenarioFamilySummaries(scenarios.items, parcelById);
    const family = familySummaries.find((item) => item.familyKey === scenario.familyKey) ?? null;
    const unresolvedFamily = result && family && family.healthStatus !== "HEALTHY" ? family : null;
    const familySearch = new URLSearchParams();
    if (scenario.parcelId) familySearch.set("siteId", scenario.parcelId);
    familySearch.set("strategy", scenario.strategyType);
    familySearch.set("variantView", "ALL");
    const familyBoardHref = `/${orgSlug}/scenarios?${familySearch.toString()}`;

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
              {result ? (
                <Link className={buttonClasses()} href={reportHref}>
                  Open report
                </Link>
              ) : null}
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
            {unresolvedFamily ? (
              <Alert tone={unresolvedFamily.healthTone === "danger" ? "danger" : "warning"}>
                <AlertTitle>Family governance still needs resolution</AlertTitle>
                <AlertDescription>
                  This run completed, but the family is still unhealthy: {unresolvedFamily.healthDetail}
                </AlertDescription>
              </Alert>
            ) : null}

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
                  <StatBlock
                    label={result.netSalesRevenue ? "Net sales revenue" : "NOI annual"}
                    value={result.netSalesRevenue ?? result.netOperatingIncomeAnnual ?? "n/a"}
                    caption={result.netSalesRevenue ? "Sale-side proceeds after closing costs" : "Operating signal after vacancy and opex"}
                  />
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

            {unresolvedFamily ? (
              <SectionCard
                className="index-surface"
                eyebrow="Family resolution"
                title="Use this run to tighten the family working set"
                description="This prompt turns the finished run into a governance decision instead of leaving the family as another loose active variant."
                size="compact"
              >
                <div className="content-stack">
                  <div className="key-value-grid">
                    <div className="key-value-card">
                      <div className="key-value-card__label">Family health</div>
                      <div className="key-value-card__value">{unresolvedFamily.healthLabel}</div>
                    </div>
                    <div className="key-value-card">
                      <div className="key-value-card__label">Suggested lead</div>
                      <div className="key-value-card__value">{unresolvedFamily.suggestedLeadScenario.name}</div>
                    </div>
                    <div className="key-value-card">
                      <div className="key-value-card__label">Suggestion basis</div>
                      <div className="key-value-card__value">{getSuggestedLeadReasonLabel(unresolvedFamily.suggestedLeadReason)}</div>
                    </div>
                    <div className="key-value-card">
                      <div className="key-value-card__label">Active clutter</div>
                      <div className="key-value-card__value">
                        {unresolvedFamily.activeCandidateCount} active / {unresolvedFamily.olderActiveVariantIds.length} non-lead active
                      </div>
                    </div>
                  </div>

                  <div className="signal-list">
                    <div className="signal-row">
                      <div className="signal-row__badges">
                        <StatusBadge tone={unresolvedFamily.healthTone}>{unresolvedFamily.healthLabel}</StatusBadge>
                        {!unresolvedFamily.explicitLeadExists ? <StatusBadge tone="warning">No current lead</StatusBadge> : null}
                      </div>
                      <div className="signal-row__text">{unresolvedFamily.healthDetail}</div>
                    </div>
                    <div className="signal-row">
                      <div className="signal-row__badges">
                        <StatusBadge tone="accent">Suggested lead</StatusBadge>
                        <StatusBadge tone={getScenarioGovernanceTone(unresolvedFamily.suggestedLeadScenario.governanceStatus)}>
                          {humanizeTokenLabel(unresolvedFamily.suggestedLeadScenario.governanceStatus)}
                        </StatusBadge>
                      </div>
                      <div className="signal-row__text">
                        {unresolvedFamily.suggestedLeadScenario.name} / {getSuggestedLeadReasonLabel(unresolvedFamily.suggestedLeadReason)}
                      </div>
                    </div>
                  </div>

                  <div className="action-row">
                    <Link className={buttonClasses()} href={familyBoardHref}>
                      Open family board
                    </Link>
                    {!scenario.isCurrentBest ? (
                      <form action={setScenarioCurrentBestAction.bind(null, orgSlug, scenario.id, familyBoardHref)}>
                        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
                          Make this scenario lead
                        </button>
                      </form>
                    ) : null}
                    {!unresolvedFamily.suggestedLeadScenario.isCurrentBest ? (
                      <form action={setScenarioCurrentBestAction.bind(null, orgSlug, unresolvedFamily.suggestedLeadScenario.id, familyBoardHref)}>
                        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
                          Adopt suggested lead
                        </button>
                      </form>
                    ) : null}
                    {unresolvedFamily.olderActiveVariantIds.length ? (
                      <form action={archiveScenarioVariantsAction.bind(null, orgSlug, familyBoardHref)}>
                        {unresolvedFamily.olderActiveVariantIds.map((candidateId) => (
                          <input key={candidateId} type="hidden" name="scenarioId" value={candidateId} />
                        ))}
                        <button type="submit" className={buttonClasses({ variant: "ghost" })}>
                          Archive non-lead actives
                        </button>
                      </form>
                    ) : null}
                    {unresolvedFamily.resolutionArchiveVariantIds.length ? (
                      <form action={resolveScenarioFamilyAction.bind(null, orgSlug, familyBoardHref)}>
                        <input type="hidden" name="leadScenarioId" value={unresolvedFamily.suggestedLeadScenario.id} />
                        {unresolvedFamily.resolutionArchiveVariantIds.map((candidateId) => (
                          <input key={candidateId} type="hidden" name="archiveScenarioId" value={candidateId} />
                        ))}
                        <button type="submit" className={buttonClasses({ variant: "secondary" })}>
                          Resolve family with suggestion
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </SectionCard>
            ) : null}

            <ResultAnalysisPanels run={run} result={result} />
            <RunDiagnosticsPanel run={run} />
            <ResultExplanationCard explanation={result.explanation ?? null} />

            <SectionCard
              className="index-surface"
              eyebrow="Capital and assumption context"
              title="Capital context"
              description="Supporting figures behind equity, break-even, and realism posture."
              size="compact"
            >
              <div className="key-value-grid">
                <div className="key-value-card">
                  <div className="key-value-card__label">Total development cost</div>
                  <div className="key-value-card__value">{result.totalDevelopmentCost ?? "n/a"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Capitalized uses</div>
                  <div className="key-value-card__value">{result.totalCapitalizedUses ?? "n/a"}</div>
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
                <div className="key-value-card">
                  <div className="key-value-card__label">Contingency</div>
                  <div className="key-value-card__value">{result.contingencyCost ?? "n/a"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Developer fee</div>
                  <div className="key-value-card__value">{result.developerFee ?? "n/a"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Assumption profile</div>
                  <div className="key-value-card__value">
                    {result.assumptions ? assumptionProfileLabels[result.assumptions.profileKey] : "Baseline"}
                  </div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Planning-adjusted BGF</div>
                  <div className="key-value-card__value">{result.planningAdjustedBgfSqm ?? "n/a"}</div>
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

    if (isApiResponseError(error)) {
      return (
        <div className="workspace-page content-stack">
          <EmptyState
            eyebrow="Result unavailable"
            title="This run result could not be loaded"
            description={error.message || "The API returned an error while loading the result. Return to the builder, then try the run again or review the scenario state."}
            actions={(
              <>
                <Link className={buttonClasses()} href={`/${orgSlug}/scenarios/${scenarioId}/builder`}>
                  Back to builder
                </Link>
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                  Scenario list
                </Link>
              </>
            )}
          />
        </div>
      );
    }

    throw error;
  }
}
