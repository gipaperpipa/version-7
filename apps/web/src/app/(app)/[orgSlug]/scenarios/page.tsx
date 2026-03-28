import Link from "next/link";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusBadge, getScenarioStatusTone } from "@/components/ui/status-badge";
import { WorkflowSteps } from "@/components/ui/workflow-steps";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getScenarios } from "@/lib/api/scenarios";
import {
  humanizeTokenLabel,
  optimizationTargetLabels,
  scenarioStatusLabels,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";

export default async function ScenariosPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  try {
    const [scenarios, parcels] = await Promise.all([getScenarios(orgSlug), getParcels(orgSlug)]);
    const parcelById = new Map(parcels.items.map((parcel) => [parcel.id, parcel]));
    const withLinkedParcel = scenarios.items.filter((scenario) => scenario.parcelId).length;
    const withRunHistory = scenarios.items.filter((scenario) => scenario.latestRunAt).length;
    const activeCases = scenarios.items.filter((scenario) => ["READY", "RUNNING", "COMPLETED"].includes(scenario.status)).length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Workspace / Scenarios"
          title="Scenario studio"
          description="Use scenarios as structured decision cases that connect parcel context, planning interpretation, funding selection, readiness, and heuristic output."
          actions={(
            <Link className={buttonClasses({ size: "lg" })} href={`/${orgSlug}/scenarios/new`}>
              New scenario
            </Link>
          )}
          meta={(
            <WorkflowSteps
              activeStep={3}
              steps={[
                { label: "Parcel", description: "Anchor the case in a real site." },
                { label: "Planning", description: "Carry forward buildability interpretation." },
                { label: "Scenario", description: "Frame the commercial decision case." },
                { label: "Readiness and run", description: "Resolve blockers, then launch the heuristic engine." },
              ]}
            />
          )}
        />

        <div className="stat-grid">
          <StatBlock label="Total scenarios" value={scenarios.total} caption="Current decision cases" tone="accent" />
          <StatBlock label="Linked parcels" value={withLinkedParcel} caption="Cases already grounded in a site" />
          <StatBlock label="Run history" value={withRunHistory} caption="Cases that have already produced or attempted a result" tone="success" />
          <StatBlock label="Active cases" value={activeCases} caption="Ready, running, or completed scenarios" />
        </div>

        <SectionCard
          eyebrow="Decision workspace"
          title="Scenario list"
          description="Each case should read as a live decision workspace with clear parcel context, current status, and the next place to work."
        >
          {scenarios.items.length ? (
            <div className="list-shell">
              {scenarios.items.map((scenario) => {
                const linkedParcel = scenario.parcelId ? parcelById.get(scenario.parcelId) : null;
                const selectedFundingCount = scenario.fundingVariants.filter((item) => item.isEnabled).length;

                return (
                  <div key={scenario.id} className="list-row list-row--dense">
                    <div className="list-row__body">
                      <div className="list-row__title">
                        <span className="list-row__title-text">{scenario.name}</span>
                        <StatusBadge tone={getScenarioStatusTone(scenario.status)}>
                          {scenarioStatusLabels[scenario.status]}
                        </StatusBadge>
                        {scenario.latestRunAt ? <StatusBadge tone="success">Run history</StatusBadge> : null}
                        {scenario.parcelId ? <StatusBadge tone="accent">Parcel linked</StatusBadge> : <StatusBadge tone="warning">Parcel missing</StatusBadge>}
                      </div>

                      <div className="list-row__description">
                        {[
                          strategyTypeLabels[scenario.strategyType],
                          optimizationTargetLabels[scenario.optimizationTarget],
                          linkedParcel?.name ?? linkedParcel?.cadastralId ?? (scenario.parcelId ? "Linked parcel" : "Parcel not linked"),
                        ].join(" / ")}
                      </div>

                      <div className="list-row__meta">
                        {scenario.description ?? "No scenario description saved yet. Use the builder to turn this into a clearer decision case."}
                      </div>

                      <div className="inline-meta">
                        <span className="meta-chip">{selectedFundingCount} funding lane(s)</span>
                        <span className="meta-chip">
                          {scenario.latestRunAt ? "Latest run recorded" : "No run yet"}
                        </span>
                        <span className="meta-chip">{humanizeTokenLabel(scenario.status)}</span>
                      </div>
                    </div>

                    <div className="action-row">
                      {scenario.parcelId ? (
                        <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={`/${orgSlug}/parcels/${scenario.parcelId}`}>
                          Open parcel
                        </Link>
                      ) : null}
                      <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/scenarios/${scenario.id}/builder`}>
                        Open builder
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              eyebrow="No scenarios yet"
              title="Create the first decision case"
              description="Scenarios turn parcel and planning context into a real feasibility question. Start with a parcel-linked case so the run flow stays grounded in a site."
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/scenarios/new`}>
                    Create scenario
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels`}>
                    Review parcels
                  </Link>
                </>
              )}
            />
          )}
        </SectionCard>
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Scenarios unavailable"
          description="Scenario data could not be loaded because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
