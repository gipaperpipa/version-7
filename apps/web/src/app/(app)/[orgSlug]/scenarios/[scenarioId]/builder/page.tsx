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
import { StatBlock } from "@/components/ui/stat-block";
import { StatusBadge, getIssueTone, getReadinessTone } from "@/components/ui/status-badge";
import { WorkflowSteps } from "@/components/ui/workflow-steps";
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
    const linkedParcel = scenario.parcelId ? parcels.items.find((parcel) => parcel.id === scenario.parcelId) ?? null : null;
    const planningValueCount = planningParameters.items.filter((item) => item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null).length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario builder"
          title={scenario.name}
          description="Use the builder as a decision workspace: refine assumptions, replace the funding stack, review readiness, then run heuristic feasibility."
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
          meta={(
            <WorkflowSteps
              activeStep={4}
              steps={[
                { label: "Parcel", description: "Linked site context" },
                { label: "Planning", description: "Narrow readiness inputs" },
                { label: "Scenario", description: "Strategy and commercial assumptions" },
                { label: "Readiness and run", description: "Funding, blockers, and run trigger" },
                { label: "Result", description: "Decision-support output" },
              ]}
            />
          )}
        />

        {resolvedSearchParams?.error === "invalid-strategy-mix-json" ? (
          <Alert tone="danger">
            <AlertTitle>Invalid mix configuration JSON</AlertTitle>
            <AlertDescription>The temporary mixed-strategy JSON could not be parsed. Please fix it and save the scenario again.</AlertDescription>
          </Alert>
        ) : null}

        <div className="stat-grid">
          <StatBlock label="Linked parcel" value={linkedParcel?.name ?? linkedParcel?.cadastralId ?? "Not linked"} caption={linkedParcel ? "Scenario stays anchored in a real site" : "Link a parcel to keep the case grounded"} tone="accent" />
          <StatBlock label="Planning context" value={planningValueCount} caption="Saved parcel planning values carried into this case" />
          <StatBlock label="Funding lanes" value={selectedFundingCount} caption="Enabled capital sources in the temporary Sprint 1 stack" />
          <StatBlock label="Readiness status" value={humanizeTokenLabel(readiness.status)} caption={`${readiness.issues.length} issue(s) currently shape this case`} tone={getReadinessTone(readiness.status) === "success" ? "success" : getReadinessTone(readiness.status) === "danger" ? "danger" : "warning"} />
        </div>

        <ScenarioReadinessBanner readiness={readiness} />

        <div className="dashboard-grid">
          <ScenarioEditorForm
            action={updateAction}
            parcels={parcels.items}
            initialScenario={scenario}
            submitLabel="Save scenario"
          />

          <div className="sidebar-stack">
            <SectionCard
              eyebrow="Context"
              title="Decision frame"
              description="Keep the builder anchored to parcel context, planning coverage, and the current commercial lens."
            >
              <div className="key-value-grid">
                <div className="key-value-card">
                  <div className="key-value-card__label">Parcel</div>
                  <div className="key-value-card__value">{linkedParcel?.name ?? linkedParcel?.cadastralId ?? "Not linked"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Strategy</div>
                  <div className="key-value-card__value">{strategyTypeLabels[scenario.strategyType]}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Optimization</div>
                  <div className="key-value-card__value">{optimizationTargetLabels[scenario.optimizationTarget]}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Planning status</div>
                  <div className="key-value-card__value">{planningValueCount ? `${planningValueCount} saved input(s)` : "Not started"}</div>
                </div>
              </div>
            </SectionCard>

            <FundingStackForm
              action={fundingAction}
              fundingPrograms={fundingPrograms.items}
              selectedItems={scenario.fundingVariants}
            />

            <SectionCard
              eyebrow="Readiness details"
              title="What still needs attention"
              description="Use the issue list to understand exactly what blocks or weakens the case before running."
              tone={readiness.canRun ? "muted" : "default"}
            >
              <div className="content-stack">
                <DiagnosticGroup title="Current issues" emptyLabel="No readiness issues. The scenario is ready to run.">
                  {readiness.issues.map((issue) => (
                    <div key={`${issue.code}-${issue.field ?? "global"}`} className="insight-item">
                      <div className="action-row">
                        <StatusBadge tone={getIssueTone(issue.severity)}>{issue.severity}</StatusBadge>
                        <StatusBadge tone="surface">{humanizeTokenLabel(issue.code)}</StatusBadge>
                      </div>
                      <div className="field-help" style={{ marginTop: 8 }}>{issue.message}</div>
                    </div>
                  ))}
                </DiagnosticGroup>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Run"
              title="Trigger heuristic feasibility"
              description="The engine remains explicitly heuristic and replaceable, but the workflow should still feel production-grade."
            >
              <div className="content-stack">
                <div className="field-help">
                  Run once the parcel, planning, strategy, and funding signals are coherent enough for a directional decision.
                </div>
                <form action={runAction}>
                  <Button type="submit" size="lg" disabled={!readiness.canRun}>Run feasibility</Button>
                </form>
              </div>
            </SectionCard>

            <NextStepPanel
              title={readiness.canRun ? "Run the case when the assumptions feel coherent" : "Resolve blockers before you run"}
              description={readiness.canRun
                ? "The current case is ready for a directional heuristic output. Review funding and linked parcel context one last time, then launch the run."
                : "Use the readiness list and linked parcel planning page to resolve blockers before treating the scenario as decision-ready."}
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
