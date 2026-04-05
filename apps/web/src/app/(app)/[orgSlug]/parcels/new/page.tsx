import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { isApiResponseError, isApiUnavailableError } from "@/lib/api/errors";
import { getParcels, searchSourceParcels } from "@/lib/api/parcels";
import { getConfidenceBand, getSourceAuthorityDetail, getSourceAuthorityLabel } from "@/lib/ui/provenance";
import { ingestSourceParcelsAction } from "../actions";

function getGeometryStateBadge(hasGeometry: boolean, hasLandArea: boolean) {
  if (hasGeometry && hasLandArea) {
    return <StatusBadge tone="success">Geometry + area ready</StatusBadge>;
  }

  if (hasGeometry || hasLandArea) {
    return <StatusBadge tone="warning">Source incomplete</StatusBadge>;
  }

  return <StatusBadge tone="danger">Source thin</StatusBadge>;
}

function getWorkspaceStateBadge(
  workspaceState: Awaited<ReturnType<typeof searchSourceParcels>>["items"][number]["workspaceState"],
) {
  switch (workspaceState) {
    case "EXISTING_STANDALONE_REUSABLE":
      return <StatusBadge tone="accent">Reusable parcel</StatusBadge>;
    case "EXISTING_STANDALONE_LOCKED":
      return <StatusBadge tone="warning">Locked parcel</StatusBadge>;
    case "GROUPED_SITE_MEMBER":
      return <StatusBadge tone="warning">Grouped site member</StatusBadge>;
    default:
      return <StatusBadge tone="success">New to intake</StatusBadge>;
  }
}

function getWorkspaceStateDetail(
  item: Awaited<ReturnType<typeof searchSourceParcels>>["items"][number],
) {
  const scenarioPreview = item.downstreamWork.scenarios.length
    ? ` Latest scenarios: ${item.downstreamWork.scenarios.map((scenario) => scenario.name).join(", ")}.`
    : "";
  switch (item.workspaceState) {
    case "EXISTING_STANDALONE_REUSABLE":
      return "Already in the workspace with no downstream work yet, so the existing parcel identity can be reused inside a grouped site without duplication.";
    case "EXISTING_STANDALONE_LOCKED":
      return `Already in the workspace with ${item.downstreamWork.planningValueCount} planning value(s) and ${item.downstreamWork.scenarioCount} scenario(s). If this is the only locked parcel in the selected set, downstream continuity will be re-anchored to the grouped site instead of cloned.${scenarioPreview}`;
    case "GROUPED_SITE_MEMBER":
      return item.existingSite?.name
        ? `Already folded into ${item.existingSite.name}. Group membership is stable in this pass, so reuse that grouped site instead of creating a second site identity.`
        : "Already folded into an existing grouped site.";
    default:
      return "Ready to ingest into the workspace.";
  }
}

function getWorkspaceStateActionLabel(
  item: Awaited<ReturnType<typeof searchSourceParcels>>["items"][number],
) {
  if (item.workspaceState === "EXISTING_STANDALONE_REUSABLE") {
    return "Reuse / group";
  }

  if (item.workspaceState === "EXISTING_STANDALONE_LOCKED") {
    return "Reuse / migrate";
  }

  return "Select";
}

export default async function NewParcelPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ q?: string; municipality?: string; error?: string; errorCode?: string; message?: string }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q ?? "";
  const municipality = resolvedSearchParams?.municipality ?? "";

  try {
    const existingParcels = await getParcels(orgSlug);
    let sourceResults;

    try {
      sourceResults = await searchSourceParcels(orgSlug, {
        q: query,
        municipality,
        limit: 10,
      });
    } catch (error) {
      if (isApiUnavailableError(error) || isApiResponseError(error)) {
        const message = isApiResponseError(error) && error.status === 404
          ? "The current API deployment does not expose source parcel search yet. Redeploy the API or use manual fallback for now."
          : error.message;

        return (
          <div className="workspace-page content-stack">
            <PageHeader
              eyebrow="Primary parcel intake"
              title="Source parcel intake unavailable"
              description="Source-backed intake is the intended parcel identity model, but the current API deployment cannot serve source search yet."
              meta={(
                <div className="action-row">
                  <span className="meta-chip">{existingParcels.total} parcels already in workspace</span>
                  <span className="meta-chip">Manual fallback still available</span>
                </div>
              )}
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new/manual`}>
                    Manual fallback
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels`}>
                    Back to parcels
                  </Link>
                </>
              )}
            />

            <Alert tone="warning">
              <AlertTitle>Source search is not available on this deployment</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>

            <SectionCard
              className="summary-band summary-band--workspace"
              eyebrow="Expected primary flow"
              title="Source-selected parcel identity"
              description="Parcel geometry and area should come from source-backed intake. Manual parcel entry remains a controlled fallback."
              tone="accent"
              size="compact"
            >
              <div className="ops-summary-grid ops-summary-grid--planning">
                <div className="ops-summary-item">
                  <div className="ops-summary-item__label">Primary path</div>
                  <div className="ops-summary-item__value">Source intake</div>
                  <div className="ops-summary-item__detail">Search parcel records, ingest geometry, derive area.</div>
                </div>
                <div className="ops-summary-item">
                  <div className="ops-summary-item__label">Current status</div>
                  <div className="ops-summary-item__value">Temporarily blocked</div>
                  <div className="ops-summary-item__detail">Web is ahead of the current source-search API deployment.</div>
                </div>
                <div className="ops-summary-item">
                  <div className="ops-summary-item__label">Fallback</div>
                  <div className="ops-summary-item__value">Manual</div>
                  <div className="ops-summary-item__detail">Use only until the source-search endpoint is live.</div>
                </div>
              </div>
            </SectionCard>

            <div className="detail-grid">
              <SectionCard
                className="index-surface index-surface--workspace"
                eyebrow="Recovery"
                title="How to unblock source intake"
                description="Use manual fallback if needed, then redeploy the API with the source parcel routes and migration applied."
                size="compact"
              >
                <div className="helper-list">
                  <div>Deploy the API version that includes `GET /api/v1/parcels/source/search` and `POST /api/v1/parcels/source/intake`.</div>
                  <div>Apply the parcel-group/source provenance Prisma migration on the API database.</div>
                  <div>Reload this page once the API deployment is live.</div>
                </div>
              </SectionCard>

              <div className="sidebar-stack">
                <NextStepPanel
                  className="rail-panel rail-panel--action"
                  title="Use fallback only if you need to keep moving"
                  description="Manual parcel creation still preserves the thin flow into planning and scenarios, but it should remain secondary to source-selected parcel identity."
                  size="compact"
                  actions={(
                    <>
                      <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new/manual`}>
                        Open manual fallback
                      </Link>
                      <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels`}>
                        Return to parcel board
                      </Link>
                    </>
                  )}
                />
              </div>
            </div>
          </div>
        );
      }

      throw error;
    }

    const action = ingestSourceParcelsAction.bind(null, orgSlug);
    const sourceReadyCount = sourceResults.items.filter((item) => item.hasGeometry && item.hasLandArea).length;
    const newCandidateCount = sourceResults.items.filter((item) => item.workspaceState === "NEW").length;
    const reusableStandaloneCount = sourceResults.items.filter((item) => item.workspaceState === "EXISTING_STANDALONE_REUSABLE").length;
    const lockedStandaloneCount = sourceResults.items.filter((item) => item.workspaceState === "EXISTING_STANDALONE_LOCKED").length;
    const groupedMemberCount = sourceResults.items.filter((item) => item.workspaceState === "GROUPED_SITE_MEMBER").length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Primary parcel intake"
          title="Select source-backed parcels"
          description="Search parcel IDs or place context, ingest sourced geometry and derived area, then continue straight into planning and scenarios."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{sourceResults.total} source candidates shown</span>
              <span className="meta-chip">{sourceReadyCount} geometry-ready</span>
              <span className="meta-chip">{newCandidateCount} new to intake</span>
                <span className="meta-chip">{lockedStandaloneCount} locked</span>
                <span className="meta-chip">{groupedMemberCount} already grouped</span>
                <span className="meta-chip">{existingParcels.total} parcels already in workspace</span>
            </div>
          )}
          actions={(
            <>
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new/manual`}>
                Manual fallback
              </Link>
              <Link className={buttonClasses({ variant: "ghost" })} href={`/${orgSlug}/parcels`}>
                Back to parcels
              </Link>
            </>
          )}
        />

        {resolvedSearchParams?.error === "missing-source-selection" ? (
          <Alert tone="warning">
            <AlertTitle>Select at least one source parcel</AlertTitle>
            <AlertDescription>Choose one parcel for a direct intake or multiple parcels to create a grouped site foundation.</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "source-intake-failed" ? (
            <Alert tone="danger">
              <AlertTitle>
                {resolvedSearchParams.errorCode === "SOURCE_PROVIDER_UNAVAILABLE"
                  ? "Source provider unavailable"
                  : resolvedSearchParams.errorCode === "GROUP_MEMBER_ALREADY_ASSIGNED"
                  ? "Selected parcels already belong to another site"
                  : resolvedSearchParams.errorCode === "DOWNSTREAM_RECONCILIATION_REQUIRED"
                    ? "Selected parcels already have conflicting downstream work"
                  : "Source intake failed"}
            </AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The API rejected the source parcel intake request."}</AlertDescription>
          </Alert>
        ) : null}

        <SectionCard
          className="summary-band summary-band--workspace"
          eyebrow="Source-first workflow"
          title="Parcel identity comes from source"
          description="Search, select, ingest, then continue. Manual parcel authoring remains only fallback."
          tone="accent"
          size="compact"
        >
            <div className="ops-summary-grid ops-summary-grid--planning">
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Source-selected</div>
              <div className="ops-summary-item__value">Primary</div>
              <div className="ops-summary-item__detail">Parcel geometry and area come from source-backed intake.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Derived geometry</div>
              <div className="ops-summary-item__value">Automatic</div>
              <div className="ops-summary-item__detail">No parcel drawing required.</div>
            </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Multi-parcel site</div>
                <div className="ops-summary-item__value">Supported</div>
                <div className="ops-summary-item__detail">Select multiple parcels to build a grouped site foundation.</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Reusable standalones</div>
                <div className="ops-summary-item__value">{reusableStandaloneCount}</div>
                <div className="ops-summary-item__detail">Already in workspace and safe to reuse without duplication.</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Locked / grouped</div>
                <div className="ops-summary-item__value">{lockedStandaloneCount + groupedMemberCount}</div>
                <div className="ops-summary-item__detail">Existing site identity or downstream work will be reused, migrated, or blocked explicitly.</div>
              </div>
            </div>
          </SectionCard>

        <div className="detail-grid">
          <div className="content-stack">
            <SectionCard
              className="index-surface index-surface--workspace"
              eyebrow="Source search"
              title="Find parcels by parcel ID or place"
              description="Search source-backed parcel records, then ingest one parcel or an assembled site."
              size="compact"
            >
              <form className="content-stack" method="GET">
                <div className="field-grid field-grid--tri">
                  <div className="field-stack field-stack--span-full">
                    <label className="field-label" htmlFor="q">Search query</label>
                    <input
                      id="q"
                      name="q"
                      defaultValue={query}
                      className="ui-input"
                      placeholder="Parcel ID, address, district, or municipality"
                    />
                    <div className="field-help">Search against parcel IDs, cadastral references, addresses, municipalities, and districts.</div>
                  </div>
                  <div className="field-stack">
                    <label className="field-label" htmlFor="municipality">Municipality</label>
                    <input
                      id="municipality"
                      name="municipality"
                      defaultValue={municipality}
                      className="ui-input"
                      placeholder="Frankfurt am Main"
                    />
                  </div>
                </div>

                <div className="action-row">
                  <button className={buttonClasses()} type="submit">
                    Search source parcels
                  </button>
                  <Link className={buttonClasses({ variant: "ghost" })} href={`/${orgSlug}/parcels/new`}>
                    Reset
                  </Link>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              className="index-surface index-surface--ledger"
              eyebrow="Source candidates"
              title="Select parcels to ingest"
              description="Single selection creates or reopens a source parcel. Multi-selection creates a grouped site foundation with derived combined area when the selected parcels are not already bound to another site."
              size="compact"
            >
              {sourceResults.items.length ? (
                <form action={action} className="content-stack">
                  <div className="field-grid field-grid--tri">
                    <div className="field-stack field-stack--span-full">
                      <label className="field-label" htmlFor="siteName">Optional site name</label>
                      <input
                        id="siteName"
                        name="siteName"
                        className="ui-input"
                        placeholder="Only needed if you want to override the default grouped-site name"
                      />
                      <div className="field-help">Leave blank to derive the site name from the selected source parcels.</div>
                    </div>
                  </div>

                  <div className="ops-table">
                    <div className="ops-table__header ops-table__header--parcels">
                      <div>Parcel</div>
                      <div>Area</div>
                      <div>Source</div>
                      <div>Geometry</div>
                      <div>Confidence</div>
                      <div>Workspace</div>
                      <div>Select</div>
                    </div>
                    {sourceResults.items.map((item) => (
                      <div key={item.id} className="ops-table__row ops-table__row--parcels">
                        <div className="ops-table__cell">
                          <div className="list-row__body">
                            <div className="list-row__title">
                              <span className="list-row__title-text">{item.displayName}</span>
                              <StatusBadge tone="surface">{item.providerName}</StatusBadge>
                            </div>
                            <div className="inline-meta">
                              <span className="meta-chip">{item.providerParcelId}</span>
                              {item.cadastralId ? <span className="meta-chip">{item.cadastralId}</span> : null}
                              <span className="meta-chip">{item.municipalityName ?? item.city ?? "No municipality"}</span>
                            </div>
                            <div className="list-row__meta list-row__meta--clamped">{item.addressLine1 ?? "No address returned by source"}</div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Area</div>
                            <div className="ops-scan__value">{item.landAreaSqm ?? "n/a"} sqm</div>
                            <div className="ops-scan__detail">{item.districtName ?? "District not returned"}</div>
                          </div>
                        </div>

                      <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Source</div>
                            <div className="action-row">
                              <StatusBadge tone={item.sourceAuthority === "CADASTRAL_GRADE" ? "success" : item.sourceAuthority === "SEARCH_GRADE" ? "warning" : "surface"}>
                                {getSourceAuthorityLabel(item.sourceAuthority) ?? "Source-backed"}
                              </StatusBadge>
                            </div>
                            <div className="ops-scan__detail">
                              {getSourceAuthorityDetail(item.sourceAuthority) ?? item.sourceReference}
                              <br />
                              {item.sourceReference}
                            </div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Geometry</div>
                            <div className="action-row">
                              {getGeometryStateBadge(item.hasGeometry, item.hasLandArea)}
                            </div>
                            <div className="ops-scan__detail">
                              {item.hasGeometry
                                ? "Geometry available from source"
                                : "Source record can still be ingested, but geometry is incomplete."}
                            </div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Confidence</div>
                            <div className="ops-scan__value">{getConfidenceBand(item.confidenceScore)}</div>
                            <div className="ops-scan__detail">{item.confidenceScore ?? "n/a"} source confidence</div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Workspace</div>
                            <div className="action-row">
                              {getWorkspaceStateBadge(item.workspaceState)}
                              {item.workspaceState === "EXISTING_STANDALONE_REUSABLE" ? (
                                <StatusBadge tone="accent">Group-ready</StatusBadge>
                              ) : item.workspaceState === "EXISTING_STANDALONE_LOCKED" ? (
                                <StatusBadge tone="warning">Safe migrate</StatusBadge>
                              ) : null}
                            </div>
                            <div className="ops-scan__detail">{getWorkspaceStateDetail(item)}</div>
                          </div>
                        </div>

                        <div className="ops-table__actions ops-table__actions--dense">
                          {item.workspaceState === "GROUPED_SITE_MEMBER" ? (
                            item.existingSite?.siteParcelId ? (
                              <Link
                                className={buttonClasses({ variant: "secondary", size: "sm" })}
                                href={`/${orgSlug}/parcels/${item.existingSite.siteParcelId}`}
                              >
                                Open site
                              </Link>
                            ) : (
                              <StatusBadge tone="warning">Locked</StatusBadge>
                            )
                          ) : (
                            <label className="field-row">
                              <input type="checkbox" name="sourceParcelId" value={item.id} />
                              <span className="field-help">
                                {getWorkspaceStateActionLabel(item)}
                              </span>
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="action-row">
                    <button className={buttonClasses({ size: "lg" })} type="submit">
                      Create parcel or grouped site
                    </button>
                    <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new/manual`}>
                      Manual fallback
                    </Link>
                  </div>
                </form>
              ) : (
                <EmptyState
                  eyebrow="No source matches"
                  title="No source parcels matched the current search"
                  description="Try another parcel ID, address fragment, municipality, or district. Manual fallback is still available if source coverage is missing."
                  actions={(
                    <>
                      <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new/manual`}>
                        Manual fallback
                      </Link>
                      <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels`}>
                        Back to parcels
                      </Link>
                    </>
                  )}
                />
              )}
            </SectionCard>
          </div>

          <div className="sidebar-stack">
            <NextStepPanel
              className="rail-panel rail-panel--action"
              title="Ingest parcels, then continue into planning"
              description="Source-backed parcel geometry and area should become the site anchor before planning interpretation and scenario setup begin."
              size="compact"
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/parcels`}>
                    Review parcel board
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                    Scenario studio
                  </Link>
                </>
              )}
            />

            <SectionCard
              className="rail-panel"
              eyebrow="Grouping foundation"
              title="How multi-parcel intake works"
              description="Selecting multiple parcels creates a grouped site foundation with combined area and constituent provenance."
              size="compact"
            >
              <div className="helper-list">
                <div>Each selected parcel is stored with its source identifier and provenance.</div>
                <div>A grouped site parcel is derived automatically so planning and scenarios can continue without manual geometry authoring.</div>
                <div>The grouped site detail links back to the included constituent parcels.</div>
                <div>Parcels that already belong to another grouped site stay locked to that existing site identity for now.</div>
              </div>
            </SectionCard>

            <SectionCard
              className="rail-panel"
              eyebrow="Fallback only"
              title="Manual parcel creation"
              description="Use manual entry only when source selection is missing or intentionally bypassed for testing."
              tone="muted"
              size="compact"
            >
              <div className="action-row">
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new/manual`}>
                  Open manual fallback
                </Link>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Parcel source intake unavailable"
          description="Source-backed parcel search could not load because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
