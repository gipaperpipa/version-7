import Link from "next/link";
import { type ParcelDto, type PlanningParameterDto, type ScenarioDto } from "@repo/contracts";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getPlanningParameters } from "@/lib/api/planning";
import { getScenarios } from "@/lib/api/scenarios";
import { buildParcelCompletenessSummary } from "@/lib/ui/parcel-completeness";

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
  const planningValueCount = planningItems.filter((item) => item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null).length;
  const trustMode = parcel.provenance?.trustMode ?? null;
  const memberCount = parcel.parcelGroup?.memberCount ?? parcel.constituentParcels.length;
  const sourceBadge = parcel.isGroupSite ? "Grouped site" : trustMode === "MANUAL_FALLBACK" ? "Manual fallback" : "Source parcel";
  const areaLabel = `${parcel.landAreaSqm ?? "n/a"} sqm`;
  const parcelReference = parcel.sourceProviderParcelId ?? parcel.cadastralId ?? "No parcel reference";
  const parcelSubline = parcel.isGroupSite
    ? `${memberCount} parcel member${memberCount === 1 ? "" : "s"}`
    : parcel.addressLine1 ?? parcelReference;
  const sourceDetail = parcel.provenance?.providerName
    ? `${parcel.provenance.providerName}${parcel.provenance.providerParcelId ? ` / ${parcel.provenance.providerParcelId}` : ""}`
    : summary.sourceStatus.detail;
  const areaDetail = parcel.isGroupSite
    ? `${memberCount} parcel member${memberCount === 1 ? "" : "s"}`
    : [parcel.city, parcel.municipalityName].filter(Boolean).join(" / ") || "Location not yet set";

  return (
    <div className="ops-table__row ops-table__row--parcels">
      <div className="ops-table__cell">
        <div className="list-row__body">
          <div className="list-row__title">
            <span className="list-row__title-text">{parcel.name ?? parcel.cadastralId ?? "Untitled parcel"}</span>
            <StatusBadge tone={summary.sourceStatus.tone}>{sourceBadge}</StatusBadge>
            {linkedScenarios.length ? <StatusBadge tone="accent">{linkedScenarios.length} scenario(s)</StatusBadge> : null}
          </div>
          <div className="inline-meta">
            <span className="meta-chip">{parcelReference}</span>
            <span className="meta-chip">{parcel.city ?? "Unknown city"}</span>
            <span className="meta-chip">{parcel.municipalityName ?? "Municipality not set"}</span>
            <span className="meta-chip">{areaLabel}</span>
          </div>
          <div className="list-row__meta list-row__meta--clamped">{parcelSubline}</div>
          <ProvenanceConfidence
            sourceType={parcel.sourceType}
            confidenceScore={parcel.confidenceScore}
            sourceReference={parcel.sourceReference}
            provenance={parcel.provenance}
            providerName={parcel.sourceProviderName}
            providerParcelId={parcel.sourceProviderParcelId}
            variant="inline"
          />
        </div>
      </div>

      <div className="ops-table__cell">
        <div className="ops-cell-stack">
          <div className="ops-scan__label">Area</div>
          <div className="ops-scan__value">{areaLabel}</div>
          <div className="ops-scan__detail">{areaDetail}</div>
        </div>
      </div>

      <div className="ops-table__cell">
        <div className="ops-cell-stack">
          <div className="ops-scan__label">Source</div>
          <div className="action-row">
            <StatusBadge tone={summary.sourceStatus.tone}>{summary.sourceStatus.label}</StatusBadge>
          </div>
          <div className="ops-scan__detail">{sourceDetail}</div>
        </div>
      </div>

      <div className="ops-table__cell">
        <div className="ops-cell-stack">
          <div className="ops-scan__label">Planning</div>
          <div className="action-row">
            <StatusBadge tone={summary.planningCompleteness.tone}>{summary.planningCompleteness.label}</StatusBadge>
          </div>
          <div className="ops-scan__detail">{planningValueCount} saved / {summary.planningCompleteness.detail}</div>
        </div>
      </div>

      <div className="ops-table__cell">
        <div className="ops-cell-stack">
          <div className="ops-scan__label">Continuity</div>
          <div className="action-row">
            <StatusBadge tone={summary.scenarioContinuity.tone}>{summary.scenarioContinuity.label}</StatusBadge>
          </div>
          <div className="ops-scan__detail">{summary.scenarioContinuity.detail}</div>
        </div>
      </div>

      <div className="ops-table__actions ops-table__actions--dense">
        <div className="action-row">
          <StatusBadge tone={summary.nextBestAction.tone}>{summary.nextBestAction.label}</StatusBadge>
        </div>
        <div className="action-row action-row--compact">
          <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={`/${orgSlug}/parcels/${parcel.id}`}>
            Site
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

    const manualCount = parcels.items.filter((parcel) => parcel.provenance?.trustMode === "MANUAL_FALLBACK").length;
    const sourceBackedCount = parcels.items.filter((parcel) => {
      return parcel.provenance?.trustMode === "SOURCE_PRIMARY" || parcel.provenance?.trustMode === "SOURCE_INCOMPLETE";
    }).length;
    const groupedSiteCount = parcels.items.filter((parcel) => parcel.isGroupSite || parcel.provenance?.trustMode === "GROUP_DERIVED").length;
    const planningStartedCount = parcels.items.filter((parcel) => {
      return (planningByParcel.get(parcel.id) ?? []).some((item) => item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null);
    }).length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Workspace / Parcels"
          title="Source parcel board"
          description="Source-selected parcels and grouped sites now anchor planning and scenario work."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{parcels.total} top-level sites</span>
              <span className="meta-chip">{sourceBackedCount} source-backed</span>
              <span className="meta-chip">{groupedSiteCount} grouped sites</span>
              <span className="meta-chip">{planningStartedCount} planning started</span>
              <span className="meta-chip">{manualCount} fallback manual</span>
            </div>
          )}
          actions={(
            <>
              <Link className={buttonClasses({ size: "lg" })} href={`/${orgSlug}/parcels/new`}>
                Source intake
              </Link>
              <Link className={buttonClasses({ variant: "secondary", size: "lg" })} href={`/${orgSlug}/parcels/new/manual`}>
                Manual fallback
              </Link>
            </>
          )}
        />

        <SectionCard
          className="summary-band summary-band--ledger"
          eyebrow="Operating summary"
          title="Portfolio scan"
          description="Source coverage, grouped sites, planning momentum, fallback exposure."
          tone="accent"
          size="compact"
        >
          <div className="ops-summary-grid ops-summary-grid--planning">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Top-level sites</div>
              <div className="ops-summary-item__value">{parcels.total}</div>
              <div className="ops-summary-item__detail">Standalone parcels and grouped sites in play.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Source-backed</div>
              <div className="ops-summary-item__value">{sourceBackedCount}</div>
              <div className="ops-summary-item__detail">Directly aligned to source-led parcel intake.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Grouped sites</div>
              <div className="ops-summary-item__value">{groupedSiteCount}</div>
              <div className="ops-summary-item__detail">Multi-parcel site foundations already assembled.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Planning started</div>
              <div className="ops-summary-item__value">{planningStartedCount}</div>
              <div className="ops-summary-item__detail">Buildability work underway.</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="index-surface index-surface--ledger"
          eyebrow="Acquisition workspace"
          title="Acquisition grid"
          description="Scan sourced identity, grouped-site continuity, planning coverage, and next move in one sweep."
        >
          {parcels.items.length ? (
            <div className="ops-table">
              <div className="ops-table__header ops-table__header--parcels">
                <div>Site</div>
                <div>Area</div>
                <div>Source</div>
                <div>Planning</div>
                <div>Continuity</div>
                <div>Next</div>
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
              eyebrow="No parcels yet"
              title="Start with source parcel intake"
              description="Search and ingest real parcels first so geometry, area, and provenance stay source-derived. Manual parcel creation remains fallback."
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new`}>
                    Source intake
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new/manual`}>
                    Manual fallback
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
