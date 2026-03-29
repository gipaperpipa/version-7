import Link from "next/link";
import { getParcels } from "@/lib/api/parcels";
import { getPlanningParameters } from "@/lib/api/planning";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getFundingPrograms, getScenario, getScenarioReadiness } from "@/lib/api/scenarios";
import { humanizeTokenLabel, optimizationTargetLabels, strategyTypeLabels } from "@/lib/ui/enum-labels";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { FundingStackForm } from "@/components/scenarios/funding-stack-form";
import { ScenarioEditorForm } from "@/components/scenarios/scenario-editor-form";
import { ScenarioReadinessBanner } from "@/components/scenarios/scenario-readiness-banner";
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
  searchParams?: Promise<{ error?: string }>;
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

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario builder"
          title={scenario.name}
          description="Read state fast, change what matters, then act."
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

        <SectionCard
          eyebrow="Operating summary"
          title="Current case"
          description="Context, funding, readiness, action."
          tone="accent"
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
                <div className="ops-summary-item__label">Readiness</div>
                <div className="ops-summary-item__value">{humanizeTokenLabel(readiness.status)}</div>
                <div className="ops-summary-item__detail">
                  {blockerCount ? `${blockerCount} blocker(s)` : `${warningCount} warning(s)`}
                </div>
              </div>
            </div>

            <div className="action-row action-row--spread">
              <div className="action-row">
                <StatusBadge tone={getReadinessTone(readiness.status)}>{humanizeTokenLabel(readiness.status)}</StatusBadge>
                <StatusBadge tone={blockerCount ? "danger" : "success"}>
                  {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
                </StatusBadge>
                <StatusBadge tone={warningCount ? "warning" : "success"}>
                  {warningCount} warning{warningCount === 1 ? "" : "s"}
                </StatusBadge>
              </div>

              <div className="action-row">
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

        <ScenarioReadinessBanner readiness={readiness} />

        <div className="dashboard-grid">
          <ScenarioEditorForm
            action={updateAction}
            parcels={parcels.items}
            initialScenario={scenario}
            submitLabel="Save scenario"
          />

          <div className="sidebar-stack cockpit-rail">
            <FundingStackForm
              action={fundingAction}
              fundingPrograms={fundingPrograms.items}
              selectedItems={scenario.fundingVariants}
            />

            <SectionCard
              eyebrow="Readiness details"
              title="Readiness issues"
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
                <DiagnosticGroup title="Current issues" emptyLabel="No readiness issues. The scenario is ready to run.">
                  {readiness.issues.map((issue) => (
                    <div key={`${issue.code}-${issue.field ?? "global"}`} className="insight-item">
                      <div className="action-row">
                        <StatusBadge tone={getIssueTone(issue.severity)}>{issue.severity}</StatusBadge>
                        <StatusBadge tone="surface">{humanizeTokenLabel(issue.code)}</StatusBadge>
                        {issue.field ? <StatusBadge tone="info">{issue.field}</StatusBadge> : null}
                      </div>
                      <div className="field-help" style={{ marginTop: 8 }}>{issue.message}</div>
                    </div>
                  ))}
                </DiagnosticGroup>
              </div>
            </SectionCard>

            <NextStepPanel
              title={readiness.canRun ? "Ready to run" : "Resolve blockers first"}
              description={readiness.canRun
                ? "The case is coherent enough for a directional run. Review the funding and parcel context once, then launch."
                : "Use the issue list and planning page to clear blockers before treating the case as run-ready."}
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
