import Link from "next/link";
import { type ParcelDto } from "@repo/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScenarioEditorForm } from "@/components/scenarios/scenario-editor-form";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getScenarioAssumptionTemplates } from "@/lib/api/scenarios";
import { createScenarioAction } from "../actions";

function isGroupedSite(parcel: ParcelDto) {
  return parcel.isGroupSite || parcel.provenance?.trustMode === "GROUP_DERIVED";
}

function getParcelLabel(parcel: ParcelDto) {
  return parcel.name ?? parcel.cadastralId ?? "Unnamed site";
}

function hasMixedAuthority(parcel: ParcelDto) {
  const rawMetadata = parcel.provenance?.rawMetadata;
  if (!rawMetadata || typeof rawMetadata !== "object") return false;
  return "mixedAuthority" in rawMetadata && rawMetadata.mixedAuthority === true;
}

export default async function NewScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ error?: string; parcelId?: string; message?: string }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const [parcels, assumptionTemplates] = await Promise.all([
      getParcels(orgSlug),
      getScenarioAssumptionTemplates(orgSlug),
    ]);
    const action = createScenarioAction.bind(null, orgSlug);
    const groupedSites = parcels.items
      .filter((parcel) => isGroupedSite(parcel))
      .sort((left, right) => getParcelLabel(left).localeCompare(getParcelLabel(right)));
    const defaultGroupedSite = !resolvedSearchParams?.parcelId && groupedSites.length === 1 ? groupedSites[0] : null;
    const effectiveParcelId = resolvedSearchParams?.parcelId ?? defaultGroupedSite?.id ?? null;
    const requestedParcel = effectiveParcelId
      ? parcels.items.find((parcel) => parcel.id === effectiveParcelId) ?? null
      : null;
    const selectedParcel = requestedParcel?.parcelGroupId && !requestedParcel.isGroupSite
      ? parcels.items.find((parcel) => parcel.id === requestedParcel.parcelGroup?.siteParcelId) ?? requestedParcel
      : requestedParcel;
    const sourceBackedCount = parcels.items.filter((parcel) => {
      return parcel.provenance?.trustMode === "SOURCE_PRIMARY" || parcel.provenance?.trustMode === "SOURCE_INCOMPLETE";
    }).length;
    const groupedSiteCount = parcels.items.filter((parcel) => parcel.isGroupSite || parcel.provenance?.trustMode === "GROUP_DERIVED").length;
    const manualFallbackCount = parcels.items.filter((parcel) => parcel.provenance?.trustMode === "MANUAL_FALLBACK").length;
    const groupedSiteSelectionMessage = defaultGroupedSite
      ? `${getParcelLabel(defaultGroupedSite)} was preselected because grouped sites are the primary downstream scenario anchor once parcel assembly is complete.`
      : null;
    const selectedParcelMessage = selectedParcel
      ? selectedParcel.isGroupSite
        ? `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This grouped site"} already aggregates ${selectedParcel.parcelGroup?.memberCount ?? selectedParcel.constituentParcels.length} sourced parcels and is ready to carry into case setup.`
        : selectedParcel.provenance?.trustMode === "MANUAL_FALLBACK"
          ? `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This parcel"} remains usable for scenario work, but source-backed parcel identity should stay the default path when available.`
          : `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This parcel"} will carry straight into funding, readiness, and run.`
      : "Choose the parcel or grouped site you want to test, save the case, then continue in the builder.";

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario studio"
          title="Create a scenario"
          description="Open a parcel-linked case from a sourced parcel or grouped site, then continue in the builder."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{parcels.total} parcel option{parcels.total === 1 ? "" : "s"}</span>
              <span className="meta-chip">{sourceBackedCount} source-backed</span>
              <span className="meta-chip">{groupedSiteCount} grouped sites</span>
              <span className="meta-chip">{manualFallbackCount} fallback manual</span>
            </div>
          )}
          actions={(
            <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
              Back to scenarios
            </Link>
          )}
        />

        {resolvedSearchParams?.error === "invalid-strategy-mix-json" ? (
          <Alert tone="danger">
            <AlertTitle>Invalid mix configuration JSON</AlertTitle>
            <AlertDescription>The temporary mixed-strategy JSON could not be parsed. Please fix the JSON and try again.</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "create-request-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Scenario creation failed</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The API rejected the new scenario request. Review the setup inputs and try again."}</AlertDescription>
          </Alert>
        ) : null}

        {groupedSiteSelectionMessage ? (
          <Alert tone="info">
            <AlertTitle>Grouped site preselected</AlertTitle>
            <AlertDescription>{groupedSiteSelectionMessage}</AlertDescription>
          </Alert>
        ) : null}

        {!parcels.items.length ? (
          <EmptyState
            eyebrow="Parcel dependency"
            title="A scenario needs source-backed parcel intake first"
            description="Search and ingest a source-backed parcel or grouped site first so geometry, area, and provenance stay attached to the case. Manual parcel creation remains fallback."
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
        ) : null}

        {parcels.items.length ? (
          <div className="content-stack">
            <SectionCard
              className="index-surface index-surface--workspace"
              eyebrow="Grouped-site workflow"
              title="Start from a development site"
              description="Grouped sites are the intended scenario anchor once parcel assembly is complete. Pick one below or keep working from a standalone sourced parcel when a site has not been assembled yet."
            >
              {groupedSites.length ? (
                <div className="ops-table">
                  <div className="ops-table__header ops-table__header--parcels">
                    <div>Grouped site</div>
                    <div>Members</div>
                    <div>Source</div>
                    <div>Start</div>
                  </div>
                  {groupedSites.map((parcel) => {
                    const memberCount = parcel.parcelGroup?.memberCount ?? parcel.constituentParcels.length;
                    const mixedAuthority = hasMixedAuthority(parcel);
                    return (
                      <div key={parcel.id} className="ops-table__row ops-table__row--parcels">
                        <div className="ops-table__cell">
                          <div className="list-row__body">
                            <div className="list-row__title">
                              <span className="list-row__title-text">{getParcelLabel(parcel)}</span>
                              <StatusBadge tone={selectedParcel?.id === parcel.id ? "accent" : "neutral"}>
                                {selectedParcel?.id === parcel.id ? "Selected" : "Available"}
                              </StatusBadge>
                            </div>
                            <div className="inline-meta">
                              <span className="meta-chip">{parcel.landAreaSqm ?? "n/a"} sqm</span>
                              <span className="meta-chip">{parcel.city ?? parcel.municipalityName ?? "Location not set"}</span>
                              {mixedAuthority ? <span className="meta-chip">Mixed authority</span> : null}
                            </div>
                            <div className="list-row__meta list-row__meta--clamped">
                              {mixedAuthority
                                ? "This grouped site mixes source authority levels across its member parcels, so downstream trust stays conservative."
                                : "This grouped site is already organized as the working development-site anchor."}
                            </div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Composition</div>
                            <div className="ops-scan__value">{memberCount} parcel{memberCount === 1 ? "" : "s"}</div>
                            <div className="ops-scan__detail">Grouped-site scenario creation will write to the site anchor, not the member parcels.</div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Source</div>
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

                        <div className="ops-table__actions ops-table__actions--dense">
                          <div className="action-row action-row--compact">
                            <Link className={buttonClasses({ size: "sm" })} href={`/${orgSlug}/scenarios/new?parcelId=${parcel.id}`}>
                              Use site
                            </Link>
                            <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/parcels/${parcel.id}`}>
                              Review site
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  eyebrow="No grouped sites yet"
                  title="Grouped sites will show up here once parcels are assembled"
                  description="Scenarios can still start from standalone sourced parcels, but grouped sites are the intended day-to-day development anchor once multiple parcels are in play."
                  actions={(
                    <>
                      <Link className={buttonClasses()} href={`/${orgSlug}/parcels`}>
                        Open parcel board
                      </Link>
                      <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new`}>
                        Source intake
                      </Link>
                    </>
                  )}
                />
              )}
            </SectionCard>

            <div className="detail-grid detail-grid--setup setup-grid">
              <ScenarioEditorForm
                action={action}
                parcels={parcels.items}
                templates={assumptionTemplates.items}
                workspaceDefaultTemplateKey={assumptionTemplates.workspaceDefaultTemplateKey}
                initialParcelId={effectiveParcelId}
                submitLabel="Create scenario"
                mode="create"
              />

              <div className="sidebar-stack">
                <NextStepPanel
                  className="rail-panel rail-panel--action"
                  title={selectedParcel ? "Start from the selected site" : "Create a parcel-linked case"}
                  description={selectedParcelMessage}
                  size="compact"
                  actions={(
                    <>
                      <Link className={buttonClasses()} href={`/${orgSlug}/parcels`}>
                        Review parcels
                      </Link>
                      <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                        Scenario list
                      </Link>
                    </>
                  )}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Scenario creation unavailable"
          description="The parcel list for new scenarios could not be loaded because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
