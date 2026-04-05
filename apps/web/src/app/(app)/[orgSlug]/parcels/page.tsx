import Link from "next/link";
import { type ParcelDto, type PlanningParameterDto, type ScenarioDto } from "@repo/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { getSourceAuthorityLabel } from "@/lib/ui/provenance";
import { createGroupedSiteFromWorkspaceAction } from "./actions";

function hasStoredPlanningValue(item: PlanningParameterDto) {
  return item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null;
}

function isGroupedSite(parcel: ParcelDto) {
  return parcel.isGroupSite || parcel.provenance?.trustMode === "GROUP_DERIVED";
}

function isSourceStandaloneCandidate(parcel: ParcelDto) {
  return !isGroupedSite(parcel)
    && !parcel.parcelGroupId
    && parcel.provenance?.trustMode !== "MANUAL_FALLBACK"
    && Boolean(parcel.sourceProviderName ?? parcel.provenance?.providerName)
    && Boolean(parcel.sourceProviderParcelId ?? parcel.provenance?.providerParcelId);
}

function hasDownstreamContinuity(planningItems: PlanningParameterDto[], linkedScenarios: ScenarioDto[]) {
  return planningItems.some(hasStoredPlanningValue) || linkedScenarios.length > 0;
}

function getSiteAssemblyStatus(parcel: ParcelDto, planningItems: PlanningParameterDto[], linkedScenarios: ScenarioDto[]) {
  const planningValueCount = planningItems.filter(hasStoredPlanningValue).length;
  const scenarioCount = linkedScenarios.length;

  if (!hasDownstreamContinuity(planningItems, linkedScenarios)) {
    return {
      label: "Reusable parcel",
      tone: "accent" as const,
      detail: "No downstream work yet. Safe to fold directly into a grouped site without migration.",
      counts: `${planningValueCount} planning / ${scenarioCount} scenarios`,
    };
  }

  return {
    label: "Safe migrate",
    tone: "warning" as const,
    detail: `This parcel already carries ${planningValueCount} planning value(s) and ${scenarioCount} scenario(s). If it is the only locked parcel in the selected set, continuity will be re-anchored to the grouped site.`,
    counts: `${planningValueCount} planning / ${scenarioCount} scenarios`,
  };
}

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
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ error?: string; message?: string; errorCode?: string }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

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
      return (planningByParcel.get(parcel.id) ?? []).some(hasStoredPlanningValue);
    }).length;
    const groupedSites = parcels.items.filter((parcel) => isGroupedSite(parcel));
    const standaloneParcels = parcels.items.filter((parcel) => !isGroupedSite(parcel));
    const sourceStandaloneCandidates = standaloneParcels.filter((parcel) => isSourceStandaloneCandidate(parcel));
    const safeMigrationCandidateCount = sourceStandaloneCandidates.filter((parcel) =>
      hasDownstreamContinuity(planningByParcel.get(parcel.id) ?? [], scenariosByParcel.get(parcel.id) ?? [])).length;
    const directReuseCandidateCount = sourceStandaloneCandidates.length - safeMigrationCandidateCount;
    const groupedSiteAction = createGroupedSiteFromWorkspaceAction.bind(null, orgSlug);

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
              <span className="meta-chip">{sourceStandaloneCandidates.length} site-ready standalones</span>
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

        {resolvedSearchParams?.error === "grouped-site-selection-missing" ? (
          <Alert tone="warning">
            <AlertTitle>Select at least two source-backed parcels</AlertTitle>
            <AlertDescription>Choose two or more standalone source-backed parcels from the workspace to assemble a grouped development site.</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "grouped-site-invalid-selection" ? (
          <Alert tone="danger">
            <AlertTitle>Grouped-site assembly needs standalone source parcels</AlertTitle>
            <AlertDescription>Grouped sites, grouped members, and manual fallback parcels cannot be assembled from the workspace selection form.</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "grouped-site-source-resolution-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Could not resolve source parcel identity</AlertTitle>
            <AlertDescription>One or more selected workspace parcels no longer map cleanly back to their source records. Reopen source intake and reselect them from the provider if needed.</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "grouped-site-create-failed" ? (
          <Alert tone="danger">
            <AlertTitle>
              {resolvedSearchParams.errorCode === "GROUP_MEMBER_ALREADY_ASSIGNED"
                ? "Selected parcels already belong to another grouped site"
                : resolvedSearchParams.errorCode === "DOWNSTREAM_RECONCILIATION_REQUIRED"
                  ? "Selected parcels already have conflicting downstream work"
                  : "Grouped-site creation failed"}
            </AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The grouped-site request could not be completed."}</AlertDescription>
          </Alert>
        ) : null}

        <SectionCard
          className="summary-band summary-band--ledger"
          eyebrow="Operating summary"
          title="Portfolio scan"
          description="Source coverage, grouped-site momentum, planning continuity, fallback exposure."
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
              <div className="ops-summary-item__label">Site-ready standalones</div>
              <div className="ops-summary-item__value">{sourceStandaloneCandidates.length}</div>
              <div className="ops-summary-item__detail">{directReuseCandidateCount} direct reuse / {safeMigrationCandidateCount} safe migrate.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Planning started</div>
              <div className="ops-summary-item__value">{planningStartedCount}</div>
              <div className="ops-summary-item__detail">Buildability work underway.</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="index-surface index-surface--workspace"
          eyebrow="Grouped-site workflow"
          title="Assemble a development site from existing parcels"
          description="Use source-backed standalone parcels already in the workspace to create or reopen a grouped site without going back through parcel search."
        >
          {sourceStandaloneCandidates.length ? (
            <form action={groupedSiteAction} className="content-stack">
              <div className="field-grid field-grid--tri">
                <div className="field-stack field-stack--span-full">
                  <label className="field-label" htmlFor="siteName">Optional site name</label>
                  <input
                    id="siteName"
                    name="siteName"
                    className="ui-input"
                    placeholder="Leave blank to use the deterministic grouped-site name"
                  />
                  <div className="field-help">Select two or more standalone source-backed parcels. Exactly one locked parcel can be safely migrated into the grouped site; more than one locked parcel will be blocked.</div>
                </div>
              </div>

              <div className="ops-table">
                <div className="ops-table__header ops-table__header--parcels">
                  <div>Parcel</div>
                  <div>Authority</div>
                  <div>Area</div>
                  <div>Downstream</div>
                  <div>Select</div>
                </div>
                {sourceStandaloneCandidates.map((parcel) => {
                  const planningItems = planningByParcel.get(parcel.id) ?? [];
                  const linkedScenarios = scenariosByParcel.get(parcel.id) ?? [];
                  const assemblyStatus = getSiteAssemblyStatus(parcel, planningItems, linkedScenarios);
                  return (
                    <div key={parcel.id} className="ops-table__row ops-table__row--parcels">
                      <div className="ops-table__cell">
                        <div className="list-row__body">
                          <div className="list-row__title">
                            <span className="list-row__title-text">{parcel.name ?? parcel.cadastralId ?? "Source parcel"}</span>
                            <StatusBadge tone={assemblyStatus.tone}>{assemblyStatus.label}</StatusBadge>
                          </div>
                          <div className="inline-meta">
                            <span className="meta-chip">{parcel.sourceProviderParcelId ?? parcel.cadastralId ?? "No parcel ID"}</span>
                            <span className="meta-chip">{parcel.city ?? parcel.municipalityName ?? "Location not set"}</span>
                          </div>
                          <div className="list-row__meta list-row__meta--clamped">{assemblyStatus.detail}</div>
                        </div>
                      </div>
                      <div className="ops-table__cell">
                        <div className="ops-scan__value">{getSourceAuthorityLabel(parcel.provenance?.sourceAuthority ?? parcel.sourceAuthority) ?? "Source-backed"}</div>
                      </div>
                      <div className="ops-table__cell">
                        <div className="ops-scan__value">{parcel.landAreaSqm ?? "n/a"} sqm</div>
                      </div>
                      <div className="ops-table__cell">
                        <div className="ops-scan__value">{assemblyStatus.counts}</div>
                      </div>
                      <div className="ops-table__actions ops-table__actions--dense">
                        <label className="field-row">
                          <input type="checkbox" name="workspaceParcelId" value={parcel.id} />
                          <span className="field-help">Use parcel</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="action-row">
                <button className={buttonClasses({ size: "lg" })} type="submit">
                  Create grouped site
                </button>
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new`}>
                  Source intake
                </Link>
              </div>
            </form>
          ) : (
            <EmptyState
              eyebrow="No standalone source parcels ready"
              title={groupedSites.length ? "Source intake remains available for new grouped sites" : "Grouped sites will appear here once parcels are assembled"}
              description={groupedSites.length
                ? "Bring in more standalone source parcels through intake, then assemble them into a grouped site from this board."
                : "The grouped-site model is active, but there are not yet enough standalone source-backed parcels in the current workspace to assemble a site."}
              actions={(
                <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new`}>
                  Source intake
                </Link>
              )}
            />
          )}
        </SectionCard>

        <SectionCard
          className="index-surface index-surface--ledger"
          eyebrow="Development sites"
          title="Grouped sites in play"
          description="These are the first-class site anchors for planning and scenarios."
        >
          {groupedSites.length ? (
            <div className="ops-table">
              <div className="ops-table__header ops-table__header--parcels">
                <div>Site</div>
                <div>Area</div>
                <div>Source</div>
                <div>Planning</div>
                <div>Continuity</div>
                <div>Next</div>
              </div>
              {groupedSites.map((parcel) => (
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
              eyebrow="No grouped sites yet"
              title="Assemble the first development site"
              description="Grouped sites are now the intended downstream anchor. Select multiple source-backed parcels above or ingest new parcels, then create the site here in the workspace."
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new`}>
                    Source intake
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios/new`}>
                    Scenario studio
                  </Link>
                </>
              )}
            />
          )}
        </SectionCard>

        <SectionCard
          className="index-surface index-surface--ledger"
          eyebrow="Standalone parcels"
          title="Parcel candidates and single-parcel sites"
          description="Scan sourced identity, planning coverage, and next move for parcels that are not yet grouped into a development site."
        >
          {standaloneParcels.length ? (
            <div className="ops-table">
              <div className="ops-table__header ops-table__header--parcels">
                <div>Site</div>
                <div>Area</div>
                <div>Source</div>
                <div>Planning</div>
                <div>Continuity</div>
                <div>Next</div>
              </div>
              {standaloneParcels.map((parcel) => (
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
              eyebrow="No standalone parcels"
              title="Everything in the workspace is already organized as grouped sites"
              description="New source-backed parcels can still be ingested directly, but current daily work is already anchored to development sites."
              actions={(
                <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new`}>
                  Source intake
                </Link>
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
