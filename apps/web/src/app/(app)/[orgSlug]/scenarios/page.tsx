import Link from "next/link";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusBadge, getScenarioStatusTone } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getScenarios } from "@/lib/api/scenarios";
import {
  humanizeTokenLabel,
  optimizationTargetLabels,
  scenarioStatusLabels,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";

function formatScenarioSignal(value: string | null) {
  if (!value) return "No run";

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

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
          description="Scan active decision cases by parcel, strategy, status, and run history."
          actions={(
            <Link className={buttonClasses({ size: "lg" })} href={`/${orgSlug}/scenarios/new`}>
              New scenario
            </Link>
          )}
        />

        <div className="stat-grid">
          <StatBlock label="Total scenarios" value={scenarios.total} caption="Current decision cases" tone="accent" />
          <StatBlock label="Linked parcels" value={withLinkedParcel} caption="Grounded in a site" />
          <StatBlock label="Run history" value={withRunHistory} caption="Cases with recorded runs" tone="success" />
          <StatBlock label="Active cases" value={activeCases} caption="Ready, running, or done" />
        </div>

        <SectionCard
          eyebrow="Decision workspace"
          title="Scenario index"
          description="Open the right case quickly by parcel, strategy, status, and run signal."
        >
          {scenarios.items.length ? (
            <div className="ops-table">
              <div className="ops-table__header ops-table__header--scenarios">
                <div>Scenario</div>
                <div>Operational scan</div>
                <div>Action</div>
              </div>
              {scenarios.items.map((scenario) => {
                const linkedParcel = scenario.parcelId ? parcelById.get(scenario.parcelId) : null;
                const selectedFundingCount = scenario.fundingVariants.filter((item) => item.isEnabled).length;

                return (
                  <div key={scenario.id} className="ops-table__row ops-table__row--scenarios">
                    <div className="ops-table__cell">
                      <div className="list-row__body">
                        <div className="list-row__title">
                          <span className="list-row__title-text">{scenario.name}</span>
                          <StatusBadge tone={getScenarioStatusTone(scenario.status)}>
                            {scenarioStatusLabels[scenario.status]}
                          </StatusBadge>
                          {scenario.latestRunAt ? <StatusBadge tone="success">Has run</StatusBadge> : null}
                          {scenario.parcelId ? <StatusBadge tone="accent">Parcel linked</StatusBadge> : <StatusBadge tone="warning">Parcel missing</StatusBadge>}
                        </div>

                        {scenario.description ? <div className="list-row__meta">{scenario.description}</div> : null}

                        <div className="inline-meta">
                          <span className="meta-chip">{optimizationTargetLabels[scenario.optimizationTarget]}</span>
                          <span className="meta-chip">{humanizeTokenLabel(scenario.status)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="ops-table__cell">
                      <div className="ops-summary-grid ops-summary-grid--scenario">
                        <div className="ops-summary-item">
                          <div className="ops-summary-item__label">Parcel</div>
                          <div className="ops-summary-item__value">
                            {linkedParcel?.name ?? linkedParcel?.cadastralId ?? (scenario.parcelId ? "Linked parcel" : "Unlinked")}
                          </div>
                        </div>
                        <div className="ops-summary-item">
                          <div className="ops-summary-item__label">Strategy</div>
                          <div className="ops-summary-item__value">{strategyTypeLabels[scenario.strategyType]}</div>
                        </div>
                        <div className="ops-summary-item">
                          <div className="ops-summary-item__label">Funding</div>
                          <div className="ops-summary-item__value">{selectedFundingCount} lane(s) enabled</div>
                        </div>
                        <div className="ops-summary-item">
                          <div className="ops-summary-item__label">Latest run</div>
                          <div className="ops-summary-item__value">{formatScenarioSignal(scenario.latestRunAt)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="ops-table__actions">
                      <div className="list-row__title">
                        <StatusBadge tone={getScenarioStatusTone(scenario.status)}>
                          {scenarioStatusLabels[scenario.status]}
                        </StatusBadge>
                      </div>
                      {scenario.parcelId ? (
                        <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={`/${orgSlug}/parcels/${scenario.parcelId}`}>
                          Parcel
                        </Link>
                      ) : null}
                      <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/scenarios/${scenario.id}/builder`}>
                        Builder
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
              description="Start with a parcel-linked case so the run flow stays grounded in a real site."
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
