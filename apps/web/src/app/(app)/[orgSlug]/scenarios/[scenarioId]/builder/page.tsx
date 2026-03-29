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
    const blockerCount = readiness.issues.filter((issue) => issue.severity === "BLOCKING").length;
    const warningCount = readiness.issues.filter((issue) => issue.severity === "WARNING").length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario builder"
          title={scenario.name}
          description="Configure the case, assess readiness, and act."
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

        <div className="stat-grid">
          <StatBlock label="Linked parcel" value={linkedParcel?.name ?? linkedParcel?.cadastralId ?? "Not linked"} caption={linkedParcel ? "Site anchor" : "Link parcel"} tone="accent" />
          <StatBlock label="Planning context" value={planningValueCount} caption={planningValueCount ? "Inputs carried in" : "No planning values yet"} />
          <StatBlock label="Funding lanes" value={selectedFundingCount} caption={selectedFundingCount ? "Enabled now" : "No lanes selected"} />
          <StatBlock
            label="Readiness"
            value={humanizeTokenLabel(readiness.status)}
            caption={blockerCount ? `${blockerCount} blocker(s)` : `${warningCount} warning(s)`}
            tone={getReadinessTone(readiness.status) === "success" ? "success" : getReadinessTone(readiness.status) === "danger" ? "danger" : "warning"}
          />
        </div>

        <ScenarioReadinessBanner readiness={readiness} />

        <div className="dashboard-grid">
          <ScenarioEditorForm
            action={updateAction}
            parcels={parcels.items}
            initialScenario={scenario}
            submitLabel="Save scenario"
          />

          <div className="sidebar-stack cockpit-rail">
            <SectionCard
              eyebrow="Snapshot"
              title="Case snapshot"
              size="compact"
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

            <SectionCard
              eyebrow="Run"
              title="Run"
              description="Launch once parcel, planning, strategy, and funding are coherent."
              size="compact"
            >
              <div className="content-stack">
                <form action={runAction}>
                  <Button type="submit" size="lg" disabled={!readiness.canRun}>Run feasibility</Button>
                </form>
              </div>
            </SectionCard>

            <NextStepPanel
              title={readiness.canRun ? "Ready to run" : "Resolve blockers first"}
              description={readiness.canRun
                ? "The case is coherent enough for a directional run. Review the funding and parcel context once, then launch."
                : "Use the issue list and planning page to clear blockers before treating the case as run-ready."}
              tone={readiness.canRun ? "accent" : "muted"}
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
