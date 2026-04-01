import Link from "next/link";
import { getParcels } from "@/lib/api/parcels";
import { getPlanningParameters } from "@/lib/api/planning";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getFundingPrograms, getScenario, getScenarioReadiness } from "@/lib/api/scenarios";
import {
  assumptionProfileLabels,
  humanizeTokenLabel,
  optimizationTargetLabels,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";
import { getReadinessVerdict } from "@/lib/ui/verdicts";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { FundingStackForm } from "@/components/scenarios/funding-stack-form";
import { ScenarioEditorForm } from "@/components/scenarios/scenario-editor-form";
import { buttonClasses, Button } from "@/components/ui/button";
import { DiagnosticGroup } from "@/components/ui/diagnostic-group";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, getIssueTone, getReadinessTone } from "@/components/ui/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { replaceFundingStackAction, triggerFeasibilityRunAction, updateScenarioAction } from "../../actions";

export default async function ScenarioBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; scenarioId: string }>;
  searchParams?: Promise<{ error?: string; message?: string }>;
}) {
  const { orgSlug, scenarioId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const scenario = await getScenario(orgSlug, scenarioId);
    const [readiness, fundingPrograms, parcels, planningParameters] = await Promise.all([
      getScenarioReadiness(orgSlug, scenarioId),
      getFundingPrograms(orgSlug),
      getParcels(orgSlug),
      scenario.parcelId ? getPlanningParameters(orgSlug, scenario.parcelId) : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 0 }),
    ]);

    const updateAction = updateScenarioAction.bind(null, orgSlug, scenarioId);
    const fundingAction = replaceFundingStackAction.bind(null, orgSlug, scenarioId);
    const runAction = triggerFeasibilityRunAction.bind(null, orgSlug, scenarioId);
    const selectedFundingCount = scenario.fundingVariants.filter((item) => item.isEnabled).length;
    const enabledFundingLabels = scenario.fundingVariants
      .filter((item) => item.isEnabled)
      .map((item) => humanizeTokenLabel(item.financingSourceType));
    const linkedParcel = scenario.parcelId ? parcels.items.find((parcel) => parcel.id === scenario.parcelId) ?? null : null;
    const planningValueCount = planningParameters.items.filter((item) => item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null).length;
    const blockerCount = readiness.issues.filter((issue) => issue.severity === "BLOCKING").length;
    const warningCount = readiness.issues.filter((issue) => issue.severity === "WARNING").length;
    const readinessVerdict = getReadinessVerdict(readiness);
    const validatedLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(readiness.validatedAt));
    const assumptionOverrideCount = Object.values(scenario.assumptionSet?.overrides ?? {}).filter((value) => value !== null).length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario builder"
          title={scenario.name}
          description="Current case, readiness state, key edits, then action."
          meta={(
            <div className="action-row">
              {linkedParcel ? <span className="meta-chip">{linkedParcel.name ?? linkedParcel.cadastralId ?? "Linked parcel"}</span> : <StatusBadge tone="warning">Parcel missing</StatusBadge>}
              <span className="meta-chip">{strategyTypeLabels[scenario.strategyType]}</span>
              <span className="meta-chip">
                {assumptionProfileLabels[scenario.assumptionSet?.profileKey ?? "BASELINE"]}
                {assumptionOverrideCount ? ` + ${assumptionOverrideCount} override${assumptionOverrideCount === 1 ? "" : "s"}` : ""}
              </span>
              <span className="meta-chip">{selectedFundingCount ? `${selectedFundingCount} funding lane(s)` : "No funding lanes"}</span>
              <StatusBadge tone={getReadinessTone(readiness.status)}>{humanizeTokenLabel(readiness.status)}</StatusBadge>
            </div>
          )}
          actions={(
            <>
              {scenario.parcelId ? (
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/${scenario.parcelId}/planning`}>
                  Review planning
                </Link>
              ) : null}
              <Link className={buttonClasses({ variant: "ghost" })} href={`/${orgSlug}/scenarios`}>
                Back to scenarios
              </Link>
            </>
          )}
        />

        {resolvedSearchParams?.error === "invalid-strategy-mix-json" ? (
          <Alert tone="danger">
            <AlertTitle>Invalid mix configuration JSON</AlertTitle>
            <AlertDescription>The temporary mixed-strategy JSON could not be parsed. Please fix it and save the scenario again.</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "save-request-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Scenario save failed</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The API rejected the scenario update. Review the current inputs and try again."}</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "funding-request-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Funding stack update failed</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The API could not save the current funding stack. Review the selected lanes and try again."}</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "run-request-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Feasibility run could not start</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The API could not create a run from the current scenario state. Review readiness, funding, and required assumptions, then try again."}</AlertDescription>
          </Alert>
        ) : null}

        <SectionCard
          className="dashboard-hero dashboard-hero--builder builder-cockpit"
          eyebrow="Operating summary"
          title="Case cockpit"
          description={readinessVerdict.summary}
          tone="accent"
          size="compact"
          actions={<StatusBadge tone={readinessVerdict.tone}>{readinessVerdict.title}</StatusBadge>}
        >
          <div className="content-stack">
            <div className="ops-summary-grid ops-summary-grid--builder">
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Parcel</div>
                <div className="ops-summary-item__value">{linkedParcel?.name ?? linkedParcel?.cadastralId ?? "Not linked"}</div>
                <div className="ops-summary-item__detail">{linkedParcel ? "Site anchor" : "Link parcel to ground the case."}</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Strategy</div>
                <div className="ops-summary-item__value">{strategyTypeLabels[scenario.strategyType]}</div>
                <div className="ops-summary-item__detail">{optimizationTargetLabels[scenario.optimizationTarget]}</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Planning</div>
                <div className="ops-summary-item__value">{planningValueCount ? `${planningValueCount} saved` : "Not started"}</div>
                <div className="ops-summary-item__detail">Parcel planning context carried into the case.</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Funding</div>
                <div className="ops-summary-item__value">{selectedFundingCount ? `${selectedFundingCount} lane(s)` : "No lanes"}</div>
                <div className="ops-summary-item__detail">
                  {enabledFundingLabels.length ? enabledFundingLabels.join(" / ") : "Select stack items before running."}
                </div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Assumptions</div>
                <div className="ops-summary-item__value">
                  {assumptionProfileLabels[scenario.assumptionSet?.profileKey ?? "BASELINE"]}
                </div>
                <div className="ops-summary-item__detail">
                  {assumptionOverrideCount ? `${assumptionOverrideCount} case-specific override(s)` : "Profile defaults only"}
                </div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Readiness</div>
                <div className="ops-summary-item__value">{humanizeTokenLabel(readiness.status)}</div>
                <div className="ops-summary-item__detail">{blockerCount ? `${blockerCount} blocker(s)` : `${warningCount} warning(s)`} | Checked {validatedLabel}</div>
              </div>
            </div>

            <div className="builder-cockpit__bar">
              <div className="builder-cockpit__signals">
                <StatusBadge tone={getReadinessTone(readiness.status)}>{humanizeTokenLabel(readiness.status)}</StatusBadge>
                <StatusBadge tone={blockerCount ? "danger" : "success"}>
                  {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
                </StatusBadge>
                <StatusBadge tone={warningCount ? "warning" : "success"}>
                  {warningCount} warning{warningCount === 1 ? "" : "s"}
                </StatusBadge>
              </div>

              <div className="builder-cockpit__actions">
                {scenario.parcelId ? (
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/${scenario.parcelId}/planning`}>
                    Review planning
                  </Link>
                ) : null}
                <form action={runAction}>
                  <Button type="submit" size="lg" disabled={!readiness.canRun}>Run feasibility</Button>
                </form>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="dashboard-grid dashboard-grid--builder">
          <ScenarioEditorForm
            action={updateAction}
            parcels={parcels.items}
            initialScenario={scenario}
            submitLabel="Save scenario"
            mode="builder"
          />

          <div className="sidebar-stack cockpit-rail">
            <FundingStackForm
              action={fundingAction}
              fundingPrograms={fundingPrograms.items}
              selectedItems={scenario.fundingVariants}
            />

            <SectionCard
              className="rail-panel"
              eyebrow="Readiness details"
              title="Current issues"
              tone={readiness.canRun ? "muted" : "default"}
              size="compact"
            >
              <div className="content-stack">
                <div className="action-row">
                  <StatusBadge tone={blockerCount ? "danger" : "success"}>
                    {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
                  </StatusBadge>
                  <StatusBadge tone={warningCount ? "warning" : "success"}>
                    {warningCount} warning{warningCount === 1 ? "" : "s"}
                  </StatusBadge>
                </div>
                <DiagnosticGroup title="Readiness scan" emptyLabel="No readiness issues. The scenario is ready to run.">
                  {readiness.issues.length ? (
                    <div className="signal-list">
                      {readiness.issues.map((issue) => (
                        <div key={`${issue.code}-${issue.field ?? "global"}`} className="signal-row">
                          <div className="signal-row__badges">
                            <StatusBadge tone={getIssueTone(issue.severity)}>{issue.severity}</StatusBadge>
                            <StatusBadge tone="surface">{humanizeTokenLabel(issue.code)}</StatusBadge>
                            {issue.field ? <StatusBadge tone="info">{issue.field}</StatusBadge> : null}
                          </div>
                          <div className="signal-row__text">{issue.message}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </DiagnosticGroup>
              </div>
            </SectionCard>

            <NextStepPanel
              className="rail-panel rail-panel--action"
              title={readiness.canRun ? "Ready to run" : "Resolve blockers first"}
              description={readiness.canRun
                ? "Directional enough to run. Review funding and planning once, then launch."
                : "Clear the listed blockers before treating the case as run-ready."}
              tone={readiness.canRun ? "accent" : "muted"}
              size="compact"
              actions={(
                <>
                  {scenario.parcelId ? (
                    <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/${scenario.parcelId}`}>
                      Open parcel
                    </Link>
                  ) : null}
                  {scenario.parcelId ? (
                    <Link className={buttonClasses({ variant: "ghost" })} href={`/${orgSlug}/parcels/${scenario.parcelId}/planning`}>
                      Planning inputs
                    </Link>
                  ) : null}
                </>
              )}
            />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Scenario builder unavailable"
          description="The builder could not load because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
