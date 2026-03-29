import Link from "next/link";
import { type ParcelDto, type PlanningParameterDto, type ScenarioDto } from "@repo/contracts";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ParcelCompletenessSummary } from "@/components/ui/parcel-completeness-summary";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getPlanningParameters } from "@/lib/api/planning";
import { getScenarios } from "@/lib/api/scenarios";
import { buildParcelCompletenessSummary } from "@/lib/ui/parcel-completeness";
import { getSourceLabel } from "@/lib/ui/provenance";

function ParcelRow({
  orgSlug,
  parcel,
  planningItems,
  linkedScenarios,
}: {
  orgSlug: string;
  parcel: ParcelDto;
  planningItems: PlanningParameterDto[];
  linkedScenarios: ScenarioDto[];
}) {
  const summary = buildParcelCompletenessSummary({
    parcel,
    planningItems,
    linkedScenarios,
  });

  return (
    <div className="ops-table__row ops-table__row--parcels">
      <div className="ops-table__cell">
        <div className="list-row__body">
          <div className="list-row__title">
            <span className="list-row__title-text">{parcel.name ?? parcel.cadastralId ?? "Untitled parcel"}</span>
            <StatusBadge tone={summary.sourceStatus.tone}>{summary.sourceStatus.label}</StatusBadge>
            {linkedScenarios.length ? <StatusBadge tone="accent">{linkedScenarios.length} scenario(s)</StatusBadge> : null}
          </div>
          <div className="inline-meta">
            <span className="meta-chip">{parcel.city ?? "Unknown city"}</span>
            <span className="meta-chip">{parcel.municipalityName ?? "Municipality not set"}</span>
            <span className="meta-chip">{parcel.landAreaSqm ?? "n/a"} sqm</span>
          </div>
          <div className="list-row__meta list-row__meta--clamped">{parcel.addressLine1 ?? parcel.cadastralId ?? "No address saved yet"}</div>
          <ProvenanceConfidence
            sourceType={parcel.sourceType}
            confidenceScore={parcel.confidenceScore}
            sourceReference={parcel.sourceReference}
            variant="inline"
          />
        </div>
      </div>

      <div className="ops-table__cell">
        <ParcelCompletenessSummary
          summary={summary}
          variant="inline"
        />
      </div>

      <div className="ops-table__actions">
        <div className="action-row">
          <StatusBadge tone={summary.nextBestAction.tone}>{summary.nextBestAction.label}</StatusBadge>
        </div>
        <div className="action-row">
          <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={`/${orgSlug}/parcels/${parcel.id}`}>
            Parcel
          </Link>
          <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/parcels/${parcel.id}/planning`}>
            Planning
          </Link>
          <Link className={buttonClasses({ size: "sm" })} href={`/${orgSlug}/scenarios/new?parcelId=${parcel.id}`}>
            Scenario
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function ParcelsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  try {
    const [parcels, scenarios] = await Promise.all([getParcels(orgSlug), getScenarios(orgSlug)]);
    const planningEntries = await Promise.all(
      parcels.items.map(async (parcel) => ({
        parcelId: parcel.id,
        items: (await getPlanningParameters(orgSlug, parcel.id)).items,
      })),
    );

    const planningByParcel = new Map(planningEntries.map((entry) => [entry.parcelId, entry.items]));
    const scenariosByParcel = new Map<string, ScenarioDto[]>();

    for (const scenario of scenarios.items) {
      if (!scenario.parcelId) continue;
      const existing = scenariosByParcel.get(scenario.parcelId) ?? [];
      existing.push(scenario);
      scenariosByParcel.set(scenario.parcelId, existing);
    }

    const manualCount = parcels.items.filter((parcel) => getSourceLabel(parcel.sourceType) === "Manual").length;
    const sourceBackedCount = parcels.items.filter((parcel) => getSourceLabel(parcel.sourceType) === "Source").length;
    const planningStartedCount = parcels.items.filter((parcel) => (planningByParcel.get(parcel.id) ?? []).some((item) => item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null)).length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Workspace / Parcels"
          title="Site pipeline"
          description="Scan trust, planning coverage, and next move."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{parcels.total} parcels</span>
              <span className="meta-chip">{sourceBackedCount} source-backed</span>
              <span className="meta-chip">{planningStartedCount} planning started</span>
              <span className="meta-chip">{manualCount} fallback manual</span>
            </div>
          )}
          actions={(
            <Link className={buttonClasses({ size: "lg" })} href={`/${orgSlug}/parcels/new`}>
              Add fallback parcel
            </Link>
          )}
        />

        <SectionCard
          className="summary-band"
          eyebrow="Operating summary"
          title="Portfolio scan"
          description="Compare trust, planning momentum, and fallback exposure fast."
          tone="accent"
          size="compact"
        >
          <div className="ops-summary-grid ops-summary-grid--planning">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Parcels</div>
              <div className="ops-summary-item__value">{parcels.total}</div>
              <div className="ops-summary-item__detail">Current site pipeline.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Source-backed</div>
              <div className="ops-summary-item__value">{sourceBackedCount}</div>
              <div className="ops-summary-item__detail">Aligned to source-led intake.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Planning started</div>
              <div className="ops-summary-item__value">{planningStartedCount}</div>
              <div className="ops-summary-item__detail">Buildability work underway.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Manual fallback</div>
              <div className="ops-summary-item__value">{manualCount}</div>
              <div className="ops-summary-item__detail">Usable now, but secondary.</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="index-surface"
          eyebrow="Acquisition workspace"
          title="Acquisition grid"
          description="Scan identity, trust, continuity, and next move in one sweep."
        >
          {parcels.items.length ? (
            <div className="ops-table">
              <div className="ops-table__header ops-table__header--parcels">
                <div>Parcel</div>
                <div>Operational scan</div>
                <div>Action</div>
              </div>
              {parcels.items.map((parcel) => (
                <ParcelRow
                  key={parcel.id}
                  orgSlug={orgSlug}
                  parcel={parcel}
                  planningItems={planningByParcel.get(parcel.id) ?? []}
                  linkedScenarios={scenariosByParcel.get(parcel.id) ?? []}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              eyebrow="No sites yet"
              title="Start with a parcel"
              description="Create a parcel to unlock the Sprint 1 flow. Long-term, parcels should come from source selection rather than manual entry."
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new`}>
                    Create fallback parcel
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                    Open scenario studio
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
          title="Parcel workspace unavailable"
          description="Site records could not be loaded because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
