import Link from "next/link";
import { type ParcelDto, type PlanningParameterDto, type ScenarioDto } from "@repo/contracts";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ParcelCompletenessSummary } from "@/components/ui/parcel-completeness-summary";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusBadge } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getPlanningParameters } from "@/lib/api/planning";
import { getScenarios } from "@/lib/api/scenarios";
import { buildParcelCompletenessSummary } from "@/lib/ui/parcel-completeness";
import { getConfidenceBand, getSourceLabel } from "@/lib/ui/provenance";

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
    <div className="list-row list-row--dense">
      <div className="list-row__body">
        <div className="list-row__title">
          <span className="list-row__title-text">{parcel.name ?? parcel.cadastralId ?? "Untitled parcel"}</span>
          <StatusBadge tone="info">Site record</StatusBadge>
          {linkedScenarios.length ? <StatusBadge tone="accent">{linkedScenarios.length} scenario(s)</StatusBadge> : null}
        </div>
        <div className="list-row__description">
          {[parcel.city ?? "Unknown city", parcel.municipalityName ?? "Municipality not set", `Land area ${parcel.landAreaSqm ?? "n/a"} sqm`].join(" / ")}
        </div>
        <div className="list-row__meta">{parcel.addressLine1 ?? "No address saved yet"}</div>
        <ProvenanceConfidence
          sourceType={parcel.sourceType}
          confidenceScore={parcel.confidenceScore}
          sourceReference={parcel.sourceReference}
        />
      </div>

      <ParcelCompletenessSummary
        summary={summary}
        title="Parcel continuity"
        description="A compact view of trust, planning progress, and the next best downstream move."
      />

      <div className="action-row">
        <Link className={buttonClasses({ variant: "ghost", size: "sm" })} href={`/${orgSlug}/parcels/${parcel.id}`}>
          Open parcel
        </Link>
        <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/parcels/${parcel.id}/planning`}>
          Planning
        </Link>
        <Link className={buttonClasses({ size: "sm" })} href={`/${orgSlug}/scenarios/new?parcelId=${parcel.id}`}>
          New scenario
        </Link>
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
    const highConfidenceCount = parcels.items.filter((parcel) => getConfidenceBand(parcel.confidenceScore) === "High").length;
    const planningStartedCount = parcels.items.filter((parcel) => (planningByParcel.get(parcel.id) ?? []).some((item) => item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null)).length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Workspace / Parcels"
          title="Site pipeline"
          description="Use parcels as the acquisition and site-context workspace for Feasibility OS. Manual parcel intake stays available, but the intended product model remains source-selected parcels with derived geometry and area."
          actions={(
            <Link className={buttonClasses({ size: "lg" })} href={`/${orgSlug}/parcels/new`}>
              Add fallback parcel
            </Link>
          )}
        />

        <div className="stat-grid">
          <StatBlock label="Total parcels" value={parcels.total} caption="Current workspace count" tone="accent" />
          <StatBlock label="Source-backed" value={sourceBackedCount} caption="Parcels already aligned with the intended intake model" tone="success" />
          <StatBlock label="Planning started" value={planningStartedCount} caption="Parcels already moving into buildability interpretation" />
          <StatBlock label="Manual fallback" value={manualCount} caption="Still usable, but not the intended long-term intake path" tone={manualCount ? "warning" : "neutral"} />
        </div>

        <SectionCard
          eyebrow="Acquisition workspace"
          title="Active site records"
          description="Each row should tell you what the parcel is, how trustworthy it is, how far it has moved downstream, and what to do next."
        >
          {parcels.items.length ? (
            <div className="list-shell">
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
              description="Create a parcel to unlock the thin Sprint 1 workflow. In the long-term product, parcels are expected to originate from source selection and geometry-backed site context rather than manual entry."
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
