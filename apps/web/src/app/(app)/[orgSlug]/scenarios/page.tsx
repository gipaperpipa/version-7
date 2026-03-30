import Link from "next/link";
import { OptimizationTarget, ScenarioStatus, type ScenarioDto } from "@repo/contracts";
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
          title="Scenario board"
          description="Compare parcel, strategy, funding, readiness, and latest activity."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{scenarios.total} cases</span>
              <span className="meta-chip">{withLinkedParcel} parcel-linked</span>
              <span className="meta-chip">{withRunHistory} with runs</span>
              <span className="meta-chip">{activeCases} active</span>
            </div>
          )}
          actions={(
            <Link className={buttonClasses({ size: "lg" })} href={`/${orgSlug}/scenarios/new`}>
              New scenario
            </Link>
          )}
        />

        <SectionCard
          className="summary-band summary-band--ledger"
          eyebrow="Operating summary"
          title="Studio scan"
          description="Open the right case fast."
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
          className="index-surface index-surface--ledger"
          eyebrow="Decision workspace"
          title="Scenario studio"
          description="Open the right case fast by parcel, strategy, status, and latest signal."
        >
          {scenarios.items.length ? (
            <form action={`/${orgSlug}/scenarios/compare`} method="GET" className="content-stack">
              <div className="comparison-toolbar">
                <div className="comparison-toolbar__summary">
                  <div className="ops-summary-item__label">Comparison</div>
                  <div className="ops-summary-item__value">Select cases to rank and compare</div>
                  <div className="ops-summary-item__detail">Rank the selected set by optimization target, then inspect KPI and warning deltas.</div>
                </div>
                <div className="comparison-toolbar__form">
                  <label className="field-stack">
                    <span className="field-help">Ranking target</span>
                    <select name="rankingTarget" defaultValue={OptimizationTarget.MIN_REQUIRED_EQUITY} className="ui-select">
                      {Object.values(OptimizationTarget).map((value) => (
                        <option key={value} value={value}>{optimizationTargetLabels[value]}</option>
                      ))}
                    </select>
                  </label>
                  <button className={buttonClasses({ variant: "secondary" })} type="submit">
                    Compare selected
                  </button>
                </div>
              </div>

              <div className="ops-table">
                <div className="ops-table__header ops-table__header--scenarios">
                  <div>Select</div>
                  <div>Scenario</div>
                  <div>Parcel</div>
                  <div>Strategy</div>
                  <div>Funding</div>
                  <div>Status</div>
                  <div>Activity</div>
                  <div>Next</div>
                </div>
                {scenarios.items.map((scenario) => {
                  const linkedParcel = scenario.parcelId ? parcelById.get(scenario.parcelId) : null;
                  const selectedFundingCount = scenario.fundingVariants.filter((item) => item.isEnabled).length;
                  const selectedFundingLabels = scenario.fundingVariants
                    .filter((item) => item.isEnabled)
                    .slice(0, 2)
                    .map((item) => humanizeTokenLabel(item.financingSourceType));
                  const nextAction = getScenarioNextAction(scenario);

                  return (
                    <div key={scenario.id} className="ops-table__row ops-table__row--scenarios">
                      <div className="ops-table__cell ops-table__cell--select">
                        <label className="compare-checkbox">
                          <input type="checkbox" name="scenarioId" value={scenario.id} />
                          <span>Compare</span>
                        </label>
                      </div>

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
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Parcel</div>
                          <div className="ops-scan__value">
                            {linkedParcel?.name ?? linkedParcel?.cadastralId ?? (scenario.parcelId ? "Linked parcel" : "Unlinked")}
                          </div>
                          <div className="ops-scan__detail">
                            {linkedParcel?.municipalityName ?? (scenario.parcelId ? "Parcel context attached" : "Needs site anchor")}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Strategy</div>
                          <div className="ops-scan__value">{strategyTypeLabels[scenario.strategyType]}</div>
                          <div className="ops-scan__detail">{optimizationTargetLabels[scenario.optimizationTarget]}</div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Funding</div>
                          <div className="ops-scan__value">{selectedFundingCount} lane(s)</div>
                          <div className="ops-scan__detail">
                            {selectedFundingLabels.length ? selectedFundingLabels.join(" / ") : "No active stack"}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Status</div>
                          <div className="action-row">
                            <StatusBadge tone={getScenarioStatusTone(scenario.status)}>
                              {humanizeTokenLabel(scenario.status)}
                            </StatusBadge>
                          </div>
                          <div className="ops-scan__detail">
                            {scenario.latestRunAt ? "Run history present" : "No completed run yet"}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__cell">
                        <div className="ops-cell-stack">
                          <div className="ops-scan__label">Activity</div>
                          <div className="ops-scan__value">
                            {scenario.latestRunAt ? `Ran ${formatScenarioSignal(scenario.latestRunAt)}` : `Updated ${formatScenarioSignal(scenario.updatedAt)}`}
                          </div>
                          <div className="ops-scan__detail">
                            {scenario.latestRunAt ? "Latest engine output recorded" : "Builder edits only"}
                          </div>
                        </div>
                      </div>

                      <div className="ops-table__actions ops-table__actions--dense">
                        <div className="action-row">
                          <StatusBadge tone={nextAction.tone}>{nextAction.label}</StatusBadge>
                        </div>
                        <div className="ops-scan__detail">{nextAction.detail}</div>
                        <div className="action-row action-row--compact">
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
            </form>
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
