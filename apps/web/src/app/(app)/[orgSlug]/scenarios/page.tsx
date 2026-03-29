import Link from "next/link";
import { ScenarioStatus, type ScenarioDto } from "@repo/contracts";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, getScenarioStatusTone } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getScenarios } from "@/lib/api/scenarios";
import {
  humanizeTokenLabel,
  optimizationTargetLabels,
  strategyTypeLabels,
} from "@/lib/ui/enum-labels";

function formatScenarioSignal(value: string | null) {
  if (!value) return "No run";

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function getScenarioNextAction(scenario: ScenarioDto) {
  if (!scenario.parcelId) {
    return { label: "Link parcel", detail: "Add a site anchor before treating the case as decision-ready.", tone: "warning" as const };
  }

  if (scenario.status === ScenarioStatus.READY) {
    return { label: "Run", detail: "Open builder and launch the next directional pass.", tone: "accent" as const };
  }

  if (scenario.status === ScenarioStatus.RUNNING) {
    return { label: "Monitor", detail: "A run is active. Re-open the builder once it clears.", tone: "info" as const };
  }

  if (scenario.status === ScenarioStatus.COMPLETED && scenario.latestRunAt) {
    return { label: "Review output", detail: "Open the builder and continue from the latest run context.", tone: "success" as const };
  }

  if (scenario.status === ScenarioStatus.FAILED) {
    return { label: "Fix and rerun", detail: "Return to the builder and correct the failing input path.", tone: "danger" as const };
  }

  if (scenario.status === ScenarioStatus.ARCHIVED) {
    return { label: "Archive", detail: "Keep for reference unless the case needs to be revived.", tone: "surface" as const };
  }

  return { label: "Continue setup", detail: "Finish framing the case, then move into funding and readiness.", tone: "neutral" as const };
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
          description="Compare cases by parcel, strategy, readiness signal, and latest activity."
          actions={(
            <Link className={buttonClasses({ size: "lg" })} href={`/${orgSlug}/scenarios/new`}>
              New scenario
            </Link>
          )}
        />

        <SectionCard
          eyebrow="Operating summary"
          title="Studio scan"
          description="Use this surface to decide what to open next."
          tone="accent"
          size="compact"
        >
          <div className="ops-summary-grid ops-summary-grid--planning">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Cases</div>
              <div className="ops-summary-item__value">{scenarios.total}</div>
              <div className="ops-summary-item__detail">Current scenario workspace.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Parcel-linked</div>
              <div className="ops-summary-item__value">{withLinkedParcel}</div>
              <div className="ops-summary-item__detail">Grounded in a site context.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Run history</div>
              <div className="ops-summary-item__value">{withRunHistory}</div>
              <div className="ops-summary-item__detail">Cases with recorded output.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Active</div>
              <div className="ops-summary-item__value">{activeCases}</div>
              <div className="ops-summary-item__detail">Ready, running, or completed.</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Decision workspace"
          title="Scenario index"
          description="Open the right case quickly by parcel, strategy, status, and latest signal."
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
                const nextAction = getScenarioNextAction(scenario);

                return (
                  <div key={scenario.id} className="ops-table__row ops-table__row--scenarios">
                    <div className="ops-table__cell">
                      <div className="list-row__body">
                        <div className="list-row__title">
                          <span className="list-row__title-text">{scenario.name}</span>
                          <StatusBadge tone={getScenarioStatusTone(scenario.status)}>
                            {humanizeTokenLabel(scenario.status)}
                          </StatusBadge>
                          {scenario.latestRunAt ? <StatusBadge tone="success">Has run</StatusBadge> : null}
                          {scenario.parcelId ? <StatusBadge tone="accent">Parcel linked</StatusBadge> : <StatusBadge tone="warning">Parcel missing</StatusBadge>}
                        </div>

                        {scenario.description ? <div className="list-row__meta list-row__meta--clamped">{scenario.description}</div> : null}

                        <div className="inline-meta">
                          <span className="meta-chip">{optimizationTargetLabels[scenario.optimizationTarget]}</span>
                          <span className="meta-chip">{formatScenarioSignal(scenario.updatedAt)} update</span>
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
                          <div className="ops-summary-item__label">Activity</div>
                          <div className="ops-summary-item__value">
                            {scenario.latestRunAt ? `Ran ${formatScenarioSignal(scenario.latestRunAt)}` : `Updated ${formatScenarioSignal(scenario.updatedAt)}`}
                          </div>
                        </div>
                        <div className="ops-summary-item">
                          <div className="ops-summary-item__label">Next</div>
                          <div className="ops-summary-item__value">{nextAction.label}</div>
                          <div className="ops-summary-item__detail">{nextAction.detail}</div>
                        </div>
                      </div>
                    </div>

                    <div className="ops-table__actions">
                      <div className="action-row">
                        <StatusBadge tone={getScenarioStatusTone(scenario.status)}>
                          {humanizeTokenLabel(scenario.status)}
                        </StatusBadge>
                        <StatusBadge tone={nextAction.tone}>{nextAction.label}</StatusBadge>
                      </div>
                      <div className="action-row">
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
